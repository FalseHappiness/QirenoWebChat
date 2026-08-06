import { pinyin, convert } from "pinyin-pro";
import { isSupportedNoticeMessage } from "./parse-message.js";
import { isObject } from "./types-util.js";
import { getGroupUserInfoCache } from "@/scripts/user-info-util.js";

// ====================== 公共常量、通用工具函数 ======================
const PINYIN_OPTIONS = { toneType: "none", type: "array" }

/**
 * 文本标准化：去声调、清除所有空格、转小写
 * @param {string} str
 * @returns {string}
 */
const normalizeText = (str) => {
  const noToneStr = convert(str, { format: "toneNone" });
  return noToneStr.replace(/\s+/g, "").toLowerCase();
};

/**
 * 根据汉字生成首字母简拼字符串
 * @param {string} text 中文文本
 * @returns {string} 首字母拼接简拼
 */
const getShortPinyin = (text) => {
  const fullArr = pinyin(text, PINYIN_OPTIONS);
  return fullArr.map(py => py[0]).join("");
};

/**
 * 字段权重枚举，数值越小优先级越高
 * 新增缓存字段优先级：缓存群名片 > 缓存备注 > 缓存昵称 > 原生card > remark > nickname > name
 */
const FIELD_WEIGHT = {
  cacheCard: 1,
  cacheRemark: 2,
  cacheNick: 3,
  card: 4,
  remark: 5,
  nickname: 6,
  name: 7
}

/**
 * 通用搜索过滤函数
 * 支持：前缀匹配置顶 + 多名称字段权重优先级
 * @param {Array} sourceList 数据源
 * @param {string} searchText 检索词
 * @param {Function} getSearchFields 返回 { fieldMap:{字段名:字段值}, id }
 * @returns {Array|undefined}
 */
function commonSearchFilter(sourceList, searchText, getSearchFields) {
  const trimText = searchText.trim();
  if (!trimText) return undefined;
  const searchKey = normalizeText(trimText);
  const rawSearchLower = trimText.toLowerCase();

  // 分多个优先级桶
  // bucket[0] 字段前缀命中（按字段权重排序）
  // bucket[1] 普通原文包含匹配
  // bucket[2] 全拼前缀命中
  // bucket[3] 全拼普通包含
  // bucket[4] 简拼前缀命中
  // bucket[5] 简拼普通包含
  // bucket[6] id/QQ号匹配
  const buckets = [[], [], [], [], [], [], []];

  for (const item of sourceList) {
    const { fieldMap, id } = getSearchFields(item);

    // 按权重顺序遍历名称字段
    const priorityFields = [
      { key: "cacheCard", val: fieldMap.cacheCard },
      { key: "cacheRemark", val: fieldMap.cacheRemark },
      { key: "cacheNick", val: fieldMap.cacheNick },
      { key: "card", val: fieldMap.card },
      { key: "remark", val: fieldMap.remark },
      { key: "nickname", val: fieldMap.nickname },
      { key: "name", val: fieldMap.name }
    ].filter(i => !!i.val);

    let hit = false;

    // 1. 原文前缀匹配 最高优先级 bucket[0]
    for (const field of priorityFields) {
      const lowVal = String(field.val).toLowerCase();
      if (lowVal.startsWith(rawSearchLower)) {
        buckets[0].push({
          item,
          weight: FIELD_WEIGHT[field.key]
        })
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // 2. 原文普通包含 bucket[1]
    for (const field of priorityFields) {
      const lowVal = String(field.val).toLowerCase();
      if (lowVal.includes(rawSearchLower)) {
        buckets[1].push({
          item,
          weight: FIELD_WEIGHT[field.key]
        })
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // 拼接全部文本用来拼音解析
    const allText = priorityFields.map(f => f.val).join(" ");
    const fullPinyin = pinyin(allText, PINYIN_OPTIONS).join("");
    const shortPinyin = getShortPinyin(allText);
    const fullStd = normalizeText(fullPinyin);
    const shortStd = normalizeText(shortPinyin);

    // 3.完整拼音前缀命中
    if (fullStd.startsWith(searchKey)) {
      buckets[2].push({ item, weight: 99 });
      continue;
    }
    //4.完整拼音包含
    if (fullStd.includes(searchKey)) {
      buckets[3].push({ item, weight: 99 });
      continue;
    }
    //5.简拼前缀命中
    if (shortStd.startsWith(searchKey)) {
      buckets[4].push({ item, weight: 99 });
      continue;
    }
    //6.简拼包含
    if (shortStd.includes(searchKey)) {
      buckets[5].push({ item, weight: 99 });
      continue;
    }
    //7.账号id匹配
    if (String(id).includes(trimText)) {
      buckets[6].push({ item, weight: 99 });
    }
  }

  // 每个桶内部按照字段权重从小到大排序，权重越小优先级越高
  buckets.forEach(bucket => {
    bucket.sort((a, b) => a.weight - b.weight)
  })

  // 拼接结果并且剥离包装对象，返回原数据
  return buckets.flat().map(el => el.item);
}

const flattenCategorizedContacts = categorizedContacts => {
  const uniqueContactsMap = new Map();
  for (const category of (categorizedContacts || [])) {
    for (const contact of (category.contacts || [])) {
      if (contact && contact.type && contact.contact_id) {
        const key = `${contact.type}.${contact.contact_id}`;
        if (!uniqueContactsMap.has(key)) {
          uniqueContactsMap.set(key, contact);
        }
      }
    }
  }
  return Array.from(uniqueContactsMap.values());
}

const filterSearchContacts = (searchText, flattenContacts) => {
  return commonSearchFilter(flattenContacts, searchText, (contact) => {
    const { real_name, remark, contact_id, name } = contact;
    return {
      fieldMap: {
        cacheCard: "",
        cacheRemark: "",
        cacheNick: "",
        card: "",
        remark,
        nickname: real_name,
        name
      },
      id: contact_id
    }
  })
};

/**
 * 筛选群可@用户
 * 匹配优先级：cacheCard(缓存群名片) > cacheRemark(缓存备注) > cacheNick(缓存昵称) > card > remark > nickname > name
 * 前缀命中优先置顶，同匹配类型内依照字段优先级排序
 * @param {Array} groupUsers - 原始群成员列表
 * @param {string} atMentionText - 搜索关键词
 * @param {boolean} [can_at_all] - 是否开启@全体成员
 * @returns {Array|null}
 */
function filteredAtGroupUsers(groupUsers, atMentionText, can_at_all = false) {
  if (!Array.isArray(groupUsers)) return null

  // 组装缓存昵称
  let atGroupUsers = groupUsers.map((item) => {
    const cacheInfo = getGroupUserInfoCache(item.group_id, item.user_id);
    const cacheCard = cacheInfo.card;
    const cacheRemark = cacheInfo.remark;
    const cacheNick = cacheInfo.nickname;

    return {
      ...item,
      cacheCard,
      cacheRemark,
      cacheNick,
      name: cacheCard || cacheRemark || cacheNick || item.card || item.remark || item.nickname
    }
  })

  // 添加全体成员选项
  if (can_at_all) {
    atGroupUsers.unshift({
      user_id: 'all',
      name: '全体成员',
      cacheCard: '',
      cacheRemark: '',
      cacheNick: '',
      card: '',
      remark: '',
      nickname: ''
    })
  }

  if (!atMentionText.trim()) return atGroupUsers

  // 传入全部名称字段交由通用搜索处理权重、前缀置顶逻辑
  return commonSearchFilter(atGroupUsers, atMentionText, (user) => ({
    fieldMap: {
      cacheCard: user.cacheCard,
      cacheRemark: user.cacheRemark,
      cacheNick: user.cacheNick,
      card: user.card,
      remark: user.remark,
      nickname: user.nickname,
      name: user.name
    },
    id: user.user_id
  }))
}

const checkSameContact = (contact1, contact2) => {
  if (!contact1 || !contact2) {
    return false
  }
  return contact1.contact_id === contact2.contact_id && contact1.type === contact2.type;
}

const checkMsgIsContact = (event, contact) => {
  if (!contact || !isObject(event)) {
    return false
  }
  const { group_id, target_id, user_id, post_type, message_type, notice_type, sub_type } = event;
  if (['message', 'message_sent'].includes(event.post_type)) {
    const isGroup = message_type === 'group'
    return checkSameContact({
      type: message_type,
      contact_id: isGroup ? group_id : target_id
    }, contact)
  } else if (post_type === 'notice') {
    const isGroup = !!group_id
    if (
      ['group_recall', 'friend_recall'].includes(notice_type) ||
      sub_type === 'input_status' ||
      isSupportedNoticeMessage(event)
    ) {
      return checkSameContact({
        type: isGroup ? 'group' : 'private',
        contact_id: isGroup ? group_id : user_id
      }, contact)
    }
  }
  return false
}

const createGroupContact = contact_id => {
  return {
    type: "group",
    contact_id
  }
}
const createPrivateContact = contact_id => {
  return {
    type: "private",
    contact_id
  }
}
/**
 * 筛选群成员
 * 匹配优先级：缓存群名片 > 缓存备注 > 缓存昵称 > card > remark > nickname
 * 支持前缀匹配置顶、拼音、简拼、ID搜索，结果按匹配优先级排序
 * @param {number} group_id - 群ID
 * @param {Array} groupUsers - 群成员列表
 * @param {string} searchText - 搜索关键词
 * @returns {Array|null} 搜索结果（按匹配度排序），无搜索词返回 null
 */
function filterGroupMembers(group_id, groupUsers, searchText) {
  if (!Array.isArray(groupUsers)) return null
  if (!searchText.trim()) return null

  const searchUsers = groupUsers.map((user) => {
    const cacheInfo = getGroupUserInfoCache(group_id, user.user_id);
    return {
      ...user,
      cacheCard: cacheInfo?.card || '',
      cacheRemark: cacheInfo?.remark || '',
      cacheNick: cacheInfo?.nickname || '',
    }
  })

  return commonSearchFilter(searchUsers, searchText, (user) => ({
    fieldMap: {
      cacheCard: user.cacheCard,
      cacheRemark: user.cacheRemark,
      cacheNick: user.cacheNick,
      card: user.card || '',
      remark: user.remark || '',
      nickname: user.nickname || '',
      name: user.name || ''
    },
    id: user.user_id
  }))
}

export {
  flattenCategorizedContacts,
  filterSearchContacts,
  checkMsgIsContact,
  checkSameContact,
  createGroupContact,
  createPrivateContact,
  filteredAtGroupUsers,
  filterGroupMembers,
}