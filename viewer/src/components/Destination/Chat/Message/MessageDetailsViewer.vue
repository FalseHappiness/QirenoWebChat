<script>
import SimpleWindow from "@/components/Common/Overlay/SimpleWindow.vue";
import CustomScrollBar from "@/components/Common/Scrolling/CustomScrollBar.vue";
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';

export default {
  name: "MessageDetailsViewer",
  components: { CustomScrollBar, SimpleWindow, VueJsonPretty },
  props: {
    event: Object
  },
  data() {
    return {
      activeTab: "json-viewer"
    }
  }
}
</script>

<template>
  <SimpleWindow title="消息详情" :height="600" :width="500" class="message-details-viewer">
    <CustomScrollBar class="scroller">
      <div class="section-header">消息事件</div>
      <div class="view-tabs">
        <button
          class="view-tab"
          :class="{ active: activeTab === 'json-viewer' }"
          @click="activeTab = 'json-viewer'"
        >
          JSON 查看器
        </button>
        <button
          class="view-tab"
          :class="{ active: activeTab === 'raw-json' }"
          @click="activeTab = 'raw-json'"
        >
          原始 JSON
        </button>
      </div>
      <div v-if="activeTab === 'json-viewer'" class="tab-content">
        <VueJsonPretty :data="event" :indent="4" :collapsedNodeLength="2" :deep="2"
                       showLength showLine theme="dark" :showDoubleQuotes="false" showIcon/>
      </div>
      <div v-else-if="activeTab === 'raw-json'" class="tab-content raw-json-content">
        <pre class="raw-json-pre">{{ JSON.stringify(event, null, 2) }}</pre>
      </div>
    </CustomScrollBar>
  </SimpleWindow>
</template>

<style scoped lang="scss">
.message-details-viewer {
  @extend %flex-column;
}

.scroller {
  flex: 1;
  padding: 10px 20px;
  overflow: auto;
}

.section-header {
  font-size: 14px;
  font-weight: 600;
  color: $color-text-primary;
  margin-bottom: 8px;
}

.view-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 8px;
  background: $color-bg-hover;
  border-radius: $radius-btn;
  overflow: hidden;
}

.view-tab {
  flex: 1;
  padding: 5px 12px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: $color-text-secondary;
  cursor: pointer;
  transition: background $transition-fast, color $transition-fast;
  white-space: nowrap;

  &:hover {
    color: $color-text-primary;
    background: $color-bg-hover-light;
  }

  &.active {
    color: $color-primary;
    background: $color-bg-active;
    font-weight: 600;
  }
}

.tab-content {
  margin-top: 4px;
  background: #1e1e1e;
  border-radius: $radius-btn;
  color: #d4d4d4;
}

.raw-json-content {
  overflow: hidden;
}

.raw-json-pre {
  margin: 0;
  padding: 12px 16px;
  font-size: 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
  line-height: 1.6;
  color: #d4d4d4;
  white-space: pre;
  word-wrap: normal;
  overflow-x: auto;
  tab-size: 2;
}
</style>