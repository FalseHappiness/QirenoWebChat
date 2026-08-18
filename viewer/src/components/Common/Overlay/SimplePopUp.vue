<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: "SimplePopUp",
  inheritAttrs: false,
  emits: ['confirm', 'cancel'],
  data() {
    return {
      show: false
    }
  },
  props: {
    containerStyles: {
      type: [String, Object, Array],
      default: {}
    },
    inlineStyles: {
      type: [String, Object, Array],
      default: ""
    }
  },
  mounted() {
    this.show = true
  },
  methods: {
    close() {
      this.show = false
    },
    confirm(confirm = true, ...args) {
      this.close()
      setTimeout(() => {
        this.$emit(confirm ? 'confirm' : 'cancel', ...args)
      }, 300)
    }
  },
})
</script>

<template>
  <div class="simple-pop-up">
    <teleport to="body">
      <Transition name="simple-pop-up">
        <div v-if="show" class="simple-pop-up-mask" ref="simplePopUpMask">
          <div class="simple-pop-up-container" ref="simplePopUpContainer"
               v-bind="{ ...$attrs, [$parent.$options.__scopeId]: '' }">
            <slot></slot>
          </div>
        </div>
      </Transition>
    </teleport>
  </div>
</template>

<style scoped lang="scss">
.simple-pop-up-mask {
  @include popup-mask($set-animation: false);
  z-index: 10;
}

:where(.simple-pop-up-container) {
  @include popup-container($set-animation: false);
}

// 进入动画
.simple-pop-up-enter-active {
  animation: simplePopUpMaskIn 0.3s ease-in-out;
}
.simple-pop-up-enter-active .simple-pop-up-container {
  animation: simplePopUpContainerIn 0.3s ease-in-out;
}

// 离开动画（反向播放进入关键帧）
.simple-pop-up-leave-active {
  animation: simplePopUpMaskIn 0.3s ease-in-out reverse;
}
.simple-pop-up-leave-active .simple-pop-up-container {
  animation: simplePopUpContainerIn 0.3s ease-in-out reverse;
}
</style>