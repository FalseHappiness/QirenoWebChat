<script>
import { defineComponent } from 'vue'
import SimplePopUp from "./SimplePopUp.vue";

export default defineComponent({
  name: "PromptBox",
  components: { SimplePopUp },
  props: {
    title: {
      type: String,
      default: '输入'
    },
    content: {
      type: String,
      default: ''
    },
    tip: {
      type: String,
      default: '请输入...'
    },
    placeholder: {
      type: String,
      default: '请输入...'
    },
    defaultValue: {
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
  data() {
    return {
      inputValue: this.defaultValue
    }
  },
  methods: {
    confirm(value) {
      this.$refs.popUp.confirm(value, this.inputValue)
    }
  }
})
</script>

<template>
  <div class="prompt-box">
    <SimplePopUp :on-confirm="onConfirm"
                 :on-cancel="onCancel"
                 class="popup-prompt-box-container"
                 ref="popUp">
      <div class="prompt-box-header">
        <span class="prompt-box-title">{{ title }}</span>
      </div>
      <div class="prompt-box-body">
        <span></span>
        <p class="prompt-box-content" v-if="content">{{ content }}</p>
        <input class="prompt-box-input"
               type="text"
               v-model="inputValue"
               :placeholder="placeholder"
               ref="inputField"
               @keydown.enter="confirm(true)"
               @keydown.esc="confirm(false)"/>
      </div>
      <div class="prompt-box-footer">
        <div class="prompt-box-buttons-container">
          <div class="prompt-box-button prompt-box-button-confirm" @click="confirm(true)">{{ confirmText }}</div>
          <div class="prompt-box-button prompt-box-button-cancel" @click="confirm(false)">{{ cancelText }}</div>
        </div>
      </div>
    </SimplePopUp>
  </div>
</template>

<style scoped lang="scss">
.popup-prompt-box-container {
  width: 360px;
  height: auto;
  max-height: calc(100% - 20px);
  padding: 15px 20px;
}

.prompt-box-header {
  padding: 4px 0 6px 0;
}

.prompt-box-title {
  font-size: 16px;
  font-weight: 600;
  color: $color-text-primary;
}

.prompt-box-body {
  flex: 1;
  padding: 0 0 4px;
  overflow-y: auto;
}

.prompt-box-content {
  font-size: 14px;
  color: $color-text-soft;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0 0 10px 0;
}

.prompt-box-input {
  @extend %input-base;
  width: 100%;
  padding: 8px 12px;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 14px;

  &:focus {
    @extend %input-base-focus;
  }

  &::placeholder {
    color: $color-text-muted;
  }
}

.prompt-box-footer {
  padding: 10px 0 0 0;
}

.prompt-box-buttons-container {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

.prompt-box-button {
  margin: 0;
  width: 76px;
  height: 32px;
  @include flex-center;
  background-color: $color-bg-card;
  border-radius: $radius-bubble;
  cursor: pointer;
  font-size: 14px;
}

.prompt-box-button-confirm {
  background-color: $color-primary;
  color: white;
}

.prompt-box-button-confirm:hover {
  background-color: $color-bg-primary-hover;
}

.prompt-box-button-confirm:active {
  background-color: $color-bg-primary-active;
  color: rgba(255, 255, 255, 0.4);
}

.prompt-box-button-cancel {
  border: 1px solid $color-border-cancel;
  color: black;
}

.prompt-box-button-cancel:hover {
  background-color: $color-bg-hover-alt;
}

.prompt-box-button-cancel:active {
  background-color: $color-bg-active-alt;
  color: $color-text-muted;
}
</style>