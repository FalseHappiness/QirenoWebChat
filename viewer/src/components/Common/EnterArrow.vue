<script>
import { defineComponent } from 'vue'
import QIcon from "../Utils/QIcon.vue";

export default defineComponent({
  name: "EnterArrow",
  components: { QIcon },
  props: {
    size: {
      type: Number, default: 20
    }
  },
})
</script>

<template>
  <div class="enter-arrow" :style="{ width: size + 'px', height: size + 'px' }">
    <QIcon name="arrow_right_small_16" style="color: #7F7F7F;"></QIcon>
  </div>
</template>

<style scoped>
.enter-arrow svg {
  width: 100%;
  height: 100%;
}

.enter-arrow {
  display: inline-block;
  flex-shrink: 0;
}
</style>