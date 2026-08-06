/**
 * 群成员右键菜单共享逻辑
 * 从 MessageItem.vue 提取的群成员（头像）右键菜单，供 GroupMembersViewer 等组件复用
 */
import {
  basicContextItem,
  contextDividedItem,
  formatBasicContextItems
} from "@/directives/context-menu.js";
import {
  fetchContactShareArk,
  fetchKickGroupUser,
  fetchSendMessage,
  fetchSetGroupAdmin,
  fetchSetGroupMemberCard, fetchSetGroupMemberTitle,
  fetchSetGroupMute, handleApiRequest,
} from "@/scripts/backend-api.js";
import { showConfirmBox, showPromptBox } from "@/scripts/popup-box-api.js";
import { getElementCenter } from "@/scripts/util.js";
import {
  isGroupAdmin,
  isGroupOwner,
  hasGroupMemberOperatePermission
} from "@/scripts/user-info-util.js";
import { checkSameContact } from "@/scripts/contacts-util.js";
import { Emitter } from "@/composables/useEventBus.js";
import { copy } from "@/scripts/clipboard.js";
import { isObject } from "@/scripts/types-util.js";

/**
 * 创建群成员右键菜单项
 * @param {Object} options
 * @param {Object} [options.userInfo] - 目标用户的群成员信息（含 role, card, nickname, shut_up_timestamp 等）
 * @param {Object} [options.selfInfo] - 当前用户在群内的信息（含 role, self_id, shut_up_timestamp 等）
 * @param {string} [options.displayName] - 目标用户的显示名称
 * @param {Object} [options.activeContact] - 当前活跃联系人（用于判断是否已在此会话）
 * @param {Array} [options.flattenContacts=[]] - 扁平联系人列表
 * @param {Function} [options.selectContact] - 选择联系人回调
 * @param {Function} [options.showContactInfo] - 显示联系人信息回调 (接收鼠标事件对象和用户信息)
 * @param {HTMLElement} [options.avatarElement] - 头像 DOM 元素（用于定位菜单位置）
 * @returns {Array} 格式化后的菜单项数组，可直接用于 vCustomMenu
 */
export function createUserAvatarContextMenuItems({
                                                   userInfo,
                                                   selfInfo,
                                                   displayName = '',
                                                   activeContact,
                                                   flattenContacts = [],
                                                   selectContact,
                                                   showContactInfo,
                                                   avatarElement
                                                 }) {
  const user = userInfo || {}
  const self = selfInfo || {}
  const { group_id, user_id } = user
  const isGroup = !!group_id
  const isSelf = user_id === self.user_id
  const isAdminUser = isGroupAdmin(user)
  const isOwnerSelf = isGroupOwner(self)
  const operatePermission = hasGroupMemberOperatePermission(self, user)
  const hasBeenMuted = !!self.shut_up_timestamp

  const userContact = {
    contact_id: user_id,
    type: 'private'
  }

  const muteFunc = duration => async () => {
    const operation = (duration === 0 ? "解除" : "")
    await handleApiRequest(
      fetchSetGroupMute(group_id, user_id, duration),
      operation + "禁言成功",
      operation + "禁言失败"
    )
  }

  return formatBasicContextItems([
    basicContextItem(
      '发送消息',
      () => selectContact(userContact),
      'message_24',
      Boolean( // undefined 自动取默认值
        !checkSameContact(userContact, activeContact) &&
        flattenContacts?.find?.(
          contact => checkSameContact(contact, userContact
          ))
      )
    ),
    basicContextItem(
      'TA',
      () => Emitter.emit("input-at-somebody", user_id, displayName),
      'at_24',
      isGroup
    ),
    basicContextItem(
      '戳一戳',
      () => {
        // noinspection JSIgnoredPromiseFromCall
        fetchSendMessage({
          type: 'group',
          contact_id: group_id
        }, [{
          type: 'poke',
          data: {
            user_id: user_id,
            target_id: user_id,
            group_id: group_id
          }
        }])
      },
      'poke_24'
    ),
    basicContextItem(
      '查看资料',
      e => {
        if (avatarElement) {
          const pos = getElementCenter(avatarElement)
          showContactInfo({
            clientX: pos.x,
            clientY: pos.y
          }, userInfo)
        } else {
          showContactInfo(e, userInfo)
        }
      },
      'files_24'
    ),
    basicContextItem(
      (isAdminUser ? "取消" : "设为") + "管理员",
      async () => {
        const action = (isAdminUser ? "取消" : "设为")
        if (
          await showConfirmBox(
            action + '管理员',
            isAdminUser ? `确定要取消 ${displayName} 的管理员权限吗？` : `确定要设置 ${displayName} 为管理员吗？`
          )
        ) {
          await handleApiRequest(
            fetchSetGroupAdmin(group_id, user_id, !isAdminUser),
            "设置成功",
            `${action}管理员失败`
          )
        }
      },
      "administering_user_24",
      isGroup && isOwnerSelf && !isSelf
    ),
    basicContextItem(
      '修改群昵称',
      async () => {
        const card = await showPromptBox(
          "修改群昵称",
          `修改 ${user.nickname} 的群名片`,
          "群昵称",
          user.card
        )
        if (card !== null) {
          await handleApiRequest(
            fetchSetGroupMemberCard(group_id, user_id, card),
            "设置成功",
            "修改群昵称失败"
          )
        }
      },
      'edit_24',
      isGroup && (isGroupAdmin(self) || isSelf)
    ),
    basicContextItem(
      '修改群头衔',
      async () => {
        const title = await showPromptBox(
          "修改群头衔",
          `修改 ${displayName} 的群头衔`,
          "群头衔",
          user.title
        )
        if (title !== null) {
          await handleApiRequest(
            fetchSetGroupMemberTitle(group_id, user_id, title),
            "设置成功",
            "修改群头衔失败"
          )
        }
      },
      'edit_24',
      isGroup && isOwnerSelf
    ),
    contextDividedItem(),
    basicContextItem(
      '移出本群',
      async () => {
        if (await showConfirmBox('温馨提醒', '确定将该成员从本群聊中移除吗？')) {
          await handleApiRequest(
            fetchKickGroupUser(group_id, user_id),
            '已移出本群',
            '移出本群失败'
          )
        }
      },
      'remove_user_24',
      isGroup && operatePermission
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
              `设定 ${displayName} 的禁言时长，不能超过 30 天，单位为秒：`,
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
      isGroup && operatePermission
    ),
    basicContextItem(
      "解除禁言",
      muteFunc(0),
      'message_off_24',
      isGroup && operatePermission && hasBeenMuted
    )
  ])
}

export function createContactContextMenuItems({ contact, showContactInfo, avatarElement }) {
  if (!isObject(contact)) return []
  const isGroup = contact.type === 'group'
  const { contact_id, remark, real_name } = contact
  const contactInfo = isGroup ? {
    group_id: contact_id,
    group_remark: remark,
    group_name: real_name
  } : {
    user_id: contact_id,
    remark,
    nickname: real_name
  }
  return [
    basicContextItem(
      '查看资料',
      e => {
        const options = {
          position: (avatarElement ? getElementCenter(avatarElement) : null) || { x: e?.clientX, y: e?.clientY }
        }
        options[isGroup ? 'group' : 'user'] = contactInfo
        showContactInfo(options)
      },
      'files_24'
    ),
    basicContextItem(
      isGroup ? "复制群号" : "复制 QQ 号",
      () => {
        copy(contact.contact_id)
      },
      "copy_24"
    ),
    basicContextItem(
      "分享",
      () => {
        Emitter.emit(
          "select-contacts-send-msg",
          (async () => [await fetchContactShareArk(contact)])()
        )
      },
      "share_new_24"
    ),
  ]
}