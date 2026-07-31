<script setup>
import { computed, ref } from 'vue'
import CategorizedContactsView from './CategorizedContactsView.vue'
import SettingsView from './SettingsView.vue'
import VueResizable from 'vue-resizable/src/components/vue-resizable.vue';
import QMaskIcon from "../Common/Icons/QMaskIcon.vue";
import { NavKey } from "../../scripts/view-keys.js";
import RecentContactsView from "./RecentContacts/RecentContactsView.vue";

const sidebarResize = ({ width }) => {
  document.documentElement.style.setProperty('--sidebar-width', `${width}px`)
}

const currentNavView = ref(NavKey.MESSAGE); // 'messages' 'contacts' 'settings'

const isNavView = key => currentNavView.value === key
const isMessageNavView = computed(() => isNavView(NavKey.MESSAGE))
const isContactNavView = computed(() => isNavView(NavKey.CONTACT))
const isSettingsNavView = computed(() => isNavView(NavKey.SETTINGS))
const changeNavView = key => currentNavView.value = key
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
      <RecentContactsView/>
    </template>
    <template v-else-if="isContactNavView">
      <div class="contacts-view-top-side" v-if="false">
        联系人
      </div>
      <CategorizedContactsView/>
    </template>
    <template v-else-if="isSettingsNavView">
      <SettingsView/>
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
</style>

<style>
:root {
  --sidebar-width: 250px;
}
</style>