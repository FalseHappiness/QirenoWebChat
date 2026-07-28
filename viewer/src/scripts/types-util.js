/**
 * 字符串/任意值转为标准布尔
 * "true"/"1"/"yes"/"on" → true
 * "false"/"0"/"no"/"off"/空字符串/null/undefined → false
 */
function strToBool(val) {
  if (val == null) return false;
  const s = String(val).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(s);
}

/**
 * 判断变量基础数据类型是否匹配目标类型
 * @param {*} variable - 需要校验的任意变量
 * @param {'string' | 'number' | 'boolean' | 'object' | 'function' | 'undefined' | 'symbol' | 'bigint'} type - 目标基础类型字符串
 * @returns {boolean} 变量类型与目标类型一致返回true，否则false
 */
const isType = (variable, type) => {
  return typeof variable === type
}

const isObject = (variable) => {
  return isType(variable, 'object') && variable !== null
};

/**
 * 判断是否为纯键值字典（{} 或 Object.create(null)）
 * @param {*} val
 * @returns {boolean}
 */
function isPlainDict(val) {
  if (!isObject(val) || val === null || Array.isArray(val)) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === null || proto === Object.prototype;
}

/**
 * 判断对象自身是否包含指定键
 * @param {*} obj 目标对象 {} / Object.create(null)
 * @param {string | symbol} key 键名
 * @returns {boolean}
 */
function objectHasKey(obj, key) {
  if (!isObject(obj)) return false
  return Object.prototype.hasOwnProperty.call(obj, key)
}

const isEmptyObject = (obj) => {
  return isObject(obj) && Object.keys(obj).length === 0;
}
const isBoolean = variable => {
  return isType(variable, 'boolean')
}
const isFunction = variable => {
  return isType(variable, 'function')
}
const isNumber = variable => {
  return isType(variable, 'number')
}

function isString(variable) {
  return isType(variable, 'string')
}

function isUndefined(variable) {
  return isType(variable, 'undefined')
}

export {
  isNumber,
  isFunction,
  isBoolean,
  isEmptyObject,
  objectHasKey,
  isPlainDict,
  isObject,
  strToBool,
  isString,
  isUndefined,
};