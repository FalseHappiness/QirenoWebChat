<script setup>
import { computed, ref } from "vue";
import { qqAppImg } from "@/composables/useBase.js";
import AdvancedBox from "@/components/Destination/Chat/Message/Types/JSON/Base/AdvancedBox.vue";

const props = defineProps({
  json: Object
})

const detail = computed(() => {
  return props.json?.meta?.detail_1 || {}
})

const isLoaded = ref(false)

</script>

<template>
  <AdvancedBox
    class="message-box-less message-mini-app-01"
    :jump-url="detail.url.startsWith('http')?'':'https://'+detail.url"
    :footer-icon="qqAppImg('qq_mini_app.ico')"
    footer-text="QQ小程序">
    <div class="header">
      <img alt="" :src="detail.icon">
      <span class="text-muted">{{ detail.title }}</span>
    </div>
    <span class="desc">{{ detail.desc }}</span>
    <img :style="{ height: isLoaded ? 'auto' : '196px' }" @load="isLoaded = true" alt="" :src="detail.preview"
         class="preview-image"/>
  </AdvancedBox>
</template>

<style scoped lang="scss">
.message-mini-app-01 {
  width: 270px;
  max-width: 100%;
  display: block;
  @include card($radius-sm);
  color: black;
  text-decoration: none !important;
  height: auto;
}

.header img {
  height: 18px;
  width: 18px;
  vertical-align: center;
  border-radius: 2px;
}

.header span {
  vertical-align: center;
  margin-left: 5px;
}

.preview-image {
  width: 100%;
  border-radius: $radius-xs;
  margin-bottom: 3px;
}

.text-muted {
  font-size: 80%;
}

.desc {
  font-size: 15px;
  margin-top: 3px;
  display: inline-block;
}
</style>