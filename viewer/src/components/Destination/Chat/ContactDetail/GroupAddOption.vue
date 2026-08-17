<script>
import ContactDetailSubView from "@/components/Destination/Chat/ContactDetail/ContactDetailSubView.vue";
import EnterArrow from "@/components/Common/Widgets/EnterArrow.vue";
import CustomScrollBar from "@/components/Common/Scrolling/CustomScrollBar.vue";
import {
  RadioGroup as ARadioGroup,
  Radio as ARadio,
  Select as ASelect,
  SelectOption as ASelectOption
} from "ant-design-vue";
import {
  checkResponseOK,
  fetchSetGroupAddOption,
  fetchSetGroupMemberInvitePolicy,
  fetchSetGroupRobotAddOption,
} from "@/scripts/backend-api.js";
import { showErrorToast, showSuccessToast } from "@/scripts/toast.js";
import { showConfirmBox } from "@/scripts/popup-box-api.js";

export default {
  name: "GroupAddOption",
  components: {
    CustomScrollBar, EnterArrow, ContactDetailSubView, ARadioGroup, ARadio,
    ASelect, ASelectOption,
  },
  props: {
    group_id: Number,
  },
  data() {
    return {
      addOptionModel: undefined,
      verifyOptionModel: undefined,
      verifyQuestionModel: undefined,
      verifyAnswerModel: undefined,
      memberInvitePolicyModel: null,
      robotAddOptionModel: null,
      saving: false,
      saved: false,
    }
  },
  computed: {
    hasUnsavedChanges() {
      return this.addOptionModel !== undefined
        || this.verifyOptionModel !== undefined
        || this.verifyQuestionModel !== undefined && this.verifyQuestionModel !== ''
        || this.verifyAnswerModel !== undefined && this.verifyAnswerModel !== ''
        || this.memberInvitePolicyModel !== null
        || this.robotAddOptionModel !== null
    }
  },
  methods: {
    async closeCondition() {
      if (this.saved || !this.hasUnsavedChanges) return true
      return await showConfirmBox("未保存的修改", "您有未保存的修改，确定要离开吗？", "确定离开", "继续编辑")
    },
    async handleSave() {
      if (this.saving) return
      this.saving = true
      try {
        // 1. 处理加群方式
        if (this.addOptionModel !== undefined) {
          let add_type
          if (this.addOptionModel === 1) {
            add_type = 1 // 允许任何人加群
          } else if (this.addOptionModel === 2) {
            // 需要身份验证，根据验证方式映射 add_type
            if (this.verifyOptionModel === undefined) {
              add_type = 2 // 默认需要发送验证信息
            } else {
              add_type = this.verifyOptionModel // 2: 发送验证消息, 4: 正确回答问题, 5: 回答问题+管理员审核
            }
          } else if (this.addOptionModel === 3) {
            add_type = 3 // 不允许任何人加群
          }

          if (add_type !== undefined) {
            const question = add_type >= 4 ? (this.verifyQuestionModel || undefined) : undefined
            const answer = add_type === 4 ? (this.verifyAnswerModel || undefined) : undefined
            const result = await fetchSetGroupAddOption(this.group_id, add_type, question, answer)
            if (!checkResponseOK(result)) {
              showErrorToast("加群方式设置失败: " + (result?.message || ''))
              return
            }
          }
        }

        // 2. 处理邀请加群权限
        if (this.memberInvitePolicyModel !== null) {
          const result = await fetchSetGroupMemberInvitePolicy(this.group_id, this.memberInvitePolicyModel)
          if (!checkResponseOK(result)) {
            showErrorToast("邀请权限设置失败: " + (result?.message || ''))
            return
          }
        }

        // 3. 处理机器人加群权限
        if (this.robotAddOptionModel !== null) {
          const result = await fetchSetGroupRobotAddOption(this.group_id, this.robotAddOptionModel)
          if (!checkResponseOK(result)) {
            showErrorToast("机器人加群权限设置失败: " + (result?.message || ''))
            return
          }
        }

        this.saved = true
        showSuccessToast("设置已保存")
        this.$emit('close')
      } catch (e) {
        console.error("Group add option save error:", e)
        showErrorToast("保存失败: " + (e?.message || ''))
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<template>
  <ContactDetailSubView title="加群方式" :close-condition="closeCondition">
    <CustomScrollBar class="contact-detail-scroller">
      <ARadioGroup
        class="contact-detail-area with-title area-container"
        data-title="加群方式"
        v-model:value="addOptionModel">
        <ARadio class="contact-detail-container-area" :value="undefined">
          不修改
        </ARadio>
        <hr>
        <ARadio class="contact-detail-container-area" :value="1">
          允许任何人加群
        </ARadio>
        <hr>
        <ARadio class="contact-detail-container-area" :value="2">
          需要身份验证
        </ARadio>
        <hr>
        <ARadio class="contact-detail-container-area" :value="3">
          不允许任何人加群
        </ARadio>
      </ARadioGroup>

      <template v-if="addOptionModel === 2">
        <ARadioGroup
          class="contact-detail-area with-title area-container"
          data-title="验证方式"
          v-model:value="verifyOptionModel">
          <ARadio class="contact-detail-container-area" :value="undefined">
            不修改
          </ARadio>
          <hr>
          <ARadio class="contact-detail-container-area" :value="2">
            需要发送验证消息
          </ARadio>
          <hr>
          <ARadio class="contact-detail-container-area" :value="5">
            需要回答问题并由管理员审核
          </ARadio>
          <template v-if="verifyOptionModel === 5">
            <hr>
            <div class="contact-detail-container-input">
              问题
              <input placeholder="本群的密码是？" v-model="verifyQuestionModel">
            </div>
          </template>
          <hr>
          <ARadio class="contact-detail-container-area" :value="4">
            需要正确回答问题
          </ARadio>
          <template v-if="verifyOptionModel === 4">
            <hr>
            <div class="contact-detail-container-input">
              问题
              <input placeholder="本群的密码是？" v-model="verifyQuestionModel">
            </div>
            <hr>
            <div class="contact-detail-container-input">
              答案
              <input placeholder="请输入答案" v-model="verifyAnswerModel">
            </div>
          </template>
        </ARadioGroup>

        <div class="contact-detail-area with-title display-flex" data-title="邀请加群权限">
          邀请权限
          <ASelect v-model:value="memberInvitePolicyModel" size="small">
            <ASelectOption :value="null">不修改</ASelectOption>
            <ASelectOption :value="0">不允许邀请</ASelectOption>
            <ASelectOption :value="1">无需审核直接进群</ASelectOption>
            <ASelectOption :value="2">需要管理员审核</ASelectOption>
            <ASelectOption :value="3">100 人内无需审核</ASelectOption>
          </ASelect>
        </div>

        <div class="contact-detail-area with-title display-flex" data-title="机器人加群权限">
          邀请权限
          <ASelect v-model:value="robotAddOptionModel" size="small">
            <ASelectOption :value="null">不修改</ASelectOption>
            <ASelectOption :value="0">不允许邀请</ASelectOption>
            <ASelectOption :value="1">无需审核直接进群</ASelectOption>
            <ASelectOption :value="2">需要管理员审核</ASelectOption>
          </ASelect>
        </div>
      </template>

      <div class="contact-detail-save-area">
        <button class="contact-detail-save-btn" :disabled="saving" @click="handleSave">
          {{ saving ? '保存中…' : '保存设置' }}
        </button>
      </div>
    </CustomScrollBar>
  </ContactDetailSubView>
</template>

<style scoped lang="scss">
.contact-detail-scroller {
  flex: 1;
  height: auto;
  overflow-y: auto;

  :deep(.simplebar-wrapper) {
    height: 100%;
  }
}

.contact-detail-save-area {
  padding: 12px 18px;
  display: flex;
  justify-content: center;
}

.contact-detail-save-btn {
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background-color: $color-primary;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>