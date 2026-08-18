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
import { isUndefined, isNil } from "@/scripts/types-util.js";
import { showErrorToast, showSuccessToast } from "@/scripts/toast.js";
import { showConfirmBox } from "@/scripts/popup-box-api.js";

const MODEL_KEYS = ['addOptionModel', 'verifyOptionModel', 'verifyQuestionModel', 'verifyAnswerModel', 'memberInvitePolicyModel', 'robotAddOptionModel']

export default {
  name: "GroupAddOption",
  components: {
    CustomScrollBar, EnterArrow, ContactDetailSubView, ARadioGroup, ARadio,
    ASelect, ASelectOption,
  },
  props: {
    group_id: Number,
    adminSettingsData: Object,
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
      initial: {},
    }
  },
  computed: {
    hasUnsavedChanges() {
      if (this.adminSettingsData) {
        return MODEL_KEYS.some(k => this[k] !== this.initial[k])
      }
      return !isUndefined(this.addOptionModel)
        || !isUndefined(this.verifyOptionModel)
        || (!isUndefined(this.verifyQuestionModel) && this.verifyQuestionModel !== '')
        || (!isUndefined(this.verifyAnswerModel) && this.verifyAnswerModel !== '')
        || !isNil(this.memberInvitePolicyModel)
        || !isNil(this.robotAddOptionModel)
    }
  },
  methods: {
    async closeCondition() {
      if (this.saved || !this.hasUnsavedChanges) return true
      return await showConfirmBox("未保存的修改", "您有未保存的修改，确定要离开吗？", "确定离开", "继续编辑")
    },
    snapshotInitial() {
      this.initial = Object.fromEntries(MODEL_KEYS.map(k => [k, this[k]]))
    },
    applySettings(s) {
      if (!s) return
      if (s.add_type === 1) this.addOptionModel = 1
      else if (s.add_type === 2) { this.addOptionModel = 2; this.verifyOptionModel = 2 }
      else if (s.add_type === 3) this.addOptionModel = 3
      else if (s.add_type === 4) { this.addOptionModel = 2; this.verifyOptionModel = 4 }
      else if (s.add_type === 5) { this.addOptionModel = 2; this.verifyOptionModel = 5 }
      if (s.group_question) this.verifyQuestionModel = s.group_question
      if (s.group_answer) this.verifyAnswerModel = s.group_answer
      this.memberInvitePolicyModel = (
        s.member_invite_policy === 'require_approval' ? 2 :
        s.member_invite_policy === 'no_approval' ? 1 :
        s.member_invite_policy === 'no_approval_under_100' ? 3 : 0)
      this.robotAddOptionModel = s.robot_member_switch === 0 ? 0 : s.robot_member_examine === 0 ? 1 : 2
      this.snapshotInitial()
    },
    async handleSave() {
      if (this.saving) return
      this.saving = true
      try {
        if (!isUndefined(this.addOptionModel)) {
          let add_type
          if (this.addOptionModel === 1) add_type = 1
          else if (this.addOptionModel === 2) add_type = isUndefined(this.verifyOptionModel) ? 2 : this.verifyOptionModel
          else if (this.addOptionModel === 3) add_type = 3
          if (add_type !== undefined) {
            const result = await fetchSetGroupAddOption(this.group_id, add_type,
              add_type >= 4 ? (this.verifyQuestionModel || undefined) : undefined,
              add_type === 4 ? (this.verifyAnswerModel || undefined) : undefined)
            if (!checkResponseOK(result)) { showErrorToast("加群方式设置失败: " + (result?.message || '')); return }
          }
        }
        if (!isNil(this.memberInvitePolicyModel)) {
          const result = await fetchSetGroupMemberInvitePolicy(this.group_id, this.memberInvitePolicyModel)
          if (!checkResponseOK(result)) { showErrorToast("邀请权限设置失败: " + (result?.message || '')); return }
        }
        if (!isNil(this.robotAddOptionModel)) {
          const result = await fetchSetGroupRobotAddOption(this.group_id, this.robotAddOptionModel)
          if (!checkResponseOK(result)) { showErrorToast("机器人加群权限设置失败: " + (result?.message || '')); return }
        }
        this.saved = true
        showSuccessToast("设置已保存")
        this.snapshotInitial()
      } catch (e) {
        console.error("Group add option save error:", e)
        showErrorToast("保存失败: " + (e?.message || ''))
      } finally {
        this.saving = false
      }
    }
  },
  watch: {
    adminSettingsData: {
      immediate: true,
      handler(s) { this.applySettings(s) }
    }
  }
}
</script>

<template>
  <ContactDetailSubView title="加群方式" :close-condition="closeCondition">
    <CustomScrollBar class="contact-detail-scroller">
      <!-- 非 SnowLuma 或版本低于1.14.11：显示"不修改"选项 -->
      <template v-if="!adminSettingsData">
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
      </template>

      <!-- SnowLuma 1.14.11+：预填设置，不显示"不修改"选项 -->
      <template v-if="adminSettingsData">
        <ARadioGroup
          class="contact-detail-area with-title area-container"
          data-title="加群方式"
          v-model:value="addOptionModel">
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

          <div class="contact-detail-area display-flex">
            邀请加群权限
            <ASelect v-model:value="memberInvitePolicyModel" size="small">
              <ASelectOption :value="0">不允许邀请</ASelectOption>
              <ASelectOption :value="1">无需审核直接进群</ASelectOption>
              <ASelectOption :value="2">需要管理员审核</ASelectOption>
              <ASelectOption :value="3">100 人内无需审核</ASelectOption>
            </ASelect>
          </div>

          <div class="contact-detail-area display-flex">
            机器人加群权限
            <ASelect v-model:value="robotAddOptionModel" size="small">
              <ASelectOption :value="0">不允许邀请</ASelectOption>
              <ASelectOption :value="1">无需审核直接进群</ASelectOption>
              <ASelectOption :value="2">需要管理员审核</ASelectOption>
            </ASelect>
          </div>
        </template>
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