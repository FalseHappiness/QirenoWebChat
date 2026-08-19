import { type DatabaseManager, type MessageRow } from './db.js';
import { Config } from './config.js';
import { FrontendConnectionManager } from './frontend_manager.js';
import { OneBotConnectionManager } from './onebot_manager.js';

/**
 * 将 event 转换为统一的消息数据格式
 *
 * Args:
 *     event: 消息事件的数据对象
 *
 * Returns:
 *     标准化后的消息数据
 */
export function convertEventToMessageData(event: Record<string, unknown>): Record<string, unknown> {
  // 处理 real_seq（尝试转为 int，失败则设为 null）
  let realSeq: number | null = null;
  try {
    realSeq = Number(event['real_seq'] ?? event['message_seq']);
    if (Number.isNaN(realSeq)) realSeq = null;
  } catch {
    realSeq = null;
  }

  // 获取 user_id（优先从 event.user_id，其次从 event.sender.user_id）
  let userId: unknown = event['user_id'];
  if (userId === undefined && typeof event['sender'] === 'object' && event['sender'] !== null) {
    userId = (event['sender'] as Record<string, unknown>)['user_id'];
  }

  const postType = event['post_type'] as string | undefined;
  const messageType = event['message_type'] as string | undefined;
  let targetId: unknown = event['target_id'];
  const groupId = event['group_id'];

  if (postType === 'message' || postType === 'message_sent') {
    if (messageType === 'group') {
      targetId = targetId ?? groupId;
    }
    if (postType === 'message' && messageType === 'private') {
      targetId = targetId ?? userId;
    }
  }

  // 构造标准化的消息数据
  const messageData: Record<string, unknown> = {
    'message_id': event['message_id'],
    'real_seq': realSeq,
    'time': event['time'] ?? Math.floor(Date.now() / 1000),
    'self_id': event['self_id'],
    'sender_id': event['sender_id'],
    'post_type': postType,
    'notice_type': event['notice_type'],
    'request_type': event['request_type'],
    'message_type': messageType,
    'sub_type': event['sub_type'],
    'user_id': userId,
    'group_id': groupId,
    'operator_id': event['operator_id'],
    'target_id': targetId,
    'event': JSON.stringify(event), // 原始 event 数据转为 JSON 字符串
    'created_at': new Date().toISOString(),
  };

  return messageData;
}

/**
 * 格式化最近联系人
 */
export function formatRecentContacts(contacts: Record<string, unknown>[]): Record<string, unknown>[] {
  const formattedContacts: Record<string, unknown>[] = [];
  for (const contact of contacts) {
    const event = contact['lastestMsg'] as Record<string, unknown> | undefined;
    const isTemp = false;
    if (event) {
      if (event['message_type'] === 'private') {
        event['target_id'] = event['peerUin'];
      }
      // isTemp = 'temp_source' in event;
    }
    const formattedContact: Record<string, unknown> = {
      'temp': isTemp,
      'type': contact['chatType'] === 1 || isTemp ? 'private' : 'group',
      'real_name': contact['peerName'],
      'remark': contact['remark'],
      'last_time': new Date().toISOString(),
      'contact_id': Number(contact['peerUin']),
      'has_message': false,
    };
    if (event) {
      formattedContact['last_timestamp'] = event['time'];
      formattedContact['latest_msg'] = JSON.stringify(event);
      formattedContact['has_message'] = !!event['message'];
    }
    formattedContact['name'] = formattedContact['remark'] || formattedContact['real_name'];
    formattedContacts.push(formattedContact);
  }
  return formattedContacts;
}

/**
 * OneBot 消息处理器
 */
export class OneBotHandler {
  private db: DatabaseManager;
  private config: Config;
  private frontendWs: FrontendConnectionManager;
  private onebotWs: OneBotConnectionManager;

  constructor(
    db: DatabaseManager,
    config: Config,
    onebotWs: OneBotConnectionManager,
    frontendWs: FrontendConnectionManager,
  ) {
    this.db = db;
    this.config = config;
    this.frontendWs = frontendWs;
    this.onebotWs = onebotWs;

    // 注册事件处理器
    onebotWs.addMessageHandler((data) => this.handleMessage(data));
  }

  async handleMessage(data: Record<string, unknown>): Promise<void> {
    const processed = await this.processMessage(data);
    if (processed) {
      await this._emitToFrontend(processed);
    }
  }

  async _emitToFrontend(messageData: Record<string, unknown>): Promise<void> {
    /* 通过WebSocket发送消息，仅发送给 self_id 对应的前端连接 */
    try {
      const selfId = messageData['self_id'];
      if (selfId !== undefined && selfId !== null) {
        await this.frontendWs.broadcastToSelfId(Number(selfId), messageData);
      } else {
        // 没有 self_id 时，广播给所有前端（兼容旧数据）
        await this.frontendWs.broadcast(messageData);
      }
    } catch (err) {
      console.error(`通过WebSocket发送消息失败: ${(err as Error).constructor.name}: ${err}`);
    }
  }

  async processMessage(event: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    /* 处理并存储消息 */
    try {
      const postType = event['post_type'] as string | undefined;
      if (postType === 'meta_event') return null;

      // console.log('Received msg:');
      // console.log(JSON.stringify(event, null, 2));

      // # 检查是否是我们配置中允许的群聊或私聊
      // if post_type == 'message':
      //     message_type = event.get('message_type')
      //     if message_type == 'group':
      //         if self.config.ALLOWED_GROUPS and event.get('group_id') not in self.config.ALLOWED_GROUPS:
      //             return None
      //     elif message_type == 'private':
      //         if self.config.ALLOWED_USERS and event.get('user_id') not in self.config.ALLOWED_USERS:
      //             return None

      const messageData = convertEventToMessageData(event);

      // 存储到数据库
      const messageId = this.db.saveMessage(messageData);
      messageData['id'] = messageId;

      // 如果是撤回事件，处理原始消息
      if (postType === 'notice' && (event['notice_type'] === 'group_recall' || event['notice_type'] === 'friend_recall')) {
        this.db.processRecallEvent(messageData);
      }

      return messageData;
    } catch (err) {
      console.error(`Error processing message: ${err}`);
      return null;
    }
  }

  async getMaxRealSeq(id: number, type: string): Promise<number> {
    const apiData = await this.getMessages(id, type, 1);
    if (apiData.length > 0) {
      const firstMessage = apiData[0]!;
      const realSeq = firstMessage['real_seq'];
      if (realSeq !== undefined && realSeq !== null) {
        return Number(realSeq);
      }
    }
    return -1;
  }

  async getMessages(
    id: number,
    type: string,
    count: number = 20,
    direction: string | null = null,
    messageId: number = 0,
    selfId: number | null = null,
  ): Promise<Record<string, unknown>[]> {
    const params: Record<string, unknown> = {
      'count': count,
      'message_seq': messageId,
      'message_id': messageId, // SnowLuma
    };
    if (type === 'group') {
      params['group_id'] = id;
    } else {
      params['user_id'] = id;
    }
    if (direction !== null) {
      params['reverse_order'] = direction === 'prev';
    }
    const action = type === 'group' ? 'get_group_msg_history' : 'get_friend_msg_history';

    if (selfId === null) {
      if (this.onebotWs.activeConnections.size === 1) {
        selfId = this.onebotWs.getFirstSelfId()!;
      }
    }

    // console.log(action, params);
    const apiData = await this.onebotWs.callAction(action, params, selfId);
    if (!apiData) return [];

    const messages = (apiData as Record<string, unknown>)['messages'] as Record<string, unknown>[] ?? [];

    for (const msg of messages) {
      if (!('post_type' in msg)) {
        msg['post_type'] = Number(msg['user_id']) === Number(selfId) ? 'message_sent' : 'message';
      }
      if (!('self_id' in msg)) {
        msg['self_id'] = Number(selfId);
      }
    }

    // 检查是否已经获取了足够数量的消息
    if (messages.length >= count) {
      return messages.slice(0, count);
    }

    // 检查是否已经获取了所有消息（只返回1条且与传入的message_id相同）
    if (messages.length === 0 || (messages.length === 1 && messages[0]!['message_id'] === messageId)) {
      return messages;
    }

    // 计算还需要获取的消息数量
    const remaining = count - messages.length;

    // 确定下一次请求的message_id
    let nextMessageId: number;
    if (direction === 'prev') {
      nextMessageId = messages[0]!['message_id'] as number; // 取最早的一条
    } else {
      nextMessageId = messages[messages.length - 1]!['message_id'] as number; // 取最新的一条
    }

    // 递归获取剩余的消息（remaining + 1 是为了避免重复）
    const remainingMessages = await this.getMessages(
      id, type, remaining + 1, direction, nextMessageId, selfId,
    );

    // 合并消息，并确保没有重复
    let combined: Record<string, unknown>[];
    if (direction === 'prev') {
      // 如果是向前获取，remaining_messages 的最后一条可能与当前 messages 的第一条重复
      combined = [ ...remainingMessages.slice(0, -1), ...messages ];
    } else {
      // 如果是向后获取，remaining_messages 的第一条可能与当前 messages 的最后一条重复
      combined = [ ...messages, ...remainingMessages.slice(1) ];
    }

    combined = combined.slice(0, count); // 确保最终返回的数量不超过 count

    if (type === 'private') {
      for (const msg of combined) {
        msg['target_id'] = id;
      }
    }

    return combined;
  }

  async getRecentContacts(selfId: number | null = null): Promise<Record<string, unknown>[]> {
    if (selfId === null) {
      if (this.onebotWs.activeConnections.size === 1) {
        selfId = this.onebotWs.getFirstSelfId()!;
      }
    }
    const contacts = await this.onebotWs.callAction('get_recent_contact', { 'count': 114514 }, selfId) as Record<string, unknown>[];
    return formatRecentContacts(contacts);
  }
}