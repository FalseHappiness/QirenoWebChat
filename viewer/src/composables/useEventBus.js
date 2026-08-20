import { EventEmitter } from 'eventemitter3'
import { nanoid } from 'nanoid'

import { isObject, isString } from "../scripts/types-util.js";

// 原有全局 emitter（保持原样不变）
export const Emitter = new EventEmitter();

// 新增可调用版 Emitter
class CalledEmitterClass {
  #bus = new EventEmitter()
  // 记录原始 handler 到包装函数的映射，保证 off 能正确移除
  #handlerMap = new Map()

  // 判断是否存在对应事件监听
  has(type) {
    const events = this.#bus._events || {}
    return !!events[type]
  }

  /**
   * 注册监听
   * @param {string} type 事件类型
   * @param {Function} handler 处理函数 (requestId, ...args) => any | Promise
   */
  on(type, handler) {
    if (!this.#handlerMap.has(type)) {
      this.#handlerMap.set(type, new Map())
    }
    const typeHandlers = this.#handlerMap.get(type)

    // 避免重复注册同一个原始 handler
    if (typeHandlers.has(handler)) {
      this.#bus.off(type, typeHandlers.get(handler))
    }

    const wrapped = async (requestId, ...args) => {
      try {
        const result = await handler(...args)
        this.#bus.emit(`__reply__${requestId}`, result)
      } catch (err) {
        this.#bus.emit(`__reply__${requestId}`, null, err)
      }
    }

    typeHandlers.set(handler, wrapped)
    this.#bus.on(type, wrapped)
  }

  off(type, handler) {
    const typeHandlers = this.#handlerMap.get(type)
    if (!typeHandlers) return

    // 如果没有传 handler，移除该类型的所有监听器
    if (handler === undefined) {
      for (const [, wrapped] of typeHandlers) {
        this.#bus.off(type, wrapped)
      }
      typeHandlers.clear()
      this.#handlerMap.delete(type)
      return
    }

    const wrapped = typeHandlers.get(handler)

    if (wrapped) {
      this.#bus.off(type, wrapped)
      typeHandlers.delete(handler)

      if (typeHandlers.size === 0) {
        this.#handlerMap.delete(type)
      }
    }
  }

  /**
   * 发起调用，await 获取返回值
   * @param {string | {type: string, timeout?: number} | [type: string, timeout?: number]} info
   * 事件配置信息，支持三种格式：
   * 1. 字符串：仅代表事件 type
   * 2. 对象：{ type: 事件名, timeout?: 超时毫秒数 }
   * 3. 数组：[type, timeout?]
   * @param  {...any} args 额外透传的事件参数
   * @returns {Promise}
   */
  emit(info, ...args) {
    let type, timeout

    // 调整解析顺序，避免部分 isObject 实现把数组也当成对象
    if (Array.isArray(info)) {
      ;[type, timeout] = info
    } else if (isObject(info)) {
      ;({ type, timeout } = info)
    } else if (isString(info)) {
      type = info
    }

    // 检查是否注册监听
    if (!this.has(type)) {
      return Promise.reject(new Error(`CalledEmitter: no listener for event "${type}"`))
    }

    const requestId = nanoid()
    const timeoutMs = timeout === null ? undefined : timeout || 60 * 1000
    const replyEvent = `__reply__${requestId}`

    return new Promise((resolve, reject) => {
      let timer

      const onReply = (result, error) => {
        if (timer !== undefined) clearTimeout(timer)
        if (error) reject(error)
        else resolve(result)
      }

      timer = timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
          this.#bus.off(replyEvent, onReply)
          reject(new Error(`CalledEmitter request ${type} ${requestId} timeout`))
        }, timeoutMs)

      this.#bus.once(replyEvent, onReply)
      this.#bus.emit(type, requestId, ...args)
    })
  }
}

// 导出实例
export const CalledEmitter = new CalledEmitterClass()