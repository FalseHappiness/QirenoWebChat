import clipboard from "clipboardy";
import { showToast } from "./toast.js";
function copy(text) {
  clipboard.write(text)
    .then(() => {
      showToast('success', '复制成功')
    })
    .catch(e => {
      console.error("复制失败", e)
      showToast('error', '复制失败')
    })
}

export {
  copy
}