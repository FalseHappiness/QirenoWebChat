<script>
import { defineComponent } from 'vue'
import { getFileIcon, formatFileSize } from "../Message/Types/FileMessage.vue";
import TruncatedText from "../../../Common/Widgets/TruncatedText.vue";
import SimpleBar from "simplebar-vue";
import 'simplebar-vue/dist/simplebar.min.css';
import SimplePopUp from "../../../Common/Overlay/SimplePopUp.vue";
import CustomScrollBar from "../../../Common/Scrolling/CustomScrollBar.vue";
import { qqFileIcon } from "@/composables/useBase.js";
import QIcon from "../../../Common/Icons/QIcon.vue";
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue";

export default defineComponent({
  name: "FilesUploadTasksViewer",
  components: { SimpleWindow, QIcon, CustomScrollBar, SimplePopUp, SimpleBar, TruncatedText },
  props: {
    tasks: {
      type: Array,
      required: true
    },
  },
  methods: {
    qqFileIcon,
    getFileIcon: getFileIcon,
    formatFileSize: formatFileSize,
    cancelTask(task) {
      if (task.controller && !task.controller.signal.aborted) {
        task.controller.abort()
      }
    },
    /**
     * 计算单个任务已上传的字节数
     * 对于分片上传：chunk_index * chunk_size
     * 对于普通上传：如果已完成则为 file.size，否则为 0（无法追踪进度）
     */
    getTaskUploadedBytes(task) {
      if (task.chunked && task.chunk_index !== undefined && task.chunk_size !== undefined) {
        return task.chunk_index * task.chunk_size
      }
      // 非分片上传，如果已取消或已完成则显示全部
      if (task.controller?.signal?.aborted) {
        return 0
      }
      return 0
    },
    /**
     * 判断任务是否已完成（所有分片已发送）
     */
    isTaskCompleted(task) {
      return task.completed
    },
    /**
     * 判断任务是否已取消
     */
    isTaskCancelled(task) {
      return task.controller?.signal?.aborted || task?.cancelled
    },
    /**
     * 判断任务是否出错
     */
    isTaskError(task) {
      return task?.error
    },
    /**
     * 计算任务的上传速度 (bytes/ms)
     */
    getTaskSpeed(task) {
      const uploadedBytes = this.getTaskUploadedBytes(task)
      if (uploadedBytes <= 0 || !task.start_timestamp) return 0
      const elapsed = Date.now() - task.start_timestamp
      if (elapsed <= 0) return 0
      return uploadedBytes / elapsed // bytes per ms
    },
    /**
     * 计算任务预计剩余时间 (ms)
     */
    getTaskRemainingTime(task) {
      const speed = this.getTaskSpeed(task)
      if (speed <= 0) return Infinity
      const uploadedBytes = this.getTaskUploadedBytes(task)
      const remaining = task.file.size - uploadedBytes
      if (remaining <= 0) return 0
      return remaining / speed
    },
    /**
     * 获取单个任务进度百分比
     */
    getTaskProgress(task) {
      if (this.isTaskCompleted(task)) return 100
      if (this.isTaskCancelled(task)) return 0
      const uploaded = this.getTaskUploadedBytes(task)
      const total = task.file.size
      if (total <= 0) return 0
      return Math.min(100, (uploaded / total) * 100)
    },
    /**
     * 格式化时间显示
     */
    formatTime(ms) {
      if (!isFinite(ms) || ms <= 0) return ''
      if (ms < 1000) return '1秒'
      const seconds = Math.ceil(ms / 1000)
      if (seconds < 60) return `${ seconds }秒`
      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      if (minutes < 60) return `${ minutes }分${ secs }秒`
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${ hours }时${ mins }分`
    },
    /**
     * 格式化速度显示
     */
    formatSpeed(speedBps) {
      // speedBps 是 bytes/ms，转换为 bytes/s
      const bytesPerSec = speedBps * 1000
      if (bytesPerSec <= 0) return ''
      if (bytesPerSec < 1024) return `${ bytesPerSec.toFixed(1) } B/s`
      if (bytesPerSec < 1024 * 1024) return `${ (bytesPerSec / 1024).toFixed(1) } KB/s`
      return `${ (bytesPerSec / (1024 * 1024)).toFixed(1) } MB/s`
    },
    formatTaskType(task) {
      const type = task.type || 'file'
      const { attachInfo } = task
      if (type === 'file') {
        if (attachInfo?.flash) {
          return "闪传文件-文件集：" + attachInfo.flash_name
        }
        return task.contact.type === 'group' ? "群文件" : "文件"
      } else if (["image", "video"].includes(type) && attachInfo) {
        return "群相片"
      }
      return ({
        record: "语音消息",
        image: "图片",
        video: "视频",
        face: "自定义表情",
        flashtransfer: "闪传文件集"
      })[type] || "文件"
    }
  }
})
</script>

<template>
  <SimpleWindow
    class="files-upload-tasks-viewer"
    title="文件上传任务"
    :width="450"
    :height="500"
    background-color="var(--color-bg-card)"
  >
    <!-- 任务列表 -->
    <CustomScrollBar class="files-upload-tasks-list">
      <div class="files-upload-tasks-item" v-for="(task, index) in tasks" :key="`${index}-${task?.chunk_index}`">
        <QIcon name="fast_folder_new_24" v-if="task.type === 'flashtransfer'"
               style="color: #0099ff;" class="files-upload-tasks-item-icon"/>
        <img v-else alt="" :src="qqFileIcon(getFileIcon(task.file.name))"
             class="files-upload-tasks-item-icon">
        <div class="files-upload-tasks-item-info">
          <TruncatedText one-line :content="task.file.name"/>
          <div class="files-upload-tasks-item-type">类型: {{ formatTaskType(task) }}</div>
          <div class="files-upload-tasks-item-status">
            <!-- 出错 -->
            <template v-if="isTaskError(task)">
              <span class="status-error">出错: {{ task.error }}</span>
            </template>
            <!-- 已取消 -->
            <template v-else-if="isTaskCancelled(task)">
              <span class="status-cancelled">已取消</span>
            </template>
            <!-- 已完成 -->
            <template v-else-if="isTaskCompleted(task)">
              <span class="status-completed">已完成</span>
            </template>
            <!-- 计算 Hash 中 -->
            <template v-else-if="task.is_calc_hash">
              <span class="status-hashing">计算 SHA256 中...</span>
            </template>
            <!-- 合并文件中 -->
            <template v-else-if="task.is_merging">
              <span class="status-hashing">合并分片中...</span>
            </template>
            <!-- 合并文件中 -->
            <template v-else-if="task.is_backend_uploading">
              <span class="status-hashing">后端上传中...</span>
            </template>
            <!-- 转换图片中 -->
            <template v-else-if="task.is_converting_image">
              <span class="status-hashing">转换图片中...</span>
            </template>
            <!-- 等待文件上传后端 -->
            <template v-else-if="task.is_preparing_files">
              <span class="status-hashing">等待文件上传后端中...</span>
            </template>
            <!-- 分片上传中 -->
            <template v-else-if="task.chunked">
                    <span class="status-uploading">
                      {{ formatFileSize(getTaskUploadedBytes(task)) }} / {{ formatFileSize(task.file.size) }}
                    </span>
              <span class="status-speed" v-if="getTaskSpeed(task) > 0">
                      {{ formatSpeed(getTaskSpeed(task)) }}
                    </span>
              <span class="status-remaining"
                    v-if="getTaskRemainingTime(task) > 0 && isFinite(getTaskRemainingTime(task))">
                      剩约 {{ formatTime(getTaskRemainingTime(task)) }}
                    </span>
              <!-- 单个文件进度条 -->
              <div class="files-upload-tasks-item-progress-bar-container">
                <div class="files-upload-tasks-item-progress-bar"
                     :style="{ width: getTaskProgress(task) + '%' }"></div>
              </div>
            </template>
            <!-- 普通上传中 -->
            <template v-else>
              <span class="status-uploading">上传中...</span>
            </template>
          </div>
        </div>
        <div class="files-upload-tasks-item-action">
          <div v-if="!isTaskCompleted(task) && !isTaskCancelled(task)"
               class="files-upload-tasks-cancel-btn"
               @click="cancelTask(task)">
            取消
          </div>
        </div>
      </div>
    </CustomScrollBar>
  </SimpleWindow>
</template>

<style scoped lang="scss">
.files-upload-tasks-list {
  flex: 1;
  overflow: auto;
  margin: 5px 0;
  padding: 0 10px;
}

.files-upload-tasks-item {
  display: flex;
  align-items: center;
  flex-direction: row;
  padding: 6px 4px;
  border-bottom: 1px solid $color-border-faint;
}

.files-upload-tasks-item:last-child {
  border-bottom: none;
}

.files-upload-tasks-item-icon {
  width: 36px;
  height: 36px;
  margin: 4px 8px 4px 0;
  flex-shrink: 0;
}

.files-upload-tasks-item-info {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.files-upload-tasks-item-status {
  font-size: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: $color-text-meta;
  word-break: break-all;
}

.files-upload-tasks-item-type {
  font-size: 10px;
  margin: 0;
  color: $color-text-meta;
}

.status-uploading {
  color: $color-primary;
  margin-right: 6px;
}

.status-completed {
  color: $color-text-success;
}

.status-cancelled {
  color: $color-text-muted;
}

.status-hashing {
  color: $color-text-muted;
}

.status-speed {
  color: $color-text-secondary;
  margin-right: 6px;
}

.status-remaining {
  color: $color-text-muted;
}

.status-error {
  color: $color-text-error-bright;
}

.files-upload-tasks-item-progress-bar-container {
  @include progress-bar-track;
  margin-top: 3px;
}

.files-upload-tasks-item-progress-bar {
  @extend %progress-fill;
  background: linear-gradient(90deg, $color-primary, #00ccff);
}

.files-upload-tasks-item-action {
  flex-shrink: 0;
  margin-left: 8px;
}

.files-upload-tasks-cancel-btn {
  @include btn-danger;
}

.files-upload-tasks-cancel-btn:hover {
  background: $color-bg-hover-danger;
}

.files-upload-tasks-cancel-btn:active {
  background: $color-bg-active-danger;
}
</style>