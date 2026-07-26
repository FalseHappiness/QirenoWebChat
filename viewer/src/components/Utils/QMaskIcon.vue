<!-- SvgMaskIcon.vue -->
<template>
  <div class="svg-mask-wrap" :style="wrapStyle">
    <!-- 底层旧图标：动画过程中显示，结束后隐藏 -->
    <QIcon
      v-show="showOldIcon"
      class="icon-old"
      :name="oldName"
    />
    <!-- 上层新图标（带圆形扫光遮罩） -->
    <QIcon
      class="icon-new"
      :name="newName"
      :style="maskStyle"
    />
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import QIcon from './QIcon.vue'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: '60%'
  },
  duration: {
    type: Number,
    default: 600
  },
  // 触发扫光动画的目标图标数组
  animateTargets: {
    type: [Array, String],
    default: () => []
  },
  // 单个目标图标（兼容用法）
  animateTarget: {
    type: String,
    default: ''
  }
})

// ---------- 响应式状态 ----------
const oldName = ref(props.name)
const newName = ref(props.name)
const isAnimating = ref(false)
const transitionEnabled = ref(false)

// 遮罩起点（左下角 0% 100%）→ 终点（右上角 100% 0%）
const maskX = ref(0)
const maskY = ref(0)
const maskRadius = ref(200)   // 初始完全可见

const showOldIcon = ref(false)

// 定时器 ID，用于中断动画
let animTimer = null

// ---------- 计算属性 ----------
const wrapStyle = computed(() => ({
  width: `${props.size}`,
  height: `${props.size}`,
  position: 'relative'
}))

const maskStyle = computed(() => ({
  position: 'absolute',
  left: 0,
  top: 0,
  clipPath: `circle(${maskRadius.value}% at ${maskX.value}% ${maskY.value}%)`,
  transition: transitionEnabled.value
    ? `clip-path ${props.duration}ms ease-out`
    : 'none'
}))

// ---------- 核心逻辑 ----------
watch(
  () => props.name,
  async (nextIcon) => {
    // 相同图标直接跳过
    if (nextIcon === newName.value) return

    // 1. 清除之前的动画定时器，准备响应最新操作
    if (animTimer) {
      clearTimeout(animTimer)
      animTimer = null
    }

    // 2. 如果正在动画中，强制结束当前动画，显示完整的当前图标
    if (isAnimating.value) {
      isAnimating.value = false
      showOldIcon.value = false
      transitionEnabled.value = false
      // 完全显示当前图标（即 current newName）
      maskX.value = 0
      maskY.value = 0
      maskRadius.value = 200
    }

    // 3. 更新图标缓存（oldName 为当前显示的图标，newName 为目标图标）
    oldName.value = newName.value
    newName.value = nextIcon

    // 4. 判断是否需要扫光动画
    const needAnimate =
      (Array.isArray(props.animateTargets) && props.animateTargets.includes(nextIcon)) ||
      props.animateTarget === nextIcon

    if (!needAnimate) {
      // 无动画：直接完全显示新图标
      showOldIcon.value = false
      transitionEnabled.value = false
      maskX.value = 0
      maskY.value = 0
      maskRadius.value = 200
      return
    }

    // ---------- 有动画 ----------
    isAnimating.value = true
    showOldIcon.value = true

    // ① 关闭过渡，重置遮罩到起点（左下角，半径 0）
    transitionEnabled.value = false
    maskX.value = 0
    maskY.value = 100
    maskRadius.value = 0

    // ② 等待 DOM 更新
    await nextTick()
    // ③ 强制浏览器渲染起点状态
    await new Promise(resolve => requestAnimationFrame(resolve))

    // ④ 打开过渡，设置终点（右上角，半径 150%，覆盖整个图标）
    transitionEnabled.value = true
    maskX.value = 100
    maskY.value = 0
    maskRadius.value = 150

    // ⑤ 动画结束后清理
    animTimer = setTimeout(() => {
      isAnimating.value = false
      showOldIcon.value = false
      transitionEnabled.value = false
      animTimer = null
    }, props.duration)
  },
  { flush: 'post' }
)
</script>

<style scoped>
.icon-old,
.icon-new {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}
</style>