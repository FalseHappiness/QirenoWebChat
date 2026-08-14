<script>
import QIcon from "@/components/Common/Icons/QIcon.vue";

export default {
  name: "MultiSelectPanel",
  components: { QIcon },
  inject: ["isMultiSelectMessagesMode", "selectedMessagesMap"],
  emits: ["forward-one-by-one", "forward-combine"],
  methods: {
    closeMultiSelect() {
      this.isMultiSelectMessagesMode = false;
      this.selectedMessagesMap = new Map();
    },
    handleForwardOneByOne() {
      if (this.selectedMessagesMap.size === 0) return;
      this.$emit("forward-one-by-one");
      this.closeMultiSelect();
    },
    handleForwardCombine() {
      if (this.selectedMessagesMap.size === 0) return;
      this.$emit("forward-combine");
      this.closeMultiSelect();
    }
  }
}
</script>

<template>
  <div class="message-input-multi-select-panel message-input-panel"
       :class="{ 'display-flex': isMultiSelectMessagesMode }">
    <div class="multi-select-control-btn" @click="handleForwardOneByOne">
      <QIcon name="one_by_one_forward_24"/>
      逐条转发
    </div>
    <div class="multi-select-control-btn" @click="handleForwardCombine">
      <QIcon name="combine_forward_24"/>
      合并转发
    </div>
    <div class="multi-select-control-btn" @click="closeMultiSelect">
      <QIcon name="close_16"/>
      关闭
    </div>
  </div>
</template>

<style scoped lang="scss">
.message-input-panel.message-input-multi-select-panel {
  @include flex-center-children;
  flex-direction: row;
  display: none;
  gap: 24px;
}

.multi-select-control-btn {
  @extend %flex-column, %flex-center-children;
  gap: 8px;
  font-size: 14px;

  svg {
    @include hover-active-bg();
    @include square-size(50px);
    border-radius: $radius-circle;
    background-color: $color-bg-card;
    padding: 14px;
  }
}
</style>