<script setup>
import { computed, onMounted, onUnmounted, ref, watch, onBeforeUnmount, provide } from 'vue'
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
  fetchCategorizedContacts, fetchGroupMemberList, fetchFriendList
} from "../scripts/backend-api.js";
import { showErrorToast, showToast } from "../scripts/toast.js";
import { destroyContextMenu, initContextMenu } from "../directives/context-menu.js";
import { CalledEmitter } from "../composables/useEventBus.js";
import ContactInfoTooltip from "../components/Common/Overlay/ContactInfoTooltip.vue";
import { isSupportedNoticeMessage } from "../scripts/parse-message.js";
import DownloadProgressPopup from "../components/Common/Overlay/DownloadProgressPopup.vue";
import LoadingSpinner from "../components/Common/Widgets/LoadingSpinner.vue";
import { checkMsgIsContact, checkSameContact, flattenCategorizedContacts } from "../scripts/contacts-util.js";
import { nowSecondTimestamp, parseJSON } from "../scripts/util.js";
import { isNumber } from "../scripts/types-util.js";
import { DestKey } from "../scripts/view-keys.js";

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
provide("groupUsers", groupUsers)

const changeDestView = (key, callback) => {
  if (![DestKey.CHAT_AREA, DestKey.BLANK].includes(key)) {
    activeContact.value = null
  }
  destinationView?.value?.changeView(key, callback)
}
provide("changeDestView", changeDestView)

const recentContacts = () => {
  return categorizedContacts.value.find?.(c => c.id === -100)?.contacts || []
}

const flattenContacts = computed(() => {
  return flattenCategorizedContacts(categorizedContacts.value)
})

provide("categorizedContacts", categorizedContacts)
provide("flattenContacts", flattenContacts)

// bridge实例，onMounted内部初始化
let bridge = null
const isConnected = ref(false)
const lastMessageId = ref(0)
const selfId = ref(null)

watch(() => isConnected.value && selfId.value, val => {
  if (val) {
    console.log(`WebSocket ${wsInited ? '' : 're'}connected, checking for missed messages...`)
    wsInited.value = true;
  }
})

watch(activeContact, (newContact, oldContact) => {
  if (!newContact) {
    groupEssenceMsgList.value = null
    groupUsers.value = null
  }
  if (!checkSameContact(newContact, oldContact) && newContact) {
    getEssenceMsgRealSeqList()
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
  changeDestView(DestKey.CHAT_AREA, () => {
    activeContact.value = contact
  });
}
provide("selectContact", selectContact)

const changeGroupContactRemark = async (contact_id, remark) => {
  const result = await fetchSetGroupRemark(
    contact_id,
    remark
  );
  if (result.status === 'ok') {
    for (const contact of recentContacts()) {
      if (contact.contact_id === contact_id) {
        contact.remark = remark;
        contact.name = remark || contact.real_name
      }
    }
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
  if (result?.status === 'ok') {
    selfInfo.value.long_nick = selfInfo.value.longNick = longNick;
  } else {
    console.log("Change self long nick error: ", longNick, result)
    showErrorToast(`改变个性签名为 ${longNick} 失败`)
  }
}
provide("changeSelfLongNick", changeSelfLongNick)

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

const fetchEssenceMessagesWrapper = async (group_id, only_real_seq) => {
  try {
    return await fetchEssenceMessages(group_id, only_real_seq)
  } catch (e) {
    console.error('获取群精华消息列表错误', e)
  }
  return []
}

const groupEssenceMsgList = ref(null)
provide("groupEssenceMsgList", groupEssenceMsgList)

const getEssenceMsgRealSeqList = async () => {
  if (activeContact.value?.type === 'group') {
    const list = await fetchEssenceMessagesWrapper(activeContact.value.contact_id, false)
    if (activeContact.value) {
      activeContact.value.essence_real_seq_list = list.map(i => i.msg_seq)
      groupEssenceMsgList.value = list
      return list
    }
  }
  return []
}

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
    let response, essence_real_seq_list;

    if (params.message_type === 'group') {
      [response, essence_real_seq_list, groupUsers.value] = await Promise.all([
        fetchMessages(params),
        fetchEssenceMessagesWrapper(params.group_id, true),
        fetchGroupMemberList(params.group_id),
      ])
      activeContact.value.essence_real_seq_list = essence_real_seq_list
    } else {
      response = await fetchMessages(params)
    }

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
      const isCurrentContact = checkMsgIsContact(notice, activeContact.value)
      const { notice_type, sub_type } = notice
      if (['group_recall', 'friend_recall'].includes(notice_type)) {
        const is_group = notice_type === 'group_recall'
        if (isCurrentContact) {
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
        }
      } else if (notice_type === 'notify' && sub_type === 'input_status') {
        if (isCurrentContact && (nowSecondTimestamp() - notice.time <= 10)) {
          chatArea.value?.refreshPeerStatus?.(JSON.parse(notice.event)?.status_text)
        }
      } else if (isSupportedNoticeMessage(notice)) {
        if (isCurrentContact) {
          chatArea.value?.$refs?.scroller?.addMessage(notice)
        }
      }
    },
    onNewContact: (newContact) => {
      // 检查是否已存在该联系人
      const findTarget = () => {
        return recentContacts().find((c) => c.contact_id === newContact.contact_id && c.type === newContact.type)
      }
      let target = findTarget()

      if (!target) {
        // 构造新联系人对象
        recentContacts().unshift({
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
    bridge.selfId.value = props.account.self_id
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
    <div class="chat-container" v-if="wsInited">
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

<style scoped>
.main-view {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.chat-container {
  display: flex;
  height: 100%;
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>