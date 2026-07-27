<script>
import { defineComponent } from 'vue'
import QIcon from './QIcon.vue'
import Tooltip from './Tooltip.vue'

export default defineComponent({
  name: "ImageViewer",
  components: { QIcon, Tooltip },
  data() {
    return {
      closed: false,
      closing: false,
      currentImageUrl: '',
      userScale: 1,
      baseFitScale: 1,
      rotation: 0,
      naturalWidth: 0,
      naturalHeight: 0,
      imageLoaded: false,
      imageError: false,
      translateX: 0,
      translateY: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragStartTranslateX: 0,
      dragStartTranslateY: 0,
    }
  },
  computed: {
    displayTransform() {
      const s = this.baseFitScale * this.userScale
      return `translate(${this.translateX}px, ${this.translateY}px) scale(${s}) rotate(${this.rotation}deg)`
    },
    zoomPercent() {
      if (!this.naturalWidth || !this.imageLoaded) return '--%'
      const percent = Math.round(this.userScale * 100)
      return `${Math.max(1, Math.min(9999, percent))}%`
    }
  },
  methods: {
    open(url) {
      this.currentImageUrl = url
      this.closed = false
      this.closing = false
      this.userScale = 1
      this.baseFitScale = 1
      this.rotation = 0
      this.naturalWidth = 0
      this.naturalHeight = 0
      this.imageLoaded = false
      this.imageError = false
      this.translateX = 0
      this.translateY = 0
      this.isDragging = false
      const mask = this.$refs.imageViewerMask
      if (mask) {
        mask.style.display = ''
      }
    },
    close() {
      if (this.closing) return
      this.closing = true
      this.closed = true
      const mask = this.$refs.imageViewerMask
      if (mask) {
        this.restartAnimation(mask)
      }
      setTimeout(() => {
        if (mask) {
          mask.style.display = 'none'
        }
        this.closing = false
      }, 300)
    },
    restartAnimation(element) {
      const display = element.style.display
      element.style.display = 'none'
      element.offsetWidth
      element.style.display = display
    },
    calculateFitScale() {
      const container = this.$refs.imageContainer
      const img = this.$refs.imageElement
      if (!container || !img || !img.naturalWidth) return
      this.naturalWidth = img.naturalWidth
      this.naturalHeight = img.naturalHeight
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw > 0 && ch > 0) {
        this.baseFitScale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight)
      }
    },
    zoomIn() {
      this.userScale = Math.min(20, this.userScale * 1.25)
    },
    zoomOut() {
      this.userScale = Math.max(0.1, this.userScale / 1.25)
    },
    fitToWindow() {
      this.userScale = 1
      this.translateX = 0
      this.translateY = 0
    },
    originalSize() {
      if (this.baseFitScale > 0) {
        this.userScale = 1 / this.baseFitScale
      }
      this.translateX = 0
      this.translateY = 0
    },
    rotate() {
      this.rotation = (this.rotation + 90) % 360
    },
    download() {
      window.open(this.currentImageUrl, '_blank')
    },
    onWheel(e) {
      e.preventDefault()
      const rect = this.$refs.imageElement?.getBoundingClientRect()
      if (!rect) return
      // 计算鼠标相对于图片中心的位置，用于缩放锚点
      const imgCenterX = rect.left + rect.width / 2
      const imgCenterY = rect.top + rect.height / 2
      const offsetX = e.clientX - imgCenterX
      const offsetY = e.clientY - imgCenterY
      const oldScale = this.userScale
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1
      this.userScale = Math.max(0.1, Math.min(20, this.userScale * factor))
      // 缩放后调整 translate，让鼠标位置保持不动
      const scaleRatio = this.userScale / oldScale
      this.translateX = offsetX - scaleRatio * (offsetX - this.translateX)
      this.translateY = offsetY - scaleRatio * (offsetY - this.translateY)
    },
    onMouseDown(e) {
      // 只响应鼠标左键
      if (e.button !== 0) return
      this.isDragging = true
      this.dragStartX = e.clientX
      this.dragStartY = e.clientY
      this.dragStartTranslateX = this.translateX
      this.dragStartTranslateY = this.translateY
      document.addEventListener('mousemove', this.onMouseMove)
      document.addEventListener('mouseup', this.onMouseUp)
    },
    onMouseMove(e) {
      if (!this.isDragging) return
      this.translateX = this.dragStartTranslateX + (e.clientX - this.dragStartX)
      this.translateY = this.dragStartTranslateY + (e.clientY - this.dragStartY)
    },
    onMouseUp() {
      this.isDragging = false
      document.removeEventListener('mousemove', this.onMouseMove)
      document.removeEventListener('mouseup', this.onMouseUp)
    },
    onImageLoad() {
      this.imageLoaded = true
      this.imageError = false
      this.$nextTick(() => this.calculateFitScale())
    },
    onImageError() {
      this.imageError = true
      this.imageLoaded = false
    }
  }
})
</script>

<template>
  <teleport to="body">
    <div class="image-viewer-mask" :class="{ closed }" ref="imageViewerMask" style="display: none" @wheel="onWheel">
      <!-- 关闭按钮 -->
      <div class="image-viewer-close-btn" @click="close">
        <QIcon name="close_fill_24" />
      </div>

      <!-- 图片显示区域 -->
      <div
        class="image-viewer-image-area"
        ref="imageContainer"
        @mousedown="onMouseDown"
      >
        <img
          v-if="!imageError"
          :src="currentImageUrl"
          ref="imageElement"
          class="image-viewer-image"
          :class="{ dragging: isDragging }"
          :style="{ transform: displayTransform }"
          @load="onImageLoad"
          @error="onImageError"
          draggable="false"
          alt=""
        />
        <div v-else class="image-viewer-error">
          <span>图片加载失败</span>
        </div>
      </div>

      <!-- 底部功能栏 -->
      <div class="image-viewer-toolbar">
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="shrink_24" class="image-viewer-toolbar-icon" @click="zoomOut" />
          </template>
          <template #content>
            <div class="image-viewer-tooltip">缩小</div>
          </template>
        </Tooltip>
        <span class="image-viewer-zoom-percent">{{ zoomPercent }}</span>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="enlarge_24" class="image-viewer-toolbar-icon" @click="zoomIn" />
          </template>
          <template #content>
            <div class="image-viewer-tooltip">放大</div>
          </template>
        </Tooltip>
        <div class="image-viewer-divider"></div>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="self_adapting_24" class="image-viewer-toolbar-icon" @click="originalSize" />
          </template>
          <template #content>
            <div class="image-viewer-tooltip">原始大小</div>
          </template>
        </Tooltip>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="original_size_24" class="image-viewer-toolbar-icon" @click="fitToWindow" />
          </template>
          <template #content>
            <div class="image-viewer-tooltip">适应窗口</div>
          </template>
        </Tooltip>
        <div class="image-viewer-divider"></div>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="group_video_rotate_24" class="image-viewer-toolbar-icon" @click="rotate" />
          </template>
          <template #content>
            <div class="image-viewer-tooltip">旋转</div>
          </template>
        </Tooltip>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="download_new_24" class="image-viewer-toolbar-icon" @click="download" />
          </template>
          <template #content>
            <div class="image-viewer-tooltip">下载</div>
          </template>
        </Tooltip>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.image-viewer-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.48);
  z-index: 888;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  opacity: 1;
  --anim-time: 0.3s;
  animation: imageViewerMaskIn var(--anim-time) ease-in-out;
}

.image-viewer-mask.closed {
  animation: imageViewerMaskIn 0.3s ease-in-out reverse;
  opacity: 0;
}

@keyframes imageViewerMaskIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.image-viewer-mask.closed .image-viewer-image-area {
  animation: imageViewerContentOut 0.25s ease-in-out both;
}

.image-viewer-mask.closed .image-viewer-toolbar {
  animation: imageViewerContentOut 0.25s ease-in-out both;
}

.image-viewer-mask.closed .image-viewer-close-btn {
  animation: imageViewerCloseBtnOut 0.25s ease-in-out both;
}

@keyframes imageViewerContentOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.92);
  }
}

@keyframes imageViewerCloseBtnOut {
  from {
    opacity: 1;
    transform: rotate(0deg);
  }
  to {
    opacity: 0;
    transform: rotate(90deg);
  }
}

/* 关闭按钮 - 右上角 */
.image-viewer-close-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  z-index: 10000;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.image-viewer-close-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

/* 图片显示区域 - 自适应剩余空间，功能栏不参与计算 */
.image-viewer-image-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  overflow: visible;
  padding: 60px 0 0;
  box-sizing: border-box;
}

.image-viewer-image {
  transform-origin: center center;
  user-select: none;
  -webkit-user-drag: none;
  cursor: grab;
  transition: transform 0.15s ease;
}

.image-viewer-image.dragging {
  cursor: grabbing;
  transition: none;
}

.image-viewer-error {
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  user-select: none;
}

/* 底部功能栏 */
.image-viewer-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 10px 24px;
  margin: 0 auto 28px;
  background-color: rgba(0, 0, 0, 0.55);
  border-radius: 22px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  position: relative;
  z-index: 10001;
}

.image-viewer-toolbar-icon {
  width: 24px;
  height: 24px;
  color: #fff;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-viewer-toolbar-icon:hover {
  opacity: 1;
}

.image-viewer-zoom-percent {
  color: #fff;
  font-size: 13px;
  min-width: 48px;
  text-align: center;
  user-select: none;
  font-variant-numeric: tabular-nums;
}

.image-viewer-divider {
  width: 1px;
  height: 20px;
  background-color: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}
</style>

<!-- 工具提示样式 - 全局生效，因 Tooltip 使用 teleport 到 body -->
<style>
.image-viewer-tooltip {
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  white-space: nowrap;
  line-height: 1.6;
}
</style>