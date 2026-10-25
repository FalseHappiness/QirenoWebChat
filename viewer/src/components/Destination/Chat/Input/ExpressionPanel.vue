<!--
  表情选择面板组件
  包含表情分组展示、悬停动画预览、表情描述提示
-->
<script>
import Tooltip from "../../../Common/Overlay/Tooltip.vue"
import CustomScrollBar from "../../../Common/Scrolling/CustomScrollBar.vue"
import LottieDot from "../../../Common/Media/LottieDot.vue"
import { useEditorEmoji } from "./composables/useEditorEmoji.js"
import QIcon from "@/components/Common/Icons/QIcon.vue";
import {
  buildCustomFaceUrl,
  fetchCustomFaceCompatibly,
  fetchDeleteCustomFace, fetchModifyCustomFaceDescription,
  fetchMoveCustomFaceToFront, getCustomFaceId,
  handleApiRequest,
  uniqueByCustomFaceId
} from "@/scripts/backend-api.js";
import {
  isArray,
  isNil,
  isObject,
  isString,
  modifyExistItems,
  moveItemToFront,
  removeItems
} from "@/scripts/types-util.js";
import { basicContextItem, formatBasicContextItems, vCustomMenu } from "@/directives/context-menu.js";
import { showConfirmBox, showPromptBox } from "@/scripts/popup-box-api.js";
import { showErrorToast } from "@/scripts/toast.js";
import LoadingSpinner from "@/components/Common/Widgets/LoadingSpinner.vue";
import { Emitter } from "@/composables/useEventBus.js";
import { isSnowLuma } from "@/scripts/onebot-version-util.js";

export default {
  name: "ExpressionPanel",
  components: {
    LoadingSpinner,
    QIcon,
    Tooltip,
    CustomScrollBar,
    LottieDot,
  },
  directives: {
    customMenu: vCustomMenu
  },
  props: {
    global: {
      type: Object,
      required: true,
    },
  },
  emits: ['select-emoji', 'select-add-face', 'insert-image'],
  setup(props) {
    // 使用 composable，传入全局 store 对象
    const {
      getPngEmojiUrl,
      getApngEmojiUrl,
      getEmojiDescription,
      getEmojiAnimationVariants,
      preloadEmojiLotties,
      isPokeEmoji,
      getPokeEmojiNum,
      getEmojiGroupList
    } = useEditorEmoji(props.global)
    const emojiGroupList = getEmojiGroupList()
    return {
      getPngEmojiUrl,
      getApngEmojiUrl,
      getEmojiDescription,
      getEmojiAnimationVariants,
      preloadEmojiLotties,
      isPokeEmoji,
      getPokeEmojiNum,
      emojiGroupList
    }
  },
  mounted() {
    this.updateCustomFaces()
    Emitter.on("add-custom-face-success", this.handleAddCustomFaceSuccess)
    // 预加载面板中所有多动画表情的 lottie 数据（含默认与各变体）
    this.preloadEmojiLotties?.()
  },
  unmounted() {
    Emitter.off("add-custom-face-success")
  },
  beforeCreate() {
    // 非响应式：避免函数式 ref 在每次渲染赋值时触发额外更新
    this.emojiTooltipRefs = {}
  },
  data() {
    return {
      isDefaultPanel: true,
      isCustomFacePanel: false,
      customFaces: [],
      isLoadingCustomFaces: false,
      isLoadCustomFacesError: true
    }
  },
  methods: {
    handleExpressionInput(e) {
      let target = e.target
      if (target) {
        if (!target.classList.contains('message-input-expression-emoji-box')) {
          target = target.closest('.message-input-expression-emoji-box')
        }
        if (target) {
          const emoji = target.dataset.emoji
          // 直接点击面板：不指定 resultId，沿用默认行为
          this.$emit('select-emoji', { emoji })
        }
      }
    },

    /**
     * 记录表情对应的 Tooltip 组件实例（同一 emoji 可能出现在多个分组，存数组）
     */
    setEmojiTooltipRef(emoji, el) {
      const key = String(emoji)
      if (el) {
        const list = (this.emojiTooltipRefs[key] ||= [])
        if (!list.includes(el)) list.push(el)
      } else {
        this.emojiTooltipRefs[key] = []
      }
    },

    /**
     * 选择具体动画变体（来自 tooltip 内的变体列表）
     * @param {string|number} emoji 表情 ID
     * @param {number} resultId 0=默认，N=动画N
     */
    handleSelectVariant(emoji, resultId) {
      this.$emit('select-emoji', { emoji: String(emoji), resultId: Number(resultId) })
      // 选择后立即隐藏该表情的所有 tooltip
      const tooltips = this.emojiTooltipRefs[String(emoji)] || []
      tooltips.forEach(tooltip => {
        if (!tooltip) return
        tooltip.showFlag = false
        tooltip.show = false
      })
    },
    showDefaultPanel() {
      this.isDefaultPanel = true
      this.isCustomFacePanel = false
    },
    showCustomFacePanel() {
      this.isDefaultPanel = false
      this.isCustomFacePanel = true
      this.updateCustomFaces()
    },
    async updateCustomFaces() {
      this.isLoadCustomFacesError = false
      this.isLoadingCustomFaces = true
      try {
        const result = await fetchCustomFaceCompatibly();
        if (isArray(result)) {
          this.customFaces = uniqueByCustomFaceId(result)
        }
      } catch (e) {
        console.error("Fetch custom face error:", e)
        this.isLoadCustomFacesError = true
        showErrorToast("获取自定义表情失败")
      }
      this.isLoadingCustomFaces = false
    },
    handleCustomFaceContextMenu(face) {
      const { face_id } = face
      const sameFace = f => f.face_id === face_id
      return () => formatBasicContextItems(
        basicContextItem(
          "移至最前",
          async () =>
            await handleApiRequest(fetchMoveCustomFaceToFront(face_id)) &&
            moveItemToFront(this.customFaces, sameFace, true)
          ,
          undefined,
          isSnowLuma()
        ),
        basicContextItem(
          "删除",
          async () =>
            await showConfirmBox("确认删除") &&
            await handleApiRequest(fetchDeleteCustomFace(face), '删除成功') &&
            removeItems(this.customFaces, sameFace, true)
        ),
        basicContextItem(
          "修改备注",
          async () => {
            const desc = await showPromptBox(
              "修改备注",
              undefined,
              "请输入备注",
              face.desc || ""
            )
            if (!isNil(desc)) {
              await handleApiRequest(
                fetchModifyCustomFaceDescription(face, desc),
                '修改成功'
              ) && modifyExistItems(
                this.customFaces,
                sameFace,
                f => f.desc = desc,
                false
              )
            }
          }
        )
      )
    },
    handleAddCustomFaceSuccess(data) {
      let url;
      if (isObject(data)) {
        url = data.url || buildCustomFaceUrl(data.emoji_id)
      } else if (isString(data)) {
        url = buildCustomFaceUrl(data)
      }
      if (url) {
        this.customFaces = uniqueByCustomFaceId([{ face_id: getCustomFaceId(url), url }, ...this.customFaces])
      } else {
        this.updateCustomFaces()
      }
    }
  },
}
</script>

<template>
  <div class="message-input-expression-box tooltip-style">
    <div class="message-input-expression-panel">
      <CustomScrollBar :class="{ 'display-none': !isDefaultPanel }">
        <template v-for="(category, i) in emojiGroupList" :key="i">
          <p class="message-input-expression-category-title">
            {{ category.title }}
          </p>
          <div class="message-input-expression-category" :class="{ big: category.big }">
            <Tooltip
              :distance-from-target="0"
              use-target-slot
              v-for="(emoji, index) in category.list"
              :key="index"
              z-index="1002"
              :can-hover-interact="true"
              :hover-leave-delay="200"
              :width="220"
              :ref="el => setEmojiTooltipRef(emoji, el)"
            >
              <template #target>
                <div
                  class="message-input-expression-emoji-box"
                  @click="handleExpressionInput"
                  :data-emoji="emoji"
                >
                  <img
                    :src="getPngEmojiUrl(emoji, true)"
                    alt=""
                    :data-emoji-animation="getApngEmojiUrl(emoji) ? 'static' : ''"
                  />

                  <img
                    v-if="getApngEmojiUrl(emoji)"
                    :src="getApngEmojiUrl(emoji)"
                    alt=""
                    data-emoji-animation="animation"
                  />
                </div>
              </template>
              <template #content>
                <div class="tooltip-style message-input-expression-emoji-tooltip"
                     v-if="getEmojiDescription(emoji) || getEmojiAnimationVariants(emoji)">
                  <template v-if="getEmojiAnimationVariants(emoji)">
                    <!-- 多动画变体选择 -->
                    <div class="emoji-variant-tooltip-title">
                      {{ getEmojiDescription(emoji) || emoji }}
                    </div>
                    <div class="emoji-variant-list">
                      <div
                        v-for="variant in getEmojiAnimationVariants(emoji)"
                        :key="variant.resultId"
                        class="emoji-variant-item"
                        @click.stop="handleSelectVariant(emoji, variant.resultId)"
                      >
                        <LottieDot
                          v-if="variant.url"
                          :animation-url="variant.url"
                          :loop="true"
                          :autoplay="true"
                          class="emoji-variant-preview"
                        />
                        <img
                          v-else
                          :src="getPngEmojiUrl(emoji, true)"
                          class="emoji-variant-preview"
                          alt=""
                        />
                        <span class="emoji-variant-label">{{ variant.label }}</span>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    {{ getEmojiDescription(emoji) }}
                  </template>
                </div>
              </template>
            </Tooltip>
          </div>
        </template>
      </CustomScrollBar>
      <CustomScrollBar :class="{ 'display-none': !isCustomFacePanel }">
        <div class="message-input-expression-custom-face-panel">
          <QIcon name="add_24" class="add-icon" @click="$emit('select-add-face')"/>
          <template v-if="!customFaces?.length && isLoadingCustomFaces">
            <LoadingSpinner no-text/>
          </template>
          <template v-if="isLoadCustomFacesError">
            加载失败
          </template>
          <template v-else>
            <Tooltip v-for="face in customFaces" :content="face.desc" use-target-slot>
              <template #target>
                <div class="custom-face"
                     :key="face.face_id" @click="$emit('insert-image', face.url, '[动画表情]', 1)"
                     v-custom-menu="handleCustomFaceContextMenu(face)">
                  <img alt="" :src="face.url"/>
                </div>
              </template>
            </Tooltip>
          </template>
        </div>
      </CustomScrollBar>
    </div>
    <div class="message-input-expression-panel-switch">
      <QIcon name="expression_24" class="control-icon" @click="showDefaultPanel"/>
      <QIcon name="like_24" class="control-icon" @click="showCustomFacePanel"/>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tooltip-style.message-input-expression-box {
  height: 350px;
  width: 400px;
  max-height: 100%;
  max-width: 100%;
  padding: 15px 0 0;
  border-radius: $radius-bubble;
  @extend %flex-column;
}

.message-input-expression-panel {
  @extend %flex-fill-hide;
}

.message-input-expression-category-title {
  color: $color-text-muted;
  font-size: 10px;
  margin: 5px 15px;
}

.message-input-expression-category {
  width: 100%;
  gap: 2px;
  padding: 0 15px;
  @include grid-columns-auto-fill(35px);

  &.big {
    @include grid-columns-auto-fill(50px);

    .message-input-expression-emoji-box {
      @include square-size(50px);
    }
  }
}

.message-input-expression-emoji-box {
  @include square-size(35px);
  text-align: center;
  border-radius: $radius-btn;
  @extend %flex-center-children;
  flex-direction: row;
  flex-wrap: nowrap;
}

.message-input-expression-emoji-box:hover {
  background-color: $color-bg-hover-alt;
}

.message-input-expression-emoji-box:active {
  background-color: $color-bg-active-alt;
}

.message-input-expression-emoji-box img {
  @include square-size(80%);
}

.message-input-expression-emoji-box img[data-emoji-animation='static'] {
  display: block;
}

.message-input-expression-emoji-box img[data-emoji-animation='animation'] {
  display: none;
}

.message-input-expression-emoji-box:hover img[data-emoji-animation='static'] {
  display: none;
}

.message-input-expression-emoji-box:hover img[data-emoji-animation='animation'] {
  display: block;
}

.tooltip-style.message-input-expression-emoji-tooltip {
  font-size: 11px;
  padding: 3px;
}

.emoji-variant-tooltip-title {
  font-size: 11px;
  font-weight: 600;
  color: $color-text-primary;
  padding: 2px 4px 6px;
  text-align: center;
  white-space: nowrap;
}

.emoji-variant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  max-width: 210px;
}

.emoji-variant-item {
  width: 90px;
  padding: 4px 2px;
  border-radius: $radius-btn;
  cursor: pointer;
  @extend %flex-column;
  align-items: center;
  gap: 2px;

  &:hover {
    background-color: $color-bg-hover-alt;
  }

  &:active {
    background-color: $color-bg-active-alt;
  }
}

.emoji-variant-preview {
  width: 80px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.emoji-variant-label {
  font-size: 10px;
  color: $color-text-muted;
  white-space: nowrap;
}

.message-input-expression-panel-switch {
  height: 48px;
  @extend %flex-row-center;
  gap: 10px;
  padding: 5px 10px;
  border-top: 1px solid $color-border-light;

  .control-icon {
    @include btn-svg($size: 36px, $padding: 5px, $color: $color-text-primary, $radius: $radius-btn);
  }
}

.message-input-expression-custom-face-panel {
  @include grid-columns-auto-fill(60px);
  gap: 10px;
  padding: 0 15px;

  .add-icon, .custom-face {
    @include square-size(60px);
    @extend %hover-active-bg;
    @include flex-center-children;
    border-radius: $radius-card;
    padding: 2px;

    img {
      max-width: 100%;
      max-height: 100%;
    }
  }

  .add-icon {
    color: $color-text-muted;
    border: 1px dashed $color-text-muted;
    padding: 15px;
  }
}
</style>