<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: "GameCenter",
  props: { json: Object },
  computed: {
    button() {
      return this.json?.meta?.button
    },
  },
})
</script>

<template>
  <div class="message-gamecenter-qqsy-button message-box-less no-darkness-effect" v-if="button">
    {{ button.btnText }}
  </div>
</template>

<style scoped lang="scss">
.message-gamecenter-qqsy-button {
  @include btn-primary($radius-card);
  padding: 6px 10px;
  max-width: 100%;
  width: 300px;
  font-size: 90%;
}
</style>