import Dexie from 'dexie';
import { isString } from "../../types-util.js";

/**
 * 从消息对象中提取联系人信息
 * @param {object} msg - 消息对象
 * @returns {object|null} 联系人信息 { self_id, type, contact_id, name, last_time, last_timestamp, latest_msg } 或 null
 */
function extractContactInfo(msg) {
  if (!msg) return null;

  const postType = msg.post_type;
  const subType = msg.sub_type;
  const groupId = msg.group_id;
  const targetId = msg.target_id;
  const userId = msg.user_id;
  const noticeType = msg.notice_type;
  const ts = msg.time || 0;
  const selfId = msg.self_id;

  let contactId = null;
  let contactType = null;
  let name = null;

  try {
    const event = msg.event ? (isString(msg.event) ? JSON.parse(msg.event) : msg.event) : null;

    // 1. 私聊普通消息
    if (targetId && targetId !== 0 && subType === 'friend' &&
        (postType === 'message' || postType === 'message_sent')) {
      contactId = targetId;
      contactType = 'private';
      name = (event?.sender?.user_id === targetId ? event?.sender?.nickname : null) ?? null;
    }
    // 2. 私聊戳一戳通知
    else if (userId && userId !== 0 && !groupId && subType === 'poke' &&
             noticeType === 'notify' && postType === 'notice') {
      contactId = userId;
      contactType = 'private';
    }
    // 3. 群聊普通消息
    else if (groupId && groupId !== 0 && subType === 'normal' &&
             (postType === 'message' || postType === 'message_sent')) {
      contactId = groupId;
      contactType = 'group';
      name = event?.group_name ?? null;
    }
    // 4. 群聊通知
    else if (groupId && groupId !== 0 && postType === 'notice' &&
             ['poke', 'add', 'ban', 'lift_ban', 'approve', 'invite', 'kick_me', 'remove', 'kick', 'set', 'unset', 'title', null, 'group_name', 'leave'].includes(subType) &&
             ['notify', 'essence', 'group_ban', 'group_increase', 'group_decrease', 'group_msg_emoji_like', 'group_recall', 'friend_recall'].includes(noticeType)) {
      contactId = groupId;
      contactType = 'group';
      name = event?.group_name ?? null;
    }
  } catch {
    // ignore parse errors
  }

  if (contactId === null || contactId === 0 || selfId === null || selfId === undefined) {
    return null;
  }

  return {
    self_id: selfId,
    type: contactType,
    contact_id: contactId,
    name: name,
    last_time: msg.created_at,
    last_timestamp: ts,
    latest_msg: msg.event,
  };
}

/**
 * 本地 Dexie.js 数据库，仅存储消息，
 * 替代 Python 后端的 SQLite 数据库。
 * 联系人数据通过 contacts 表维护（在 saveMessage 时同步更新），
 * 避免 getContacts 全表扫描 messages 表。
 *
 * 优化说明：
 * - 所有 getMessages 查询优先使用 Dexie 索引 + limit 避免全表加载
 * - getContacts 直接从 contacts 表查询，O(1) 无全表扫描
 * - getMessages 的 use_real_seq 路径使用 orderBy('id') + filter() + limit() 游标扫描
 * - getNearestMessageToNotice 使用 reverse().first() 索引查询
 * - 添加 [self_id+id] 复合索引加速常见查询
 */
class VirtualDB extends Dexie {
  constructor() {
    super('QirenoVirtualBackend');

    // 定义数据库表结构（v3 增加 contacts 表）
    this.version(3).stores({
      messages: `
        ++id,
        message_id,
        real_seq,
        time,
        self_id,
        sender_id,
        post_type,
        message_type,
        notice_type,
        request_type,
        sub_type,
        group_id,
        user_id,
        operator_id,
        target_id,
        *created_at,
        [self_id+id],
        [self_id+group_id+id],
        [self_id+target_id+id]
      `,
      meta: 'key',
      contacts: `
        &[self_id+type+contact_id],
        self_id,
        type,
        contact_id,
        [self_id+last_timestamp]
      `,
    }).upgrade(async (tx) => {
      // 从现有 messages 表填充 contacts 表（v2 → v3 迁移）
      const msgs = tx.table('messages');
      const contacts = tx.table('contacts');
      const contactMap = new Map();

      await msgs.each(msg => {
        const info = extractContactInfo(msg);
        if (info) {
          const key = `${info.self_id}_${info.type}_${info.contact_id}`;
          const existing = contactMap.get(key);
          if (!existing || existing.last_timestamp < info.last_timestamp) {
            contactMap.set(key, info);
          }
        }
      });

      if (contactMap.size > 0) {
        await contacts.bulkAdd([...contactMap.values()]);
      }
    });

    /**
     * 保存消息到数据库，并同步更新 contacts 表
     * @param {object} messageData - 标准化后的消息数据
     * @returns {Promise<number>} 消息自增ID
     */
    this.saveMessage = async (messageData) => {
      const msgId = await this.messages.add({
        message_id: messageData.message_id ?? null,
        real_seq: messageData.real_seq ?? null,
        time: messageData.time ?? Math.floor(Date.now() / 1000),
        self_id: messageData.self_id ?? null,
        sender_id: messageData.sender_id ?? null,
        post_type: messageData.post_type ?? null,
        message_type: messageData.message_type ?? null,
        notice_type: messageData.notice_type ?? null,
        request_type: messageData.request_type ?? null,
        sub_type: messageData.sub_type ?? null,
        group_id: messageData.group_id ?? null,
        user_id: messageData.user_id ?? null,
        operator_id: messageData.operator_id ?? null,
        target_id: messageData.target_id ?? null,
        event: messageData.event ?? null,
        created_at: messageData.created_at ?? new Date().toISOString(),
      });

      // 同步更新 contacts 表
      await this._updateContacts({
        ...messageData,
        id: msgId,
      });

      return msgId;
    };

    /**
     * 根据 message_id 或 id 查询消息
     * 对应 Python db.py 的 get_msg
     * @param {number|string} id - 查询值
     * @param {'message_id'|'id'} type - 查询类型
     * @returns {Promise<object|null>}
     */
    this.getMessage = async (id, type = 'message_id') => {
      if (type === 'id') {
        return await this.messages.get(id) ?? null;
      }
      // message_id 查询，只返回 message/message_sent 类型
      const msg = await this.messages
        .where('message_id')
        .equals(id)
        .filter(m => ['message', 'message_sent'].includes(m.post_type))
        .first();
      return msg ?? null;
    };

    /**
     * 获取消息列表（支持游标分页、筛选）
     * 对应 Python db.py 的 get_messages
     *
     * 优化：使用 Dexie 索引 + limit 避免全表加载到内存。
     * - 无筛选条件时：直接使用 where('id').above/below + limit 索引查询
     * - 有筛选条件时：使用 primaryKeys() 仅获取主键，再按需 fetch
     * - use_real_seq 路径：使用 orderBy('id') + filter() + limit() 游标扫描，
     *   避免将所有匹配记录加载到内存
     *
     * @param {object} opts
     * @returns {Promise<{messages: Array, max_id: number, min_id: number}>}
     */
    this.getMessages = async (opts = {}) => {
      const {
        limit = 100,
        cursor = null,
        direction = 'prev',
        include_cursor = false,
        filters = null,
        use_real_seq = false,
        cursor_time = null,
      } = opts;

      const idField = use_real_seq ? 'real_seq' : 'id';
      const result = { messages: [], max_id: -1, min_id: -1 };

      // ========== 构建筛选函数（复用） ==========
      const makeFilterFn = () => {
        if (!filters) return null;
        const filterList = Array.isArray(filters) ? filters : [filters];
        return (msg) => {
          return filterList.some(filterDict => {
            return Object.entries(filterDict).every(([field, value]) => {
              if (value === null || value === undefined) return true;
              const msgVal = msg[field];
              if (Array.isArray(value)) {
                return value.includes(msgVal);
              }
              return msgVal === value;
            });
          });
        };
      };

      // ========== 获取全局 min/max id ==========
      // 使用 idField 计算 min/max（与真实后端一致）
      const filterFn = makeFilterFn();

      if (!filterFn) {
        // 无筛选：使用 primaryKeys 获取范围（primaryKeys 返回已排序的键）
        const allKeys = await this.messages.orderBy('id').primaryKeys();
        if (allKeys.length > 0) {
          result.min_id = allKeys[0];
          result.max_id = allKeys[allKeys.length - 1];
        }
      } else {
        // 有筛选：使用 primaryKeys() 获取符合条件的主键（仅索引，不加载全部记录）
        let collection = this.messages.toCollection();
        collection = collection.filter(filterFn);
        const allIds = await collection.primaryKeys();
        if (allIds.length > 0) {
          // primaryKeys 返回已排序的键，直接用首尾元素
          result.min_id = allIds[0];
          result.max_id = allIds[allIds.length - 1];
        }
      }

      // 如果没有数据，直接返回
      if (result.min_id === -1 || result.max_id === -1) {
        return result;
      }

      // ========== 获取分页消息 ==========
      // 处理游标默认值
      let effectiveCursor = cursor;
      if (effectiveCursor === null) {
        effectiveCursor = direction === 'prev' ? result.max_id : result.min_id;
      }

      // 根据是否使用 real_seq 走不同路径
      if (use_real_seq) {
        // ===== real_seq 模式：使用 orderBy('id') + filter() + limit() 游标扫描 =====
        // 避免加载所有匹配记录到内存。Dexie 的 filter() + limit(limit) 会在收集到
        // 足够条数后停止迭代，不需要遍历所有记录。

        // 构建复合游标过滤函数
        const cursorFilter = (msg) => {
          if (cursor_time !== null) {
            // 使用 time + real_seq 复合游标（与真实后端一致）
            const cursorVal = msg[idField];
            const timeVal = msg.time;
            if (direction === 'prev') {
              return timeVal < cursor_time || (timeVal === cursor_time && cursorVal < effectiveCursor);
            } else {
              return timeVal > cursor_time || (timeVal === cursor_time && cursorVal > effectiveCursor);
            }
          } else {
            // 简单游标：仅使用 real_seq
            const cursorVal = msg[idField];
            if (direction === 'prev') {
              return include_cursor ? cursorVal <= effectiveCursor : cursorVal < effectiveCursor;
            } else {
              return include_cursor ? cursorVal >= effectiveCursor : cursorVal > effectiveCursor;
            }
          }
        };

        // 合并筛选函数和游标过滤
        const combinedFilter = (msg) => {
          if (filterFn && !filterFn(msg)) return false;
          return cursorFilter(msg);
        };

        let collection;
        if (direction === 'prev') {
          // prev：按 id 降序遍历，取 limit 条符合条件的，再反转回升序
          collection = this.messages
            .orderBy('id')
            .reverse()
            .filter(combinedFilter);
        } else {
          // next：按 id 升序遍历，取 limit 条符合条件的
          collection = this.messages
            .orderBy('id')
            .filter(combinedFilter);
        }

        const msgs = await collection.limit(limit).toArray();

        // prev 方向反转回来保持时间顺序
        if (direction === 'prev') {
          msgs.reverse();
        }

        result.messages = msgs;
      } else {
        // ===== id 模式（默认）：使用索引查询，避免加载所有记录 =====

        if (!filterFn) {
          // === 无筛选条件：纯索引查询，最高效 ===
          let query;
          if (direction === 'prev') {
            if (include_cursor) {
              query = this.messages
                .where('id')
                .belowOrEqual(effectiveCursor)
                .reverse()
                .limit(limit);
            } else {
              query = this.messages
                .where('id')
                .below(effectiveCursor)
                .reverse()
                .limit(limit);
            }
          } else {
            if (include_cursor) {
              query = this.messages
                .where('id')
                .aboveOrEqual(effectiveCursor)
                .limit(limit);
            } else {
              query = this.messages
                .where('id')
                .above(effectiveCursor)
                .limit(limit);
            }
          }

          result.messages = await query.toArray();

          // prev 方向 reverse 后再反转回来保持时间顺序
          if (direction === 'prev') {
            result.messages.reverse();
          }
        } else {
          // === 有筛选条件：使用 primaryKeys 按需加载 ===
          if (direction === 'prev') {
            // prev 方向：只获取 id < cursor 的记录
            let collection;
            if (include_cursor) {
              collection = this.messages
                .where('id')
                .belowOrEqual(effectiveCursor)
                .filter(filterFn);
            } else {
              collection = this.messages
                .where('id')
                .below(effectiveCursor)
                .filter(filterFn);
            }

            // 获取所有匹配主键（仅索引，高效）
            const ids = await collection.primaryKeys();
            // 取倒数 limit 条
            const targetIds = ids.slice(-limit);
            const msgs = await this.messages.where(':id').anyOf(targetIds).toArray();
            msgs.sort((a, b) => a.id - b.id);
            result.messages = msgs;
          } else {
            // next 方向：只获取 id > cursor 的记录
            let collection;
            if (include_cursor) {
              collection = this.messages
                .where('id')
                .aboveOrEqual(effectiveCursor)
                .filter(filterFn);
            } else {
              collection = this.messages
                .where('id')
                .above(effectiveCursor)
                .filter(filterFn);
            }

            const ids = await collection.primaryKeys();
            // 取正数 limit 条
            const targetIds = ids.slice(0, limit);
            const msgs = await this.messages.where(':id').anyOf(targetIds).toArray();
            msgs.sort((a, b) => a.id - b.id);
            result.messages = msgs;
          }
        }
      }

      return result;
    };

    /**
     * 获取联系人列表（从 contacts 表查询，避免全表扫描 messages 表）
     * 对应 Python db.py 的 get_contacts
     *
     * 优化：contacts 表在 saveMessage 时同步更新，查询时直接读取，
     * 无需遍历所有消息记录。
     *
     * @param {number|null} selfId - 筛选 self_id
     * @returns {Promise<Array>}
     */
    this.getContacts = async (selfId = null) => {
      let collection;
      if (selfId !== null) {
        const selfIdNum = parseInt(selfId, 10);
        collection = this.contacts.where('self_id').equals(selfIdNum);
      } else {
        collection = this.contacts.toCollection();
      }

      const contacts = await collection.toArray();

      // 排序：先按 last_timestamp 倒序，再按 last_time 倒序（与真实后端一致）
      contacts.sort((a, b) => {
        const tsA = -(a.last_timestamp ?? 0);
        const tsB = -(b.last_timestamp ?? 0);
        if (tsA !== tsB) return tsA - tsB;
        const timeA = a.last_time ? new Date(a.last_time).getTime() : 0;
        const timeB = b.last_time ? new Date(b.last_time).getTime() : 0;
        return timeB - timeA;
      });

      // 过滤掉无效 contact_id
      return contacts.filter(c => c.contact_id && c.contact_id !== 0);
    };

    /**
     * 获取新消息（大于指定ID）
     * 对应 Python db.py 的 get_new_messages
     * @param {number} lastId
     * @returns {Promise<Array>}
     */
    this.getNewMessages = async (lastId = 0, selfId = null) => {
      let collection = this.messages
        .where('id')
        .above(lastId);
      if (selfId !== null) {
        const selfIdNum = parseInt(selfId, 10);
        collection = collection.filter(m => m.self_id === selfIdNum);
      }
      return collection.sortBy('id');
    };

    /**
     * 处理撤回事件，更新原始消息的 event 字段
     * 对应 Python db.py 的 process_recall_event
     * @param {object} event - 撤回事件
     */
    this.processRecallEvent = async (event) => {
      if (event.post_type !== 'notice' ||
        !['group_recall', 'friend_recall'].includes(event.notice_type)) {
        return null;
      }

      const messageId = event.message_id;
      if (!messageId) return null;

      const originalMsg = await this.getMessage(messageId, 'message_id');
      if (!originalMsg) return null;

      let originalEvent = originalMsg.event;
      if (isString(originalEvent)) {
        try {
          originalEvent = JSON.parse(originalEvent);
        } catch {
          return null;
        }
      }

      originalEvent.recall_operator = event.notice_type === 'group_recall'
        ? event.operator_id
        : originalMsg.user_id;

      const updatedEvent = JSON.stringify(originalEvent);
      await this.messages.update(originalMsg.id, { event: updatedEvent });
    };

    /**
     * 获取与指定通知消息最接近的前后消息
     * 对应 Python db.py 的 get_nearest_message_to_notice
     *
     * 优化：使用 reverse().first() 和 limit(1) 索引查询，避免全表加载
     *
     * 参数顺序与真实后端 server/src/db.ts 一致
     *
     * @param {number} noticeId - 通知消息的 ID
     * @param {number|null} groupId - 群组 ID 筛选
     * @param {number|null} targetId - 目标 ID 筛选
     * @param {boolean} getBefore - 是否获取 id 较小的前一条消息
     * @param {boolean} getAfter - 是否获取 id 较大的后一条消息
     * @returns {Promise<{before: object|null, after: object|null}|object|null>}
     */
    this.getNearestMessageToNotice = async (noticeId, groupId = null, targetId = null, getBefore = true, getAfter = true) => {
      const notice = await this.messages.get(parseInt(noticeId, 10));
      if (!notice) {
        if (getBefore && !getAfter) return null;
        if (getAfter && !getBefore) return null;
        return { before: null, after: null };
      }

      const result = {};

      // 构建基础筛选
      const baseFilter = (m) =>
        (m.post_type === 'message' || m.post_type === 'message_sent') &&
        (m.message_type === 'group' || m.post_type === 'private') &&
        (m.sub_type === 'normal' || m.sub_type === 'friend' || m.sub_type === 'group');

      if (getBefore) {
        // 使用索引 below + reverse + first() 获取前一条消息
        let query = this.messages
          .where('id')
          .below(notice.id)
          .filter(baseFilter);

        if (groupId) {
          const msgs = await query
            .filter(m => m.group_id === groupId)
            .reverse()
            .limit(1)
            .toArray();
          result.before = msgs[0] || null;
        } else if (targetId) {
          const msgs = await query
            .filter(m => m.target_id === targetId)
            .reverse()
            .limit(1)
            .toArray();
          result.before = msgs[0] || null;
        } else {
          const msg = await query.reverse().first();
          result.before = msg || null;
        }
      }

      if (getAfter) {
        // 使用索引 above + first() 获取后一条消息
        let query = this.messages
          .where('id')
          .above(notice.id)
          .filter(baseFilter);

        if (groupId) {
          const msgs = await query
            .filter(m => m.group_id === groupId)
            .limit(1)
            .toArray();
          result.after = msgs[0] || null;
        } else if (targetId) {
          const msgs = await query
            .filter(m => m.target_id === targetId)
            .limit(1)
            .toArray();
          result.after = msgs[0] || null;
        } else {
          const msg = await query.first();
          result.after = msg || null;
        }
      }

      if (!getBefore && getAfter) return result.after;
      if (getBefore && !getAfter) return result.before;
      return result;
    };

    /**
     * 获取加好友/加群请求列表，并标记是否已通过
     * 对应 server 端 db.ts 的 getAddRequests
     *
     * @returns {Promise<Array<object>>} 请求列表，每条消息的 event 已添加 approved 标记
     */
    this.getAddRequests = async () => {
      // 1. 查询所有请求消息
      const requests = await this.messages
        .where('post_type')
        .equals('request')
        .filter(m => (m.request_type === 'friend' || m.request_type === 'group') &&
                      (m.sub_type === 'add' || m.sub_type === 'invite' || m.sub_type === null || m.sub_type === undefined))
        .toArray();

      // 按 time 倒序排列，time 相同则按 id 倒序（新的在前）
      requests.sort((a, b) => {
        const timeA = a.time || 0;
        const timeB = b.time || 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
      });

      // 2. 批量查询 approved 状态
      for (const req of requests) {
        let approved = null;
        let eventObj = {};

        try {
          eventObj = typeof req.event === 'string' ? JSON.parse(req.event) : (req.event || {});
        } catch {
          eventObj = {};
        }

        if (req.request_type === 'friend') {
          // 查找后续 friend_add 通知
          const friendAdd = await this.messages
            .where('id')
            .above(req.id)
            .filter(m => m.post_type === 'notice' &&
                         m.notice_type === 'friend_add' &&
                         m.user_id === req.user_id)
            .limit(1)
            .toArray();
          approved = friendAdd.length > 0 ? true : null;
        } else if (req.request_type === 'group') {
          // 查找后续 group_increase 通知
          const groupApprove = await this.messages
            .where('id')
            .above(req.id)
            .filter(m => m.post_type === 'notice' &&
                         m.notice_type === 'group_increase' &&
                         m.group_id === req.group_id &&
                         m.user_id === req.user_id)
            .limit(1)
            .toArray();
          approved = groupApprove.length > 0 ? true : null;
        }

        eventObj.approved = approved;
        req.event = JSON.stringify(eventObj);
      }

      return requests;
    };

    /**
     * 根据消息更新 contacts 表
     * 仅在 saveMessage 时调用，确保 contacts 表始终与 messages 表同步
     * @param {object} msg - 已保存的消息对象（含 id）
     * @private
     */
    this._updateContacts = async (msg) => {
      const info = extractContactInfo(msg);
      if (!info) return;

      // 使用复合主键 [self_id, type, contact_id] 检查是否已存在
      const existing = await this.contacts.get([info.self_id, info.type, info.contact_id]);

      // 仅当新消息的时间戳更新时，才更新 contacts 表
      if (!existing || (existing.last_timestamp ?? 0) < info.last_timestamp) {
        await this.contacts.put(info);
      }
    };
  }
}

export const virtualDB = new VirtualDB();