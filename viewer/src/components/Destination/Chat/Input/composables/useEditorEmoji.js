/**
 * 编辑器表情相关 composable
 * 管理表情插入、表情URL、表情描述等逻辑
 */
import { getPokeDescription, secretEmojiids } from "@/scripts/faces-config.js"
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

  function insertEmojiAtCursor(emoji_id, insertNodeAtCursor) {
    emoji_id = String(emoji_id)
    const img = document.createElement('img')
    img.classList.add('message-input-editor-emoji')
    img.src = getAnimationEmojiUrl(emoji_id)
    img.dataset.emoji = emoji_id
    img.draggable = true
    if (img.src) {
      insertNodeAtCursor(img)
    }
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
      '隐藏表情': [...globalStore?.secretEmojiids]
    }
    const usedId = []
    const specialList = []
    Object.entries(category).forEach(([title, list]) => {
      usedId.push(...list)
      specialList.push({ title, list, big: true })
    })
    return [
      ...specialList,
      { title: 'QQ 黄脸', list: globalStore?.superEmojiids?.filter(id => !usedId.includes(parseInt(id))), big: true },
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
    insertEmojiAtCursor,
    getEmojiGroupList,
  }
}