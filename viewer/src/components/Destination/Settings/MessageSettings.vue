<script>
import { defineComponent } from 'vue'
import { useGlobalStore } from "@/store/global.js";
import { Switch as ASwitch } from "ant-design-vue";
import SimpleDest from "@/components/Destination/SimpleDest.vue";

export default defineComponent({
  name: "MessageSettings",
  components: { SimpleDest, ASwitch },
  setup() {
    const global = useGlobalStore()
    return {
      global,
    }
  }
})
</script>

<template>
  <SimpleDest title="消息设置" class="message-settings-view">
    <div class="message-settings-body">
      <div class="message-settings-item">
        <div class="message-settings-item-label">
          <span class="message-settings-item-title">拉取群聊消息的表情回应</span>
          <span class="message-settings-item-desc">注意：开启后可能会造成性能问题，减慢消息加载速度</span>
        </div>
        <ASwitch v-model:checked="global.messageSettings.fetchEmojiLikes" size="small"/>
      </div>

      <div class="message-settings-item">
        <div class="message-settings-item-label">
          <span class="message-settings-item-title">显示群聊表情回应灰色提示</span>
          <span class="message-settings-item-desc">在消息中显示 <code>group_msg_emoji_like</code> 类型的消息提示</span>
        </div>
        <ASwitch v-model:checked="global.messageSettings.showEmojiLikeNotice" size="small"/>
      </div>
    </div>
  </SimpleDest>
</template>

<style scoped lang="scss">
.message-settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.message-settings-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-settings-item {
  @include card;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.message-settings-item-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.message-settings-item-title {
  font-size: 14px;
  font-weight: 500;
}

.message-settings-item-desc {
  font-size: 12px;
  color: $color-text-muted;

  code {
    font-size: 11px;
    background: $color-bg-hover;
    padding: 1px 4px;
    border-radius: 3px;
  }
}

@include mobile {
  .message-settings-header {
    text-align: center;
  }
}
</style>