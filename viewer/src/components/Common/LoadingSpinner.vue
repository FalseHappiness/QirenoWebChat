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

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading-spinner-icon {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(0, 0, 0, 0.06);
  border-top-color: #0099ff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-bottom: 14px;
}

.loading-spinner-icon.no-text {
  margin: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-spinner-text {
  color: #808080;
  font-size: 14px;
  margin: 0;
}
</style>