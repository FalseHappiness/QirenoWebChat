<!--
  录音面板组件
  包含录音控制、计时、暂停/恢复、锁定、取消等功能
-->
<script>
import { Icon } from "@iconify/vue"
import QIcon from "../../../Common/Icons/QIcon.vue"
import Tooltip from "../../../Common/Overlay/Tooltip.vue"
import { showErrorToast, showWarningToast } from "@/scripts/toast.js"
import { toRaw } from 'vue'
import { fetchSendFiles } from "@/scripts/backend-api.js"
import GroupAiRecordEditor from "@/components/Destination/Chat/Input/GroupAiRecordEditor.vue";

export default {
  name: "RecordPanel",
  components: {
    GroupAiRecordEditor,
    QIcon,
    Tooltip,
    Icon,
  },
  inject: ['activeContact', "isMultiSelectMessagesMode"],
  props: {
    isGroup: {
      type: Boolean,
      default: false,
    },
    currentFilesUploadTasks: {
      type: Array,
      default: []
    }
  },
  emits: [
    'close',
    'open-files-upload-tasks',
    'select-audios',
  ],
  data() {
    return {
      isShowRecordPanel: false,
      isRecording: false,
      recordDuration: 0,
      recordTimer: null,
      mediaRecorder: null,
      audioChunks: [],
      recordActiveCount: 0,
      recordShouldCancel: false,
      recordStream: null,
      isHoveringCancel: false,
      isRecordLocked: false,   // 录音锁定状态
      isRecordPaused: false,   // 录音暂停状态
      showGroupAiRecordEditor: false,  // AI语音编辑器显示状态
    }
  },
  mounted() {
    window.addEventListener('keydown', this.handleWindowRecordKeyDown)
    window.addEventListener('keyup', this.handleWindowRecordKeyUp)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleWindowRecordKeyDown)
    window.removeEventListener('keyup', this.handleWindowRecordKeyUp)
    this.cleanupRecordStream()
  },
  methods: {
    // ====== 录音功能 ======

    formatRecordTime(seconds) {
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      let result = ''
      if (days > 0) result += `${ String(days).padStart(2, '0') } 天 `
      if (hours > 0) result += `${ String(hours).padStart(2, '0') }:`
      result += `${ String(minutes).padStart(2, '0') }:${ String(secs).padStart(2, '0') }`
      return result
    },

    async requestRecordPermission() {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        console.error('获取录音权限失败:', err)
        showErrorToast('获取录音权限失败')
        return null
      }
    },

    /**
     * 打开录音面板（始终切换，不阻塞权限获取）
     * 仍然请求权限，但即使没有权限也切换到面板（方便拖放音频文件到面板上）
     */
    async handleOpenRecordPanel() {
      if (this.isShowRecordPanel) return
      // 先切换到面板，不阻塞
      this.isShowRecordPanel = true
      // 尝试获取权限，但不阻塞面板显示
      const stream = await this.requestRecordPermission()
      if (stream) {
        this.recordStream = stream
      }
    },

    /**
     * 开始录音的底层逻辑（不处理激活计数）
     */
    async startRecording() {
      if (!this.activeContact) return
      if (this.isRecording) return
      let stream = this.recordStream
      if (!stream) {
        stream = await this.requestRecordPermission()
        if (!stream) return
        this.recordStream = stream
      }
      this.isRecording = true
      this.recordShouldCancel = false
      this.isRecordPaused = false
      this.audioChunks = []
      this.recordDuration = 0

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      this.mediaRecorder = mediaRecorder

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data)
        }
      }

      mediaRecorder.start()

      this.recordTimer = setInterval(() => {
        this.recordDuration++
      }, 1000)
    },

    /**
     * 增加一个录音激活源
     */
    async incrRecord() {
      if (!this.activeContact) return

      this.recordActiveCount++

      if (this.isRecording && !this.isRecordPaused) {
        // 已录音且非暂停：仅增加计数，保持录音
        return
      }

      if (this.isRecordPaused) {
        // 暂停状态下，恢复录音
        this.resumeRecord()
        return
      }

      // 未录音，开始录音
      if (this.recordActiveCount === 1) {
        await this.startRecording()
      }
    },

    /**
     * 减少一个录音激活源
     */
    decrRecord(event) {
      if (this.recordActiveCount <= 0) return
      this.recordActiveCount--

      // 锁定模式下不因激活源归零而停止录音
      if (this.isRecordLocked) return

      // 非锁定模式，所有激活源消失，根据状态决定后续操作
      if (this.recordActiveCount === 0) {
        this.evaluateRelease(event)
      }
    },

    /**
     * 所有激活源释放后，判断是发送、取消还是其他操作
     */
    evaluateRelease(event) {
      if (this.recordShouldCancel) {
        this.cancelRecord()
        return
      }

      // 如果正处于暂停状态，松手不做任何事
      if (this.isRecordPaused) return

      if (event) {
        const target = event.target
        // 在取消按钮上松开 -> 取消
        if (this.isHoveringCancel || (target && target.closest('.message-input-record-cancel'))) {
          this.cancelRecord()
          return
        }
        // 在锁按钮上松开 -> 切换为锁定模式并保持录音
        if (target && target.closest('.message-input-record-lock')) {
          this.isRecordLocked = true
          return
        }
        // 在播放/暂停按钮上松开 -> 解锁模式下非暂停则暂停
        if (target && target.closest('.message-input-record-play-switch')) {
          if (!this.isRecordPaused) {
            this.pauseRecord()
          }
          return
        }
      }

      // 其他情况：发送录音
      this.finishRecord()
    },

    /**
     * 暂停录音
     */
    pauseRecord() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause()
        this.isRecordPaused = true
        if (this.recordTimer) {
          clearInterval(this.recordTimer)
          this.recordTimer = null
        }
      }
    },

    /**
     * 恢复录音
     */
    resumeRecord() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume()
        this.isRecordPaused = false
        if (!this.recordTimer) {
          this.recordTimer = setInterval(() => {
            this.recordDuration++
          }, 1000)
        }
      }
    },

    /**
     * 完成录音并发送
     */
    async finishRecord() {
      if (!this.isRecording) return
      this.isRecording = false

      if (this.recordTimer) {
        clearInterval(this.recordTimer)
        this.recordTimer = null
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        await new Promise(resolve => {
          this.mediaRecorder.onstop = () => {
            resolve()
          }
          this.mediaRecorder.stop()
        })
      }
      this.mediaRecorder = null

      const duration = this.recordDuration
      this.recordDuration = 0
      this.isRecordPaused = false
      this.recordActiveCount = 0

      if (duration < 1) {
        showWarningToast('录音时间太短')
        this.audioChunks = []
        return
      }

      if (this.recordShouldCancel) {
        this.audioChunks = []
        this.recordShouldCancel = false
        return
      }

      if (this.audioChunks.length > 0) {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        this.audioChunks = []
        const fileName = `record_${ Date.now() }.webm`
        const file = new File([audioBlob], fileName, { type: 'audio/webm' })
        const contact = toRaw(this.activeContact)
        if (contact) {
          fetchSendFiles({ contact, files: file, type: 'record' }).then(r => {
            if (r?.status === 'error') {
              console.log('Send record error:', r)
            }
          })
        }
      }
    },

    /**
     * 取消录音（不发送）
     */
    cancelRecord() {
      if (!this.isRecording && this.recordActiveCount <= 0) return

      this.recordShouldCancel = true
      this.recordActiveCount = 0
      this.isRecording = false
      this.isRecordPaused = false

      if (this.recordTimer) {
        clearInterval(this.recordTimer)
        this.recordTimer = null
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop()
      }
      this.mediaRecorder = null

      this.recordDuration = 0
      this.audioChunks = []
    },

    async handleRecordIconMouseDown(e) {
      // 只处理麦克风图标的 mousedown，排除锁和播放按钮
      const target = e.target
      if (!target.closest('.message-input-record-microphone')) return

      // 锁定且正在录音时，忽略长按（麦克风此时作为发送按钮）
      if (this.isRecordLocked && this.isRecording) return
      await this.incrRecord()
      document.addEventListener('mouseup', this.handleRecordIconDocMouseUp)
    },

    handleRecordIconDocMouseUp(e) {
      document.removeEventListener('mouseup', this.handleRecordIconDocMouseUp)
      this.decrRecord(e)
    },

    /**
     * 发送录音（锁定模式时点击发送图标触发）
     */
    handleSendRecord() {
      if (this.isRecording) {
        this.finishRecord()
      }
    },

    handleWindowRecordKeyDown(e) {
      if (!this.isShowRecordPanel) return
      this.handleRecordPanelKeyDown(e)
    },

    handleWindowRecordKeyUp(e) {
      if (!this.isShowRecordPanel) return
      this.handleRecordPanelKeyUp(e)
    },

    async handleRecordPanelKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (this.isRecording) {
          this.cancelRecord()
        } else {
          this.isShowRecordPanel = false
          this.handleCloseRecordPanel()
        }
        return
      }

      // 空格键按下
      if (e.key === ' ' || e.code === 'Space') {
        if (!e.repeat) {
          e.preventDefault()
          if (this.isRecording && this.isRecordLocked) {
            // 锁定模式下，切换暂停/非暂停
            if (this.isRecordPaused) {
              this.resumeRecord()
            } else {
              this.pauseRecord()
            }
          } else {
            // 非锁定模式：增加激活源（开始录音或恢复录音）
            await this.incrRecord()
          }
        }
      }
    },

    handleRecordPanelKeyUp(e) {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        // 锁定模式下空格已在 keydown 中处理，keyup 不做任何事
        if (!(this.isRecording && this.isRecordLocked)) {
          this.decrRecord()
        }
      }
    },

    handleRecordCancelMouseEnter() {
      this.isHoveringCancel = true
    },

    handleRecordCancelMouseLeave() {
      this.isHoveringCancel = false
    },

    handleLockClick() {
      if (this.isRecording) {
        if (this.isRecordLocked) {
          // 锁定 -> 解锁，并暂停
          this.isRecordLocked = false
          this.pauseRecord()
        } else {
          // 解锁 -> 锁定，保持录音
          this.isRecordLocked = true
        }
      } else {
        // 未录音，仅切换锁定状态
        this.isRecordLocked = !this.isRecordLocked
      }
    },

    handlePlaySwitchClick() {
      if (!this.isRecording) {
        // 未录音：锁定并开始录音
        this.isRecordLocked = true
        this.startRecording()
      } else {
        // 录音中
        if (this.isRecordLocked) {
          // 锁定模式：自由切换暂停/恢复
          if (this.isRecordPaused) {
            this.resumeRecord()
          } else {
            this.pauseRecord()
          }
        } else {
          // 解锁模式
          if (this.isRecordPaused) {
            // 暂停状态：恢复录音并锁定
            this.resumeRecord()
            this.isRecordLocked = true
          } else {
            // 非暂停：暂停录音
            this.pauseRecord()
          }
        }
      }
    },

    handleExitRecordPanel() {
      if (this.isRecording) {
        this.cancelRecord()
      } else {
        this.isShowRecordPanel = false
        this.handleCloseRecordPanel()
      }
    },

    cleanupRecordStream() {
      // 停止并释放录音流
      if (this.recordStream) {
        this.recordStream.getTracks().forEach(track => track.stop())
        this.recordStream = null
      }
    },

    handleCloseRecordPanel() {
      if (this.isRecording) {
        this.cancelRecord()
      }
      this.cleanupRecordStream()
      this.isRecordPaused = false
      this.isShowRecordPanel = false
      this.$emit('close')
    },

    // AI语音编辑器
    handleOpenGroupAiRecordEditor() {
      if (!this.isGroup) return
      this.showGroupAiRecordEditor = true
    },

    handleCloseGroupAiRecordEditor() {
      this.showGroupAiRecordEditor = false
    },
  },
  computed: {
    lockIcon() {
      return this.isRecordLocked ? 'tabler:lock' : 'tabler:lock-open'
    },
    playSwitchIcon() {
      return (this.isRecording && !this.isRecordPaused)
        ? 'pause_24'
        : 'play_fill_24'
    },
  },
  watch: {
    isShowRecordPanel(val) {
      if (val) {
        this.$nextTick(() => {
          this.$refs.recordPanel?.focus()
        })
      }
    }
  }
}
</script>

<template>
  <div class="message-input-record-panel message-input-panel"
       :class="{ 'display-flex': isShowRecordPanel && !isMultiSelectMessagesMode }"
       tabindex="-1"
       ref="recordPanel">
    <GroupAiRecordEditor
      v-if="showGroupAiRecordEditor && isGroup"
      :group_id="activeContact?.contact_id"
      @close="handleCloseGroupAiRecordEditor"
    />
    <div class="message-input-controls">
      <div class="message-input-controls-left">
        <Tooltip
          content="音频文件"
          use-target-slot
        >
          <template #target>
            <QIcon
              name="folder_24"
              class="message-input-ctrl-icon"
              @click="$emit('select-audios')"
            />
          </template>
        </Tooltip>
        <Tooltip
          v-if="isGroup"
          content="AI 语音"
          use-target-slot
        >
          <template #target>
            <QIcon
              name="ai_label_16"
              class="message-input-ctrl-icon"
              @click="handleOpenGroupAiRecordEditor"
            />
          </template>
        </Tooltip>
      </div>
      <div class="message-input-controls-right">
        <Tooltip
          v-if="currentFilesUploadTasks?.filter(task=>task?.type==='record')?.length"
          content="音频上传列表"
          use-target-slot
        >
          <template #target>
            <QIcon
              name="files_24"
              class="message-input-ctrl-icon"
              @click="$emit('open-files-upload-tasks')"
            />
          </template>
        </Tooltip>
      </div>
    </div>
    <div class="message-input-record-timer">{{ formatRecordTime(recordDuration) }}</div>
    <div class="message-input-record-container"
         @mousedown="handleRecordIconMouseDown"
         @mouseleave="isHoveringCancel = false">
      <Icon
        :icon="lockIcon"
        @click.stop="handleLockClick"
        class="message-input-record-icon message-input-record-lock"/>
      <div class="message-input-record-microphone message-input-record-icon"
           :class="{ active: isRecording && !isRecordPaused }">
        <template v-if="isRecording && isRecordLocked">
          <Icon icon="tabler:send" @click.stop="handleSendRecord"/>
        </template>
        <template v-else>
          <QIcon name="microphone_on_24"></QIcon>
        </template>
      </div>
      <QIcon
        :name="playSwitchIcon"
        class="message-input-record-icon message-input-record-play-switch"
        @mousedown.stop
        @click.stop="handlePlaySwitchClick"
        :style="{ paddingLeft: playSwitchIcon === 'play_fill_24' ? '12px' : '10px' }"
      />
    </div>
    <div class="text-muted message-input-record-hint">
      <template v-if="isRecording">
        <!-- 录音中 -->
        <!-- 解锁、非暂停：松手发送 -->
        <template v-if="!isRecordLocked && !isRecordPaused">
          松手发送，按 Esc 键或点击
        </template>
        <!-- 解锁、暂停 -->
        <template v-else-if="!isRecordLocked && isRecordPaused">
          录音已暂停，按下空格键或长按麦克风恢复，按 Esc 键或点击
        </template>
        <!-- 锁定、暂停 -->
        <template v-else-if="isRecordLocked && isRecordPaused">
          录音已暂停（锁定），点击播放继续，点击锁解锁并保持暂停，按 Esc 键或点击
        </template>
        <!-- 锁定、非暂停 -->
        <template v-else>
          录音中（锁定），点击发送按钮发送，点击锁解锁并暂停，按 Esc 键或点击
        </template>
        <span @click="cancelRecord"
              @mouseenter="handleRecordCancelMouseEnter"
              @mouseleave="handleRecordCancelMouseLeave"
              class="message-input-record-cancel">取消发送</span>
      </template>
      <template v-else>
        <!-- 未录音 -->
        <template v-if="isRecordLocked">
          已锁定，点击麦克风或空格键开始录音，点击
        </template>
        <template v-else>
          按住空格键开始说话，按 Esc 键或点击
        </template>
        <span @click="handleExitRecordPanel"
              @mouseenter="handleRecordCancelMouseEnter"
              @mouseleave="handleRecordCancelMouseLeave"
              class="message-input-record-cancel">退出</span>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.message-input-panel.message-input-record-panel {
  display: none;
  align-items: center;
  justify-content: center;
}

.message-input-record-timer {
  font-weight: 500;
  color: $color-text-regular;
  font-variant-numeric: tabular-nums;
}

.message-input-record-hint {
  font-size: 13px;
}

.message-input-record-container {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  gap: 30px;
  padding: 20px 0;
}

.message-input-record-cancel {
  color: $color-text-record-cancel;
  cursor: pointer;
}

.message-input-record-panel .message-input-controls {
  position: absolute;
  right: 0;
  top: 0;
  width: 100%;
}

.message-input-record-icon {
  height: 45px;
  width: 45px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  --inner-color: transparent;
  --outer-color: transparent;
  background: radial-gradient(38.02% 38.02% at 50% 50%, var(--inner-color) 0px, var(--outer-color) 100%);
  color: white;
  padding: 10px;
}

.message-input-record-lock {
  --inner-color: rgb(255, 180, 50);
  --outer-color: rgb(255 134 0);
}

.message-input-record-play-switch {
  --inner-color: rgb(130 255 100);
  --outer-color: rgb(50, 200, 160);
}

.message-input-record-microphone {
  height: 52px;
  width: 52px;
  outline: solid 2px rgba(0, 153, 255, 0.2);
  transition-duration: 0.3s;
  transition-timing-function: ease;
  transition-delay: 0s;
  transition-property: outline-width;
  --inner-color: rgb(0, 201, 255);
  --outer-color: rgb(0, 155, 255);
}

.message-input-record-microphone.active {
  outline-width: 6px;
  --inner-color: rgb(0, 177, 255);
  --outer-color: rgb(0, 128, 255);
}

.message-input-record-microphone svg {
  height: 24px;
  width: 24px;
}

.message-input-controls {
  white-space: nowrap;
  display: flex;
  padding: 0;
  margin: 0;
  justify-content: space-between;
  align-items: center;
  height: 35px;
  flex-shrink: 0;
}

.message-input-ctrl-icon {
  height: 24px;
  width: 24px;
  display: inline-block;
  margin: 0 0 0 15px;
  color: black;
  vertical-align: middle;
}

.message-input-controls-right .message-input-ctrl-icon {
  margin: 0 15px 0 0;
}

.message-input-ctrl-icon:hover {
  color: $color-primary;
}
</style>