<script>
import QIcon from "@/components/Common/Icons/QIcon.vue";

export default {
  name: "ContactDetailSubView",
  components: { QIcon },
  props: {
    title: {
      type: String,
      default: ""
    },
    closeCondition: {
      type: Function,
      default: () => true
    }
  },
  emits: ['close'],
  data() {
    return {
      closed: false
    }
  },
  methods: {
    async close() {
      if (this.closed) return
      const canClose = await this.closeCondition()
      if (!canClose) return
      this.closed = true
      setTimeout(() => this.$emit("close"), 200)
    }
  }
}
</script>

<template>
  <div class="contact-detail-sub-view" :class="{ closed }">
    <div class="contact-detail-sub-view-title">
      <QIcon name="arrow_left_24" @click="close"/>
      {{ title }}
    </div>
    <slot/>
  </div>
</template>

<style scoped lang="scss">
.contact-detail-sub-view {
  @extend %flex-column;
  height: calc(100% + 2px);
  width: 100%;
  overflow: hidden;
  position: absolute;
  animation: simplePopUpMaskIn 0.2s ease-in-out;
  transition: opacity 0.2s ease-in-out;
  opacity: 1;
  left: 0;
  top: -1px;
  background-color: $color-bg-page;
  z-index: 10;
}

.contact-detail-sub-view.closed {
  opacity: 0;
}

.contact-detail-sub-view-title {
  @extend %flex-row-center;
  padding: 10px 10px 2px;
  font-size: 16px;
  line-height: 100%;

  svg {
    @include square-size($close-btn-size);
    margin: 0 5px;
    cursor: pointer;
  }
}
</style>