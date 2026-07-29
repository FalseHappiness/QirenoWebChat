<template>
  <svg aria-hidden="true" ref="svg">
    <use :xlink:href="`#${namespace}-${name}`"/>
  </svg>
</template>
<script setup>
import { ref } from "vue";

const svg = ref(null)
defineProps({ name: String, namespace: { type: String, default: "icon" } })
defineExpose({
  svg
})
</script>