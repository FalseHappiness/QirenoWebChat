<script>
import { defineComponent } from 'vue'
import { checkResponseOK, fetchGroupSignedList, fetchSetGroupSign, getUserLogo } from "@/scripts/backend-api.js"
import { CacheNameKey, fetchDisplayName } from "@/scripts/user-info-util.js"
import CustomScrollBar from "../../../Common/Scrolling/CustomScrollBar.vue"
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue"
import { showSuccessToast } from "@/scripts/toast.js"

export default defineComponent({
  name: "GroupSignView",
  components: { SimpleWindow, CustomScrollBar },
  inject: {
    selfId: { default: null },
    activeContact: { default: null }
  },
  data() {
    return {
      signedList: [],
      loading: true,
      signing: false,
      userNameMap: {}
    }
  },
  computed: {
    group_id() {
      return this.activeContact?.contact_id
    },
    hasSigned() {
      if (!this.selfId) return false
      return this.signedList.some(item => item.user_id === this.selfId)
    },
    signDisabled() {
      return this.loading || this.hasSigned || this.signing
    },
    signButtonText() {
      if (this.loading) return '加载中'
      if (this.hasSigned) return '已打卡'
      return '打卡'
    },
    /** 带排名的打卡列表（按时间升序，先打卡的排名靠前） */
    rankedList() {
      return this.signedList.map((item, index) => ({
        ...item,
        rank: index + 1
      }))
    }
  },
  watch: {
    signedList: {
      handler(newVal) {
        newVal.forEach(async item => {
          if (!this.userNameMap[item.user_id]) {
            const result = await fetchDisplayName(
              [this.group_id, item.user_id],
              CacheNameKey.GROUP_USER
            )
            if (result?.name) {
              this.userNameMap[item.user_id] = result.name
            }
          }
        })
      },
      immediate: true,
      deep: true
    }
  },
  methods: {
    getAvatarUrl(user_id) {
      return getUserLogo(user_id)
    },
    getCachedName(user_id) {
      return this.userNameMap[user_id] || `用户${user_id}`
    },
    getRankClass(rank) {
      if (rank === 1) return 'rank-gold'
      if (rank === 2) return 'rank-silver'
      if (rank === 3) return 'rank-bronze'
      return ''
    },
    hasRankCircle(rank) {
      return rank <= 3
    },
    async loadSignedList() {
      if (!this.group_id) return
      this.loading = true
      try {
        this.signedList = await fetchGroupSignedList(this.group_id)
      } catch (e) {
        console.error('获取打卡列表失败', e)
        this.signedList = []
      } finally {
        this.loading = false
      }
    },
    async handleSign() {
      if (this.signDisabled) return
      this.signing = true
      try {
        const result = await fetchSetGroupSign(this.group_id)
        if (checkResponseOK(result)) {
          showSuccessToast('打卡成功')
        } else {
          throw new Error(JSON.stringify(result))
        }
        await this.loadSignedList()
      } catch (e) {
        console.error('打卡失败', e)
      } finally {
        this.signing = false
      }
    }
  },
  mounted() {
    this.loadSignedList()
  }
})
</script>

<template>
  <SimpleWindow
    class="group-sign-viewer"
    :width="420"
    :height="520"
    title="群打卡">
    <div class="group-sign-header">
      <span class="group-sign-count">共 {{ signedList.length }} 人打卡</span>
      <span class="group-sign-header-actions">
        <button
          class="group-sign-refresh-btn"
          :disabled="loading"
          @click="loadSignedList">
          ↻
        </button>
        <button
          class="group-sign-btn"
          :class="{ 'signed': hasSigned }"
          :disabled="signDisabled"
          @click="handleSign">
          {{ signButtonText }}
        </button>
      </span>
    </div>
    <CustomScrollBar class="group-sign-list">
      <div class="group-sign-list-container">
        <div v-if="!loading && !signedList.length" class="group-sign-empty">
          暂无打卡记录
        </div>
        <div v-if="loading" class="group-sign-loading">
          加载中...
        </div>
        <div
          v-for="item in rankedList"
          :key="item.user_id"
          class="group-sign-item"
          :class="{ 'is-self': item.user_id === selfId }">
        <span v-if="hasRankCircle(item.rank)" class="group-sign-rank-circle" :class="getRankClass(item.rank)">
          <span class="group-sign-rank-text">{{ item.rank }}</span>
        </span>
          <span v-else class="group-sign-rank-plain">{{ item.rank }}</span>
          <img
            class="group-sign-avatar"
            :src="getAvatarUrl(item.user_id)"
            alt=""
            loading="lazy">
          <span class="group-sign-name overflow-ellipsis">
          {{ getCachedName(item.user_id) }}
        </span>
        </div>
      </div>
    </CustomScrollBar>
  </SimpleWindow>
</template>

<style scoped lang="scss">
.group-sign-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
}

.group-sign-count {
  font-size: 13px;
  color: $color-text-muted;
}

.group-sign-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-sign-refresh-btn {
  @include btn-icon;
  width: 28px;
  height: 28px;
  font-size: 16px;
  line-height: 1;
  border-radius: $radius-btn;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.group-sign-btn {
  @include btn-primary;
  padding: 4px 16px;
  font-size: 13px;
  min-width: 64px;

  &.signed {
    background-color: $color-bg-card;
    color: $color-text-muted;
    border: 1px solid $color-border;
    cursor: not-allowed;

    &:hover {
      background-color: $color-bg-card;
    }
  }
}

.group-sign-list {
  flex: 1;
  padding: 0 10px 10px;
  overflow: auto;
}

.group-sign-list-container {
  @extend %flex-column;
  gap: 4px;
}

.group-sign-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: $radius-sm;
  gap: 10px;
  @include hover-bg;

  &.is-self {
    background-color: $color-primary-light;

    &:hover {
      background-color: $color-primary-mid-light;
    }
  }
}

/* 排名 1-3 实心圆圈 */
.group-sign-rank-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;

  &.rank-gold {
    background-color: $color-rank-gold-bg;
  }

  &.rank-silver {
    background-color: $color-rank-silver-bg;
  }

  &.rank-bronze {
    background-color: $color-rank-bronze-bg;
  }
}

.group-sign-rank-text {
  font-size: 12px;
  font-weight: 700;
  color: $color-text-white;
  line-height: 1;
}

/* 排名 4+ 纯文本 */
.group-sign-rank-plain {
  width: 24px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: $color-text-muted;
  flex-shrink: 0;
}

.group-sign-avatar {
  @include avatar(36px);
  display: block;
}

.group-sign-name {
  @extend %text-ellipsis;
  flex: 1;
  font-size: 14px;
  color: $color-text-regular;
}

.group-sign-empty,
.group-sign-loading {
  text-align: center;
  padding: 40px 0;
  font-size: 14px;
  color: $color-text-muted;
}
</style>