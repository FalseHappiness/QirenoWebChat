<script setup>
import { computed, ref } from 'vue'
import ChatArea from './Chat/ChatArea.vue'
import LicenseView from "./License/LicenseView.vue";
import { DestKey } from "../../scripts/view-keys.js";
import { isFunction } from "../../scripts/types-util.js";

const viewActive = ref(false);
const currentView = ref(DestKey.CHAT_AREA)
const chatArea = ref(null)
const isView = key => currentView.value === key
const isChatAreaView = computed(() => isView(DestKey.CHAT_AREA))
const isLicenseView = computed(() => isView(DestKey.LICENSE))
let changeTimer = null;
const changeView = (key, callback) => {
  clearTimeout(changeTimer)
  changeTimer = null
  if (!key) {
    key = DestKey.BLANK
  }
  const change = () => {
    currentView.value = key
    if (isFunction(callback)) {
      callback(key)
    }
  }
  if (!isView(DestKey.BLANK) && key === DestKey.BLANK) {
    changeTimer = setTimeout(change, 200)
  } else {
    change()
  }
  viewActive.value = key !== DestKey.BLANK
}

defineExpose({
  chatArea,
  currentView,
  changeView,
  destKey: DestKey,
  viewActive,
})
</script>

<template>
  <div class="destination-view" :class="{ active: viewActive }">
    <ChatArea
      class="dest-view-component"
      v-if="isChatAreaView"
      ref="chatArea"
    />
    <LicenseView
      v-else-if="isLicenseView"
      class="dest-view-component"
    />
  </div>
</template>

<style scoped>
.destination-view {
  flex: 1;
  height: 100%;
  background: rgb(245, 245, 245);
  /*max-width: calc(100% - var(--sidebar-width));*/
  min-width: 390px;
}

.dest-view-component {
  height: 100%;
  width: 100%;
}

@media (max-width: 570px) {
  .destination-view {
    position: absolute;
    right: -100%;
    width: 100%;
    opacity: 0;
    transition: opacity 0.2s ease-out, right 0.2s ease-out;
    max-width: unset;
    min-width: unset;
  }

  .destination-view.active {
    right: 0;
    opacity: 1;
  }
}
</style>