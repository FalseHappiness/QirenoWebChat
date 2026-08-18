<script>
import QIcon from "@/components/Common/Icons/QIcon.vue";
import { DestKey } from "@/scripts/view-keys.js";
import { Emitter } from "@/composables/useEventBus.js";

const createCategory = (key, name, icon) => ({ key, name, icon })

export default {
  name: "CollectionNavView",
  components: { QIcon },
  inject: ["changeDestView"],
  data() {
    return {
      activeKey: null,
      categories: [
        createCategory("all", "全部", "all_16")
      ]
    }
  },
  methods: {
    async handleClickCategory(key) {
      if (key === this.activeKey) {
        this.activeKey = null
      } else {
        this.activeKey = key
      }
      this.changeDestView(DestKey.COLLECTION)
      await this.$nextTick()
      Emitter.emit("change-collection-active-category", this.activeKey)
    }
  }
}
</script>

<template>
  <div class="collection-nav-view">
    <h3 class="title">
      收藏
    </h3>
    <div class="collection-nav-category" v-for="{ key, name, icon } in categories"
         :class="{ active: key === activeKey }" @click="handleClickCategory(key)">
      <QIcon :name="icon"/>
      {{ name }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.collection-nav-view {
  flex: 1;
  padding: 10px;
}

.collection-nav-category {
  border-radius: $radius-card;
  @extend %hover-active-bg;
  @extend %flex-row-center;
  padding: 6px 4px;
  cursor: pointer;

  svg {
    @include square-size(24px);
    margin: 0 6px;
  }

  &.active {
    background: $color-bg-active-contact;

    @include active-bg($color-bg-active-contact-pressed);
  }
}
</style>