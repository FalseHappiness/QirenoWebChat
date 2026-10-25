/**
 * 编辑器表情相关 composable
 * 管理表情插入、表情URL、表情描述等逻辑
 */
import { getPokeDescription } from "@/scripts/faces-config.js"
import { qqAppPoke, qqSystemEmoji } from "@/composables/useBase.js"

export function useEditorEmoji(globalStore) {
  function isPokeEmoji(emoji_id) {
    return !!getPokeEmojiNum(emoji_id)
  }

  function getPokeEmojiPath(emoji_id, dynamic = false) {
    const pokeId = getPokeEmojiNum(emoji_id)
    if (pokeId) {
      return qqAppPoke(pokeId, pokeId + (dynamic ? '_loop.webp' : '.png'))
    }
    return null
  }

  function getPokeEmojiNum(emoji_id) {
    const pokeMatch = String(emoji_id).match(/^poke_([1-6])$/)
    return pokeMatch ? Number(pokeMatch[1]) : null
  }

  function getPngEmojiUrl(emoji_id, forceStatic = false) {
    if (isPokeEmoji(emoji_id)) {
      return getPokeEmojiPath(emoji_id)
    }
    let add = ''
    if (forceStatic && isDynamicDefaultPngEmoji(emoji_id)) {
      add = '_0'
    }
    return qqSystemEmoji(emoji_id, 'png', `${emoji_id}${add}.png`)
  }

  function isDynamicDefaultPngEmoji(emoji_id) {
    // 466, 468, 469 即使加了 _0 也是动态的
    return [367, 466, 468, 469].includes(Number(emoji_id))
  }

  function getApngEmojiUrl(emoji_id) {
    if (isPokeEmoji(emoji_id)) {
      return getPokeEmojiPath(emoji_id, true)
    }
    const url = qqSystemEmoji(emoji_id, 'apng', `${emoji_id}.png`)
    return globalStore?.emojiFiles?.includes(url) ? url : null
  }

  function getAnimationEmojiUrl(emoji_id) {
    const animation_src = getApngEmojiUrl(emoji_id)
    return animation_src ? animation_src : getPngEmojiUrl(emoji_id)
  }

  function getEmojiDescription(emoji_id) {
    const pokeId = getPokeEmojiNum(emoji_id)
    if (pokeId) {
      return getPokeDescription(pokeId)
    } else {
      return globalStore?.emojiDescribes?.[emoji_id]
    }
  }

  // 渲染用的变体视图缓存（以全局预构建映射为数据源，O(1) 查询）
  const variantsViewCache = new Map()

  /**
   * 获取表情的多动画变体列表
   * 数据源为全局 store 中启动时预遍历构建好的 emojiAnimationVariants 映射，
   * 运行时无需再遍历 emojiFiles
   *
   * @param {string|number} emoji_id
   * @returns {Array<{resultId: number, label: string, url: string}>|null} 非多动画返回 null
   */
  function getEmojiAnimationVariants(emoji_id) {
    emoji_id = String(emoji_id)
    if (variantsViewCache.has(emoji_id)) {
      return variantsViewCache.get(emoji_id)
    }

    const variantNums = globalStore?.emojiAnimationVariants?.[emoji_id]
    if (!variantNums?.length) {
      variantsViewCache.set(emoji_id, null)
      return null
    }

    const variants = [{ resultId: 0, label: '默认', url: getEmojiLottieUrl(emoji_id, 0) }]
    variantNums.forEach(num => {
      variants.push({ resultId: num, label: `动画${num}`, url: getEmojiLottieUrl(emoji_id, num) })
    })
    variantsViewCache.set(emoji_id, variants)
    return variants
  }

  /**
   * 获取指定 resultId 的 lottie URL
   * @param {string|number} emoji_id
   * @param {number} resultId 0=默认（无后缀），N=动画N（_N 后缀）
   * @returns {string|null}
   */
  function getEmojiLottieUrl(emoji_id, resultId) {
    emoji_id = String(emoji_id)
    resultId = Number(resultId)
    const suffix = resultId === 0 ? '' : `_${resultId}`
    const path = qqSystemEmoji(
      encodeURIComponent(emoji_id),
      'lottie',
      `${encodeURIComponent(emoji_id)}${suffix}.json`
    )
    return (globalStore?.emojiFiles || []).includes(path) ? path : null
  }

  function insertEmojiAtCursor(emoji_id, insertNodeAtCursor, resultId) {
    emoji_id = String(emoji_id)
    // resultId 为 undefined/null 表示从面板直接点击，不指定动画变体
    const hasResultId = resultId !== undefined && resultId !== null
    const img = document.createElement('img')
    img.classList.add('message-input-editor-emoji')
    // 编辑器内始终用 apng/png 作为可视化预览（lottie 是 JSON，不能作为 img.src）
    img.src = getAnimationEmojiUrl(emoji_id)
    img.dataset.emoji = emoji_id
    if (hasResultId) {
      img.dataset.resultId = String(Number(resultId))
    }
    img.draggable = true
    if (img.src) {
      insertNodeAtCursor(img)
    }
  }

  /**
   * 预加载表情面板中所有多动画表情的 lottie 数据（含默认与各变体）
   * 仅针对存在变体的表情，避免无谓请求
   * @returns {Promise<void>}
   */
  async function preloadEmojiLotties() {
    const variantsMap = globalStore?.emojiAnimationVariants || {}
    const urls = []
    Object.entries(variantsMap).forEach(([emojiId, nums]) => {
      // 默认动画
      const baseUrl = getEmojiLottieUrl(emojiId, 0)
      if (baseUrl) urls.push(baseUrl)
      // 各变体
      ;(nums || []).forEach(num => {
        const url = getEmojiLottieUrl(emojiId, num)
        if (url) urls.push(url)
      })
    })
    if (!urls.length) return
    await globalStore?.preloadLotties?.(urls, 4)
  }

  /**
   * 获取表情分组列表
   * @param {boolean} isPrivate - 是否为私聊
   * @returns {Array}
   */
  function getEmojiGroupList(isPrivate) {
    const category = {
      '互动表情': [
        114, 358, 359,
        ...(isPrivate ? Array.from({ length: 6 }, (_, i) => `poke_${i + 1}`) : [])// 窗口抖动
      ],
      '汪汪': [360, 361, 362, 363, 364, 365, 366, 367, 396, 397],
      '喜花妮': [404, 405, 406, 407, 408, 409, 410, 411, 412, 413],
      '企鹅': [376, 377, 378, 379, 380, 381, 382, 383, 400, 401],
      '噗噗星人': [368, 369, 370, 371, 372, 373, 374, 375, 398, 399],
      '隐藏表情': [...globalStore?.secretEmojiids],
      // 2026 限时表情
      "开学季限时表情8.27-9.14": [481, 485, 488, 489, 490, 491, 492, 493],
      "中秋限时表情9.20-10.8": [500, 494, 495, 496, 497, 498, 499],
      "三角洲限时表情9.20-10.8": [506, 505, 504, 507],
      "王者限时表情10.20-11.2": [512, 508, 509, 510, 524]
    }
    const usedId = []
    const specialList = []
    Object.entries(category).forEach(([title, list]) => {
      usedId.push(...list)
      specialList.push({ title, list, big: true })
    })
    return [
      ...specialList,
      { title: '超级表情', list: globalStore?.superEmojiids?.filter(id => !usedId.includes(parseInt(id))), big: true },
      { title: '小黄脸表情', list: globalStore?.normalEmojiids },
      { title: 'emoji 表情', list: globalStore?.emojiEmojiids }
    ]
  }

  return {
    isPokeEmoji,
    getPokeEmojiNum,
    getPngEmojiUrl,
    getApngEmojiUrl,
    getAnimationEmojiUrl,
    getEmojiDescription,
    getEmojiAnimationVariants,
    getEmojiLottieUrl,
    preloadEmojiLotties,
    insertEmojiAtCursor,
    getEmojiGroupList,
  }
}