import { qqAppStatusImg, qqSystemEmoji, qqSystemStatusImg } from "@/composables/useBase.js";
import { isObject, isString } from "@/scripts/types-util.js";

// noinspection NonAsciiCharacters,JSNonASCIINames
const statusMap = {
  自定义: {
    status: 10,
    ext_status: 2000
  },
  在线: {
    status: 10,
    ext_status: 0
  },
  离开: {
    status: 30,
    ext_status: 0
  },
  忙碌: {
    status: 50,
    ext_status: 0
  },
  请勿打扰: {
    status: 70,
    ext_status: 0
  },
  隐身: {
    status: 40,
    ext_status: 0
  },
  Q我吧: {
    status: 60,
    ext_status: 0
  },
  我的电量: {
    status: 10,
    ext_status: 1000
  },
  听歌中: {
    status: 10,
    ext_status: 1028
  },
  做好事: {
    status: 10,
    ext_status: 2047
  },
  出去浪: {
    status: 10,
    ext_status: 2003
  },
  去旅行: {
    status: 10,
    ext_status: 2015
  },
  被掏空: {
    status: 10,
    ext_status: 2014
  },
  今日步数: {
    status: 10,
    ext_status: 2017
  },
  今日天气: {
    status: 10,
    ext_status: 1030
  },
  我crush了: {
    status: 10,
    ext_status: 2019
  },
  爱你: {
    status: 10,
    ext_status: 2006
  },
  恋爱中: {
    status: 10,
    ext_status: 1051
  },
  好运锦鲤: {
    status: 10,
    ext_status: 1071
  },
  水逆退散: {
    status: 10,
    ext_status: 1201
  },
  嗨到飞起: {
    status: 10,
    ext_status: 1056
  },
  元气满满: {
    status: 10,
    ext_status: 1058
  },
  一言难尽: {
    status: 10,
    ext_status: 1063
  },
  难得糊涂: {
    status: 10,
    ext_status: 2001
  },
  emo中: {
    status: 10,
    ext_status: 1401
  },
  我太难了: {
    status: 10,
    ext_status: 1062
  },
  我想开了: {
    status: 10,
    ext_status: 2013
  },
  我没事: {
    status: 10,
    ext_status: 1052
  },
  想静静: {
    status: 10,
    ext_status: 1061
  },
  悠哉哉: {
    status: 10,
    ext_status: 1059
  },
  信号弱: {
    status: 10,
    ext_status: 1011
  },
  睡觉中: {
    status: 10,
    ext_status: 1016
  },
  肝作业: {
    status: 10,
    ext_status: 2012
  },
  学习中: {
    status: 10,
    ext_status: 1018
  },
  搬砖中: {
    status: 10,
    ext_status: 2023
  },
  摸鱼中: {
    status: 10,
    ext_status: 1300
  },
  无聊中: {
    status: 10,
    ext_status: 1060
  },
  "TiMi 中": {
    status: 10,
    ext_status: 1027
  },
  一起元梦: {
    status: 10,
    ext_status: 2025
  },
  求星搭子: {
    status: 10,
    ext_status: 2026
  },
  熬夜中: {
    status: 10,
    ext_status: 1032
  },
  追剧中: {
    status: 10,
    ext_status: 1021
  }
}

// noinspection NonAsciiCharacters,JSNonASCIINames
const statusRendererIconMap = {
  在线: "online.1c774cd7270efb0f7424.png",
  Q我吧: "qme.20fa5050aeac9a438b16.png",
  离开: "leave.8eb7ea4fa3a40e2cb025.png",
  忙碌: "business.5b1f23e57104a64c3f43.png",
  请勿打扰: "nonotify.bf159d63af9c87bfc08c.png",
  隐身: "reclusion.9672c1a3e3d9b2246de9.png",
  我的电量: "electric.0547831a101942676169.png"
};

// noinspection NonAsciiCharacters,JSNonASCIINames
const statusSystemIconMap = {
  听歌中: "music@2x.png",
  做好事: "xiaohonghua100.png",
  出去浪: "chuqulang2.png",
  去旅行: "gototravel.png",
  被掏空: "tkong.png",
  今日步数: "dailywalk.png",
  今日天气: "weather_3x.png",
  我crush了: "crush.png",
  爱你: "aiziji@2x.png",
  恋爱中: "relationship_3x.png",
  好运锦鲤: "jinli@2x.png",
  水逆退散: "luck@2x.png",
  嗨到飞起: "happytofly@3x.png",
  元气满满: "fullofyuanqi@3x.png",
  一言难尽: "hardtosay@3x.png",
  难得糊涂: "nandehutu.png",
  emo中: "emonew@2x.png",
  我太难了: "toohard@3x.png",
  我想开了: "woxiangkaile.png",
  我没事: "imfine_3x.png",
  想静静: "bequiet@3x.png",
  悠哉哉: "youzaizai@3x.png",
  信号弱: "signal_3x.png",
  睡觉中: "sleeping_3x.png",
  肝作业: "ganzuoye.png",
  学习中: "study_3x.png",
  搬砖中: "banzhuan.png",
  摸鱼中: "fish@2x.png",
  无聊中: "boring@3x.png",
  "TiMi 中": "timi_3x.png",
  一起元梦: "yiqiyuanmeng.png",
  求星搭子: "qiuxingdazi.png",
  熬夜中: "stayup_3x.png",
  追剧中: "tv_3x.png"
};

function isCustomStatus(name) {
  if (isObject(name)) name = findStatusName(name)
  return name === '自定义'
}

function getOnlineStatusIcon(status) {
  const name = isString(status) ? status : findStatusName(status)
  const renderer = statusRendererIconMap[name];
  const system = statusSystemIconMap[name];
  if (isCustomStatus(name)) {
    if (status?.customStatus) {
      const emoji_id = encodeURIComponent(status.customStatus.faceId)
      return qqSystemEmoji(emoji_id, 'png', `${emoji_id}.png`)
    }
    return qqSystemStatusImg("selfdefine@3x.png")
  }

  if (renderer) return qqAppStatusImg(renderer)
  if (system) return qqSystemStatusImg(system)
}

/**
 * 根据 status、ext_status 反向查找状态名称
 * @param {number} status
 * @param {number} extStatus
 * @returns {string|null}
 */
function findStatusName(status, extStatus = undefined) {
  if (isObject(status)) {
    const opt = status
    status = opt.status
    extStatus = opt.ext_status ?? opt.extStatus
  }
  for (const [name, item] of Object.entries(statusMap)) {
    if (item.status === status && item.ext_status === extStatus) {
      return name
    }
  }
  return null
}

function getStatusDescription(status) {
  const name = findStatusName(status)
  if (isCustomStatus(name) && status.customStatus) {
    return status.customStatus.wording
  }
  return name
}

function getStatusDataValue(name) {
  return statusMap[name]
}

export { getOnlineStatusIcon, getStatusDescription, getStatusDataValue, isCustomStatus, findStatusName }