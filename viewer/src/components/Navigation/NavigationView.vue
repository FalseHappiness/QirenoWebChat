<script setup>
import { computed, ref } from 'vue'
import CategorizedContactsView from './CategorizedContactsView.vue'
import SettingsView from './SettingsView.vue'
import VueResizable from 'vue-resizable/src/components/vue-resizable.vue';
import QMaskIcon from "../Common/Icons/QMaskIcon.vue";
import { NavKey } from "@/scripts/view-keys.js";
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

<style scoped lang="scss">
.sidebar {
  width: $sidebar-width;
  background: $color-bg-sidebar;
  height: 100% !important;
  overflow: hidden;
  border-right: 1px solid $color-border;
  flex: none;
  max-width: calc(100% - 390px);
  @extend %flex-column;
}

@include mobile {
  .sidebar {
    width: 100% !important;
    max-width: 100%;
  }
}

.navigation-bar {
  height: $navigation-bar-height;
  border-top: 1px solid $color-border;
  @extend %flex-row;
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
  background-color: $color-bg-hover;
}

.nav-function-button:active {
  background-color: $color-bg-nav-active;
}

.nav-function-button:deep(svg) {
  color: black;
  transition: color 0.1s ease-in-out;
}

.nav-function-button:active:deep(svg) {
  color: $color-bg-nav-active-svg;
}

.nav-function-button.active:deep(.icon-new) {
  color: $color-primary !important;
}
</style>

<style>
:root {
  --sidebar-width: 250px;
}
</style>