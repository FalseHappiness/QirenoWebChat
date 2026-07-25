<script>
import { defineComponent } from 'vue'
import ColorSvg from "../Utils/ColorSvg.vue";
import { qqIconSvg } from "../../composables/useBase.js";

export default defineComponent({
  name: "EnterArrow",
  methods: { qqIconSvg },
  components: { ColorSvg },
  props: {
    size: {
      type: Number, default: 20
    }
  },
})
</script>

<template>
  <div class="enter-arrow" :style="{ width: size + 'px', height: size + 'px' }">
    <ColorSvg :src="qqIconSvg('arrow_right_small_16')" style="background-color: #7F7F7F;"></ColorSvg>
  </div>
</template>

<style scoped>
.enter-arrow .color-svg {
  width: 100%;
  height: 100%;
}

.enter-arrow {
  display: inline-block;
  flex-shrink: 0;
}
</style>