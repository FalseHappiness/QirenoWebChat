import { pinyin, convert } from "pinyin-pro";

export const flattenCategorizedContacts = categorizedContacts => {
  // 使用 Map 来存储唯一联系人，键为 type + id 的组合
  const uniqueContactsMap = new Map();

  // 扁平化并去重
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

  // 返回去重后的联系人数组
  return Array.from(uniqueContactsMap.values());
}


/**
 * 文本标准化：去声调、清除所有空格、转小写
 * @param {string} str
 * @returns {string}
 */
const normalizeText = (str) => {
  const noToneStr = convert(str, { format: "toneNone" });
  return noToneStr.replace(/\s+/g, "").toLowerCase();
};

const PINYIN_OPTIONS = { toneType: "none", type: "array" }

/**
 * 根据汉字生成首字母简拼字符串
 * @param {string} text 中文文本
 * @returns {string} 首字母拼接简拼
 */
const getShortPinyin = (text) => {
  // 获取无声调完整拼音数组
  const fullArr = pinyin(text, PINYIN_OPTIONS);
  // 截取每个拼音首字母拼接
  return fullArr.map(py => py[0]).join("");
};

export const filterSearchContacts = (searchText, flattenContacts) => {
  const trimText = searchText.trim();
  if (!trimText) return undefined;

  const searchKey = normalizeText(trimText);

  // 四组结果，严格区分优先级
  const directMatches = [];
  const pinyinMatches = [];
  const shortMatches = [];
  const idMatches = [];

  for (const contact of flattenContacts) {
    let { real_name, remark, contact_id } = contact;
    const rawSearchLower = trimText.toLowerCase();

    real_name = real_name || ''
    remark = remark || contact.name || ''

    // 1. 汉字/备注原文直接匹配（最高优先级）
    if (
      real_name.toLowerCase().includes(rawSearchLower) ||
      remark.toLowerCase().includes(rawSearchLower)
    ) {
      directMatches.push(contact);
      continue;
    }

    // 生成完整拼音字符串
    const nameFull = pinyin(real_name, PINYIN_OPTIONS).join("");
    const remarkFull = pinyin(remark, PINYIN_OPTIONS).join("");
    // 生成首字母简拼字符串
    const nameShort = getShortPinyin(real_name);
    const remarkShort = getShortPinyin(remark);

    // 标准化
    const nameFullStd = normalizeText(nameFull);
    const remarkFullStd = normalizeText(remarkFull);
    const hitFull = nameFullStd.includes(searchKey) || remarkFullStd.includes(searchKey);

    const nameShortStd = normalizeText(nameShort);
    const remarkShortStd = normalizeText(remarkShort);
    const hitShort = nameShortStd.includes(searchKey) || remarkShortStd.includes(searchKey);

    // 2. 完整拼音匹配
    if (hitFull) {
      pinyinMatches.push(contact);
      continue;
    }
    // 3. 首字母简拼匹配，独立分组排在全拼后
    if (hitShort) {
      shortMatches.push(contact);
      continue;
    }
    // 4. QQ号数字匹配最低优先级
    if (String(contact_id).includes(trimText)) {
      idMatches.push(contact);
    }
  }

  // 按优先级拼接返回
  return [...directMatches, ...pinyinMatches, ...shortMatches, ...idMatches];
};