<script>
import { defineComponent } from 'vue'
import SimpleDest from "@/components/Destination/SimpleDest.vue"
import { themeList, changeTheme, getTheme } from "@/scripts/theme.js"
import QIcon from "@/components/Common/Icons/QIcon.vue";

export default defineComponent({
  name: "ThemeSelector",
  components: { QIcon, SimpleDest },
  data() {
    return {
      themeList,
    }
  },
  computed: {
    currentTheme() {
      return getTheme()
    }
  },
  methods: {
    changeTheme
  }
})
</script>

<template>
  <SimpleDest class="theme-selector" title="主题设置">
    <div class="theme-selector-body">
      <p class="theme-selector-hint">选择您喜欢的主题风格</p>

      <div class="theme-list">
        <div
          v-for="theme in themeList"
          :key="theme.id"
          class="theme-item"
          :class="{ active: currentTheme === theme.id }"
          @click="changeTheme(theme.id)"
          role="button"
          tabindex="0"
          @keydown.enter="changeTheme(theme.id)"
          @keydown.space.prevent="changeTheme(theme.id)"
        >
          <div class="theme-item-preview" :data-theme="theme.id">
            <div class="preview-header">
              <div class="preview-dot"></div>
              <div class="preview-bar"></div>
            </div>
            <div class="preview-body">
              <div class="preview-line preview-line--short"></div>
              <div class="preview-line preview-line--long"></div>
              <div class="preview-bubble preview-bubble--in"></div>
              <div class="preview-bubble preview-bubble--out"></div>
            </div>
          </div>

          <div class="theme-item-info">
            <span class="theme-item-name">{{ theme.name }}</span>
            <span v-if="theme.description" class="theme-item-desc">{{ theme.description }}</span>
          </div>

          <div v-if="currentTheme === theme.id" class="theme-item-check">
            <QIcon name="tick_24"/>
          </div>
        </div>
      </div>
    </div>
  </SimpleDest>
</template>

<style scoped lang="scss">
.theme-selector {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.theme-selector-body {
  padding: $spacing-lg;
  overflow-y: auto;
  flex: 1;
}

.theme-selector-hint {
  color: $color-text-secondary;
  font-size: 14px;
  margin: 0 0 $spacing-lg;
  line-height: 1.5;
}

// ---- 主题列表 ----
.theme-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

// ---- 单个主题项 ----
.theme-item {
  @include card;
  @include hover-active-bg;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-md;
  cursor: pointer;
  border: 1.5px solid $color-border;
  border-radius: $radius-card;
  transition: border-color $transition-fast, box-shadow $transition-fast;
  outline: none;
  user-select: none;

  &:focus-visible {
    border-color: $color-primary;
    box-shadow: 0 0 0 2px $color-primary-light;
  }

  &.active {
    border-color: $color-primary;
    box-shadow: 0 0 0 1px $color-primary-light;
  }
}

// ---- 主题预览（迷你卡片） ----
.theme-item-preview {
  flex-shrink: 0;
  width: 64px;
  border-radius: $radius-sm;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid $color-border-faint;
  background-color: $color-bg-page;

  .preview-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    background-color: $color-bg-card;
    border-bottom: 1px solid $color-border;

    .preview-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: $color-primary;
    }

    .preview-bar {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background-color: $color-bg-hover;
    }
  }

  .preview-body {
    flex: 1;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;

    .preview-line {
      height: 3px;
      border-radius: 2px;
      background-color: $color-bg-hover;
    }

    .preview-line--short {
      width: 40%;
    }

    .preview-line--long {
      width: 70%;
    }

    .preview-bubble {
      height: 8px;
      border-radius: 4px;
      margin-top: 2px;
    }

    .preview-bubble--in {
      width: 50%;
      background-color: $color-bg-message-in;
      border: 1px solid $color-border-faint;
    }

    .preview-bubble--out {
      width: 45%;
      margin-left: auto;
      background-color: $color-bg-message-out;
      border: 1px solid $color-border-faint;
    }
  }
}

// ---- 主题信息 ----
.theme-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-item-name {
  @extend %text-ellipsis;
  font-size: 15px;
  font-weight: 500;
  color: $color-text-primary;
  line-height: 1.4;
}

.theme-item-desc {
  @extend %text-ellipsis;
  font-size: 12px;
  color: $color-text-muted;
  line-height: 1.4;
}

// ---- 选中标记 ----
.theme-item-check {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-primary;
  animation: check-pop $transition-slow ease;
}

@keyframes check-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

// ---- 响应式 ----
@include mobile {
  .theme-selector-body {
    padding: $spacing-md;
  }

  .theme-item {
    padding: $spacing-sm $spacing-md;
  }
}
</style>