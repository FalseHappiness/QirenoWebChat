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
    }
  }
})
</script>

<template>
  <div class="loading-spinner">
    <div class="loading-spinner-icon"></div>
    <p class="loading-spinner-text" v-if="text && !noText">{{ text }}</p>
  </div>
</template>

<style scoped>
.loading-spinner-icon {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(0, 0, 0, 0.06);
  border-top-color: #0099ff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-bottom: 14px;
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