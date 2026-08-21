import { isNil, isObject, isString } from "../../types-util.js";

/**
 * 将 OneBot 原始事件转换为标准化的消息数据格式
 * 与 Python 端 convert_event_to_message_data 等效
 */
export function convertEventToMessageData(event) {
  const eventDict = isObject(event) ? { ...event } : {};

  let realSeq = null;
  try {
    realSeq = parseInt(eventDict.real_seq ?? eventDict.message_seq, 10);
  } catch {
    // ignore
  }

  let userId = eventDict.user_id;
  if (userId === undefined && eventDict.sender?.user_id !== undefined) {
    userId = eventDict.sender.user_id;
  }

  const postType = eventDict.post_type;
  const messageType = eventDict.message_type;
  let targetId = eventDict.target_id;
  const groupId = eventDict.group_id;

  if (postType === 'message' || postType === 'message_sent') {
    if (messageType === 'group') {
      targetId = targetId || groupId;
    }
    if (postType === 'message' && messageType === 'private') {
      targetId = targetId || userId;
    }
  }

  return {
    message_id: eventDict.message_id ?? null,
    real_seq: realSeq,
    time: eventDict.time ?? Math.floor(Date.now() / 1000),
    self_id: eventDict.self_id ?? null,
    sender_id: eventDict.sender_id ?? null,
    post_type: postType,
    notice_type: eventDict.notice_type ?? null,
    request_type: eventDict.request_type ?? null,
    message_type: messageType,
    sub_type: eventDict.sub_type ?? null,
    user_id: userId ?? null,
    group_id: groupId ?? null,
    operator_id: eventDict.operator_id ?? null,
    target_id: targetId ?? null,
    event: JSON.stringify(eventDict),
    created_at: new Date().toISOString(),
  };
}

/**
 * 格式化 OneBot 的最近联系人数据
 * 与 Python 端 format_recent_contacts 等效
 */
export function formatRecentContacts(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts.map(contact => {
    const event = contact.lastestMsg;
    const isTemp = event ? ('temp_source' in event) : false;
    const chatType = contact.chatType;
    const type = chatType === 1 || isTemp ? 'private' : 'group';

    const formatted = {
      temp: isTemp,
      type,
      real_name: contact.peerName ?? '',
      remark: contact.remark ?? '',
      last_time: new Date().toISOString(),
      contact_id: parseInt(contact.peerUin, 10) || 0,
      has_message: false,
    };

    if (event) {
      if (event.message_type === 'private') {
        event.target_id = event.peerUin;
      }
      formatted.last_timestamp = event.time;
      formatted.latest_msg = JSON.stringify(event);
      formatted.has_message = !!event.message;
    }
    formatted.name = formatted.remark || formatted.real_name;
    return formatted;
  });
}

/**
 * 处理并存储事件到数据库（与 Python 端 process_message 等效）
 * 纯函数，不处理回调，只做存储和转换，返回包装后的前端消息数据
 *
 * @param {object} event - OneBot 原始事件
 * @param {object} db - virtualDB 实例
 * @returns {Promise<object|null>} 包装后的前端消息数据，meta_event 返回 null
 */
export async function processAndStoreEvent(event, db) {
  if (event.post_type === 'meta_event') return null;

  const messageData = convertEventToMessageData(event);

  // 存储到数据库
  const msgId = await db.saveMessage(messageData);
  messageData.id = msgId;

  // 处理撤回事件（委托给 db.processRecallEvent）
  if (event.post_type === 'notice' &&
    ['group_recall', 'friend_recall'].includes(event.notice_type)) {
    await db.processRecallEvent(event);
  }

  // 准备前端消息格式（与后端广播的格式一致）
  return {
    id: msgId,
    message_id: messageData.message_id,
    real_seq: messageData.real_seq,
    time: messageData.time,
    self_id: messageData.self_id,
    sender_id: messageData.sender_id,
    post_type: messageData.post_type,
    notice_type: messageData.notice_type,
    request_type: messageData.request_type,
    message_type: messageData.message_type,
    sub_type: messageData.sub_type,
    user_id: messageData.user_id,
    group_id: messageData.group_id,
    operator_id: messageData.operator_id,
    target_id: messageData.target_id,
    event: messageData.event,
    created_at: messageData.created_at,
  };
}

// ===================== OneBotHandler 方法 =====================

/**
 * 从 OneBot 获取消息历史（递归）
 * 与 Python 端 OneBotHandler.get_messages 等效
 *
 * @param {object} onebotWS - OneBotWSConnection 实例
 * @param {number} id - 群 ID 或用户 ID
 * @param {string} type - 'group' 或 'private'
 * @param {number} [count=20] - 获取数量
 * @param {string|null} [direction=null] - 'prev' 或 'next'
 * @param {number} [messageId=0] - 起始消息 ID
 * @returns {Promise<Array>} 消息列表
 */
export async function getMessagesFromOneBot(onebotWS, id, type, count = 20, direction = null, messageId = 0) {
  const params = {
    count,
    message_seq: messageId,
    message_id: messageId,
  };
  params[type === 'group' ? 'group_id' : 'user_id'] = id;
  if (direction !== null) {
    params.reverse_order = direction === 'prev';
  }

  const action = type === 'group' ? 'get_group_msg_history' : 'get_friend_msg_history';
  const self_id = onebotWS.selfId;

  try {
    const apiData = await onebotWS.callAction(action, params, null, 60000);
    let messages = apiData?.data?.messages || apiData?.messages || [];

    for (const msg of messages) {
      if (!msg.post_type) {
        msg.post_type = String(msg.user_id) === String(self_id) ? 'message_sent' : 'message';
      }
      if (!msg.self_id) {
        msg.self_id = parseInt(self_id, 10) || 0;
      }
    }

    if (messages.length >= count) return messages.slice(0, count);
    if (messages.length === 0 || (messages.length === 1 && messages[0].message_id === messageId)) {
      return messages;
    }

    // 递归获取更多
    const remaining = count - messages.length;
    const nextMsgId = direction === 'prev'
      ? messages[0].message_id
      : messages[messages.length - 1].message_id;
    const remainingMessages = await getMessagesFromOneBot(onebotWS, id, type, remaining + 1, direction, nextMsgId);

    let combined;
    if (direction === 'prev') {
      combined = [...remainingMessages.slice(0, -1), ...messages];
    } else {
      combined = [...messages, ...remainingMessages.slice(1)];
    }

    if (type === 'private') {
      for (const msg of combined) {
        msg.target_id = id;
      }
    }

    return combined.slice(0, count);
  } catch (e) {
    console.warn('[handler] getMessagesFromOneBot error:', e);
    return [];
  }
}

/**
 * 从 OneBot 获取最近联系人
 * 与 Python 端 OneBotHandler.get_recent_contacts 等效
 *
 * @param {object} onebotWS - OneBotWSConnection 实例
 * @returns {Promise<Array>} 格式化后的联系人列表
 */
export async function getRecentContacts(onebotWS) {
  try {
    const apiData = await onebotWS.callAction('get_recent_contact', { count: 114514 }, null, 60000);
    return formatRecentContacts(apiData?.data || apiData || []);
  } catch (e) {
    console.warn('[handler] getRecentContacts error:', e);
    return [];
  }
}

// ===================== app.py 核心方法 =====================

/**
 * 获取联系人列表（合并数据库 + OneBot API 最近联系人）
 * 与 Python 端 get_contacts_core 等效
 *
 * @param {object} db - virtualDB 实例
 * @param {object} onebotWS - OneBotWSConnection 实例
 * @returns {Promise<Array>} 联系人列表
 */
export async function getContactsCore(db, onebotWS) {
  const selfId = onebotWS.selfId;
  const dbContacts = await db.getContacts(selfId);
  const apiContacts = await getRecentContacts(onebotWS);
  const contactMap = new Map();

  // 安全获取时间戳
  const getTs = item => item.last_timestamp ?? 0;
  // 需要合并的字段配置：[字段名, 前置判断函数]
  const mergeFields = [
    ['latest_msg', (a, b) => !!a.latest_msg && !!a.has_message],
    ['temp', null],
    ['last_timestamp', (a, b) => !!a.last_timestamp],
    ['name', null],
    ['real_name', null],
    ['remark', null],
  ];

  // 载入数据库联系人（使用 _ 分隔符，与真实后端一致）
  for (const c of dbContacts) {
    contactMap.set(`${c.contact_id}_${c.type}`, { ...c });
  }

  // 合并API联系人，时间靠后者优先
  for (const apiItem of apiContacts) {
    const mapKey = `${apiItem.contact_id}_${apiItem.type}`;
    if (!contactMap.has(mapKey)) {
      contactMap.set(mapKey, { ...apiItem });
      continue;
    }

    const dbItem = contactMap.get(mapKey);
    const apiTs = getTs(apiItem);
    const dbTs = getTs(dbItem);
    const merged = { ...dbItem };

    if (apiTs > dbTs) {
      // API更新，直接覆盖符合条件字段
      for (const [field, cond] of mergeFields) {
        if (cond === null || cond(apiItem, dbItem)) {
          merged[field] = apiItem[field];
        }
      }
    } else {
      // DB更新，仅填充空字段（使用 undefined 检查，与真实后端一致）
      for (const [field, cond] of mergeFields) {
        if (cond !== null && !cond(apiItem, dbItem)) continue;
        if (merged[field] === undefined && field in apiItem) {
          merged[field] = apiItem[field];
        }
      }
    }

    contactMap.set(mapKey, merged);
  }

  // 排序：先按 last_timestamp 倒序，再按 last_time 倒序（与真实后端一致）
  return Array.from(contactMap.values()).sort((a, b) => {
    const tsA = -(a.last_timestamp ?? 0);
    const tsB = -(b.last_timestamp ?? 0);
    if (tsA !== tsB) return tsA - tsB;
    const timeA = a.last_time ? new Date(a.last_time).getTime() : 0;
    const timeB = b.last_time ? new Date(b.last_time).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * 获取单条消息
 * 与 Python 端 get_msg_core 等效
 *
 * @param {object} params - { id?, message_id? }
 * @param {object} db - virtualDB 实例
 * @param {object} onebotWS - OneBotWSConnection 实例
 * @returns {Promise<object>} 消息数据
 */
export async function getMsgCore(params, db, onebotWS) {
  const id = params.id ? parseInt(params.id, 10) : null;
  const messageId = params.message_id ? parseInt(params.message_id, 10) : null;

  const type = id !== null ? 'id' : 'message_id';
  const value = id !== null ? id : messageId;

  let msg = await db.getMessage(value, type);

  if (!msg && messageId) {
    try {
      const apiData = await onebotWS.callAction('get_msg', { message_id: messageId }, null, 60000);
      const data = apiData?.data || apiData;
      if (data) {
        msg = convertEventToMessageData(data);
      }
    } catch (e) {
      throw new Error(`Failed to get message from API: ${e}`);
    }
  }

  if (!msg) {
    throw new Error(`Message not found: ${JSON.stringify(params)}`);
  }

  return msg;
}

/**
 * 同步新消息
 * 与 Python 端 sync_messages_core 等效
 *
 * @param {object} params - { last_id }
 * @param {object} db - virtualDB 实例
 * @returns {Promise<{messages: Array, last_id: number}>}
 */
export async function syncMessagesCore(params, db) {
  const lastId = parseInt(params.last_id, 10) || 0;
  const selfId = params.self_id ? parseInt(params.self_id, 10) : null;
  const messages = await db.getNewMessages(lastId, selfId);
  const newLastId = messages.length > 0
    ? Math.max(...messages.map(m => m.id))
    : lastId;
  return {
    messages,
    last_id: newLastId,
  };
}

/**
 * 获取消息列表（合并数据库 + OneBot API）
 * 与 Python 端 get_messages_core 等效
 *
 * 优化：与真实后端 server/src/index.ts 逻辑对齐
 *
 * @param {object} params - 请求参数
 * @param {object} db - virtualDB 实例
 * @param {object} onebotWS - OneBotWSConnection 实例
 * @returns {Promise<{messages: Array, max_id: number, min_id: number, max_real_seq: number|null}>}
 */
export async function getAddRequestsCore(db) {
  /*
  获取加好友/加群请求列表

  从本地数据库查询 post_type='request' 的消息，并标记 approved 状态。

  Args:
      db: VirtualDB 实例

  Returns:
      请求列表
  */
  const requests = await db.getAddRequests();
  return requests;
}

/**
 * 获取消息点赞列表
 * 根据 message_id 和 self_id 查找所有 notice_type 为 group_msg_emoji_like 的消息
 * 对应 server 端 index.ts 的 getMsgLikesCore
 *
 * @param {object} params - { message_id, self_id }
 * @param {object} db - virtualDB 实例
 * @returns {Promise<{likes: Array, self_id: number, message_id: number}>}
 */
export async function getMsgLikesCore(params, db) {
  const messageId = parseInt(params.message_id, 10);
  let selfId = params.self_id ? parseInt(params.self_id, 10) : 0;

  if (!messageId) {
    throw new Error('Missing required parameter: message_id');
  }

  return await db.getMsgLikes(messageId, selfId);
}

export async function getMessagesCore(params, db, onebotWS) {
  const limit = parseInt(params.limit, 10) || 100;
  const cursor = params.cursor ? parseInt(params.cursor, 10) : null;
  const cursorType = params.cursor_type || 'id';
  const direction = params.direction || 'prev';
  const includeCursor = params.include_cursor === true || params.include_cursor === 'true';
  let messageId = parseInt(params.message_id, 10) || 0;
  const cursorTime = params.cursor_time ? parseInt(params.cursor_time, 10) : null;
  const noticeMessage = params.notice_message === true || params.notice_message === 'true';
  const noticeBeforeCursor = parseInt(params.notice_before_message, 10) || -1;
  const noticeAfterCursor = parseInt(params.notice_after_message, 10) || -1;

  const groupId = parseInt(params.group_id, 10) || -1;
  const targetId = parseInt(params.target_id, 10) || -1;
  const userId = parseInt(params.user_id, 10) || -1;
  const messageType = params.message_type;
  const postType = params.post_type;

  // 构建筛选条件
  const filters = [];
  const msgFilter = {};
  // 从 onebotWS 自动获取 self_id 进行筛选
  if (onebotWS.selfId) {
    msgFilter.self_id = parseInt(onebotWS.selfId, 10);
  }
  if (postType) msgFilter.post_type = postType;
  if (messageType) msgFilter.message_type = messageType;
  if (groupId !== -1) msgFilter.group_id = groupId;
  if (targetId !== -1) msgFilter.target_id = targetId;
  if (userId !== -1) msgFilter.user_id = userId;

  if (Object.keys(msgFilter).length > 0) {
    filters.push(msgFilter);
  }

  if (postType === undefined && messageType && userId === -1) {
    // 同时查消息和通知
    const noticeFilter = {
      sub_type: [
        'poke', 'add', 'ban', 'lift_ban', 'approve', 'invite',
        'kick_me', 'remove', 'kick', 'set', 'unset', 'title', null, 'group_name', 'leave'
      ],
      notice_type: [
        'notify', 'essence', 'group_ban', 'group_increase', 'group_decrease',
        'group_msg_emoji_like', 'group_recall', 'friend_recall'
      ],
      post_type: 'notice',
    };
    msgFilter.post_type = ['message', 'message_sent'];
    if (messageType === 'group') {
      msgFilter.sub_type = 'normal';
      noticeFilter.group_id = groupId;
    } else if (messageType === 'private') {
      msgFilter.sub_type = ['friend', 'group'];
      noticeFilter.user_id = targetId;
      noticeFilter.group_id = null;
    }
    filters.push(noticeFilter);
  }

  // 从数据库获取消息
  let dbResult = { messages: [] };
  try {
    dbResult = await db.getMessages({
      limit,
      cursor,
      direction,
      include_cursor: includeCursor,
      filters: filters.length > 0 ? filters : undefined,
      use_real_seq: cursorType === 'real_seq',
      cursor_time: cursorTime,
    });
  } catch (e) {
    console.warn('[handler] DB getMessages error:', e);
  }

  let dbMessages = dbResult.messages || [];
  const result = {
    max_id: dbResult.max_id ?? -1,
    min_id: dbResult.min_id ?? -1,
    max_real_seq: null,
    messages: [],
  };

  // 尝试从 OneBot API 获取更多消息
  let apiMessages = null;
  if (postType === undefined && userId === -1) {
    let foundMessageId = false;

    if (noticeMessage) {
      if (direction === 'prev') {
        // 与真实后端一致：先赋值 noticeAfterCursor，再检查是否为 -1
        messageId = noticeAfterCursor;
        if (messageId === -1) {
          // 尝试找到接近通知之后的消息（getAfter=true）
          const afterMessage = await db.getNearestMessageToNotice(
            cursor,
            groupId !== -1 ? groupId : null,
            targetId !== -1 ? targetId : null,
            false,  // getBefore
            true    // getAfter
          );
          // 检查返回值是否为单个消息对象（非 {before, after} 字典）
          if (afterMessage && !Array.isArray(afterMessage) && !('before' in afterMessage)) {
            messageId = afterMessage.message_id ?? 0;
          } else {
            messageId = 0;
          }
        }
        foundMessageId = true;
      } else if (direction === 'next') {
        // 与真实后端一致：先赋值 noticeBeforeCursor，再检查是否为 -1
        messageId = noticeBeforeCursor;
        if (messageId === -1) {
          // 尝试找到接近通知之前的消息（getBefore=true）
          const beforeMessage = await db.getNearestMessageToNotice(
            cursor,
            groupId !== -1 ? groupId : null,
            targetId !== -1 ? targetId : null,
            true,   // getBefore
            false   // getAfter
          );
          // 检查返回值是否为单个消息对象
          if (beforeMessage && !Array.isArray(beforeMessage) && !('before' in beforeMessage)) {
            messageId = beforeMessage.message_id ?? 0;
            foundMessageId = true;
          }
        } else {
          foundMessageId = true;
        }
      }
    }

    if (!noticeMessage || foundMessageId) {
      if (direction === 'prev' || messageId !== 0) {
        const contactId = messageType === 'group' ? groupId : targetId;
        const rawMessages = await getMessagesFromOneBot(
          onebotWS,
          contactId,
          messageType,
          limit + 1,
          direction,
          messageId,
        );
        apiMessages = rawMessages.map(convertEventToMessageData);

        if (cursorTime !== null) {
          if (direction === 'prev') {
            apiMessages = apiMessages.filter(m => (m.time ?? cursorTime + 1) <= cursorTime);
          } else {
            apiMessages = apiMessages.filter(m => (m.time ?? 0) >= cursorTime);
          }
        }
      }
    }
  }

  if (apiMessages !== null) {
    // 合并列表并按 real_seq 排序
    const merged = new Map();
    const allMsgs = [...apiMessages, ...dbMessages];

    for (const msg of allMsgs) {
      const realSeq = msg.real_seq ?? msg.message_seq;
      if (!isNil(realSeq)) {
        msg.real_seq = realSeq;
        let key = `${msg.post_type}_${realSeq}`;
        if (msg.post_type === 'notice') {
          key += '_' + msg.id
        }
        const oldMsg = merged.get(key);

        // 处理 event 合并逻辑（与真实后端一致）
        if (oldMsg && isString(msg.event) && isString(oldMsg.event)) {
          try {
            const oldEvent = JSON.parse(oldMsg.event);
            const event = JSON.parse(msg.event);
            const oldMessage = oldEvent.message;
            if (!oldMessage) {
              if (!('recall_operator' in event)) {
                event.recall_operator = -1;
                msg.event = JSON.stringify(event);
              }
            } else {
              const dbMessage = event.message || [];
              if (oldMessage.length === dbMessage.length) {
                for (let i = 0; i < oldMessage.length; i++) {
                  const oldData = oldMessage[i].data;
                  const dbData = dbMessage[i].data;
                  if (oldData && dbData && 'url' in oldData && 'url' in dbData) {
                    dbData.url = oldData.url;
                  }
                }
                msg.event = JSON.stringify(event);
              }
            }
          } catch {
            // ignore
          }
        }
        merged.set(key, msg);
      } else {
        merged.set(`${msg.time}_${Math.random()}`, msg);
      }
    }

    const sortedMessages = Array.from(merged.values());
    sortedMessages.sort((a, b) => {
      return (a.time ?? 0) - (b.time ?? 0) ||
        (a.real_seq ?? 0) - (b.real_seq ?? 0) ||
        (a.id ?? 0) - (b.id ?? 0);
    });

    // 根据 include_cursor 过滤
    let messages = sortedMessages;
    if (!includeCursor) {
      messages = messages.filter(m => m.message_id !== messageId);
    }

    // 根据 direction 和 count 提取子集
    if (direction === 'prev') {
      messages = messages.slice(-limit);
    } else {
      messages = messages.slice(0, limit);
    }

    if (messageId === 0 && messages.length > 0) {
      result.max_real_seq = parseInt(messages[messages.length - 1]?.real_seq ?? -1, 10);
    }

    result.messages = messages;
  } else {
    result.messages = dbMessages;
  }

  return result;
}