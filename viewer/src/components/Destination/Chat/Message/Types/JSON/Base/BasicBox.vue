<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: "BasicBox",
  props: { jumpUrl: { String, default: "" } }
})
</script>

<template>
  <a class="message-box-less message-json-basic-box" target="_blank" :href="jumpUrl">
    <slot></slot>
  </a>
</template>

<style scoped lang="scss">
.message-json-basic-box {
  width: 270px;
  max-width: 100%;
  display: block;
  @include card($radius-sm);
  color: black;
  padding: 4px 8px;
  height: auto;
}
</style>