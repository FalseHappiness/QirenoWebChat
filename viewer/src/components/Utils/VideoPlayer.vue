<script>
import { defineComponent } from 'vue'
import QIcon from './QIcon.vue'
import ArtPlayer from 'artplayer'

export default defineComponent({
  name: "VideoPlayer",
  components: { QIcon },
  props: {
    videoUrl: { type: String, default: '' },
    showLeftArrow: { type: Boolean, default: false },
    showRightArrow: { type: Boolean, default: false },
    counterText: { type: String, default: '' }
  },
  emits: ['click-left', 'click-right', 'close'],
  data() {
    return {
      closed: false,
      closing: false,
      currentVideoUrl: '',
      artPlayer: null,
    }
  },
  computed: {
    hasNavArrows() {
      return this.showLeftArrow || this.showRightArrow
    }
  },
  watch: {
    videoUrl: {
      immediate: true,
      handler(val) {
        if (val) {
          this.currentVideoUrl = val
          this.$nextTick(() => {
            this.open(val)
          })
        }
      }
    }
  },
  methods: {
    /**
     * 打开视频播放器（编程式 API 入口）
     * 可通过组件 ref 调用：videoPlayerRef.open(url)
     */
    open(url) {
      this.currentVideoUrl = url
      this.closed = false
      this.closing = false
      const mask = this.$refs.videoPlayerMask
      if (mask) {
        mask.style.display = ''
      }
      this.$nextTick(() => {
        this.createArtPlayer(url)
      })
    },
    close() {
      if (this.closing) return
      this.closing = true
      this.closed = true
      this.$emit('close')
      const mask = this.$refs.videoPlayerMask
      if (mask) {
        this.restartAnimation(mask)
      }
      setTimeout(() => {
        this.destroyArtPlayer()
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
    createArtPlayer(url) {
      this.destroyArtPlayer()
      const container = this.$refs.videoContainer
      if (!container || !url) return
      this.artPlayer = new ArtPlayer({
        container,
        url,
        autoSize: true,
        id: url,
        theme: '#0099ff',
        autoplay: false,
        loop: false,
        flip: true, // 视频翻转
        playbackRate: true, // 控制播放速度
        aspectRatio: true, // 控制视频比例
        screenshot: true,
        setting: true,
        hotkey: true, //快捷键
        pip: true,// 画中画
        backdrop: true, // UI 背景模糊
        fullscreen: true,
        fullscreenWeb: false,
        miniProgressBar: true,
        lock: true, // 移动端锁定控制栏
        gesture: true, // 移动端视频手势
        fastForward: true,// 移动端长按快进
        airplay: true,
        playsInline: true,
        moreVideoAttr: {
          'webkit-playsinline': true,
          controls: false,
        }
      })
    },
    destroyArtPlayer() {
      if (this.artPlayer) {
        this.artPlayer.destroy()
        this.artPlayer = null
      }
    }
  },
  beforeUnmount() {
    this.destroyArtPlayer()
  }
})
</script>

<template>
  <teleport to="body">
    <div
      class="video-player-mask"
      :class="{ closed }"
      ref="videoPlayerMask"
      style="display: none"
    >
      <!-- 顶部栏：计数器 + 关闭按钮 -->
      <div class="video-player-top-bar">
        <span v-if="counterText" class="video-player-counter">{{ counterText }}</span>
        <div class="video-player-close-btn" @click="close">
          <QIcon name="close_fill_24"/>
        </div>
      </div>

      <!-- 视频显示区域 -->
      <div
        class="video-player-video-area"
      >
        <div
          v-if="showLeftArrow"
          class="video-player-nav-arrow video-player-nav-arrow-left no-user-select"
          @click.stop="$emit('click-left')"
        >
          <QIcon name="arrow_left_24"/>
        </div>
        <div
          v-if="showRightArrow"
          class="video-player-nav-arrow video-player-nav-arrow-right no-user-select"
          @click.stop="$emit('click-right')"
        >
          <QIcon name="arrow_right_24"/>
        </div>
        <div class="video-player-container" ref="videoContainer"></div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.video-player-mask {
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
  animation: videoPlayerMaskIn var(--anim-time) ease-in-out;
  /* 阻止移动端浏览器默认触摸行为 */
  touch-action: none;
}

.video-player-mask.closed {
  animation: videoPlayerMaskIn 0.3s ease-in-out reverse;
  opacity: 0;
}

@keyframes videoPlayerMaskIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.video-player-mask.closed .video-player-video-area {
  animation: videoPlayerContentOut 0.25s ease-in-out both;
}

.video-player-mask.closed .video-player-close-btn {
  animation: videoPlayerCloseBtnOut 0.25s ease-in-out both;
}

@keyframes videoPlayerContentOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.92);
  }
}

@keyframes videoPlayerCloseBtnOut {
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
.video-player-top-bar {
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

.video-player-top-bar .video-player-close-btn {
  position: absolute;
  right: 12px;
  pointer-events: auto;
}

.video-player-counter {
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
.video-player-close-btn {
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

.video-player-close-btn svg {
  height: 100%;
  width: 100%;
}

.video-player-close-btn:hover {
  background-color: rgba(0, 0, 0, 0.75);
}

/* 视频显示区域 - 自适应剩余空间 */
.video-player-video-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

.video-player-container {
  margin: 10px;
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 左右导航箭头 */
.video-player-nav-arrow {
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

.video-player-nav-arrow:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.75);
}

.video-player-nav-arrow-left {
  left: 10px;
}

.video-player-nav-arrow-right {
  right: 10px;
}

.video-player-nav-arrow svg {
  width: 24px;
  height: 24px;
}

.video-player-nav-arrow-left svg {
  margin-right: 2px;
}

.video-player-nav-arrow-right svg {
  margin-left: 2px;
}

/* 移动端适配 */
@media (pointer: coarse) {
  .video-player-close-btn {
    top: 10px;
    right: 10px;
    width: 25px;
    height: 25px;
  }

  .video-player-container {
    margin: 8px;
  }

  .video-player-nav-arrow {
    width: 30px;
    height: 30px;
  }
}
</style>