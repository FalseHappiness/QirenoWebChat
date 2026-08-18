<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import {
  checkResponseOK, fetchDeleteFriend, fetchLeaveGroup,
  fetchGroupAdminSettings,
  fetchSetGroupAllMuted, fetchSetGroupMemberCard,
  fetchSetGroupSearchOption,
  fetchSetGroupNewMemberHistoryVisibility,
  fetchSetGroupMemberPermissions,
  getGroupLogo, getUserLogo
} from "@/scripts/backend-api.js";
import { qqAppImg } from "@/composables/useBase.js";
import { isNumber, isString, isUndefined } from "@/scripts/types-util.js";
import { gteSnowLuma } from "@/scripts/onebot-version-util.js";
import { getGroupInfoCacheFromAll, isGroupOperator } from "@/scripts/user-info-util.js";
import { showConfirmBox } from "@/scripts/popup-box-api.js";
import { showErrorToast, showSuccessToast } from "@/scripts/toast.js";
import {
  Switch as ASwitch,
  Select as ASelect,
  SelectOption as ASelectOption
} from "ant-design-vue";
import CustomScrollBar from "../../../Common/Scrolling/CustomScrollBar.vue";
import QIcon from "../../../Common/Icons/QIcon.vue";
import EnterArrow from "../../../Common/Widgets/EnterArrow.vue";
import GroupMembersViewer from "./GroupMembersViewer.vue";
import GroupAddOption from "./GroupAddOption.vue";

const props = defineProps({
  showContactMore: Boolean,
  displayName: String,
  isGroup: Boolean,
  activeContact: Object,
  groupUsers: Array,
  groupNotifications: {
    type: Array,
    default: null
  },
  latestGroupNoticeMsg: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'showGroupAnnounce',
  'showEssenceList',
  'showGroupFiles',
  'showGroupAlbum',
  'showGroupSign',
  'showContactInfo',
])

const changeGroupContactRemark = inject("changeGroupContactRemark")
const changeGroupContactName = inject("changeGroupContactName")
const changeFriendContactRemark = inject("changeFriendContactRemark")
const selfInfo = inject("selfInfo")

// 内部状态
const showGroupMembersViewer = ref(false)
const showGroupAddOptionView = ref(false)

const changeShowGroupMembers = (isShow = true) => {
  showGroupMembersViewer.value = isShow
}
const changeShowGroupAddOption = (isShow = true) => {
  showGroupAddOptionView.value = isShow
}

// 关闭面板时重置内部视图
watch(() => props.showContactMore, val => {
  if (!val) {
    changeShowGroupMembers(false)
    changeShowGroupAddOption(false)
  }
})

// 群相关信息
const groupSelfInfo = computed(() => props.groupUsers?.find(user => user.user_id === selfInfo.value?.user_id))
const selfGroupOperator = computed(() => isGroupOperator(groupSelfInfo.value))

const groupSelfCardModel = ref(null)
const groupRemarkModel = ref(null)
const groupNameModel = ref(null)
const groupAllMutedModel = ref(null)
const friendRemarkModel = ref(null)

watch(() => groupSelfInfo.value, newVal => {
  if (newVal != null) {
    groupSelfCardModel.value = newVal.card
  }
})

// 初始化模型值
watch(() => props.activeContact, (newVal) => {
  if (newVal) {
    if (props.isGroup) {
      groupRemarkModel.value = newVal.remark
      groupNameModel.value = newVal.real_name
    } else {
      friendRemarkModel.value = newVal.remark
    }
  }
}, { immediate: true })

const handleGroupSelfCardChange = async () => {
  if (groupSelfCardModel.value !== groupSelfInfo?.value?.card) {
    await fetchSetGroupMemberCard(props.activeContact.contact_id, selfInfo.value.user_id, groupSelfCardModel.value)
  }
}

const handleGroupRemarkChange = () => {
  if (groupRemarkModel.value !== props.activeContact?.remark) {
    changeGroupContactRemark(props.activeContact.contact_id, groupRemarkModel.value)
  }
}

const handleEnterBlur = (e) => {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    e.target.blur()
  }
}

const handleGroupNameChange = () => {
  if (groupNameModel.value !== props.activeContact?.real_name) {
    changeGroupContactName(props.activeContact.contact_id, groupNameModel.value)
  }
}

const transGroupAllMuted = (value, toBool = true) => toBool ? value === -1 : (value ? -1 : 0)

const contactId = computed(() => props.activeContact?.contact_id)

const currenGroupAllMuted = () => getGroupInfoCacheFromAll(contactId.value)?.group_all_shut

watch(currenGroupAllMuted, val => {
  if (isNumber(val)) {
    groupAllMutedModel.value = transGroupAllMuted(val)
  }
})

const handleGroupAllMutedChange = checked => {
  if (groupAllMutedModel.value !== transGroupAllMuted(currenGroupAllMuted())) {
    fetchSetGroupAllMuted(props.activeContact.contact_id, checked)
  }
}

const handleLeaveGroup = async () => {
  if (await showConfirmBox("退出群聊", "退出后不会通知群聊中其他成员，且不会再接受此群消息。")) {
    const group_id = props.activeContact.contact_id
    const result = await fetchLeaveGroup(group_id)
    if (checkResponseOK(result)) {
      showSuccessToast("退出成功")
    } else {
      console.error("Leave group error:", group_id, result)
      showErrorToast("退群失败: " + result?.message)
    }
  }
}

const handleChangeFriendRemark = () => {
  if (friendRemarkModel.value !== props.activeContact?.remark) {
    changeFriendContactRemark(contactId.value, friendRemarkModel.value)
  }
}

const handleDeleteFriend = async () => {
  if (await showConfirmBox("确定删除该好友吗？")) {
    const user_id = props.activeContact.contact_id
    const result = await fetchDeleteFriend(user_id)
    if (checkResponseOK(result)) {
      showSuccessToast("已删除")
    } else {
      console.error("Delete friend error:", user_id, result)
      showErrorToast("删除好友失败: " + result?.message)
    }
  }
}

const handleClickShowContactInfo = (e, user_id) => {
  emit('showContactInfo', { e, user_id })
}

const groupSearchOptionModel = ref(null)
const allowGroupMemberUploadAlbum = ref(null)
const allowGroupMemberTempSession = ref(null)
const allowGroupMemberCreateGroup = ref(null)
const groupNewMemberHistoryVisible = ref(null)

// SnowLuma 1.14.11+ 相关
const isSnowLumaAdmin = computed(() => gteSnowLuma(1, 14, 11))
const adminSettingsLoaded = ref(false)
const skipSettingsWatcher = ref(false)

// 批量操作4个管理设置 refs
const adminRefs = [allowGroupMemberUploadAlbum, allowGroupMemberTempSession, allowGroupMemberCreateGroup, groupNewMemberHistoryVisible]
const adminApiKeys = ['allow_member_upload_album', 'allow_member_temporary_session', 'allow_member_create_group', 'new_member_history_visible']

function resetAdminSettings(value) {
  adminRefs.forEach(r => {
    r.value = value
  })
}

function applyAdminSettings(settings) {
  if (!settings) return
  adminRefs.forEach((r, i) => {
    r.value = settings[adminApiKeys[i]]
  })
  // 反映射 no_finger_open / no_code_finger_open → search_type
  // 0: 不允许被搜索, 1: 通过群号搜索, 2: 通过群号及关键词搜索
  if (settings.no_finger_open === 0 && settings.no_code_finger_open === 0) {
    groupSearchOptionModel.value = 2
  } else if (settings.no_finger_open === 1 && settings.no_code_finger_open === 0) {
    groupSearchOptionModel.value = 1
  } else {
    groupSearchOptionModel.value = 0
  }
}

function handleSettingChange(requestFn) {
  return async (val) => {
    if (isUndefined(val) || val === null) return
    try {
      const result = await requestFn(val)
      if (!checkResponseOK(result)) {
        console.error('Update group settings error:', result)
        showErrorToast(`更新失败: ${ result?.message || '' }`)
      }
    } catch (e) {
      console.error('Update group settings error:', e)
      showErrorToast(`更新失败: ${ e?.message || '' }`)
    }
  }
}

function createSettingsWatcher(requestFn) {
  return handleSettingChange(val => {
    if (skipSettingsWatcher.value) return { status: 'ok' }
    return requestFn(val)
  })
}

watch(groupSearchOptionModel, handleSettingChange(
  val => {
    if (skipSettingsWatcher.value) return { status: 'ok' }
    return fetchSetGroupSearchOption(contactId.value, val)
  }
))

watch(allowGroupMemberUploadAlbum, createSettingsWatcher(
  val => fetchSetGroupMemberPermissions(contactId.value, val, allowGroupMemberTempSession.value, allowGroupMemberCreateGroup.value)
))

watch(allowGroupMemberTempSession, createSettingsWatcher(
  val => fetchSetGroupMemberPermissions(contactId.value, allowGroupMemberUploadAlbum.value, val, allowGroupMemberCreateGroup.value)
))

watch(allowGroupMemberCreateGroup, createSettingsWatcher(
  val => fetchSetGroupMemberPermissions(contactId.value, allowGroupMemberUploadAlbum.value, allowGroupMemberTempSession.value, val)
))

watch(groupNewMemberHistoryVisible, createSettingsWatcher(
  val => fetchSetGroupNewMemberHistoryVisibility(contactId.value, !!val)
))

// 存储完整的管理设置数据，用于传递给子组件
const groupAdminSettingsData = ref(null)

// SnowLuma 1.14.11+ 通过 get_group_admin_settings 获取群管理设置
watch([contactId, selfGroupOperator], async ([groupId, isOperator]) => {
  if (isOperator && groupId && isSnowLumaAdmin.value) {
    adminSettingsLoaded.value = false
    skipSettingsWatcher.value = true
    resetAdminSettings(undefined)
    groupAdminSettingsData.value = null
    try {
      const settings = await fetchGroupAdminSettings(groupId)
      groupAdminSettingsData.value = settings
      applyAdminSettings(settings)
      adminSettingsLoaded.value = true
    } catch (e) {
      console.error('Fetch group admin settings error:', e)
      resetAdminSettings(undefined)
    } finally {
      await nextTick()
      skipSettingsWatcher.value = false
    }
  } else {
    adminSettingsLoaded.value = false
    skipSettingsWatcher.value = true
    resetAdminSettings(null)
    await nextTick()
    skipSettingsWatcher.value = false
  }
}, { immediate: true })

const contactDetailRef = ref(null)
defineExpose({ contactDetailRef })
</script>

<template>
  <div v-if="activeContact" ref="contactDetailRef" class="contact-detail"
       :style="{ right: showContactMore ? '0' : '-100%' }">
    <GroupMembersViewer
      v-if="showGroupMembersViewer && isGroup"
      :group_id="contactId"
      :group-users="groupUsers"
      @click-show-contact-info="handleClickShowContactInfo"
      @close="() => changeShowGroupMembers(false)"
    />
    <GroupAddOption
      v-if="showGroupAddOptionView && isGroup"
      :group_id="contactId"
      :admin-settings-data="groupAdminSettingsData"
      @close="() => changeShowGroupAddOption(false)"
    />
    <CustomScrollBar class="contact-detail-scroller">
      <template v-if="isGroup">
        <div class="contact-detail-area contact-detail-info">
          <img
            :src="getGroupLogo(activeContact.contact_id)"
            alt=""
            class="contact-detail-logo">
          <div class="overflow-ellipsis">
            <span :title="displayName">{{ displayName }}</span>
            <br>
            <small>{{ activeContact.contact_id }}</small>
          </div>
        </div>

        <div class="contact-detail-area display-flex cursor-pointer" @click="changeShowGroupMembers(true)">
          群聊成员
          <EnterArrow/>
        </div>

        <label
          v-if="selfGroupOperator && isString(groupNameModel)"
          class="contact-detail-area with-title input-content"
          data-title="群聊名称">
          <input v-model="groupNameModel"
                 @blur="handleGroupNameChange"
                 @keydown="handleEnterBlur"
                 type="text"
                 placeholder="填写群名称">
        </label>

        <div class="contact-detail-area container-inline-size">
          群应用
          <div class="group-applications-list">
            <div @click="emit('showGroupFiles')" class="group-app-list-app-container">
              <QIcon name="filelook_folder_16" class="group-app-icon"/>
              群文件
            </div>
            <div @click="emit('showGroupAlbum')" class="group-app-list-app-container">
              <QIcon name="image_24" class="group-app-icon" style="color: var(--color-primary);"/>
              群相册
            </div>
            <div @click="emit('showEssenceList')" class="group-app-list-app-container">
              <img alt="" :src="qqAppImg('essence.bbb878de5480c01292f5.svg')" class="group-app-icon"/>
              群精华
            </div>
            <div @click="emit('showGroupSign')" class="group-app-list-app-container">
              <QIcon name="calendar_24" class="group-app-icon"/>
              群打卡
            </div>
          </div>
        </div>

        <div class="contact-detail-area with-title display-flex cursor-pointer" data-title="群公告"
             @click="emit('showGroupAnnounce')">
          <span v-if="groupNotifications == null" style="color: var(--color-text-muted);">内容获取中</span>
          <span v-else-if="!groupNotifications?.length" style="color: var(--color-text-muted);">未设置</span>
          <span v-else class="overflow-ellipsis">
            <span v-if="latestGroupNoticeMsg?.image?.length">【图片】</span>
            <span v-html="latestGroupNoticeMsg.text"></span>
          </span>
          <EnterArrow/>
        </div>

        <label
          v-if="groupSelfInfo && isString(groupSelfCardModel)"
          class="contact-detail-area with-title input-content"
          data-title="我的本群昵称">
          <input v-model="groupSelfCardModel"
                 @blur="handleGroupSelfCardChange"
                 @keydown="handleEnterBlur"
                 type="text"
                 class="overflow-ellipsis"
                 placeholder="填写我的本群昵称">
        </label>

        <label
          v-if="isString(groupRemarkModel)"
          class="contact-detail-area with-title input-content"
          data-title="群聊备注">
          <input v-model="groupRemarkModel"
                 @blur="handleGroupRemarkChange"
                 @keydown="handleEnterBlur"
                 type="text"
                 placeholder="填写备注">
        </label>

        <div
          v-if="selfGroupOperator"
          class="contact-detail-area with-title display-flex cursor-pointer"
          data-title="发言权限">
          全员禁言
          <ASwitch v-model:checked="groupAllMutedModel" @change="handleGroupAllMutedChange" size="small"/>
        </div>

        <div
          v-if="selfGroupOperator"
          class="contact-detail-area with-title area-container"
          data-title="开放设置">
          <template v-if="!isSnowLumaAdmin || adminSettingsLoaded">
            <div class="contact-detail-container-area cursor-pointer" @click="changeShowGroupAddOption()">
              加群方式
              <EnterArrow/>
            </div>
            <hr>
            <div class="contact-detail-container-area">
              <div class="group-search-text">
                群搜索方式
                <span class="text-muted">需先设置群名称及头像</span>
              </div>
              <ASelect v-model:value="groupSearchOptionModel" size="small">
                <ASelectOption :value="null" v-if="!isSnowLumaAdmin">不修改</ASelectOption>
                <ASelectOption :value="0">不允许被搜索</ASelectOption>
                <ASelectOption :value="1">通过群号搜索</ASelectOption>
                <ASelectOption :value="2">通过群号及关键词搜索</ASelectOption>
              </ASelect>
            </div>
          </template>
          <div v-if="!adminSettingsLoaded" class="contact-detail-container-area text-muted">
            加载中…
          </div>
        </div>

        <!-- 非 SnowLuma 或版本低于1.14.11：使用 ASelect 带"不修改"选项 -->
        <div
          v-if="selfGroupOperator && !isSnowLumaAdmin"
          class="contact-detail-area with-title area-container member-permissions"
          data-title="成员权限">
          <div class="contact-detail-container-area">
            上传相册
            <ASelect v-model:value="allowGroupMemberUploadAlbum" size="small">
              <ASelectOption :value="null">不修改</ASelectOption>
              <ASelectOption :value="false">不允许</ASelectOption>
              <ASelectOption :value="true">允许</ASelectOption>
            </ASelect>
          </div>
          <hr>
          <div class="contact-detail-container-area">
            发起临时会话
            <ASelect v-model:value="allowGroupMemberTempSession" size="small">
              <ASelectOption :value="null">不修改</ASelectOption>
              <ASelectOption :value="false">不允许</ASelectOption>
              <ASelectOption :value="true">允许</ASelectOption>
            </ASelect>
          </div>
          <hr>
          <div class="contact-detail-container-area">
            发起新的群聊
            <ASelect v-model:value="allowGroupMemberCreateGroup" size="small">
              <ASelectOption :value="null">不修改</ASelectOption>
              <ASelectOption :value="false">不允许</ASelectOption>
              <ASelectOption :value="true">允许</ASelectOption>
            </ASelect>
          </div>
          <hr>
          <div class="contact-detail-container-area">
            加群用户默认可见聊天记录
            <ASelect v-model:value="groupNewMemberHistoryVisible" size="small">
              <ASelectOption :value="null">不修改</ASelectOption>
              <ASelectOption :value="false">否</ASelectOption>
              <ASelectOption :value="true">是</ASelectOption>
            </ASelect>
          </div>
        </div>

        <!-- SnowLuma 1.14.11+：通过 get_group_admin_settings 获取设置，用 ASwitch，数据加载后才显示 -->
        <div
          v-if="selfGroupOperator && isSnowLumaAdmin"
          class="contact-detail-area with-title area-container member-permissions"
          data-title="成员权限">
          <template v-if="adminSettingsLoaded">
            <div
              class="contact-detail-container-area">
              上传相册
              <ASwitch v-model:checked="allowGroupMemberUploadAlbum" size="small"/>
            </div>
            <hr>
            <div
              class="contact-detail-container-area">
              发起临时会话
              <ASwitch v-model:checked="allowGroupMemberTempSession" size="small"/>
            </div>
            <hr>
            <div
              class="contact-detail-container-area">
              发起新的群聊
              <ASwitch v-model:checked="allowGroupMemberCreateGroup" size="small"/>
            </div>
            <hr>
            <div
              class="contact-detail-container-area">
              加群用户默认可见聊天记录
              <ASwitch v-model:checked="groupNewMemberHistoryVisible" size="small"/>
            </div>
          </template>
          <div v-if="!adminSettingsLoaded" class="contact-detail-container-area text-muted">
            加载中…
          </div>
        </div>

        <div class="contact-detail-area contact-detail-leave-group" @click="handleLeaveGroup">退出群聊</div>
      </template>
      <template v-else>
        <div class="contact-detail-area contact-detail-info">
          <img
            :src="getUserLogo(contactId)"
            alt=""
            class="contact-detail-logo">
          <div class="overflow-ellipsis">
            <span :title="displayName">{{ displayName }}</span>
            <br>
            <small>{{ contactDetailRef }}</small>
          </div>
        </div>

        <label
          v-if="isString(friendRemarkModel)"
          class="contact-detail-area with-title input-content"
          data-title="好友备注">
          <input v-model="friendRemarkModel"
                 @blur="handleChangeFriendRemark"
                 @keydown="handleEnterBlur"
                 type="text"
                 placeholder="填写备注">
        </label>

        <div class="contact-detail-area contact-detail-delete-friend" @click="handleDeleteFriend">删除好友</div>
      </template>
    </CustomScrollBar>
  </div>
</template>

<style scoped lang="scss">
.contact-detail {
  position: absolute;
  height: calc(100% - $chat-area-head-height);
  top: $chat-area-head-height;
  width: 350px;
  background-color: $color-bg-card-alt;
  border: 1px solid $color-border;
  right: -100%;
  z-index: 5;
  box-shadow: $shadow-contact-more;
  transition: right ease-out $transition-slow;

  &:deep(.contact-detail-scroller) {
    padding: 0 18px;

    .simplebar-content {
      font-size: 15px;
      gap: 18px;
      @extend %flex-column;
    }
  }
}

.contact-detail-area {
  &.member-permissions {
    .ant-select {
      width: 220px;
      flex: 0 1;
    }
  }

  .group-search-text {
    @extend %flex-column;
    font-size: 14px;

    .text-muted {
      font-size: 70%;
    }
  }
}

:deep(.contact-detail-area) {
  @include card;
  padding: 8px 12px;
  display: block;
  margin: 0;

  &.display-flex {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &.with-title {
    margin-top: 18px;

    &:before {
      content: attr(data-title);
      display: block;
      position: absolute;
      margin-top: -32px;
      color: $color-text-muted;
      font-size: 14px;
      pointer-events: none;
    }

    &.display-flex:before {
      margin-top: -64px;
    }
  }

  &.input-content {
    outline: 1px solid transparent;
    width: 100%;

    input {
      outline: none;
      border: none;
      width: 100%;
    }

    &:has(input:focus) {
      outline: 1px solid $color-primary;
    }
  }

  &.area-container {
    @extend %flex-column;
  }

  &.ant-radio-group {
    font-size: 15px;
  }

  hr {
    background: $color-border-divider;
    margin: 5px 0;
    height: 1px;
    opacity: 0.8;
    border: none;
  }

  .contact-detail-container {
    &-area {
      @extend %flex-row-between;

      &.ant-radio-wrapper {
        flex-direction: row-reverse;
        display: flex;

        span.ant-radio + * {
          flex: 1;
          padding-left: 0;
        }
      }
    }

    &-input {
      @extend %flex-row-center;

      input {
        border: none;
        outline: none;
        flex: 1;
        margin-left: 10px;
      }
    }
  }

  .ant-select {
    flex: 1;
    margin-left: 10px;
  }
}


.contact-detail-logo {
  @include avatar(40px);
  margin: 5px 10px 5px 5px;
}

.contact-detail-info small {
  color: var(--color-text-muted);
  display: block;
  margin-top: -4px;
}

.contact-detail-info {
  display: flex;
  align-items: center;
}

.group-applications-list {
  padding: 8px 10px 0 10px;
  gap: 15px;
  @include grid-columns-auto-fill(50px);
}

.group-app-list-app-container {
  @extend %flex-column-center;
  font-size: 12px;
  gap: 5px;
  cursor: pointer;
}

.group-app-icon {
  @include square-size(30px);
}

.contact-detail-leave-group, .contact-detail-delete-friend {
  @extend %flex-center-children;
  color: $color-text-danger;
  cursor: pointer;
}


@include mobile {
  .contact-detail {
    width: 100%;
    height: calc(100% - 42px);
    top: 42px;
    box-shadow: none;
    transition: right ease-out $transition-normal;
  }
}
</style>