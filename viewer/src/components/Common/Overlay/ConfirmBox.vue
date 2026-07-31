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

<style scoped>
.confirm-box-header {
  padding: 4px 0 6px 0;
}

.confirm-box-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1d;
}

.confirm-box-body {
  flex: 1;
  padding: 0 0 4px;
  overflow-y: auto;
}

.confirm-box-content {
  font-size: 14px;
  color: #4a4a4a;
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
  gap: 8px;
}

.confirm-box-button {
  margin: 0;
  width: 76px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: white;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}

.confirm-box-button-confirm {
  background-color: #0099ff;
  color: white;
}

.confirm-box-button-confirm:hover {
  background-color: #008be6;
}

.confirm-box-button-confirm:active {
  background-color: #0076c5;
  color: rgba(255, 255, 255, 0.4);
}

.confirm-box-button-cancel {
  border: 1px solid #c4c4c4;
  color: black;
}

.confirm-box-button-cancel:hover {
  background-color: #efefef;
}

.confirm-box-button-cancel:active {
  background-color: #d8d8d8;
  color: gray;
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