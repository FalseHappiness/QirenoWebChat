import type { WebSocket } from '@fastify/websocket';
import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { OneBotConnectionManager } from './onebot_manager.js';

/**
 * 前端 WebSocket 连接管理器
 */
export class FrontendConnectionManager {
  activeConnections: Set<WebSocket> = new Set();
  onebotManager: OneBotConnectionManager | null;
  // 存储正在执行的 action 任务 (echo -> { websocket, abort })
  pendingActionTasks: Map<string, { websocket: WebSocket; abort: AbortController }> = new Map();
  // req_backend 处理器映射: endpoint -> handler_function(params) -> dict
  reqBackendHandlers: Map<string, (params: Record<string, unknown>) => Promise<unknown>> = new Map();
  // 存储每个连接的 self_id（前端选择的bot，int 类型）
  connectionSelfId: Map<WebSocket, number | null> = new Map();

  constructor(onebotManager: OneBotConnectionManager | null = null, reqBackendHandlers: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {}) {
    this.onebotManager = onebotManager;
    for (const [ key, handler ] of Object.entries(reqBackendHandlers)) {
      this.reqBackendHandlers.set(key, handler);
    }
  }

  async connect(websocket: WebSocket, request: FastifyRequest, selfId: string | null = null): Promise<void> {
    /* 处理新的WebSocket连接 */
    // @fastify/websocket 已自动 accept 连接
    this.activeConnections.add(websocket);
    if (selfId) {
      this.connectionSelfId.set(websocket, Number(selfId));
    }
    console.log(`新前端连接，当前连接数: ${this.activeConnections.size}, self_id: ${selfId}`);

    // 使用事件监听方式处理消息（ws 库事件驱动模式）
    const onMessage = (rawData: Buffer | string) => {
      try {
        const messageStr = typeof rawData === 'string' ? rawData : rawData.toString();
        const data = JSON.parse(messageStr) as Record<string, unknown>;
        // 异步处理但不阻塞事件循环
        this.processMessage(websocket, data).catch((err) => {
          console.error(`WebSocket process message error: ${err}`);
        });
      } catch (err) {
        console.log(`WebSocket message parse error: ${err}`);
      }
    };

    const onClose = () => {
      this.disconnect(websocket);
    };

    const onError = (err: Error) => {
      console.log(`WebSocket error: ${err}`);
    };

    websocket.on('message', onMessage);
    websocket.on('close', onClose);
    websocket.on('error', onError);
  }

  disconnect(websocket: WebSocket): void {
    /* 处理连接断开 */
    // 取消该连接相关的所有 pending action 任务
    for (const [ echo, entry ] of this.pendingActionTasks) {
      if (entry.websocket === websocket) {
        entry.abort.abort();
        this.pendingActionTasks.delete(echo);
      }
    }

    this.activeConnections.delete(websocket);
    this.connectionSelfId.delete(websocket);
    console.log(`前端断开连接，剩余连接数: ${this.activeConnections.size}`);
  }

  async processMessage(websocket: WebSocket, message: Record<string, unknown>): Promise<void> {
    /* 处理来自前端的消息 */
    const msgType = String(message['type'] ?? '');

    if (msgType === 'send_action') {
      const echo = String(message['echo'] ?? randomUUID());
      const abortController = new AbortController();
      this.pendingActionTasks.set(echo, { websocket, abort: abortController });

      try {
        await this.handleSendAction(websocket, message, echo, abortController.signal);
      } finally {
        this.pendingActionTasks.delete(echo);
      }
    } else if (msgType === 'cancel_action') {
      await this.handleCancelAction(websocket, message);
    } else if (msgType === 'req_backend') {
      const echo = String(message['echo'] ?? randomUUID());
      const abortController = new AbortController();
      this.pendingActionTasks.set(echo, { websocket, abort: abortController });

      try {
        await this.handleReqBackend(websocket, message, echo, abortController.signal);
      } finally {
        this.pendingActionTasks.delete(echo);
      }
    } else {
      console.log('收到消息:', message);
      console.log(websocket);
    }
  }

  async handleCancelAction(websocket: WebSocket, message: Record<string, unknown>): Promise<void> {
    /* 处理前端发来的 cancel_action 请求，取消正在执行的 action */
    const echo = String(message['echo'] ?? '');
    if (!echo) return;

    const entry = this.pendingActionTasks.get(echo);
    if (entry) {
      entry.abort.abort();
      this.pendingActionTasks.delete(echo);
      console.log(`取消 action (echo: ${echo})`);
    }
  }

  async handleSendAction(websocket: WebSocket, message: Record<string, unknown>, echo: string, signal: AbortSignal): Promise<void> {
    /* 处理前端发来的 send_action 请求，转发给 OneBot 并返回结果 */
    try {
      if (!this.onebotManager) {
        await this.sendJson(websocket, {
          type: 'send_action_response',
          echo,
          status: 'error',
          message: 'OneBot manager not available',
        });
        return;
      }

      const action = String(message['action'] ?? '');
      const params = (message['params'] as Record<string, unknown>) ?? {};
      const timeout = Number(params['timeout'] ?? 60);

      // 获取该连接对应的 self_id，优先使用连接时指定的 self_id
      const selfId = this.connectionSelfId.get(websocket) ?? null;

      try {
        const result = await this.onebotManager.callAction(action, params, selfId, timeout);

        const response = {
          type: 'send_action_response',
          echo,
          status: 'ok',
          data: result,
        };
        await this.sendJson(websocket, response);
      } catch (err) {
        if (signal.aborted) {
          console.log(`action 已取消: ${action} (echo: ${echo})`);
          await this.sendJson(websocket, {
            type: 'send_action_response',
            echo,
            status: 'cancelled',
            message: 'Action cancelled by user',
          });
        } else {
          console.log(`action 失败: ${action} -> ${err}`);
          await this.sendJson(websocket, {
            type: 'send_action_response',
            echo,
            status: 'error',
            message: String(err),
          });
        }
      }
    } catch (err) {
      // 任务被取消时的清理
      throw err;
    }
  }

  async handleReqBackend(websocket: WebSocket, message: Record<string, unknown>, echo: string, signal: AbortSignal): Promise<void> {
    /* 处理前端发来的 req_backend 请求，调用本地注册的处理器并返回结果 */
    try {
      const endpoint = String(message['endpoint'] ?? '');
      const params = (message['params'] as Record<string, unknown>) ?? {};

      // 注入该连接对应的 self_id 到 params 中
      const selfId = this.connectionSelfId.get(websocket);
      if (selfId !== undefined && selfId !== null) {
        params['self_id'] = selfId;
      }

      const handler = this.reqBackendHandlers.get(endpoint);
      if (!handler) {
        await this.sendJson(websocket, {
          type: 'req_backend_response',
          echo,
          status: 'error',
          message: `Unknown endpoint: ${endpoint}`,
        });
        return;
      }

      try {
        const result = await handler(params);
        await this.sendJson(websocket, {
          type: 'req_backend_response',
          echo,
          status: 'ok',
          data: result,
        });
      } catch (err) {
        if (signal.aborted) {
          console.log(`req_backend 已取消: ${endpoint} (echo: ${echo})`);
          await this.sendJson(websocket, {
            type: 'req_backend_response',
            echo,
            status: 'cancelled',
            message: 'Request cancelled by user',
          });
        } else {
          console.log(`req_backend 失败: ${endpoint} -> ${err}`);
          console.error(err);
          await this.sendJson(websocket, {
            type: 'req_backend_response',
            echo,
            status: 'error',
            message: String(err),
          });
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async broadcast(message: Record<string, unknown>): Promise<void> {
    /* 广播消息给所有连接的前端 */
    if (this.activeConnections.size > 0) {
      await Promise.all(
        [ ...this.activeConnections ].map((conn) => this.sendJson(conn, message).catch(() => {
        })),
      );
    }
  }

  async broadcastToSelfId(selfId: number, message: Record<string, unknown>): Promise<void> {
    /* 仅广播消息给指定 self_id 对应的前端连接 */
    const targetConnections = [ ...this.connectionSelfId.entries() ]
      .filter(([ ws, sid ]) => sid === selfId && this.activeConnections.has(ws))
      .map(([ ws ]) => ws);

    if (targetConnections.length > 0) {
      await Promise.all(
        targetConnections.map((conn) => this.sendJson(conn, message).catch(() => {
        })),
      );
    }
  }

  private async sendJson(websocket: WebSocket, data: Record<string, unknown>): Promise<void> {
    websocket.send(JSON.stringify(data));
  }
}