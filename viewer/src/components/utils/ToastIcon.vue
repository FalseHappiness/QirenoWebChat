<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: "ToastIcon"
})
</script>

<template>
  <span></span>
</template>

<style lang="scss">
.Vue-Toastification__toast--info .Vue-Toastification__icon {
    background: url("#{$base-url}QQ/icons/tips_noraml.svg");
}

.Vue-Toastification__toast--warning .Vue-Toastification__icon {
    background: url("#{$base-url}QQ/icons/tips_fail_16.svg");
}

.Vue-Toastification__toast--error .Vue-Toastification__icon {
    background: url("#{$base-url}QQ/icons/tips_warning.svg");
}

.Vue-Toastification__toast--success .Vue-Toastification__icon {
    background: url("#{$base-url}QQ/icons/tips_done.svg");
}
</style>