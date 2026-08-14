import { h } from "vue";
import {
  fetchMsg,
  getFileDataUrl, getGroupFileProxyUrl,
  getMultimediaProxyUrl, getPrivateFileProxyUrl,
  getStreamFileDataUrl, isSnowLuma
} from "./backend-api.js";
import { useGlobalStore } from "../store/global.js";
import TroopShareCard from "../components/Destination/Chat/Message/Types/JSON/TroopShareCard.vue";
import MiniAPP01 from "../components/Destination/Chat/Message/Types/JSON/MiniAPP01.vue";
import MarkdownMessage from "../components/Destination/Chat/Message/Types/MarkdownMessage.vue";
import AudioMessage from "../components/Destination/Chat/Message/Types/AudioMessage.vue";
import FileMessage from "../components/Destination/Chat/Message/Types/FileMessage.vue";
import { getFileIcon } from "../components/Destination/Chat/Message/Types/FileMessage.vue";
import Mannounce from "../components/Destination/Chat/Message/Types/JSON/Mannounce.vue";
import ReplyMessage from "../components/Destination/Chat/Message/Types/ReplyMessage.vue";
import ViewNews from "../components/Destination/Chat/Message/Types/JSON/ViewNews.vue";
import ForwardMessage from "../components/Destination/Chat/Message/Types/Forward/ForwardMessage.vue";
import ShakePokeMessage from "../components/Destination/Chat/Message/Types/ShakePokeMessage.vue";
import LoadingImage from "../components/Common/Media/LoadingImage.vue";
import MultiMsg from "../components/Destination/Chat/Message/Types/JSON/MultiMsg.vue";
import FeedLua from "../components/Destination/Chat/Message/Types/JSON/FeedLua.vue";
import ContactLua from "../components/Destination/Chat/Message/Types/JSON/ContactLua.vue";
import LottieDot from "../components/Common/Media/LottieDot.vue";
import { formatTimeOptions, parseJSON } from "./util.js";
import UnparsedJSON from "../components/Destination/Chat/Message/Types/JSON/UnparsedJSON.vue";
import ActivityMD from "../components/Destination/Chat/Message/Types/JSON/ActivityMD.vue";
import UnparsedMessage from "../components/Destination/Chat/Message/Types/UnparsedMessage.vue";
import { getPokeDescription } from "./faces-config.js";
import { qqFileIcon, qqSystemEmoji } from "../composables/useBase.js";
import { isArray, objectHasKey } from "./types-util.js";
import { CacheNameKey, fetchDisplayName, getCacheName } from "./user-info-util.js";
import ViewInvite from "@/components/Destination/Chat/Message/Types/JSON/ViewInvite.vue";
import ViewLocationShare from "@/components/Destination/Chat/Message/Types/JSON/ViewLocationShare.vue";
import FlashTransferMessage from "@/components/Destination/Chat/Message/Types/FlashTransferMessage.vue";

const formatTime = (message) => {
  if (!message?.time) return

  return formatTimeOptions({
    timestamp: message.time
  })
}

function convertMessageTextHTMLSyntax(text, emoji = false) {
  if (!text) return [];

  // 统一所有换行格式为 \n，避免 \r\n 产生双重 br
  const normalized = text.replace(/\r\n|\r/g, '\n');

  return normalized.split(/([\n ])/).map((part) => {
    if (part === '\n') return h('br');
    if (part === ' ') return h('span', { innerHTML: '&nbsp;' });
    return emoji ? convertEmojiToImages(part) : part;
  });
}

function convertEmojiToImages(text, emojiids) {
  if (emojiids === undefined) {
    emojiids = useGlobalStore().emojiEmojiids
  }
  const regex = new RegExp(`(${emojiids.join('|')})`, 'g');

  const parts = text.split(regex);

  return parts
    .filter(part => part.length > 0)
    .map(part => emojiids.includes(part) ? h('img', {
      alt: '',
      src: getEmojiPublicPath(part, 'png'),
      class: 'msg-preview-emoji',
      'data-emoji-id': part
    }) : part);
}

const getEmojiPublicPath = (emoji_id, type, emoji_id_suffix = '', suffix = undefined) => {
  if (!suffix) {
    suffix = ({ 'png': '.png', 'apng': '.png', 'lottie': '.json' })[type]
  }
  return qqSystemEmoji(encodeURIComponent(emoji_id), type, `${ encodeURIComponent(emoji_id) }${ emoji_id_suffix }${ suffix }/`)
}

const getEmojiPngPath = emoji_id => getEmojiPublicPath(emoji_id, 'png')
const getEmojiApngPath = (emoji_id, checkExist = true) => {
  const path = getEmojiPublicPath(emoji_id, 'apng')
  if (checkExist) {
    if (!checkEmojiPathExist(path)) {
      return null
    }
  }
  return path
}
const checkEmojiPathExist = path => useGlobalStore().emojiFiles.includes(path)
const getAnimatedEmojiExistPath = emoji_id => {
  return getEmojiApngPath(emoji_id) || getEmojiPngPath(emoji_id)
}

const getEmojiLottiePath = (emoji_id, suffix) => getEmojiPublicPath(emoji_id, 'lottie', suffix)

const messagePreviewDirectConversionTypes = {
  "record": "语音",
  "video": "视频",
  "shake": "窗口抖动",
  "location": "位置",
  "music": "音乐",
  "forward": "聊天记录"
}

const createDisplayNameSpan = (is_group, group_id, user_id, promises) => {
  const type = is_group ? CacheNameKey.GROUP_USER : CacheNameKey.PRIVATE;
  const id_list = [group_id, user_id];

  let name

  const vnode = h("span", {
    async onVnodeMounted(vnode) {
      await promise
      if (vnode?.el && name) {
        vnode.el.textContent = name;
      }
    },
    innerText: getCacheName(id_list, type) || user_id
  })

  const promise = (async () => {
    if (!user_id) {
      name = '未知用户'
      return
    }
    const result = await fetchDisplayName(id_list, type, (newName) => {
      if (vnode?.el) {
        vnode.el.textContent = newName;
      }
    })
    if (!result.error) {
      name = result.name
    }
  })()

  if (Array.isArray(promises)) {
    promises.push(promise)
  }

  return vnode
}

const createNameSpanByMessageId = (message_id, promises) => {
  let name;
  const vnode = h("span", {
    async onVnodeMounted(vnode) {
      await promise
      if (vnode?.el && name) {
        vnode.el.textContent = name;
      }
    },
    innerText: '未知用户'
  })
  const promise = (async () => {
    let msg;
    try {
      msg = parseJSON((await fetchMsg(message_id))?.event);
    } catch (e) {
      console.error("获取消息失败:", message_id, e)
    }
    if (msg) {
      const sender = msg?.sender

      name = msg.user_id === msg.self_id ? '你' : (sender.group_id ? sender?.card || sender?.remark || sender?.nickname : "对方")
    } else {
      name = '未知'
    }
  })()
  if (Array.isArray(promises)) {
    promises.push(promise)
  }
  return vnode
}

const parseMessagePreview = (message, returnPromise = false, replyMode = false) => {
  const promises = []
  const r = (data) => {
    if (returnPromise) {
      return (async () => {
        await Promise.all(promises)
        return data
      })()
    } else {
      return data
    }
  }
  try {
    const event = parseJSON(message);

    if (event.message && Array.isArray(event.message)) {
      const children = [];

      for (const [index, item] of event.message.entries()) {
        const { type, data } = item

        switch (type) {
          case "text":
            children.push(data.text || '');
            break

          case 'video':
            if (replyMode) {
              children.push(
                h(LoadingImage, {
                  src: data.url,
                  class: 'message-reply-video',
                  controls: false,
                  fallbackSrc: getStreamFileDataUrl(item),
                  videoMode: true,
                  decideMaxWidth: '.message-container',
                  maxHeight: '80px',
                  placeholderWidth: '128px',
                  placeholderHeight: '80px'
                })
              )
              break
            }
            break

          case 'json':
            try {
              if (data?.data) {
                const jsonData = JSON.parse(data.data);
                if (jsonData.app === 'com.tencent.multimsg') {
                  children.push("[聊天记录]");
                  continue;
                }
                if (jsonData.prompt) {
                  children.push(jsonData.prompt);
                  continue;
                }
              }
            } catch (e) {
              console.error('未解析的 JSON 消息:', item)
            }
            children.push('[JSON]');
            break

          case 'dice':
          case 'rps':
          case 'face': {
            let face_id
            if (type === 'face') {
              face_id = data.id
            } else {
              face_id = {
                'dice': 358,
                'rps': 359
              }[type]
            }
            const animatedEmoji = replyMode ? getEmojiApngPath(face_id) : null

            children.push(
              h('img', {
                alt: '',
                src: animatedEmoji || getEmojiPngPath(face_id),
                class: 'msg-preview-emoji',
                'data-emoji-id': face_id
              })
            );
            break
          }

          case 'image':
            if (replyMode && index === 0) {
              children.push(
                h(LoadingImage, {
                  src: data.url,
                  class: 'message-reply-image',
                  alt: "",
                  fallbackSrc: objectHasKey(data, "emoji_id") ? getMultimediaProxyUrl(data.url) : getStreamFileDataUrl(item),
                  decideMaxWidth: '.message-container',
                  maxHeight: '80px',
                  placeholderWidth: '128px',
                  placeholderHeight: '80px'
                })
              )
              break
            }
            if (data.summary) {
              children.push(data.summary)
            } else {
              children.push('[图片]')
            }
            break

          case 'at':
            children.push(
              "@",
              createDisplayNameSpan(
                event.message_type === 'group',
                event.group_id,
                data.qq,
                promises,
              )
            );
            break

          case 'file':
            if (replyMode) {
              return [
                h(
                  "img",
                  {
                    src: qqFileIcon(getFileIcon(data.file)),
                    class: "message-reply-file-icon",
                    alt: ""
                  }
                ),
                h(
                  "span",
                  {
                    class: "message-reply-file text-truncate"
                  },
                  [data.file]
                )
              ]
            }
            if (data.file) {
              children.push(data.file)
            } else {
              children.push("[文件]")
            }
            break

          case 'poke': {
            const poke_id = data.id
            const poke_name = getPokeDescription(poke_id)
            children.push(`[${ poke_name || '未解析的戳一戳' }]`)
            if (!poke_name) {
              console.log("Unparsed poke message segment:", item)
            }
            break
          }

          default:
            // 通用类型判断
            if (objectHasKey(messagePreviewDirectConversionTypes, type)) {
              children.push(`[${ messagePreviewDirectConversionTypes[type] }]`);
            }
            break
        }
      }

      return r(children.length ? children : ['']);
    }
    return r([event.raw_message || '']);
  } catch (e) {
    console.error('Message preview parse error:', e);
    return r(['']);
  }
};

const parseMessage = (wrappedMsg) => {
  try {
    const event = parseJSON(wrappedMsg.event);
    const message = event.message
    if (Array.isArray(message)) {
      const isGroup = event.message_type === 'group'
      const isSelfSent = event.self_id === event.user_id
      const children = [];

      // 单独存在与混排有较大效果差异的消息
      if (message.length === 1) {
        const item = message[0];
        if (['dice', 'rps', 'face'].includes(item.type)) {
          const is_face = item.type === 'face'
          const face_id = is_face ? item.data.id : {
            'dice': 358,
            'rps': 359
          }[item.type]

          let resultId

          if (!is_face) {
            resultId = item.data.result
          }
          if (item.data.resultId) {
            resultId = item.data.resultId
          }

          const emojiFiles = useGlobalStore().emojiFiles;
          const lottiePath = getEmojiLottiePath(face_id, resultId ? `_${ resultId }` : '');

          if (emojiFiles.includes(lottiePath)) {
            // 加载 Lottie
            children.push(
              h(LottieDot, {
                animationUrl: lottiePath,
                loop: is_face && Number.parseInt(face_id) !== 114,
                autoplay: true,
                class: 'message-super-emoji-lottie message-box-less',
                'data-face-id': face_id,
              })
            );
          }
        }
        if (children?.length) {
          return children
        }
      }

      // 只能单独存在的消息
      if (message.length) {
        for (const item of message) {
          const { type, data } = item
          switch (type) {
            case 'record':
              children.push(
                h(AudioMessage, {
                  width: '200px',
                  maxWidth: '100%',
                  src: getFileDataUrl(item),
                  cursorColor: isSelfSent ? 'rgba(255, 255, 255, 0.8)' : 'rgba(204, 235, 255, 0.8)'
                })
              );
              break
            case 'file': {
              const name = data.name || data.file
              children.push(
                h(FileMessage, {
                  url: isSnowLuma() ? (isGroup ? getGroupFileProxyUrl : getPrivateFileProxyUrl)(
                    isGroup ? event.group_id : event.target_id,
                    data.file_id || data.id,
                    name,
                    data.url
                  ) : getStreamFileDataUrl(item),
                  name,
                  size: data.file_size,
                })
              );
              break
            }
            case 'poke':
              children.push(
                h(ShakePokeMessage, {
                  id: data.id,
                  type: data.type,
                  out: isSelfSent
                })
              )
              break
            case 'forward':
              children.push(
                h(ForwardMessage, {
                  id: data.id,
                  content: data.content,
                })
              )
              break
            case 'json': {
              const data = JSON.parse(item.data.data);
              const components_map = {
                "com.tencent.troopsharecard": TroopShareCard,
                "com.tencent.miniapp_01": MiniAPP01,
                "com.tencent.mannounce": Mannounce,
                "com.tencent.multimsg": MultiMsg,
                "com.tencent.feed.lua": FeedLua,
                "com.tencent.contact.lua": ContactLua,
                "com.tencent.activity.md": ActivityMD
              }
              const view_components_map = {
                "news": ViewNews,
                "invite": ViewInvite,
                "LocationShare": ViewLocationShare
              }
              const component = view_components_map[data?.view] || components_map[data.app] || UnparsedJSON;
              if (component) {
                children.push(
                  h(component, {
                    json: data
                  })
                )
              }
              break
            }
            case "flashtransfer":
              children.push(
                h(FlashTransferMessage, data)
              )
              break
            default:
          }
          if (children?.length) {
            break
          }
        }
        if (children?.length) {
          return children
        }
      }

      // 其它只在第一个元素的消息
      if (message.length) {
        const item = message[0]
        const { type, data } = item
        switch (type) {
          case 'markdown':
            children.push(
              h(MarkdownMessage, {
                content: data.content,
                class: 'message-markdown-box',
              })
            );

            return children;
          case'reply':
            children.push(
              h('div', [
                h(ReplyMessage, {
                  id: data.id,
                  out: isSelfSent
                })
              ])
            )
            break
        }
      }

      // 混排消息
      for (const item of message) {
        const { type, data } = item
        switch (type) {
          case'text':
            children.push(...convertMessageTextHTMLSyntax(data.text));
            break
          case 'dice':
          case 'rps':
          case 'face': {
            const face_id = type === 'face' ? data.id : {
              'dice': 358,
              'rps': 359
            }[type]

            children.push(
              h('img', {
                alt: '',
                src: getAnimatedEmojiExistPath(face_id),
                class: 'message-emoji-png',
              })
            );
            break
          }
          case 'at': {
            const id = data.qq;

            const type = isGroup ? CacheNameKey.GROUP_USER : CacheNameKey.NICKNAME
            const id_list = [event.group_id, id];

            children.push(
              h("span", {
                onVnodeMounted: (vnode) => {
                  // noinspection JSIgnoredPromiseFromCall
                  fetchDisplayName(id_list, type, newName => {
                    if (vnode?.el) {
                      vnode.el.textContent = `@${ newName }`;
                      vnode.el.dataset.displayName = newName
                    }
                  });
                },
                class: "at-somebody-link message-execute-command",
                innerText: `@${ getCacheName(id_list, type) || id }`,
                'data-user-id': id,
                'data-command': 'at-somebody',
                'data-display-name': "未获取"
              })
            )
            break
          }
          case'image': {
            const src = data.url
            children.push(
              h(LoadingImage, {
                src,
                alt: "",
                class:
                  'message-image' +
                  ((message.length === 1) ? " message-box-less" : "") +
                  (objectHasKey(data, "emoji_id") || data.summary === '[动画表情]' ? " message-emoji-picture" : ""),
                fallbackSrc: objectHasKey(data, "emoji_id") ? getMultimediaProxyUrl(src) : getStreamFileDataUrl(item),
                decideMaxWidth: '.message-container'
              })
            );
            break
          }
          case'video': {
            children.push(
              h(LoadingImage, {
                src: data.url,
                class: 'message-video' + ((message.length === 1) ? " message-box-less" : ""),
                controls: false,
                fallbackSrc: getStreamFileDataUrl(item),
                videoMode: true,
                decideMaxWidth: '.message-container'
              })
            );
          }
            break
          default:
        }
      }

      // console.log(children)

      return children.length ? children : [h(UnparsedMessage, { event })];
    }
    return [event.raw_message || ''];
  } catch (e) {
    console.error("Load message error", e);
    return [wrappedMsg.event || ''];
  }
};

/**
 * 秒数格式化时长
 * @param {number} duration
 * @returns {string}
 */
const parseBanDuration = (duration) => {
  if (duration === 0) return "0秒";
  const timeUnits = [
    { value: 86400, unit: "天" },
    { value: 3600, unit: "小时" },
    { value: 60, unit: "分钟" },
    { value: 1, unit: "秒" }
  ];
  let res = [];
  let t = duration;
  for (const { value, unit } of timeUnits) {
    const count = Math.floor(t / value);
    if (count > 0) {
      res.push(`${ count }${ unit }`);
      t %= value;
    }
  }
  return res.join("");
};

/**
 * 预览表情元素
 */
const createPreviewEmoji = (src, emoji_id) => h('img', {
  alt: '',
  src: src,
  class: 'msg-preview-emoji',
  'data-emoji-id': emoji_id
})

/**
 * 正式通知表情元素
 */
const noticeEmojiImg = (src, emoji_id) => h('img', {
  alt: '',
  src: src,
  class: 'notice-emoji-png',
  'data-emoji-id': emoji_id
})

/**
 * 驼峰dataset对象 转为 data-xxx 属性对象
 * @param {Object} obj { userId:1, pageIndex:2 }
 * @returns {Object} {"data-user-id":1,"data-page-index":2}
 */
function toDataAttr(obj) {
  const res = {}
  for (let key in obj) {
    const kebab = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
    res[`data-${ kebab }`] = obj[key]
  }
  return res
}

/**
 * 点击指令容器
 */
const createNoticeExecuteCommand = (command, children, dataset = {}) => {
  const childNodes = Array.isArray(children) ? children : [children]
  return h("span", {
    class: "message-execute-command",
    "data-command": command,
    ...toDataAttr(dataset)
  }, childNodes)
}

/**
 * 通知入口统一解析器
 * @param {object} event 解析之后的事件对象
 * @param {boolean} isPreview 是否预览模式
 * @param {Array} promises 异步加载Promise容器
 */
function renderNoticeChildren(event, isPreview, promises) {
  const {
    sub_type, notice_type, user_id, self_id,
    sender_id, target_id,
    group_id, operator_id, message_id
  } = event
  const isGroup = !!group_id

  // 用户名称标签生成器
  const spanName = uid =>
    createDisplayNameSpan(isGroup, group_id, uid, isPreview ? promises : undefined)
  const exeName = uid =>
    createNoticeExecuteCommand('view-user-info', spanName(uid), { userId: uid })
  const getNameEl = uid =>
    isPreview ? spanName(uid) : exeName(uid)
  const canSelfName = uid => uid === self_id ? '你' : getNameEl(uid)
  const jumpMsg = (...contents) =>
    createNoticeExecuteCommand("jump-to-msg", contents, { messageId: message_id })

  const children = []

  if (notice_type === 'notify') {
    switch (sub_type) {
      case 'poke': {
        const raw_info = event.raw_info
        if (!raw_info || !isArray(raw_info)) break

        const poke_sender = sender_id || user_id
        const poke_target = target_id
        let qq_user_count = 0
        const qq_user = { 1: poke_sender, 2: poke_target }

        for (const item of raw_info) {
          if (item.type === 'qq') {
            qq_user_count++
            const uin = qq_user[qq_user_count]
            children.push(uin ? canSelfName(uin) : item.uid)
          } else if (item.type === 'nor') {
            children.push(item.txt)
          } else if (item.type === 'img') {
            if (isPreview) {
              children.push(createPreviewEmoji(item.src))
            } else {
              let el = noticeEmojiImg(item.src)
              if (item.jp) {
                el = h("a", { target: '_blank', href: item.jp }, [el])
              }
              children.push(el)
            }
          }
        }
        break
      }
      case 'title':
        children.push(
          '恭喜',
          canSelfName(user_id),
          '获得',
          operator_id ? getNameEl(operator_id) : "群主",
          "授予的",
          createNoticeExecuteCommand(undefined, event.title),
          '头衔'
        )
        break
      case 'group_name':
        children.push(
          canSelfName(user_id),
          `修改了群名称为`,
          createNoticeExecuteCommand(undefined, event.name_new)
        )
        break
      default:
    }
  }

  switch (notice_type) {
    // 精华消息
    case 'essence':
      if (sub_type === 'add') {
        if (isPreview) {
          children.push(user_id ? canSelfName(user_id) : "未知", '的消息被设为了精华消息')
        } else {
          children.push(
            user_id ? jumpMsg(canSelfName(user_id), '的消息') : "未知的消息",
            '被设为了',
            createNoticeExecuteCommand('open-essence-window', '精华消息')
          )
        }
      }
      break

    // 群禁言
    case 'group_ban':
      if (!['ban', 'lift_ban'].includes(sub_type)) break
      if (String(user_id) === '0') {
        children.push(
          canSelfName(operator_id),
          sub_type === 'ban' ? '开启' : "关闭",
          "了全员禁言"
        )
      } else {
        children.push(
          canSelfName(user_id),
          '被',
          canSelfName(operator_id),
          sub_type === 'ban' ? '禁言' : "解除禁言"
        )
        sub_type === 'ban' && children.push(parseBanDuration(event.duration))
      }
      break

    // 入群
    case 'group_increase':
      if (!['approve', 'invite'].includes(sub_type)) break
      if (sub_type === 'invite') {
        children.push(canSelfName(operator_id), '邀请')
      }
      children.push(canSelfName(user_id), '加入了群聊')
      break

    // 退群/踢出
    case 'group_decrease':
      if (sub_type === 'kick_me') {
        children.push('你已被移出群聊')
      } else if (sub_type === 'kick') {
        children.push(
          getNameEl(user_id),
          '已被',
          canSelfName(operator_id),
          '移出'
        )
      } else if (sub_type === 'leave') {
        children.push(
          canSelfName(user_id),
          '退出了群聊',
        )
      }
      break

    // 表情回应
    case 'group_msg_emoji_like': {
      const face_id = event?.likes?.[0]?.emoji_id
      const emojiEl = isPreview
        ? createPreviewEmoji(getEmojiPngPath(face_id), face_id)
        : noticeEmojiImg(getAnimatedEmojiExistPath(face_id), face_id)
      const nameSpan = isPreview
        ? createNameSpanByMessageId(message_id, promises)
        : jumpMsg(createNameSpanByMessageId(message_id), '的消息')

      children.push(
        canSelfName(operator_id),
        sub_type === 'add' ? '回应了' : "取消回应了",
        nameSpan,
        ': ',
        emojiEl
      )
      break
    }

    // 管理员变动
    case 'group_admin':
      children.push(
        canSelfName(user_id),
        "被",
        sub_type === 'set' ? '设为' : "取消",
        "管理员"
      )
      break

    case 'group_recall':
    case 'friend_recall': {
      if (isGroup) {
        children.push(
          canSelfName(operator_id),
          '撤回了'
        )
        if (operator_id !== user_id) {
          children.push(
            "成员",
            getNameEl(user_id),
            "的"
          )
        }
      } else {
        children.push(
          createNameSpanByMessageId(message_id, promises),
          "撤回了"
        )
      }
      children.push(
        jumpMsg("一条消息")
      )
      break
    }

    default:
  }

  return children
}

/**
 * 预览版通知解析（异步加载昵称、无点击命令）
 * @param {object} notice
 * @param {boolean} returnPromise
 */
const parseNoticePreview = (notice, returnPromise = false) => {
  const promises = []
  let children = []
  try {
    const event = parseJSON(notice);
    children = renderNoticeChildren(event, true, promises)
  } catch (e) {
    console.error("Notice preview parse error:", e)
    children = ['']
  }

  if (returnPromise) {
    return (async () => {
      await Promise.all(promises)
      return children
    })()
  }
  return children
}

/**
 * 正式渲染通知解析（全部带点击交互、不需要异步promise）
 */
const parseNotice = (notice) => {
  let children = []
  try {
    const event = parseJSON(notice.event);
    children = renderNoticeChildren(event, false, [])
  } catch (e) {
    console.error("Notice parse error:", e)
    children = ['']
  }
  return children
}

const isSupportedNoticeMessage = notice => {
  const { notice_type, sub_type } = notice
  return (
    (notice_type === 'notify' && ['poke', 'title', 'group_name'].includes(sub_type)) ||
    (notice_type === 'essence' && sub_type === 'add') ||
    (notice_type === 'group_ban' && ['ban', 'lift_ban'].includes(sub_type)) ||
    (notice_type === 'group_increase' && ['approve', 'invite'].includes(sub_type)) ||
    (notice_type === 'group_decrease' && ['kick_me', 'kick'].includes(sub_type)) ||
    (notice_type === 'group_msg_emoji_like' && ['add', 'remove'].includes(sub_type)) ||
    (notice_type === 'group_admin' && ['set', 'unset'].includes(sub_type)) ||
    ['group_recall', "friend_recall"].includes(notice_type)
  )
}

export {
  parseMessagePreview,
  formatTime,
  parseMessage,
  convertMessageTextHTMLSyntax,
  parseNoticePreview,
  parseNotice,
  isSupportedNoticeMessage,
}