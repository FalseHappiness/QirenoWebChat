<script>
import { defineComponent } from 'vue'
import AdvancedBox from "@/components/Destination/Chat/Message/Types/JSON/Base/AdvancedBox.vue";
import BasicBox from "@/components/Destination/Chat/Message/Types/JSON/Base/BasicBox.vue";

export default defineComponent({
  name: "LocationShare",
  components: { BasicBox, AdvancedBox },
  props: { json: Object },
  computed: {
    loc() {
      return this.json?.meta['Location.Search']
    },
    mapUrl() {
      const { id, name, lng, lat, address } = this.loc
      const params = new URLSearchParams()
      if (id) params.set('id', id)
      if (name) params.set('name', name)
      if (lng) params.set('lng', lng)
      if (lat) params.set('lat', lat)
      if (address) params.set('address', address)
      params.set('zoom', '16')
      params.set('source', 'poi_detail')
      params.set('platform', 'pc')
      return `https://www.amap.com/ssr/embed/place?${params.toString()}`
    }
  },
})
</script>

<template>
  <BasicBox
    class="message-location-share no-darkness-effect"
    :jump-url="mapUrl">
    <div class="container">
      <p class="text-truncate">{{ loc.name }}</p>
      <p class="text-muted text-truncate">{{ loc.address }}</p>
      <iframe
        :src="mapUrl"
        frameborder="0"
        allowfullscreen
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    </div>
  </BasicBox>
</template>

<style scoped lang="scss">
p {
  margin: 0;
}

.container {
  padding: 5px 5px 0;
}

iframe {
  width: 100%;
  height: 300px;
  border: 0;
  border-radius: 0;
  display: block;
  transform: scale(1.11);
  margin: 18px 0 12px;
}
</style>