import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { Config } from './config.js';
import { DatabaseManager, type MessageRow, type FilterDict, type FilterValue } from './db.js';
import { FrontendConnectionManager } from './frontend_manager.js';
import { OneBotHandler, convertEventToMessageData } from './onebot_handler.js';
import { OneBotConnectionManager, ActionFailed } from './onebot_manager.js';
import { TTLCache } from './ttl_cache.js';
import { parseBool, parseInt, isAllowedProxyDomain, getContentDisposition } from './utils.js';

// 获取当前模块目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// server 目录为 ../server
const serverDir = resolve(__dirname, '..');
// 项目根目录为 ../..
const projectRoot = resolve(serverDir, '..');

// 初始化配置和数据库
const config = new Config();
// 确保数据库路径：如果是相对路径，相对于 server 目录
let dbPath = config.DATABASE_FILE;
if (!resolve(dbPath) || !dbPath.includes(':')) {
  // 是相对路径，相对于 server 目录
  dbPath = resolve(serverDir, dbPath);
}
const db = new DatabaseManager(dbPath);

// 创建 Fastify 应用
const app: FastifyInstance = Fastify({
  pluginTimeout: 30000,
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: false,
        ignore: "pid,hostname",
        singleLine: true,
        colorize: true,
      },
    },
    timestamp: () => {
      const t = new Date()
      const h = String(t.getHours()).padStart(2, "0")
      const m = String(t.getMinutes()).padStart(2, "0")
      const s = String(t.getSeconds()).padStart(2, "0")
      return `,"time":"${h}:${m}:${s}"`
    },
  }
});

// 注册 CORS
app.addHook('onRequest', async (request, reply) => {
  // 简单的 CORS 中间件
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', '*');
  reply.header('Access-Control-Allow-Headers', '*');
  if (request.method === 'OPTIONS') {
    return reply.status(204).send();
  }
});

// 注册 WebSocket
await app.register(fastifyWebsocket);

// 初始化 WebSocket 管理器
const onebotManager = new OneBotConnectionManager(config.ONEBOT_WS_TOKEN);
const frontendManager = new FrontendConnectionManager(onebotManager);

// WebSocket 路由
app.register(async function (fastify) {
  fastify.get('/ws/*', { websocket: true }, async (socket, request) => {
    const path = (request.params as Record<string, string>)['*'] ?? '';
    const parts = path.split('/');
    const name = (parts[0] || '').toLowerCase();
    const subName = parts.length > 1 ? parts[1] : null;

    if (name === 'frontend') {
      await frontendManager.connect(socket, request, subName);
    } else if (['napcat', 'snowluma', 'nc', 'sl'].includes(name)) {
      await onebotManager.connect(socket, request);
    } else {
      socket.close(1008, '404 Not Found');
    }
  });
});

// OneBotHandler 初始化
const onebotHandler = new OneBotHandler(db, config, onebotManager, frontendManager);

// -------- 公共核心方法（供 Fastify 路由和 req_backend 共同调用） --------

async function getMessagesCore(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  /* 获取消息列表（核心实现） */
  const limit = parseInt(params['limit'], 100);
  let cursor = params['cursor'] !== undefined ? parseInt(params['cursor']) : null;
  const cursorType = params['cursor_type'] ?? 'id';
  const direction = (params['direction'] as string) ?? 'prev';
  const includeCursor = parseBool(params['include_cursor'] ?? false);
  let messageId = parseInt(params['message_id'], 0);
  let cursorTime = params['cursor_time'] !== undefined ? parseInt(params['cursor_time']) : null;

  // 是否为notice消息
  const noticeMessage = parseBool(params['notice_message'] ?? false);
  // notice_cursor, -1为未知, 0为最新/旧
  const noticeBeforeCursor = parseInt(params['notice_before_message'], -1);
  const noticeAfterCursor = parseInt(params['notice_after_message'], -1);

  // 获取筛选参数
  const postType = params['post_type'] as string | undefined;
  const messageType = params['message_type'] as string | undefined;
  const groupId = parseInt(params['group_id'], -1);
  const userId = parseInt(params['user_id'], -1);
  const targetId = parseInt(params['target_id'], -1);
  let selfId = parseInt(params['self_id']);

  // 如果没有指定 self_id，使用第一个连接的 bot
  if (selfId === 0) {
    selfId = onebotManager.getFirstSelfId() ?? 0;
  }

  const filters: Record<string, FilterValue> = {
    self_id: selfId,
  };

  if (postType !== undefined) filters['post_type'] = postType;
  if (messageType !== undefined) filters['message_type'] = messageType;
  if (groupId !== -1) filters['group_id'] = groupId;
  if (targetId !== -1) filters['target_id'] = targetId;
  if (userId !== -1) filters['user_id'] = userId;

  let finalFilters: FilterDict | FilterDict[] = filters as FilterDict;

  if (postType === undefined && messageType !== undefined && userId === -1) {
    if (messageType === 'group' || messageType === 'private') {
      const noticeFilter: Record<string, FilterValue> = {
        'sub_type': ['poke', 'add', 'ban', 'lift_ban', 'approve', 'invite', 'kick_me', 'remove', 'kick',
          'set', 'unset', 'title', null, 'group_name', 'leave'],
        'notice_type': ['notify', 'essence', 'group_ban', 'group_increase', 'group_decrease',
          'group_msg_emoji_like', 'group_admin', 'group_recall', 'friend_recall'],
        'post_type': 'notice',
      };
      filters['post_type'] = ['message', 'message_sent'];
      if (messageType === 'group') {
        filters['sub_type'] = 'normal';
        if (groupId !== -1) noticeFilter['group_id'] = groupId;
      } else if (messageType === 'private') {
        filters['sub_type'] = ['friend', 'group'];
        if (targetId !== -1) noticeFilter['user_id'] = targetId;
        noticeFilter['group_id'] = null;
      }
      finalFilters = [filters as FilterDict, noticeFilter as FilterDict];
    }
  }

  const result = db.getMessages(
    limit,
    cursor,
    direction,
    includeCursor,
    finalFilters,
    cursorType === 'real_seq',
  );
  (result as unknown as Record<string, unknown>)['max_real_seq'] = null;

  const cleanedResult: Record<string, unknown> = {};

  let dbMessages = result.messages;
  let apiMessages: Record<string, unknown>[] | null = null;

  if (postType === undefined && userId === -1) {
    let foundMessageId = false;
    if (noticeMessage) {
      if (direction === 'prev') {
        messageId = noticeAfterCursor;
        if (messageId === -1) {
          const afterMessage = db.getNearestMessageToNotice(
            cursor ?? 0,
            groupId === -1 ? null : groupId,
            targetId === -1 ? null : targetId,
            false,
            true,
          );
          if (afterMessage && !Array.isArray(afterMessage) && !('before' in (afterMessage as Record<string, unknown>))) {
            messageId = (afterMessage as MessageRow).message_id ?? 0;
          } else {
            messageId = 0;
          }
        }
        foundMessageId = true;
      } else if (direction === 'next') {
        messageId = noticeBeforeCursor;
        if (messageId === -1) {
          const beforeMessage = db.getNearestMessageToNotice(
            cursor ?? 0,
            groupId === -1 ? null : groupId,
            targetId === -1 ? null : targetId,
            true,
            false,
          );
          if (beforeMessage && !Array.isArray(beforeMessage) && !('before' in (beforeMessage as Record<string, unknown>))) {
            messageId = (beforeMessage as MessageRow).message_id ?? 0;
            foundMessageId = true;
          }
        } else {
          foundMessageId = true;
        }
      }
    }

    if (!noticeMessage || foundMessageId) {
      if (direction === 'prev' || messageId !== 0) {
        apiMessages = await onebotHandler.getMessages(
          messageType === 'group' ? groupId : targetId,
          messageType ?? 'group',
          limit + 1,
          direction,
          messageId,
          selfId,
        );
        apiMessages = apiMessages.map(convertEventToMessageData);
        if (cursorTime) {
          if (direction === 'prev') {
            apiMessages = apiMessages.filter((msg) => (msg['time'] as number ?? cursorTime + 1) <= cursorTime!);
          } else if (direction === 'next') {
            apiMessages = apiMessages.filter((msg) => (msg['time'] as number ?? 0) >= cursorTime!);
          }
        }
      }
    }
  }

  if (apiMessages !== null) {
    // 合并列表并按real_seq排序，重复的以后面的为准
    const merged = new Map<string, Record<string, unknown>>();
    const tempMergedMessages = [...apiMessages, ...dbMessages as unknown as Record<string, unknown>[]];

    for (let idx = 0; idx < tempMergedMessages.length; idx++) {
      const msg = tempMergedMessages[idx]!;
      // 如果有 real_seq，就用它作为键（重复时后面的覆盖前面的）
      const realSeq = msg['real_seq'] ?? msg['message_seq'];
      const mergedKey = `${msg['post_type'] ?? null}_${realSeq}`;
      if (('real_seq' in msg || 'message_seq' in msg) && realSeq !== undefined && realSeq !== null) {
        msg['real_seq'] = realSeq;
        const oldMsg = merged.get(mergedKey);
        if (typeof msg === 'object') {
          let event = msg['event'];
          if (typeof event === 'string') {
            try {
              const eventObj = JSON.parse(event) as Record<string, unknown>;
              if (!eventObj['message']) {
                if (!('recall_operator' in eventObj)) {
                  eventObj['recall_operator'] = -1;
                  msg['event'] = JSON.stringify(eventObj);
                }
              }
            } catch {
              // ignore
            }
          }

          if (typeof oldMsg === 'object' && oldMsg !== undefined) {
            const oldEvent = oldMsg['event'];
            event = msg['event'];
            if (typeof oldEvent === 'string' && typeof event === 'string') {
              try {
                const oldEventObj = JSON.parse(oldEvent) as Record<string, unknown>;
                const eventObj = JSON.parse(event) as Record<string, unknown>;
                const oldMessage = oldEventObj['message'];
                if (!oldMessage) {
                  if (!('recall_operator' in eventObj)) {
                    eventObj['recall_operator'] = -1;
                    msg['event'] = JSON.stringify(eventObj);
                  }
                } else {
                  const dbMessage = eventObj['message'] as Record<string, unknown>[] ?? [];
                  if (Array.isArray(oldMessage) && Array.isArray(dbMessage) && oldMessage.length === dbMessage.length) {
                    for (let i = 0; i < oldMessage.length; i++) {
                      const oldMsgData = (oldMessage[i] as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
                      const dbMsgData = (dbMessage[i] as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
                      if (typeof oldMsgData === 'object' && typeof dbMsgData === 'object' && oldMsgData !== null && dbMsgData !== null) {
                        if ('url' in oldMsgData && 'url' in dbMsgData) {
                          dbMsgData['url'] = oldMsgData['url'];
                        }
                      }
                    }
                    msg['event'] = JSON.stringify(eventObj);
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }
        merged.set(mergedKey, msg);
      } else {
        // 如果没有 real_seq，就用 (time, idx) 作为键（确保唯一性）
        merged.set(`${msg['time'] ?? 'inf'}_${idx}`, msg);
      }
    }

    const sortedMessages = [...merged.values()].sort((a, b) => {
      const isValidNum = (val: unknown): val is number => typeof val === 'number' && !isNaN(val);

      const timeA = a['time'];
      const timeB = b['time'];
      const validTimeA = isValidNum(timeA);
      const validTimeB = isValidNum(timeB);

      if (validTimeA !== validTimeB) return validTimeA ? -1 : 1;
      if (validTimeA && timeA !== timeB) return timeA - timeB;

      const seqA = a['real_seq'];
      const seqB = b['real_seq'];
      const validSeqA = isValidNum(seqA);
      const validSeqB = isValidNum(seqB);

      if (validSeqA !== validSeqB) return validSeqA ? -1 : 1;
      if (validSeqA && seqA !== seqB) return seqA - seqB;

      const idA = a['id'];
      const idB = b['id'];
      const validIdA = isValidNum(idA);
      const validIdB = isValidNum(idB);

      if (validIdA !== validIdB) return validIdA ? -1 : 1;
      if (validIdA) return idA - idB;

      return 0;
    });

    // 根据include_cursor过滤
    let filteredMessages = sortedMessages;
    if (!includeCursor) {
      filteredMessages = sortedMessages.filter((msg) => msg['message_id'] !== messageId);
    }

    // 根据direction和count提取子集
    let messages: Record<string, unknown>[];
    if (direction === 'prev') {
      messages = limit ? filteredMessages.slice(-limit) : [];
    } else {
      messages = limit ? filteredMessages.slice(0, limit) : [];
    }

    if (messageId === 0) {
      cleanedResult['max_real_seq'] = messages.length > 0 ? Number(messages[messages.length - 1]!['real_seq'] ?? -1) : -1;
    }

    cleanedResult['messages'] = messages;
  } else {
    cleanedResult['messages'] = dbMessages as unknown as Record<string, unknown>[];
  }

  return cleanedResult;
}

async function getMsgCore(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  /* 获取单条消息（核心实现），返回消息数据，未找到时抛出异常 */
  let idVal = params['id'];
  let messageIdVal = params['message_id'];
  let selfId = parseInt(params['self_id']);

  // 如果没有指定 self_id，使用第一个连接的 bot
  if (selfId === 0) {
    selfId = onebotManager.getFirstSelfId() ?? 0;
  }

  if (idVal !== undefined) idVal = parseInt(idVal);
  if (messageIdVal !== undefined) messageIdVal = parseInt(messageIdVal);

  const type = idVal !== undefined ? 'id' : 'message_id';
  const msg = db.getMsg(
    (idVal ?? messageIdVal) as number,
    type as 'id' | 'message_id',
  );

  if (msg === null && messageIdVal !== undefined) {
    try {
      const apiData = await onebotManager.callAction('get_msg', { message_id: messageIdVal }, selfId);
      return convertEventToMessageData(apiData as Record<string, unknown>);
    } catch (err) {
      throw new Error(`Failed to get message from API: ${err}`);
    }
  }

  if (msg === null) {
    throw new Error(`Message not found: ${JSON.stringify(params)}`);
  }

  return msg as unknown as Record<string, unknown>;
}

async function syncMessagesCore(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  /* 同步新消息（核心实现） */
  const lastId = parseInt(params['last_id'], 0);
  let selfId = parseInt(params['self_id']);
  selfId = selfId !== 0 ? selfId : null as unknown as number;
  const messages = db.getNewMessages(lastId, selfId || null);
  const maxId = messages.length > 0 ? Math.max(...messages.map((msg) => msg.id)) : lastId;
  return {
    messages,
    last_id: maxId,
  };
}

async function getContactsCore(params: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  /* 获取联系人列表（核心实现，时间较晚数据合并优先） */
  let selfId = parseInt(params['self_id']);
  if (selfId === 0) {
    selfId = onebotManager.getFirstSelfId() ?? 0;
  }
  const dbContacts = db.getContacts(selfId || null);
  const apiContacts = await onebotHandler.getRecentContacts(selfId || null);
  const contactDict = new Map<string, Record<string, unknown>>();

  // 安全获取时间戳
  const getTs = (item: Record<string, unknown>): number => (item['last_timestamp'] as number) ?? 0;
  // 需要合并的字段配置：(字段名, 是否需前置判断)
  const mergeFields: Array<[string, ((a: Record<string, unknown>, b: Record<string, unknown>) => boolean) | null]> = [
    ['latest_msg', (a, b) => !!a['latest_msg'] && !!a['has_message']],
    ['temp', null],
    ['last_timestamp', (a, b) => !!a['last_timestamp']],
    ['name', null],
    ['real_name', null],
    ['remark', null],
  ];

  // 载入数据库数据
  for (const c of dbContacts) {
    contactDict.set(`${c.contact_id}_${c.type}`, { ...c } as unknown as Record<string, unknown>);
  }

  // 合并API联系人
  for (const c of apiContacts) {
    const key = `${c['contact_id']}_${c['type']}`;
    if (!contactDict.has(key)) {
      contactDict.set(key, { ...c });
      continue;
    }

    const dbC = contactDict.get(key)!;
    const apiTs = getTs(c);
    const dbTs = getTs(dbC);
    const merged = { ...dbC };

    if (apiTs > dbTs) {
      // API更新，直接覆盖字段
      for (const [field, cond] of mergeFields) {
        if (cond === null || cond(c, dbC)) {
          merged[field] = c[field];
        }
      }
    } else {
      // DB更新，仅填充空字段
      for (const [field, cond] of mergeFields) {
        if (cond !== null && !cond(c, dbC)) continue;
        if (merged[field] === undefined && field in c) {
          merged[field] = c[field];
        }
      }
    }

    contactDict.set(key, merged);
  }

  // 排序
  const contacts = [...contactDict.values()].sort((a, b) => {
    const tsA = -(a['last_timestamp'] as number ?? 0);
    const tsB = -(b['last_timestamp'] as number ?? 0);
    if (tsA !== tsB) return tsA - tsB;
    const timeA = a['last_time'] ? new Date(a['last_time'] as string).getTime() : 0;
    const timeB = b['last_time'] ? new Date(b['last_time'] as string).getTime() : 0;
    return timeB - timeA;
  });

  return contacts;
}

// -------- req_backend 处理器注册 --------

frontendManager.reqBackendHandlers.set('contacts', async (params) => getContactsCore(params));
frontendManager.reqBackendHandlers.set('messages', async (params) => getMessagesCore(params));
frontendManager.reqBackendHandlers.set('get_msg', async (params) => getMsgCore(params));
frontendManager.reqBackendHandlers.set('sync', async (params) => syncMessagesCore(params));

// ===================== 健康检查 & BOT列表接口 =====================

app.get('/api/health', async () => {
  /* 后端健康检查接口 */
  return { status: 'ok', code: 200, data: { alive: true } };
});

app.get('/api/bots', async () => {
  /* 获取所有已连接的BOT列表（名称、头像、QQ号） */
  const bots: Record<string, unknown>[] = [];
  for (const selfId of onebotManager.activeConnections.keys()) {
    try {
      const info = await onebotManager.callAction('get_login_info', {}, selfId) as Record<string, unknown>;
      bots.push({
        self_id: selfId,
        user_id: info['user_id'],
        nickname: info['nickname'],
      });
    } catch (err) {
      bots.push({
        self_id: selfId,
        error: String(err),
      });
    }
  }
  return { status: 'success', code: 200, data: bots };
});

// -------- 原 Fastify 路由（保持接口不变，调用公共核心方法） --------

// 获取请求参数辅助函数
async function getRequestParams(request: FastifyRequest): Promise<Record<string, unknown>> {
  /* 从查询参数和JSON body中获取所有参数 */
  const params: Record<string, unknown> = { ...(request.query as Record<string, unknown>) };

  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    try {
      const body = request.body as Record<string, unknown>;
      if (body) {
        Object.assign(params, body);
      }
    } catch {
      // ignore
    }
  }

  return params;
}

// 通用API请求处理函数
async function makeApiRequest(
  endpoint: string,
  originalParams: Record<string, unknown> = {},
  requestParams: string[] | null = null,
  requestData: Record<string, unknown> = {},
  customHandler: ((data: unknown, params: Record<string, unknown>) => Record<string, unknown>) | null = null,
  errorHandler: ((err: Error, context: Record<string, unknown>) => Record<string, unknown>) | null = null,
): Promise<Record<string, unknown>> {
  /*
  通用API请求处理方法

  :param endpoint: 要请求的API端点
  :param originalParams: Fastify请求参数
  :param requestParams: 请求参数中需要提取的参数列表
  :param requestData: 要发送给API的额外数据
  :param customHandler: 自定义处理函数，用于处理API返回数据
  :param errorHandler: 自定义错误处理函数，格式为 func(exception, context) -> response
  :return: 响应
  */
  try {
    // 1. 检查必需参数
    const params: Record<string, unknown> = {};
    if (requestParams) {
      for (const param of requestParams) {
        if (!(param in originalParams)) {
          const errorMsg = `Missing required parameter: ${param}`;
          if (errorHandler) {
            return errorHandler(new Error(errorMsg), {
              stage: 'parameter_validation',
              param,
              endpoint,
            });
          }
          return { status: 'error', code: -1, error: errorMsg };
        }
        params[param] = originalParams[param];
      }
    }

    // 2. 准备请求数据
    const mergedRequestData = { ...requestData, ...params };

    // 提取 self_id，如果指定则传递给对应的 bot
    let selfId = parseInt(originalParams['self_id']);
    selfId = selfId !== 0 ? selfId : null as unknown as number;
    const apiData = await onebotManager.callAction(endpoint, mergedRequestData, selfId || null);

    // 3. 自定义处理或直接返回数据
    if (customHandler) {
      return customHandler(apiData, params);
    }

    return { status: 'ok', code: 200, data: apiData };
  } catch (err) {
    let stage = 'unexpected_error';
    let errorInfo = `An unexpected error occurred: ${String(err) || 'Unknown error'}`;
    if (err instanceof ActionFailed) {
      stage = 'action_failed_error';
      errorInfo = String(err);
    }

    if (errorHandler) {
      return errorHandler(err instanceof Error ? err : new Error(String(err)), {
        stage,
        endpoint,
        request_data: requestData,
      });
    }
    return { status: 'error', code: -1, error: errorInfo };
  }
}

// 注册路由
app.route({
  method: ['GET', 'POST'],
  url: '/api/messages',
  handler: async (request) => {
    const params = await getRequestParams(request);
    const result = await getMessagesCore(params);
    return { status: 'success', code: 200, data: result };
  },
});

app.route({
  method: ['GET', 'POST'],
  url: '/api/get_msg',
  handler: async (request, reply) => {
    try {
      const params = await getRequestParams(request);
      const msg = await getMsgCore(params);
      return { status: 'success', code: 200, data: msg };
    } catch (err) {
      return reply.status(404).send({
        status: 'fail',
        code: 404,
        error: String(err),
      });
    }
  },
});

app.route({
  method: ['GET', 'POST'],
  url: '/api/sync',
  handler: async (request) => {
    const params = await getRequestParams(request);
    const result = await syncMessagesCore(params);
    return { status: 'success', code: 200, data: result };
  },
});

// app.post('/api/messages/clear', async () => {
//   db.clearMessages();
//   return { success: true };
// });

app.route({
  method: ['GET', 'POST'],
  url: '/api/contacts',
  handler: async (request) => {
    const params = await getRequestParams(request);
    const result = await getContactsCore(params);
    return { status: 'success', code: 200, data: result };
  },
});

// 多媒体代理
app.route({
  method: ['GET', 'POST'],
  url: '/api/proxy_multimedia',
  handler: async (request, reply) => {
    const params = await getRequestParams(request);
    // 获取用户传入的完整 URL
    let targetUrl = params['url'] as string | undefined;
    if (!targetUrl) {
      return reply.status(400).send("Missing 'url' parameter");
    }

    // 如果输入没有协议头，自动添加 https:// 以便正确解析
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    if (!isAllowedProxyDomain(targetUrl)) {
      return reply.status(403).send('Forbidden: Invalid domain');
    }

    try {
      // 发起代理请求（设置超时和 User-Agent）
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return reply.status(response.status).send(`Proxy error: ${response.statusText}`);
      }

      // 流式返回
      const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
      const body = response.body;
      if (!body) {
        return reply.status(502).send('No response body');
      }

      return reply
        .header('Content-Type', contentType)
        .send(response.body as unknown as NodeJS.ReadableStream);
    } catch (err) {
      if ((err as Error).name === 'TimeoutError') {
        return reply.status(504).send('Request timeout');
      }
      return reply.status(502).send(`Proxy error: ${String(err)}`);
    }
  },
});

// 获取文件数据
app.route({
  method: ['GET', 'POST'],
  url: '/api/get_file_data',
  handler: async (request, reply) => {
    const params = await getRequestParams(request);
    const typeVal = (params['type'] as string) ?? 'file';
    // 读取 out_format 参数，默认 mp3
    const outFormat = (params['out_format'] as string) ?? 'mp3';

    const allowedTypes = ['image', 'record', 'file'];
    const allowedAudioFormats = ['mp3', 'wav'];

    // 校验 type 参数
    if (!allowedTypes.includes(typeVal)) {
      return reply.status(400).send(
        "The value of the 'type' parameter is not allowed, only supported " + JSON.stringify(allowedTypes),
      );
    }

    // 仅 record 类型时校验音频格式
    if (typeVal === 'record' && !allowedAudioFormats.includes(outFormat)) {
      return reply.status(400).send(
        `The out_format only supports ${JSON.stringify(allowedAudioFormats)}`,
      );
    }

    const reqData: Record<string, unknown> = {};
    if (typeVal === 'record') {
      reqData['out_format'] = outFormat;
    }

    try {
      // 读取 self‑id，没有则取首个在线机器人
      let selfId = parseInt(params['self_id']);
      selfId = selfId !== 0 ? selfId : (onebotManager.getFirstSelfId() ?? null as unknown as number);

      // 调用 OneBot 获取文件接口，不再封装进 makeApiRequest
      const apiData = await onebotManager.callAction('get_' + typeVal, {
        file_id: params.file_id,
        ...reqData
      }, selfId || null);

      const fileData = apiData as Record<string, unknown>;

      if (typeVal === 'record') {
        const base64Data = (fileData['base64'] as string) ?? '';
        if (base64Data === '') {
          return reply.status(404).send({
            status: 'error',
            code: -1,
            error: 'file not found'
          });
        }
        const audioBuffer = Buffer.from(base64Data, 'base64');

        // 根据格式设置MIME和文件名
        let mediaType: string;
        let filename: string;
        if (outFormat === 'wav') {
          mediaType = 'audio/wav';
          filename = 'audio.wav';
        } else {
          mediaType = 'audio/mpeg';
          filename = 'audio.mp3';
        }

        // 交给 fastify 发送，onRequest CORS 钩子头部自动带上
        reply
          .header('Content-Type', mediaType)
          .header('Content-Disposition', `inline; filename=${filename}`)
          .send(audioBuffer);
        return;
      }

      // image、file 类型当前分支未实现
      return reply.status(404).send({
        status: 'error',
        code: -1,
        error: 'file not found'
      });

    } catch (err) {
      // 异常捕获，区分业务错误与未知异常
      const statusCode = err instanceof ActionFailed ? 404 : 500;
      reply.status(statusCode);
      return {
        status: 'error',
        code: -1,
        error: `An unexpected error occurred: ${(err as Error).message || 'Unknown error'}`
      };
    }
  },
});

// 获取流式文件数据
app.route({
  method: ['GET', 'POST'],
  url: '/api/get_stream_file_data',
  handler: async (request, reply) => {
    const params = await getRequestParams(request);
    const fileId = params['file'] ?? params['file_id'];
    if (!fileId) {
      return { error: 'file_id is required' };
    }

    // 获取流式数据源
    try {
      const stream = await onebotManager.callStreamAction('download_file_stream', { file_id: fileId });

      // 先异步获取第一个 chunk 以提取文件信息
      let fileName = 'unknown_file';
      let fileSize = 0;
      let mediaType = 'application/octet-stream'; // 默认 MIME 类型，可以根据 file_name 扩展名推断
      const iterator = stream[Symbol.asyncIterator]();
      const firstResult = await iterator.next();
      if (firstResult.done) {
        return { error: 'No data received' };
      }
      const firstChunk = firstResult.value;
      const firstData = (firstChunk['data'] as Record<string, unknown>) ?? {};
      if (firstData['type'] === 'stream' && firstData['data_type'] === 'file_info') {
        fileName = (firstData['file_name'] as string) ?? fileName;
        fileSize = (firstData['file_size'] as number) ?? fileSize;
        // 根据文件扩展名猜测 MIME 类型
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
          'gif': 'image/gif', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
          'mp4': 'video/mp4', 'zip': 'application/zip', 'pdf': 'application/pdf',
          'webp': 'image/webp', 'bmp': 'image/bmp',
        };
        if (ext && mimeMap[ext]) {
          mediaType = mimeMap[ext]!;
        }
      }

      // 创建异步生成器来流式返回文件数据
      const fileGenerator = async function* () {
        // 继续从 iterator 获取后续 chunks
        while (true) {
          const result = await iterator.next();
          if (result.done) break;
          const chunk = result.value;
          const chunkData = (chunk['data'] as Record<string, unknown>) ?? {};
          if (chunkData['type'] === 'stream' && chunkData['data_type'] === 'file_chunk') {
            const base64Data = (chunkData['data'] as string) ?? '';
            try {
              const binaryData = Buffer.from(base64Data, 'base64');
              yield binaryData;
            } catch (err) {
              console.error(`Error decoding chunk: ${err}`);
              break;
            }
          } else if (chunkData['type'] === 'response' && chunkData['data_type'] === 'file_complete') {
            break; // 文件传输完成，结束流
          }
        }
      };

      // 将 AsyncGenerator 转换为 Readable 流
      const readableStream = Readable.from(fileGenerator());

      // 使用 quote 对文件名进行 URL 编码
      const encodedFilename = encodeURIComponent(fileName);
      // 设置响应头
      const contentDisposition = `filename="${fileName.replace(/[^\x20-\x7E]/g, '')}"; filename*=UTF-8''${encodedFilename}`;
      reply.header('Content-Disposition', contentDisposition);
      if (fileSize > 0) {
        reply.header('Content-Length', fileSize);
      }

      return reply
        .header('Content-Type', mediaType)
        .send(readableStream);
    } catch (err) {
      return { error: String(err) };
    }
  },
});

// ===================== 核心流式代理工具 =====================
async function proxyTargetFile(targetUrl: string, rangeHeader: string | null = null): Promise<{
  status: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | null;
}> {
  /*
  流式代理远程文件，正确透传 Range 响应头（Content-Range, Content-Length 等）
  */
  const headers: Record<string, string> = {};
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  const response = await fetch(targetUrl, {
    headers,
    signal: AbortSignal.timeout(300000), // 300秒超时
  });

  if (response.status >= 400) {
    throw new Error(`远程文件访问失败: ${response.status}`);
  }

  // 收集需要透传的关键响应头
  const proxyHeaders: Record<string, string> = {};
  const passKeys = ['Content-Range', 'Content-Length', 'Accept-Ranges', 'ETag'];
  for (const key of passKeys) {
    const val = response.headers.get(key);
    if (val) {
      proxyHeaders[key] = val;
    }
  }

  return {
    status: response.status,
    headers: proxyHeaders,
    body: response.body,
  };
}

// ===================== 公共代理文件流式响应构建 =====================
async function buildProxyFileResponse(
  targetUrl: string,
  targetName: string | null,
  rangeHeader: string | null,
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | null;
}> {
  let mediaType = 'application/octet-stream';
  if (targetName) {
    const ext = targetName.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'mp4': 'video/mp4',
      'zip': 'application/zip',
      'pdf': 'application/pdf',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
    };
    if (ext && mimeMap[ext]) {
      mediaType = mimeMap[ext]!;
    }
  }
  if (!targetName) {
    const parsedUrl = new URL(targetUrl);
    const filename = parsedUrl.pathname.split('/').pop() || 'file';
    targetName = decodeURIComponent(filename);
  }

  const { status, headers, body } = await proxyTargetFile(targetUrl, rangeHeader);

  return {
    status,
    headers: {
      'Content-Disposition': getContentDisposition(targetName, true),
      'Accept-Ranges': 'bytes',
      ...headers,
      'Content-Type': mediaType,
    },
    body,
  };
}

// ===================== 接口实现 =====================
app.route({
  method: ['GET', 'POST'],
  url: '/api/proxy_group_file',
  handler: async (request, reply) => {
    const params = await getRequestParams(request);
    const rangeHeader = (request.headers['range'] as string) ?? null;

    let targetUrl = params['url'] as string | undefined;
    const targetName = params['name'] as string | undefined;
    const fileId = params['file_id'] as string | undefined;
    const groupId = params['group_id'] as string | undefined;

    if (targetUrl && isAllowedProxyDomain(targetUrl)) {
      // pass
    } else if (fileId && groupId) {
      const cacheKey = `${groupId}:${fileId}`;
      const cachedUrl = await groupFilesUrlCache.get(cacheKey);
      if (cachedUrl) {
        targetUrl = cachedUrl;
      } else {
        const result = await makeApiRequest('get_group_file_url', params, ['group_id', 'file_id']);
        if (result['status'] === 'ok') {
          const data = result['data'] as Record<string, unknown> ?? {};
          targetUrl = data['url'] as string | undefined;
          if (targetUrl) {
            await groupFilesUrlCache.set(cacheKey, targetUrl);
          }
        } else {
          return result;
        }
      }
    }

    if (!targetUrl) {
      return { status: 'error', message: '没有有效文件', code: 400 };
    }

    const response = await buildProxyFileResponse(targetUrl, targetName ?? null, rangeHeader);
    reply.status(response.status);
    for (const [key, val] of Object.entries(response.headers)) {
      reply.header(key, val);
    }
    if (response.body) {
      const nodeStream = response.body as unknown as NodeJS.ReadableStream;
      return reply.send(nodeStream);
    }
    return reply.send();
  },
});

app.route({
  method: ['GET', 'POST'],
  url: '/api/proxy_private_file',
  handler: async (request, reply) => {
    const params = await getRequestParams(request);
    const rangeHeader = (request.headers['range'] as string) ?? null;

    let targetUrl = params['url'] as string | undefined;
    const targetName = params['name'] as string | undefined;
    const fileId = params['file_id'] as string | undefined;
    const userId = params['user_id'] as string | undefined;

    if (targetUrl && isAllowedProxyDomain(targetUrl)) {
      // pass
    } else if (fileId && userId) {
      const cacheKey = `${userId}:${fileId}`;
      const cachedUrl = await privateFilesUrlCache.get(cacheKey);
      if (cachedUrl) {
        targetUrl = cachedUrl;
      } else {
        const result = await makeApiRequest('get_private_file_url', params, ['user_id', 'file_id']);
        if (result['status'] === 'ok') {
          const data = result['data'] as Record<string, unknown> ?? {};
          targetUrl = data['url'] as string | undefined;
          if (targetUrl) {
            await privateFilesUrlCache.set(cacheKey, targetUrl);
          }
        } else {
          return result;
        }
      }
    }

    if (!targetUrl) {
      return { status: 'error', message: '没有有效文件', code: 400 };
    }

    const response = await buildProxyFileResponse(targetUrl, targetName ?? null, rangeHeader);
    reply.status(response.status);
    for (const [key, val] of Object.entries(response.headers)) {
      reply.header(key, val);
    }
    if (response.body) {
      const nodeStream = response.body as unknown as NodeJS.ReadableStream;
      return reply.send(nodeStream);
    }
    return reply.send();
  },
});

// 内存缓存实例
const groupFilesUrlCache = new TTLCache(600); // 缓存 10 分钟
const privateFilesUrlCache = new TTLCache(600); // 缓存 10 分钟

// 托管 viewer/dist 静态文件
const viewerDistPath = resolve(projectRoot, 'viewer', 'dist');
if (existsSync(viewerDistPath)) {
  await app.register(fastifyStatic, {
    root: viewerDistPath,
    prefix: '/',
    wildcard: false,
  });
} else {
  console.log("前端网页不存在，请先构建前端")
}

// History路由兜底
app.setNotFoundHandler(async (request, reply) => {
  // 如果是 API 路由，返回 404
  if (request.url.startsWith('/api/') || request.url.startsWith('/ws')) {
    return reply.status(404).send({ error: 'Not Found' });
  }
  // 否则返回 index.html 用于前端路由
  return reply.sendFile('index.html');
});

// 启动服务器
async function start(): Promise<void> {
  try {
    const address = await app.listen({ host: config.WEB_HOST, port: config.WEB_PORT });
    console.log(`Starting server at http://${config.WEB_HOST}:${config.WEB_PORT}`);
    app.log.info(`Server listening at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

await start();