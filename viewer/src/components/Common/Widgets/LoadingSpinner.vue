<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: "LoadingSpinner",
  props: {
    text: {
      type: String,
      default: "加载中..."
    },
    noText: {
      type: Boolean,
      default: false
    },
    size: {
      type: [String, Number],
      default: '36px'
    },
  },
  computed: {
    sizeStyle() {
      let size = this.size
      if (!isNaN(Number(size))) {
        size = Number.parseInt(size) + 'px'
      }
      return { width: size, height: size }
    }
  }
})
</script>

<template>
  <div class="loading-spinner">
    <div class="loading-spinner-icon" :class="{ 'no-text': !text || noText }"
         :style="sizeStyle"></div>
    <p class="loading-spinner-text" v-if="text && !noText">{{ text }}</p>
  </div>
</template>

<style scoped lang="scss">
.loading-spinner {
  @extend %flex-column;
  align-items: center;
  justify-content: center;
}

.loading-spinner-icon {
  @include loading-spinner;
  margin-bottom: 14px;

  &.no-text {
    margin: 0;
  }
}

.loading-spinner-text {
  color: $color-text-muted;
  font-size: 14px;
  margin: 0;
}
</style>