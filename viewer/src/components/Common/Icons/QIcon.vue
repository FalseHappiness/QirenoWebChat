<script>
import { defineComponent } from 'vue'
import SvgIcon from "./SvgIcon.vue";

export default defineComponent({
  name: "QIcon",
  components: { SvgIcon },
  computed: {
    svg() {
      return this.$refs.svgIcon?.svg
    }
  }
})
</script>

<template>
  <SvgIcon ref="svgIcon" namespace="qq-icon"/>
</template>

<style scoped>

</style>