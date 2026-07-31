<script setup>
import { getUserLogo } from "../scripts/backend-api.js"
import EnterArrow from "./Common/EnterArrow.vue";
import { inject } from "vue";
import { DestKey } from "../scripts/view-keys.js";

const props = defineProps({
  selfInfo: Object
})

const emit = defineEmits(['disconnect'])

const handleDisconnect = () => {
  emit('disconnect')
}

const changeDestView = inject("changeDestView")

const handleEnterLicense = () => {
  changeDestView(DestKey.LICENSE)
}
</script>

<template>
  <div class="settings-view-container">
    <!-- 个人信息区域 -->
    <div class="settings-profile-area">
      <img
        alt=""
        :src="getUserLogo(selfInfo?.user_id)"
        class="settings-profile-logo"
      />
      <div class="settings-profile-info">
        <span class="settings-profile-nickname">{{ selfInfo?.nickname }}</span>
        <small class="settings-profile-user-id" v-if="false">{{ selfInfo?.user_id }}</small>
        <span class="settings-profile-long-nick overflow-ellipsis">{{
            selfInfo?.long_nick || selfInfo?.longNick || '暂无个性签名'
          }}</span>
      </div>
    </div>

    <div class="settings-actions-area enter-view" @click="handleEnterLicense">
      <span class="overflow-ellipsis">开放源代码许可证</span>
      <EnterArrow/>
    </div>

    <!-- 断开连接按钮 -->
    <div class="settings-actions-button" @click="handleDisconnect">
      断开连接
    </div>
  </div>
</template>

<style scoped>
.settings-view-container {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 18px;
  font-size: 15px;
  flex: 1;
}

/* 个人信息区域 - 参照 chat-area-contact-more-area 样式 */
.settings-profile-area {
  display: flex;
  align-items: center;
  border-radius: 8px;
  background-color: white;
  padding: 8px 12px;
}

.settings-profile-logo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin: 5px 10px 5px 5px;
}

.settings-profile-info {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
  min-width: 0;
}

.settings-profile-nickname {
  font-size: 16px;
  font-weight: 500;
}

.settings-profile-user-id {
  color: gray;
  font-size: 13px;
}

.settings-profile-long-nick {
  color: #808080;
  font-size: 13px;
  margin-top: 2px;
}

/* 操作区域 */
.settings-actions-area {
  border-radius: 8px;
  background-color: white;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-actions-area.enter-view {
  flex-direction: row;
  padding: 8px 6px 8px 12px;
  align-items: center;
  gap: 0;
  cursor: pointer;
}

.enter-view span {
  flex: 1;
}

.settings-actions-button {
  border-radius: 8px;
  background-color: white;
  text-align: center;
  padding: 6px 0;
  width: 100%;
  transition: background-color 0.2s ease;
  cursor: pointer;
  font-size: 15px;
  color: black;
}

.settings-actions-button:active {
  color: #8e8e8e;
}
</style>