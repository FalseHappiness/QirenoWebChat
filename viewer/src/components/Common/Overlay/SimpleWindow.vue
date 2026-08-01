<script>
import { defineComponent } from 'vue'
import SimplePopUp from "@/components/Common/Overlay/SimplePopUp.vue";
import { isNumber, isString } from "@/scripts/types-util.js";
import QIcon from "@/components/Common/Icons/QIcon.vue";

export default defineComponent({
  name: "SimpleWindow",
  components: { QIcon, SimplePopUp },
  props: {
    width: {
      default: '900px',
      type: [String, Number]
    },
    height: {
      default: '700px',
      type: [String, Number]
    },
    title: {
      default: "新窗口",
      type: String
    },
    fillMobile: {
      default: true,
      type: Boolean
    }
  },
  // vue3 顶层组件自动透传，不用额外转发
  emits: ['close'],
  computed: {
    widthString() {
      if (isNumber(this.width)) {
        return this.width + 'px'
      }
      return this.width
    },
    heightString() {
      if (isNumber(this.height)) {
        return this.height + 'px'
      }
      return this.height
    }
  },
  methods: {
    close() {
      this.$emit('close')
    }
  }
})
</script>

<template>
  <div class="simple-window-popup">
    <SimplePopUp ref="popUp"
                 :on-cancel="close"
                 :on-confirm="close"
                 :container-styles="[$style['simple-window-popup-container'], fillMobile ? $style['fill-mobile'] : '' ]"
                 :inline-styles="{ '--width': widthString, '--height': heightString }">
      <div class="window-title">
        {{ title }}
        <QIcon name="close_fill_24" class="window-close-btn cannot-drag"
               @click="$refs.popUp.confirm(false)"/>
      </div>
      <slot/>
    </SimplePopUp>
  </div>
</template>

<style scoped lang="scss">
.window-title {
  text-align: center;
  font-size: 16px;
  padding: 0 0 2px 0;
  border-bottom: 1px solid $color-border-divider;
  position: relative;
}

.window-close-btn {
  float: right;
  width: $close-btn-size;
  height: $close-btn-size;
  position: absolute;
  right: 6px;
  top: 1px;
  cursor: pointer;
}
</style>

<style module lang="scss">
.simple-window-popup-container {
  width: var(--width);
  height: var(--height);
  padding: 4px 2px;
  @include box-fit();
  background-color: $color-bg-section;
  overflow: hidden;
  position: relative;
}


@media (max-width: 480px) {
  .fill-mobile {
    max-width: 100%;
    max-height: 100%;
    height: 100%;
    width: 100%;
    border-radius: 0;
  }
}
</style>