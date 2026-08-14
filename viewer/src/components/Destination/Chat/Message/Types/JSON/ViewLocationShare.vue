<script>
import { defineComponent } from 'vue'
import AdvancedBox from "@/components/Destination/Chat/Message/Types/JSON/Base/AdvancedBox.vue";

export default defineComponent({
  name: "LocationShare",
  components: { AdvancedBox },
  props: { json: Object },
  computed: {
    loc() {
      return this.json?.meta['Location.Search']
    },
  },
})
</script>

<template>
  <AdvancedBox class="message-location-share" footer-text="位置分享">
    <div class="container">
      <p class="text-truncate">{{ loc.name }}</p>
      <p class="text-muted text-truncate">{{ loc.address }}</p>
    </div>
  </AdvancedBox>
</template>

<style scoped lang="scss">
p {
  margin: 0;
}

.container {
  padding: 5px 5px 0;
}
</style>