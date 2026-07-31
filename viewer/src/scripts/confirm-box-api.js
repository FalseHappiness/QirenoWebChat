import { createApp, h, defineComponent } from 'vue'
import ConfirmBox from '../components/Common/Overlay/ConfirmBox.vue'

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