import { createApp, h, defineComponent } from 'vue'
import ConfirmBox from '../components/Common/Overlay/ConfirmBox.vue'
import PromptBox from '../components/Common/Overlay/PromptBox.vue'

/**
 * 展示确认框
 * @param {string} [title] - 标题
 * @param {string} [content] - 正文内容
 * @param {string} [confirmText] - 确认按钮文字
 * @param {string} [cancelText] - 取消按钮文字
 * @returns {Promise<boolean>} - 用户点击确认返回 true，取消返回 false
 */
export function showConfirmBox(title, content, confirmText, cancelText) {
  return showConfirmBoxOptions({ title, content, confirmText, cancelText })
}

/**
 * 选项式调用确认框
 * @param {Object} options - 确认框配置
 * @param {string} [options.title='确认'] - 标题
 * @param {string} [options.content=''] - 正文内容
 * @param {string} [options.confirmText='确定'] - 确认按钮文字
 * @param {string} [options.cancelText='取消'] - 取消按钮文字
 * @returns {Promise<boolean>} - 用户点击确认返回 true，取消返回 false
 */
export function showConfirmBoxOptions({
                                        title = '确认',
                                        content = '',
                                        confirmText = '确定',
                                        cancelText = '取消'
                                      } = {}) {
  return new Promise((resolve) => {
    // 创建挂载容器
    const container = document.createElement('div')
    document.body.appendChild(container)

    // 创建临时 App 实例来挂载 ConfirmBox
    const app = createApp(defineComponent({
      name: 'ConfirmBoxWrapper',
      methods: {
        handleConfirm() {
          resolve(true)
          this.unmount()
        },
        handleCancel() {
          resolve(false)
          this.unmount()
        },
        unmount() {
          app.unmount()
          document.body.removeChild(container)
        }
      },
      render() {
        return h(ConfirmBox, {
          title,
          content,
          confirmText,
          cancelText,
          onConfirm: this.handleConfirm,
          onCancel: this.handleCancel
        })
      }
    }))

    app.mount(container)
  })
}

/**
 * 展示输入框
 * @param {string} [title] - 标题
 * @param {string} [content] - 正文内容
 * @param {string} [placeholder] - 输入框占位符
 * @param {string} [defaultValue] - 输入框默认值
 * @param {string} [confirmText] - 确认按钮文字
 * @param {string} [cancelText] - 取消按钮文字
 * @returns {Promise<string|null>} - 用户点击确认返回输入值，取消返回 null
 */
export function showPromptBox(title, content, placeholder, defaultValue, confirmText, cancelText) {
  return showPromptBoxOptions({ title, content, placeholder, defaultValue, confirmText, cancelText })
}

/**
 * 选项式调用输入框
 * @param {Object} options - 输入框配置
 * @param {string} [options.title='输入'] - 标题
 * @param {string} [options.content=''] - 正文内容
 * @param {string} [options.placeholder='请输入...'] - 输入框占位符
 * @param {string} [options.defaultValue=''] - 输入框默认值
 * @param {string} [options.confirmText='确定'] - 确认按钮文字
 * @param {string} [options.cancelText='取消'] - 取消按钮文字
 * @returns {Promise<string|null>} - 用户点击确认返回输入值，取消返回 null
 */
export function showPromptBoxOptions({
                                       title = '输入',
                                       content = '',
                                       placeholder = '请输入...',
                                       defaultValue = '',
                                       confirmText = '确定',
                                       cancelText = '取消'
                                     } = {}) {
  return new Promise((resolve) => {
    // 创建挂载容器
    const container = document.createElement('div')
    document.body.appendChild(container)

    // 创建临时 App 实例来挂载 PromptBox
    const app = createApp(defineComponent({
      name: 'PromptBoxWrapper',
      methods: {
        handleConfirm(value) {
          resolve(value)
          this.unmount()
        },
        handleCancel() {
          resolve(null)
          this.unmount()
        },
        unmount() {
          app.unmount()
          document.body.removeChild(container)
        }
      },
      render() {
        return h(PromptBox, {
          title,
          content,
          placeholder,
          defaultValue,
          confirmText,
          cancelText,
          onConfirm: this.handleConfirm,
          onCancel: this.handleCancel
        })
      }
    }))

    app.mount(container)
  })
}