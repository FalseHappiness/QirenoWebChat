import { randomUUID } from 'node:crypto';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyRequest } from 'fastify';
import { extractToken } from './utils.js';

/**
 * Action 失败异常
 */
export class ActionFailed extends Error {
  data: Record<string, unknown>;

  constructor(data: Record<string, unknown>) {
    super(`Action failed: ${String(data['message'] ?? data['wording'] ?? 'Unknown error')}`);
    this.name = 'ActionFailed';
    this.data = data;
  }
}

/**
 * 待处理 action 条目
 */
interface PendingActionEntry {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * 流式 action 队列条目
 */
interface StreamQueueEntry {
  data: Record<string, unknown>;
  resolve: () => void;
}

/**
 * 流式 action 状态
 */
class StreamActionState {
  queue: StreamQueueEntry[] = [];
  waiters: { resolve: (entry: StreamQueueEntry) => void; reject: (err: Error) => void }[] = [];
  done = false;

  push(data: Record<string, unknown>): void {
    const entry: StreamQueueEntry = {
      data,
      resolve: () => {},
    };
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      waiter.resolve(entry);
    } else {
      this.queue.push(entry);
    }
  }

  async pop(timeout: number): Promise<StreamQueueEntry> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    if (this.done) {
      throw new Error('Stream ended');
    }
    return new Promise<StreamQueueEntry>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf({ resolve, reject } as any);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error('Stream action timed out'));
      }, timeout * 1000);
      this.waiters.push({
        resolve: (entry: StreamQueueEntry) => {
          clearTimeout(timer);
          resolve(entry);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  finish(): void {
    this.done = true;
    for (const waiter of this.waiters) {
      waiter.reject(new Error('Stream ended'));
    }
    this.waiters = [];
  }
}

/**
 * OneBot WebSocket 连接管理器
 */
export class OneBotConnectionManager {
  token: string | null;
  activeConnections: Map<number, WebSocket> = new Map(); // self_id (int) -> WebSocket
  connectionStates: Map<WebSocket, Record<string, unknown>> = new Map();
  pendingActions: Map<string, PendingActionEntry> = new Map();
  messageHandlers: Set<(data: Record<string, unknown>) => Promise<void> | void> = new Set();
  _streamStates: Map<string, StreamActionState> = new Map();
  _streamEchoes: Set<string> = new Set();

  constructor(token: string | null = null) {
    this.token = token;
  }

  async connect(websocket: WebSocket, request: FastifyRequest): Promise<void> {
    const authorization = request.headers['authorization'] ?? null;

    if (!await this.authenticate(websocket, authorization as string | null | undefined)) {
      return;
    }

    // @fastify/websocket 已自动 accept 连接
    // 使用事件监听方式处理消息（ws 库事件驱动模式）
    const onMessage = (rawData: Buffer | string) => {
      try {
        const messageStr = typeof rawData === 'string' ? rawData : rawData.toString();
        const data = JSON.parse(messageStr) as Record<string, unknown>;
        // 异步处理但不阻塞事件循环
        this.handleMessage(websocket, data).catch((err) => {
          console.error(`WebSocket message handler error: ${err}`);
        });
      } catch (err) {
        console.error(`WebSocket message parse error: ${err}`);
      }
    };

    const onClose = () => {
      this.disconnect(websocket).catch((err) => {
        console.error(`WebSocket disconnect error: ${err}`);
      });
    };

    const onError = (err: Error) => {
      console.error(`WebSocket error: ${err}`);
    };

    websocket.on('message', onMessage);
    websocket.on('close', onClose);
    websocket.on('error', onError);
  }

  async authenticate(websocket: WebSocket, authHeader: string | null | undefined): Promise<boolean> {
    /* 验证连接Token */
    if (!this.token) return true;

    const token = extractToken(authHeader);
    if (token !== this.token) {
      console.log('Invalid token:', token);
      websocket.close(1008, 'Invalid token');
      return false;
    }
    return true;
  }

  async registerConnection(websocket: WebSocket, selfId: number): Promise<boolean> {
    /* 注册已验证的连接 */
    if (this.activeConnections.has(selfId)) {
      websocket.close(1008, `Duplicate self_id: ${selfId}`);
      return false;
    }

    this.activeConnections.set(selfId, websocket);
    this.connectionStates.set(websocket, { self_id: selfId, authenticated: true });
    console.log(`OneBot connected: ${selfId}`);
    return true;
  }

  async disconnect(websocket: WebSocket): Promise<void> {
    /* 断开连接并清理资源 */
    const state = this.connectionStates.get(websocket);
    if (state && 'self_id' in state) {
      const selfId = state['self_id'] as number;
      this.activeConnections.delete(selfId);
      console.log(`OneBot disconnected: ${selfId}`);
    }
    this.connectionStates.delete(websocket);

    try {
      websocket.close();
    } catch {
      // 忽略关闭错误
    }
  }

  getFirstSelfId(): number | null {
    const first = this.activeConnections.keys().next();
    return first.done ? null : first.value;
  }

  async callAction(action: string, params: Record<string, unknown>, selfId: number | null = null, timeout: number = 60): Promise<unknown> {
    if (this.activeConnections.size === 0) {
      throw new Error('No active OneBot connections');
    }

    if (selfId === null) {
      if (this.activeConnections.size === 1) {
        selfId = this.getFirstSelfId()!;
      } else {
        throw new Error('self_id required when multiple bots connected');
      }
    }

    const result = await this.sendAction(selfId, action, params, timeout);

    if (typeof result === 'object' && result !== null && 'status' in (result as Record<string, unknown>)) {
      const r = result as Record<string, unknown>;
      if (r['status'] === 'ok') {
        return r['data'];
      }
    }

    return result;
  }

  cancelAction(echo: string): void {
    /* 取消一个正在等待响应的 action */
    const pending = this.pendingActions.get(echo);
    if (pending) {
      this.pendingActions.delete(echo);
      console.log(`OneBot action cancelled (echo: ${echo})`);
    }
  }

  async sendAction(selfId: number, action: string, params: Record<string, unknown>, timeout: number = 60): Promise<unknown> {
    /* 发送API动作并等待响应 */
    const ws = this.activeConnections.get(selfId);
    if (!ws) {
      throw new Error(`No active connection for self_id: ${selfId}`);
    }

    const echo = randomUUID();
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    this.pendingActions.set(echo, { resolve, reject });

    try {
      ws.send(JSON.stringify({
        action,
        params,
        echo,
      }));

      const result = await promise as Record<string, unknown>;
      return result;
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(String(err));
    } finally {
      this.pendingActions.delete(echo);
    }
  }

  async callStreamAction(
    action: string,
    params: Record<string, unknown>,
    selfId: number | null = null,
    timeout: number = 30,
  ): Promise<AsyncGenerator<Record<string, unknown>, void, unknown>> {
    /* 发送流式API动作并异步生成响应 */
    if (this.activeConnections.size === 0) {
      throw new Error('No active OneBot connections');
    }

    if (selfId === null) {
      if (this.activeConnections.size === 1) {
        selfId = this.getFirstSelfId()!;
      } else {
        throw new Error('self_id required when multiple bots connected');
      }
    }

    const ws = this.activeConnections.get(selfId);
    if (!ws) {
      throw new Error(`No active connection for self_id: ${selfId}`);
    }

    const echo = randomUUID();
    const streamState = new StreamActionState();
    this.pendingActions.set(echo, {
      resolve: () => {},
      reject: () => {},
    });

    // 存储流状态到单独的 map 中
    this._streamStates.set(echo, streamState);

    // 保存 stream echo 引用
    this._streamEchoes.add(echo);

    try {
      ws.send(JSON.stringify({
        action,
        params,
        echo,
      }));

      const generator = async function* (
        mgr: OneBotConnectionManager,
        streamEcho: string,
        state: StreamActionState,
        timeoutSec: number,
      ) {
        try {
          while (true) {
            const entry = await state.pop(timeoutSec);
            const data = entry.data;

            // 检查是否到达最终响应
            if (data['data'] && typeof data['data'] === 'object') {
              const innerData = data['data'] as Record<string, unknown>;
              if (innerData['type'] === 'response') {
                break; // 遇到最终响应时结束
              }
              if (innerData['type'] === 'error') {
                throw new Error(`Stream action failed: ${JSON.stringify(innerData)}`);
              }
            }

            yield data;
          }
        } finally {
          mgr._streamStates.delete(streamEcho);
          mgr._streamEchoes.delete(streamEcho);
          mgr.pendingActions.delete(streamEcho);
        }
      };

      return generator(this, echo, streamState, timeout);
    } catch (err) {
      this._streamStates.delete(echo);
      this._streamEchoes.delete(echo);
      this.pendingActions.delete(echo);
      throw err;
    }
  }

  async handleMessage(websocket: WebSocket, message: Record<string, unknown>): Promise<void> {
    /* 处理接收到的消息 */
    try {
      const data = message;

      // 处理连接生命周期事件
      if (data['post_type'] === 'meta_event' && data['meta_event_type'] === 'lifecycle') {
        const state = this.connectionStates.get(websocket) ?? {};
        if (!state['authenticated']) {
          if (!await this.authenticate(websocket, null)) {
            return;
          }
          if (!await this.registerConnection(websocket, Number(data['self_id']))) {
            return;
          }
        }
      }

      // 处理API响应
      if (typeof data['echo'] === 'string') {
        const echo = data['echo'] as string;

        // 先检查是否是流式 action 响应
        if (this._streamStates.has(echo)) {
          const state = this._streamStates.get(echo)!;
          if ('status' in data && data['status'] === 'failed') {
            state.push({ data: { type: 'error', ...data } as unknown as Record<string, unknown>, resolve: () => {} });
            state.finish();
          } else {
            state.push(data);
          }
          return;
        }

        const pending = this.pendingActions.get(echo);
        if (pending) {
          if ('status' in data && data['status'] === 'failed') {
            pending.reject(new ActionFailed(data));
          } else {
            pending.resolve(data);
          }
          return;
        }
      }

      // 处理事件推送
      if ('post_type' in data) {
        for (const handler of this.messageHandlers) {
          try {
            const result = handler(data);
            if (result instanceof Promise) {
              await result;
            }
          } catch (err) {
            console.error(`Error in message handler: ${err}`);
          }
        }
      }
    } catch (err) {
      console.error(`Invalid message: ${err}`);
    }
  }

  addMessageHandler(handler: (data: Record<string, unknown>) => Promise<void> | void): () => void {
    /* 添加消息处理器 */
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  async broadcastEvent(event: Record<string, unknown>): Promise<void> {
    /* 向所有连接的客户端广播事件 */
    for (const ws of this.activeConnections.values()) {
      try {
        ws.send(JSON.stringify(event));
      } catch {
        await this.disconnect(ws);
      }
    }
  }
}