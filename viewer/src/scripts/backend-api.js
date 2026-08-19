// 获取显示名称的函数
import axios from "axios";
import { showErrorToast, showSuccessToast, showToast } from "./toast.js";
import { createSHA256 } from 'hash-wasm';
import { nanoid } from 'nanoid';
import { CalledEmitter, Emitter } from "../composables/useEventBus.js";
import {
  convertCategoricalFriendsSL,
  convertContactsSL,
  convertEssenceMsgListSL,
  convertGroupAlbumListSL,
  convertGroupAlbumMediaListSL,
  convertGroupFilesSL,
  convertStrangerInfoSL,
  convertWrappedMsgSL
} from "./snow-luma-translator.js";
import { parseJSON, stringifyJSON, trimTrailingSlash } from "./util.js";

import { isArray, isNumber, isObject, isString, isUndefined, mergeNotEmpty, objectHasKey } from "./types-util.js";
import {
  CacheNameKey,
  setCacheName,
  setFriendListCache,
  setGroupInfoCache,
  setGroupListCache,
  setGroupMemberInfoCache,
  setGroupMemberListCache,
  setStrangerInfoCache,
  setUserPersonalization,
  updateGroupInfoCache,
  updateGroupMemberInfoCache
} from "./user-info-util.js";
import { isGroupContact } from "@/scripts/contacts-util.js";
import { gteSnowLuma, isSnowLuma } from "@/scripts/onebot-version-util.js";

/**
 * 替换URL中的 sitehost 为当前页面真实主机（支持 sitehost:自定义端口 格式）
 * @param {string} urlStr 原始带sitehost的链接
 * @returns {string} 替换完成的真实地址
 */
function replaceSiteHost(urlStr) {
  if (!urlStr || !isString(urlStr)) return urlStr;

  const currentProtocol = location.protocol;
  const currentHost = location.host; // 自带端口 a.com:5173
  const currentWsProtocol = currentProtocol === 'https:' ? 'wss:' : 'ws:';

  // 匹配：http://sitehost 或 http://sitehost:自定义端口
  return urlStr.replace(/(http|https|ws|wss):\/\/sitehost(:\d+)?/g, (match, proto, portPart) => {
    // 如果原链接带自定义端口，就保留端口；否则用当前页面host（自带端口）
    const targetHost = portPart ? `${ currentHost.split(':')[0] }${ portPart }` : currentHost;
    if (proto === 'ws' || proto === 'wss') {
      return `${ currentWsProtocol }//${ targetHost }`;
    }
    return `${ currentProtocol }//${ targetHost }`;
  });
}

let apiBaseUrl = trimTrailingSlash(replaceSiteHost(import.meta.env.VITE_API_BASE_URL ?? "http://sitehost"));
let wsUri = trimTrailingSlash(replaceSiteHost(import.meta.env.VITE_WS_URI ?? "ws://sitehost/ws/frontend"));

// 从 localStorage 读取 OneBot 配置
const getSelectedAccount = () => {
  try {
    const saved = localStorage.getItem('selectedAccount')
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

const getOnebotWsUri = () => {
  const account = getSelectedAccount()
  if (account?.mode === 'direct' && account?.wsUri) return account.wsUri
  return ''
}

const getOnebotWsToken = () => {
  const account = getSelectedAccount()
  if (account?.mode === 'direct' && account?.wsToken) return account.wsToken
  return ''
}

const getIsDirectOnebot = () => {
  const account = getSelectedAccount()
  return account?.mode === 'direct'
}

const fetchOptionsAction = async ({ endpoint, data, signal, timeout }) => {
  try {
    if (signal instanceof AbortController) {
      signal = signal.signal
    }
    return await CalledEmitter.emit(["sendAction", timeout], endpoint, data, signal, timeout)
  } catch (e) {
    showToast("error", `Fetch action ${ endpoint } error`);
    console.error(`Fetch action ${ endpoint } error`, e);
    throw e;
  }
}

const fetchAction = async (endpoint, data, signal, timeout) => {
  return await fetchOptionsAction({ endpoint, data, signal, timeout })
}

const checkResponseOK = response => {
  return response?.status === 'ok'
}

const fetchActionData = async (endpoint, params, signal) => {
  const response = await fetchAction(endpoint, params, signal)
  if (checkResponseOK(response)) {
    return response.data;
  }
  throw new Error(`Action ${ endpoint } error: ` + JSON.stringify(response))
}

/**
 * 通过 WebSocket 的 req_backend 类型请求后端（FastAPI 本地接口）
 * @param {string} endpoint - 后端端点名 (contacts / get_msg / messages / sync)
 * @param {object} [params] - 请求参数
 * @param {AbortSignal|AbortController} [signal] - 中断信号
 * @returns {Promise<any>} 后端响应数据
 */
const fetchBackend = async (endpoint, params = {}, signal) => {
  try {
    if (signal instanceof AbortController) {
      signal = signal.signal
    }
    return await CalledEmitter.emit(["reqBackend", 10 * 60 * 1000], endpoint, params, signal)
  } catch (e) {
    showToast("error", `Fetch backend ${ endpoint } error`);
    console.error(`Fetch backend ${ endpoint } error`, e);
    throw e;
  }
}

const fetchBackendData = async (endpoint, params, signal) => {
  const response = await fetchBackend(endpoint, params, signal)
  if (['success', 'ok'].includes(response.status)) {
    return response.data;
  }
  throw new Error(`Backend ${ endpoint } error: ` + JSON.stringify(response))
}

const fetchAPI = async (endpoint, params = {}, method = 'POST', data = null, signal = null) => {
  try {
    if (signal instanceof AbortController) {
      signal = signal.signal
    }
    const config = {
      method: method.toLowerCase(), // 确保方法小写
      url: `${ apiBaseUrl }/api/${ endpoint }`,
      params: method.toUpperCase() === 'GET' ? params : (data === null ? {} : params),
      data: method.toUpperCase() === 'POST' ? data || params : {} // POST请求使用data
    };
    if (signal instanceof AbortSignal) {
      config['signal'] = signal
    }

    const response = await axios(config);
    return response.data;
  } catch (e) {
    showToast("error", `${ method } API ${ endpoint } error`);
    console.error(`${ method } API ${ endpoint } error: `, e);
    throw new Error(`${ method } API ${ endpoint } error`);
  }
};

const fetchOptionsAPI = (endpoint, options) => {
  if (options instanceof Object) {
    if (options.controller instanceof AbortController) {
      options.signal = options.controller.signal
    }
    return fetchAPI(endpoint, options.params, options.method, options.data, options.signal)
  }
}

const fetchDataInfo = async (endpoint, params) => {
  const response = await fetchAPI(endpoint, params)
  if (response.code === 200) {
    return response.data;
  }
  // showToast("error", `Request ${endpoint} error`)
  throw new Error(`Request ${ endpoint } error: ` + JSON.stringify(response))
}

export const fetchGroupInfo = async (group_id) => {
  return setGroupInfoCache(
    group_id,
    await fetchActionData('get_group_info', { group_id: group_id })
  )
}

const fetchStrangerInfo = async user_id => {
  // noinspection ES6MissingAwait
  fetchUserPersonalization(user_id)
  return setStrangerInfoCache(
    user_id,
    convertStrangerInfoSL(await fetchActionData("get_stranger_info", { user_id }))
  )
}

// SnowLuma 获取个性装扮
const fetchUserPersonalization = async user_id => {
  if (isSnowLuma()) {
    return setUserPersonalization(
      user_id,
      (await fetchActionData("_get_friend_dress", { user_id }))?.items
    )
  }
  return null
}

const getUserAvatarFrame = (personalization, returnUrl = true) => {
  const item = personalization?.find?.(item => item.kind === '挂件')
  return returnUrl ? item?.preview_url : item
}

const fetchGroupMemberInfo = async (group_id, user_id) => {
  return setGroupMemberInfoCache(
    group_id, user_id,
    await fetchActionData("get_group_member_info", { group_id, user_id })
  )
}

const fetchGroupMemberList = async (group_id) => {
  return setGroupMemberListCache(
    group_id,
    await fetchActionData("get_group_member_list", { group_id })
  )
}

const fetchFriendList = async (force = false) => {
  return setFriendListCache(
    await fetchActionData("get_friend_list")
  )
}

const fetchFriendInfo = async (user_id) => {
  return (await fetchFriendList()).find(user => user.user_id === user_id);
}

const fetchUserInfo = async (user_id) => {
  let user = await fetchFriendInfo(user_id)
  if (!user) {
    user = await fetchStrangerInfo(user_id)
  }
  return user
}

const fetchMessages = async (params) => {
  const result = await fetchBackendData(
    'messages',
    Object.assign(
      {},
      {
        limit: 20,
        direction: 'prev',
      },
      params,
    )
  )
  const messages = result.messages
  if (Array.isArray(messages)) {
    for (const index in messages) {
      messages[index] = convertWrappedMsgSL(messages[index])
    }
  }
  return result
}

const fetchMsg = async (msg_id) => {
  return await fetchBackendData('get_msg', { message_id: msg_id })
}

const fetchSyncMessages = async last_id => {
  return await fetchBackendData('sync', { last_id })
}

const fetchForwardMessage = async (id) => {
  return (await fetchActionData('get_forward_msg', { message_id: id })).messages
}

const convertMessagesToForwardNodes = messages => messages.map(
  event => ({
    type: "node",
    data: {
      id: event.message_id,
      user_id: event.user_id,
      nickname: event.sender.nickname,
      content: event.message,
      time: event.time,
    }
  })
)

/**
 * 发送消息接口封装
 * @param {object} contact 联系人对象 { type: 'group'|'private', contact_id: number }
 * @param {string | Array} message 消息内容，字符串或消息段数组
 * @param {AbortSignal} signal 中断信号
 * @param [timeout] 超时时间
 * @returns {Promise<any>} OneBot接口返回结果
 */
const fetchSendMessageOptions = async ({ contact, message, signal, timeout = undefined }) => {
  const isGroup = contact.type === 'group';
  const idField = isGroup ? 'group_id' : 'user_id'
  const { contact_id } = contact

  // 字符串JSON解析
  message = parseJSON(message);

  if (isArray(message)) {
    // 戳一戳特殊逻辑
    if (message.length > 0) {
      const firstSeg = message[0];
      if (firstSeg.type === 'poke' && firstSeg.data) {
        const pokeData = firstSeg.data;
        if (!objectHasKey(pokeData, "id") && !objectHasKey(pokeData, "type")) { // 不是窗口抖动
          const pokeUser = pokeData.user_id ?? -1;
          const pokeGroup = pokeData.group_id ?? -1;
          const pokeTarget = pokeData.target_id ?? -1;

          const reqData = {
            user_id: pokeUser || pokeTarget,
            target_id: pokeTarget || pokeUser,
          };
          if (pokeGroup !== -1) {
            reqData.group_id = pokeGroup;
          }

          if (pokeUser !== -1) {
            return await fetchAction("send_poke", reqData, signal, timeout);
          }
        }
      }
    }

    if (message.length === 1) {
      const msg = message[0]
      if (isObject(msg)) {
        const { type, data } = msg
        if (isObject(data)) {
          // 群文件特殊逻辑
          if (type === 'file') {
            const { file, name, folder_id } = data
            if (isString(folder_id)) {
              return await fetchAction("upload_group_file", {
                group_id: contact_id,
                file,
                name,
                folder_id
              })
            }
          }
          // 群相册特殊逻辑
          if (['image', 'video'].includes(type)) {
            const { album_id, album_name, file } = data
            if (isString(album_id)) {
              return await fetchAction("upload_image_to_qun_album", {
                group_id: contact_id,
                file,
                album_id,
                album_name
              })
            }
          }
          // 闪传文件特殊逻辑
          if (type === "flashtransfer") {
            const { fileSetId } = data
            return await fetchAction("send_flash_msg", {
              fileset_id: fileSetId,
              [idField]: contact_id
            })
          }
          // 合并转发特殊逻辑
          if (type === "forward") {
            return await fetchAction("send_forward_msg", {
              [idField]: contact_id,
              messages: convertMessagesToForwardNodes(data.content)
            })
          }
        }
      }
    }
  }

  // 组装普通消息请求参数
  const reqData = { message };
  reqData[idField] = contact_id
  // 拼接接口 endpoint
  const endpoint = isGroup ? "send_group_msg" : "send_private_msg";

  return await fetchAction(endpoint, reqData, signal, timeout);
}


const fetchSendMessage = async (contact, message, signal, timeout) => {
  return await fetchSendMessageOptions({ contact, message, signal, timeout })
}

const fetchEssenceMessages = async (group_id, only_real_seq) => {
  const data = convertEssenceMsgListSL(await fetchActionData('get_essence_msg_list', { group_id, only_real_seq }))
  return only_real_seq ? data.map(item => item.msg_seq) : data
}

const fetchChangeEssenceMsg = async (message_id, set) => {
  return await fetchAction(set ? 'set_essence_msg' : 'delete_essence_msg', { message_id })
}

const fetchRecallMessage = async (message_id) => {
  return await fetchAction('delete_msg', { message_id })
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

const fetchSendFiles = async ({ contact, files, signal, controller, type = 'file' }) => {
  if (!(signal instanceof AbortSignal) && controller instanceof AbortController) {
    signal = controller.signal
  }
  const message = [];
  if (!Array.isArray(files)) {
    files = [files]
  }
  for (const file of files) {
    try {
      const base64 = await fileToBase64(file);
      message.push({
        type,
        data: {
          file: base64,
          name: file.name
        }
      });
    } catch (error) {
      console.error(`文件 ${ file.name } 转换 Base64 失败:`, error);
      showToast('error', `文件 ${ file.name } 发送失败`)
    }
  }
  if (message?.length) {
    if (signal?.aborted || signal?.signal?.aborted) {
      return
    }
    return await fetchSendMessageOptions({ contact, message, signal, timeout: 20 * 60 * 1000 })
  }
}

/**
 * 分片计算文件SHA256，兼容http不安全上下文
 * @param file File对象
 * @param chunkSize 分片大小 默认2MB
 * @param onProgress 进度回调 (0~1)
 * @returns sha256 十六进制字符串
 */
export async function calcFileSha256(file, chunkSize = 2 * 1024 * 1024, onProgress) {
  // 创建独立sha256实例
  const hasher = await createSHA256()
  hasher.init()

  const totalSize = file.size
  let offset = 0

  while (offset < totalSize) {
    // 截取文件分片
    const slice = file.slice(offset, offset + chunkSize)
    const buf = await slice.arrayBuffer()
    const uint8 = new Uint8Array(buf)

    // 流式更新哈希
    hasher.update(uint8)

    offset += buf.byteLength
    // 进度回调
    if (onProgress) {
      onProgress(offset / totalSize)
    }
  }

  // 输出十六进制哈希
  return hasher.digest('hex')
}

/**
 * 根据文件字节大小，计算需要保留多少毫秒才足够上传
 * @param {number} fileBytes File.size 原始字节
 * @param {number} minUploadMbps 保底上传带宽 Mbps，默认1Mbps（移动端弱网）
 * @param {number} bufferMs 额外缓冲毫秒，默认30000(30s)
 * @returns {number} 文件保留TTL毫秒
 */
function calcFileSafeTTL(fileBytes, minUploadMbps = 1, bufferMs = 30000) {
  if (fileBytes <= 0) return bufferMs

  const bitPerByte = 8
  const bitPerMbps = 1_000_000
  const efficiency = 0.7 // 网络损耗系数

  // 1. 文件总比特
  const totalBits = fileBytes * bitPerByte
  // 2. 每秒有效比特
  const effectiveBitPerSec = minUploadMbps * bitPerMbps * efficiency
  // 3. 纯传输耗时 毫秒
  const transferMs = (totalBits / effectiveBitPerSec) * 1000
  // 4. 总保留时间 = 传输耗时 + 缓冲
  return Math.ceil(transferMs + bufferMs)
}

/**
 * 通过 sendAction 分块上传大文件（每块 64KB）
 * 参考 test_upload_stream.py 的 upload_file_stream_batch 实现
 *
 * @param {object} task - 上传任务
 * @param {object} task.contact - 联系人信息 { contact_id, type }
 * @param {File} task.file - 要上传的文件对象
 * @param {AbortController} task.controller - 中止控制器
 * @param {number} task.start_timestamp
 * @param {number} task.chunk_size
 * @param {number} task.chunk_index
 * @param {number} task.total_chunks
 * @param {boolean} task.is_calc_hash
 * @param {boolean} task.is_merging
 * @param {boolean} task.is_backend_uploading
 * @param {string} [task.type='file'] - 发送消息类型
 * @returns {Promise<object>} 上传完成后的消息响应
 */
const fetchSendFileStream = async (task) => {
  const { contact, file, controller, attachInfo } = task
  const CHUNK_SIZE = 64 * 1024; // 64KB
  const streamId = nanoid();
  const fileName = file.name;
  const fileSize = file.size;
  const timeout = calcFileSafeTTL(fileSize);
  const sha256 = await calcFileSha256(file);
  const startTimestamp = Date.now();
  const uploadName = `${ fileName }-${ sha256 }`;

  // console.log(`[fetchSendFileStream] 开始上传文件: ${fileName}`);
  // console.log(`[fetchSendFileStream] 文件大小: ${fileSize} 字节`);
  // console.log(`[fetchSendFileStream] 分块大小: ${CHUNK_SIZE} 字节 (64KB)`);
  // console.log(`[fetchSendFileStream] 流ID: ${streamId}`);

  task.start_timestamp = startTimestamp
  task.chunk_size = CHUNK_SIZE
  task.is_calc_hash = false

  // 分片懒读取工具：只读取当前需要的片段，不加载完整文件
  const readSingleChunk = async (start, end) => {
    const blob = file.slice(start, end);
    return await blob.arrayBuffer();
  };

  try {
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    task.total_chunks = totalChunks

    console.log(`[fetchSendFileStream] 文件 ${ fileName } 读取完成, 总块数: ${ totalChunks }, SHA256: ${ sha256 }`);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      // 检查是否被中止
      if (controller?.signal?.aborted) {
        throw new Error(`${ fileName } 上传已取消`);
      }
      task.chunk_index = chunkIndex

      // 提取当前块数据（按需切片读取，不再一次性加载全部buffer）
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkData = await readSingleChunk(start, end);

      // 将块数据编码为 base64
      const chunkBytes = new Uint8Array(chunkData);
      let binary = '';
      for (let i = 0; i < chunkBytes.length; i++) {
        binary += String.fromCharCode(chunkBytes[i]);
      }
      const chunkBase64 = btoa(binary);

      // 构建 upload_file_stream 参数
      const params = {
        stream_id: streamId,
        chunk_data: chunkBase64,
        chunk_index: chunkIndex,
        total_chunks: totalChunks,
        file_size: totalSize,
        filename: uploadName,
        file_retention: timeout,
        expected_sha256: sha256
      };

      // console.log(`[fetchSendFileStream] 发送分片 ${chunkIndex + 1}/${totalChunks} (${chunkBytes.length} 字节, 已耗时 ${((Date.now() - startTimestamp) / 1000).toFixed(1)}s)`);

      // 通过 sendAction 发送分片
      const response = await fetchActionData('upload_file_stream', params);

      // console.log(`[fetchSendFileStream] 分片 ${chunkIndex + 1}/${totalChunks} 响应:`, response);

      if (response?.status !== 'chunk_received') {
        throw new Error(`上传分片 ${ chunkIndex } 失败: ${ JSON.stringify(response) }`);
      }
    }

    // 所有分片发送完成，发送完成信号
    console.log(`[fetchSendFileStream] ${ fileName } 所有分片发送完成, 请求文件合并...`);
    task.is_calc_hash = false
    task.is_merging = true

    const completeParams = {
      stream_id: streamId,
      is_complete: true,
      total_chunks: totalChunks,
      file_size: totalSize,
      filename: uploadName,
      start_timestamp: startTimestamp
    };

    const completeResponse = await fetchActionData('upload_file_stream', completeParams);

    // console.log(`[fetchSendFileStream] 合并响应:`, completeResponse);

    const result = completeResponse || {};

    if (result.status === 'file_complete') {
      task.is_merging = false
      task.is_backend_uploading = true
      const file = result.file_path
      // const elapsed = ((Date.now() - startTimestamp) / 1000).toFixed(1);
      // console.log(`[fetchSendFileStream] ✅ 文件上传成功!`);
      // console.log(`[fetchSendFileStream]    - 文件路径: ${result.file_path}`);
      // console.log(`[fetchSendFileStream]    - 文件大小: ${file} 字节`);
      // console.log(`[fetchSendFileStream]    - SHA256: ${result.sha256}`);
      // console.log(`[fetchSendFileStream]    - 总计耗时: ${elapsed}s`);

      const data = {
        file,
        name: fileName
      }
      // 现在发送文件到聊天
      const message = [{
        type: task.type,
        data
      }];

      if (isObject(attachInfo)) {
        const { folder_id, album_name, album_id } = attachInfo
        if (isString(folder_id)) {
          data.folder_id = folder_id
        } else if (isString(album_id)) {
          data.album_name = album_name
          data.album_id = album_id
        } else if (attachInfo.flash) {
          return {
            status: "ok",
            data
          }
        }
      }
      if (task.type === 'face') {
        return await fetchAddCustomFaceOptions({ file, signal: controller, timeout })
      }

      return await fetchSendMessage(contact, message, controller, timeout)
    } else {
      throw new Error(`文件状态异常: ${ JSON.stringify(result) }`);
    }

  } catch (error) {
    console.error(`[fetchSendFileStream] ❌ 上传失败:`, error);
    throw error;
  }
};

const fetchCategoricalFriends = async () => {
  return convertCategoricalFriendsSL(await fetchActionData('get_friends_with_category'))
}

const fetchGroupList = async () => {
  return setGroupListCache(
    await fetchActionData('get_group_list')
  )
}

const fetchForwardSingleMsg = async (message_id, contact) => {
  const isGroup = contact.type === 'group'
  return await fetchAction(`forward_${ isGroup ? "group" : "friend" }_single_msg`, {
    message_id,
    [isGroup ? "group_id" : "user_id"]: contact.contact_id
  })
}

const fetchGroupNotice = async (group_id) => {
  const res = await fetchActionData('_get_group_notice', { group_id })
  // 如果不是数组直接原样返回
  if (!isArray(res)) return res

  return [...res].sort((a, b) => {
    // pinned=1 优先排在前面
    const aPinned = Number(a.pinned) === 1 ? 1 : 0
    const bPinned = Number(b.pinned) === 1 ? 1 : 0

    if (aPinned !== bPinned) {
      // 1 - 0，置顶在前
      return bPinned - aPinned
    }
    // 同组内 publish_time 新到旧（大时间在前）
    return new Date(b.publish_time || 0) - new Date(a.publish_time || 0)
  })
}


const fetchDeleteGroupNotice = async (group_id, notice_id) => {
  return fetchAction('_del_group_notice', { group_id, notice_id })
}

const fetchLoginInfo = async (group_id) => {
  return fetchActionData('get_login_info', { group_id })
}

const fetchSetGroupRemark = async (group_id, remark) => {
  const result = await fetchAction('set_group_remark', { group_id, remark })
  if (checkResponseOK(result)) {
    setCacheName(group_id, CacheNameKey.GROUP_REMARK, remark)
  }
  return result
}

const fetchSetGroupMemberCard = async (group_id, user_id, card) => {
  const result = await fetchAction('set_group_card', { group_id, user_id, card })
  if (checkResponseOK(result)) {
    setCacheName([group_id, user_id], CacheNameKey.GROUP_USER_CARD, card)
  }
  return result
}

const fetchSetLongNick = async (longNick) => {
  return await fetchAction('set_self_longnick', { longNick })
}

const fetchRemainGroupAtAll = async (group_id) => {
  return await fetchActionData('get_group_at_all_remain', { group_id })
}

const fetchAPIVersionInfo = async () => {
  return await fetchActionData("get_version_info")
}

const fetchGroupRootFiles = async (group_id) => {
  return convertGroupFilesSL(await fetchActionData("get_group_root_files", { group_id, file_count: 114514 }))
}

const fetchGroupFolderFiles = async (group_id, folder_id) => {
  if (!folder_id || folder_id === 'root' || folder_id === '/') {
    return await fetchGroupRootFiles(group_id)
  }
  return convertGroupFilesSL(await fetchActionData("get_group_files_by_folder", {
    group_id,
    folder_id,
    file_count: 114514
  }))
}

const fetchGroupFileSysInfo = async (group_id) => {
  return await fetchActionData("get_group_file_system_info", { group_id })
}

const fetchGroupFileUrl = async (group_id, file_id) => {
  return (await fetchActionData("get_group_file_url", { group_id, file_id }))?.url
}

const fetchGroupAlbumList = async (group_id, attach_info) => {
  const snowLumaEndpoint = "get_group_album_list"
  const params = { group_id, attach_info }
  if (isSnowLuma()) {
    return convertGroupAlbumListSL(await fetchActionData(snowLumaEndpoint, params));
  } else {
    const ncData = await fetchActionData("get_qun_album_list", params)
    if (ncData.album_list?.length && Object.keys(ncData.album_list[0]).length === 1) { // SnowLuma get_qun_album_list 只有 album_id
      return convertGroupAlbumListSL(await fetchActionData(snowLumaEndpoint, params));
    }
    return ncData;
  }
}

const fetchGroupAlbumMediaList = async (group_id, album_id, attach_info) => {
  return convertGroupAlbumMediaListSL(await fetchActionData("get_group_album_media_list", {
    group_id,
    album_id,
    attach_info
  }))
}

const fetchDeleteGroupAlbumMedia = async (group_id, album_id, lloc) => {
  return await fetchAction("del_group_album_media", { group_id, album_id, lloc })
}


const fetchAiRecordCharacters = async (group_id) => {
  return await fetchActionData("get_ai_characters", { group_id })
}

const fetchSendGroupAiRecord = async (group_id, character, text) => {
  return await fetchAction("send_group_ai_record", { group_id, character, text })
}

/**
 * 拉取并组装完整联系人分类数据（纯函数，返回普通数组，无响应式）
 * @returns {Promise<Array>} categorizedContacts 分组的联系人列表
 */
async function fetchCategorizedContacts() {
  // 1. 异步请求三组原始数据
  const [categoricalFriendsRaw, groupsRaw, recentContactsRaw] = await Promise.all([
    fetchCategoricalFriends(),
    fetchGroupList(),
    fetchContacts()
  ])

  const categories = []
  const friendGroupMap = new Map()

  // 填充好友映射
  if (categoricalFriendsRaw?.length) {
    for (const category of categoricalFriendsRaw) {
      for (const contact of category.buddyList) {
        const key = `private-${ contact.user_id }`
        friendGroupMap.set(key, {
          name: contact.remark || contact.nickname,
          real_name: contact.nickname,
          remark: contact.remark
        })
      }
    }
  }

  // 填充群聊映射
  if (groupsRaw?.length) {
    for (const contact of groupsRaw) {
      const key = `group-${ contact.group_id }`
      friendGroupMap.set(key, {
        name: contact.group_remark || contact.group_name,
        real_name: contact.group_name,
        remark: contact.group_remark
      })
    }
  }

  // 组装最近聊天（覆盖name/real_name逻辑不变）
  if (recentContactsRaw?.length) {
    const contacts = []
    for (const contact of recentContactsRaw) {
      const key = `${ contact.type }-${ contact.contact_id }`
      const source = friendGroupMap.get(key)
      contacts.push({
        ...contact,
        name: source ? source.name : contact.name,
        real_name: source ? source.real_name : undefined,
        remark: source ? source.remark : undefined,
      })
    }
    categories.push({
      name: '最近聊天',
      contacts,
      id: -100
    })
  } else {
    categories.push({
      name: '最近聊天',
      contacts: [],
      id: -100
    })
  }

  // 组装好友分组
  if (categoricalFriendsRaw?.length) {
    for (const category of categoricalFriendsRaw) {
      const contacts = []
      for (const contact of category.buddyList) {
        contacts.push({
          contact_id: contact.user_id,
          name: contact.remark || contact.nickname,
          type: 'private',
          real_name: contact.nickname,
          remark: contact.remark
        })
      }
      categories.push({
        name: category.categoryName,
        id: category.categoryId,
        contacts
      })
    }
  }

  // 组装群聊
  if (groupsRaw?.length) {
    const contacts = []
    for (const contact of groupsRaw) {
      contacts.push({
        name: contact.group_remark || contact.group_name,
        contact_id: contact.group_id,
        type: 'group',
        real_name: contact.group_name,
        remark: contact.group_remark
      })
    }
    categories.push({
      name: '群聊',
      id: -200,
      contacts
    })
  }

  // 返回纯普通数组，无ref/computed响应式包装
  return categories
}

async function fetchTranslateEnglish(text) {
  return (
    await fetchActionData('translate_en2zh', { words: [text] })
  )?.words?.[0]
}

async function fetchRecordToText(message_id) {
  return (
    await fetchActionData('fetch_ptt_text', { message_id })
  ).text
}

async function fetchSetFriendRemark(user_id, remark) {
  const result = await fetchAction('set_friend_remark', { user_id, remark })
  if (checkResponseOK(result)) {
    setCacheName(user_id, CacheNameKey.USER_REMARK, remark)
  }
  return result
}

async function fetchKickGroupUser(group_id, user_id, reject_add_request = false) {
  return await fetchAction('set_group_kick', { group_id, user_id, reject_add_request })
}

const fetchContacts = async () => {
  return convertContactsSL(await fetchBackendData("contacts"))
}

const getApiBaseUrl = () => {
  if (getIsDirectOnebot()) {
    return "virtual:"
  } else {
    return apiBaseUrl
  }
}

const getMultimediaProxyUrl = (url) => {
  return `${ apiBaseUrl }/api/proxy_multimedia?url=${ encodeURIComponent(url) }`
}

const getFileDataUrl = (file_id, type) => {
  if (isObject(file_id)) {
    const data = file_id
    file_id = data?.data?.file_id || data?.data?.file
    type = data?.type
    if (['video'].includes(type)) {
      type = 'file'
    }
    const url = data?.data?.url
    if (url?.startsWith("data:")) {
      return url;
    }
  }

  type = type || 'file'
  return `${ getApiBaseUrl() }/api/get_file_data?type=${ encodeURIComponent(type) }&file_id=${ encodeURIComponent(file_id) }`
}

const getStreamFileDataUrl = file_id => {
  if (isObject(file_id)) {
    const data = file_id
    file_id = data?.data?.file_id || data?.data?.file
  }
  return `${ getApiBaseUrl() }/api/get_stream_file_data?file_id=${ encodeURIComponent(file_id) }`
}

const getGroupLogo = (group_id, size = 100) => {
  return `https://p.qlogo.cn/gh/${ group_id }/${ group_id }/${ size }`
}

const getUserLogo = (user_id, size = 100) => {
  return `https://q1.qlogo.cn/g?b=qq&nk=${ user_id }&s=${ size }`
}

const getGroupNoticePicUrl = (pic_url) => {
  return `https://gdynamic.qpic.cn/gdynamic/${ pic_url }/0`
}

const getGroupFileProxyUrl = (group_id, file_id, name, url = '') => {
  return `${ getApiBaseUrl() }/api/proxy_group_file?group_id=${ group_id }&file_id=${ encodeURIComponent(file_id) }&name=${ encodeURIComponent(name) }&url=${ encodeURIComponent(url) }`
}

const getPrivateFileProxyUrl = (user_id, file_id, name, url = '') => {
  // 校验是否匹配 /asn.com/qqdownloadftnv5 严格路径，跨域直接返回
  try {
    const urlObj = new URL(url);
    const targetPath = "/asn.com/qqdownloadftnv5";
    const path = urlObj.pathname;
    // 严格匹配：路径完全等于 或 路径后紧跟 ? 参数
    const matchPath = path === targetPath || path.startsWith(`${ targetPath }?`);

    // 满足条件：路径匹配 + 直连模式开启，直接返回原url
    if (matchPath && getIsDirectOnebot()) {
      return url;
    }
  } catch (err) {
    // url非法，走代理逻辑
  }

  // 不满足则返回代理地址
  return `${ getApiBaseUrl() }/api/proxy_private_file?user_id=${ user_id }&file_id=${ encodeURIComponent(file_id) }&name=${ encodeURIComponent(name) }&url=${ encodeURIComponent(url) }`;
};

// ===================== 账户管理 API =====================

/**
 * 检测后端是否存活
 */
const fetchBackendHealth = async () => {
  try {
    const response = await axios.get(`${ apiBaseUrl }/api/health`, { timeout: 5000 });
    return response.data?.data?.alive === true;
  } catch {
    return false;
  }
};

/**
 * 获取后端所有已连接的BOT列表
 * @returns {Promise<Array<{self_id: string, user_id: number, nickname: string}>>}
 */
const fetchBackendBots = async () => {
  try {
    const response = await axios.get(`${ apiBaseUrl }/api/bots`, { timeout: 10000 });
    if (response.data?.code === 200) {
      return response.data.data || [];
    }
    return [];
  } catch {
    return [];
  }
};

async function fetchSetGroupSign(group_id) {
  return await fetchAction('set_group_sign', { group_id })
}

async function fetchGroupSignedList(group_id) {
  return await fetchActionData('get_group_signed_list', { group_id })
}

async function fetchProfileLikeInfo(user_id) {
  return await fetchActionData("get_profile_like", { user_id })
}

async function fetchSendProfileLike(user_id, times = 1) {
  return await fetchAction("send_like", { user_id, times })
}

async function fetchCreateGroupFolder(group_id, name) {
  return await fetchAction("create_group_file_folder", { group_id, name })
}

async function fetchDeleteGroupFolder(group_id, folder_id) {
  return await fetchAction("delete_group_folder", { group_id, folder_id })
}

async function fetchDeleteGroupFile(group_id, file_id) {
  return await fetchAction("delete_group_file", { group_id, file_id })
}

async function fetchRenameGroupFile(group_id, file_id, current_parent_directory, new_name) {
  return await fetchAction("rename_group_file", {
    group_id, file_id, current_parent_directory, new_name
  })
}

async function fetchRenameGroupFolder(group_id, folder_id, name) {
  return await fetchAction("rename_group_file_folder", { group_id, folder_id, name })
}

// duration 秒
async function fetchSetGroupMute(group_id, user_id, duration) {
  return await fetchAction("set_group_ban", { group_id, user_id, duration })
}

async function fetchGroupMutedList(group_id) {
  const result = await fetchActionData("get_group_shut_list", { group_id })
  if (isArray(result)) {
    for (const user of result) {
      updateGroupMemberInfoCache(group_id, user.user_id, { shut_up_timestamp: user.shut_up_time })
    }
  }
  return result
}

async function fetchSetGroupAdmin(group_id, user_id, enable = true) {
  const result = await fetchAction('set_group_admin', { group_id, user_id, enable })
  if (checkResponseOK(result)) {
    updateGroupMemberInfoCache(group_id, user_id, { role: enable ? "admin" : "member" })
  }
  return result
}

async function fetchSetGroupName(group_id, group_name) {
  const result = await fetchAction('set_group_name', { group_id, group_name })
  if (checkResponseOK(result)) {
    updateGroupInfoCache(group_id, { group_name: group_name })
  }
  return result
}

async function fetchSetGroupAllMuted(group_id, enable) {
  const result = await fetchAction('set_group_whole_ban', { group_id, enable })
  if (checkResponseOK(result)) {
    updateGroupInfoCache(group_id, { group_all_shut: enable ? -1 : 0 })
  }
  return result
}

async function fetchLeaveGroup(group_id, is_dismiss = false) {
  return await fetchAction('set_group_leave', { group_id, is_dismiss })
}

async function fetchDeleteFriend(user_id) {
  return await fetchAction('delete_friend', { user_id })
}

async function fetchSetGroupMemberTitle(group_id, user_id, special_title) {
  const result = await fetchAction('set_group_special_title', { group_id, user_id, special_title })
  if (checkResponseOK(result)) {
    updateGroupMemberInfoCache(group_id, user_id, { title: special_title })
  }
  return result
}

/**
 * 统一执行后端接口、处理响应、弹出提示
 * @param {Promise} apiPromise api调用Promise
 * @param {string} successText 成功提示文案
 * @param {string} failText 失败前置文案
 * @returns {Promise<boolean>} 请求是否成功
 */
async function handleApiRequest(apiPromise, successText, failText) {
  const result = await apiPromise
  if (checkResponseOK(result)) {
    if (!isUndefined(successText)) {
      showSuccessToast(successText)
    }
    return true
  } else {
    console.error(failText, result)
    showErrorToast(`${ failText }: ${ result?.message }`)
    return false
  }
}

function wrapJsonMessageSegment(json) {
  return {
    type: "json",
    data: { data: stringifyJSON(json) }
  }
}

async function fetchContactShareArk({ contact_id, type }) {
  const params = {}
  if (isGroupContact(type)) {
    params.group_id = contact_id
  } else {
    params.user_id = contact_id
  }
  const ark = await fetchActionData("send_ark_share", params)
  if (!ark) return null
  return wrapJsonMessageSegment(ark?.ark || ark?.arkMsg || ark)
}

function uniqueByCustomFaceId(arr) {
  const map = new Map()
  for (const item of arr) {
    // 仅当不存在该 face_id 才存入，保留最先出现、舍弃后续重复
    if (!map.has(item.face_id)) {
      map.set(item.face_id, item)
    }
  }
  return [...map.values()]
}


function getCustomFaceId(url) {
  const match = url.match(/\/([^\/]+)\/[^\/]+$/);
  return match ? match[1] : null
}

async function fetchCustomFace(count = 114514) {
  const result = await fetchActionData("fetch_custom_face", { count, return_type: 'url' })
  return isArray(result) ? uniqueByCustomFaceId(result.map(url => ({
    face_id: getCustomFaceId(url),
    url
  })).reverse()) : result
}

async function fetchCustomFaceDetail(count = 114514) {
  const result = await fetchActionData("fetch_custom_face_detail", { count })
  return isArray(result) ? uniqueByCustomFaceId(
    result.map(
      face => ({
        ...face,
        res_id: face.res_id || face.resId,
        face_id: face.emoji_id || face.res_id || face.resId || getCustomFaceId(face.url)
      })
    ).reverse()
  ) : result
}

async function fetchCustomFaceCompatibly(count) {
  if (!isSnowLuma() || gteSnowLuma(1, 14, 4)) {
    try {
      return await fetchCustomFaceDetail(count)
    } catch (e) {
      if (!e?.message?.includes("unknown action")) {
        throw e
      }
    }
  }
  return await fetchCustomFace(count)
}

async function fetchDeleteCustomFace(face) {
  face = isString(face) ? { face_id: face } : face
  const { face_id, emoji_id, res_id, md5 } = face
  return await fetchAction(
    "delete_custom_face",
    { emoji_id: emoji_id || face_id, res_id: res_id || face_id, md5 }
  )
}

async function fetchModifyCustomFaceDescription(face, desc) {
  face = isString(face) ? { face_id: face } : face
  const { face_id, emoji_id, res_id, md5 } = face
  if (isSnowLuma()) {
    return await fetchAction("modify_custom_face", {
      emoji_id: emoji_id || face_id,
      desc
    })
  } else {
    return await fetchAction("set_custom_face_desc", {
      emoji_id: emoji_id || face_id,
      res_id: res_id || face_id,
      md5,
      desc,
    })
  }
}

async function fetchMoveCustomFaceToFront(emoji_id) {
  if (isSnowLuma()) {
    return await fetchAction("move_custom_face_to_front", { emoji_id })
  }
  return null
}

async function fetchAddCustomFaceOptions({ file, signal, timeout }) {
  const result = await fetchOptionsAction({ endpoint: "add_custom_face", data: { file }, signal, timeout })
  if (checkResponseOK(result)) {
    try {
      Emitter.emit("add-custom-face-success", result.data)
    } catch {
      console.error("添加自定义表情回调失败")
    }
  }
  return result
}

async function fetchAddCustomFace(file) {
  return await fetchAddCustomFaceOptions({ file })
}

/**
 * 拼装QQ表情地址，自动从字符串提取uin（下划线第一段）
 * @param {string} input 标识字符串 / 完整url
 * @returns {string}
 */
function buildCustomFaceUrl(input) {
  if (!isString(input)) return ''
  const trimStr = input.trim()
  if (trimStr.startsWith('http')) return trimStr
  const arr = trimStr.split('_')
  if (arr.length < 2) return ''
  const uin = arr[0]
  return `https://p.qpic.cn/qq_expression/${ uin }/${ trimStr }/0`
}

async function fetchSetGroupTodo(group_id, message_id) {
  return await fetchAction("set_group_todo", { group_id, message_id })
}

async function fetchCancelGroupTodo(group_id, message_id) {
  return await fetchAction("cancel_group_todo", { group_id, message_id })
}

async function fetchCreateFlashTask(files, name) {
  return await fetchActionData("create_flash_task", {
    files, name,
    thumb_path: "https://downv6.qq.com/qqface/default_cover.png"
  })
}

async function fetchFlashFileList(fileset_id) {
  return await fetchActionData("get_flash_file_list", { fileset_id })
}

async function fetchFlashShareLink(fileset_id) {
  const result = await fetchActionData("get_share_link", { fileset_id })
  return isObject(result) ? result.url : (isString(result) ? result : null)
}

// 1: 允许任何人加群 2: 需要发送验证信息 3: 不允许任何人加群 4: 需要正确回答问题 5: 需要回答问题并由管理员审核
async function fetchSetGroupAddOption(group_id, add_type, group_question, group_answer) {
  return await fetchAction("set_group_add_option", { group_id, add_type, group_question, group_answer })
}

// 需要布尔值
async function fetchSetGroupMemberPermissions(group_id, allow_member_upload_album, allow_member_temporary_session, allow_member_create_group) {
  return await fetchAction("set_group_member_permissions", mergeNotEmpty({ group_id }, {
    allow_member_upload_album,
    allow_member_temporary_session,
    allow_member_create_group
  }))
}

// 禁止、需要管理员审核、无需审核、群成员少于100人时无需审核
// 0: disabled 1: no_approval 2: require_approval 3: no_approval_under_100
async function fetchSetGroupMemberInvitePolicy(group_id, policy) {
  if (isNumber(policy)) {
    policy = ["disabled", "no_approval", "require_approval", "no_approval_under_100"][policy] || 'disabled'
  }
  return await fetchAction("set_group_member_invite_policy", { group_id, policy })
}

async function fetchSetGroupNewMemberHistoryVisibility(group_id, visible = true) {
  return await fetchAction("set_group_new_member_history_visibility", { group_id, visible })
}

// 需要先设置群名称
async function fetchSetGroupSearchOption(group_id, search_type) {
  let no_code_finger_open = 1, no_finger_open = 1;
  switch (search_type) {
    case 0: // 不允许被查找
      no_code_finger_open = 1;
      no_finger_open = 1;
      break
    case 1: // 通过群号搜索
      no_code_finger_open = 0;
      no_finger_open = 1;
      break
    case 2: // 通过群号及关键词搜索
      no_code_finger_open = 0;
      no_finger_open = 0;
      break
  }
  return await fetchAction("set_group_search", mergeNotEmpty({ group_id }, {
    no_code_finger_open, no_finger_open
  }))
}

async function fetchSetGroupRobotAddOption(group_id, add_type) {
  let robot_member_switch = 1, robot_member_examine = 2;
  switch (add_type) {
    case 0: // 禁止 bot 入群
      robot_member_switch = 1;
      robot_member_examine = 2;
      break
    case 1: // 无需管理员审核
      robot_member_switch = 0;
      robot_member_examine = 0;
      break
    case 2: // 需要管理员审核
      robot_member_switch = 0;
      robot_member_examine = 2;
      break
  }
  return await fetchAction("set_group_robot_add_option", { group_id, robot_member_switch, robot_member_examine })
}

async function fetchGroupTodoMessage(group_id) {
  // NapCat get_group_info_ex todoSeq 可获取，暂时无法确定具体代表什么序列
  if (!gteSnowLuma(1, 14, 4)) return null
  return (await fetchActionData("get_group_todo_list", { group_id }))[0] || null
}

async function fetchGroupAdminSettings(group_id) {
  if (!gteSnowLuma(1, 14, 11)) return undefined
  return fetchActionData("get_group_admin_settings", { group_id })
}

// 内容 图片路径 使用弹窗展示公告 需群成员确认收到 设为置顶 发送给新成员 引导新成员修改群昵称
async function fetchSendGroupNotice(group_id, content, image, show_popup, confirm_required, pinned, send_to_new_members, is_show_edit_card) {
  return fetchAction("_send_group_notice", {
    group_id,
    content,
    image,
    tip_window_type: show_popup ? 0 : 1,
    confirm_required: confirm_required ? 1 : 0,
    pinned: pinned ? 1 : 0,
    type: send_to_new_members ? 20 : 1
    , is_show_edit_card: is_show_edit_card ? 1 : 0
  })
}

async function fetchCollectionList(
  category = 0,// 收藏分类 ID；0 表示全部分类
  count = 500
) {
  const result = await fetchActionData("get_collection_list", { category, count })
  const list = result?.collectionSearchList?.collectionItemList
  if (isArray(list)) {
    return list
  }
  return []
}

const fetchAddRequests = async () => {
  const result = await fetchBackendData('get_add_requests', {})
  if (isArray(result)) {
    return result.map(result => JSON.parse(result.event))
  }
  return result
}

async function fetchSetFriendAddRequest(flag, approve = true, remark, user_id) {
  const result = fetchAction("set_friend_add_request", { flag, approve, remark })
  if (checkResponseOK(result) && isSnowLuma() && remark && user_id) {
    // noinspection ES6MissingAwait
    fetchSetFriendRemark(user_id, remark)
  }
  return result
}

async function fetchSetGroupAddRequest(
  flag,
  approve = true,
  reason, // 拒绝理由
) {
  return await fetchAction("set_group_add_request", { flag, approve, reason })
}

// 将加群系统消息转为统一的 request event 格式
function convertGroupAddRequestToEvent(list) {
  if (isArray(list)) {
    for (const req of list) {
      req.user_name = req.requester_nick || "";
      req.user_id = req.requester_uin || 0;
      // req.checked true 表示已经处理 false 表示未处理
      req.approved = null
      req.request_type = 'group'
      req.sub_type = req.invitor_uin ? 'invite' : 'add'
      req.comment = req.message
      if (!objectHasKey(req, 'flag')) {
        req.flag = req.sub_type === 'invite' ?
          `invite:${ req.group_id }:${ req.request_id }` : `slreq:1:${ req.request_id }:${ req.group_id }:2:0`
      }
    }
  }
  return list
}

async function fetchGroupAddRequest(count = 100) {
  const result = await fetchActionData("get_group_system_msg", { count })
  let list = null
  if (isArray(result)) {
    list = result
  } else if (isObject(result) && isArray(result.invited_requests)) {
    list = result.invited_requests
  }
  return convertGroupAddRequestToEvent(list)
}

async function fetchIgnoredGroupAddRequests() {
  return convertGroupAddRequestToEvent(await fetchActionData("get_group_ignore_add_request"))
}

// 获取可疑好友申请
async function fetchDoubtFriendAddRequests(count = 114514) {
  const list = await fetchActionData("get_doubt_friends_add_request", { count })
  if (isArray(list)) {
    // 转为 request event
    for (const req of list) {
      req.flag = req.flag ?? req.uin
      req.comment = req.reason ?? (req.msg || req.source)
      req.user_name = req.nickname || req.nick
      req.user_id = req.user_id || req.uin // uin 不是 QQ 号
      req.approved = null
    }
  }
  return list
}

// 只能同意不能拒绝
async function fetchApproveDoubtFriendRequest(flag) {
  return await fetchAction("set_doubt_friends_add_request", { flag, approved: true })
}

export {
  fetchContacts,
  fetchMessages,
  getMultimediaProxyUrl,
  getFileDataUrl,
  fetchMsg,
  fetchForwardMessage,
  fetchSendMessage,
  fetchEssenceMessages,
  fetchChangeEssenceMsg,
  getStreamFileDataUrl,
  fetchSendFiles,
  fetchRecallMessage,
  fetchCategoricalFriends,
  fetchGroupList,
  fetchForwardSingleMsg,
  fetchGroupNotice,
  fetchLoginInfo,
  fetchGroupMemberInfo,
  fetchSetGroupRemark,
  fetchSetGroupMemberCard,
  fetchSendFileStream,
  apiBaseUrl,
  wsUri,
  getOnebotWsUri,
  getOnebotWsToken,
  getIsDirectOnebot,
  getGroupLogo,
  getUserLogo,
  fetchStrangerInfo,
  fetchSetLongNick,
  fetchSyncMessages,
  fetchRemainGroupAtAll,
  getGroupNoticePicUrl,
  fetchAPIVersionInfo,
  fetchGroupRootFiles,
  fetchGroupFolderFiles,
  fetchGroupFileSysInfo,
  fetchGroupFileUrl,
  getGroupFileProxyUrl,
  getPrivateFileProxyUrl,
  fetchAiRecordCharacters,
  fetchSendGroupAiRecord,
  fetchGroupAlbumList,
  fetchGroupAlbumMediaList,
  fetchBackendHealth,
  fetchBackendBots,
  fetchCategorizedContacts,
  fetchTranslateEnglish,
  fetchRecordToText,
  fetchSetFriendRemark,
  fetchKickGroupUser,
  fetchGroupMemberList,
  fetchFriendList,
  fetchUserInfo,
  checkResponseOK,
  fetchSetGroupSign,
  fetchGroupSignedList,
  fetchProfileLikeInfo,
  fetchSendProfileLike,
  fetchCreateGroupFolder,
  fetchDeleteGroupFolder,
  fetchDeleteGroupFile,
  fetchRenameGroupFile,
  fetchRenameGroupFolder,
  getUserAvatarFrame,
  fetchSetGroupMute,
  fetchGroupMutedList,
  fetchSetGroupAdmin,
  fetchSetGroupName,
  fetchSetGroupAllMuted,
  fetchLeaveGroup,
  fetchDeleteFriend,
  fetchSetGroupMemberTitle,
  handleApiRequest,
  fetchContactShareArk,
  fetchCustomFaceCompatibly,
  fetchDeleteCustomFace,
  fetchAddCustomFace,
  fetchModifyCustomFaceDescription,
  fetchMoveCustomFaceToFront,
  buildCustomFaceUrl,
  getCustomFaceId,
  uniqueByCustomFaceId,
  fetchSetGroupTodo,
  fetchCreateFlashTask,
  fetchFlashFileList,
  fetchFlashShareLink,
  fetchDeleteGroupAlbumMedia,
  fetchDeleteGroupNotice,
  fetchSetGroupAddOption,
  fetchSetGroupMemberPermissions,
  fetchSetGroupMemberInvitePolicy,
  fetchSetGroupNewMemberHistoryVisibility,
  fetchSetGroupSearchOption,
  fetchSetGroupRobotAddOption,
  fetchGroupTodoMessage,
  fetchCancelGroupTodo,
  fetchGroupAdminSettings,
  fetchSendGroupNotice,
  fetchCollectionList,
  fetchAddRequests,
  fetchSetFriendAddRequest,
  fetchSetGroupAddRequest,
  fetchGroupAddRequest,
  fetchDoubtFriendAddRequests,
  fetchApproveDoubtFriendRequest,
  fetchIgnoredGroupAddRequests,
}