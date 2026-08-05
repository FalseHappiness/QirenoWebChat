<script setup>
import { ref, onUnmounted, computed, h, onMounted, inject, toRaw } from 'vue'
import { formatTime, parseMessage, parseNotice } from "@/scripts/parse-message.js";
import '@lottiefiles/lottie-player';
import {
  checkResponseOK,
  fetchChangeEssenceMsg,
  fetchKickGroupUser,
  fetchRecallMessage, fetchRecordToText,
  fetchSendMessage, fetchSetGroupMute, fetchTranslateEnglish,
  getUserLogo
} from "@/scripts/backend-api.js";
import { useGlobalStore } from "@/store/global.js";
import GroupLevelTitle from "./GroupLevelTitle.vue";
import {
  basicContextItem,
  contextDividedItem,
  formatBasicContextItems,
  vCustomMenu
} from "@/directives/context-menu.js";
import { vDoubleClick } from '@/directives/double-click-directive.js';
import { formatRelativeTime, getElementCenter, hasEnglish, parseJSON } from "@/scripts/util.js";
import { showErrorToast, showSuccessToast, showToast } from "@/scripts/toast.js";
import { Emitter } from "@/composables/useEventBus.js";
import { qqAppImg } from "@/composables/useBase.js";
import LoadingSpinner from "../../../Common/Widgets/LoadingSpinner.vue";
import QIcon from "../../../Common/Icons/QIcon.vue";
import { isFunction, isString } from "@/scripts/types-util.js";
import { checkSameContact } from "@/scripts/contacts-util.js";
import { showConfirmBox, showPromptBox } from "@/scripts/popup-box-api.js";
import {
  CacheNameKey,
  fetchDisplayName,
  getCacheName,
  getUserAvatarFrameCache,
  hasGroupMemberOperatePermission, isGroupAdmin, isGroupOperator, isGroupOwner
} from "@/scripts/user-info-util.js";

const props = defineProps({
  message: {
    type: Object,
    required: true,
    default: () => ({}),
  },
  showTimeNotice: {
    type: Boolean,
    default: false
  },
})

const activeContact = inject("activeContact")
const groupUsers = inject("groupUsers")

const global = useGlobalStore()

const emit = defineEmits([
  'quote-message',
  'click-show-contact-info',
  'change-show-group-notice',
  'change-show-essence-list',
])

const noticeContainer = ref(null)
const messageContent = ref(null)

// 移除 messageSendTime ref，改为使用 class 控制
let hoverTimer = null

// 全局处理鼠标悬浮
const handleMouseEnter = (e) => {
  const container = e?.target?.closest?.('.message-container')
  if (!container) return

  // 清除之前的定时器
  if (hoverTimer) {
    clearTimeout(hoverTimer)
  }

  // 设置新定时器
  hoverTimer = setTimeout(() => {
    container.classList.add('show-message-time')
  }, 1000)
}

const handleMouseLeave = (e) => {
  const container = e?.target?.closest?.('.message-container')
  if (!container) return

  // 清除定时器
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }

  container.classList.remove('show-message-time')
}

const handleCopy = (e) => {
  // console.log(e)
  // const selection = window.getSelection();
  // let text = selection.toString();
  //
  // // 保留所有空格（包括&nbsp;）
  // text = text.replace(/\u00A0/g, ' '); // 将&nbsp;转换为普通空格
  //
  // e.clipboardData.setData('text/plain', text);
  // e.preventDefault();
}

const isGroup = computed(() => {
  return props.message?.message_type === 'group'
})

const messageHtml = computed(() => {
  return () => h(
    "div",
    parseMessage(props.message)
  );
});

const noticeHtml = computed(() => {
  return h(
    "div",
    parseNotice(props.message)
  );
});

const displayName = ref('');

const getDisplayName = () => {
  const message = props.message;
  if (!isGroup.value) {
    return
  }
  const id = [message.group_id, message.user_id];
  const type = CacheNameKey.GROUP_USER;
  const event = parseJSON(message.event);

  const sender = event?.sender

  // 初始值
  displayName.value = getCacheName(id, type) || sender?.nickname || sender?.remark || sender?.card || props.message.user_id

  // 异步更新
  fetchDisplayName(id, type, (newName) => {
    displayName.value = newName
  });
}

let currentActiveElement = null

// 检查点击目标是否有效
const isValidTarget = (target) => {
  // 排除.message-super-emoji-lottie及其子元素
  if (target.closest('.message-super-emoji-lottie')) {
    return false
  }

  // 目标必须是.message或其子元素
  return target.closest('.message') !== null
}

// 获取应该变灰的元素
const getDarknessTarget = (target) => {
  // console.log(target)
  if (target?.closest('.no-darkness-effect')) {
    return null
  }

  // 如果是普通img且没有.message-emoji-png类，返回img本身
  if (target.tagName === 'IMG' && !target.classList.contains('message-emoji-png') && !target.closest(".message-box-less")) {
    return target
  }

  // 如果是.message本身，返回它
  if (target.classList.contains('message')) {
    return target
  }

  const closetMessageParent = target.closest('.message')

  if (closetMessageParent) {
    return closetMessageParent
  }

  // 其他情况返回null
  return null
}

// 处理文档点击事件
const handleDocumentClick = (e) => {
  // 只处理左键(0)和右键(2)
  if (e.button !== 0 && e.button !== 2) return

  if (isValidTarget(e.target)) {
    const darkTarget = getDarknessTarget(e.target)

    if (darkTarget) {
      // 移除之前的效果
      if (currentActiveElement) {
        currentActiveElement.classList.remove('darkness-effect')
      }

      // 应用新效果
      darkTarget.classList.add('darkness-effect')
      currentActiveElement = darkTarget
    }
  } else {
    // 点击外部时移除效果
    if (currentActiveElement) {
      currentActiveElement.classList.remove('darkness-effect')
      currentActiveElement = null
    }
  }
}

const handleNoticePoke = () => {
  const user_id = props.message.user_id
  const group_id = props.message.group_id
  const target_id = props.message.target_id
  const message_type = props.message.message_type
  const is_group = isGroup.value
  const data = {
    user_id: is_group ? user_id : target_id,
    target_id: user_id
  }
  if (is_group) {
    data.group_id = group_id
  }
  fetchSendMessage({
    type: message_type,
    contact_id: is_group ? group_id : user_id
  }, [{
    type: 'poke',
    data: data
  }])
}

const showContactInfo = e => {
  const event = JSON.parse(props.message.event)
  emit("click-show-contact-info", e, { user_id: event.user_id, nickname: event.sender.nickname })
}

const handleAvatarDoubleClick = {
  doubleClick: handleNoticePoke,
  singleClick: showContactInfo
}

const settingEssence = ref(false)

const messagePlainTextContent = computed(() => {
  const message = parseJSON(props.message.event)?.message
  if (Array.isArray(message)) {
    return message.filter(item => item?.type === 'text' && item?.data?.text).map(item => item.data.text).join('\n')
  }
  return null
})

const isEnabledTranslate = ref(false);
const translatedText = ref(undefined)
const translateErrorText = ref(null)

const messageRecordSegment = computed(() => {
  const msg = parseJSON(props.message.event)?.message?.[0]
  if (msg?.type === 'record') {
    return msg
  }
  return false
})

const isEnabledPTT = ref(false);
const pttText = ref(undefined)
const pttErrorText = ref(null)

const customMessageContextMenu = () => {
  const self_info = currentGroupSelfInfo.value
  const sender_info = currentGroupUserInfo.value
  return formatBasicContextItems([
    basicContextItem(
      '英译中',
      async () => {
        isEnabledTranslate.value = true
        translateErrorText.value = translatedText.value = undefined
        try {
          translatedText.value = await fetchTranslateEnglish(messagePlainTextContent.value)
        } catch (e) {
          translateErrorText.value = e
          translatedText.value = null
          console.error("Translate error:", e)
        }
      },
      "translate_24",
      hasEnglish(messagePlainTextContent.value) && (!isEnabledTranslate.value || translateErrorText.value !== null)
    ),
    basicContextItem(
      '转文字',
      async () => {
        isEnabledPTT.value = true
        pttText.value = pttErrorText.value = undefined
        try {
          pttText.value = await fetchRecordToText(props.message.message_id)
        } catch (e) {
          pttErrorText.value = e
          pttText.value = null
          console.error("Record to text error:", e)
        }
      },
      "speech_to_text_16",
      messageRecordSegment.value && (!isEnabledPTT.value || pttErrorText.value !== null)
    ),
    basicContextItem('复制', () => {
      let copyAll = false
      const range = window.getSelection()?.getRangeAt(0)
      if (!messageContent.value?.contains(range?.commonAncestorContainer) || range?.collapsed) {
        copyAll = true
        const range = document.createRange();
        range.selectNode(messageContent.value);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      }
      try {
        const successful = document.execCommand('copy');
        successful ? showToast('success', '复制成功') : showToast('error', '复制失败');
      } catch (err) {
        console.error('无法复制文本: ', err);
        showToast('error', '复制失败')
      }
      if (copyAll) {
        window.getSelection().removeAllRanges();
      }
    }, "copy_24"),
    basicContextItem('转发', () => {
      const message = props.message
      const event = parseJSON(message.event);
      Emitter.emit('forward-single-msg', event.message_id, event.message)
    }, "one_by_one_forward_24"),
    basicContextItem('引用', () => {
      emit('quote-message', toRaw(props.message), isGroup.value ? {
        name: displayName.value,
        qq: props.message.user_id
      } : null)
    }, "quote_24"),
    basicContextItem(
      isEssence.value ? '移除精华' : '设为精华',
      async () => {
        if (settingEssence.value) {
          showToast('warning', '正在请求中，请勿重复操作')
        }
        let error_info
        try {
          const set = !isEssence.value
          settingEssence.value = true
          const result = await fetchChangeEssenceMsg(props.message.message_id, set)
          if (result.status === 'ok' && (!result?.data || result?.data?.result?.errorCode === 0)) {
            showToast('success', set ? '设置群精华成功' : "该消息已被移除群精华")
            const real_seq = props.message.real_seq
            if (set) {
              activeContact.value.essence_real_seq_list.push(real_seq)
            } else {
              activeContact.value.essence_real_seq_list = activeContact.value.essence_real_seq_list.filter(item => item !== real_seq)
            }
          } else {
            error_info = result
          }
        } catch (e) {
          error_info = e
        }
        if (error_info !== undefined) {
          console.error('改变群精华失败', error_info)
          showToast('error', error_info?.data?.result?.wording || '改变群精华失败')
        }
        settingEssence.value = false
      },
      "essence_message_24",
      ['owner', 'admin'].includes(self_info.role) &&
      (!isRecalled.value || !isEssence.value)
    ),
    contextDividedItem(),
    basicContextItem(
      '撤回', () => {
        fetchRecallMessage(props.message.message_id)
      },
      "recall_24",
      !isRecalled.value &&
      (
        isGroupOwner(self_info) ||
        (
          props.message.user_id === props.message.self_id &&
          (
            (Date.now() / 1000 - props.message.time <= 120) ||
            isGroupAdmin(self_info)
          )
        ) ||
        (
          !isGroupOperator(sender_info) &&
          isGroupAdmin(self_info)
        )
      )
    ),
  ]);
}

const isRecalled = computed(() => {
  const message = props.message
  const event = parseJSON(message.event);
  return 'recall_operator' in event
})

const isEssence = computed(() => {
  return activeContact.value?.essence_real_seq_list?.includes(props.message.real_seq)
})

const isSecretEmoji = computed(() => {
  const message = props.message
  const event = parseJSON(message.event);
  if (event?.message?.length === 1) {
    const item = event.message[0];
    if (item.type === 'face') {
      return global.secretEmojiids.includes(String(item.data.id))
    }
  }
  return false
})

const scrollToMidwayMsg = inject('scrollToMidwayMsg')
const findMessage = inject('findMessage')

const handleNoticeExecuteCommand = e => {
  const element = e.target?.closest('.notice-execute-command')
  if (element) {
    const command = element.dataset.command
    if (isString(command)) {
      const jumpToMsg = 'jump-to-msg-'
      const openEssence = 'open-essence-window'
      const viewUserInfo = 'view-user-info-'
      if (command.startsWith(jumpToMsg)) {
        const msg = element.jumpToMsg
        if (msg === undefined) {
          showToast('warning', '正在获取消息中，请等待')
        } else if (msg === null) {
          showToast('error', '找不到消息')
        } else {
          scrollToMidwayMsg(msg)
        }
      } else if (command === openEssence) {
        emit('change-show-essence-list')
      } else if (command.startsWith(viewUserInfo)) {
        emit("click-show-contact-info", e, command.substring(viewUserInfo.length))
      }
    }
  }
}

const handleMessageExecuteCommand = e => {
  const element = e.target?.closest('.message-execute-command')
  if (element) {
    const command = element.dataset.command
    if (isString(command)) {
      const atSomebody = 'at-somebody'
      const showGroupNotice = 'show-group-notice'
      if (command === atSomebody) {
        Emitter.emit("input-at-somebody", element.dataset.userId, element.dataset.displayName)
      } else if (command === showGroupNotice) {
        emit("change-show-group-notice")
      }
    }
  }
}

const openImageViewer = inject("openImageViewer")
const openVideoPlayer = inject("openVideoPlayer")

const handleMessageDoubleClick = e => {
  const target = e?.target
  if (isFunction(target?.closest)) {
    const img = target.closest('.message-image')
    if (img) {
      const src = img.dataset.src
      if (src) {
        openImageViewer(src)
      }
    }
    const video = target.closest('.message-video')
    if (video) {
      const src = video.dataset.src
      if (src) {
        openVideoPlayer(src)
      }
    }
  }
}

const currentGroupUserInfo = computed(() => findGroupUser(props.message.user_id))
const currentGroupSelfInfo = computed(() => findGroupUser(props.message.self_id))

const findGroupUser = user_id => groupUsers.value?.find(user => user.user_id === user_id)

const flattenContacts = inject('flattenContacts')
const selectContact = inject("selectContact")

const customAvatarContextMenu = () => {
  const user_id = props.message.user_id
  const group_id = props.message.group_id
  const userContact = {
    contact_id: user_id,
    type: 'private'
  }
  const user = currentGroupUserInfo.value
  const self = currentGroupSelfInfo.value
  const hasBeenMuted = !!self.shut_up_timestamp
  const operatePermission = hasGroupMemberOperatePermission(self, user)
  const muteFunc = duration => (async () => {
    const result = await fetchSetGroupMute(group_id, user_id, duration)
    const operation = (duration === 0 ? "解除" : "") + "禁言"
    if (checkResponseOK(result)) {
      showSuccessToast(operation + "成功")
    } else {
      console.error(operation + "失败", result)
      showErrorToast(operation + "失败:" + result?.message)
    }
  })
  return formatBasicContextItems([
    basicContextItem(
      '发送消息',
      () => selectContact(userContact),
      'message_24',
      Boolean( // undefined 自动取默认值
        !checkSameContact(userContact, activeContact.value) &&
        flattenContacts.value?.find?.(
          contact => checkSameContact(contact, userContact
          ))
      )
    ),
    basicContextItem(
      'TA',
      () => Emitter.emit("input-at-somebody", user_id, displayName.value),
      'at_24',
      isGroup.value
    ),
    basicContextItem(
      '戳一戳',
      handleNoticePoke,
      'poke_24'
    ),
    basicContextItem(
      '查看资料',
      e => {
        const el = avatarElement.value
        if (el) {
          const pos = getElementCenter(el)
          showContactInfo({
            clientX: pos.x,
            clientY: pos.y
          })
        } else {
          showContactInfo(e)
        }
      },
      'files_24'
    ),
    contextDividedItem(),
    basicContextItem(
      '移出本群',
      async () => {
        if (await showConfirmBox('温馨提醒', '确定将该成员从本群聊中移除吗？')) {
          if ((await fetchKickGroupUser(group_id, user_id))?.status === 'ok') {
            showSuccessToast('已移出本群')
          } else {
            showErrorToast('移出本群失败')
          }
        }
      },
      'remove_user_24',
      isGroup.value && operatePermission
    ),
    basicContextItem(
      "设置群内禁言",
      [
        basicContextItem(
          "10 分钟",
          muteFunc(60 * 10)
        ),
        basicContextItem(
          "1 小时",
          muteFunc(60 * 60)
        ),
        basicContextItem(
          "12 小时",
          muteFunc(12 * 60 * 60)
        ),
        basicContextItem(
          "1 天",
          muteFunc(24 * 60 * 60)
        ),
        basicContextItem(
          "自定义时长",
          async () => {
            const duration = await showPromptBox(
              "设定禁言时长",
              `设定 ${user.nickname} 的禁言时长，不能超过 30 天，单位为秒：`,
              "1800",
              ""
            )
            if (duration !== null) {
              await muteFunc(Math.min(parseInt(duration), 30 * 24 * 60 * 60))()
            }
          }
        ),
      ],
      'message_off_24',
      isGroup.value && operatePermission
    ),
    basicContextItem(
      "解除禁言",
      muteFunc(0),
      'message_off_24',
      isGroup.value && operatePermission && hasBeenMuted
    )
  ])
}

const avatarElement = ref(null)

const avatarFrameUrl = computed(() => getUserAvatarFrameCache(props.message?.user_id))

// 组件加载时
onMounted(() => {
  document.addEventListener('mouseenter', handleMouseEnter, { capture: true })
  document.addEventListener('mouseleave', handleMouseLeave, { capture: true })
  document.addEventListener('mousedown', handleDocumentClick)
  if (noticeContainer.value) {
    const jumpToMsgCommands = noticeContainer.value.querySelectorAll('[data-command^="jump-to-msg-"]')
    if (jumpToMsgCommands) {
      jumpToMsgCommands.forEach(async element => {
        const message_id = parseInt(element.dataset.command.substring("jump-to-msg-".length))
        if (message_id) {
          try {
            const msg = await findMessage(message_id)
            if (msg) {
              element.jumpToMsg = msg
              return
            }
            console.error('没有获取到跳转的消息:', message_id)
          } catch (e) {
            console.error('获取跳转的消息出错:', message_id, e)
          }
        }
        element.jumpToMsg = null
      })
    }
  }
  getDisplayName()
})

// 组件卸载时
onUnmounted(() => {
  document.removeEventListener('mouseenter', handleMouseEnter, { capture: true })
  document.removeEventListener('mouseleave', handleMouseLeave, { capture: true })
  document.removeEventListener('mousedown', handleDocumentClick)

  // 清除可能存在的定时器
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
})
</script>

<template>
  <div class="time-notice notice-container" v-if="showTimeNotice">
    <div class="notice">{{ formatRelativeTime(message.time * 1000, true) }}</div>
  </div>
  <div
    class="notice-container"
    v-if="message.post_type === 'notice'"
    @click="handleNoticeExecuteCommand"
    ref="noticeContainer"
  >
    <notice-html class="notice no-user-select"/>
  </div>
  <div
    v-else
    class="message-container"
    :class="[
      message.self_id === message.user_id ? 'message-out' : 'message-in' ,
      isGroup ? 'group' : 'private',
      { recalled: isRecalled }
    ]"
  >
    <div
      :data-has-frame="!!avatarFrameUrl"
      :style="{
        '--avatar-frame-url': `url(${avatarFrameUrl})`
      }"
      class="message-avatar-container">
      <img
        class="message-avatar"
        alt=""
        :src="getUserLogo(message.user_id)"
        v-double-click="handleAvatarDoubleClick"
        v-custom-menu="customAvatarContextMenu"
        ref="avatarElement"
      />
    </div>
    <div class="message-msg-side">
      <div class="message-before">
        <div class="message-name-title" v-if="isGroup">
          <span class="message-name-title-display-name">{{ displayName }}</span>
          <GroupLevelTitle :userInfo="currentGroupUserInfo"/>
        </div>
        <span class="message-send-time">{{ formatTime(message) }}</span>
      </div>
      <div
        class="message"
        v-custom-menu="customMessageContextMenu"
        @copy="handleCopy"
        ref="messageContent"
        @click="handleMessageExecuteCommand"
        v-double-click="handleMessageDoubleClick"
      >
        <message-html/>
      </div>
      <div class="message-extensions">
        <div v-if="isEnabledTranslate" class="message-ext-content">
          <template v-if="translatedText">
            {{ translatedText }}
          </template>
          <LoadingSpinner no-text v-else-if="translatedText === undefined" :size="20"/>
          <span v-else-if="translateErrorText" style="color: red;">{{ translateErrorText }}</span>
          <template v-else>翻译无结果</template>
        </div>
        <div v-if="isEnabledPTT" class="message-ext-content">
          <template v-if="pttText">
            {{ pttText }}
          </template>
          <LoadingSpinner no-text v-else-if="pttText === undefined" :size="20"/>
          <span v-else-if="pttErrorText" style="color: red;">{{ pttErrorText }}</span>
          <template v-else>[呃，什么都没有听到]</template>
        </div>
      </div>
      <div class="message-tips no-user-select">
        <div class="message-red-tip message-tip" v-if="isRecalled">
          <QIcon name="recall_24"/>
          已撤回
        </div>
        <div class="message-tip" v-if="isEssence" @click="emit('change-show-essence-list')">
          <img alt="" :src="qqAppImg('essence.bbb878de5480c01292f5.svg')">
          精华
        </div>
        <div class="message-tip" v-if="isSecretEmoji">
          隐藏表情
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.message-container {
  @extend %message-container;
}

.message {
  @extend %message-bubble;
}

.message-extensions {
  @extend %flex-column;
  margin: 0 8px;
  align-items: flex-start;
}

.message-ext-content {
  @include card($radius-card);
  padding: 5px 8px;
  font-size: 85%;
  margin: 5px 0;
  direction: ltr;
  word-break: break-all;
  text-align: left;
}

.message-tips {
  display: flex;
  justify-self: start;
  padding: 1px 9px;
  gap: 5px;
}

.message-tip {
  background-color: $color-bg-tip;
  border-radius: $radius-sm;
  color: $color-text-muted;
  font-size: 12px;
  height: 24px;
  margin-top: 4px;
  padding: 0 6px;
  align-items: center;
  @include flex-center;
  direction: ltr;

  img, &:deep(svg) {
    width: 12px;
    height: 12px;
    margin-right: 2px;
  }
}

.message-red-tip {
  color: $color-text-red-tip;
  background-color: $color-bg-red-tip;

  &:deep(svg) {
    color: $color-text-red-tip-icon;
  }
}

.message-before {
  font-size: 13px;
  color: $color-text-muted !important;
  margin: 0 8px;
  height: 24px;
  white-space: nowrap;
}

.message-in .message-before {
  direction: ltr;
}

.message-out .message-before {
  direction: rtl;
}

.message-before .message-send-time {
  direction: ltr;
  display: inline-block;
}

.message-in {
  direction: ltr;
  text-align: left;
}

.message-out {
  direction: rtl;
  text-align: right;
}

.message-in .message {
  @include message-bubble-in;
}

.message-out .message {
  @include message-bubble-out;
}

.message-in .message-avatar {
  margin-left: 20px;
}

.message-out .message-avatar {
  margin-right: 20px;
}

@include small-mobile {
  .message-in .message-avatar {
    margin-left: 10px;
  }

  .message-out .message-avatar {
    margin-right: 10px;
  }
}

.group .message-avatar {
  margin-top: 4px;
}

.message-avatar-container[data-has-frame] {
  position: relative;

  &::after {
    @include after-avatar-frame(35px);
  }
}

.message-in .message-avatar-container[data-has-frame]::after {
  right: 0;
  left: unset;
}

.private .message-avatar {
  margin-top: 20px;
}

.message-avatar {
  @extend %avatar-msg;
}

.message-name-title {
  display: inline-block;
  margin: 0 0 4px 0;

  &:deep(.message-name-title-display-name) {
    direction: ltr;
    display: inline-block;
  }
}

.message-in .message-name-title {
  direction: ltr;
  margin-right: 5px;
}

.message-out .message-name-title {
  direction: rtl;
  margin-left: 5px;
}

.message-msg-side {
  max-width: calc(100% - 140px);
}

@include small-mobile {
  .message-msg-side {
    max-width: 70%;
  }
}

.message-send-time {
  opacity: 0;
}

.message:deep(.message-super-emoji-lottie) {
  height: 125px;
  max-width: 200px;
}

.message:deep(.message-emoji-png),
.message:deep(.msg-preview-emoji),
.notice:deep(.msg-preview-emoji),
.message-name-title:deep(.msg-preview-emoji) {
  height: 17px;
  position: relative;
  top: -2px;
}

.message-name-title:deep(.msg-preview-emoji) {
  top: 0;
}

.message:has(.message-markdown-box) {
  padding: 10px 9px;
  width: min(80%, 430px);
  max-width: 430px;
}

.message:has(.audio-message) {
  padding: 0 2px;
}

.message:has(.message-box-less) {
  background: #00000000 !important;
  overflow: hidden;
  padding: 0;
}

.message:deep(.at-somebody-link) {
  cursor: pointer;
}

.message:deep(.message-image), .message:deep(.message-video) {
  @include media-reset;

  img, video {
    border-radius: $radius-btn;
  }
}

.message:has(.message-emoji-picture) {
  max-width: 185px;
}

.message:deep(.message-box-less.message-image) {
  margin: unset;
}
</style>

<style>
.darkness-effect.message-box-less.message-image {
  backdrop-filter: brightness(100%); /* 背景变暗 */
}

.darkness-effect {
  filter: brightness(90%);
}

.show-message-time .message-send-time {
  opacity: 1;
}
</style>

<style scoped lang="scss">
.notice-container {
  height: 50px;
  @extend %flex-row;
  justify-content: center;
  align-items: center;
}

.notice {
  display: inline-block;
  border-radius: $radius-notice;
  background-color: $color-bg-notice;
  padding: 2px 8px;
  font-size: 12px;
  color: $color-text-muted;
  white-space: nowrap;

  &:deep(.notice-emoji-png) {
    height: 15px;
    margin: -2px 1px 0 1px;
  }

  &:deep(.notice-execute-command) {
    color: $color-text-record-cancel;
    cursor: pointer;
    text-decoration: none;
  }
}
</style>