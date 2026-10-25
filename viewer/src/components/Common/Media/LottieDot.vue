<template>
  <div ref="lottieContainer" class="lottie-container">
    <!-- 优先使用已缓存的 JSON 数据渲染，避免重复网络请求 -->
    <DotLottieVue
      ref="dotPlayer"
      v-if="animJsonStr"
      :data="animJsonStr"
      :loop="loop"
      :autoplay="autoplay"
      auto-resize-canvas
      style="width: 100%; height: 100%;"
      useFrameInterpolation
      freezeOnOffscreen
    />
    <DotLottieVue
      ref="dotPlayer"
      v-else-if="animationUrl"
      :src="animationUrl"
      :loop="loop"
      :autoplay="autoplay"
      auto-resize-canvas
      style="width: 100%; height: 100%;"
      useFrameInterpolation
      freezeOnOffscreen
    />
  </div>
</template>

<script>
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'
import { useGlobalStore } from '@/store/global.js'

export default {
  name: 'LottieDot',
  components: { DotLottieVue },
  props: {
    animationData: { type: Object, default: null },
    animationUrl: { type: String, default: '' },
    loop: { type: Boolean, default: true },
    autoplay: { type: Boolean, default: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    rootMargin: { type: String, default: '0px' }
  },
  data() {
    return {
      observer: null,
      hasLoaded: false,
      animJsonStr: null, // 存序列化后的JSON字符串，不再存Object
      dotInstance: null
    }
  },
  computed: {
    globalStore() {
      return useGlobalStore()
    }
  },
  created() {
    // 同步命中缓存时，首帧即可用 data 渲染，避免先请求后渲染的闪烁
    this.loadAnimation()
  },
  mounted() {
    this.$nextTick(() => {
      this.bindDotInstance()
    })
  },
  beforeDestroy() {
    this.destroyObserver()
  },
  methods: {
    bindDotInstance() {
      const player = this.$refs.dotPlayer
      if (!player) return
      this.dotInstance = player.getDotLottieInstance()
    },
    destroyObserver() {
      if (this.observer) {
        this.observer.disconnect()
        this.observer = null
      }
    },
    applyBoxSize() {
      const box = this.$refs.lottieContainer
      if (box && this.width && this.height) {
        box.style.width = `${this.width}px`
        box.style.height = `${this.height}px`
      }
    },
    async loadAnimation() {
      // 1. 外部直接传入的数据优先
      if (this.animationData) {
        this.animJsonStr = JSON.stringify(this.animationData)
        this.applyBoxSize()
        return
      }

      const url = this.animationUrl
      if (!url) {
        this.animJsonStr = null
        return
      }

      // 2. 命中全局缓存：直接使用已解析的 JSON，跳过网络请求
      const cached = this.globalStore?.getLottieData?.(url)
      if (cached) {
        this.animJsonStr = JSON.stringify(cached)
        this.applyBoxSize()
        return
      }

      // 3. 未命中：先走 src 立即展示（浏览器自身缓存生效），
      //    同时后台拉取 JSON 存入全局缓存，供其它实例复用
      this.animJsonStr = null
      this.applyBoxSize()
      const data = await this.globalStore?.ensureLottieLoaded?.(url)
      // 组件可能已被销毁或 url 已变更
      if (!data || this.animationUrl !== url) return
      this.animJsonStr = JSON.stringify(data)
    },
    play() {
      this.dotInstance?.play()
    },
    pause() {
      this.dotInstance?.pause()
    },
    stop() {
      this.dotInstance?.stop()
    }
  },
  watch: {
    animationUrl() {
      this.hasLoaded = false
      this.animJsonStr = null
      this.loadAnimation()
    },
    animationData() {
      this.hasLoaded = false
      this.loadAnimation()
    }
  }
}
</script>

<style scoped>
.lottie-container {
  display: inline-block;
  min-height: 1px;
}
</style>