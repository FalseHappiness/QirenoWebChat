<script>
import { defineComponent } from 'vue'
import SimplePopUp from "./SimplePopUp.vue";

export default defineComponent({
  name: "ConfirmBox",
  components: { SimplePopUp },
  props: {
    title: {
      type: String,
      default: '确认'
    },
    content: {
      type: String,
      default: ''
    },
    confirmText: {
      type: String,
      default: '确定'
    },
    cancelText: {
      type: String,
      default: '取消'
    },
    onConfirm: {
      type: Function,
      default: new Function()
    },
    onCancel: {
      type: Function,
      default: new Function()
    }
  },
  methods: {
    confirm(value) {
      this.$refs.popUp.confirm(value)
    }
  }
})
</script>

<template>
  <div class="confirm-box">
    <SimplePopUp :on-confirm="onConfirm"
                 :on-cancel="onCancel"
                 :container-styles="$style['confirm-box-container']"
                 ref="popUp">
      <template #default>
        <div class="confirm-box-header">
          <span class="confirm-box-title">{{ title }}</span>
        </div>
        <div class="confirm-box-body">
          <p class="confirm-box-content">{{ content }}</p>
        </div>
        <div class="confirm-box-footer">
          <div class="confirm-box-buttons-container">
            <div class="confirm-box-button confirm-box-button-confirm" @click="confirm(true)">{{ confirmText }}</div>
            <div class="confirm-box-button confirm-box-button-cancel" @click="confirm(false)">{{ cancelText }}</div>
          </div>
        </div>
      </template>
    </SimplePopUp>
  </div>
</template>

<style scoped lang="scss">
.confirm-box-header {
  padding: 4px 0 6px 0;
}

.confirm-box-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
}

.confirm-box-body {
  flex: 1;
  padding: 0 0 4px;
  overflow-y: auto;
}

.confirm-box-content {
  font-size: 14px;
  color: $color-text-soft;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.confirm-box-footer {
  padding: 10px 0 0 0;
}

.confirm-box-buttons-container {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.confirm-box-button {
  margin: 0;
  width: 76px;
  height: 32px;
  @include flex-center;
  background-color: $color-bg-card;
  border-radius: $radius-bubble;
  cursor: pointer;
  font-size: 14px;
}

.confirm-box-button-confirm {
  background-color: $color-primary;
  color: white;
}

.confirm-box-button-confirm:hover {
  background-color: $color-bg-primary-hover;
}

.confirm-box-button-confirm:active {
  background-color: $color-bg-primary-active;
  color: rgba(255, 255, 255, 0.4);
}

.confirm-box-button-cancel {
  border: 1px solid $color-border-cancel;
  color: black;
}

.confirm-box-button-cancel:hover {
  background-color: $color-bg-hover-alt;
}

.confirm-box-button-cancel:active {
  background-color: $color-bg-active-alt;
  color: $color-text-muted;
}
</style>

<style module>
.confirm-box-container {
  width: 360px;
  height: auto;
  max-height: calc(100% - 20px);
  padding: 15px 20px;
}
</style>