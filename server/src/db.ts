import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * 数据库行接口
 */
export interface MessageRow {
  id: number;
  message_id: number | null;
  real_seq: number | null;
  time: number | null;
  self_id: number | null;
  sender_id: number | null;
  post_type: string | null;
  message_type: string | null;
  notice_type: string | null;
  request_type: string | null;
  sub_type: string | null;
  group_id: number | null;
  user_id: number | null;
  operator_id: number | null;
  target_id: number | null;
  event: string | null;
  created_at: string | null;
}

/**
 * 联系人行接口
 */
export interface ContactRow {
  contact_id: number;
  type: string;
  name: string | null;
  last_time: string;
  last_timestamp: number;
  latest_msg: string | null;
}

/**
 * 消息筛选条件
 */
export type FilterValue = string | number | boolean | null | Array<string | number | boolean | null>;

export interface FilterDict {
  [key: string]: FilterValue;
}

/**
 * 获取消息返回值
 */
export interface GetMessagesResult {
  max_id: number;
  min_id: number;
  messages: MessageRow[];
  max_real_seq?: number | null;
}

function createTables(db: Database.Database): void {
  /* 创建数据库表结构 */
  db.exec(`CREATE TABLE IF NOT EXISTS messages
           (
               id           INTEGER PRIMARY KEY AUTOINCREMENT,
               message_id   INTEGER,
               real_seq     INTEGER,
               time         INTEGER,
               self_id      INTEGER,
               sender_id    INTEGER,
               post_type    TEXT,
               message_type TEXT,
               notice_type  TEXT,
               request_type TEXT,
               sub_type     TEXT,
               group_id     INTEGER,
               user_id      INTEGER,
               operator_id  INTEGER,
               target_id    INTEGER,
               event        TEXT,
               created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S+00:00', 'now'))
           )`);
}

function checkAndUpdateSchema(db: Database.Database): void {
  /* 检查并更新数据库结构 */
  const tableInfo = db.pragma('table_info(messages)') as Array<{
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number
  }>;
  const columns = new Set(tableInfo.map((row) => row.name));
  const requiredColumns = new Set([
    'id', 'message_id', 'real_seq', 'time', 'self_id', 'sender_id', 'post_type',
    'message_type', 'notice_type', 'request_type', 'sub_type', 'group_id', 'user_id', 'operator_id',
    'target_id', 'event', 'created_at',
  ]);

  const missingColumns = [ ...requiredColumns ].filter((col) => !columns.has(col));
  if (missingColumns.length > 0) {
    for (const column of missingColumns) {
      let colType = 'TEXT';
      if (column === 'id') {
        colType = 'INTEGER PRIMARY KEY AUTOINCREMENT';
      } else if ([ 'message_id', 'real_seq', 'time', 'self_id', 'sender_id', 'group_id', 'user_id', 'operator_id', 'target_id' ].includes(column)) {
        colType = 'INTEGER';
      } else if (column === 'created_at') {
        colType = "TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S+00:00', 'now'))";
      }
      try {
        db.exec(`ALTER TABLE messages
            ADD COLUMN ${column} ${colType}`);
      } catch {
        // 如果添加列失败（例如列已存在但类型不同），忽略
      }
    }
  }
}

export class DatabaseManager {
  private db!: Database.Database;
  private dbFile: string;

  constructor(dbFile: string) {
    this.dbFile = dbFile;
    this.ensureDbIntegrity();
  }

  private ensureDbIntegrity(): void {
    /* 确保数据库存在且结构完整 */
    const dbExists = existsSync(this.dbFile);
    // 确保数据库文件所在目录存在
    const dir = dirname(this.dbFile);
    if (dir !== '.') {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(this.dbFile);
    this.db.pragma('journal_mode = WAL');
    if (!dbExists) {
      // 全新数据库，创建完整结构
      createTables(this.db);
    } else {
      // 检查现有数据库结构
      checkAndUpdateSchema(this.db);
    }
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  saveMessage(messageData: Record<string, unknown>): number {
    /* 保存消息到数据库 */
    const stmt = this.db.prepare(`INSERT INTO messages
                                  (message_id, real_seq, time, self_id, sender_id, post_type, message_type, notice_type, request_type,
                                   sub_type, group_id, user_id, operator_id, target_id, event, created_at)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(
      messageData['message_id'] ?? null,
      messageData['real_seq'] ?? null,
      messageData['time'] ?? null,
      messageData['self_id'] ?? null,
      messageData['sender_id'] ?? null,
      messageData['post_type'] ?? null,
      messageData['message_type'] ?? null,
      messageData['notice_type'] ?? null,
      messageData['request_type'] ?? null,
      messageData['sub_type'] ?? null,
      messageData['group_id'] ?? null,
      messageData['user_id'] ?? null,
      messageData['operator_id'] ?? null,
      messageData['target_id'] ?? null,
      messageData['event'] ?? null,
      new Date().toISOString(),
    );
    return Number(result.lastInsertRowid);
  }

  getMsg(id: number, type: 'message_id' | 'id' = 'message_id'): MessageRow | null {
    /* 根据指定类型和ID从数据库查询消息

    Args:
        id: 要查询的消息ID值
        type: 查询类型，可以是'message_id'或'id'，默认为'message_id'

    Returns:
        返回匹配的消息记录，如果未找到则返回None
    */
    if (![ 'message_id', 'id' ].includes(type)) {
      throw new Error("type参数必须是'message_id'或'id'");
    }
    const stmt = this.db.prepare(
      `SELECT *
       FROM messages
       WHERE ${type} = ?
         AND post_type IN ('message', 'message_sent')`,
    );
    const row = stmt.get(id) as MessageRow | undefined;
    return row ?? null;
  }

  getMessages(
    limit: number = 100,
    cursor: number | null = null,
    direction: string = 'prev',
    includeCursor: boolean = false,
    filters: FilterDict | FilterDict[] | null = null,
    useRealSeq: boolean = false,
    cursorTime: number | null = null,
  ): GetMessagesResult {
    /*
    获取消息列表，使用游标分页（基于自增ID或real_seq）解决大数据量性能问题和数据变动问题

    :param limit: 返回记录数
    :param cursor: 游标ID（起始ID或real_seq）
    :param direction: 分页方向 "prev"（获取比游标旧的消息）或 "next"（获取比游标新的消息）
    :param includeCursor: 是否包含游标所在的消息
    :param filters: 筛选条件字典，键为字段名，值为筛选值或值列表
                   (只允许筛选预定义的字段)
                   可以传入包含多个筛选条件字典的列表，符合其中一个就可以筛选到
    :param useRealSeq: 是否使用real_seq作为游标字段（默认为false使用id）
    :param cursorTime: （useRealSeq为true时使用）以时间作为游标（最好使用real_seq和id，因为时间可能重复）
    :return: 包含max_id, min_id和消息列表的字典（当useRealSeq=true时，max_id/min_id对应real_seq）
    */
    // 定义允许筛选的安全字段及其类型
    const ALLOWED_FILTER_FIELDS: Record<string, string> = {
      'message_id': 'int',
      'real_seq': 'int',
      'user_id': 'int',
      'self_id': 'int',
      'sender_id': 'int',
      'operator_id': 'int',
      'group_id': 'int',
      'target_id': 'int',
      'message_type': 'str',
      'notice_type': 'str',
      'request_type': 'str',
      'sub_type': 'str',
      'created_at': 'str',
      'raw_message': 'str',
    };

    const result: GetMessagesResult = {
      max_id: -1,
      min_id: -1,
      messages: [],
    };

    // 根据是否使用real_seq决定统计字段
    const idField = useRealSeq ? 'real_seq' : 'id';

    // 构建筛选条件
    const params: unknown[] = [];
    const filterConditions: string[] = [];

    if (filters) {
      const filterList = Array.isArray(filters) ? filters : [ filters ];
      const orConditions: string[] = [];

      for (const filterDict of filterList) {
        const andConditions: string[] = [];
        for (const [ field, value ] of Object.entries(filterDict)) {
          // 检查字段是否允许筛选
          if (!(field in ALLOWED_FILTER_FIELDS)) continue;

          // 处理多值情况
          if (Array.isArray(value)) {
            const validValues: unknown[] = [];
            for (const v of value) {
              if (v === null) {
                validValues.push(v);
                continue;
              }
              // 类型转换已在Python版中实现，这里简化处理
              validValues.push(v);
            }

            if (validValues.length > 0) {
              const nullCondition = validValues.includes(null) ? `${field} IS NULL` : '';
              const nonNullValues = validValues.filter((v) => v !== null);

              const conditions: string[] = [];
              if (nonNullValues.length > 0) {
                const placeholders = nonNullValues.map(() => '?').join(', ');
                conditions.push(`${field} IN (${placeholders})`);
              }
              if (nullCondition) {
                conditions.push(nullCondition);
              }

              if (conditions.length > 0) {
                andConditions.push(
                  conditions.length > 1 ? `( ${conditions.join(' OR ')} )` : conditions[0]!,
                );
                params.push(...nonNullValues);
              }
            }
          } else {
            // 单值情况
            if (value === null) {
              andConditions.push(`${field} IS NULL`);
            } else {
              andConditions.push(`${field} = ?`);
              params.push(value);
            }
          }
        }

        if (andConditions.length > 0) {
          orConditions.push(`( ${andConditions.join(' AND ')} )`);
        }
      }

      if (orConditions.length > 0) {
        filterConditions.push(
          orConditions.length > 1 ? `( ${orConditions.join(' OR ')} )` : orConditions[0]!,
        );
      }
    }

    // 获取当前筛选条件下的最大最小ID
    let countQuery = `SELECT MIN(${idField}) as min_id, MAX(${idField}) as max_id
                      FROM messages`;
    if (filterConditions.length > 0) {
      countQuery += ' WHERE ' + filterConditions.join(' AND ');
    }

    const idRange = this.db.prepare(countQuery).get(...params) as {
      min_id: number | null;
      max_id: number | null
    } | undefined;
    const minId = idRange?.min_id ?? -1;
    const maxId = idRange?.max_id ?? -1;

    // 如果没有数据，直接返回
    if (minId === -1 || maxId === -1) {
      return result;
    }

    result.min_id = minId;
    result.max_id = maxId;

    // 处理游标逻辑
    let effectiveCursor = cursor;
    if (effectiveCursor === null) {
      effectiveCursor = direction === 'prev' ? maxId : minId;
    }

    // 构建主查询
    let query = 'SELECT * FROM messages';
    if (filterConditions.length > 0) {
      query += ' WHERE ' + filterConditions.join(' AND ');
    }

    // 添加游标条件
    let cursorCalcSymbol: string;
    let order: string;
    if (direction === 'prev') {
      cursorCalcSymbol = includeCursor ? '<=' : '<';
      order = 'DESC';
    } else {
      cursorCalcSymbol = includeCursor ? '>=' : '>';
      order = 'ASC';
    }

    const cursorParams: unknown[] = [];
    if (filterConditions.length > 0) {
      query += ' AND ';
    } else {
      query += ' WHERE ';
    }

    if (useRealSeq && cursorTime !== null) {
      query += `( time ${cursorCalcSymbol} ? OR ${idField} ${cursorCalcSymbol} ? )`;
      cursorParams.push(cursorTime, effectiveCursor);
    } else {
      query += `${idField} ${cursorCalcSymbol} ?`;
      cursorParams.push(effectiveCursor);
    }

    query += ` ORDER BY id ${order} LIMIT ?`;
    cursorParams.push(limit);

    const allParams = [ ...params, ...cursorParams ];
    const rows = this.db.prepare(query).all(...allParams) as MessageRow[];

    // 如果是prev方向且降序查询，需要反转结果以保持时间顺序
    if (direction === 'prev') {
      rows.reverse();
    }

    result.messages = rows;
    return result;
  }

  getContacts(selfId: number | null = null, showEmojiLikeNotice: boolean = false): ContactRow[] {
    /* 获取联系人列表 */
    const selfIdCondition = selfId !== null ? 'AND self_id = ?' : '';
    const selfIdParams: unknown[] = selfId !== null ? [ selfId, selfId ] : [];

    const query = `
        WITH all_raw AS (
            -- 私聊原始消息
            SELECT sub.contact_id,
                   'private' AS type,
                   CASE
                       WHEN json_extract(sub.event, '$.sender.user_id') = sub.contact_id
                           THEN json_extract(sub.event, '$.sender.nickname')
                       ELSE NULL
                       END   AS name,
                   sub.created_at,
                   sub.time,
                   sub.event,
                   ROW_NUMBER() OVER (
                       PARTITION BY sub.contact_id, 'private'
                       ORDER BY sub.time DESC
                       )     AS rn
            FROM (SELECT CASE
                             WHEN post_type = 'notice' THEN user_id
                             ELSE target_id
                             END AS contact_id,
                         created_at,
                         time,
                         event
                  FROM messages
                  WHERE (
                            -- 普通私聊消息
                            (
                                target_id IS NOT NULL
                                    AND target_id != 0
                                    AND sub_type = 'friend'
                                    AND post_type IN ('message', 'message_sent')
                                )
                                OR
                                -- 私聊戳一戳通知
                            (
                                user_id IS NOT NULL
                                    AND user_id != 0
                                    AND group_id IS NULL
                                    AND sub_type = 'poke'
                                    AND (
                                    (notice_type = 'notify' AND sub_type = 'poke')
                                        OR notice_type IN ('group_recall', 'friend_recall')
                                    )
                                )
                            )
                      ${selfIdCondition}) AS sub

            UNION ALL

            -- 群聊原始消息
            SELECT group_id                            AS contact_id,
                   'group'                             AS type,
                   json_extract(event, '$.group_name') AS name,
                   created_at,
                   time,
                   event,
                   ROW_NUMBER() OVER (
                       PARTITION BY group_id, 'group'
                       ORDER BY time DESC
                       )                               AS rn
            FROM messages
            WHERE (
                      -- 普通群消息
                      (
                          group_id IS NOT NULL
                              AND group_id != 0
                              AND sub_type = 'normal'
                              AND post_type IN ('message', 'message_sent')
                          )
                          OR
                          -- 群通知
                      (
                          group_id IS NOT NULL
                              AND group_id != 0
                              AND notice_type IN (
                                                  'notify', 'essence', 'group_ban', 'group_increase',
                                                  'group_decrease', 'group_admin',
                                                  'group_recall', 'friend_recall'
                                                  ${showEmojiLikeNotice ? ", 'group_msg_emoji_like'" : ''}
                              )
                              AND (
                              -- 普通通知 需要 sub_type
                              (
                                  notice_type NOT IN ('group_recall', 'friend_recall')
                                      AND sub_type IN (
                                                       'poke', 'add', 'ban', 'lift_ban', 'approve',
                                                       'invite', 'kick_me', 'remove', 'kick', 'set', 'unset', 'title',
                                                       'group_name', 'leave'
                                      )
                                  )
                                  -- sub_type 可以为空，不再校验
                                  OR notice_type IN ('group_recall', 'friend_recall'${showEmojiLikeNotice ? ", 'group_msg_emoji_like'" : ''})
                              )
                          )
                      )
                ${selfIdCondition})
        SELECT contact_id,
               type,
               name,
               created_at AS last_time,
               time       AS last_timestamp,
               event      AS latest_msg
        FROM all_raw
        WHERE rn = 1
          AND contact_id IS NOT NULL
          AND contact_id != 0
        ORDER BY last_timestamp DESC,
                 last_time DESC;
    `;

    return this.db.prepare(query).all(...selfIdParams) as ContactRow[];
  }

  getNewMessages(lastReceivedId: number = 0, selfId: number | null = null): MessageRow[] {
    /*
    获取比指定ID更新的消息
    :param lastReceivedId: 客户端最后收到的消息ID
    :param selfId: 可选，按 self_id 筛选
    :return: 新消息列表
    */
    if (selfId !== null) {
      return this.db.prepare(
        'SELECT * FROM messages WHERE id > ? AND self_id = ? ORDER BY id ASC',
      ).all(lastReceivedId, selfId) as MessageRow[];
    } else {
      return this.db.prepare(
        'SELECT * FROM messages WHERE id > ? ORDER BY id ASC',
      ).all(lastReceivedId) as MessageRow[];
    }
  }

  processRecallEvent(event: Record<string, unknown>): MessageRow | null {
    /*
    处理撤回事件，更新原始消息的event字段添加recall_operator信息

    Args:
        event: 撤回事件的字典数据，必须包含:
               - notice_type: 'group_recall' 或 'friend_recall'
               - message_id: 被撤回的消息ID
               - operator_id: (group_recall时使用)
               - user_id: (friend_recall时使用)

    Returns:
        更新后的原始消息字典，如果未找到则返回None
    */
    // 验证是否为撤回事件
    if (event['post_type'] !== 'notice' || ![ 'group_recall', 'friend_recall' ].includes(event['notice_type'] as string)) {
      return null;
    }

    const messageId = event['message_id'] as number | undefined;
    if (!messageId) return null;

    // 查找原始消息
    const stmt = this.db.prepare(
      `SELECT *
       FROM messages
       WHERE message_id = ?
         AND post_type IN ('message', 'message_sent')`,
    );
    const originalMsg = stmt.get(messageId) as MessageRow | undefined;
    if (!originalMsg) return null;

    const originalEvent = JSON.parse(originalMsg.event ?? '{}') as Record<string, unknown>;

    // 设置recall_operator
    let recallOperator: number | null;
    if (event['notice_type'] === 'group_recall') {
      recallOperator = (event['operator_id'] as number) ?? null;
    } else {
      // friend_recall 谁发的就是谁撤回
      recallOperator = originalMsg.user_id;
    }

    // 更新event字段
    originalEvent['recall_operator'] = recallOperator;
    const updatedEvent = JSON.stringify(originalEvent);

    // 更新数据库
    this.db.prepare('UPDATE messages SET event = ? WHERE id = ?').run(updatedEvent, originalMsg.id);

    // 返回更新后的消息
    originalMsg.event = updatedEvent;
    return originalMsg;
  }

  getNearestMessageToNotice(
    noticeId: number,
    groupId: number | null = null,
    targetId: number | null = null,
    getBefore: boolean = true,
    getAfter: boolean = true,
  ): Record<string, MessageRow | null> | MessageRow | null {
    /*
    获取与指定通知消息最接近的前后消息

    Args:
        noticeId: 通知消息的ID
        groupId: 可选的群组ID筛选条件
        targetId: 可选的目标ID筛选条件
        getBefore: 是否获取id较小的前一条消息
        getAfter: 是否获取id较大的后一条消息
    Returns:
        根据参数返回dict或单个消息:
        - 当同时获取前后消息时: {before: 行或null, after: 行或null}
        - 当只获取前或后消息时: 直接返回行或null
    */
    const conditions = [
      "(post_type = 'message' OR post_type = 'message_sent')",
      "(message_type = 'group' OR post_type = 'private')",
      "(sub_type = 'normal' OR sub_type = 'friend' OR sub_type = 'group')",
    ];
    const params: unknown[] = [ noticeId ];

    if (groupId !== null) {
      conditions.push('group_id = ?');
      params.push(groupId);
    }
    if (targetId !== null) {
      conditions.push('target_id = ?');
      params.push(targetId);
    }

    const whereClause = conditions.join(' AND ');
    const result: Record<string, MessageRow | null> = {};

    if (getBefore) {
      const beforeMsg = this.db.prepare(
        `SELECT *
         FROM messages
         WHERE id < ?
           AND ${whereClause}
         ORDER BY id DESC
         LIMIT 1`,
      ).get(...params) as MessageRow | undefined;
      result['before'] = beforeMsg ?? null;
    }

    if (getAfter) {
      const afterMsg = this.db.prepare(
        `SELECT *
         FROM messages
         WHERE id > ?
           AND ${whereClause}
         ORDER BY id ASC
         LIMIT 1`,
      ).get(...params) as MessageRow | undefined;
      result['after'] = afterMsg ?? null;
    }

    // 如果只需要一个结果，直接返回该结果而不是字典
    if (!getBefore && getAfter) return result['after'] ?? null;
    if (getBefore && !getAfter) return result['before'] ?? null;

    return result;
  }

  getAddRequests(selfId: number | null = null): MessageRow[] {
    /*
    获取加好友/加群请求列表，并标记是否已通过

    使用一次 SQL 查询 + 关联子查询批量判断 approved 状态，避免逐条查询性能问题。

    Args:
        selfId: 可选，按 self_id 筛选

    Returns:
        请求消息列表，每条消息的 event 字段已被解析并添加 approved 标记
    */
    const selfIdCondition = selfId !== null ? 'AND r.self_id = ?' : '';
    const selfIdParams: unknown[] = selfId !== null ? [selfId] : [];

    const query = `
      SELECT r.*,
             CASE
                 WHEN r.request_type = 'friend' THEN
                     CASE WHEN EXISTS (
                         SELECT 1 FROM messages AS m
                         WHERE m.id > r.id
                           AND m.post_type = 'notice'
                           AND m.notice_type = 'friend_add'
                           AND m.user_id = r.user_id
                           ${selfId !== null ? 'AND m.self_id = r.self_id' : ''}
                         LIMIT 1
                     ) THEN 1 ELSE NULL END
                 WHEN r.request_type = 'group' THEN
                     CASE WHEN EXISTS (
                         SELECT 1 FROM messages AS m
                         WHERE m.id > r.id
                           AND m.post_type = 'notice'
                           AND m.notice_type = 'group_increase'
                           AND m.group_id = r.group_id
                           AND m.user_id = r.user_id
                           ${selfId !== null ? 'AND m.self_id = r.self_id' : ''}
                         LIMIT 1
                     ) THEN 1 ELSE NULL END
                 ELSE NULL
             END AS approved
      FROM messages AS r
      WHERE r.post_type = 'request'
        AND r.request_type IN ('friend', 'group')
        AND (r.sub_type IN ('add', 'invite') OR r.sub_type IS NULL)
        ${selfIdCondition}
      ORDER BY r.time DESC, r.id DESC
    `;

    const rows = this.db.prepare(query).all(...selfIdParams) as Array<MessageRow & { approved: number | null }>;

    // 将 approved 标记写入 event 字段
    for (const row of rows) {
      let eventObj: Record<string, unknown> = {};
      try {
        eventObj = JSON.parse(row.event ?? '{}') as Record<string, unknown>;
      } catch {
        eventObj = {};
      }
      eventObj['approved'] = row.approved === 1 ? true : (row.approved === null ? null : false);
      row.event = JSON.stringify(eventObj);
      // 删除多余的 approved 字段（MessageRow 接口没有该字段）
      delete (row as unknown as Record<string, unknown>)['approved'];
    }

    return rows;
  }

  getMsgLikes(messageId: number, selfId: number): MessageRow[] {
    /*
    获取指定消息的所有表情点赞通知

    根据 message_id 和 self_id 查找所有 notice_type 为 group_msg_emoji_like 的消息

    Args:
        messageId: 原始消息的 message_id
        selfId: 机器人账号的 self_id

    Returns:
        匹配的消息记录列表
    */
    const stmt = this.db.prepare(
      `SELECT *
       FROM messages
       WHERE notice_type = 'group_msg_emoji_like'
         AND message_id = ?
         AND self_id = ?
       ORDER BY id ASC`,
    );
    return stmt.all(messageId, selfId) as MessageRow[];
  }

  clearMessages(): void {
    this.db.exec('DELETE FROM messages');
  }

  close(): void {
    this.db.close();
  }
}