<script setup>
import { computed, onMounted, onUnmounted, ref, watch, onBeforeUnmount, provide, toRaw } from 'vue'
import { ConnectionBridge } from '../scripts/connection/connection-bridge.js'
import { ConnectionBridgeOnebot } from "../scripts/connection/virtual-backend/connection-bridge-onebot.js";
import NavigationView from '../components/Navigation/NavigationView.vue'
import DestinationView from '../components/Destination/DestinationView.vue'
import {
  fetchEssenceMessages,
  fetchMessages,
  fetchSetGroupRemark,
  fetchSetLongNick,
  fetchStrangerInfo,
  getOnebotWsToken,
  getOnebotWsUri,
  wsUri,
  fetchCategorizedContacts,
  fetchGroupMemberList,
  fetchFriendList,
  fetchSetFriendRemark,
  checkResponseOK,
  fetchGroupMutedList, fetchSetGroupName, fetchGroupTodoMessage, fetchCancelGroupTodo
} from "../scripts/backend-api.js";
import { useGlobalStore } from "@/store/global.js";
import { showErrorToast, showToast } from "../scripts/toast.js";
import { destroyContextMenu, initContextMenu } from "../directives/context-menu.js";
import { CalledEmitter, Emitter } from "../composables/useEventBus.js";
import ContactInfoTooltip from "../components/Common/Overlay/ContactInfoTooltip.vue";
import { isSupportedNoticeMessage } from "../scripts/parse-message.js";
import DownloadProgressPopup from "../components/Windows/DownloadProgressPopup.vue";
import LoadingSpinner from "../components/Common/Widgets/LoadingSpinner.vue";
import {
  checkMsgIsContact,
  checkSameContact,
  createGroupContact, createPrivateContact,
  flattenCategorizedContacts
} from "../scripts/contacts-util.js";
import { parseJSON } from "../scripts/util.js";
import { isArray, isNumber, isString } from "../scripts/types-util.js";
import { DestKey } from "../scripts/view-keys.js";
import {
  getGroupListCache,
  getGroupMemberListCache,
  updateGroupInfoCache,
  updateGroupMemberInfoCache
} from "@/scripts/user-info-util.js";

const props = defineProps({
  account: {
    type: Object,
    required: true,
  }
});

const categorizedContacts = ref([])

const loadingContacts = ref(false)
provide("isLoadingContacts", loadingContacts)
const activeContact = ref(null)
provide("activeContact", activeContact)
const destinationView = ref(null)
const chatArea = computed(() => {
  return destinationView.value.chatArea
})
const wsInited = ref(false);
const groupUsers = ref(null)
watch(() => getGroupMemberListCache(activeContact.value?.contact_id), newVal => {
  if (activeContact.value?.type === 'group') {
    groupUsers.value = newVal
  } else {
    groupUsers.value = null
  }
})
provide("groupUsers", groupUsers)

const changeDestView = (key, active) => {
  if (![DestKey.CHAT_AREA, DestKey.BLANK].includes(key)) {
    activeContact.value = null
    groupUsers.value = null
  }
  destinationView?.value?.changeView(key, active)
}
provide("changeDestView", changeDestView)


const getRecentContacts = () => categorizedContacts.value.find(c => c.id === -100)?.contacts || []
provide("getRecentContacts", getRecentContacts)

const flattenContacts = computed(() => {
  return flattenCategorizedContacts(categorizedContacts.value)
})

provide("categorizedContacts", categorizedContacts)
provide("flattenContacts", flattenContacts)

const global = useGlobalStore()

// bridge实例，onMounted内部初始化
let bridge = null
const isConnected = ref(false)
const lastMessageId = ref(0)
const selfId = ref(null)

watch(() => isConnected.value && selfId.value, val => {
  if (val) {
    console.log(`WebSocket ${wsInited.value ? 're' : ''}connected, checking for missed messages...`)
    wsInited.value = true;
  }
})

watch(activeContact, (newContact, oldContact) => {
  if (!checkSameContact(newContact, oldContact)) {
    groupEssenceMsgList.value = null
    groupTodoMessage.value = null
  }
})

// 选择联系人
const selectContact = contact => {
  // if (chatArea.value?.$refs?.scroller?.initializing) return
  // 如果已经是当前联系人
  if (checkSameContact(activeContact.value, contact)) {
    contact = null;
  }
  // 切换视图到 Chat Area
  changeDestView(DestKey.CHAT_AREA, !!contact);
  if (contact) {
    activeContact.value = contact
  }
  // 为空在 DestinationView 中处理
}
provide("selectContact", selectContact)


const updateContactRemark = (contact, remark) => {
  if (!isString(remark)) return
  for (const category of (categorizedContacts.value || [])) {
    for (const c of (category.contacts || [])) {
      if (checkSameContact(c, contact)) {
        c.remark = remark
        c.name = remark || c.real_name || c.name
      }
    }
  }
  if (checkSameContact(contact, activeContact.value)) {
    activeContact.value.remark = remark
    activeContact.value.name = remark || activeContact.value.real_name || activeContact.value.name
  }
}

const changeGroupContactRemark = async (contact_id, remark) => {
  const result = await fetchSetGroupRemark(
    contact_id,
    remark
  );
  if (checkResponseOK(result)) {
    updateContactRemark(
      createGroupContact(contact_id),
      remark
    )
  } else {
    console.log("Change group contact remark error: ", contact_id, remark, result)
    showErrorToast(`改变群 ${contact_id} 备注为 ${remark} 失败`)
  }
}
provide("changeGroupContactRemark", changeGroupContactRemark)

const selfInfo = ref(null)

provide("selfId", selfId)
provide("selfInfo", selfInfo)

const changeSelfLongNick = async longNick => {
  const result = await fetchSetLongNick(longNick)
  if (checkResponseOK(result)) {
    selfInfo.value.long_nick = selfInfo.value.longNick = longNick;
  } else {
    console.log("Change self long nick error: ", longNick, result)
    showErrorToast(`改变个性签名为 ${longNick} 失败`)
  }
}
provide("changeSelfLongNick", changeSelfLongNick)

const changeFriendContactRemark = async (user_id, remark) => {
  const result = await fetchSetFriendRemark(user_id, remark)
  if (checkResponseOK(result)) {
    updateContactRemark(
      createPrivateContact(user_id),
      remark
    )
  } else {
    console.log("Change private contact remark error: ", user_id, remark, result)
    showErrorToast(`改变好友 ${user_id} 备注为 ${remark} 失败`)
  }
}
provide("changeFriendContactRemark", changeFriendContactRemark)

const updateContactName = (contact, name) => {
  if (!name) return
  for (const category of (categorizedContacts.value || [])) {
    for (const c of (category.contacts || [])) {
      if (checkSameContact(c, contact)) {
        c.real_name = name
        c.name = c.remark || name || c.name
      }
    }
  }
  if (checkSameContact(contact, activeContact.value)) {
    activeContact.value.real_name = name
    activeContact.value.name = activeContact.value.remark || name || activeContact.value.name
  }
}

const changeGroupContactName = async (contact_id, name) => {
  const result = await fetchSetGroupName(
    contact_id,
    name
  );
  if (checkResponseOK(result)) {
    updateContactName(
      createGroupContact(contact_id),
      name
    )
  } else {
    console.log("Change group contact remark error: ", contact_id, name, result)
    showErrorToast(`改变群 ${contact_id} 名称为 ${name} 失败`)
  }
}
provide("changeGroupContactName", changeGroupContactName)

const initAppData = () => {
  fetchFriendList()
  getContacts()
  selfInfo.value = { user_id: selfId.value }
  fetchStrangerInfo(selfId.value).then(
    info => {
      selfInfo.value = info
    }
  )
}

watch(wsInited, newVal => {
  if (newVal) {
    initAppData()
  }
})

// 获取联系人列表
const getContacts = async () => {
  loadingContacts.value = true
  try {
    categorizedContacts.value = await fetchCategorizedContacts()
    // console.log(categorizedContacts)
  } catch (error) {
    console.error('Failed to fetch categorizedContacts:', error)
  } finally {
    loadingContacts.value = false
  }
}

const groupEssenceMsgList = ref(null)
provide("groupEssenceMsgList", groupEssenceMsgList)

const getEssenceMsgList = async () => {
  try {
    const contact = toRaw(activeContact.value)
    if (contact?.type === 'group') {
      const list = await fetchEssenceMessages(contact.contact_id, false)
      if (checkSameContact(activeContact.value, contact)) {
        activeContact.value.essence_real_seq_list = list.map(i => i.msg_seq)
        groupEssenceMsgList.value = list
        return list
      }
    }
  } catch (e) {
    console.error('获取群精华消息列表错误', e)
  }
  return []
}

const groupTodoMessage = ref(null)
const getGroupTodoMessage = async () => {
  try {
    const contact = toRaw(activeContact.value)
    if (contact?.type === 'group') {
      const msg = await fetchGroupTodoMessage(contact.contact_id)
      if (checkSameContact(activeContact.value, contact)) {
        groupTodoMessage.value = msg
        return msg
      }
    }
  } catch (e) {
    console.error('获取群待办错误', e)
  }
  return null
}
provide("groupTodoMessage", groupTodoMessage)
const removeGroupTodoMessage = async (message_id) => {
  if (!message_id) message_id = groupTodoMessage.value?.message_id
  try {
    const contact = toRaw(activeContact.value)
    if (contact?.type === 'group') {
      const result = await fetchCancelGroupTodo(contact.contact_id, message_id)
      if (!checkResponseOK(result)) throw new Error(JSON.stringify(result))
      if (checkSameContact(activeContact.value, contact)) {
        groupTodoMessage.value = null
        return true
      }
    }
  } catch (e) {
    console.error('获取群待办错误', e)
  }
  return false
}
provide("removeGroupTodoMessage", removeGroupTodoMessage)

// 获取消息历史
const getMessages = async (
  message_id,
  id,
  count,
  include,
  direction,
  cursor_time,
  notice_before_cursor,
  notice_after_cursor,
  notice_message = false
) => {
  let messages = []
  if (!activeContact.value) return messages

  try {
    const params = {
      limit: count,
      cursor: id,
      direction,
      include_cursor: include,
      message_id,
      cursor_type: (notice_message || !id) ? "id" : "real_seq",
      cursor_time,
      notice_before_cursor,
      notice_after_cursor
    }

    if (activeContact.value.type === 'group') {
      params.message_type = 'group'
      params.group_id = activeContact.value.contact_id
    } else {
      params.message_type = 'private'
      params.target_id = activeContact.value.contact_id
    }

    if (params.message_type === 'group') {
      fetchGroupMemberList(params.group_id).then(() => fetchGroupMutedList(params.group_id))
      // noinspection ES6MissingAwait
      getEssenceMsgList()
      // noinspection ES6MissingAwait
      getGroupTodoMessage()
    }

    const response = await fetchMessages(params);
    if (!activeContact.value) return;

    messages = response.messages
    // activeContact.value.max_id = response.max_id
    // activeContact.value.min_id = response.min_id
    // if (response.max_real_seq) {
    //   activeContact.value.max_real_seq = response.max_real_seq
    // }

    if (messages.length === (include ? 1 : 0)) {
      const keys = (direction === 'prev' && message_id === 0 && !id) ? ['min_cursor', 'max_cursor'] : [direction === 'prev' ? "min_cursor" : "max_cursor"]
      keys.forEach(key => {
        activeContact.value[key] = {
          type: (notice_message || !id) ? "id" : "real_seq",
          value: id
        }
      })
    } else if (messages.length && messages.length < count) {
      const msg = direction === 'prev' ? messages[0] : messages[messages.length - 1]
      activeContact.value[direction === 'prev' ? "min_cursor" : "max_cursor"] = {
        type: msg.real_seq ? "real_seq" : "id",
        value: msg.real_seq || msg.id
      }
    }

    if (messages.length && direction === 'prev' && message_id === 0 && !id) {
      const msg = messages[messages.length - 1]
      activeContact.value.max_cursor = {
        type: msg.real_seq ? "real_seq" : "id",
        value: msg.real_seq || msg.id
      }
    }

    // 更新最后收到的消息ID
    if (messages.length > 0) {
      const response_messages = response.messages
      if (response_messages.length) {
        const response_id = response_messages
          .filter(obj => isNumber(obj.id))
          .map(obj => obj.id);
        lastMessageId.value = Math.max(lastMessageId.value, ...response_id)
      }
    }
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    showToast('error', '获取消息错误')
  }
  return messages
}
provide("getMessages", getMessages)

// 销毁逻辑
const destroy = () => {
  destroyContextMenu()
  if (bridge) {
    bridge.destroy()
    bridge = null
  }
  CalledEmitter.off('sendAction')
  CalledEmitter.off('reqBackend')
}

const showDownloadPopup = ref(false)
const downloadInfo = ref(null)

function handleDownload(info) {
  // 只有直连 OneBot 模式才需要弹窗（非直连模式由 Python 后端处理）
  if (!effectiveIsDirect.value) return;
  downloadInfo.value = info;
  showDownloadPopup.value = true;
}

const contactInfoTooltip = ref(null)
provide("showContactInfo", options => contactInfoTooltip.value?.showContactInfo(options))

const filesUploadTasks = ref([])
provide("filesUploadTasks", filesUploadTasks)

// 从 account prop 决定是否是直连模式
const effectiveIsDirect = computed(() => {
  return props.account.mode === 'direct'
})

onMounted(() => {
  initContextMenu()

  const isDirect = effectiveIsDirect.value
  let url;
  if (isDirect) {
    // 直连模式：使用用户输入的 wsUri 和 token
    url = {
      url: props.account.wsUri || getOnebotWsUri(),
      token: props.account.wsToken || getOnebotWsToken(),
    }
  } else {
    // 后端模式：如果有 self_id，附加到 wsUri 路径中
    let backendWsUri = wsUri
    if (props.account.self_id) {
      backendWsUri = wsUri.replace(/\/frontend(?:\/|$)?/, `/frontend/${props.account.self_id}`)
    }
    url = backendWsUri
  }

  const Bridge = isDirect ? ConnectionBridgeOnebot : ConnectionBridge

  // ========== 在onMounted内部初始化 ConnectionBridge ==========
  bridge = new Bridge(url, {
    onMessage: (message) => {
      // 检查消息是否属于当前活跃的联系人
      if (checkMsgIsContact(message, activeContact.value)) {
        chatArea.value?.$refs?.scroller?.addMessage(message)
      }
    },
    onNotice: notice => {
      if (checkMsgIsContact(notice, activeContact.value)) {
        const { notice_type, sub_type, user_id, group_id } = notice
        const event = parseJSON(notice.event)
        if (notice_type === 'group_ban') {
          const { duration } = event
          const isBan = sub_type === 'ban'
          if (String(user_id) === '0') {
            updateGroupInfoCache(
              group_id,
              {
                group_all_shut: isBan ? -1 : 0
              }
            )
          } else {
            updateGroupMemberInfoCache(
              group_id,
              user_id,
              {
                shut_up_timestamp: isBan ? event.time + duration : 0
              }
            )
          }
        } else if (['group_recall', 'friend_recall'].includes(notice_type)) {
          const is_group = notice_type === 'group_recall'
          const visibleMessages = chatArea.value?.$refs?.scroller?.visibleMessages
          if (visibleMessages) {
            visibleMessages.forEach(msg => {
              if (msg?.message_id === notice.message_id) {
                const event = parseJSON(msg.event)
                event.recall_operator = is_group ? notice.operator_id : msg.user_id
                msg.event = JSON.stringify(event)
              }
            })
          }
        } else if (notice_type === 'notify') {
          if (sub_type === 'input_status') {
            chatArea.value?.refreshPeerStatus?.(JSON.parse(notice.event)?.status_text)
          } else if (sub_type === 'title') {
            updateGroupMemberInfoCache(
              group_id,
              user_id,
              { title: event.title }
            )
          } else if (sub_type === 'group_name') {
            updateContactName(
              createGroupContact(group_id),
              event.name_new
            )
          }
        } else if (notice_type === 'group_card') {
          updateGroupMemberInfoCache(
            group_id,
            user_id,
            { card: event.card_new }
          )
        } else if (notice_type === 'group_admin') {
          updateGroupMemberInfoCache(
            group_id,
            user_id,
            { role: sub_type === 'set' ? 'admin' : 'member' }
          )
        } else if (notice_type === 'group_msg_emoji_like') {
          const { likes } = event
          if (isArray(likes)) {
            for (const like of likes) {
              Emitter.emit('emoji-like-update', {
                message_id: notice.message_id,
                is_add: event.is_add,
                emoji_id: Number(like.emoji_id),
                user_id: Number(notice.user_id)
              })
            }
          }
        }

        if (isSupportedNoticeMessage(notice)) {
          if (notice_type === 'group_msg_emoji_like' && !global.messageSettings?.showEmojiLikeNotice) {
            // 不显示群聊表情回应灰色提示
          } else {
            chatArea.value?.$refs?.scroller?.addMessage(notice)
          }
        }
      }
    },
    onNewContact: (newContact) => {
      // 检查是否已存在该联系人
      const findTarget = () => {
        return getRecentContacts().find((c) => c.contact_id === newContact.contact_id && c.type === newContact.type)
      }
      let target = findTarget()

      if (!target) {
        // 构造新联系人对象
        getRecentContacts().unshift({
          contact_id: newContact.contact_id,
          type: newContact.type,
        })
        target = findTarget()
      }

      if (target) {
        // 需要同步的字段列表，注释字段直接注释在数组内
        const syncFields = [
          'name',
          'last_time',
          'last_timestamp',
          'latest_msg',
          // 'min_id',
          // 'max_id',
          // 'max_real_seq',
          // 'min_real_seq',
          'max_cursor',
          'min_cursor',
        ]
        // 批量同步字段
        for (const key of syncFields) {
          if (newContact[key]) {
            target[key] = newContact[key]
          }
        }
      }
    }
  })

  // 同步bridge内部响应式变量到组件作用域
  watch(bridge.isConnected, val => {
    isConnected.value = val
  })
  watch(bridge.lastMessageId, val => {
    lastMessageId.value = val
  })
  watch(bridge.selfId, val => {
    selfId.value = val
  })

  if (!isDirect) {
    bridge.selfId.value = Number(props.account.self_id)
  }

  // 提供 sendAction 和 reqBackend 给子组件
  CalledEmitter.on("sendAction", bridge.sendAction.bind(bridge))
  CalledEmitter.on("reqBackend", bridge.reqBackend.bind(bridge))

  // 直连 OneBot 模式：设置下载进度回调
  if (bridge.virtualProtocol) {
    bridge.virtualProtocol.setDownloadHandler(handleDownload)
  }
});


onBeforeUnmount(destroy)
onUnmounted(destroy)
</script>

<template>
  <div class="main-view">
    <div class="main-view-container" v-if="wsInited">
      <NavigationView/>
      <DestinationView ref="destinationView"/>
      <ContactInfoTooltip ref="contactInfoTooltip"/>
      <!-- 下载进度弹窗 -->
      <DownloadProgressPopup
        v-if="showDownloadPopup && downloadInfo"
        :download-info="downloadInfo"
        @close="showDownloadPopup = false"
        @confirm="showDownloadPopup = false"
      />
    </div>
    <LoadingSpinner class="flex-center-children flex-column size-100" v-else text="WebSocket 初始化..."/>
  </div>
</template>

<style scoped lang="scss">
.main-view {
  height: 100%;
  width: 100%;
  @extend %flex-column;
  color: $color-text-primary;
}

.main-view-container {
  display: flex;
  height: 100%;
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>