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

function allIsType(type, ...variables) {
  for (const variable of variables) {
    if (!isType(variable, type)) return false
  }
  return true
}

function isString(...variables) {
  return allIsType('string', ...variables)
}

function isUndefined(variable) {
  return isType(variable, 'undefined')
}

function isArray(variable) {
  return Array.isArray(variable)
}

/**
 * 合并对象，仅将第二个对象 非null、非undefined 的键覆盖到第一个对象
 * @param {Object} target - 目标对象（会被原地修改）
 * @param {Object} source - 源对象
 * @returns {Object} target 原对象
 */
function mergeNotEmpty(target, source) {
  if (!isObject(target) || !isObject(source)) {
    return
  }
  // 遍历源对象所有自身属性
  for (const key in source) {
    // 只处理自身属性，排除原型链
    if (!objectHasKey(source, key)) continue;

    const value = source[key];
    // 判断：不为 undefined、null串
    if (value !== undefined && value !== null) {
      target[key] = value;
    }
  }
  return target;
}

/**
 * 仅判断未定义、空null、NaN
 * @param {*} val
 * @returns {boolean}
 */
function isNil(val) {
  return val === undefined || val === null || isNaN(val);
}

function isPromise(variable) {
  return variable instanceof Promise
}

/**
 * @param {Array} arr 原数组
 * @param {Function} predicate 匹配回调 item=>boolean
 * @param {boolean} mutate 是否修改原数组，false 返回全新数组
 * @returns {Array} 处理后的数组
 */
function moveItemToFront(arr, predicate, mutate = false) {
  const idx = arr.findIndex(predicate)
  if (idx === -1) return mutate ? arr : [...arr]

  if (mutate) {
    const item = arr.splice(idx, 1)[0]
    arr.unshift(item)
    return arr
  } else {
    return [arr[idx], ...arr.filter((_, i) => i !== idx)]
  }
}

/**
 * 删除数组中满足条件的全部项
 * @param {Array} arr 源数组
 * @param {Function} predicate (item)=>boolean 需要删除的判断函数
 * @param {boolean} mutate 是否原地修改原数组，默认false返回新数组
 * @returns {Array} 处理完成后的数组
 */
function removeItems(arr, predicate, mutate = false) {
  if (!mutate) {
    // 返回全新数组，原数组不受影响
    return arr.filter(item => !predicate(item))
  }
  // 原地删除，倒序遍历防止下标错乱
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      arr.splice(i, 1)
    }
  }
  return arr
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
  isArray,
  mergeNotEmpty,
  isNil,
  isPromise,
  moveItemToFront,
  removeItems,
};