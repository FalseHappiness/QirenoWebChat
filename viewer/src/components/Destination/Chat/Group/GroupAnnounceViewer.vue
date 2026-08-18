<script>
import { defineComponent } from 'vue'
import { fetchDeleteGroupNotice, getGroupNoticePicUrl, handleApiRequest } from "@/scripts/backend-api.js";
import { convertMessageTextHTMLSyntax } from "@/scripts/parse-message.js";
import SimplePopUp from "../../../Common/Overlay/SimplePopUp.vue";
import CustomScrollBar from "../../../Common/Scrolling/CustomScrollBar.vue";
import { formatTimeOptions } from "@/scripts/util.js";
import QIcon from "../../../Common/Icons/QIcon.vue";
import { CacheNameKey, fetchDisplayName } from "@/scripts/user-info-util.js";
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue";
import { showConfirmBox } from "@/scripts/popup-box-api.js";
import { Emitter } from "@/composables/useEventBus.js";

export default defineComponent({
  name: "GroupAnnounceViewer",
  components: { SimpleWindow, QIcon, SimplePopUp, CustomScrollBar },
  props: {
    group_id: {
      type: Number,
      required: true
    },
    notices: {
      type: Array,
      default: () => []
    },
    isOperator: {
      type: Boolean,
      default: false
    }
  },
  emits: ["update-group-notice"],
  data() {
    return {
      userNameMap: {}
    }
  },
  watch: {
    notices: {
      handler(newVal) {
        newVal.forEach(async notice => {
          if (!this.userNameMap[notice.sender_id]) {
            this.userNameMap[notice.sender_id] =
              (await fetchDisplayName([this.group_id, notice.sender_id], CacheNameKey.GROUP_USER))?.name
          }
        })
      },
      immediate: true,
      deep: true
    }
  },
  methods: {
    formatTime(timestamp) {
      return formatTimeOptions({
        timestamp,
        delimiter1: "/",
        alwaysMD: false,
        showSecond: false,
        relative: true
      })
    },
    getNoticeImageUrl(picId) {
      return getGroupNoticePicUrl(picId)
    },
    renderText(text) {
      return convertMessageTextHTMLSyntax(text)
    },
    getCachedName(user_id) {
      return this.userNameMap[user_id] || user_id
    },
    async handleDeleteNotice(notice_id) {
      if (await showConfirmBox("确定删除此群公告吗？")) {
        await handleApiRequest(
          fetchDeleteGroupNotice(this.group_id, notice_id),
          "删除成功",
          "删除失败"
        ) && this.updateGroupNotice()
      }
    },
    updateGroupNotice() {
      this.$emit('update-group-notice')
    },
    refreshView() {
      this.updateGroupNotice()
    },
    openNoticeEditor() {
      Emitter.emit('show-group-notice-editor')
    }
  },
})
</script>

<template>
  <SimpleWindow
    class="group-announce-viewer"
    :width="520"
    :height="540"
    title="群公告">
    <div class="gav-controls">
      <QIcon class="gav-control-btn-refresh" name="refresh_24" @click="refreshView"/>
      <div class="gav-control-btn-publish" v-if="isOperator" @click="openNoticeEditor">发布新公告</div>
    </div>
    <CustomScrollBar class="group-announce-viewer-list">
      <div class="group-announce-viewer-notice" v-for="(notice) in notices" :key="notice.notice_id">
        <div class="group-announce-viewer-notice-header">
                <span class="group-announce-viewer-notice-name overflow-ellipsis">{{
                    getCachedName(notice.sender_id)
                  }}</span>
          <span class="group-announce-viewer-notice-time">{{ formatTime(notice.publish_time) }}</span>
          <span class="group-announce-viewer-notice-pinned" v-if="notice.pinned">置顶</span>
          <QIcon class="group-announce-viewer-notice-icon"
                 @click="handleDeleteNotice(notice.notice_id)"
                 v-if="isOperator"
                 name="delete_new_24"/>
        </div>
        <div class="group-announce-viewer-notice-content" v-html="renderText(notice.message.text)">
        </div>
        <div class="group-announce-viewer-notice-images" v-if="notice.message.image?.length">
          <img
            v-for="(img, index) in notice.message.image"
            :key="index"
            :src="getNoticeImageUrl(img.id)"
            alt=""
            class="group-announce-viewer-notice-image"
            :style="{ '--width': img.width, '--height': img.height }"
          >
        </div>
      </div>
      <div class="group-announce-viewer-empty" v-if="!notices.length">
        暂无群公告
      </div>
    </CustomScrollBar>
  </SimpleWindow>
</template>

<style scoped lang="scss">
.group-announce-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.gav-controls {
  @extend %flex-center;
  justify-content: flex-end;
  padding: 5px 4px;
}

.gav-control-btn-refresh {
  @include btn-svg();
  margin: 0 4px;
}

.gav-control-btn-publish {
  @include btn-base;
  @include btn-primary;
  margin: 0 4px;
  padding: 5px 10px;
  border-radius: $radius-btn;
  font-size: 12px;
}

.group-announce-viewer-list {
  flex: 1;
  padding: 0 10px;
  overflow: auto;
}

.group-announce-viewer-notice {
  padding: 12px;
  margin-bottom: 10px;
  background-color: $color-bg-card;
  border-radius: 4px;
  border: 1px solid $color-border-faint;
}

.group-announce-viewer-notice:hover {
  background-color: $color-bg-hover;
}

.group-announce-viewer-notice-header {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: $color-text-muted;
  gap: 4px;
}

.group-announce-viewer-notice-name {
  max-width: 50%;
}

.group-announce-viewer-notice-pinned {
  color: $color-primary;
  background-color: $color-bg-message-out;
  border-radius: 4px;
  padding: 0 4px;
  font-size: 10px;
  margin-left: 2px;
}

.group-announce-viewer-notice-icon {
  margin: 0 5px;
  color: $color-text-muted;
  @include square-size(16px);

  &:hover {
    color: $color-text-primary;
  }
}

.group-announce-viewer-notice-content {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.group-announce-viewer-notice-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.group-announce-viewer-notice-image {
  max-width: 150px;
  max-height: 150px;
  width: auto;
  height: auto;
  aspect-ratio: var(--width) / var(--height);
  object-fit: contain;
  border-radius: 4px;
  cursor: pointer;
}

.group-announce-viewer-empty {
  text-align: center;
  color: $color-text-muted;
  padding: 40px 0;
  font-size: 14px;
}
</style>