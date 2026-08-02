<script>
import { defineComponent } from 'vue'
import ForwardMessageContentsViewer from "./ForwardMessageContentsViewer.vue";

export default defineComponent({
  name: "ForwardMessageElement",
  components: { ForwardMessageContentsViewer },
  props: {
    messages: Array
  },
  data() {
    return {
      isShowMessagesViewer: false
    }
  }
})
</script>

<template>
  <div class="message-box-less message-forward-message no-user-select" @click="isShowMessagesViewer = true">
    <ForwardMessageContentsViewer
      :messages="messages"
      v-if="isShowMessagesViewer && messages"
      @close="() => isShowMessagesViewer = false"/>
    <div class="top-side">
      <p class="title text-truncate">
        <slot name="source"></slot>
      </p>
      <slot name="news"></slot>
    </div>
    <div class="footer">
      <hr>
      <span class="forward-message-count">
        <slot name="summary"></slot>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.message-forward-message {
  width: 220px;
  max-width: 100%;
  display: flex;
  @include card($radius-card);
  color: black;
  text-decoration: none !important;
  padding: 10px;
  flex-direction: column;
  justify-content: space-between;
}

hr {
  height: 1px;
  border: 0;
  margin: 5px 0 0 0;
  width: 100%;
  background-color: $color-bg-card-alt;
}

.footer {
  height: 24px;
  white-space: nowrap;
}

.title {
  margin-bottom: 2px;
}

.forward-message-count {
  color: $color-text-muted;
  font-size: 12px;
}

.message-forward-message:deep(.forward-message-preview) {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: $color-text-muted !important;
  overflow: hidden;
  @include text-ellipsis;
}
</style>