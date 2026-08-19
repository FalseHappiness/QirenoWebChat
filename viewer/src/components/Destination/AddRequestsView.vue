<script>
import { defineComponent } from 'vue'
import SimpleDest from "@/components/Destination/SimpleDest.vue";
import CustomScrollBar from "@/components/Common/Scrolling/CustomScrollBar.vue";
import {
  fetchAddRequests,
  fetchSetFriendAddRequest,
  fetchSetGroupAddRequest,
  fetchGroupAddRequest,
  fetchDoubtFriendAddRequests,
  fetchApproveDoubtFriendRequest,
  fetchIgnoredGroupAddRequests,
  getUserLogo,
  getGroupLogo,
  checkResponseOK,
} from "@/scripts/backend-api.js";
import { showConfirmBox, showPromptBox } from "@/scripts/popup-box-api.js";
import { showErrorToast, showSuccessToast } from "@/scripts/toast.js";
import { fetchDisplayName, CacheNameKey } from "@/scripts/user-info-util.js";
import { formatRelativeTime } from "@/scripts/util.js";
import { isNil, isNumber, isString } from "@/scripts/types-util.js";

export default defineComponent({
  name: "AddRequestsView",
  components: { SimpleDest, CustomScrollBar },
  data() {
    return {
      activeTab: 'all',
      requests: [],
      loading: false,
      processedFlags: new Set(),
    }
  },
  inject: ['showContactInfo'],
  computed: {
    pendingRequests() {
      return this.requests.filter(r => {
        // 后端返回的 approved 字段：true=已同意，false=已拒绝，undefined=待处理
        if (!isNil(r.approved)) return false
        // 加群请求的 checked 字段：true=已处理，false=未处理
        if (r.checked === true) return false
        return !this.processedFlags.has(r.flag)
      })
    },
    processedRequests() {
      return this.requests.filter(r => {
        if (!isNil(r.approved)) return true
        // 加群请求的 checked 字段：true=已处理
        if (r.checked === true) return true
        return this.processedFlags.has(r.flag)
      })
    },
  },
  methods: {
    async switchTab(tab) {
      if (this.activeTab === tab) return
      this.activeTab = tab
      this.requests = []
      this.processedFlags = new Set()
      await this.loadRequests()
    },
    async loadRequests() {
      this.loading = true
      try {
        let requests = []
        if (this.activeTab === 'all') {
          requests = await fetchAddRequests()
        } else if (this.activeTab === 'group') {
          requests = await fetchGroupAddRequest()
        } else if (this.activeTab === 'doubt') {
          requests = await fetchDoubtFriendAddRequests()
        } else if (this.activeTab === 'ignored') {
          requests = await fetchIgnoredGroupAddRequests()
        }
        this.requests = Array.isArray(requests) ? requests : []
        // 异步加载每个请求的显示名称
        for (const request of this.requests) {
          this.loadUserDisplayName(request)
          if (this.isGroupRequest(request)) {
            this.loadGroupDisplayName(request)
          }
          // group.invite 可能有 invitor_id（邀请者）
          if (request.sub_type === 'invite' && !isNil(request.invitor_id)) {
            this.loadInvitorDisplayName(request)
          }
        }
      } catch (e) {
        console.error('加载请求列表失败:', e)
        showErrorToast('加载请求列表失败')
        this.requests = []
      } finally {
        this.loading = false
      }
    },
    async loadUserDisplayName(request) {
      // 如果后端直接提供了 user_name，直接使用
      if (isString(request.user_name) && request.user_name) {
        request._userDisplayName = request.user_name
        return
      }
      // user_id 只有为整数时才能 fetchDisplayName
      if (isNumber(request.user_id)) {
        try {
          const result = await fetchDisplayName(request.user_id, CacheNameKey.NICKNAME)
          request._userDisplayName = result.name || `用户${request.user_id}`
        } catch {
          request._userDisplayName = `用户${request.user_id}`
        }
      } else {
        // 非整数（字符串），直接显示 user_id 本身
        request._userDisplayName = String(request.user_id)
      }
    },
    async loadInvitorDisplayName(request) {
      // 如果后端直接提供了 invitor_name，直接使用
      if (isString(request.invitor_name) && request.invitor_name) {
        request._invitorDisplayName = request.invitor_name
        return
      }
      // invitor_id 只有为整数时才能 fetchDisplayName
      if (isNumber(request.invitor_id)) {
        try {
          const result = await fetchDisplayName(request.invitor_id, CacheNameKey.NICKNAME)
          request._invitorDisplayName = result.name || `用户${request.invitor_id}`
        } catch {
          request._invitorDisplayName = `用户${request.invitor_id}`
        }
      } else {
        request._invitorDisplayName = String(request.invitor_id)
      }
    },
    async loadGroupDisplayName(request) {
      // 如果后端直接提供了 group_name，直接使用
      if (isString(request.group_name) && request.group_name) {
        request._groupDisplayName = request.group_name
        return
      }
      if (isNumber(request.group_id)) {
        try {
          const result = await fetchDisplayName(request.group_id, CacheNameKey.GROUP)
          request._groupDisplayName = result.name || `群${request.group_id}`
        } catch {
          request._groupDisplayName = `群${request.group_id}`
        }
      } else {
        request._groupDisplayName = String(request.group_id)
      }
    },
    isFriendRequest(request) {
      return request.request_type === 'friend'
    },
    isGroupRequest(request) {
      return request.request_type === 'group'
    },
    isDoubtFriendRequest() {
      return this.activeTab === 'doubt'
    },
    getAvatarUrl(request) {
      // 好友请求显示用户头像，群聊请求也显示发起请求的用户头像
      return getUserLogo(request.user_id)
    },
    getDisplayName(request) {
      return request._userDisplayName || `用户${request.user_id}`
    },
    getGroupName(request) {
      if (this.isGroupRequest(request)) {
        return request._groupDisplayName || `群${request.group_id}`
      }
      return ''
    },
    getInvitorName(request) {
      if (request.sub_type === 'invite' && !isNil(request.invitor_id)) {
        return request._invitorDisplayName || `用户${request.invitor_id}`
      }
      return ''
    },
    getComment(request) {
      return request.comment || ''
    },
    getRequestTime(request) {
      if (request.time) {
        // time 是 Unix 秒级时间戳，formatRelativeTime 需要毫秒级
        return formatRelativeTime(request.time * 1000)
      }
      return ''
    },
    getRequestSubTypeText(request) {
      if (this.isFriendRequest(request)) {
        return '好友请求'
      }
      if (this.isDoubtFriendRequest()) {
        return '可疑好友请求'
      }
      if (request.sub_type === 'invite') {
        return '被邀请加入'
      }
      return '申请加入'
    },
    async handleApprove(request) {
      if (this.isDoubtFriendRequest()) {
        // 可疑好友：弹出确认框是否确认
        const confirmed = await showConfirmBox(
          '确认通过',
          `确定通过「${this.getDisplayName(request)}」的可疑好友请求吗？`,
          '确认通过',
          '取消'
        )
        if (!confirmed) return
        await this.doApproveDoubtFriend(request)
      } else if (this.isFriendRequest(request)) {
        // 好友同意：弹出设置备注，默认值为空字符串，可为空字符串，取消不触发操作
        const remark = await showPromptBox(
          '设置备注',
          `同意好友请求「${this.getDisplayName(request)}」，请输入备注名称：`,
          '输入备注（可选）',
          '',
          '确认添加',
          '取消'
        )
        // 取消返回 null，不触发操作
        if (remark === null) return
        await this.doApproveFriend(request, remark)
      } else {
        // 群聊同意：弹出确认框是否确认
        const confirmed = await showConfirmBox(
          '确认加群',
          `确定同意「${this.getDisplayName(request)}」的加群请求吗？`,
          '确认同意',
          '取消'
        )
        if (!confirmed) return
        await this.doApproveGroup(request)
      }
    },
    async handleReject(request) {
      if (this.isDoubtFriendRequest()) {
        // 可疑好友请求不支持拒绝
        return
      }
      if (this.isFriendRequest(request)) {
        // 好友拒绝：弹出确认框是否确认
        const confirmed = await showConfirmBox(
          '确认拒绝',
          `确定拒绝「${this.getDisplayName(request)}」的好友请求吗？`,
          '确认拒绝',
          '取消'
        )
        if (!confirmed) return
        await this.doRejectFriend(request)
      } else {
        // 群聊拒绝：弹出输入拒绝理由，可为空字符串，取消不触发操作
        const reason = await showPromptBox(
          '拒绝理由',
          `拒绝「${this.getDisplayName(request)}」的加群请求，请输入拒绝理由：`,
          '输入拒绝理由（可选）',
          '',
          '确认拒绝',
          '取消'
        )
        if (reason === null) return
        await this.doRejectGroup(request, reason)
      }
    },
    async doApproveDoubtFriend(request) {
      try {
        const result = await fetchApproveDoubtFriendRequest(request.flag)
        if (checkResponseOK(result)) {
          showSuccessToast(`已通过可疑好友请求：${this.getDisplayName(request)}`)
          this.processedFlags.add(request.flag)
        } else {
          showErrorToast(`通过可疑好友请求失败：${result?.message || ''}`)
        }
      } catch (e) {
        showErrorToast(`通过可疑好友请求失败：${e.message || ''}`)
      }
    },
    async doApproveFriend(request, remark) {
      try {
        const result = await fetchSetFriendAddRequest(request.flag, true, remark, request.user_id)
        if (checkResponseOK(result)) {
          showSuccessToast(`已同意好友请求：${this.getDisplayName(request)}`)
          this.processedFlags.add(request.flag)
        } else {
          showErrorToast(`同意好友请求失败：${result?.message || ''}`)
        }
      } catch (e) {
        showErrorToast(`同意好友请求失败：${e.message || ''}`)
      }
    },
    async doRejectFriend(request) {
      try {
        const result = await fetchSetFriendAddRequest(request.flag, false)
        if (checkResponseOK(result)) {
          showSuccessToast(`已拒绝好友请求：${this.getDisplayName(request)}`)
          this.processedFlags.add(request.flag)
        } else {
          showErrorToast(`拒绝好友请求失败：${result?.message || ''}`)
        }
      } catch (e) {
        showErrorToast(`拒绝好友请求失败：${e.message || ''}`)
      }
    },
    async doApproveGroup(request) {
      try {
        const result = await fetchSetGroupAddRequest(request.flag, true)
        if (checkResponseOK(result)) {
          showSuccessToast(`已同意加群请求：${this.getDisplayName(request)}`)
          this.processedFlags.add(request.flag)
        } else {
          showErrorToast(`同意加群请求失败：${result?.message || ''}`)
        }
      } catch (e) {
        showErrorToast(`同意加群请求失败：${e.message || ''}`)
      }
    },
    async doRejectGroup(request, reason) {
      try {
        const result = await fetchSetGroupAddRequest(request.flag, false, reason)
        if (checkResponseOK(result)) {
          showSuccessToast(`已拒绝加群请求：${this.getDisplayName(request)}`)
          this.processedFlags.add(request.flag)
        } else {
          showErrorToast(`拒绝加群请求失败：${result?.message || ''}`)
        }
      } catch (e) {
        showErrorToast(`拒绝加群请求失败：${e.message || ''}`)
      }
    },
    handleShowContactInfo(event, request, isGroup = false, isInvitor = false) {
      let group, user
      if (isGroup) {
        group = {
          group_id: request.group_id,
          group_name: request._groupDisplayName || request.group_name,
        }
      } else if (isInvitor && !isNil(request.invitor_id)) {
        user = {
          user_id: request.invitor_id,
          nickname: request._invitorDisplayName || request.invitor_name,
        }
      } else {
        user = {
          user_id: request.user_id,
          nickname: request._userDisplayName || request.user_name,
        }
      }
      this.showContactInfo({ user, group, event })
    },
    isNil
  },
  async mounted() {
    await this.loadRequests()
  }
})
</script>

<template>
  <SimpleDest title="请求">
    <div class="add-requests-tabs">
      <div
        class="add-requests-tab"
        :class="{ active: activeTab === 'all' }"
        @click="switchTab('all')"
      >
        全部
      </div>
      <div
        class="add-requests-tab"
        :class="{ active: activeTab === 'group' }"
        @click="switchTab('group')"
      >
        加群请求
      </div>
      <div
        class="add-requests-tab"
        :class="{ active: activeTab === 'doubt' }"
        @click="switchTab('doubt')"
      >
        可疑好友请求
      </div>
      <div
        class="add-requests-tab"
        :class="{ active: activeTab === 'ignored' }"
        @click="switchTab('ignored')"
      >
        忽略的入群请求
      </div>
    </div>
    <CustomScrollBar class="add-requests-scroller">
      <div class="add-requests-container">
        <!-- 加载中 -->
        <div v-if="loading" class="add-requests-loading">
          加载中...
        </div>

        <!-- 无请求 -->
        <div v-else-if="requests.length === 0" class="add-requests-empty">
          <template v-if="activeTab === 'all'">暂无添加请求</template>
          <template v-else-if="activeTab === 'group'">暂无加群请求</template>
          <template v-else-if="activeTab === 'doubt'">无可疑好友请求</template>
          <template v-else>暂无已忽略的入群请求</template>
        </div>

        <!-- 请求列表 -->
        <template v-else>
          <!-- 待处理 -->
          <div v-if="pendingRequests.length > 0" class="add-requests-section">
            <div class="add-requests-section-title">待处理</div>
            <div
              v-for="request in pendingRequests"
              :key="request.flag"
              class="add-request-item"
            >
              <img
                alt=""
                :src="getAvatarUrl(request)"
                class="add-request-logo"
                @click="handleShowContactInfo($event, request)"
              >
              <div class="add-request-info">
                <div class="add-request-top">
                  <span class="add-request-name"
                        @click="handleShowContactInfo($event, request)">{{ getDisplayName(request) }}</span>
                </div>
                <div class="add-request-sub-info">
                  <template v-if="isGroupRequest(request)">
                    <template v-if="request.sub_type === 'invite' && !isNil(request.invitor_id)">
                      被
                      <span class="add-request-invitor-name"
                            @click="handleShowContactInfo($event, request, false, true)"
                      >{{ getInvitorName(request) }}</span>
                      邀请入群
                    </template>
                    <template v-else>
                      {{ getRequestSubTypeText(request) }}群
                    </template>
                    <span class="add-request-group-name"
                          @click="handleShowContactInfo($event, request, true)"
                    >{{ getGroupName(request) }}</span>
                  </template>
                  <template v-else>
                    {{ getRequestSubTypeText(request) }}
                  </template>
                </div>
                <div v-if="getComment(request)" class="add-request-comment">
                  留言：{{ getComment(request) }}
                </div>
                <div class="add-request-time">{{ getRequestTime(request) }}</div>
              </div>
              <div class="add-request-actions">
                <div
                  class="add-request-btn add-request-btn-approve"
                  @click="handleApprove(request)"
                >
                  同意
                </div>
                <div
                  v-if="!isDoubtFriendRequest()"
                  class="add-request-btn add-request-btn-reject"
                  @click="handleReject(request)"
                >
                  拒绝
                </div>
              </div>
            </div>
          </div>

          <!-- 已处理 -->
          <div v-if="processedRequests.length > 0" class="add-requests-section">
            <div class="add-requests-section-title">已处理</div>
            <div
              v-for="request in processedRequests"
              :key="request.flag"
              class="add-request-item processed"
            >
              <img
                alt=""
                :src="getAvatarUrl(request)"
                class="add-request-logo"
                @click="handleShowContactInfo($event, request)"
              >
              <div class="add-request-info">
                <div class="add-request-top">
                  <span class="add-request-name"
                        @click="handleShowContactInfo($event, request)">{{ getDisplayName(request) }}</span>
                </div>
                <div class="add-request-sub-info">
                  <template v-if="isGroupRequest(request)">
                    <template v-if="request.sub_type === 'invite' && !isNil(request.invitor_id)">
                      被
                      <span class="add-request-invitor-name"
                            @click="handleShowContactInfo($event, request, false, true)"
                      >{{ getInvitorName(request) }}</span>
                      邀请入群
                    </template>
                    <template v-else>
                      {{ getRequestSubTypeText(request) }}群
                    </template>
                    <span class="add-request-group-name"
                          @click="handleShowContactInfo($event, request, true)">
                      {{ getGroupName(request) }}
                    </span>
                  </template>
                  <template v-else>
                    {{ getRequestSubTypeText(request) }}
                  </template>
                </div>
                <div v-if="getComment(request)" class="add-request-comment">
                  留言：{{ getComment(request) }}
                </div>
                <div class="add-request-time">{{ getRequestTime(request) }}</div>
                <div class="add-request-processed-label"
                     :class="{ 'add-request-processed-rejected': request.approved === false }">
                  {{ request.approved === true ? '已同意' : request.approved === false ? '已拒绝' : '已处理' }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </CustomScrollBar>
  </SimpleDest>
</template>

<style scoped lang="scss">
.add-requests-tabs {
  display: flex;
  border-bottom: 1px solid $color-border;
  background: $color-bg-card;
  flex-shrink: 0;
}

.add-requests-tab {
  flex: 1;
  text-align: center;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  color: $color-text-muted;
  cursor: pointer;
  user-select: none;
  transition: color $transition-fast, background-color $transition-fast;
  position: relative;
  @extend %flex-center-children;

  &:hover {
    color: $color-text-regular;
    background-color: $color-bg-hover;
  }

  &.active {
    color: $color-primary;
    background-color: $color-bg-card;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 20%;
      right: 20%;
      height: 2px;
      background-color: $color-primary;
      border-radius: 1px;
    }
  }
}

.add-requests-scroller {
  flex: 1;
  height: 100%;
  overflow-y: auto;

  :deep(.simplebar-wrapper) {
    height: 100%;
  }
}

.add-requests-container {
  padding: 8px 0;
}

.add-requests-loading,
.add-requests-empty {
  @extend %state-placeholder;
}

.add-requests-section {
  margin-bottom: 8px;
}

.add-requests-section-title {
  padding: 6px 16px;
  font-size: 12px;
  color: $color-text-muted;
  font-weight: 500;
}

.add-request-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 16px;
  cursor: default;
  transition: background-color $transition-fast;

  &:hover {
    background-color: $color-bg-hover;
  }

  &:active {
    background-color: $color-bg-active;
  }

  &.processed {
    opacity: 0.6;
  }
}

.add-request-logo {
  @include avatar(40px);
  flex-shrink: 0;
  margin-right: 10px;
  margin-top: 2px;
  cursor: pointer;
}

.add-request-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  line-height: 1.4;
}

.add-request-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-request-name {
  font-size: 15px;
  font-weight: 500;
  @include text-ellipsis;
  color: $color-text-primary;
  cursor: pointer;
}

.add-request-sub-info {
  font-size: 12px;
  color: $color-text-muted;
  margin-top: 2px;
}

.add-request-group-name, .add-request-invitor-name {
  color: $color-text-link;
  cursor: pointer;
}

.add-request-invitor-sep {
  color: $color-text-muted;
}

.add-request-comment {
  font-size: 12px;
  color: $color-text-secondary;
  @include text-ellipsis;
  margin-top: 2px;
}

.add-request-time {
  font-size: 11px;
  color: $color-text-meta;
  margin-top: 2px;
}

.add-request-processed-label {
  font-size: 12px;
  color: $color-text-success;
  margin-top: 2px;
}

.add-request-processed-rejected {
  color: $color-text-danger;
}

.add-request-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 10px;
}

.add-request-btn {
  padding: 5px 14px;
  border-radius: $radius-btn;
  font-size: 12px;
  cursor: pointer;
  text-align: center;
  transition: background-color $transition-fast, opacity $transition-fast;
  user-select: none;
  min-width: 48px;

  &:active {
    transform: scale(0.96);
  }
}

.add-request-btn-approve {
  background-color: $color-primary;
  color: $color-text-white;
  border: none;

  &:hover {
    background-color: $color-bg-primary-hover;
  }

  &:active {
    background-color: $color-bg-primary-active;
    color: rgba(255, 255, 255, 0.4);
  }
}

.add-request-btn-reject {
  background-color: $color-bg-card;
  color: $color-text-regular;
  border: 1px solid $color-border-cancel;

  &:hover {
    background-color: $color-bg-hover-alt;
  }

  &:active {
    background-color: $color-bg-active-alt;
    color: $color-text-muted;
  }
}
</style>