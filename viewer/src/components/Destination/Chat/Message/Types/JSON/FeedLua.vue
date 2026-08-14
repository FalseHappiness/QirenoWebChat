<script>
import { defineComponent } from 'vue'
import AdvancedBox from "./Base/AdvancedBox.vue";

export default defineComponent({
  name: "FeedLua",
  components: { AdvancedBox },
  props: { json: Object },
  computed: {
    feed() {
      return this.json?.meta?.feed;
    }
  }
})
</script>

<template>
  <AdvancedBox
    class="message-feed-lua"
    :footer-icon="feed.tagIcon"
    :footer-text="feed.tagName"
    :jump-url="feed.jumpUrl"
    :cover-url="feed.cover">
    <p class="forward-message-text text-muted">{{ feed.forwardMessage }}</p>
    <p class="title-text">{{ feed.title }}</p>
  </AdvancedBox>
</template>

<style scoped>
.forward-message-text {
  font-size: 80%;
}

p {
  margin: 0;
}
</style>