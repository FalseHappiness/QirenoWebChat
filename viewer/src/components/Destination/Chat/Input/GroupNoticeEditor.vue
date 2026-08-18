<script>
import { defineComponent } from 'vue'
import { Switch as ASwitch } from "ant-design-vue";
import { checkResponseOK, fetchSendGroupNotice } from "@/scripts/backend-api.js";
import { showErrorToast, showSuccessToast } from "@/scripts/toast.js";
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue";
import QIcon from "@/components/Common/Icons/QIcon.vue";
import CustomScrollBar from "@/components/Common/Scrolling/CustomScrollBar.vue";

export default defineComponent({
  name: "GroupNoticeEditor",
  components: { SimpleWindow, QIcon, ASwitch, CustomScrollBar },
  props: {
    groupId: { type: [Number, String], required: true },
    visible: { type: Boolean, default: false }
  },
  emits: ['add-notice-image'],
  inject: ['updateGroupNotice'],
  data() {
    return {
      content: '',
      image: null,
      imageBase64: '',
      showPopup: false,
      confirmRequired: false,
      pinned: false,
      sendToNewMembers: false,
      isShowEditCard: false,
      submitting: false,
    }
  },
  methods: {
    readFileAsBase64(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    },

    setNoticeImage(file) {
      if (this.image) return
      this.readFileAsBase64(file).then(base64 => {
        this.image = file
        this.imageBase64 = base64
      })
    },

    removeImage() {
      this.image = null
      this.imageBase64 = ''
    },

    async handleSubmit() {
      if (!this.content.trim()) {
        showErrorToast('请输入公告内容')
        return
      }
      if (this.submitting) return
      this.submitting = true
      try {
        const result = await fetchSendGroupNotice(
          this.groupId,
          this.content.trim(),
          this.imageBase64 || '',
          this.showPopup,
          this.confirmRequired,
          this.pinned,
          this.sendToNewMembers,
          this.isShowEditCard
        )
        if (checkResponseOK(result)) {
          showSuccessToast('公告发送成功')
          // noinspection ES6MissingAwait
          this.updateGroupNotice()
          this.close()
        } else {
          showErrorToast('公告发送失败: ' + (result?.message || ''))
        }
      } catch (e) {
        console.error('Send group notice error:', e)
        showErrorToast('公告发送失败: ' + (e?.message || ''))
      } finally {
        this.submitting = false
      }
    },

    handleKeydown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        this.handleSubmit()
      }
    },

    reset() {
      this.content = ''
      this.image = null
      this.imageBase64 = ''
      this.showPopup = false
      this.confirmRequired = false
      this.pinned = false
      this.sendToNewMembers = false
      this.isShowEditCard = false
      this.submitting = false
    },

    close() {
      this.$refs.window?.close()
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.$nextTick(() => this.reset())
      }
    }
  }
})
</script>

<template>
  <SimpleWindow
    v-if="visible"
    title="发布群公告"
    width="600px"
    height="550px"
    class="group-notice-editor"
    ref="window"
  >
    <CustomScrollBar ref="noticeEditorScroller" class="notice-editor-scroller">
      <div class="notice-editor-area">
        <textarea
          v-model="content"
          class="notice-editor-textarea"
          placeholder="请输入公告内容..."
          rows="6"
          @keydown="handleKeydown"
        ></textarea>
      </div>

      <div class="notice-editor-area with-title display-flex" data-title="公告图片">
        <div class="notice-editor-image-section">
          <template v-if="imageBase64">
            <div class="notice-editor-image-preview">
              <img :src="imageBase64" alt="公告图片" class="notice-editor-image-img"/>
              <QIcon name="close_fill_24" class="notice-editor-image-remove" @click="removeImage"/>
            </div>
          </template>
          <template v-else>
            <QIcon name="add_24" class="notice-editor-add-image-btn" @click="$emit('add-notice-image')"/>
            <span class="notice-editor-image-hint">点击添加图片（仅一张），或拖入图片</span>
          </template>
        </div>
      </div>

      <div class="notice-editor-switch">
        使用弹窗展示公告
        <ASwitch v-model:checked="showPopup" size="small"/>
      </div>
      <div class="notice-editor-switch">
        需群成员确认收到
        <ASwitch v-model:checked="confirmRequired" size="small"/>
      </div>
      <div class="notice-editor-switch">
        设为置顶
        <ASwitch v-model:checked="pinned" size="small"/>
      </div>
      <div class="notice-editor-switch">
        发送给新成员
        <ASwitch v-model:checked="sendToNewMembers" size="small"/>
      </div>
      <div class="notice-editor-switch">
        引导新成员修改群昵称
        <ASwitch v-model:checked="isShowEditCard" size="small"/>
      </div>

      <div class="notice-editor-actions">
        <div class="notice-editor-submit-btn" @click="handleSubmit">
          {{ submitting ? '发送中...' : '发布公告' }}
        </div>
      </div>
    </CustomScrollBar>
  </SimpleWindow>
</template>

<style scoped lang="scss">
.group-notice-editor {
  @extend %flex-column;
}

.notice-editor-scroller {
  flex: 1;
  padding: 0 18px 12px;

  :deep(.simplebar-content) {
    font-size: 15px;
    gap: 18px;
    @extend %flex-column;
  }
}

.notice-editor-area {
  @include card;
  padding: 8px 12px;
  display: block;
  margin: 0;

  &.display-flex {
    display: flex;
    justify-content: space-between;
  }

  &.with-title {
    margin-top: 18px;

    &:before {
      content: attr(data-title);
      display: block;
      position: absolute;
      margin-top: -32px;
      color: $color-text-muted;
      font-size: 14px;
      pointer-events: none;
    }
  }
}

.notice-editor-textarea {
  width: 100%;
  min-height: 120px;
  max-height: 300px;
  resize: vertical;
  outline: none;
  border: 1px solid $color-border;
  border-radius: $radius-btn;
  font-size: 14px;
  padding: 10px;
  background: $color-bg-input;
  color: $color-text-regular;
  transition: border-color $transition-normal, box-shadow $transition-normal;
  font-family: inherit;
  line-height: 1.6;

  &:focus {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px $color-primary-light;
  }

  &::placeholder {
    color: $color-text-muted;
  }
}

.notice-editor-image-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.notice-editor-image-preview {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.notice-editor-image-img {
  max-width: 120px;
  max-height: 120px;
  border-radius: $radius-sm;
  object-fit: cover;
  border: 1px solid $color-border;
  margin: 5px;
}

.notice-editor-image-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  color: $color-text-danger;
  background: $color-bg-card;
  border-radius: $radius-circle;
  padding: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.notice-editor-image-hint {
  font-size: 12px;
  color: $color-text-muted;
}

.notice-editor-add-image-btn {
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: $color-text-muted;
  border: 1px dashed $color-border;
  border-radius: $radius-btn;
  padding: 4px;
  transition: all $transition-fast;

  &:hover {
    color: $color-primary;
    border-color: $color-primary;
  }
}

.notice-editor-actions {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0;
}

.notice-editor-submit-btn {
  @include btn-primary;
  padding: 6px 24px;
  font-size: 14px;
}

.notice-editor-switch {
  @extend .notice-editor-area, %flex-row-between;
  display: flex;
}
</style>