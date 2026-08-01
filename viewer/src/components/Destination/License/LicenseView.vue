<script>
import { defineComponent } from 'vue'
import LoadingSpinner from '../../Common/Widgets/LoadingSpinner.vue'
import CustomScrollBar from '../../Common/Scrolling/CustomScrollBar.vue'
import LicenseItemCard from './LicenseItemCard.vue'
import QIcon from "../../Common/Icons/QIcon.vue";
import { DestKey } from "@/scripts/view-keys.js";

export default defineComponent({
  name: "LicenseView",
  components: { QIcon, LoadingSpinner, CustomScrollBar, LicenseItemCard },
  data() {
    return {
      licenses: [],
      devLicenses: [],
      loading: true,
      error: null,
      // 改为 Set，记录所有当前展开的面板 key
      expandedKeys: new Set()
    }
  },
  inject: ['changeDestView'],
  computed: {
    projectSelf() {
      return this.licenses.find(item => item.self === true) || null
    },
    runtimeDeps() {
      return this.licenses.filter(item => item.self !== true)
    }
  },
  async mounted() {
    try {
      const [prodRes, devRes] = await Promise.all([
        fetch('./licenses.json'),
        fetch('./licenses-dev.json')
      ])
      if (!prodRes.ok) throw new Error(`加载 licenses.json 失败: ${prodRes.status}`)
      if (!devRes.ok) throw new Error(`加载 licenses-dev.json 失败: ${devRes.status}`)
      this.licenses = await prodRes.json()
      this.devLicenses = await devRes.json()
    } catch (e) {
      this.error = e.message
    } finally {
      this.loading = false
    }
  },
  methods: {
    // 切换任意面板的展开/收起
    togglePanel(key) {
      const newSet = new Set(this.expandedKeys)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      this.expandedKeys = newSet
    },
    getLicenseUrl(license) {
      if (license.repository?.url) {
        return license.repository.url
      }
      if (license.homepage) {
        return license.homepage
      }
      return null
    },
    getAuthorName(license) {
      if (license.author?.name) return license.author.name
      return null
    },
    goBack() {
      this.changeDestView(DestKey.BLANK)
    }
  }
})
</script>

<template>
  <div class="license-view">
    <div class="license-view-header">
      <QIcon name="arrow_left_24" class="license-view-return" @click="goBack"/>
      开放源代码许可证
    </div>
    <!-- 加载状态 -->
    <div v-if="loading" class="license-loading-area">
      <LoadingSpinner text="正在加载许可证信息..."/>
    </div>
    <!-- 错误状态 -->
    <div v-else-if="error" class="license-error-area">
      <div class="license-error-card">
        <span class="license-error-icon">⚠️</span>
        <p class="license-error-text">{{ error }}</p>
      </div>
    </div>
    <CustomScrollBar class="flex-1 overflow-auto" v-else>
      <div class="license-view-container">
        <!-- 项目自身信息 -->
        <LicenseItemCard
          v-if="projectSelf"
          :item="projectSelf"
          :is-self="true"
          :expanded-keys="expandedKeys"
          @toggle-panel="togglePanel"
        />

        <!-- QQ 资源声明 -->
        <div class="license-qq-notice">
          <div class="license-qq-notice-body">
            <p>本项目前端界面参考了 QQ 的视觉风格，并使用了部分 QQ 的图标、表情、字体及动画资源。</p>
            <p><strong>QQ 所有资源</strong>，其所有权归属于腾讯公司或其相关权利人。</p>
            <p class="license-qq-notice-legal">本项目的 QQ 相关资源仅作<strong>个人学习与开发测试</strong>之用，不主张任何权利，也不用于商业目的。若您认为资源使用不当，请联系我们，我们会尽快替换或移除。
            </p>
          </div>
        </div>

        <!-- 运行时依赖 -->
        <div class="license-section">
          <div class="license-section-header">
            <span class="license-section-title">运行时依赖</span>
            <span class="license-section-count">{{ runtimeDeps.length }} 个包</span>
          </div>
          <div v-if="runtimeDeps.length === 0" class="license-empty-hint">暂无生产依赖</div>
          <LicenseItemCard
            v-for="item in runtimeDeps"
            :key="item.name"
            :item="item"
            :expanded-keys="expandedKeys"
            @toggle-panel="togglePanel"
          />
        </div>

        <!-- 开发依赖 -->
        <div class="license-section">
          <div class="license-section-header">
            <span class="license-section-title">开发依赖</span>
            <span class="license-section-count">{{ devLicenses.length }} 个包</span>
          </div>
          <div v-if="devLicenses.length === 0" class="license-empty-hint">暂无开发依赖</div>
          <LicenseItemCard
            v-for="item in devLicenses"
            :key="item.name"
            :item="item"
            :expanded-keys="expandedKeys"
            @toggle-panel="togglePanel"
          />
        </div>
      </div>
    </CustomScrollBar>
  </div>
</template>

<style scoped lang="scss">
.license-view {
  display: flex;
  flex-direction: column;
}

.license-view-header {
  text-align: left;
  border-bottom: 1px solid $color-border;
  padding: 6px 10px;
}

.license-view-return {
  display: none;
}

@media (max-width: 570px) {
  .license-view-header {
    text-align: center;
  }

  .license-view-return {
    position: absolute;
    display: block;
    left: 8px;
    top: 8px;
    height: 20px;
    width: 20px;
    cursor: pointer;
  }
}

.license-view-container {
  font-size: 15px;
  padding: 12px;
  gap: 12px;
  display: flex;
  flex-direction: column;
}

/* ---- 加载 & 错误 ---- */
.license-loading-area,
.license-error-area {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.license-error-card {
  border-radius: 8px;
  background-color: white;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.license-error-icon {
  font-size: 28px;
}

.license-error-text {
  margin: 0;
  color: $color-text-danger;
  font-size: 14px;
  text-align: center;
}

/* ---- 分区 ---- */
.license-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.license-section-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0 4px;
}

.license-section-title {
  font-size: 15px;
  font-weight: 600;
  color: $color-text-regular;
}

.license-section-count {
  font-size: 12px;
  color: $color-text-light;
}

.license-empty-hint {
  border-radius: 8px;
  background-color: $color-bg-card;
  padding: 16px;
  text-align: center;
  color: $color-text-light;
  font-size: 14px;
}

/* ---- QQ 资源声明 ---- */
.license-qq-notice {
  border-radius: 10px;
  background-color: $color-bg-card;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.license-qq-notice-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.license-qq-notice-body p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #3a5a7a;
}

.license-qq-notice-legal {
  margin-top: 4px;
  padding: 8px 10px;
  background-color: #f0f7ff;
  border: 1px solid #d0e3f7;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
}
</style>