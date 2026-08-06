<script>
import { defineComponent } from 'vue'
import BasicBoxWithFooter from "@/components/Destination/Chat/Message/Types/JSON/Base/BasicBoxWithFooter.vue";

export default defineComponent({
  name: "LocationShare",
  components: { BasicBoxWithFooter },
  props: { json: Object },
  computed: {
    loc() {
      return this.json?.meta['Location.Search']
    },
  },
})
</script>

<template>
  <BasicBoxWithFooter class="message-location-share" footer-text="位置分享">
    <div class="container">
      <p class="text-truncate">{{ loc.name }}</p>
      <p class="text-muted text-truncate">{{ loc.address }}</p>
    </div>
  </BasicBoxWithFooter>
</template>

<style scoped lang="scss">
p {
  margin: 0;
}

.container {
  padding: 5px 5px 0;
}
</style>