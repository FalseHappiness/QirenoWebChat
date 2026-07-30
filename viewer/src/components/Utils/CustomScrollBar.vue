<script>
import { defineComponent } from 'vue'
import SimpleBar from "simplebar-vue";
import 'simplebar-vue/dist/simplebar.min.css';

export default defineComponent({
  name: "CustomScrollBar",
  components: {
    SimpleBar
  }
  // vue3 可以直接在 CustomScrollBar 组件自动透传事件 @scroll，不用额外转发
})
</script>

<template>
  <SimpleBar class="custom-scroll-bar" data-simplebar data-simplebar-auto-hide="false">
    <slot/>
  </SimpleBar>
</template>

<style>
.custom-scroll-bar {
  height: 100%;
  overflow: auto;
}
</style>

<style>
.custom-scroll-bar .resizable-r {
  width: 8px !important;
}

.custom-scroll-bar .simplebar-scrollbar {
  visibility: hidden;
  opacity: 0.3;
}

.custom-scroll-bar .simplebar-scrollbar:before {
  width: 7px;
  left: 3.5px;
}

/* 只让当前组件的滚动条在 hover / 拖拽时显示 */
.custom-scroll-bar:hover > .simplebar-track > .simplebar-scrollbar,
.custom-scroll-bar.simplebar-dragging > .simplebar-track > .simplebar-scrollbar {
  visibility: visible;
}
</style>