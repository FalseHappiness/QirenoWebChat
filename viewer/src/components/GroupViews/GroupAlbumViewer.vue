<script>
import { defineComponent } from 'vue'
import { fetchGroupAlbumList, fetchGroupAlbumMediaList } from "../../scripts/backend-api.js"
import { formatTimeOptions } from "../../scripts/util.js"
import CustomScrollBar from "../Utils/CustomScrollBar.vue"
import SimplePopUp from "../Utils/SimplePopUp.vue"
import { showInfoToast } from "../../scripts/toast.js";
import ImageViewer from "../Utils/ImageViewer.vue";
import VideoPlayer from "../Utils/VideoPlayer.vue";
import QIcon from "../Utils/QIcon.vue";

export default defineComponent({
  name: "GroupAlbumViewer",
  components: { QIcon, CustomScrollBar, SimplePopUp, ImageViewer, VideoPlayer },
  props: {
    group_id: { type: [Number, String], required: true },
    onClose: {
      type: Function, default: () => {
      }
    }
  },
  data() {
    return {
      // 当前视图: 'albums' | 'media' | 'detail'
      view: 'albums',

      // 相册列表
      albums: [],
      albumsAttachInfo: '',
      albumsHasMore: false,
      loadingAlbums: false,
      loadingMoreAlbums: false,

      // 当前相册 & 媒体列表
      currentAlbum: null,
      mediaList: [],
      mediaAttachInfo: '',
      mediaHasMore: false,
      loadingMedia: false,
      loadingMoreMedia: false,

      // 媒体详情
      currentMediaIndex: 0,
      detailClosing: false,

      // 保存滚动位置
      savedAlbumScrollTop: 0,
      savedMediaScrollTop: 0,

      // 滚动监听器
      albumScrollEl: null,
      mediaScrollEl: null,
    }
  },
  computed: {
    /** 按天分组的媒体列表（upload_time大的在前，同一天内也按upload_time大的在前） */
    groupedMedia() {
      const groups = []
      let currentGroup = null
      for (const media of this.mediaList) {
        const date = this.formatDateOnly(media.upload_time)
        if (!currentGroup || currentGroup.date !== date) {
          currentGroup = { date, items: [] }
          groups.push(currentGroup)
        }
        currentGroup.items.push(media)
      }
      return groups
    },
    /** 当前查看的媒体 */
    currentMedia() {
      return this.mediaList[this.currentMediaIndex] || null
    },
    // 媒体计数器文本
    counterText() {
      return `${(this.currentMediaIndex || 0) + 1} / ${this.currentAlbum?.upload_number || this.mediaList?.length}`
    }
  },
  methods: {
    /* ========== 格式化工具 ========== */
    formatDateOnly(timestamp) {
      if (!timestamp) return ''
      const date = new Date(parseInt(timestamp) * 1000)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },

    formatDateTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(parseInt(timestamp) * 1000)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    },

    formatDateLabel(timestamp) {
      if (!timestamp) return ''
      const date = new Date(parseInt(timestamp) * 1000)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const diffDays = Math.floor((today - target) / (86400000))
      if (diffDays === 0) return '今天'
      if (diffDays === 1) return '昨天'
      if (diffDays < 7) return `${diffDays}天前`
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${date.getFullYear()}年${month}月${day}日`
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      return formatTimeOptions({
        timestamp: parseInt(timestamp),
        alwaysMD: false,
        showSecond: false,
        relative: true,
        showHm: false
      })
    },

    /* ========== URL 提取 ========== */

    /** 获取相册封面（中等质量） */
    getCoverUrl(album) {
      if (!album.cover || !album.cover.image) return null
      const image = album.cover.image
      if (image.photo_url && image.photo_url.length) {
        for (const spec of [2, 5]) {
          const found = image.photo_url.find(p => p.spec === spec && p.url && p.url.url)
          if (found && found.url && found.url.url) return found.url.url
        }
        for (const p of image.photo_url) {
          if (p.url && p.url.url) return p.url.url
        }
      }
      if (image.default_url && image.default_url.url) return image.default_url.url
      return null
    },

    /** 获取媒体最高质量图（spec 1=800px 或 6=原图） */
    getHighestQualityUrl(media) {
      if (media.type === 0 && media.image) {
        const image = media.image
        if (image.photo_url && image.photo_url.length) {
          for (const spec of [1, 6]) {
            const found = image.photo_url.find(p => p.spec === spec && p.url && p.url.url)
            if (found && found.url && found.url.url) return found.url.url
          }
          for (const p of image.photo_url) {
            if (p.url && p.url.url) return p.url.url
          }
        }
        if (image.default_url && image.default_url.url) return image.default_url.url
      }
      return null
    },

    /** 获取视频封面 */
    getVideoCoverUrl(media) {
      if (media.type === 1 && media.video && media.video.cover) {
        const cover = media.video.cover
        if (cover.photo_url && cover.photo_url.length) {
          for (const spec of [2, 5]) {
            const found = cover.photo_url.find(p => p.spec === spec && p.url && p.url.url)
            if (found && found.url && found.url.url) return found.url.url
          }
          for (const p of cover.photo_url) {
            if (p.url && p.url.url) return p.url.url
          }
        }
        if (cover.default_url && cover.default_url.url) return cover.default_url.url
      }
      return null
    },

    /** 获取视频播放地址 */
    getVideoUrl(media) {
      if (media.type === 1 && media.video) {
        if (media.video.url) return media.video.url
        if (media.video.video_url && media.video.video_url.length) {
          const first = media.video.video_url[0]
          return first.url || (first.url && first.url.url)
        }
        if (media.video.videoUrls && media.video.videoUrls.length) {
          const first = media.video.videoUrls[0]
          return first.url || (first.url && first.url.url)
        }
      }
      return null
    },

    /** 获取媒体列表项缩略图 */
    getMediaThumbUrl(media) {
      if (media.type === 0) {
        return this.getMediumQualityUrl(media.image)
      } else if (media.type === 1) {
        return this.getVideoCoverUrl(media)
      }
      return null
    },

    /** 获取中等质量图 */
    getMediumQualityUrl(image) {
      if (!image) return null
      if (image.photo_url && image.photo_url.length) {
        for (const spec of [2, 5]) {
          const found = image.photo_url.find(p => p.spec === spec && p.url && p.url.url)
          if (found && found.url && found.url.url) return found.url.url
        }
        for (const p of image.photo_url) {
          if (p.url && p.url.url) return p.url.url
        }
      }
      if (image.default_url && image.default_url.url) return image.default_url.url
      return null
    },

    /** 处理图片加载失败 - 显示无封面 */
    handleImgError(event) {
      const el = event.target
      if (el) {
        el.style.display = 'none'
        const parent = el.parentNode
        if (parent) {
          // 尝试找到兄弟节点中的 .gav-no-cover
          const noCover = parent.querySelector('.gav-no-cover')
          if (noCover) {
            noCover.style.display = 'flex'
          }
        }
      }
    },

    /* ========== 数据加载 ========== */
    async loadAlbums(loadMore = false) {
      if (loadMore) {
        if (this.loadingMoreAlbums || !this.albumsHasMore) return
        this.loadingMoreAlbums = true
      } else {
        if (this.loadingAlbums) return
        this.loadingAlbums = true
      }
      try {
        const attachInfo = loadMore && this.albumsAttachInfo ? this.albumsAttachInfo : undefined
        const data = await fetchGroupAlbumList(this.group_id, attachInfo)
        const newAlbums = data.album_list || []
        if (loadMore) {
          // 下一页是更旧的，追加到末尾
          this.albums = this.albums.concat(newAlbums)
        } else {
          this.albums = newAlbums
        }
        this.albumsAttachInfo = data.attach_info || ''
        this.albumsHasMore = !!data.has_more
      } catch (e) {
        console.error('加载相册列表失败:', e)
      } finally {
        this.loadingAlbums = false
        this.loadingMoreAlbums = false
      }
    },

    async loadMedia(album, loadMore = false) {
      if (loadMore) {
        if (this.loadingMoreMedia || !this.mediaHasMore) return
        this.loadingMoreMedia = true
      } else {
        if (this.loadingMedia) return
        this.loadingMedia = true
      }
      try {
        const attachInfo = loadMore && this.mediaAttachInfo ? this.mediaAttachInfo : undefined
        const data = await fetchGroupAlbumMediaList(this.group_id, album.album_id, attachInfo)
        const newMedia = data.media_list || []
        if (loadMore) {
          this.mediaList = this.mediaList.concat(newMedia)
        } else {
          this.mediaList = newMedia
        }
        this.mediaAttachInfo = data.next_attach_info || ''
        this.mediaHasMore = !!data.next_has_more
      } catch (e) {
        console.error('加载相册媒体列表失败:', e)
      } finally {
        this.loadingMedia = false
        this.loadingMoreMedia = false
      }
    },

    /* ========== 视图切换 ========== */
    enterAlbum(album) {
      this.saveAlbumScrollPosition()
      this.currentAlbum = album
      this.mediaList = []
      this.mediaAttachInfo = ''
      this.mediaHasMore = false
      this.currentMediaIndex = 0
      this.view = 'media'
      this.$nextTick(() => {
        this.loadMedia(album)
      })
    },

    goBackToAlbums() {
      this.view = 'albums'
      this.currentAlbum = null
      this.mediaList = []
      this.$nextTick(() => {
        this.restoreAlbumScrollPosition()
      })
    },

    enterDetail(index) {
      this.saveMediaScrollPosition()
      this.currentMediaIndex = index
      this.view = 'detail'
    },

    goBackToMedia() {
      if (this.detailClosing) return
      this.detailClosing = true
      setTimeout(() => {
        this.view = 'media'
        this.detailClosing = false
        this.$nextTick(() => {
          this.restoreMediaScrollPosition()
        })
      }, 300)
    },

    prevMedia() {
      if (this.currentMediaIndex > 0) {
        this.currentMediaIndex--
      }
    },

    nextMedia() {
      if (this.currentMediaIndex < this.mediaList.length - 1) {
        this.currentMediaIndex++
        if (this.mediaHasMore && !this.loadingMoreMedia) {
          if (this.currentMediaIndex + 5 >= this.mediaList.length) {
            this.loadMedia(this.currentAlbum, true)
          }
        }
      } else if (this.loadingMoreMedia) {
        showInfoToast('加载中')
      }
    },

    /* ========== 滚动位置管理 ========== */

    getScrollElement(ref) {
      if (!ref) return null
      if (ref.getScrollElement) return ref.getScrollElement()
      if (ref.$el) {
        return ref.$el.querySelector('.simplebar-content-wrapper') || ref.$el
      }
      return ref.querySelector ? (ref.querySelector('.simplebar-content-wrapper') || ref) : ref
    },

    saveAlbumScrollPosition() {
      const el = this.getScrollElement(this.$refs.albumScroller)
      if (el) this.savedAlbumScrollTop = el.scrollTop
    },

    saveMediaScrollPosition() {
      const el = this.getScrollElement(this.$refs.mediaScroller)
      if (el) this.savedMediaScrollTop = el.scrollTop
    },

    restoreAlbumScrollPosition() {
      this.$nextTick(() => {
        const el = this.getScrollElement(this.$refs.albumScroller)
        if (el && this.savedAlbumScrollTop) {
          el.scrollTop = this.savedAlbumScrollTop
        }
      })
    },

    restoreMediaScrollPosition() {
      this.$nextTick(() => {
        const el = this.getScrollElement(this.$refs.mediaScroller)
        if (el && this.savedMediaScrollTop) {
          el.scrollTop = this.savedMediaScrollTop
        }
      })
    },

    /* ========== 无限滚动 ========== */
    onAlbumScroll(e) {
      const el = e?.target;
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight - scrollTop - clientHeight < 200 && this.albumsHasMore && !this.loadingMoreAlbums) {
        this.loadAlbums(true)
      }
    },

    onMediaScroll(e) {
      const el = e?.target;
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight - scrollTop - clientHeight < 200 && this.mediaHasMore && !this.loadingMoreMedia) {
        this.loadMedia(this.currentAlbum, true)
      }
    },

    /* ========== 其他 ========== */
    close() {
      this.$refs.popUp.confirm(false)
    },

    onKeydown(e) {
      if (this.view === 'detail') {
        if (e.key === 'ArrowLeft') {
          this.prevMedia()
          e.preventDefault()
        } else if (e.key === 'ArrowRight') {
          this.nextMedia()
          e.preventDefault()
        } else if (e.key === 'Escape') {
          this.goBackToMedia()
          e.preventDefault()
        }
      }
    }
  },
  mounted() {
    this.loadAlbums()
    document.addEventListener('keydown', this.onKeydown)
  },
  unmounted() {
    document.removeEventListener('keydown', this.onKeydown)
  }
})
</script>

<template>
  <div class="group-album-viewer">
    <SimplePopUp ref="popUp"
                 :on-confirm="onClose"
                 :on-cancel="onClose"
                 :container-styles="$style['group-album-viewer-container']">
      <template #default>
        <!-- ===== 相册列表视图 ===== -->
        <template v-if="view === 'albums'">
          <div class="gav-title">
            群相册
            <QIcon name="close_fill_24" class="gav-close-btn cannot-drag"
                   @click="close"/>
          </div>
          <CustomScrollBar ref="albumScroller" class="gav-scroll" @scroll="onAlbumScroll">
            <div v-if="loadingAlbums && !albums.length" class="gav-loading">加载中...</div>
            <div v-else-if="!albums.length" class="gav-empty">暂无相册</div>
            <div v-else class="gav-grid">
              <div v-for="album in albums" :key="album.album_id" class="gav-grid-item"
                   @click="enterAlbum(album)">
                <div class="gav-grid-item-cover">
                  <img v-if="getCoverUrl(album)" :src="getCoverUrl(album)" alt=""
                       class="gav-grid-item-img" loading="lazy"
                       @error="handleImgError">
                  <div v-else class="gav-no-cover">无封面</div>
                  <div v-if="album.upload_number && parseInt(album.upload_number) > 0"
                       class="gav-grid-item-count">
                    {{ album.upload_number }}
                  </div>
                </div>
                <div class="gav-grid-item-info">
                  <div class="gav-grid-item-name overflow-ellipsis">{{ album.name || '未命名相册' }}</div>
                  <div class="gav-grid-item-meta">
                    {{ album.upload_number || 0 }} 张
                    <template v-if="album.last_upload_time && parseInt(album.last_upload_time) > 0">
                      · {{ formatTime(album.last_upload_time) }}
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="loadingMoreAlbums" class="gav-loading-more">加载更多...</div>
          </CustomScrollBar>
        </template>

        <!-- ===== 媒体列表视图（详情视图时保持显示作为背景） ===== -->
        <template v-if="view === 'media' || view === 'detail'">
          <div class="gav-title">
            <QIcon name="arrow_left_24" class="gav-back-btn cannot-drag"
                   @click="goBackToAlbums"/>
            {{ (currentAlbum && currentAlbum.name) || '相册' }}
            <QIcon name="close_fill_24" class="gav-close-btn cannot-drag"
                   @click="close"/>
          </div>
          <CustomScrollBar ref="mediaScroller" class="gav-scroll" @scroll="onMediaScroll">
            <div v-if="loadingMedia && !mediaList.length" class="gav-loading">加载中...</div>
            <div v-else-if="!mediaList.length" class="gav-empty">暂无内容</div>
            <template v-else>
              <div v-for="group in groupedMedia" :key="group.date" class="gav-media-group">
                <div class="gav-media-date-header">{{ formatDateLabel(group.items[0].upload_time) }}</div>
                <div class="gav-grid">
                  <div v-for="(media, idx) in group.items" :key="media.batch_id + '-' + media.upload_time"
                       class="gav-grid-item" @click="enterDetail(mediaList.indexOf(media))">
                    <div class="gav-grid-item-cover">
                      <img v-if="getMediaThumbUrl(media)" :src="getMediaThumbUrl(media)" alt=""
                           class="gav-grid-item-img" loading="lazy"
                           @error="handleImgError">
                      <div v-else class="gav-no-cover">加载失败</div>
                      <div v-if="media.type === 1" class="gav-video-badge">
                        <QIcon name="play_fill_24" class="gav-play-icon"/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <div v-if="loadingMoreMedia" class="gav-loading-more">加载更多...</div>
          </CustomScrollBar>
        </template>

        <!-- ===== 媒体详情视图 - 图片使用 ImageViewer ===== -->
        <ImageViewer v-if="view === 'detail' && currentMedia && currentMedia.type === 0"
                     :imageUrl="getHighestQualityUrl(currentMedia) || ''"
                     :showLeftArrow="currentMediaIndex > 0"
                     :showRightArrow="currentMediaIndex < (currentAlbum.upload_number || mediaList.length) - 1"
                     :counterText="counterText"
                     @click-left="prevMedia"
                     @click-right="nextMedia"
                     @close="goBackToMedia"/>

        <!-- ===== 媒体详情视图 - 视频使用 VideoPlayer ===== -->
        <VideoPlayer v-if="view === 'detail' && currentMedia && currentMedia.type === 1"
                     :videoUrl="getVideoUrl(currentMedia) || ''"
                     :showLeftArrow="currentMediaIndex > 0"
                     :showRightArrow="currentMediaIndex < (currentAlbum.upload_number || mediaList.length) - 1"
                     :counterText="counterText"
                     @click-left="prevMedia"
                     @click-right="nextMedia"
                     @close="goBackToMedia"/>
      </template>
    </SimplePopUp>
  </div>
</template>

<style scoped>
/* ===== 通用 ===== */
.gav-title {
  text-align: center;
  font-size: 16px;
  padding: 0 0 2px 0;
  border-bottom: 1px solid #EDEDED;
  user-select: none;
  position: relative;
  line-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gav-close-btn {
  width: 20px;
  height: 20px;
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
}

.gav-back-btn {
  width: 20px;
  height: 20px;
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
}

.gav-scroll {
  flex: 1;
  overflow: auto;
  padding: 8px 16px 16px;
}

.gav-loading,
.gav-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
  font-size: 14px;
}

.gav-loading-more {
  text-align: center;
  color: #999;
  padding: 12px 0;
  font-size: 13px;
}

/* ===== 网格 ===== */
.gav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.gav-grid-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #f0f0f0;
  transition: box-shadow 0.2s, transform 0.15s;
}

.gav-grid-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* 固定宽高比例容器 - 1:1 正方形 */
.gav-grid-item-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #f5f5f5;
}

.gav-grid-item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gav-no-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #bbb;
  font-size: 13px;
  background: #f5f5f5;
}

.gav-grid-item-count {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  line-height: 16px;
}

.gav-video-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gav-play-icon {
  width: 18px;
  height: 18px;
  color: white;
  margin-left: 2px;
}

.gav-grid-item-info {
  padding: 6px 8px 8px;
}

.gav-grid-item-name {
  font-size: 13px;
  color: #333;
  line-height: 1.4;
  max-height: 2.8em;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.gav-grid-item-meta {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

/* ===== 媒体按天分组 ===== */
.gav-media-group {
  margin-bottom: 12px;
}

.gav-media-date-header {
  font-size: 13px;
  color: #888;
  padding: 8px 0 6px;
  font-weight: 500;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}

/* ===== 响应式 ===== */
@media (max-width: 480px) {
  .gav-scroll {
    padding: 6px 8px 12px;
  }

  .gav-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
  }

  .gav-grid-item-name {
    font-size: 12px;
  }

  .gav-grid-item-meta {
    font-size: 10px;
  }

}
</style>

<style module>
.group-album-viewer-container {
  width: 900px;
  height: 700px;
  padding: 4px 2px;
  max-width: calc(100% - 20px);
  max-height: calc(100% - 20px);
  background-color: #FAFAFA;
  position: relative;
  overflow: hidden;
}

@media (max-width: 480px) {
  .group-album-viewer-container {
    max-width: 100%;
    max-height: 100%;
    height: 100%;
    width: 100%;
    border-radius: 0;
  }
}
</style>