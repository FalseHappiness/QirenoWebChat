<script>
import { defineComponent } from 'vue'
import QIcon from '../Icons/QIcon.vue'
import Tooltip from '../Overlay/Tooltip.vue'

export default defineComponent({
  name: "ImageViewer",
  components: { QIcon, Tooltip },
  props: {
    imageUrl: { type: String, default: '' },
    showLeftArrow: { type: Boolean, default: false },
    showRightArrow: { type: Boolean, default: false },
    counterText: { type: String, default: '' }
  },
  emits: ['click-left', 'click-right', 'close'],
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
      // 移动端触摸状态
      isPinching: false,
      touchStartDistance: 0,
      touchStartScale: 1,
      touchStartMidX: 0,
      touchStartMidY: 0,
      touchStartTranslateX: 0,
      touchStartTranslateY: 0,
      // 双指旋转
      isRotating: false,
      touchStartAngle: 0,
      touchStartRotation: 0,
      rotationThreshold: 15, // 旋转触发角度阈值（度）
      // 是否经历过双指手势，用于在手指全部抬起时自动吸附角度
      pendingSnap: false,
    }
  },
  computed: {
    displayTransform() {
      const s = this.baseFitScale * this.userScale
      return `translate(${this.translateX}px, ${this.translateY}px) scale(${s}) rotate(${this.rotation}deg)`
    },
    zoomPercent() {
      if (!this.naturalWidth || !this.imageLoaded) return '--%'
      // 实际显示比例 = baseFitScale * userScale，相对于图片原始大小
      const percent = Math.round(this.baseFitScale * this.userScale * 100)
      return `${Math.max(1, Math.min(9999, percent))}%`
    },
    hasNavArrows() {
      return this.showLeftArrow || this.showRightArrow
    }
  },
  watch: {
    imageUrl: {
      immediate: true,
      handler(val) {
        if (val) {
          this.currentImageUrl = val
          this.$nextTick(() => {
            this.open(val)
          })
        }
      }
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
      this.isPinching = false
      this.isRotating = false
      this.pendingSnap = false // 重置吸附标志
      const mask = this.$refs.imageViewerMask
      if (mask) {
        mask.style.display = ''
      }
    },
    close() {
      if (this.closing) return
      this.closing = true
      this.closed = true
      this.$emit('close')
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
      // 排除 padding 对计算的影响，使图片内容区域充分利用容器
      const style = getComputedStyle(container)
      const padLeft = parseFloat(style.paddingLeft) || 0
      const padRight = parseFloat(style.paddingRight) || 0
      const padTop = parseFloat(style.paddingTop) || 0
      const padBottom = parseFloat(style.paddingBottom) || 0
      const cw = container.clientWidth - padLeft - padRight
      const ch = container.clientHeight - padTop - padBottom
      // 旋转 90° 或 270°（奇数倍 90°）时，有效显示宽高交换
      const isSwapped = Math.round(this.rotation / 90) % 2 !== 0
      const displayW = isSwapped ? img.naturalHeight : img.naturalWidth
      const displayH = isSwapped ? img.naturalWidth : img.naturalHeight
      if (cw > 0 && ch > 0) {
        this.baseFitScale = Math.min(cw / displayW, ch / displayH)
      }
    },
    zoomIn() {
      this.userScale = Math.min(20, this.userScale * 1.25)
    },
    zoomOut() {
      this.userScale = Math.max(0.1, this.userScale / 1.25)
    },
    fitToWindow() {
      this.calculateFitScale()
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
    /** 逆时针旋转90° */
    rotate() {
      // 直接减去 90，避免模运算导致的角度跳跃与方向反转
      this.rotation -= 90
      // 仅在当前为适应窗口状态下，旋转后重新适应
      if (this.userScale === 1 && this.translateX === 0 && this.translateY === 0) {
        this.$nextTick(() => this.calculateFitScale())
      }
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
    },

    // ========== 移动端触摸事件 ==========
    /** 获取两点触摸距离 */
    getTouchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    },
    /** 获取两点触摸中点 */
    getTouchMidPoint(touches) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      }
    },
    /** 获取两点触摸角度（度），从 touch0 指向 touch1 的向量与 X 轴夹角 */
    getTouchAngle(touches) {
      const dx = touches[1].clientX - touches[0].clientX
      const dy = touches[1].clientY - touches[0].clientY
      return Math.atan2(dy, dx) * (180 / Math.PI)
    },
    /** 将角度归一化到 [-180, 180) */
    normalizeAngleDelta(delta) {
      while (delta > 180) delta -= 360
      while (delta <= -180) delta += 360
      return delta
    },
    /** 吸附到最近的 90° 倍数（基于当前连续角度值，避免反向动画） */
    snapRotationToNearest90() {
      // 直接对当前 rotation 取整到最近 90° 倍数，不进行 0~360 归一化。
      // 这样目标值与当前值的数值差最小，CSS transition 会沿最短路径平滑过渡。
      const target = Math.round(this.rotation / 90) * 90
      this.isPinching = false
      this.isRotating = false
      this.isDragging = false
      this.pendingSnap = false
      // 记录当前是否为适应窗口状态
      const wasFitted = this.userScale === 1 && this.translateX === 0 && this.translateY === 0
      // 移除 pinching 类后，确保 transition 重新生效
      this.$nextTick(() => {
        if (this.$refs.imageElement) {
          void this.$refs.imageElement.offsetWidth
        }
        this.rotation = target
        // 仅在旋转前是适应窗口状态，旋转后才重新适应
        if (wasFitted) {
          this.calculateFitScale()
        }
      })
    },
    onTouchStart(e) {
      const touches = e.touches
      if (touches.length === 1) {
        // 单指拖动
        this.isDragging = true
        this.isPinching = false
        this.isRotating = false
        this.dragStartX = touches[0].clientX
        this.dragStartY = touches[0].clientY
        this.dragStartTranslateX = this.translateX
        this.dragStartTranslateY = this.translateY
        // 注意：如果之前有双指操作，pendingSnap 仍然保留，确保最后松开时能吸附
      } else if (touches.length === 2) {
        // 双指操作（缩放 + 拖动 + 旋转）
        this.isPinching = true
        this.isDragging = false
        this.isRotating = false
        this.pendingSnap = true // 标记经历过双指手势
        this.touchStartDistance = this.getTouchDistance(touches)
        this.touchStartScale = this.userScale
        const mid = this.getTouchMidPoint(touches)
        this.touchStartMidX = mid.x
        this.touchStartMidY = mid.y
        this.touchStartTranslateX = this.translateX
        this.touchStartTranslateY = this.translateY
        this.touchStartAngle = this.getTouchAngle(touches)
        this.touchStartRotation = this.rotation
      }
    },
    onTouchMove(e) {
      e.preventDefault()
      const touches = e.touches
      if (touches.length === 1 && this.isDragging) {
        // 单指拖动
        this.translateX = this.dragStartTranslateX + (touches[0].clientX - this.dragStartX)
        this.translateY = this.dragStartTranslateY + (touches[0].clientY - this.dragStartY)
      } else if (touches.length === 2 && this.isPinching) {
        // 双指缩放
        const currentDist = this.getTouchDistance(touches)
        const scaleRatio = currentDist / this.touchStartDistance
        this.userScale = Math.max(0.1, Math.min(20, this.touchStartScale * scaleRatio))

        // 双指拖动（以两指中点为参考）
        const mid = this.getTouchMidPoint(touches)
        this.translateX = this.touchStartTranslateX + (mid.x - this.touchStartMidX)
        this.translateY = this.touchStartTranslateY + (mid.y - this.touchStartMidY)

        // 双指旋转
        const currentAngle = this.getTouchAngle(touches)
        let angleDelta = this.normalizeAngleDelta(currentAngle - this.touchStartAngle)

        if (!this.isRotating) {
          // 角度变化超过阈值才激活旋转模式，避免普通缩放误触发
          if (Math.abs(angleDelta) > this.rotationThreshold) {
            this.isRotating = true
            // 重置基准：将当前旋转角度和手指角度作为新基准
            this.touchStartRotation = this.rotation
            this.touchStartAngle = currentAngle
            // 重新计算 angleDelta，因为基准已变，避免瞬间跳跃
            angleDelta = 0
          }
        }

        if (this.isRotating) {
          this.rotation = this.touchStartRotation + angleDelta
        }
      }
    },
    onTouchEnd(e) {
      if (e.touches.length === 0) {
        // 所有手指抬起
        // 如果之前经历过双指手势（缩放或旋转），则需要自动吸附角度
        if (this.isPinching || this.isRotating || this.pendingSnap) {
          this.snapRotationToNearest90()
        } else {
          this.isDragging = false
        }
      } else if (e.touches.length === 1 && this.isPinching) {
        // 双指变为单指时，切换到单指拖动模式
        // 注意：保留 pendingSnap 标志，以便在最终松开所有手指时依然吸附
        this.isRotating = false
        this.isDragging = true
        this.isPinching = false
        // 不重置 pendingSnap，因为双指手势尚未完全结束
        this.dragStartX = e.touches[0].clientX
        this.dragStartY = e.touches[0].clientY
        this.dragStartTranslateX = this.translateX
        this.dragStartTranslateY = this.translateY
      }
    }
  }
})
</script>

<template>
  <teleport to="body">
    <div
      class="image-viewer-mask"
      :class="{ closed }"
      ref="imageViewerMask"
      style="display: none"
      @wheel="onWheel"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- 顶部栏：计数器 + 关闭按钮 -->
      <div class="image-viewer-top-bar">
        <span v-if="counterText" class="image-viewer-counter">{{ counterText }}</span>
        <div class="image-viewer-close-btn" @click="close">
          <QIcon name="close_fill_24"/>
        </div>
      </div>

      <!-- 图片显示区域 -->
      <div
        class="image-viewer-image-area"
        :class="{ 'has-nav-arrows': hasNavArrows }"
        ref="imageContainer"
        @mousedown="onMouseDown"
      >
        <div
          v-if="showLeftArrow"
          class="image-viewer-nav-arrow image-viewer-nav-arrow-left no-user-select"
          @click.stop="$emit('click-left')"
        >
          <QIcon name="arrow_left_24"/>
        </div>
        <div
          v-if="showRightArrow"
          class="image-viewer-nav-arrow image-viewer-nav-arrow-right no-user-select"
          @click.stop="$emit('click-right')"
        >
          <QIcon name="arrow_right_24"/>
        </div>
        <img
          v-if="!imageError"
          :src="currentImageUrl"
          ref="imageElement"
          class="image-viewer-image no-user-select"
          :class="{ dragging: isDragging, pinching: isPinching }"
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
            <QIcon name="shrink_24" class="image-viewer-toolbar-icon" @click="zoomOut"/>
          </template>
          <template #content>
            <div class="image-viewer-tooltip">缩小</div>
          </template>
        </Tooltip>
        <span class="image-viewer-zoom-percent">{{ zoomPercent }}</span>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="enlarge_24" class="image-viewer-toolbar-icon" @click="zoomIn"/>
          </template>
          <template #content>
            <div class="image-viewer-tooltip">放大</div>
          </template>
        </Tooltip>
        <div class="image-viewer-divider"></div>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="self_adapting_24" class="image-viewer-toolbar-icon" @click="originalSize"/>
          </template>
          <template #content>
            <div class="image-viewer-tooltip">原始大小</div>
          </template>
        </Tooltip>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="original_size_24" class="image-viewer-toolbar-icon" @click="fitToWindow"/>
          </template>
          <template #content>
            <div class="image-viewer-tooltip">适应窗口</div>
          </template>
        </Tooltip>
        <div class="image-viewer-divider"></div>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="group_video_rotate_24" class="image-viewer-toolbar-icon" @click="rotate"/>
          </template>
          <template #content>
            <div class="image-viewer-tooltip">逆时针旋转</div>
          </template>
        </Tooltip>
        <Tooltip use-target-slot placement="top" :distance-from-target="12">
          <template #target>
            <QIcon name="download_new_24" class="image-viewer-toolbar-icon" @click="download"/>
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
  /* 阻止移动端浏览器默认触摸行为（如滚动、双指缩放页面） */
  touch-action: none;
}

.image-viewer-mask.closed {
  animation: imageViewerMaskIn 0.3s ease-in-out reverse;
  opacity: 0;
}

@keyframes imageViewerMaskIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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

/* 顶部栏 */
.image-viewer-top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 12px 0;
  z-index: 889;
  pointer-events: none;
}

.image-viewer-top-bar .image-viewer-close-btn {
  position: absolute;
  right: 12px;
  pointer-events: auto;
}

.image-viewer-counter {
  color: #fff;
  font-size: 14px;
  user-select: none;
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 14px;
  border-radius: 14px;
  backdrop-filter: blur(6px);
}

/* 关闭按钮 - 右上角 */
.image-viewer-close-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  z-index: 889;
  border-radius: 50%;
  transition: background-color 0.2s;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  padding: 3px;
}

.image-viewer-close-btn svg {
  height: 100%;
  width: 100%;
}

.image-viewer-close-btn:hover {
  background-color: rgba(0, 0, 0, 0.75);
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
  padding: 45px 0 0;
  box-sizing: border-box;
}

.image-viewer-image-area.has-nav-arrows {
  padding-left: 60px;
  padding-right: 60px;
}

.image-viewer-image {
  transform-origin: center center;
  user-select: none;
  -webkit-user-drag: none;
  cursor: grab;
  transition: transform 0.15s ease;
  /* 阻止移动端长按弹出菜单/保存图片 */
  -webkit-touch-callout: none;
}

.image-viewer-image.dragging {
  cursor: grabbing;
  transition: none;
}

.image-viewer-image.pinching {
  transition: none;
}

.image-viewer-error {
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  user-select: none;
}

/* 左右导航箭头 */
.image-viewer-nav-arrow {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background-color: rgba(0, 0, 0, 0.55);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 890;
  color: #fff;
  opacity: 0.75;
  transition: opacity 0.2s, background-color 0.2s;
  backdrop-filter: blur(6px);
}

.image-viewer-nav-arrow:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.75);
}

.image-viewer-nav-arrow-left {
  left: 10px;
}

.image-viewer-nav-arrow-right {
  right: 10px;
}

.image-viewer-nav-arrow svg {
  width: 24px;
  height: 24px;
}

.image-viewer-nav-arrow-left svg {
  margin-right: 2px;
}

.image-viewer-nav-arrow-right svg {
  margin-left: 2px;
}

/* 底部功能栏 */
.image-viewer-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 10px 24px;
  margin: 14px auto;
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

/* 移动端适配：触摸时不显示滚动条、调整工具栏大小 */
@media (pointer: coarse) {
  .image-viewer-toolbar {
    gap: 10px;
    padding: 8px 16px;
    margin: 10px auto;
    border-radius: 18px;
  }

  .image-viewer-toolbar-icon {
    width: 22px;
    height: 22px;
  }

  .image-viewer-close-btn {
    top: 10px;
    right: 10px;
    width: 25px;
    height: 25px;
  }

  .image-viewer-image-area {
    padding: 40px 0 0;
  }

  .image-viewer-image-area.has-nav-arrows {
    padding-left: 50px;
    padding-right: 50px;
  }

  .image-viewer-nav-arrow {
    width: 30px;
    height: 30px;
  }
}

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