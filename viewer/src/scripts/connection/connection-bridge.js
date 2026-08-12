import { nanoid } from "nanoid";
import { fetchAPIVersionInfo, fetchSyncMessages } from "../backend-api.js";
import { useGlobalStore } from "@/store/global.js";
import { AbstractConnectionBridge } from "./abstract-connection-bridge.js";

export class ConnectionBridge extends AbstractConnectionBridge {
  /**
   * @param {string} url websocket地址
   * @param {object} callbacks
   * @param {Function} callbacks.onMessage
   * @param {Function} callbacks.onNewContact
   * @param {Function} callbacks.onNotice
   */
  constructor(url, { onMessage, onNewContact, onNotice }) {
    super(url, { onMessage, onNewContact, onNotice })

    // 初始化连接
    this.connect()
  }

  /**
   * 通用WebSocket请求底层方法（抽取sendAction/reqBackend重复逻辑）
   * @param {object} options - 请求配置
   * @param {string} options.type - 请求类型 send_action / req_backend
   * @param {string} [options.action] - action名称（send_action专用）
   * @param {string} [options.endpoint] - 后端接口地址（req_backend专用）
   * @param {object} options.params - 请求参数
   * @param {AbortSignal|null|undefined} signal - 终止信号
   * @param {number} timeout - 超时时间(毫秒)
   * @param {Map} pendingMap - pending回调存储Map
   * @returns {Promise<any>} 请求响应数据
   */
  _commonWebSocketRequest(options, signal, timeout, pendingMap) {
    return new Promise((resolve, reject) => {
      if (!navigator.onLine) {
        reject(new Error("Network Error: Unable to connect to the internet."))
        return;
      }
      if (!this.socket.value || this.socket.value.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'))
        return
      }

      // 如果信号已经中止，立即拒绝
      if (signal && signal.aborted) {
        reject(new DOMException('The operation was aborted', 'AbortError'))
        return
      }

      const echo = nanoid()

      // 清理 abort 事件监听
      const cleanup = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort)
        }
      }

      // 监听 abort 信号
      const onAbort = () => {
        if (pendingMap.has(echo)) {
          pendingMap.delete(echo)
          cleanup()
          // 通知后端取消该请求
          if (this.socket.value && this.socket.value.readyState === WebSocket.OPEN) {
            this.socket.value.send(JSON.stringify({
              type: 'cancel_action',
              echo: echo
            }))
          }
          reject(new DOMException('The operation was aborted', 'AbortError'))
        }
      }

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true })
      }

      // 存储回调、清理方法
      pendingMap.set(echo, { resolve, reject, cleanup })

      // 超时处理
      setTimeout(() => {
        if (pendingMap.has(echo)) {
          pendingMap.delete(echo)
          cleanup()
          const tipText = options.action || options.endpoint
          reject(new Error(`${tipText} timed out after ${timeout}ms`))
        }
      }, timeout)

      // 组装请求报文
      const sendData = {
        type: options.type,
        echo: echo,
        timeout: timeout / 1000,
        params: options.params
      }
      // 差异化参数赋值
      if (options.type === 'send_action') {
        sendData.action = options.action
      }
      if (options.type === 'req_backend') {
        sendData.endpoint = options.endpoint
      }

      // 发送请求
      this.socket.value.send(JSON.stringify(sendData))
    })
  }

  // 同步新消息
  async syncMessages() {
    try {
      if (this.lastMessageId.value !== -1) {
        const result = await fetchSyncMessages(this.lastMessageId.value)
        result?.messages?.forEach(message => {
          this.onReceiveMessage(message)
        })
      } else {
        console.log("无最后收到消息 ID，不进行同步")
      }
      this.shouldSync.value = false
    } catch (error) {
      console.error('Sync failed:', error)
      // 同步失败，稍后重试
      setTimeout(() => this.syncMessages(), 5000)
    }
  }

  // 连接WebSocket
  connect() {
    // 清除之前的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.socket.value = new WebSocket(this.url)

    this.socket.value.onopen = () => {
      if (this.isClosed) {
        return
      }
      this.isConnected.value = true
      this.reconnectAttempts.value = 0
      console.log('WebSocket connected')

      // 连接成功后同步消息
      if (this.shouldSync.value) {
        this.syncMessages()
      }
      fetchAPIVersionInfo()
        .then(info => useGlobalStore().apiVersionInfo = info)
        .catch(e => console.error("Unable to get api version info:", e))
    }

    this.socket.value.onmessage = (event) => {
      if (this.isClosed) {
        return
      }
      this.onReceiveMessage(JSON.parse(event.data), true)
    }

    this.socket.value.onclose = (ev) => {
      this.isConnected.value = false
      console.log('WebSocket disconnected')

      // 区分：主动关闭 不再重连
      // ev.code === 1000 是正常主动关闭
      if (ev.code === 1000) return

      // 标记需要同步
      this.shouldSync.value = true

      // 拒绝所有 pending 的 action
      this.clearAllPending()

      // 无限重连
      if (this.reconnectAttempts.value < this.maxReconnectAttempts) {
        this.reconnectAttempts.value++
        const delay = Math.min(this.reconnectInterval * this.reconnectAttempts.value, 30000) // 最大30秒间隔
        console.log(`Reconnecting in ${delay / 1000} seconds...`)
        this.reconnectTimer = setTimeout(() => this.connect(), delay)
      }
    }

    this.socket.value.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.socket.value?.close()
    }
  }
}