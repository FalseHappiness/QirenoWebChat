<template>
  <svg aria-hidden="true">
    <use :xlink:href="`#${namespace}-${name}`"/>
  </svg>
</template>
<script setup>
defineProps({ name: String, namespace: { type: String, default: "icon" } })
</script>