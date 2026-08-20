<script setup>
import { computed, ref, watch, inject } from 'vue'
import RecentContactItem from './RecentContactItem.vue'
import VirtualScroller from "../../Common/Scrolling/VirtualScroller.vue";
import { getUserLogo } from "@/scripts/backend-api.js";
import LoadingSpinner from "../../Common/Widgets/LoadingSpinner.vue";
import { checkSameContact } from "@/scripts/contacts-util.js";
import { getOnlineStatusIcon } from "@/scripts/oneline-status.js";
import { Emitter } from "@/composables/useEventBus.js";

const selfInfo = inject("selfInfo")
const loading = inject("isLoadingContacts")
const activeContact = inject("activeContact")

// 原始会话列表
const getRecentContacts = inject("getRecentContacts")

// 按最后联系时间排序
const sortedRecentContacts = computed(() => {
  return [...getRecentContacts()].sort((a, b) => {
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
    await changeSelfLongNick(selfLongNickModel.value)
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

const onlineStatusIcon = computed(() => {
  if (!selfInfo.value) return
  return getOnlineStatusIcon(selfInfo.value)
})
</script>

<template>
  <div class="recent-contacts-top-side">
    <div class="self-info-container" v-if="selfInfo">
      <div class="self-info-logo-container">
        <img alt="" :src="getUserLogo(selfInfo.user_id)" class="self-info-logo" @click="handleShowSelfInfo">
        <div class="online-icon-wrap" @click="Emitter.emit('open-online-status-editor')">
          <img alt="" class="self-info-online-status-icon" v-if="onlineStatusIcon" :src="onlineStatusIcon">
        </div>
      </div>
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

<style scoped lang="scss">
.recent-contacts-list {
  flex: 1;
}

.self-info-container {
  display: flex;
  padding: 10px;
}

.self-info-logo-container {
  margin-right: 10px;
  position: relative;

  .self-info-logo {
    @include avatar-with-border(40px);
  }

  .online-icon-wrap {
    @include square-size(10px);
    position: absolute;
    right: 0;
    bottom: 0;
    border-radius: $radius-circle;

    &::before {
      content: "";
      position: absolute;
      top: -2px;
      left: -2px;
      width: 14px;
      height: 14px;
      background: white;
      border-radius: 50%;
      clip-path: polygon(0 0, 60% 0, 50% 50%, 0 60%);
    }

    .self-info-online-status-icon {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background-color: $color-bg-page;
      padding: 0;
      position: absolute;
      border-radius: $radius-circle;
    }
  }
}

.self-info-card {
  @extend %flex-column;
  justify-content: center;
  line-height: 16px;
}

.self-info-nickname {
  font-size: 16px;
}

.self-info-long-nick {
  color: $color-text-muted !important;
  background: transparent;
  outline: none;
  border: 1px solid transparent;
  padding: 1px;
  border-radius: $radius-xs;
  margin-top: 2px;

  &:focus {
    border: 1px solid $color-primary;
  }
}
</style>