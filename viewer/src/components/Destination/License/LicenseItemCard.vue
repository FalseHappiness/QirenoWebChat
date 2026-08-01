<script>
import { defineComponent } from 'vue'
import CustomScrollBar from '../../Common/Scrolling/CustomScrollBar.vue'

export default defineComponent({
  name: 'LicenseItemCard',
  components: { CustomScrollBar },
  props: {
    item: {
      type: Object,
      required: true
    },
    isSelf: {
      type: Boolean,
      default: false
    },
    expandedKeys: {
      type: Set,
      required: true
    }
  },
  emits: ['toggle-panel'],
  methods: {
    isExpanded(key) {
      return this.expandedKeys.has(key)
    },
    toggle(key) {
      this.$emit('toggle-panel', key)
    },
    getLicenseUrl(license) {
      if (license.repository?.url) return license.repository.url
      if (license.homepage) return license.homepage
      return null
    },
    getAuthorName(license) {
      return license.author?.name || null
    }
  }
})
</script>

<template>
  <div :class="isSelf ? 'license-self-card' : 'license-item-card'">
    <!-- 标题行 -->
    <div :class="isSelf ? 'license-self-header' : 'license-item-header'">
      <span :class="isSelf ? 'license-self-name' : 'license-item-name'">{{ item.name }}</span>
      <span :class="isSelf ? 'license-self-version' : 'license-item-version'">v{{ item.version }}</span>
      <span :class="isSelf ? 'license-self-license-tag' : 'license-item-license-tag'">{{ item.license }}</span>
    </div>

    <!-- 描述 -->
    <p v-if="item.description" :class="isSelf ? 'license-self-desc' : 'license-item-desc'">
      {{ item.description }}
    </p>

    <!-- 作者 / 仓库链接 -->
    <div :class="isSelf ? 'license-self-meta' : 'license-item-meta'">
      <span v-if="getAuthorName(item)" :class="isSelf ? 'license-self-author' : 'license-item-author'">
        作者: {{ getAuthorName(item) }}
      </span>
      <a
        v-if="getLicenseUrl(item)"
        :href="getLicenseUrl(item)"
        target="_blank"
        :class="isSelf ? 'license-self-link' : 'license-item-link'"
      >
        {{ isSelf ? '项目主页 ↗' : '仓库 ↗' }}
      </a>
    </div>

    <!-- 许可证文本展开 -->
    <div v-if="item.licenseText" class="license-expand-area">
      <span class="license-expand-trigger" @click="toggle(item.name)">
        {{ isExpanded(item.name) ? '收起许可证文本' : '展开许可证文本' }}
        <span class="license-expand-arrow" :class="{ expanded: isExpanded(item.name) }">▼</span>
      </span>
      <CustomScrollBar
        v-if="isExpanded(item.name)"
        class="license-text-scroll"
      >
        <pre class="license-text-block">{{ item.licenseText }}</pre>
      </CustomScrollBar>
    </div>

    <!-- NOTICE 文本展开（仅依赖项存在） -->
    <div v-if="!isSelf && item.noticeText" class="license-expand-area">
      <span class="license-expand-trigger" @click="toggle(item.name + '-notice')">
        {{ isExpanded(item.name + '-notice') ? '收起 NOTICE 文本' : '展开 NOTICE 文本' }}
        <span class="license-expand-arrow" :class="{ expanded: isExpanded(item.name + '-notice') }">▼</span>
      </span>
      <CustomScrollBar
        v-if="isExpanded(item.name + '-notice')"
        class="license-text-scroll"
      >
        <pre class="license-text-block license-notice-block">{{ item.noticeText }}</pre>
      </CustomScrollBar>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ---- 项目自身卡片 ---- */
.license-self-card {
  @extend %card-column;
}

.license-self-header {
  @extend %header-row;
}

.license-self-name {
  font-size: 16px;
  font-weight: 600;
  color: $color-primary;
}

.license-self-version {
  font-size: 13px;
  color: $color-text-muted;
}

.license-self-desc {
  margin: 0;
  font-size: 13px;
  color: $color-text-note;
  line-height: 1.5;
}

.license-self-meta {
  @extend %meta-row;
}

.license-self-license-tag {
  @include tag-badge($color-tag-green-bg, $color-tag-green-text);
}

.license-self-author {
  font-size: 13px;
  color: $color-text-muted;
}

.license-self-link {
  font-size: 13px;
  color: $color-primary;
  text-decoration: none;
  align-self: flex-start;
  @extend %link-hover-underline;
}

/* ---- 依赖项卡片 ---- */
.license-item-card {
  @extend %card-column;
}

.license-item-header {
  @extend %header-row;
  flex-wrap: wrap;
}

.license-item-name {
  font-size: 15px;
  font-weight: 500;
  color: $color-text-regular;
  word-break: break-all;
}

.license-item-version {
  font-size: 12px;
  color: $color-text-muted;
}

.license-item-license-tag {
  @include tag-badge($color-tag-blue-bg, $color-tag-blue-text, 11px);
  padding: 1px 6px;
}

.license-item-desc {
  margin: 0;
  font-size: 13px;
  color: $color-text-note;
  line-height: 1.5;
}

.license-item-meta {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  flex-wrap: wrap;
}

.license-item-author {
  font-size: 12px;
  color: $color-text-muted;
}

.license-item-link {
  font-size: 12px;
  color: $color-primary;
  text-decoration: none;
  @extend %link-hover-underline;
}

/* ---- 展开/收起（共用） ---- */
.license-expand-area {
  margin-top: 0;
}

.license-expand-trigger {
  font-size: 12px;
  color: $color-primary;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: $spacing-xs;
  cursor: pointer;
}

.license-expand-arrow {
  display: inline-block;
  font-size: 10px;
  transition: transform $transition-normal ease;
}

.license-expand-arrow.expanded {
  transform: rotate(180deg);
}

.license-text-scroll {
  max-height: 300px;
  margin-top: $spacing-sm;
  border: 1px solid $color-border-code;
  border-radius: $radius-btn;
}

.license-text-block {
  @include code-block;
}

.license-notice-block {
  border-color: $color-border-notice;
  background-color: $color-bg-notice-warning;
}
</style>