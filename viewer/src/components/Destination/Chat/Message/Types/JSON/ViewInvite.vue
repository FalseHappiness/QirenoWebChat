<script>
import { defineComponent } from 'vue'
import BasicBoxWithFooter from "./Base/BasicBoxWithFooter.vue";

export default defineComponent({
  name: "ViewInviteMsg",
  components: { BasicBoxWithFooter },
  props: { json: Object },
  computed: {
    invite() {
      return this.json?.meta?.invite
    },
  },
})
</script>

<template>
  <BasicBoxWithFooter
    class="message-view-invite-msg"
    :footer-text="invite.title">
    <p class="summary text-truncate">{{ invite.summary }}</p>
    <img class="cover" alt="" :src="invite.cover">
    <div class="button">{{ invite.button }}</div>
  </BasicBoxWithFooter>
</template>

<style scoped lang="scss">
.message-view-invite-msg {
  width: 270px;
  max-width: 100%;
  text-decoration: none !important;
  padding: 8px 8px 2px !important;
  @include card();
  color: $color-text-primary;
  @extend %flex-column;
  justify-content: space-between;
}

.summary {
  margin-bottom: 5px;
}

.cover {
  width: 100%;
  height: auto;
  border-radius: $radius-card;
}

.button {
  text-align: center;
  color: $color-text-link;
  padding: 5px;
}
</style>