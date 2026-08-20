<script>

import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue";
import {
  fetchSetCustomStatus,
  fetchSetOnlineStatus,
  fetchUserOnlineStatus,
  handleApiRequest
} from "@/scripts/backend-api.js";
import LoadingSpinner from "@/components/Common/Widgets/LoadingSpinner.vue";
import { isObject, isString } from "@/scripts/types-util.js";
import {
  getStatusDescription,
  getOnlineStatusIcon,
  getStatusDataValue,
  isCustomStatus, findStatusName
} from "@/scripts/oneline-status.js";
import { qqSystemEmoji, qqSystemStatusImg } from "@/composables/useBase.js";
import { showWarningToast } from "@/scripts/toast.js";
import QIcon from "@/components/Common/Icons/QIcon.vue";
import CustomScrollBar from "@/components/Common/Scrolling/CustomScrollBar.vue";
import { useGlobalStore } from "@/store/global.js";

const createStatusTheme = (btn, color, image) => ({ btn, color, image });
const statusTheme = {
  a: createStatusTheme("rgb(0, 153, 255)", "rgb(229 238 255)", qqSystemStatusImg("bg_compressed_B.png")),
  b: createStatusTheme("rgb(221, 199, 77)", "rgb(246, 237, 206)"),
  c: createStatusTheme("rgb(77, 191, 146)", "rgb(225, 245, 232)"),
  d: createStatusTheme("rgb(241, 161, 148)", "rgb(255, 237, 233)"),
  e: createStatusTheme("rgb(71, 183, 230)", "rgb(232, 246, 255)"),
  f: createStatusTheme("rgb(118, 134, 255)", "rgb(241, 239, 255)"),
  g: createStatusTheme("rgb(180, 222, 93)", "rgb(228, 238, 200)"),
  h: createStatusTheme("rgb(237, 140, 210)", "rgb(242, 229, 236)"),
  i: createStatusTheme("rgb(255, 179, 147)", "rgb(255, 230, 221)"),
}

// noinspection NonAsciiCharacters,JSNonASCIINames
const statusThemeMap = {
  自定义: statusTheme.a,
  在线: statusTheme.a,
  Q我吧: statusTheme.b,
  离开: statusTheme.c,
  忙碌: statusTheme.b,
  请勿打扰: statusTheme.d,
  隐身: statusTheme.b,
  我的电量: statusTheme.e,
  听歌中: statusTheme.f,
  做好事: statusTheme.c,
  出去浪: statusTheme.c,
  去旅行: statusTheme.c,
  被掏空: statusTheme.e,
  今日步数: statusTheme.g,
  今日天气: statusTheme.e,
  我crush了: statusTheme.h,
  爱你: statusTheme.h,
  恋爱中: statusTheme.d,
  好运锦鲤: statusTheme.i,
  水逆退散: statusTheme.a,
  嗨到飞起: statusTheme.d,
  元气满满: statusTheme.i,
  一言难尽: statusTheme.a,
  难得糊涂: statusTheme.b,
  emo中: statusTheme.a,
  我太难了: statusTheme.a,
  我想开了: statusTheme.h,
  我没事: statusTheme.a,
  想静静: statusTheme.a,
  悠哉哉: statusTheme.c,
  信号弱: statusTheme.a,
  睡觉中: statusTheme.c,
  肝作业: statusTheme.a,
  学习中: statusTheme.e,
  搬砖中: statusTheme.e,
  摸鱼中: statusTheme.b,
  无聊中: statusTheme.c,
  "TiMi 中": statusTheme.b,
  一起元梦: statusTheme.f,
  求星搭子: statusTheme.f,
  熬夜中: statusTheme.f,
  追剧中: statusTheme.b
}
export default {
  name: "OnlineStatusEditor",
  components: { CustomScrollBar, QIcon, LoadingSpinner, SimpleWindow },
  inject: ['selfInfo'],
  data() {
    return {
      onlineStatus: null,
      statusThemeMap,
      isCustomStatusEditor: false,
      customStatusFaceId: 1,
      customStatusDesc: ""
    }
  },
  computed: {
    currentStatusDesc() {
      if (!isObject(this.onlineStatus)) return null
      return getStatusDescription(this.onlineStatus)
    },
    currentStatusName() {
      if (!isObject(this.onlineStatus)) return null
      return findStatusName(this.onlineStatus)
    },
    currentStatusIcon() {
      if (!isObject(this.onlineStatus)) return null
      return getOnlineStatusIcon(this.onlineStatus)
    },
    currentStatusThemeStyle() {
      if (!isString(this.currentStatusName)) return undefined
      const theme = this.isCustomStatusEditor ? statusTheme.a : statusThemeMap[this.currentStatusName]
      if (!theme) return undefined
      return {
        backgroundImage: theme.image ? `url(${theme.image})` : 'none',
        backgroundColor: theme.color,
        '--current-option-color': theme.btn,
      }
    },
    expressionIdList() {
      return useGlobalStore().allEmojiids
    }
  },
  async mounted() {
    this.onlineStatus = await fetchUserOnlineStatus(this.selfInfo.user_id)
  },
  methods: {
    getOnlineStatusIcon,
    async updateOnlineStatus() {
      this.onlineStatus = await fetchUserOnlineStatus(this.selfInfo.user_id)
    },
    updateSelfInfo(status) {
      this.selfInfo.status = status.status
      this.selfInfo.ext_status = status.ext_status
      this.selfInfo.customStatus = status.customStatus
    },
    async handleSelectStatus(name) {
      if (isCustomStatus(name)) {
        const customStatus = this.onlineStatus?.customStatus
        this.customStatusFaceId = 262
        this.customStatusDesc = "脑阔疼"
        if (isObject(customStatus)) {
          this.customStatusFaceId = customStatus.faceId
          this.customStatusDesc = customStatus.wording
        }
        this.isCustomStatusEditor = true
        return
      }
      const data = getStatusDataValue(name)
      if (!data) {
        showWarningToast("未找到状态值")
        return
      }
      if (await handleApiRequest(
        fetchSetOnlineStatus(data.status, data.ext_status),
        undefined,
        "设置在线状态失败"
      )) {
        this.onlineStatus = data
        this.updateSelfInfo(data)
      }
      await this.updateOnlineStatus()
    },
    getCustomStatusIcon(faceId) {
      faceId = encodeURIComponent(faceId)
      return qqSystemEmoji(faceId, 'png', `${faceId}.png`)
    },
    handleSelectExpression(emoji_id) {
      if (emoji_id !== this.customStatusFaceId) {
        this.customStatusDesc = this.getExpressionDescription(emoji_id)
      }
      this.customStatusFaceId = emoji_id
    },
    getExpressionDescription(emoji_id) {
      return useGlobalStore().emojiDescribes[emoji_id]
    },
    async handleSetCustomStatus() {
      const faceId = this.customStatusFaceId, wording = this.customStatusDesc;
      if (await handleApiRequest(
        fetchSetCustomStatus(faceId, wording),
        undefined,
        "设置自定义在线状态失败"
      )) {
        const status = {
          status: 10,
          ext_status: 2000,
          customStatus: {
            faceId,
            wording
          }
        }
        this.onlineStatus = status
        this.updateSelfInfo(status)
      }
      this.isCustomStatusEditor = false
      await this.updateOnlineStatus()
    }
  }
}
</script>

<template>
  <SimpleWindow :width="320" :height="536" class="online-status-editor" :style="currentStatusThemeStyle"
                title="自定义状态">
    <template v-if="onlineStatus">
      <template v-if="isCustomStatusEditor">
        <div class="custom-status-area">
          <img alt="" class="custom-status-icon" :src="getCustomStatusIcon(customStatusFaceId)"/>
          <label>
            <input v-model="customStatusDesc" placeholder="自定义描述">
            <QIcon name="edit_24"/>
          </label>
        </div>
        <CustomScrollBar class="expression-scroller">
          <div class="expression-list">
            <img class="expression-icon" alt="" v-for="emoji_id in expressionIdList"
                 :class="{ active: this.customStatusFaceId === emoji_id }"
                 @click="handleSelectExpression(emoji_id)"
                 :src="getCustomStatusIcon(emoji_id)">
          </div>
        </CustomScrollBar>
        <div class="custom-status-buttons">
          <div class="button confirm" @click="handleSetCustomStatus">就这个</div>
          <div class="button cancel" @click="isCustomStatusEditor = false">取消</div>
        </div>
      </template>
      <template v-else>
        <div class="current-status-container">
          <div class="current-status">
            <img alt="" :src="currentStatusIcon"/>
            <span>{{ currentStatusDesc }}</span>
          </div>
        </div>
        <div class="online-status-panel-container">
          <div class="online-status-panel">
            <div class="online-status-panel-option" v-for="(_, name) in statusThemeMap"
                 :class="{ current: name === currentStatusName }" @click="handleSelectStatus(name)">
              <img alt="" :src="getOnlineStatusIcon(name)"/>
              {{ name }}
            </div>
          </div>
        </div>
      </template>
    </template>
    <LoadingSpinner v-else text="获取在线状态中"/>
  </SimpleWindow>
</template>

<style scoped lang="scss">
.online-status-editor {
  padding: 0;
  background: url("#{$base-url}QQ/app/img/bg_light.cead26c6c45a538199d3.png");
  @extend %bg-fill-no-tile;
  background-repeat: no-repeat !important;
  @extend %flex-column;

  :deep(.window-title) {
    background: transparent;
    border: none;
    font-size: 0;
    position: absolute;
    right: 0;
    top: 0;

    .window-close-btn {
      top: 4px;
      right: 4px;
      @include square-size(18px);
    }
  }

  &:has(.custom-status-area) {
    background-size: 100%;

    :deep(.window-title) {
      font-size: 12px;
      padding-top: 4px;
      width: 100%;
    }
  }
}

.current-status {
  &-container {
    flex-basis: 40%;
    max-height: 215px;
    @extend %flex-center-children;
  }

  @extend %flex-center-children;
  font-size: 16px;
  margin-top: 20%;

  img {
    @include square-size(24px);
    margin: 4px;
  }
}

.online-status-panel-container {
  @include no-scrollbar;
  overflow: auto;
  margin: 4px 14px 14px;
  flex: 1;
}

.online-status-panel {
  background-color: color-opacity($color-bg-card, 0.4);
  border-radius: $radius-btn;
  padding: 14px;
  display: grid;
  gap: 14px;
  @include grid-columns-auto-fill(55px)
}

.online-status-panel-option {
  @include square-size(55px);
  border-radius: $radius-card;
  @extend %flex-center-children;
  flex-direction: column;
  gap: 0;
  font-size: 10px;
  @extend %hover-active-bg-opacity;
  cursor: pointer;

  img {
    margin-top: 4px;
    @include square-size(24px);
  }

  &.current {
    background-color: var(--current-option-color) !important;
    color: $color-bg-card;
  }
}

.custom-status-area {
  background-color: color-opacity($color-bg-card, 0.4);
  border-radius: $radius-card;
  height: 170px;
  margin: 42px 18px 20px;
  @extend %flex-center-children, %flex-column;
  gap: 8px;

  .custom-status-icon {
    @include square-size(40px);
  }

  label {
    @extend %flex-row-center;

    input {
      background: transparent;
      outline: none;
      border: none;
      field-sizing: content;
    }

    svg {
      @include square-size(18px);
      margin-left: 4px;
      color: $color-text-muted;
      cursor: pointer;
    }
  }
}

.expression {
  &-scroller {
    flex: 1;
    overflow: auto;
    margin: 0 12px 10px;
  }

  &-list {
    display: grid;
    @include grid-columns-auto-fill(40px);
    gap: 5px;
    padding: 0 6px;
  }

  &-icon {
    @include square-size(40px);
    @extend %hover-active-bg-opacity;
    border-radius: $radius-btn;
    padding: 6px;

    &.active {
      background-color: $color-bg-hover-opacity;

      &:active {
        background-color: $color-bg-active-opacity;
      }
    }
  }
}

.custom-status-buttons {
  padding: 0 8px 8px;
  @extend %flex-row-center;
  justify-content: flex-end;
  gap: 12px;

  .button {
    @include btn-base($radius-bubble);
    padding: 6px 14px;
    font-size: 14px;

    &.confirm {
      @include btn-primary($radius-bubble);
    }

    &.cancel {
      @include btn-cancel($radius-bubble);
    }
  }
}
</style>