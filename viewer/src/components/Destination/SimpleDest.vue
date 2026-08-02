<script>
import { defineComponent } from 'vue'
import QIcon from "@/components/Common/Icons/QIcon.vue";
import { DestKey } from "@/scripts/view-keys.js";

export default defineComponent({
  name: "SimpleDest",
  components: { QIcon },
  inject: ['changeDestView'],
  props: {
    title: {
      default: "目标视图",
      type: String
    }
  },
  methods: {
    goBack() {
      this.changeDestView(DestKey.BLANK)
    }
  }
})
</script>

<template>
  <div class="simple-dest-view">
    <div class="simple-dest-view-header">
      <QIcon name="arrow_left_24" class="simple-dest-view-return" @click="goBack"/>
      {{ title }}
    </div>
    <slot/>
  </div>
</template>

<style scoped lang="scss">
.simple-dest-view {
  display: flex;
  flex-direction: column;
}

.simple-dest-view-header {
  text-align: left;
  border-bottom: 1px solid $color-border;
  padding: 6px 10px;
}

.simple-dest-view-return {
  display: none;
}

@include mobile {
  .simple-dest-view-header {
    @include flex-center;
  }

  .simple-dest-view-return {
    position: absolute;
    display: block;
    left: 8px;
    top: 8px;
    height: $close-btn-size;
    width: $close-btn-size;
    cursor: pointer;
  }
}
</style>