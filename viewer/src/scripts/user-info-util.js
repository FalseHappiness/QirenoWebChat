import { showToast } from "./toast.js";
import {
  fetchGroupInfo,
  fetchGroupMemberInfo,
  fetchStrangerInfo, getUserAvatarFrame,
} from "./backend-api.js";
import { isArray, isFunction, isNil, isObject, mergeNotEmpty } from "./types-util.js";
import { parseJSON } from "./util.js";
import { useGlobalStore } from "../store/global.js";

class ResponseCache {
  /**
   * 构造缓存实例
   * @param {number} defaultExpireMs - 默认过期毫秒，默认1小时
   */
  constructor(defaultExpireMs = 3600 * 1000) {
    this.defaultExpireMs = defaultExpireMs;
  }

  // 私有方法，每次操作前动态获取store
  #getCacheMap() {
    return useGlobalStore().responseCacheMap;
  }

  /**
   * 设置缓存
   * @param {string} key 缓存键
   * @param {*} value 缓存值（接口Response数据）
   * @param {number} [expireMs] 自定义过期时间，不传使用默认1小时
   */
  set(key, value, expireMs) {
    if (!value) return null
    const cache = this.#getCacheMap();
    const expire = Date.now() + (expireMs ?? this.defaultExpireMs);
    cache.set(key, { value, expire });
    return value
  }

  /**
   * 获取缓存，过期自动删除返回null
   * @param {string} key 缓存键
   * @returns {*|null} 缓存数据，过期/不存在返回null
   */
  get(key) {
    const cache = this.#getCacheMap();
    const item = cache.get(key);
    if (!item) return null;

    // 判断是否过期
    if (Date.now() > item.expire) {
      cache.delete(key);
      return null;
    }
    return item.value;
  }

  /**
   * 删除指定key缓存
   * @param {string} key
   */
  delete(key) {
    const cache = this.#getCacheMap();
    cache.delete(key);
  }

  /**
   * 清空全部缓存
   */
  clear() {
    const cache = this.#getCacheMap();
    cache.clear();
  }

  /**
   * 主动清理所有已过期缓存（定时调用可优化内存）
   */
  cleanExpired() {
    const cache = this.#getCacheMap();
    const now = Date.now();
    for (const [key, item] of cache) {
      if (now > item.expire) {
        cache.delete(key);
      }
    }
  }

  /**
   * 判断key是否存在且未过期
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }
}

const cache = new ResponseCache();

const CacheKey = {
  FRIEND_LIST: 'friend_list',
  GROUP_LIST: 'group_list',
  GROUP_INFO: 'group_info',
  GROUP_MEMBER_INFO: 'group_member_info',
  GROUP_MEMBER_LIST: 'group_member_list',
  STRANGER_INFO: 'stranger_info',
  USER_PERSONALIZATION: "user_personalization"
}

function combineKey(cacheKey, arg) {
  if (!arg) {
    return cacheKey
  }
  return `${cacheKey}-${JSON.stringify(Object.fromEntries(Object.entries(arg).sort()))}`
}

const setCache = (key, value, arg) => {
  return cache.set(combineKey(key, arg), value)
}

const setFriendListCache = value => {
  return setCache(CacheKey.FRIEND_LIST, value)
}

const setGroupListCache = value => {
  return setCache(CacheKey.GROUP_LIST, value)
}

const setGroupInfoCache = (group_id, value) => {
  mergeNotEmpty(
    getGroupInfoCacheByList(group_id),
    value
  )
  return setCache(CacheKey.GROUP_INFO, value, { group_id })
}

const setGroupMemberInfoCache = (group_id, user_id, value) => {
  mergeNotEmpty(
    getGroupMemberInfoCacheByList(group_id, user_id),
    value
  )
  return setCache(CacheKey.GROUP_MEMBER_INFO, value, { group_id, user_id })
}

const setGroupMemberListCache = (group_id, value) => {
  return setCache(CacheKey.GROUP_MEMBER_LIST, value, { group_id })
}

const setStrangerInfoCache = (user_id, value) => {
  mergeNotEmpty(
    getFriendInfoCache(user_id),
    value
  )
  mergeNotEmpty(
    getFriendInfoCacheByList(user_id),
    value
  )
  return setCache(CacheKey.STRANGER_INFO, value, { user_id })
}

const setUserPersonalization = (user_id, value) => {
  return setCache(CacheKey.USER_PERSONALIZATION, value, { user_id })
}

const getCache = (key, arg) => {
  return cache.get(combineKey(key, arg))
}

const getFriendListCache = () => {
  return getCache(CacheKey.FRIEND_LIST)
}

const getFriendInfoCache = user_id => {
  return getFriendListCache()?.find?.(user => user.user_id === user_id)
}

const getFriendInfoCacheByList = user_id => {
  return getFriendListCache()?.find?.(user => user.user_id === user_id)
}

const getGroupListCache = group_id => {
  return getCache(CacheKey.GROUP_LIST, { group_id })
}

const getGroupInfoCache = group_id => {
  return getCache(CacheKey.GROUP_INFO, { group_id })
}

const getGroupInfoCacheByList = group_id => {
  return getGroupListCache()?.find?.(group => group.group_id === group_id)
}

const getGroupMemberInfoCache = (group_id, user_id) => {
  return getCache(CacheKey.GROUP_MEMBER_INFO, { group_id, user_id })
}

const getGroupMemberListCache = group_id => {
  return getCache(CacheKey.GROUP_MEMBER_LIST, { group_id })
}

const getGroupMemberInfoCacheByList = (group_id, user_id) => {
  return getGroupMemberListCache(group_id)?.find?.(user => user.user_id === user_id)
}

const getStrangerInfoCache = user_id => {
  return getCache(CacheKey.STRANGER_INFO, { user_id })
}

const getUserPersonalization = user_id => {
  return getCache(CacheKey.USER_PERSONALIZATION, { user_id })
}

const getUserAvatarFrameCache = (user_id, returnUrl = true) => {
  return getUserAvatarFrame(getUserPersonalization(user_id), returnUrl)
}

const GROUP = "group"
const GROUP_NAME = "group_name"
const GROUP_USER = "group_user"
const GROUP_USER_NICKNAME = "group_user_nickname"
const GROUP_USER_REMARK = "group_user_remark"
const PRIVATE = "private"
const NICKNAME = "nickname"

/**
 * 缓存名称类型枚举映射
 * 统一管理各类展示名称缓存key，别名映射同一底层标识
 * @typedef {Object} CacheNameKey
 * @property {string} GROUP - 群备注
 * @property {string} GROUP_REMARK - 群备注别名，等价GROUP
 * @property {string} GROUP_NAME - 群名称
 * @property {string} GROUP_USER - 群成员名片
 * @property {string} GROUP_USER_REMARK - 群成员备注
 * @property {string} GROUP_USER_NICKNAME - 群成员昵称
 * @property {string} GROUP_USER_CARD - 群成员群名片别名，等价GROUP_USER
 * @property {string} PRIVATE - 私聊好友备注（同PRIVATE）
 * @property {string} USER_REMARK - 私聊好友备注别名，等价PRIVATE
 * @property {string} NICKNAME - 用户基础昵称（同NICKNAME）
 * @property {string} USER_NICKNAME - 用户昵称别名，等价NICKNAME
 */
/** @type {CacheNameKey} */
const CacheNameKey = {
  GROUP,
  GROUP_REMARK: GROUP,
  GROUP_NAME,
  GROUP_USER,
  GROUP_USER_REMARK,
  GROUP_USER_NICKNAME,
  GROUP_USER_CARD: GROUP_USER,
  PRIVATE,
  USER_REMARK: PRIVATE,
  NICKNAME,
  USER_NICKNAME: NICKNAME,
}

/**
 * ID参数：单个数字/字符串ID 或 [群ID, 用户ID] 二元数组
 * @typedef {string | number | (string | number)[]} IdParam
 */

/**
 * 缓存类型标识，取值统一来自 CacheNameKey
 * @typedef {keyof typeof CacheNameKey | string} CacheTypeKey
 */

/**
 * parseCacheArg 返回解析结果结构
 * @typedef {Object} CacheArgParseResult
 * @property {boolean} isGroup - 是否读取群备注
 * @property {boolean} isGroupRemark - 是否读取群备注（同isGroup）
 * @property {boolean} isGroupName - 是否读取群名称
 * @property {boolean} isGroupInfo - 是否群相关缓存类型（GROUP / GROUP_NAME）
 * @property {boolean} isGroupUser - 是否读取群成员群名片
 * @property {boolean} isGroupUserRemark - 是否读取群成员备注
 * @property {boolean} isGroupUserNickname - 是否读取群成员昵称
 * @property {boolean} isGroupUserCard - 是否读取群成员群名片（同isGroupUser）
 * @property {boolean} isGroupUserInfo - 是否群成员相关缓存类型
 * @property {boolean} isPrivate - 是否读取私聊好友备注
 * @property {boolean} isUserRemark - 是否读取私聊好友备注（同isPrivate）
 * @property {boolean} isNickname - 是否读取通用昵称
 * @property {boolean} isUserNickname - 是否读取通用昵称（同isNickname）
 * @property {boolean} isPrivateInfo - 是否私聊/用户昵称相关缓存类型
 * @property {boolean} isValid - 当前传入type是否为合法缓存类型
 * @property {[string|number|undefined, string|number|undefined]} idList - 解析后的 ID 列表, [群ID, 用户ID]
 * @property {string|number|undefined} group_id - 解析后的群ID
 * @property {string|number|undefined} user_id - 解析后的用户ID
 */
/**
 * 解析缓存查询参数，区分群/用户类型，自动格式化ID数组
 * @param {IdParam} idList
 * @param {CacheTypeKey} type
 * @param {boolean} [throwInvalid=true] - 非法类型时是否抛出错误
 * @returns {CacheArgParseResult} 类型判定与拆分后的ID对象
 * @throws {Error} 传入非法缓存类型且throwInvalid为true时抛出
 */
const parseCacheArg = (idList, type, throwInvalid = true) => {
  const is = key => type === key
  const isGroup = is(GROUP)
  const isGroupName = is(GROUP_NAME)
  const isGroupInfo = isGroup || isGroupName
  const isGroupUser = is(GROUP_USER)
  const isGroupUserNickname = is(GROUP_USER_NICKNAME)
  const isGroupUserRemark = is(GROUP_USER_REMARK)
  const isGroupUserInfo = isGroupUser || isGroupUserRemark || isGroupUserNickname
  const isPrivate = is(PRIVATE)
  const isNickname = is(NICKNAME)
  const isPrivateInfo = isPrivate || isNickname
  const isValid = isGroupInfo || isPrivateInfo || isGroupUserInfo
  if (throwInvalid && !isValid) {
    throw new Error(`Invalid cache name type: ${type}`)
  }
  if (!isArray(idList)) {
    idList = isGroupInfo ? [idList, undefined] : [undefined, idList]
  }
  const [group_id, user_id] = idList
  return {
    isGroup,
    isGroupRemark: isGroup,
    isGroupName,
    isGroupInfo,
    isGroupUser,
    isGroupUserRemark,
    isGroupUserNickname,
    isGroupUserCard: isGroupUser,
    isGroupUserInfo,
    isPrivate,
    isUserRemark: isPrivate,
    isNickname,
    isUserNickname: isNickname,
    isPrivateInfo,
    isValid,
    idList,
    group_id,
    user_id
  }
}

/**
 * 从本地缓存读取对应类型展示名称
 * @param {IdParam} idList
 * @param {CacheTypeKey} type
 * @returns {string|null} 拼接后的展示名称，无数据返回null
 */
const getCacheName = function (idList, type) {
  const {
    isGroup,
    isGroupInfo,
    isGroupUserRemark,
    isGroupUserNickname,
    isGroupUserCard,
    isGroupUserInfo,
    isPrivate,
    isNickname,
    isPrivateInfo,
    group_id,
    user_id
  } = parseCacheArg(idList, type)
  if (isGroupInfo) {
    let groupInfo = getGroupInfoCacheByList(group_id)
    if (!groupInfo) {
      groupInfo = getGroupInfoCache(group_id)
    }
    if (isObject(groupInfo)) {
      if (isGroup) {
        return groupInfo.group_remark || groupInfo.group_name;
      } else {
        return groupInfo.group_name;
      }
    }
  } else {
    let userInfo = getFriendInfoCacheByList(user_id);
    if (!userInfo) {
      userInfo = getFriendInfoCache(user_id);
    }
    if (!userInfo) {
      userInfo = getStrangerInfoCache(user_id)
    }
    if (isPrivateInfo) {
      if (isObject(userInfo)) {
        if (isPrivate) {
          return userInfo.remark || userInfo.nickname;
        } else if (isNickname) {
          return userInfo.nickname;
        }
      }
    } else if (isGroupUserInfo) {
      let groupUserInfo = getGroupMemberInfoCacheByList(group_id, user_id);
      if (!groupUserInfo) {
        groupUserInfo = getGroupMemberInfoCache(group_id, user_id)
      }
      const card = groupUserInfo?.card
      const remark = groupUserInfo?.remark || userInfo?.remark
      const nickname = groupUserInfo?.nickname || userInfo?.nickname;
      if (isGroupUserNickname) {
        return nickname
      } else if (isGroupUserRemark) {
        return remark || nickname
      } else if (isGroupUserCard) {
        return card || remark || nickname
      }
    }
  }
  return null
};

/**
 * 更新本地缓存内存储的备注/名称字段
 * @param {IdParam} idList
 * @param {CacheTypeKey} type
 * @param {string} name - 需要写入的新名称/备注
 * @returns {void}
 */
function setCacheName(idList, type, name) {
  const {
    isGroupRemark,
    isGroupName,
    isGroupInfo,
    isGroupUserInfo,
    isGroupUserRemark,
    isGroupUserNickname,
    isGroupUserCard,
    isUserRemark,
    isUserNickname,
    isPrivateInfo,
    group_id,
    user_id,
  } = parseCacheArg(idList, type)
  if (!name) {
    return
  }
  if (isGroupInfo) {
    const update = group => {
      if (isObject(group)) {
        if (isGroupRemark) {
          group.group_remark = name
        } else if (isGroupName) {
          group.group_name = name
        }
      }
    }
    update(
      getGroupInfoCache(group_id)
    )
    update(
      getGroupInfoCacheByList(group_id)
    )
  } else if (isGroupUserInfo) {
    const update = user => {
      if (isObject(user)) {
        if (isGroupUserRemark) {
          user.remark = name
        } else if (isGroupUserNickname) {
          user.nickname = name
        } else if (isGroupUserCard) {
          user.card = name
        }
      }
    }
    update(
      getGroupMemberInfoCacheByList(group_id, user_id)
    )
    update(
      getGroupMemberInfoCache(group_id, user_id)
    )
  } else if (isPrivateInfo) {
    const update = user => {
      if (isObject(user)) {
        if (isUserRemark) {
          user.remark = name
        } else if (isUserNickname) {
          user.nickname = name
        }
      }
    }
    update(
      getFriendInfoCache(user_id)
    )
    update(
      getFriendInfoCacheByList(user_id)
    )
    update(
      getStrangerInfoCache(user_id)
    )
  }
}

/**
 * 远程拉取最新数据并更新本地缓存
 * @param {IdParam} idList
 * @param {CacheTypeKey} type
 * @returns {Promise<void>}
 */
async function updateCacheName(idList, type) {
  const {
    isGroupInfo,
    isGroupUserInfo,
    isPrivateInfo,
    group_id,
    user_id,
  } = parseCacheArg(idList, type)
  if (isGroupInfo) {
    await fetchGroupInfo(group_id)
  } else if (isGroupUserInfo || isPrivateInfo) {
    await Promise.all([
      fetchStrangerInfo(user_id),
      isGroupUserInfo ? fetchGroupMemberInfo(group_id, user_id) : undefined
    ])
  }
}

/**
 * fetchDisplayName 返回结果结构
 * @typedef {Object} DisplayNameResult
 * @property {string} name - 最终展示名称
 * @property {boolean} error - 是否拉取失败
 */

/**
 * 异步获取展示名称，自动远程刷新缓存，支持回调通知
 * @param {IdParam} id
 * @param {CacheTypeKey} type
 * @param {Function} [nameChangedCallback] - 名称更新完成回调函数
 * @param {boolean} [force=false] - 是否强制远程刷新，无视本地缓存
 * @returns {Promise<DisplayNameResult>}
 */
const fetchDisplayName = async (
  id,
  type,
  nameChangedCallback,
  force = false
) => {
  const result = {
    name: "",
    error: false
  }
  const { idList, group_id, user_id } = parseCacheArg(id, type)
  const changeName = () => {
    const name = getCacheName(idList, type)
    if (name) {
      result.name = name;
      if (isFunction(nameChangedCallback)) {
        nameChangedCallback(name)
      }
    }
    return name;
  }
  try {
    const name = changeName()
    if (force || !name) {
      await updateCacheName(idList, type)
    }
    changeName()
  } catch (error) {
    console.error('获取名称失败:', id, type, error)
    let idText = ''
    if (group_id) {
      idText += '群: ' + group_id
    }
    if (user_id) {
      if (idText) {
        idText += '; '
      }
      idText += '用户: ' + user_id
    }
    showToast('error', `获取名称失败: ${idText}; 类型: ${type}`)
    result.error = true
  }
  return result;
}

const getContactNameRef = async (contact, nameRef, errorRef, loadingRef) => {
  if (!isObject(contact)) {
    return
  }
  const updateRef = (ref, value, noNull = true) => {
    if (isObject(ref) && (!noNull || !isNil(value))) {
      ref.value = value
    }
  }
  try {
    if ([
      2747277822 // QQ 游戏中心
    ].includes(contact.contact_id)) {
      updateRef(nameRef, "QQ 游戏中心")
      updateRef(loadingRef, false)
      updateRef(errorRef, null)
      return
    }
    updateRef(loadingRef, true)
    const event = parseJSON(contact.latest_msg);
    let id = contact.contact_id;
    let type = contact.type;
    if (isObject(event)) {
      if (type === 'private' && event.group_id && event.sub_type === 'group') { // 临时会话
        id = [event.group_id, id]
        type = CacheNameKey.GROUP_USER
      }
    }
    const result = await fetchDisplayName(
      id,
      type,
      name => updateRef(nameRef, name)
    );
    updateRef(nameRef, result.name)
    updateRef(errorRef, result.error)
  } catch (error) {
    console.error('Failed to get contact name:', error);
    updateRef(errorRef, error)
  } finally {
    updateRef(loadingRef, false)
  }
}

const getCacheGroupUserName = (group_id, user_id) => {
  return getCacheName([group_id, user_id], CacheNameKey.GROUP_USER)
}

const isGroupAdmin = user => {
  return user?.role === 'admin' || user === 'admin'
}
const isGroupOwner = user => {
  return user?.role === 'owner' || user === 'owner'
}
const isGroupOperator = user => {
  return isGroupAdmin(user) || isGroupOwner(user)
}

const hasGroupMemberOperatePermission = (self, user) => {
  return isGroupAdmin(self) || (isGroupAdmin(self) && !isGroupOperator(user))
}

export {
  fetchDisplayName,
  getCacheName,
  setFriendListCache,
  setGroupListCache,
  setGroupInfoCache,
  setGroupMemberInfoCache,
  setGroupMemberListCache,
  setStrangerInfoCache,
  setUserPersonalization,
  setCacheName,
  getUserAvatarFrameCache,
  CacheNameKey,
  getContactNameRef,
  getCacheGroupUserName,
  isGroupAdmin,
  isGroupOwner,
  isGroupOperator,
  hasGroupMemberOperatePermission,
};