import { ref } from 'vue'
import { convertWrappedMsgSL } from '../snow-luma-translator.js'
import { isSupportedNoticeMessage } from '../parse-message.js'

/**
 * AbstractConnectionBridge
 *
 * 连接桥接器的抽象基类，封装了 ConnectionBridge 和 ConnectionBridgeOnebot 的公共逻辑：
 * - 公共状态属性（socket、lastMessageId、重连状态等）
 * - pending 请求管理（sendAction / reqBackend 的 echo 回调机制）
 * - 消息处理流水线（onReceiveMessage → handleNewMessage / handleNewNotice）
 * - 联系人更新逻辑
 * - 清理 pending 请求
 * - 断开连接的标准流程（模板方法）
 *
 * 子类必须实现：
 * - connect()
 * - syncMessages()
 * - _commonWebSocketRequest(options, signal, timeout, pendingMap)
 *
 * 子类可选择性覆盖：
 * - _onDisconnect()  — 自定义关闭连接的具体行为
 * - destroy()         — 添加额外的清理逻辑
 */
export class AbstractConnectionBridge {
  /**
   * @param {string|object} url - WebSocket 地址（或含 url/token 的对象，由子类解析）
   * @param {object} callbacks
   * @param {Function} callbacks.onMessage
   * @param {Function} callbacks.onNewContact
   * @param {Function} callbacks.onNotice
   */
  constructor(url, { onMessage, onNewContact, onNotice }) {
    this.url = url
    this.callbacks = {
      onMessage,
      onNewContact,
      onNotice
    }

    // 实例状态（保留 ref 方便 Vue 直接绑定）
    this.socket = ref(null)
    this.lastMessageId = ref(0)
    this.reconnectAttempts = ref(0)
    this.maxReconnectAttempts = Infinity
    this.reconnectInterval = 3000
    this.isConnected = ref(false)
    this.shouldSync = ref(false)
    this.reconnectTimer = null
    this.isClosed = false

    // 存储正在等待响应的 send_action / req_backend 回调
    this.pendingActions = new Map()
    this.pendingBackendRequests = new Map()
  }

  // ==================== 公开接口 ====================

  /**
   * 通过 WebSocket 发送 action 请求并等待响应
   * @param {string} action - OneBot action 名称
   * @param {object} params - action 参数
   * @param {AbortSignal} [signal] - 终止信号
   * @param {number} timeout - 超时时间(毫秒)
   * @returns {Promise<any>} action 响应数据
   */
  sendAction(action, params = {}, signal = undefined, timeout = 60 * 1000) {
    return this._commonWebSocketRequest(
      { type: 'send_action', action, params },
      signal,
      timeout,
      this.pendingActions
    )
  }

  /**
   * 通过 WebSocket 发送 req_backend 请求并等待响应
   * @param {string} endpoint - 后端 endpoint 名称 (contacts / get_msg / messages / sync)
   * @param {object} params - 请求参数
   * @param {AbortSignal} [signal] - 终止信号
   * @param {number} timeout - 超时时间(毫秒)
   * @returns {Promise<any>} 后端响应数据
   */
  reqBackend(endpoint, params = {}, signal = undefined, timeout = 60 * 1000) {
    return this._commonWebSocketRequest(
      { type: 'req_backend', endpoint, params },
      signal,
      timeout,
      this.pendingBackendRequests
    )
  }

  // ==================== 消息处理 ====================

  /**
   * 接收并处理 WebSocket 消息
   * @param {object} message - 解析后的消息对象
   * @param {boolean} [echo_msg=false] - 是否在控制台打印消息
   */
  onReceiveMessage(message, echo_msg = false) {
    try {
      // 检查是否是 send_action 的响应
      if (message.type === 'send_action_response') {
        const echo = message.echo
        if (echo && this.pendingActions.has(echo)) {
          const { resolve, cleanup } = this.pendingActions.get(echo)
          this.pendingActions.delete(echo)
          cleanup && cleanup()
          resolve(message)
        }
        return
      }

      // 检查是否是 req_backend 的响应
      if (message.type === 'req_backend_response') {
        const echo = message.echo
        if (echo && this.pendingBackendRequests.has(echo)) {
          const { resolve, cleanup } = this.pendingBackendRequests.get(echo)
          this.pendingBackendRequests.delete(echo)
          cleanup && cleanup()
          resolve(message)
        }
        return
      }

      if (message.id > this.lastMessageId.value) {
        this.lastMessageId.value = message.id
      }
      message = convertWrappedMsgSL(message)
      if (echo_msg) {
        console.log(message.post_type === 'notice' ? '收到新通知:' : '收到新消息:', message)
      }
      this.handleNewMessage(message)
      this.handleNewNotice(message)
    } catch (error) {
      console.error('Error parsing WebSocket message:', error)
    }
  }

  /**
   * 处理新消息（message / message_sent 类型）
   * @param {object} message
   */
  handleNewMessage(message) {
    if (!['message', 'message_sent'].includes(message.post_type)) {
      return
    }

    this.callbacks.onMessage(message)

    // 检查是否是新的联系人
    const contactId = message.message_type === 'group' ? message.group_id : (message.target_id || message.user_id)
    const contactType = message.message_type
    const event = typeof message.event === 'string' ? JSON.parse(message.event) : message.event
    const contactName = event?.group_name || event?.sender?.nickname

    this.callbacks.onNewContact({
      contact_id: contactId,
      type: contactType,
      name: contactName,
      last_time: message.created_at,
      last_timestamp: message.time,
      latest_msg: JSON.stringify(event),
      max_cursor: {
        type: 'real_seq',
        value: message.real_seq
      }
    })
  }

  /**
   * 处理新通知（notice 类型）
   * @param {object} notice
   */
  handleNewNotice(notice) {
    if (notice.post_type !== 'notice') {
      return
    }

    this.callbacks.onNotice(notice)

    if (isSupportedNoticeMessage(notice)) {
      const type = notice.group_id ? 'group' : 'private'
      const contact_id = notice.group_id || notice.user_id

      this.callbacks.onNewContact({
        contact_id: contact_id,
        type: type,
        name: null,
        last_time: notice.created_at,
        last_timestamp: notice.time,
        latest_msg: notice.event,
        max_cursor: {
          type: 'id',
          value: notice.id
        }
      })
    }
  }

  // ==================== 连接管理 ====================

  /**
   * 清理所有 pending 请求
   */
  clearAllPending() {
    for (const [echo, { reject, cleanup }] of this.pendingActions) {
      cleanup && cleanup()
      reject(new Error('WebSocket disconnected'))
    }
    this.pendingActions.clear()

    for (const [echo, { reject, cleanup }] of this.pendingBackendRequests) {
      cleanup && cleanup()
      reject(new Error('WebSocket disconnected'))
    }
    this.pendingBackendRequests.clear()
  }

  /**
   * 断开 WebSocket 连接（模板方法，子类可覆盖 _onDisconnect 自定义关闭行为）
   */
  disconnect() {
    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.isClosed = true
    this.reconnectAttempts.value = this.maxReconnectAttempts

    // 清理所有待处理的请求
    this.clearAllPending()

    // 执行子类自定义的关闭逻辑
    this._onDisconnect()

    // 重置连接状态
    this.isConnected.value = false
    this.shouldSync.value = false
  }

  /**
   * 关闭连接的具体行为（子类可覆盖）
   * 默认实现：关闭原生 WebSocket 并置空
   */
  _onDisconnect() {
    if (this.socket.value) {
      this.socket.value.close(1000, 'Client disconnect')
      this.socket.value = null
    }
  }

  /**
   * 在组件卸载时调用，释放资源
   * 子类可覆盖以添加额外的清理逻辑（如移除事件监听器、卸载 VirtualProtocol 等）
   */
  destroy() {
    this.disconnect()
  }

  // ==================== 抽象方法（子类必须实现） ====================

  /** 建立 WebSocket 连接 */
  connect() {
    throw new Error('Subclass must implement connect()')
  }

  /** 同步消息 */
  syncMessages() {
    throw new Error('Subclass must implement syncMessages()')
  }

  /**
   * 通用 WebSocket 请求底层方法
   * @param {object} options - 请求配置 { type, action/endpoint, params }
   * @param {AbortSignal|null|undefined} signal - 终止信号
   * @param {number} timeout - 超时时间(毫秒)
   * @param {Map} pendingMap - pending 回调存储 Map
   * @returns {Promise<any>} 请求响应数据
   */
  _commonWebSocketRequest(options, signal, timeout, pendingMap) {
    throw new Error('Subclass must implement _commonWebSocketRequest()')
  }
}