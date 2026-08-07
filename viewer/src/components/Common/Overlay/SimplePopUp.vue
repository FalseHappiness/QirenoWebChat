<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: "SimplePopUp",
  inheritAttrs: false,
  data() {
    return {
      closed: false
    }
  },
  props: {
    onConfirm: {
      type: Function,
      default: new Function()
    },
    onCancel: {
      type: Function,
      default: new Function()
    },
    containerStyles: {
      type: [String, Object, Array],
      default: {}
    },
    inlineStyles: {
      type: [String, Object, Array],
      default: ""
    }
  },
  methods: {
    close() {
      this.closed = true
      const mask = this.$refs.simplePopUpMask
      const container = this.$refs.simplePopUpContainer
      this.restartAnimation(mask)
      this.restartAnimation(container)
      setTimeout(() => {
        mask.style.display = container.style.display = 'none'
      }, 300)
    },
    restartAnimation(element) {
      const display = element.style.display
      element.style.display = 'none';
      // 触发重排
      element.offsetWidth;
      element.style.display = display;
    },
    confirm(confirm = true, ...args) {
      this.close()
      setTimeout(() => {
        confirm ? this.onConfirm(...args) : this.onCancel()
      }, 300)
    }
  },
})
</script>

<template>
  <div class="simple-pop-up">
    <teleport to="body">
      <div class="simple-pop-up-mask" :class="{ closed }" ref="simplePopUpMask">
        <div class="simple-pop-up-container" ref="simplePopUpContainer"
             v-bind="{ ...$attrs, [$parent.$options.__scopeId]: '' }">
          <slot></slot>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped lang="scss">
.simple-pop-up-mask {
  @include popup-mask;
  z-index: 10;
}

.simple-pop-up-mask.closed {
  animation: simplePopUpMaskIn 0.3s ease-in-out reverse;
  opacity: 0;
}

:where(.simple-pop-up-container) {
  @include popup-container;
}

.simple-pop-up-mask.closed .simple-pop-up-container {
  animation: simplePopUpContainerIn 0.3s ease-in-out reverse;
  opacity: 0;
}
</style>