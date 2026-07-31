<script setup>
import { computed, ref, watch, inject } from 'vue'
import RecentContactItem from './RecentContactItem.vue'
import VirtualScroller from "../../Common/Scrolling/VirtualScroller.vue";
import { getUserLogo } from "../../../scripts/backend-api.js";
import LoadingSpinner from "../../Common/Widgets/LoadingSpinner.vue";
import { checkSameContact } from "../../../scripts/contacts-util.js";

const selfInfo = inject("selfInfo")
const loading = inject("isLoadingContacts")
const activeContact = inject("activeContact")

const categorizedContacts = inject("categorizedContacts")
// 原始会话列表
const recentContacts = computed(() => {
  return categorizedContacts.value?.find?.(category => category.id === -100)?.contacts || []
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

// 判断是否为当前选中联系人
const isActive = (contact) => {
  return checkSameContact(activeContact.value, contact)
}

// 个性签名绑定
const selfLongNickModel = ref("")

watch(() => selfInfo.value?.long_nick, newVal => {
  selfLongNickModel.value = newVal || ""
}, { immediate: true })

const changeSelfLongNick = inject("changeSelfLongNick")

// 修改个性签名
const handleChangeLongNick = async () => {
  if (selfInfo.value?.long_nick !== selfLongNickModel.value) {
    changeSelfLongNick(selfLongNickModel.value)
  }
}

const showContactInfo = inject("showContactInfo")

// 展示自身信息弹窗
const handleShowSelfInfo = e => {
  showContactInfo({
    position: { x: e.clientX, y: e.clientY },
    user: selfInfo.value
  })
}
</script>

<template>
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
      />
    </template>
  </VirtualScroller>
  <div v-else class="text-center flex-1">
    暂无最近会话
  </div>
</template>

<style scoped lang="scss">
.recent-contacts-top-side {
  height: 60px;
  background-image: url("#{$base-url}QQ/app/img/minicard.bg.c44eefb168ed8bd4d8e2.png"),
  linear-gradient(to top, #F5F5F5, #F0F0F0);
  background-repeat: no-repeat, no-repeat;
  background-size: 100%, 100%;
  background-clip: padding-box, border-box;
}
</style>

<style scoped>
.recent-contacts-list {
  flex: 1;
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
</style>