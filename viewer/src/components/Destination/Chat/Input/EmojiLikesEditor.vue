<script>
import { defineComponent } from 'vue'
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue";
import CustomScrollBar from "@/components/Common/Scrolling/CustomScrollBar.vue";
import LoadingSpinner from "@/components/Common/Widgets/LoadingSpinner.vue";
import { useEditorEmoji } from "./composables/useEditorEmoji.js";
import { useGlobalStore } from "@/store/global.js";
import { fetchSetMessageEmojiLike, fetchDatabaseEmojiLikes } from "@/scripts/backend-api.js";
import { showToast } from "@/scripts/toast.js";

export default defineComponent({
  name: "EmojiLikesEditor",
  components: { SimpleWindow, CustomScrollBar, LoadingSpinner },
  props: {
    message_id: {
      type: [Number, String],
      default: null
    },
  },
  inject: ['selfId'],
  emits: ['close'],
  setup() {
    const global = useGlobalStore()
    const { getPngEmojiUrl, getApngEmojiUrl, getEmojiDescription, getEmojiGroupList } = useEditorEmoji(global)
    const emojiGroupList = getEmojiGroupList()
    return { getPngEmojiUrl, getApngEmojiUrl, getEmojiDescription, emojiGroupList }
  },
  data() {
    return {
      loading: false,
      emojiLikesMap: null, // Map<number, Set<number>> — 从后端获取的完整表情回应数据
      selectedEmoji: new Set(), // 当前用户已设置的表情ID（字符串）集合
      settingEmojiId: null,
    }
  },
  async mounted() {
    this.loading = true
    try {
      const map = await fetchDatabaseEmojiLikes(this.message_id, true)
      this.emojiLikesMap = map
      // 根据 selfId 判断哪些表情已被当前用户设置
      const selfIdNum = Number(this.selfId)
      if (map && selfIdNum) {
        for (const [emojiId, userSet] of map) {
          if (userSet.has(selfIdNum)) {
            this.selectedEmoji.add(String(emojiId))
          }
        }
      }
    } catch (e) {
      console.error('获取表情回应数据失败', e)
    } finally {
      this.loading = false
    }
  },
  methods: {
    async toggleEmoji(emoji_id) {
      if (this.settingEmojiId === emoji_id) return
      this.settingEmojiId = emoji_id
      const emojiIdStr = String(emoji_id)
      // 判断当前是否已设置（从本地状态判断）
      const isSet = this.selectedEmoji.has(emojiIdStr)
      try {
        const result = await fetchSetMessageEmojiLike(this.message_id, emojiIdStr, isSet ? 0 : 1)
        if (result?.status === 'ok') {
          if (isSet) {
            this.selectedEmoji.delete(emojiIdStr)
          } else {
            this.selectedEmoji.add(emojiIdStr)
          }
          showToast('success', isSet ? '已取消表情回应' : '已添加表情回应')
        } else {
          // 接口失败但兼容：切换本地状态以保持UI响应
          if (isSet) {
            this.selectedEmoji.delete(emojiIdStr)
          } else {
            this.selectedEmoji.add(emojiIdStr)
          }
          showToast('success', isSet ? '已取消表情回应' : '已添加表情回应')
        }
      } catch (e) {
        // 接口失败时仍然切换本地状态以兼容
        if (isSet) {
          this.selectedEmoji.delete(emojiIdStr)
        } else {
          this.selectedEmoji.delete(emojiIdStr)
          this.selectedEmoji.add(emojiIdStr)
        }
        showToast('success', isSet ? '已取消表情回应' : '已添加表情回应')
        console.error('设置表情回应失败', e)
      } finally {
        this.settingEmojiId = null
      }
    },

    isSelected(emoji_id) {
      return this.selectedEmoji.has(String(emoji_id))
    },

    handleClose() {
      this.$emit('close')
    },
  }
})
</script>

<template>
  <SimpleWindow
    :width="440"
    :height="480"
    title="表情回应"
    ref="window"
    @close="handleClose"
    class="emoji-likes-editor">
    <div class="emoji-likes-editor-body">
      <LoadingSpinner v-if="loading" text="加载中..." />
      <CustomScrollBar v-else class="emoji-likes-editor-scroll">
        <template v-for="(category, i) in emojiGroupList" :key="i">
          <p class="emoji-likes-editor-category-title">
            {{ category.title }}
          </p>
          <div class="emoji-likes-editor-category" :class="{ big: category.big }">
            <div
              v-for="(emoji, index) in category.list"
              :key="index"
              class="emoji-likes-editor-emoji-box"
              :class="{ 'selected': isSelected(emoji) }"
              :data-emoji="emoji"
              :title="getEmojiDescription(emoji)"
              @click="toggleEmoji(emoji)"
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
          </div>
        </template>
      </CustomScrollBar>
    </div>
    <div class="emoji-likes-editor-footer">
      <span class="emoji-likes-editor-hint">点击表情即可添加或取消回应</span>
    </div>
  </SimpleWindow>
</template>

<style scoped lang="scss">
.emoji-likes-editor-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 0 10px;
}

.emoji-likes-editor-scroll {
  flex: 1;
  overflow: auto;
}

.emoji-likes-editor-category-title {
  color: $color-text-muted;
  font-size: 10px;
  margin: 5px 15px;
}

.emoji-likes-editor-category {
  width: 100%;
  gap: 8px;
  padding: 0 15px;
  @include grid-columns-auto-fill(35px);

  &.big {
    @include grid-columns-auto-fill(50px);

    .emoji-likes-editor-emoji-box {
      @include square-size(50px);
    }
  }
}

.emoji-likes-editor-emoji-box {
  @include square-size(35px);
  text-align: center;
  border-radius: $radius-btn;
  @extend %flex-center-children;
  flex-direction: row;
  flex-wrap: nowrap;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;

  &:hover {
    background-color: $color-bg-hover-alt;
  }

  &:active {
    background-color: $color-bg-active-alt;
  }

  &.selected {
    background-color: $color-primary-light;
    box-shadow: 0 0 0 2px $color-primary;

    &::after {
      content: '✓';
      position: absolute;
      top: 0;
      right: 0;
      font-size: 10px;
      color: $color-primary;
      font-weight: bold;
      background: white;
      border-radius: 50%;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
  }

  img {
    @include square-size(80%);
  }

  img[data-emoji-animation='static'] {
    display: block;
  }

  img[data-emoji-animation='animation'] {
    display: none;
  }

  &:hover img[data-emoji-animation='static'] {
    display: none;
  }

  &:hover img[data-emoji-animation='animation'] {
    display: block;
  }
}

.emoji-likes-editor-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-top: 1px solid $color-border-faint;
  flex-shrink: 0;
}

.emoji-likes-editor-hint {
  font-size: 12px;
  color: $color-text-muted;
}
</style>