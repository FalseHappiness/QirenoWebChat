<script>
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue";
import LoadingSpinner from "@/components/Common/Widgets/LoadingSpinner.vue";
import { isObject } from "@/scripts/types-util.js";
import { fetchSetProfileInfo, checkResponseOK } from "@/scripts/backend-api.js";
import { showErrorToast, showSuccessToast } from "@/scripts/toast.js";

export default {
  name: "ProfileEditor",
  components: { LoadingSpinner, SimpleWindow },
  inject: ['selfInfo'],
  data() {
    return {
      nicknameModel: '',
      personalNoteModel: '',
      sexModel: 0,
      saving: false,
    }
  },
  watch: {
    selfInfo: {
      handler(val) {
        if (isObject(val)) {
          this.nicknameModel = val.nickname || '';
          this.personalNoteModel = val.long_nick || val.longNick || '';
          this.sexModel = ({ unknown: 0, man: 1, male: 1, female: 2, woman: 2, 0: 0, 1: 1, 2: 2 })[val.sex] || 0;
        }
      },
      immediate: true,
    }
  },
  methods: {
    async handleSave() {
      this.saving = true;
      try {
        const result = await fetchSetProfileInfo(this.nicknameModel, this.personalNoteModel, this.sexModel);
        if (checkResponseOK(result)) {
          showSuccessToast('保存成功');
          this.$emit('close');
        } else {
          showErrorToast('保存失败');
        }
      } catch (e) {
        showErrorToast('保存失败: ' + (e.message || ''));
      } finally {
        this.saving = false;
      }
    },
    handleCancel() {
      this.$emit('close');
    }
  }
}
</script>

<template>
  <SimpleWindow title="编辑资料" height="auto" :width="500">
    <div v-if="selfInfo" class="profile-editor-form">
      <!-- 昵称 -->
      <div class="form-row">
        <label class="form-label">昵称</label>
        <input class="form-input" v-model="nicknameModel" type="text" maxlength="30" placeholder="请输入昵称"/>
      </div>

      <!-- 个性签名 -->
      <div class="form-row">
        <label class="form-label">个签</label>
        <input class="form-input" v-model="personalNoteModel" type="text" maxlength="100" placeholder="请输入个性签名"/>
      </div>

      <!-- 性别 -->
      <div class="form-row">
        <label class="form-label">性别</label>
        <div class="gender-options">
          <label class="gender-option" :class="{ active: sexModel === 0 }">
            <input type="radio" v-model="sexModel" :value="0"/>
            <span>未知</span>
          </label>
          <label class="gender-option" :class="{ active: sexModel === 1 }">
            <input type="radio" v-model="sexModel" :value="1"/>
            <span>男</span>
          </label>
          <label class="gender-option" :class="{ active: sexModel === 2 }">
            <input type="radio" v-model="sexModel" :value="2"/>
            <span>女</span>
          </label>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="form-actions">
        <button class="btn-save" @click="handleSave" :disabled="saving">
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <button class="btn-cancel" @click="handleCancel" :disabled="saving">取消</button>
      </div>
    </div>
    <LoadingSpinner v-else text="获取个人信息中" class="loading"/>
  </SimpleWindow>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.profile-editor-form {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.form-label {
  width: 64px;
  font-size: 14px;
  color: $color-text-regular;
  flex-shrink: 0;
  text-align: right;
}

.form-input {
  flex: 1;
  @extend %input-base;
  padding: 8px 12px;
  font-size: 14px;

  &:focus {
    @extend %input-base-focus;
  }
}

/* 性别选择 */
.gender-options {
  display: flex;
  gap: 12px;
}

.gender-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border: 1px solid $color-border;
  border-radius: $radius-btn;
  cursor: pointer;
  font-size: 14px;
  color: $color-text-regular;
  transition: background $transition-fast, border-color $transition-fast, color $transition-fast;

  input {
    display: none;
  }

  &:hover {
    background: $color-bg-hover;
    border-color: $color-border-hover;
  }

  &.active {
    background: $color-primary-light;
    border-color: $color-primary;
    color: $color-primary;
  }
}

/* 底部按钮 */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding-top: 16px;
}

.btn-cancel {
  @include btn-cancel;
  padding: 6px 24px;
  font-size: 14px;
}

.btn-save {
  @include btn-primary;
  padding: 6px 24px;
  font-size: 14px;
}

.loading {
  margin: 30px;
}
</style>