<script setup>
import { computed, ref } from 'vue'
import ChatArea from './ChatArea.vue'
import LicenseView from "./LicenseView.vue";
import { destKey } from "../scripts/view-keys.js";
import { isFunction } from "../scripts/types-util.js";

const props = defineProps({
  activeContact: Object,
  messages: Array,
  getMessages: Function,
  selectContact: Function,
  selfInfo: Object,
  essenceList: Array
})

const emit = defineEmits([
  'get-essence-msg-real-seq-list',
  'change-essence-msg',
  'set-real-contact-name',
  'change-group-contact-remark'
])

const viewActive = ref(false);
const currentView = ref(destKey.CHAT_AREA)
const chatArea = ref(null)
const isView = key => currentView.value === key
const isChatAreaView = computed(() => isView(destKey.CHAT_AREA))
const isLicenseView = computed(() => isView(destKey.LICENSE))
let changeTimer = null;
const changeView = (key, callback) => {
  clearTimeout(changeTimer)
  if (!key) {
    key = destKey.BLANK
  }
  changeTimer = setTimeout(() => {
    currentView.value = key
    if (isFunction(callback)) {
      callback(key)
    }
  }, (!isView(destKey.BLANK) && key === destKey.BLANK) ? 200 : 0)
  viewActive.value = key !== destKey.BLANK
}

defineExpose({
  chatArea,
  currentView,
  changeView,
  destKey,
  viewActive,
})
</script>

<template>
  <div class="destination-view" :class="{ active: viewActive }">
    <ChatArea
      class="dest-view-component"
      v-if="isChatAreaView"
      ref="chatArea"
      :active-contact="activeContact"
      :get-messages="getMessages"
      :select-contact="selectContact"
      :self-info="selfInfo"
      :essence-list="essenceList"
      @get-essence-msg-real-seq-list="emit('get-essence-msg-real-seq-list')"
      @change-essence-msg="(real_seq, set) => emit('change-essence-msg', real_seq, set)"
      @set-real-contact-name="(name) => emit('set-real-contact-name', name)"
      @change-group-contact-remark="(contact_id, remark) => emit('change-group-contact-remark', contact_id, remark)"
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