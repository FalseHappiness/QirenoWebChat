<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import MessageItem from './Message/MessageItem.vue'
import {
  checkResponseOK, fetchDeleteFriend,
  fetchGroupNotice, fetchLeaveGroup,
  fetchMsg, fetchSetGroupAllMuted,
  fetchSetGroupMemberCard, getGroupLogo, getUserLogo
} from "@/scripts/backend-api.js";
import PageScroller from "../../Common/Scrolling/PageScroller.vue";
import SimpleBarCore from "simplebar";
import 'simplebar/dist/simplebar.min.css';
import MessageInputBox from "./Input/MessageInputBox.vue";
import { useGlobalStore } from "@/store/global.js";
import { parseJSON } from "@/scripts/util.js";
import Tooltip from "../../Common/Overlay/Tooltip.vue";
import { Emitter } from "@/composables/useEventBus.js";
import GroupAnnounceViewer from "./Group/GroupAnnounceViewer.vue";
import EnterArrow from "../../Common/Widgets/EnterArrow.vue";
import GroupEssenceMsgViewer from "./Group/GroupEssenceMsgViewer.vue";
import GroupFilesViewer from "./Group/GroupFilesViewer.vue";
import GroupAlbumViewer from "./Group/GroupAlbumViewer.vue";
import { qqAppImg } from "@/composables/useBase.js";
import CustomScrollBar from "../../Common/Scrolling/CustomScrollBar.vue";
import ImageViewer from "../../Common/Media/ImageViewer.vue";
import { isEmptyObject, isNumber, isObject, isString } from "@/scripts/types-util.js";
import VideoPlayer from "../../Common/Media/VideoPlayer.vue";
import QIcon from "../../Common/Icons/QIcon.vue";
import { getContactNameRef, getGroupInfoCacheFromAll, isGroupOperator } from "@/scripts/user-info-util.js";
import GroupSignView from "@/components/Destination/Chat/Group/GroupSignView.vue";
import { checkSameContact } from "@/scripts/contacts-util.js";
import { Switch as ASwitch } from "ant-design-vue";
import { showConfirmBox } from "@/scripts/popup-box-api.js";
import { showErrorToast, showSuccessToast } from "@/scripts/toast.js";

const activeContact = inject("activeContact")
const selfInfo = inject("selfInfo")
const selectContact = inject("selectContact")

const scroller = ref(null)
const inputer = ref(null)

const displayName = ref('') // 使用ref来管理名称状态
const isError = ref(false) // 错误状态
// const isTempSession = ref(false)
const showContactMore = ref(false)
const chatAreaContactMore = ref(null)

const handleChatAreaClick = e => {
  const target = e?.target
  if (target) {
    if (!chatAreaContactMore.value?.$el?.contains(target) && !target.closest?.('.chat-area-ctrl-show-more')) {
      showContactMore.value = false;
    }
  }
}

const getName = async () => {
  await getContactNameRef(activeContact.value, displayName, isError)
}

const tempSession = computed(() => {
  if (activeContact.value) {
    if (activeContact.value.latest_msg) {
      let event = activeContact.value.latest_msg;
      event = parseJSON(event);
      return event.message_type === 'private' && event.sub_type === 'group' ? "临时会话" : ""
    }
  }
})

const groupUsers = inject("groupUsers")
const getMessages = inject("getMessages")

const getMessagesWrapped = async (msg, count, include = false, direction = 'next') => {
  const post_type = msg?.post_type || 'message'
  const notice_message = post_type === 'notice'
  const cursor_time = msg?.time || null
  const cursor = notice_message ? msg.id : msg?.real_seq
  return await getMessages(
    msg?.message_id || (notice_message ? null : 0),
    cursor,
    count,
    include,
    direction,
    cursor_time,
    msg?.notice_before_cursor,
    msg?.notice_after_cursor,
    notice_message
  )
}

const getNewerMessages = async (msg, _, count, include) => {
  return await getMessagesWrapped(msg, count, include, 'next')
}

const getOlderMessages = async (msg, _, count, include) => {
  return await getMessagesWrapped(msg, count, include, 'prev')
}

const getMsgId = msg => {
  return `${msg?.id}_${msg?.real_seq}_${msg?.time}`
}

const detectMsgCursor = (msg, key) => {
  const cursor = activeContact.value[key]
  if (cursor) {
    if (msg[cursor.type] === cursor.value) {
      return true
    }
  }
  return false
}

const detectIsLatestMsg = msg => {
  return detectMsgCursor(msg, 'max_cursor')
}

const detectIsOldestMsg = msg => {
  return detectMsgCursor(msg, 'min_cursor')
}

// 防止通过 NapCat 接口获取的 message 没有存到数据库所以设置 current.notice_before_message current.notice_before_message
const handleVisibleMessagesLoadMore = visibleMessages => {
  const max_cursor = activeContact.value.max_cursor
  const min_cursor = activeContact.value.min_cursor
  const check_max_cursor = max_cursor && max_cursor.type === 'id'
  const check_min_cursor = min_cursor && min_cursor.type === 'id'
  // 遍历所有消息
  for (let i = 0; i < visibleMessages.length; i++) {
    const current = visibleMessages[i];

    // 只处理 post_type 为 notice 的项
    if (current.post_type === 'notice') {
      // 如果 notice_before_message 未设置或为 -1，查找前面的最近 real_seq
      if ([null, undefined].includes(current.notice_before_message) || current.notice_before_message === -1) {
        // 向前查找最近的 real_seq
        for (let j = i - 1; j >= 0; j--) {
          const prevItem = visibleMessages[j];
          if (prevItem.real_seq !== undefined) {
            current.notice_before_message = prevItem.real_seq;
            break;
          } else if (check_min_cursor && prevItem.id === min_cursor.value) {
            // 最旧
            current.notice_before_message = 0
            break;
          }
        }
      }

      // 如果 notice_after_message 未设置或为 -1（之后消息可能更新，所以始终查找），查找后面的最近 real_seq
      // if ([null, undefined].includes(current.notice_after_message) || current.notice_after_message === -1) {
      // 向后查找最近的 real_seq
      for (let j = i + 1; j < visibleMessages.length; j++) {
        const nextItem = visibleMessages[j];
        if (nextItem.real_seq !== undefined) {
          current.notice_after_message = nextItem.real_seq;
          break;
        } else if (check_max_cursor && nextItem.id === max_cursor.value) {
          // 最新
          current.notice_after_message = 0
          break;
        }
      }
      // }
    }
  }

  return visibleMessages;
}

const handleScrollerMounted = async () => {
  // 等待组件完全渲染
  await nextTick();

  // 获取内部元素
  const chatWrapper = scroller?.value?.$refs?.chatWrapper

  if (chatWrapper) {
    new SimpleBarCore(chatWrapper, { autoHide: false })

    scroller.value.changeWrapperElement(chatWrapper.querySelector('.simplebar-content-wrapper'))

    /*

    // 处理图片加载时高度变化导致布局抖动
    // 创建MutationObserver来监听新增的图片
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // 遍历所有新增的节点（包括嵌套的）
        mutation.addedNodes.forEach((node) => {
          // 如果节点是元素（而非纯文本等），检查它及其子节点是否有图片
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查当前节点是否是图片
            if (node.classList.contains('message-image') || node.classList.contains('message-video')) {
              observeImageResize(node);
            }
            // 检查所有子节点中的图片（递归或querySelectorAll）
            const images = node.querySelectorAll('.message-image, .message-video');
            images.forEach(img => observeImageResize(img));
          }
        });
      });
    });

    const saveImageSize = (img, currentSize) => {
      if (currentSize === undefined) {
        const rect = img.getBoundingClientRect()
        img.beforeSize = img.currentSize = {
          width: rect.width,
          height: rect.height
        }
        img.heightDifference = 0
      } else {
        const beforeSize = img.beforeSize = img.currentSize
        img.currentSize = {
          width: currentSize.width,
          height: currentSize.height
        }
        let scalingRate = currentSize.width / beforeSize.width
        if (scalingRate === Infinity) {
          scalingRate = 1
        }
        img.heightDifference = currentSize.height - beforeSize.height * scalingRate
      }
    }

    const handleImageResize = async (img) => {
      const difference = img?.heightDifference | 0
      // console.log(scroller?.value?.wrapperScrollOffset().bottom, difference)
      // if (scroller?.value?.wrapperScrollOffset().bottom - difference < 10) {
      //   await nextTick()
      //   scroller?.value?.scrollToVisibleBottom()
      // }
      if (scroller?.value?.wrapper) {
        scroller.value.wrapper.scrollTop += difference
      }
    }

    // 创建ResizeObserver来监听图片尺寸变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // console.log('图片高度变化:', entry.target.src, entry.contentRect.height, entry.target.beforeHeight);
        const img = entry.target
        saveImageSize(img, entry.contentRect)
        handleImageResize(img)
      }
    });

    // 观察图片尺寸变化
    function observeImageResize(img) {
      if (!img.complete) {
        saveImageSize(img)
        resizeObserver.observe(img);
        img.addEventListener('load', function () {
          handleImageResize(img)
          resizeObserver.unobserve(img)
        })
        img.addEventListener('error', () => {
          handleImageResize(img)
          console.log('图片加载失败:', img.src);
          // resizeObserver.unobserve(img);
          const fallbackLink = img.dataset.fallbackLink
          const originalLink = img.dataset.originalLink
          if (originalLink || !fallbackLink) {
            console.log('图片彻底加载失败:', originalLink || img.src, fallbackLink)
          } else if (fallbackLink) {
            img.dataset.originalLink = img.src
            img.src = fallbackLink
          }
        })
      }
    }

    // 开始观察容器内的子节点变化
    mutationObserver.observe(chatWrapper, {
      childList: true,
      subtree: true
    });

    // 观察已存在的图片
    chatWrapper.querySelectorAll('.message-image, .message-video').forEach(img => {
      observeImageResize(img);
    });

     */
  }
}

// 消息间隔超过5分钟显示时间提示
const isShowTimeTip = (old_msg, new_msg) => {
  const old_time = old_msg?.time || 0;
  const new_time = new_msg?.time || 0;
  return new_time - old_time > 300
}

provide("visibleMessages", () => {
  return scroller?.value?.visibleMessages
})

provide("scrollToMidwayMsg", (info) => {
  scroller?.value?.scrollToMidwayButton(info, true)
})

const quoteMessage = (msg, user) => {
  inputer?.value?.handleQuoteMessage(msg)
  if (user) {
    inputer?.value?.insertAtUserAtCursor(user)
  }
}

const findMessage = async (message_id) => {
  const vm = scroller?.value?.visibleMessages
  let msg;
  if (vm && Array.isArray(vm)) {
    msg = vm.find(
      item => item.message_id === parseInt(message_id) && ['message', 'message_sent'].includes(item.post_type)
    )
  }
  if (!msg || isEmptyObject(msg)) {
    msg = await fetchMsg(message_id)
  }
  return msg
}

useGlobalStore().findMessage = msg_id => findMessage(msg_id)

provide("findMessage", msg_id => findMessage(msg_id))


const isGroup = computed(() => {
  return activeContact.value?.type === 'group';
})

const groupNotifications = ref(null);

const latestGroupNoticeMsg = computed(() => {
  return groupNotifications.value?.[0]?.message;
})

const getGroupNotice = async () => {
  groupNotifications.value = await fetchGroupNotice(activeContact.value.contact_id);
}

const groupSelfInfo = computed(() => groupUsers.value?.find(user => user.user_id === selfInfo.value?.user_id));

watch(() => groupSelfInfo.value, newVal => {
  if (newVal != null) {
    groupSelfCardModel.value = newVal.card
  }
})

const groupSelfCardModel = ref(null);
const groupRemarkModel = ref(null);

const handleGroupSelfCardChange = async () => {
  if (groupSelfCardModel.value !== groupSelfInfo?.value?.card) {
    await fetchSetGroupMemberCard(activeContact.value.contact_id, selfInfo.value.user_id, groupSelfCardModel.value)
  }
}

const changeGroupContactRemark = inject("changeGroupContactRemark")

const handleGroupRemarkChange = () => {
  if (groupRemarkModel.value !== activeContact.value?.remark) {
    changeGroupContactRemark(activeContact.value.contact_id, groupRemarkModel.value)
  }
}

const handleEnterBlur = (e) => {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    e.target.blur()
  }
}

const showContactInfo = inject("showContactInfo")

const handleClickShowContactInfo = (e, user_id) => {
  let group_user, user, group;
  if (user_id) {
    let nickname;
    if (isObject(user_id)) {
      ({
        nickname, user_id
      } = user_id)
    }
    if (isString(user_id)) {
      user_id = Number.parseInt(user_id)
    }
    if (isGroup?.value) {
      group_user = {
        nickname,
        ...groupUsers.value?.find(user => user.user_id === user_id),
        user_id,
        group_id: activeContact.value.contact_id
      }
    } else {
      user = {
        user_id,
        nickname
      }
      if (user.user_id === activeContact.value.contact_id) {
        ({
          real_name: user.nickname,
          remark: user.remark
        } = activeContact.value)
      }
    }
  } else {
    if (isGroup?.value) {
      group = {
        group_id: activeContact.value?.contact_id,
        group_name: activeContact.value?.real_name,
        group_remark: activeContact.value?.remark
      }
    } else {
      user = {
        user_id: activeContact.value?.contact_id,
        nickname: activeContact.value?.real_name,
        remark: activeContact.value?.remark
      }
    }
  }
  showContactInfo({
    group_user, user, group,
    position: { x: e.clientX, y: e.clientY },
  })
}

const createChangeView = refVar => {
  return (isShow = true) => {
    refVar.value = isShow;
  }
}

const selfGroupOperator = computed(() => isGroupOperator(groupSelfInfo.value))

const groupNameModel = ref(null)

const changeGroupContactName = inject("changeGroupContactName")

const handleGroupNameChange = () => {
  if (groupNameModel.value !== activeContact.value?.remark) {
    changeGroupContactName(activeContact.value.contact_id, groupNameModel.value)
  }
}

const transGroupAllMuted = (value, toBool = true) => toBool ? value === -1 : (value ? -1 : 0)

const groupAllMutedModel = ref(null)

const currenGroupAllMuted = () => getGroupInfoCacheFromAll(activeContact.value?.contact_id)?.group_all_shut

watch(currenGroupAllMuted, val => {
  if (isNumber(val)) {
    groupAllMutedModel.value = transGroupAllMuted(val)
  }
})

const handleGroupAllMutedChange = checked => {
  if (groupAllMutedModel.value !== transGroupAllMuted(currenGroupAllMuted())) {
    fetchSetGroupAllMuted(activeContact.value.contact_id, checked)
  }
}

const handleLeaveGroup = async () => {
  if (await showConfirmBox("退出群聊", "退出后不会通知群聊中其他成员，且不会再接受此群消息。")) {
    const group_id = activeContact.value.contact_id
    const result = await fetchLeaveGroup(group_id)
    if (checkResponseOK(result)) {
      showSuccessToast("退出成功")
    } else {
      console.error("Leave group error:", group_id, result)
      showErrorToast("退群失败: " + result?.message)
    }
  }
}

const friendRemarkModel = ref(null)
const changeFriendContactRemark = inject("changeFriendContactRemark")
const handleChangeFriendRemark = () => {
  if (friendRemarkModel.value !== activeContact.value?.remark) {
    changeFriendContactRemark(activeContact.value?.contact_id, friendRemarkModel.value)
  }
}

const handleDeleteFriend = async () => {
  if (await showConfirmBox("确定删除该好友吗？")) {
    const user_id = activeContact.value.contact_id
    const result = await fetchDeleteFriend(user_id)
    if (checkResponseOK(result)) {
      showSuccessToast("已删除")
    } else {
      console.error("Leave group error:", user_id, result)
      showErrorToast("删除好友失败: " + result?.message)
    }
  }
}

const showGroupAnnounceViewer = ref(false);
const changeShowGroupAnnounce = createChangeView(showGroupAnnounceViewer)

const showGroupEssenceListViewer = ref(false);
const changeShowGroupEssenceList = createChangeView(showGroupEssenceListViewer)

const showGroupFilesViewer = ref(false)
const changeShowGroupFiles = createChangeView(showGroupFilesViewer)

const showGroupAlbumViewer = ref(false)
const changeShowGroupAlbum = createChangeView(showGroupAlbumViewer)

const showGroupSignView = ref(false)
const changeShowGroupSign = createChangeView(showGroupSignView)

const initContactInfo = () => {
  // 组件挂载时获取名称
  getName()
  if (isGroup.value) {
    groupRemarkModel.value = activeContact.value?.remark;
    groupNameModel.value = activeContact.value?.real_name
    getGroupNotice()
    Emitter.on("show-group-notices", changeShowGroupAnnounce)
  } else {
    friendRemarkModel.value = activeContact.value?.remark
  }
}

// 内部状态
const visibleStatusText = ref(false)
const peerStatusText = ref('')
let peerStatusTimer = null
const SHOW_DURATION = 3000 // 默认3秒消失

// 核心方法：供父组件调用，刷新提示+重置倒计时
const refreshPeerStatus = (text) => {
  clearPeerStatus()
  peerStatusText.value = text
  visibleStatusText.value = true

  // 重新计时3秒，超时隐藏
  peerStatusTimer = setTimeout(() => {
    visibleStatusText.value = false
  }, SHOW_DURATION)
}

const clearPeerStatus = () => {
  // 清除上一次倒计时
  clearTimeout(peerStatusTimer)
  visibleStatusText.value = false
}

const imageViewer = ref(null)
provide("openImageViewer", src => {
  imageViewer.value?.open?.(src)
})

const videoPlayer = ref(null)
provide("openVideoPlayer", src => {
  videoPlayer.value?.open?.(src)
})

// 联系人更改时获取名称
watch(() => activeContact.value, (newVal, oldVal) => {
  if (newVal?.name) {
    displayName.value = newVal.name
  }
  if (!checkSameContact(newVal, oldVal)) {
    showGroupAnnounceViewer.value = false
    showContactMore.value = false
    clearPeerStatus()
    initContactInfo();
  }
}, { deep: true })

onMounted(initContactInfo)
onUnmounted(() => {
  Emitter.off("show-group-notices")
})

// 暴露方法给父组件调用
defineExpose({
  refreshPeerStatus,
})
</script>

<template>
  <div class="chat-area" @click="handleChatAreaClick">
    <GroupAnnounceViewer
      v-if="showGroupAnnounceViewer && isGroup"
      :group_id="activeContact?.contact_id"
      :notices="groupNotifications || []"
      @close="() => changeShowGroupAnnounce(false)"
    />
    <GroupEssenceMsgViewer
      v-if="showGroupEssenceListViewer && isGroup"
      @close="() => changeShowGroupEssenceList(false)"
    />
    <GroupFilesViewer
      v-if="showGroupFilesViewer && isGroup"
      :group_id="activeContact?.contact_id"
      @close="() => changeShowGroupFiles(false)"
    />
    <GroupAlbumViewer
      v-if="showGroupAlbumViewer && isGroup"
      :group_id="activeContact?.contact_id"
      @close="() => changeShowGroupAlbum(false)"
    />
    <ImageViewer ref="imageViewer"/>
    <VideoPlayer ref="videoPlayer"/>
    <GroupSignView
      v-if="showGroupSignView && isGroup"
      @close="() => changeShowGroupSign(false)"
    />

    <div v-if="activeContact" class="border-bottom chat-area-head">
      <span class="chat-area-head-name" :class="{'text-error': isError}">
        <QIcon class="chat-area-go-back-btn" name="arrow_left_24"
               @click="() => { showContactMore ? showContactMore = false : selectContact(null) }"/>
        <span class="chat-area-head-display-name" @click="handleClickShowContactInfo">{{ displayName }}</span>
        <template> v-if="tempSession"
          <span>&nbsp;</span>
          <small class="text-muted font-size-100">
            {{ tempSession }}
          </small>
        </template>
        <template v-if="visibleStatusText">
          <span class="text-muted font-size-100">&nbsp;{{ peerStatusText }}</span>
        </template>
      </span>
      <span class="chat-area-head-control">
        <Tooltip
          content="更多"
          use-target-slot
          placement="bottom"
        >
          <template #target>
            <QIcon
              name="more_24"
              class="chat-area-head-control-btn chat-area-ctrl-show-more"
              @click="showContactMore = !showContactMore"/>
          </template>
        </Tooltip>
      </span>
    </div>

    <CustomScrollBar v-if="activeContact" class="chat-area-contact-more" ref="chatAreaContactMore"
                     :style="{ right: showContactMore ? '0' : '-100%' }">
      <template v-if="isGroup">
        <div class="chat-area-contact-more-area chat-area-contact-info">
          <img
            :src="getGroupLogo(activeContact.contact_id)"
            alt=""
            class="chat-area-contact-logo">
          <div class="overflow-ellipsis">
            <span :title="displayName">{{ displayName }}</span>
            <br>
            <small>{{ activeContact.contact_id }}</small>
          </div>
        </div>

        <div class="chat-area-contact-more-area">
          群聊成员
        </div>

        <label
          v-if="selfGroupOperator && isString(groupNameModel)"
          class="chat-area-contact-more-area with-title input-content"
          data-title="群聊名称">
          <input v-model="groupNameModel"
                 @blur="handleGroupNameChange"
                 @keydown="handleEnterBlur"
                 type="text"
                 placeholder="填写群名称">
        </label>

        <div class="chat-area-contact-more-area container-inline-size">
          群应用
          <div class="group-applications-list">
            <div @click="changeShowGroupFiles()" class="group-app-list-app-container">
              <QIcon name="filelook_folder_16" class="group-app-icon"/>
              群文件
            </div>
            <div @click="changeShowGroupAlbum()" class="group-app-list-app-container">
              <QIcon name="image_24" class="group-app-icon" style="color: var(--color-primary);"/>
              群相册
            </div>
            <div @click="changeShowGroupEssenceList()" class="group-app-list-app-container">
              <img alt="" :src="qqAppImg('essence.bbb878de5480c01292f5.svg')" class="group-app-icon"/>
              群精华
            </div>
            <div @click="changeShowGroupSign()" class="group-app-list-app-container">
              <QIcon name="calendar_24" class="group-app-icon"/>
              群打卡
            </div>
          </div>
        </div>

        <div class="chat-area-contact-more-area with-title display-flex cursor-pointer" data-title="群公告"
             @click="changeShowGroupAnnounce()">
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
          class="chat-area-contact-more-area with-title input-content"
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
          class="chat-area-contact-more-area with-title input-content"
          data-title="群聊备注">
          <input v-model="groupRemarkModel"
                 @blur="handleGroupRemarkChange"
                 @keydown="handleEnterBlur"
                 type="text"
                 placeholder="填写备注">
        </label>

        <div
          v-if="selfGroupOperator"
          class="chat-area-contact-more-area with-title display-flex cursor-pointer"
          data-title="发言权限">
          全员禁言
          <ASwitch v-model:checked="groupAllMutedModel" @change="handleGroupAllMutedChange" size="small"/>
        </div>

        <div class="chat-area-contact-more-area contact-more-leave-group" @click="handleLeaveGroup">退出群聊</div>
      </template>
      <template v-else>
        <div class="chat-area-contact-more-area chat-area-contact-info">
          <img
            :src="getUserLogo(activeContact.contact_id)"
            alt=""
            class="chat-area-contact-logo">
          <div class="overflow-ellipsis">
            <span :title="displayName">{{ displayName }}</span>
            <br>
            <small>{{ activeContact.contact_id }}</small>
          </div>
        </div>

        <label
          v-if="isString(friendRemarkModel)"
          class="chat-area-contact-more-area with-title input-content"
          data-title="好友备注">
          <input v-model="friendRemarkModel"
                 @blur="handleChangeFriendRemark"
                 @keydown="handleEnterBlur"
                 type="text"
                 placeholder="填写备注">
        </label>

        <div class="chat-area-contact-more-area contact-more-delete-friend" @click="handleDeleteFriend">删除好友</div>
      </template>
    </CustomScrollBar>

    <div v-if="!activeContact" class="display-flex justify-content-center align-items-center height-100">
      <div class="text-center text-muted">
        <h2>选择联系人以开始聊天</h2>
      </div>
    </div>

    <page-scroller
      v-else-if="activeContact"
      class="messages-container"
      ref="scroller"
      :get-id-function="getMsgId"
      :detect-is-latest-msg-function="detectIsLatestMsg"
      :detect-is-oldest-msg-function="detectIsOldestMsg"
      :page-size="30"
      :at-bottom-distance="100"
      :get-newer-messages="getNewerMessages"
      :get-older-messages="getOlderMessages"
      :container-class="$style['chat-container']"
      :wrapper-class="[
        $style['chat-wrapper'],
        activeContact.type === 'group' ? $style['chat-wrapper-group'] : $style['chat-wrapper-private']
        ]"
      :key="activeContact.contact_id"
      :colors="{ loadingSpinner: '#0099ff' }"
      @mounted="handleScrollerMounted"
      @load-messages="handleVisibleMessagesLoadMore"
    >
      <template #message="{ message, index, messages }">
        <MessageItem
          :message="message"
          :show-time-notice="isShowTimeTip(messages?.[index - 1], message)"
          @quote-message="(msg, user) => {quoteMessage(msg, user)}"
          @click-show-contact-info="handleClickShowContactInfo"
          @change-show-group-notice="changeShowGroupAnnounce"
          @change-show-essence-list="changeShowGroupEssenceList"
        />
      </template>
      <template #empty="{ initializing }">
        <div v-if="initializing" class="text-center text-muted loading-messages">
          加载消息...
        </div>
        <div v-else class="text-center text-muted no-messages">
          暂无消息
        </div>
      </template>
      <template #scroll-to-bottom-btn="{ scrollToBottom }">
        <div class="scroll-to-bottom-btn" @click="scrollToBottom">
          <QIcon name="notification_down_16"/>
        </div>
      </template>
    </page-scroller>

    <message-input-box
      class="message-input-box"
      :class="{ display: activeContact }"
      ref="inputer"
    ></message-input-box>
  </div>
</template>

<style scoped lang="scss">
.chat-area {
  @extend %flex-column;
}

.chat-area-head-name {
  font-weight: bold;
  display: flex;
  margin: 0 0 0 15px;
  align-items: center;
}

.chat-area-head-name .text-muted {
  font-weight: normal;
}

.chat-area-head {
  height: $chat-area-head-height;
  @extend %flex-row;
  justify-content: space-between;
  align-items: center;
  @extend %border-bottom;
}

.messages-container {
  flex: 1;
}

.loading-messages, .no-messages {
  padding: $spacing-xl;
  text-align: center;
  font-size: 100%;
}

.margin-br {
  display: block;
  line-height: 15px;
  opacity: 0;
}

.text-error {
  color: $color-error !important;
}

.chat-area-go-back-btn {
  display: none;
  width: 20px;
  height: 20px;
  margin: 0 8px 0 0;
}

.message-input-box {
  display: none;
}

.message-input-box.display {
  display: block;
}

.chat-area-head-control {
  margin: 0 5px 0 0;
  display: flex;
  align-items: center;
}

.chat-area-head-control-btn {
  margin: 0 5px;
  width: 32px;
  height: 32px;
  padding: 6px;
  border-radius: $radius-card;

  &:hover {
    @include hover-light;
  }

  &:active {
    @include active-light;
  }
}

.chat-area-contact-more {
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
  padding: 0 18px;

  &:deep(.simplebar-content) {
    font-size: 15px;
    gap: 18px;
    @extend %flex-column;
  }
}

.chat-area-contact-more-area {
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
}

.chat-area-contact-logo {
  @include avatar(40px);
  margin: 5px 10px 5px 5px;
}

.chat-area-contact-info small {
  color: var(--color-text-muted);
  display: block;
  margin-top: -4px;
}

.chat-area-contact-info {
  display: flex;
  align-items: center;
}

.group-applications-list {
  padding: 8px 10px 0 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: flex-start;

  @container (max-width: 360px) {
    justify-content: space-between;
  }
}

.group-app-list-app-container {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  gap: 5px;
  cursor: pointer;
}

.group-app-icon {
  width: 30px;
  height: 30px;
}

.contact-more-leave-group, .contact-more-delete-friend {
  @include flex-center-children;
  color: $color-text-danger;
  cursor: pointer;
}

@include mobile {
  .chat-area-head {
    height: 42px;
    align-items: center;
  }

  .chat-area-head-name {
    margin: 8px;
  }

  .chat-area-go-back-btn {
    display: block;
  }

  .chat-area-contact-more {
    width: 100%;
    height: calc(100% - 42px);
    top: 42px;
    box-shadow: none;
    transition: right ease-out $transition-normal;
  }
}
</style>

<style module>
.chat-container {
  width: 100%;
  display: block;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.chat-wrapper {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  /*content-visibility: auto;*/
  display: flex;
  flex-direction: column;
  padding-bottom: 5px;
  padding-top: 0;
}

.chat-wrapper-group {
  gap: 5px;
}

.chat-wrapper-private {
  gap: 0;
}
</style>

<style scoped lang="scss">
.scroll-to-bottom-btn {
  height: 28px;
  border: 1px solid white;
  box-shadow: $shadow-scroll-btn;
  width: 50px;
  border-radius: $radius-round;
  background-color: white;
  position: absolute;
  right: 20px;
  bottom: 10px;
  @extend %flex-center-children;
  color: $color-primary;

  svg {
    width: 18px;
    height: 18px;
    display: block;
    margin: auto;
  }

  &:hover {
    border: 1px solid $color-bg-scroll-btn-hover;
    background-color: $color-bg-page;
  }

  &:active {
    border: 1px solid $color-bg-scroll-btn-active;
    background-color: $color-bg-active-alt;
  }
}

.chat-area-head-display-name {
  cursor: default;
  padding: 0 3px;
  border-radius: 5px;

  @include hover-active-bg;
}
</style>

<style>
.messages-container .chat-wrapper .simplebar-scrollbar {
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}

.messages-container .chat-wrapper .simplebar-scrollbar:before {
  width: 7px;
  left: 3px;
}

.messages-container:hover .chat-wrapper .simplebar-scrollbar, .messages-container .chat-wrapper.simplebar-dragging .simplebar-scrollbar {
  opacity: 0.3;
}
</style>