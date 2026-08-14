<script>
import { defineComponent } from 'vue'
import AdvancedBox from "./Base/AdvancedBox.vue";

export default defineComponent({
  name: "ActivityMD",
  components: { AdvancedBox },
  props: { json: Object },
  computed: {
    activity() {
      return this.json?.meta?.activity;
    }
  },
  methods: {
    handleButton(e) {
      e.stopPropagation()
    }
  }
})

</script>

<template>
  <AdvancedBox
    class="message-activity-md"
    :footer-icon="activity.tagIcon"
    :footer-text="activity.tag"
    :jump-url="activity.jumpUrl?.jumpUrl"
    :cover-url="activity.preview">
    <p class="desc-text">{{ activity.desc }}</p>
    <a class="activity-md-button"
       v-if="activity.isEnabledButton"
       @click="handleButton"
       :href="activity.buttonJumpUrl?.jumpUrl"
       target="_blank">
      {{ activity.buttonText }}
    </a>
  </AdvancedBox>
</template>

<style scoped lang="scss">
.desc-text {
  font-size: 80%;
  margin: 2px 0;
}

.activity-md-button {
  color: white;
  border-radius: 15px;
  background-color: $color-primary;
  margin: 5px 0 10px 0;
  padding: 5px;
  text-align: center;
  cursor: pointer;
  font-size: 12px;
  display: block;
}
</style>