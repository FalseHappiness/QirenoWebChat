<script setup>
import { computed, ref, inject } from 'vue'
import ChatArea from './Chat/ChatArea.vue'
import LicenseView from "./License/LicenseView.vue";
import { DestKey } from "@/scripts/view-keys.js";
import { isUndefined } from "@/scripts/types-util.js";
import { isScreenMobile } from "@/scripts/util.js";
import ThemeSelector from "@/components/Destination/ThemeSelector.vue";

const viewActive = ref(false);
const currentView = ref(DestKey.CHAT_AREA)
const chatArea = ref(null)
const activeContact = inject("activeContact")
const isView = key => currentView.value === key
const isChatAreaView = computed(() => isView(DestKey.CHAT_AREA))
const isLicenseView = computed(() => isView(DestKey.LICENSE))
const isThemeSelectorView = computed(() => isView(DestKey.THEME_SELECTOR))

let changeTimer = null;
const changeView = (key, active) => {
  clearTimeout(changeTimer)
  changeTimer = null
  if (!key) {
    key = DestKey.BLANK
  }
  const change = () => {
    currentView.value = key
    if (key === DestKey.CHAT_AREA && !active) {
      activeContact.value = null
    }
  }
  if (isUndefined(active)) {
    active = key !== DestKey.BLANK
  }
  if (isScreenMobile() && viewActive.value && !active) {
    changeTimer = setTimeout(change, 200)
  } else {
    change()
  }
  viewActive.value = !!active
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
    <ThemeSelector
      v-else-if="isThemeSelectorView"
      class="dest-view-component"
    />
  </div>
</template>

<style scoped lang="scss">
.destination-view {
  flex: 1;
  height: 100%;
  background: $color-bg-chat;
  min-width: 390px;
}

.dest-view-component {
  height: 100%;
  width: 100%;
}

@include mobile {
  .destination-view {
    position: absolute;
    right: -100%;
    width: 100%;
    opacity: 0;
    transition: opacity $transition-normal ease-out, right $transition-normal ease-out;
    max-width: unset;
    min-width: unset;
  }

  .destination-view.active {
    right: 0;
    opacity: 1;
  }
}
</style>