import { nanoid } from 'nanoid';
import { useGlobalStore } from '@/store/global.js';
import { convertWrappedMsgSL } from '../../snow-luma-translator.js';
import { AbstractConnectionBridge } from '../abstract-connection-bridge.js';
import { OneBotWSConnection } from './onebot-ws.js';
import {
  processAndStoreEvent,
  getContactsCore,
  getMessagesCore,
  getMsgCore,
  syncMessagesCore,
  getAddRequestsCore,
  getMsgLikesCore,
} from './handler.js';
import { virtualDB } from './db.js';
import VirtualProtocol, {
  createGetFileDataHandler,
  createGetStreamFileDataHandler,
  createProxyGroupFileHandler,
  createProxyPrivateFileHandler,
} from './virtual-protocol.js';
import { isObject } from "../../types-util.js";
import { checkResponseOK } from "@/scripts/backend-api.js";

/**
 * ConnectionBridgeOnebot
 *
 * 继承 AbstractConnectionBridge，直接连接 NapCat 的 OneBot WS 服务器。
 * - sendAction: 直接发送标准 OneBot v11 action 到 NapCat（通过 OneBotWSConnection）
 * - reqBackend: 委托 handler.js 的函数本地处理
 * - 接收来自 NapCat 的实时事件并存入本地数据库
 */
export class ConnectionBridgeOnebot extends AbstractConnectionBridge {
  /**
   * @param {string|{url: string, token: string}} urlOpt - NapCat OneBot WS 地址 (如 ws://127.0.0.1:3001)，或 WS 地址与 Token 对象
   * @param {object} callbacks
   * @param {Function} callbacks.onMessage
   * @param {Function} callbacks.onNewContact
   * @param {Function} callbacks.onNotice
   */
  constructor(urlOpt, { onMessage, onNewContact, onNotice }) {
    super(urlOpt, { onMessage, onNewContact, onNotice });

    this.token = null
    if (isObject(urlOpt)) {
      ({ url: this.url, token: this.token } = urlOpt)
    }

    // 创建 OneBot WS 连接器
    this.onebotWS = new OneBotWSConnection(this.url, this.token);

    // 注册事件处理器
    this.removeEventHandler = this.onebotWS.addEventHandler((data) => this._onOneBotEvent(data));

    // 同步 OneBot WS 状态
    this.onebotWS.onConnected = () => {
      this.isConnected.value = true;
      this.reconnectAttempts.value = 0;
      this.socket.value = this.onebotWS.socket.value;
      console.log('[ConnectionBridgeOnebot] Connected');

      this.onebotWS.callAction('get_version_info', {})
        .then(res => {
          if (!checkResponseOK(res)) throw new Error(JSON.stringify(res))
          useGlobalStore().apiVersionInfo = res.dat;
        })
        .catch(e => console.log('Unable to get api version info:', e));

      if (this.shouldSync.value) this._syncMessages();
    };

    this.onebotWS.onDisconnected = () => {
      this.isConnected.value = false;
      this.shouldSync.value = true;
    };

    // 初始化 VirtualProtocol
    this.virtualProtocol = new VirtualProtocol();
    this.virtualProtocol.registerRoute(
      '/api/get_file_data',
      createGetFileDataHandler({
        callAction: (action, params) => this.onebotWS.callAction(action, params, null, 20 * 60 * 1000)
      })
    );
    this.virtualProtocol.registerRoute(
      '/api/get_stream_file_data',
      createGetStreamFileDataHandler({
        callAction: (action, params) => this.onebotWS.callAction(action, params, null, 20 * 60 * 1000)
      })
    );
    this.virtualProtocol.registerRoute(
      '/api/proxy_group_file',
      createProxyGroupFileHandler({
        callAction: (action, params) => this.onebotWS.callAction(action, params, null, 20 * 60 * 1000)
      })
    );
    this.virtualProtocol.registerRoute(
      '/api/proxy_private_file',
      createProxyPrivateFileHandler({
        callAction: (action, params) => this.onebotWS.callAction(action, params, null, 20 * 60 * 1000)
      })
    );
    this.virtualProtocol.mount();

    this.connect();
  }

  // ========== OneBot 事件处理 ==========

  async _onOneBotEvent(event) {
    // 首次收到 meta_event 且提取到 self_id
    if (event.post_type === 'meta_event' && event.self_id && !this.selfId.value) {
      this.selfId.value = event.self_id
      console.log('[ConnectionBridgeOnebot] Receive self_id:', event.self_id);
      // meta_event 无需后续处理
      return;
    }

    const frontendMessage = await processAndStoreEvent(event, virtualDB);
    if (!frontendMessage) return;

    const converted = convertWrappedMsgSL(frontendMessage);

    if (converted.id > this.lastMessageId.value) {
      this.lastMessageId.value = converted.id;
    }

    console.log(converted.post_type === 'notice' ? '收到新通知:' : '收到新消息:', converted);

    this.handleNewMessage(converted);
    this.handleNewNotice(converted);
  }

  // ========== 抽象方法实现 ==========

  _commonWebSocketRequest(options, signal, timeout, pendingMap) {
    return new Promise((resolve, reject) => {
      if (!navigator.onLine) {
        reject(new Error("Network Error: Unable to connect to the internet."))
        return;
      }
      if (!this.onebotWS.isConnected.value) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      if (signal && signal.aborted) {
        reject(new DOMException('The operation was aborted', 'AbortError'));
        return;
      }

      const echo = nanoid();
      const cleanup = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        if (pendingMap.has(echo)) {
          pendingMap.delete(echo);
          cleanup();
          reject(new DOMException('The operation was aborted', 'AbortError'));
        }
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      pendingMap.set(echo, { resolve, reject, cleanup });

      setTimeout(() => {
        if (pendingMap.has(echo)) {
          pendingMap.delete(echo);
          cleanup();
          reject(new Error(`${ options.action || options.endpoint } timed out after ${ timeout }ms`));
        }
      }, timeout);

      if (options.type === 'send_action') {
        this.onebotWS.callAction(options.action, options.params, signal, timeout)
          .then(response => {
            if (pendingMap.has(echo)) {
              pendingMap.delete(echo);
              cleanup();
              resolve(response);
            }
          })
          .catch(error => {
            if (pendingMap.has(echo)) {
              pendingMap.delete(echo);
              cleanup();
              reject(error);
            }
          });
      } else if (options.type === 'req_backend') {
        this._handleReqBackendLocal(options.endpoint, options.params)
          .then(result => {
            if (pendingMap.has(echo)) {
              pendingMap.delete(echo);
              cleanup();
              resolve(result);
            }
          })
          .catch(error => {
            if (pendingMap.has(echo)) {
              pendingMap.delete(echo);
              cleanup();
              reject(error);
            }
          });
      }
    });
  }

  reqBackend(endpoint, params = {}, signal = undefined, timeout = 10 * 60 * 1000) {
    return this._commonWebSocketRequest({
      type: 'req_backend',
      endpoint,
      params
    }, signal, timeout, this.pendingBackendRequests);
  }

  // ========== req_backend 本地处理（委托给 handler.js） ==========

  async _handleReqBackendLocal(endpoint, params) {
    // 注入当前连接的 self_id，供 syncMessagesCore 等需要 params 中 self_id 的函数使用
    if (!params.self_id && this.selfId.value) {
      params.self_id = this.selfId.value;
    }
    switch (endpoint) {
      case 'contacts': {
        const contacts = await getContactsCore(virtualDB, this.onebotWS, params);
        return { status: 'success', data: contacts };
      }
      case 'messages': {
        const result = await getMessagesCore(params, virtualDB, this.onebotWS);
        for (const idx in result.messages) {
          result.messages[idx] = convertWrappedMsgSL(result.messages[idx]);
        }
        return { status: 'success', data: result };
      }
      case 'get_msg': {
        const msg = await getMsgCore(params, virtualDB, this.onebotWS);
        return { status: 'success', data: msg };
      }
      case 'sync': {
        const syncResult = await syncMessagesCore(params, virtualDB);
        return { status: 'success', data: syncResult };
      }
      case 'get_add_requests': {
        const requests = await getAddRequestsCore(virtualDB);
        return { status: 'success', data: requests };
      }
      case 'get_msg_likes': {
        const result = await getMsgLikesCore(params, virtualDB);
        return { status: 'success', data: result };
      }
      default:
        throw new Error(`Unknown backend endpoint: ${ endpoint }`);
    }
  }

  // ========== 消息同步 ==========

  syncMessages() {
    this._syncMessages();
  }

  async _syncMessages() {
    try {
      const result = await syncMessagesCore({
        last_id: this.lastMessageId.value,
        self_id: this.selfId.value,
      }, virtualDB);
      if (result.messages) {
        for (const msg of result.messages) this.onReceiveMessage(msg);
      }
      this.shouldSync.value = false;
    } catch (error) {
      console.error('Sync failed:', error);
      setTimeout(() => this._syncMessages(), 5000);
    }
  }

  // ========== 连接管理 ==========

  connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.onebotWS.connect();
  }

  /**
   * 覆盖基类 _onDisconnect：使用 OneBotWSConnection 的断开逻辑
   */
  _onDisconnect() {
    this.onebotWS.disconnect();
  }

  destroy() {
    this.removeEventHandler?.();
    this.disconnect();
    this.onebotWS.destroy();
    if (this.virtualProtocol) this.virtualProtocol.unmount();
  }
}