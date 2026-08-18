<script>
import { fetchCollectionList, getUserLogo } from "@/scripts/backend-api.js";
import { formatTimeOptions } from "@/scripts/util.js";
import { Emitter } from "@/composables/useEventBus.js";
import { qqFileIcon } from "@/composables/useBase.js";
import { getFileIcon } from "@/components/Destination/Chat/Message/Types/FileMessage.vue";
import LoadingSpinner from "@/components/Common/Widgets/LoadingSpinner.vue";

export default {
  name: "CollectionView",
  components: { LoadingSpinner },
  data() {
    return {
      activeCategory: null,
      loading: false,
      error: null,
      collectionList: [],
    }
  },
  computed: {
    isEmpty() {
      return !this.loading && !this.error && this.collectionList.length === 0
    },
  },
  methods: {
    async loadCollectionList() {
      if (!this.activeCategory) {
        this.collectionList = []
        return
      }
      this.loading = true
      this.error = null
      try {
        this.collectionList = await fetchCollectionList(0)
      } catch (e) {
        console.error("获取收藏列表失败:", e)
        this.error = "获取收藏列表失败"
        this.collectionList = []
      } finally {
        this.loading = false
      }
    },
    getAvatarUrl(userId) {
      return getUserLogo(userId)
    },
    formatTime(timestamp) {
      if (!timestamp) return ''
      // 收藏时间戳是毫秒级，formatTimeOptions 期望秒级
      const ts = Number(timestamp)
      if (isNaN(ts)) return ''
      return formatTimeOptions({
        timestamp: Math.floor(ts / 1000),
        delimiter1: "/",
        showSecond: false,
        relative: true
      })
    },
    getAuthorName(item) {
      return item.author?.strId || item.author?.numId || "未知"
    },
    getAuthorId(item) {
      return item.author?.numId || ""
    },
    getGroupName(item) {
      return item.author?.groupName || ""
    },
    getItemTypeLabel(item) {
      switch (item.type) {
        case 6:
          return "文件"
        case 8:
          return "图文"
        default:
          return "收藏"
      }
    },
    getFileName(item) {
      return item.summary?.fileSummary?.first?.field5 || ""
    },
    getFileIconUrl(item) {
      const name = this.getFileName(item)
      if (!name) return ''
      return qqFileIcon(getFileIcon(name))
    },
    getPicList(item) {
      return item.summary?.richMediaSummary?.picList || []
    },
    getRichBrief(item) {
      return item.summary?.richMediaSummary?.brief || ""
    },
    isRichMediaWithContent(item) {
      return item.type === 8 && (
        this.getRichBrief(item) ||
        this.getPicList(item).length > 0
      )
    },
    isFileItem(item) {
      return item.type === 6 || !!item.summary?.fileSummary
    },
    changeCollectionActiveCategory(key) {
      this.activeCategory = key
      this.loadCollectionList()
    },
  },
  mounted() {
    Emitter.on("change-collection-active-category", this.changeCollectionActiveCategory);
  },
  unmounted() {
    Emitter.off("change-collection-active-category", this.changeCollectionActiveCategory);
  }
}
</script>

<template>
  <div class="collection-view">
    <template v-if="activeCategory">
      <!-- 加载状态 -->
      <div v-if="loading" class="collection-view-loading">
        <LoadingSpinner text="加载中..."/>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="collection-view-error">
        <span class="collection-view-error-text">{{ error }}</span>
        <button class="collection-view-retry-btn" @click="loadCollectionList">重试</button>
      </div>

      <!-- 空状态 -->
      <div v-else-if="isEmpty" class="collection-view-empty">
        暂无收藏
      </div>

      <!-- 收藏列表 -->
      <div v-else class="collection-view-list">
        <div
          v-for="(item, index) in collectionList"
          :key="item.cid || index"
          class="collection-view-item"
        >
          <!-- 作者信息头部 -->
          <div class="collection-view-item-header">
            <div class="collection-view-item-header-left">
              <img
                :src="getAvatarUrl(getAuthorId(item))"
                alt=""
                class="collection-view-item-avatar"
                @error="($event.target.src = '')"
              >
              <div class="collection-view-item-header-info">
              <span class="collection-view-item-sender-name overflow-ellipsis">
                {{ getAuthorName(item) }}
              </span>
                <span class="collection-view-item-group-name overflow-ellipsis" v-if="getGroupName(item)">
                {{ getGroupName(item) }}
              </span>
              </div>
            </div>
            <span class="collection-view-item-time">{{ formatTime(item.createTime) }}</span>
          </div>

          <!-- 收藏内容 -->
          <div class="collection-view-item-content">
            <!-- 文件类型 -->
            <template v-if="isFileItem(item)">
              <div class="collection-view-file-preview">
                <img
                  :src="getFileIconUrl(item)"
                  alt=""
                  class="collection-view-file-icon"
                  @error="($event.target.src = '/QQ/fileIcon/unknown.png')"
                >
                <span class="collection-view-file-name overflow-ellipsis">{{ getFileName(item) }}</span>
              </div>
            </template>

            <!-- 图文类型 -->
            <template v-else-if="isRichMediaWithContent(item)">
              <!-- 图片预览 -->
              <div v-if="getPicList(item).length > 0" class="collection-view-image-grid">
                <div
                  v-for="(pic, picIndex) in getPicList(item).slice(0, 4)"
                  :key="picIndex"
                  class="collection-view-image-item"
                >
                  <img
                    :src="pic.url"
                    alt=""
                    class="collection-view-image"
                    @error="($event.target.src = '')"
                  >
                </div>
              </div>
              <!-- 文字摘要 -->
              <div v-if="getRichBrief(item)" class="collection-view-text-brief">
                {{ getRichBrief(item) }}
              </div>
            </template>

            <!-- 降级显示 -->
            <template v-else>
            <span class="collection-view-item-fallback">
              [{{ getItemTypeLabel(item) }}]
            </span>
            </template>
          </div>

          <!-- 底部元信息 -->
          <div class="collection-view-item-footer">
            <span class="collection-view-item-type-tag">{{ getItemTypeLabel(item) }}</span>
            <span class="collection-view-item-collect-time">收藏时间: {{ formatTime(item.collectTime) }}</span>
          </div>
        </div>
      </div>
    </template>
    <h3 v-else class="size-100 flex-center-children text-muted font-size-100">
      请选择收藏分类
    </h3>
  </div>
</template>

<style scoped lang="scss">
.collection-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $color-bg-page;
}

// ---- 加载状态 ----
.collection-view-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

// ---- 错误状态 ----
.collection-view-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.collection-view-error-text {
  color: $color-text-warning;
  font-size: 14px;
}

.collection-view-retry-btn {
  @include btn-secondary;
  padding: 6px 16px;
  font-size: 13px;
}

// ---- 空状态 ----
.collection-view-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-muted;
  font-size: 14px;
}

// ---- 收藏列表 ----
.collection-view-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.collection-view-item {
  background: $color-bg-card;
  border-radius: $radius-card;
  padding: 12px;
  border: 1px solid $color-border-faint;
  transition: box-shadow $transition-fast;

  &:hover {
    box-shadow: $shadow-card;
  }
}

// ---- 头部 ----
.collection-view-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.collection-view-item-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.collection-view-item-avatar {
  width: 36px;
  height: 36px;
  border-radius: $radius-circle;
  flex-shrink: 0;
  object-fit: cover;
  background: $color-bg-image-placeholder;
}

.collection-view-item-header-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.collection-view-item-sender-name {
  font-size: 14px;
  font-weight: 500;
  color: $color-text-regular;
}

.collection-view-item-group-name {
  font-size: 11px;
  color: $color-text-meta;
}

.collection-view-item-time {
  font-size: 11px;
  color: $color-text-muted;
  flex-shrink: 0;
  align-self: flex-start;
}

// ---- 内容区域 ----
.collection-view-item-content {
  padding: 4px 0;
}

// 文件预览
.collection-view-file-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: $color-bg-page;
  border-radius: $radius-sm;
}

.collection-view-file-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  object-fit: contain;
}

.collection-view-file-name {
  font-size: 13px;
  color: $color-text-regular;
  flex: 1;
  min-width: 0;
}

// 图片网格
.collection-view-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 4px;
  margin-bottom: 8px;
  max-width: 340px;
}

.collection-view-image-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: $radius-sm;
  background: $color-bg-image-placeholder;
}

.collection-view-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

// 文字内容
.collection-view-text-brief {
  font-size: 13px;
  line-height: 1.5;
  //@include multi-line-ellipsis(3);
  white-space: pre-wrap;
  word-break: break-word;
}

// 降级显示
.collection-view-item-fallback {
  color: $color-text-muted;
  font-size: 13px;
  font-style: italic;
}

// ---- 底部 ----
.collection-view-item-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid $color-border-faint;
}

.collection-view-item-type-tag {
  font-size: 11px;
  color: $color-text-white;
  background: $color-primary;
  padding: 1px 6px;
  border-radius: 3px;
  line-height: 16px;
}

.collection-view-item-collect-time {
  font-size: 11px;
  color: $color-text-muted;
  margin-left: auto;
}
</style>