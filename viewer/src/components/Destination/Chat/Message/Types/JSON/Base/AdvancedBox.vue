<script>
import { defineComponent } from 'vue'
import BasicBox from "./BasicBox.vue";

export default defineComponent({
  name: "AdvancedBox",
  components: { BasicBox },
  props: {
    footerIcon: String,
    footerText: String,
    jumpUrl: { String, default: "" },
    coverUrl: { String, default: "" },
  }
})
</script>

<template>
  <BasicBox :jump-url="jumpUrl" class="advanced-box">
    <img alt="" :src="coverUrl" class="cover-img" v-if="coverUrl"/>
    <div class="advanced-box-container">
      <div class="advanced-box-slot">
        <slot></slot>
      </div>
      <hr>
      <div class="footer">
        <img v-if="footerIcon" alt="" :src="footerIcon">
        <span class="text-muted">{{ footerText }}</span>
      </div>
    </div>
  </BasicBox>
</template>

<style scoped lang="scss">
.advanced-box {
  padding: 0;
}

.cover-img {
  width: 100%;
  max-height: 500px;
  margin: 0;
}

.advanced-box-container {
  padding: 4px 8px;
}

.advanced-box-slot {
  padding: 0 4px;
}

hr {
  height: 0;
  border: 0;
  margin: 4px 0 2px 0;
  width: 100%;
  border-bottom: 1px solid $color-border-light;
}

.footer {
  display: flex;
  align-items: center;
}

.footer img {
  height: 15px;
  width: 15px;
  vertical-align: center;
}

.footer span {
  vertical-align: center;
  margin-left: 5px;
  font-size: 80%;
}
</style>