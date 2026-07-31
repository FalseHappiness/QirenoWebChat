<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import RecentContactItem from './RecentContactItem.vue'
import ContactsViewCategories from './ContactsViewCategories.vue'
import SettingsView from './SettingsView.vue'
import VueResizable from 'vue-resizable/src/components/vue-resizable.vue';
import VirtualScroller from "./Utils/VirtualScroller.vue";
import { getUserLogo } from "../scripts/backend-api.js";
import { Emitter } from "../composables/useEventBus.js";
import QMaskIcon from "./Utils/QMaskIcon.vue";
import { NavKey } from "../scripts/view-keys.js";
import LoadingSpinner from "./Common/LoadingSpinner.vue";

const props = defineProps({
  categorizedContacts: Array,
  activeContact: Object,
  loading: Boolean,
  selfInfo: Object
})

const emit = defineEmits(['select', 'change-self-long-nick', 'disconnect'])

const recentContacts = computed(() => {
  return props.categorizedContacts?.find?.(category => category.id === -100)?.contacts || []
})

// 按最后联系时间排序
const sortedRecentContacts = computed(() => {
  return recentContacts.value.sort((a, b) => {
    // 兜底，无时间戳给0
    const tsA = a.last_timestamp ?? 0
    const tsB = b.last_timestamp ?? 0
    // 优先时间戳倒序
    const tsDiff = tsB - tsA
    if (tsDiff !== 0) return tsDiff

    // 时间戳相同/无时间戳，使用last_time日期倒序
    const timeA = a.last_time ? new Date(a.last_time).getTime() : 0
    const timeB = b.last_time ? new Date(b.last_time).getTime() : 0
    return timeB - timeA
  })
})

const selectContact = (contact) => {
  emit('select', contact)
}

// 判断是否为当前选中联系人
const isActive = (contact) => {
  return props.activeContact &&
    props.activeContact.contact_id === contact.contact_id &&
    props.activeContact.type === contact.type
}

const selfLongNickModel = ref("")

watch(() => props.selfInfo?.long_nick, newVal => {
  selfLongNickModel.value = newVal
})

const sidebarResize = ({ width }) => {
  document.documentElement.style.setProperty('--sidebar-width', `${width}px`)
}

const handleChangeLongNick = async () => {
  if (props.selfInfo?.long_nick !== selfLongNickModel.value) {
    emit('change-self-long-nick', selfLongNickModel.value)
  }
}

const handleShowSelfInfo = e => {
  Emitter.emit("show-contact-info", {
    position: { x: e.clientX, y: e.clientY },
    user: props.selfInfo
  })
}

const currentNavView = ref(NavKey.MESSAGE); // 'messages' 'contacts' 'settings'

const isNavView = key => currentNavView.value === key
const isMessageNavView = computed(() => isNavView(NavKey.MESSAGE))
const isContactNavView = computed(() => isNavView(NavKey.CONTACT))
const isSettingsNavView = computed(() => isNavView(NavKey.SETTINGS))
const changeNavView = key => currentNavView.value = key

onMounted(() => {
  selfLongNickModel.value = props.selfInfo?.long_nick || ""
})
</script>

<template>
  <vue-resizable
    class="sidebar"
    :active="['r']"
    :width="250"
    :minWidth="180"
    :maxWidth="335"
    @resize:move="sidebarResize"
  >
    <template v-if="isMessageNavView">
      <div class="recent-contacts-top-side">
        <div class="self-info-container" v-if="selfInfo">
          <img alt="" :src="getUserLogo(selfInfo.user_id)" class="self-info-logo" @click="handleShowSelfInfo">
          <div class="self-info-card">
            <span class="self-info-nickname">{{ selfInfo.nickname }}</span>
            <input placeholder="编辑个性签名"
                   @blur="handleChangeLongNick"
                   v-model="selfLongNickModel"
                   class="text-muted self-info-long-nick overflow-ellipsis">
          </div>
        </div>
      </div>
      <LoadingSpinner v-if="loading" no-text class="flex-1"/>
      <VirtualScroller :item-height="60"
                       :items="sortedRecentContacts"
                       v-else-if="sortedRecentContacts?.length"
                       class="recent-contacts-list">
        <template #default="{ item: contact }">
          <RecentContactItem
            :key="contact.contact_id + '-' + contact.type"
            :contact="contact"
            :active="isActive(contact)"
            @select="selectContact"
          />
        </template>
      </VirtualScroller>
      <div v-else class="text-center flex-1">
        暂无最近会话
      </div>
    </template>
    <template v-else-if="isContactNavView">
      <div class="contacts-view-top-side" v-if="false">
        联系人
      </div>
      <ContactsViewCategories
        @select="selectContact"
        :loading="loading"
        :categorizedContacts="categorizedContacts"
        class="contacts-view-categories"/>
    </template>
    <template v-else-if="isSettingsNavView">
      <SettingsView
        :self-info="selfInfo"
        @disconnect="() => emit('disconnect')"
      />
    </template>
    <div class="navigation-bar">
      <div class="nav-function-button nav-function-message flex-center-children"
           @click="changeNavView(NavKey.MESSAGE)"
           :class="{ active: isMessageNavView }">
        <QMaskIcon :name="`nav_message_${ isMessageNavView ? 'active' : 'normal' }_24`"
                   animate-target="nav_message_active_24"/>
      </div>
      <div class="nav-function-button nav-function-contact flex-center-children"
           @click="changeNavView(NavKey.CONTACT)"
           :class="{ active: isContactNavView }">
        <QMaskIcon :name="`nav_contact_${ isContactNavView ? 'active' : 'normal' }_24`"
                   animate-target="nav_contact_active_24"/>
      </div>
      <div class="nav-function-button nav-function-settings flex-center-children"
           @click="changeNavView(NavKey.SETTINGS)"
           :class="{ active: isSettingsNavView }">
        <QMaskIcon :name="`nav_setting_normal_16${ isSettingsNavView ? '.modify.fill' : '' }`"
                   animate-target="nav_setting_normal_16.modify.fill"/>
      </div>
    </div>
  </vue-resizable>
</template>

<style scoped lang="scss">
.recent-contacts-top-side {
  height: 60px;
  background-image: url("#{$base-url}QQ/app/img/minicard.bg.c44eefb168ed8bd4d8e2.png"),
  linear-gradient(to top, #F5F5F5, #F0F0F0);
}
</style>

<style scoped>
.recent-contacts-list {
  /*height: calc(100% - 52px);*/
  flex: 1;
}

.sidebar {
  width: 250px;
  background: #F5F5F5;
  height: 100% !important;
  overflow: hidden;
  border-right: 1px solid #dee2e6;
  flex: none;
  max-width: calc(100% - 390px);
  display: flex;
  flex-direction: column;
}

.recent-contacts-top-side {
  height: 60px;
  background-repeat: no-repeat, no-repeat;
  background-size: 100%, 100%;
  background-clip: padding-box, border-box;
}

.self-info-container {
  display: flex;
  padding: 10px;
}

.self-info-logo {
  width: 40px;
  height: 40px;
  border: 2px solid white;
  border-radius: 50%;
  margin-right: 10px;
}

.self-info-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 16px;
}

.self-info-nickname {
  font-size: 16px;
}

.self-info-long-nick {
  color: #808080 !important;
  background: transparent;
  outline: none;
  border: 1px solid transparent;
  padding: 1px;
  border-radius: 3px;
  margin-top: 2px;
}

.self-info-long-nick:focus {
  border: 1px solid #0099ff;
}

@media (max-width: 570px) {
  .sidebar {
    width: 100% !important;
    max-width: 100%;
  }
}

.navigation-bar {
  height: 52px;
  border-top: 1px solid #dee2e6;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-around;
}

.nav-function-button {
  height: 40px;
  width: 40px;
  border-radius: 10px;
}

.nav-function-button:hover {
  background-color: #EBEBEB;
}

.nav-function-button:active {
  background-color: #E7E7E7;
}

.nav-function-button:deep(svg) {
  color: black;
  transition: color 0.1s ease-in-out;
}

.nav-function-button:active:deep(svg) {
  color: #B9B9B9;
}

.nav-function-button.active:deep(.icon-new) {
  color: #0099ff !important;
}

.contacts-view-categories {
  flex: 1;
  overflow: hidden;
}
</style>

<style>
:root {
  --sidebar-width: 250px;
}
</style>