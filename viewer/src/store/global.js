import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { otherFacesDescribes, secretEmojiids } from "../scripts/faces-config.js";
import emojiFiles from '../assets/emoji_files.json';
import emojiFaceConfig from '../QQ/EmojiConfig/face_config.json'
import emojiDefaultConfig from '../QQ/EmojiConfig/default_config.json'

import { isString } from "../scripts/types-util.js";

function getAllEmojiids(list) {
  // 创建一个 Set 来避免重复的 xxx1
  const result = new Set();

  list.forEach(item => {
    const match = item.match(/^\/QQ\/EmojiSystermResource\/([^\/]+)\/([^\/]+)\//);
    if (match) {
      result.add(match[1]);
    }
  });

  // 将 Set 转换为数组并返回
  return Array.from(result);
}

function filterSuperEmojiResources(list) {
  // 创建一个 Set 来避免重复的 xxx1
  const result = new Set();

  list.forEach(item => {
    // 检查是否以指定模式开头
    const match = item.match(/^\/QQ\/EmojiSystermResource\/([^\/]+)\/([^\/]+)\//);

    if (match && match[2].toLowerCase() === 'lottie') {
      result.add(match[1]); // 添加 xxx1 到结果中
    }
  });

  // 将 Set 转换为数组并返回
  return Array.from(result);
}

function getEmojiDescribesFromDefaultConfig(obj) {
  const result = {};

  const processGroup = (group) => {
    group.SysEmojiList.forEach(emoji => {
      let describe = emoji.describe;
      if (describe.startsWith('/')) {
        describe = describe.substring(1);
      }
      result[emoji.emojiId] = describe;
    });
  };

  obj.normalPanelResult.SysEmojiGroupList.forEach(processGroup);
  obj.redHeartPanelResult.SysEmojiGroupList.forEach(processGroup);

  return result;
}

function getEmojiDescribesFromFaceConfig(obj) {
  const result = {};

  const processGroup = (group) => {
    group.forEach(emoji => {
      let describe = emoji.QDes;
      if (describe.startsWith('/')) {
        describe = describe.substring(1);
      }
      result[emoji.QSid] = describe;
    });
  };

  processGroup(obj.sysface)
  processGroup(obj.emoji)

  return result;
}

function getEmojiDescribes(default_config, face_config) {
  return {
    ...getEmojiDescribesFromDefaultConfig(default_config),
    ...getEmojiDescribesFromFaceConfig(face_config),
    ...otherFacesDescribes
  }
}

/**
 * 预遍历全部表情资源，构建「多动画表情 → 变体序号列表」映射
 * 规则：lottie 目录下存在 `{id}_N.json`（N>=1）即视为该表情有多个动画变体
 * 匹配时要求文件名主体与目录 id 一致，以排除 lottie/surprise/100.json 之类的特殊动画
 *
 * @param {string[]} files - emoji_files.json 中的资源路径列表
 * @returns {Object<string, number[]>} 形如 { "114": [1,2,3,4,5], "358": [1,2,3,4,5,6] }
 */
function buildEmojiAnimationVariants(files) {
  const variantNumsMap = new Map()
  // 仅匹配标准 lottie 变体：/QQ/EmojiSystermResource/{dirId}/lottie/{fileId}_{N}.json
  const variantRegex = /^\/QQ\/EmojiSystermResource\/([^/]+)\/lottie\/(\d+)_(\d+)\.json$/

  files.forEach(file => {
    const match = file.match(variantRegex)
    if (!match) return
    const [, dirId, fileId, num] = match
    // 文件名主体必须与目录 id 一致，排除特殊目录动画
    if (fileId !== dirId) return
    if (!variantNumsMap.has(dirId)) variantNumsMap.set(dirId, new Set())
    variantNumsMap.get(dirId).add(Number(num))
  })

  const result = {}
  variantNumsMap.forEach((nums, id) => {
    if (!nums.size) return
    result[id] = Array.from(nums).sort((a, b) => a - b)
  })
  return result
}

/**
 * 将数组中的数字/字符串整数从小到大排序，其他元素按码位排序放到最后
 * @param {Array} arr - 待排序的数组
 * @return {Array} 排序后的数组
 */
function sortNumbersAndOthers(arr) {
  // 分割数组：数字/字符串整数 vs 其他类型
  const numbers = [];
  const others = [];

  arr.forEach(item => {
    // 检查是否是数字或字符串形式的整数
    if (Number.isInteger(item)) {
      numbers.push(item);
    } else if (isString(item) && /^-?\d+$/.test(item)) {
      numbers.push(parseInt(item, 10));
    } else {
      others.push(item);
    }
  });

  // 对数字部分从小到大排序
  numbers.sort((a, b) => a - b);

  // 对其他部分按 Unicode 码位排序
  others.sort((a, b) => {
    const strA = String(a);
    const strB = String(b);
    return strA.localeCompare(strB);
  });

  // 合并结果：数字在前，其他在后
  return [...numbers, ...others];
}


export const useGlobalStore = defineStore(
  'global',
  () => {
    const allEmojiids = sortNumbersAndOthers(
      getAllEmojiids(emojiFiles)
    );

    const superEmojiids = sortNumbersAndOthers(
      filterSuperEmojiResources(emojiFiles)
    );

    const emojiEmojiids = sortNumbersAndOthers(
      allEmojiids.filter(item => isString(item) && !/^\d+$/.test(item) && !superEmojiids.includes(item))
    );

    const normalEmojiids = sortNumbersAndOthers(
      allEmojiids.filter(item => !superEmojiids.includes(item) && !emojiEmojiids.includes(item))
    );

    const emojiDescribes = getEmojiDescribes(
      emojiDefaultConfig,
      emojiFaceConfig
    )

    // 预遍历一次，构建多动画表情 → 变体序号映射（应用启动时完成，运行时 O(1) 查询）
    const emojiAnimationVariants = buildEmojiAnimationVariants(emojiFiles)

    // ============ Lottie 动画数据缓存 ============
    // url -> 已解析的 lottie JSON 对象
    const lottieDataCache = new Map()
    // url -> 正在进行的 Promise（防止并发重复请求）
    const lottiePendingMap = new Map()
    // 已失败的 url，避免反复重试
    const lottieFailedSet = new Set()

    /**
     * 确保指定 lottie 动画已加载到缓存
     * @param {string} url lottie json 地址
     * @returns {Promise<Object|null>} 解析后的 lottie JSON
     */
    function ensureLottieLoaded(url) {
      if (!url) return Promise.resolve(null)
      if (lottieDataCache.has(url)) return Promise.resolve(lottieDataCache.get(url))
      if (lottieFailedSet.has(url)) return Promise.resolve(null)
      if (lottiePendingMap.has(url)) return lottiePendingMap.get(url)

      const promise = fetch(url, { cache: 'force-cache' })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        })
        .then(data => {
          lottieDataCache.set(url, data)
          lottiePendingMap.delete(url)
          return data
        })
        .catch(err => {
          console.warn('[lottie] 加载失败:', url, err)
          lottieFailedSet.add(url)
          lottiePendingMap.delete(url)
          return null
        })

      lottiePendingMap.set(url, promise)
      return promise
    }

    /**
     * 从缓存同步读取 lottie 数据（未缓存则返回 null）
     * @param {string} url
     * @returns {Object|null}
     */
    function getLottieData(url) {
      if (!url) return null
      return lottieDataCache.get(url) || null
    }

    /**
     * 批量预加载 lottie（并发受控，避免瞬时大量请求）
     * @param {string[]} urls
     * @param {number} concurrency 并发数
     * @returns {Promise<void>}
     */
    async function preloadLotties(urls, concurrency = 4) {
      const list = [...new Set((urls || []).filter(Boolean))]
        .filter(u => !lottieDataCache.has(u) && !lottieFailedSet.has(u))
      if (!list.length) return

      let cursor = 0
      const worker = async () => {
        while (cursor < list.length) {
          const url = list[cursor++]
          await ensureLottieLoaded(url)
        }
      }
      const workers = Array.from(
        { length: Math.min(concurrency, list.length) },
        () => worker()
      )
      await Promise.all(workers)
    }

    const responseCacheMap = reactive(new Map());

    const theme = ref('default')

    const messageSettings = reactive({
      fetchEmojiLikes: true,
      showEmojiLikeNotice: false,
    })

    return {
      normalEmojiids,
      superEmojiids,
      emojiEmojiids,
      secretEmojiids,
      emojiFiles,
      emojiDescribes,
      emojiAnimationVariants,
      allEmojiids,
      responseCacheMap,
      // Lottie 缓存与预加载
      lottieDataCache,
      ensureLottieLoaded,
      getLottieData,
      preloadLotties,
      apiVersionInfo: {
        app_name: "NapCat.Onebot",
        app_version: "0.0.0"
      },
      theme,
      messageSettings,
    };
  },
  // 持久化配置
  {
    persist: {
      key: 'store-global', // 本地存储键名
      storage: localStorage,
      pick: ['theme', 'messageSettings'],
    }
  }
);