<script setup>
import { computed, inject, ref } from 'vue'
import { Collapse as ACollapse, CollapsePanel as ACollapsePanel } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css';
import {
  getGroupLogo,
  getUserLogo
} from "../../scripts/backend-api.js"
import CustomScrollBar from "../Common/Scrolling/CustomScrollBar.vue"
import { filterSearchContacts, flattenCategorizedContacts } from "../../scripts/contacts-util.js";
import QIcon from "../Common/Icons/QIcon.vue";
import LoadingSpinner from "../Common/Widgets/LoadingSpinner.vue";

const collapseActiveKeys = ref([-100])
const filterTextModel = ref("")

const loading = inject("isLoadingContacts")
const categorizedContacts = inject("categorizedContacts")

const filteredContacts = computed(() => filterSearchContacts(
  filterTextModel.value.toLowerCase(),
  flattenCategorizedContacts(categorizedContacts.value)
))

const getLogo = (id, type) => {
  return type === 'group'
    ? getGroupLogo(id)
    : getUserLogo(id)
}

const handleSelectContact = inject("selectContact")
</script>

<template>
  <div class="categorized-contacts-view">
    <div class="contacts-view-search">
      <QIcon name="search_24" class="contacts-view-search-icon"/>
      <input
        v-model="filterTextModel"
        placeholder="搜索"
        class="contacts-view-search-input"
      >
    </div>
    <LoadingSpinner v-if="loading" no-text class="flex-1"/>
    <CustomScrollBar class="contacts-view-scroll" v-else>
      <a-collapse
        v-if="filteredContacts === undefined"
        ghost
        v-model:activeKey="collapseActiveKeys"
        style="width: 100%"
      >
        <template #expandIcon="{ isActive }">
          <QIcon
            name="arrow_right_small_16"
            class="contacts-view-expand-icon"
            :class="{ active: isActive }"
          />
        </template>
        <a-collapse-panel
          v-for="category in categorizedContacts"
          :key="category.id"
          :header="category.name"
        >
          <div
            v-for="contact in category.contacts"
            :key="`${contact.type}.${contact.contact_id}`"
            class="contacts-view-contact-item"
            @click="handleSelectContact(contact)"
          >
            <img
              class="contacts-view-contact-logo"
              alt=""
              :src="getLogo(contact.contact_id, contact.type)"
              loading="lazy"
            >
            <span class="contacts-view-contact-name overflow-ellipsis">{{ contact.name }}</span>
          </div>
        </a-collapse-panel>
      </a-collapse>
      <div v-else style="width: 100%;">
        <div
          v-if="filteredContacts.length"
          v-for="contact in filteredContacts"
          :key="`${contact.type}.${contact.contact_id}`"
          class="contacts-view-contact-item"
          @click="handleSelectContact(contact)"
        >
          <img
            class="contacts-view-contact-logo"
            alt=""
            :src="getLogo(contact.contact_id, contact.type)"
            loading="lazy"
          >
          <span class="contacts-view-contact-name overflow-ellipsis">{{ contact.name }}</span>
        </div>
        <p v-else style="color: gray; text-align: center; padding: 20px;">无搜索结果</p>
      </div>
    </CustomScrollBar>
  </div>
</template>

<style scoped>
.categorized-contacts-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.contacts-view-search {
  margin: 8px 12px 4px 12px;
  background-color: #EBEBEB;
  border-radius: 6px;
  display: flex;
  height: 28px;
  align-items: center;
  border: 1px solid #EBEBEB;
  overflow: hidden;
  flex-shrink: 0;
}

.contacts-view-search-icon {
  height: 18px;
  width: 18px;
  margin: 0 4px 0 6px;
  color: gray;
  flex-shrink: 0;
}

.contacts-view-search:focus-within {
  border-color: #0099ff;
}

.contacts-view-search-input {
  outline: none;
  background: none;
  border: none;
  font-size: 14px;
  padding: 0 4px 0 0;
  flex: 1 1 auto;
  min-width: 0;
}

.contacts-view-scroll {
  flex: 1;
  padding: 0 4px;
  overflow: auto;
}

.contacts-view-expand-icon {
  width: 16px;
  height: 16px;
  margin-right: 4px;
  transition: transform 0.2s ease-in-out;
  transform: rotate(0deg);
  flex-shrink: 0;
}

.contacts-view-expand-icon.active {
  transform: rotate(90deg);
}

.contacts-view-contact-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  margin: 2px 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.contacts-view-contact-item:hover {
  background-color: #EBEBEB;
}

.contacts-view-contact-item:active {
  background-color: #e0e0e0;
}

.contacts-view-contact-logo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 10px;
  flex-shrink: 0;
}

.contacts-view-contact-name {
  flex: 1;
  min-width: 0;
  font-size: 16px;
}

.contacts-view-scroll:deep(.ant-collapse-content-box) {
  padding: 0;
  padding-block: 0 !important;
}

.contacts-view-scroll:deep(.ant-collapse-header) {
  padding: 8px 8px 8px 4px;
}
</style>