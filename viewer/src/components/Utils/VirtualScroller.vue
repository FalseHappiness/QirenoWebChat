<template>
  <div class="virtual-scroller" :style="{ height: `${totalHeight}px` }">
    <CustomScrollBar ref="container" class="scroll-container" @scroll="handleScroll">
      <div class="content" :style="{ height: `${totalHeight}px` }">
        <div class="viewport" :style="{ transform: `translateY(${startOffset}px)` }">
          <slot v-for="(item, index) in visibleItems" :key="start + index" :item="item" :index="start + index"></slot>
        </div>
      </div>
    </CustomScrollBar>
  </div>
</template>

<script>
import CustomScrollBar from './CustomScrollBar.vue'

export default {
  name: 'VirtualScroller',
  components: {
    CustomScrollBar
  },
  props: {
    // 数据项数组
    items: {
      type: Array,
      required: true,
      default: () => []
    },
    // 每个项的固定高度（像素）
    itemHeight: {
      type: Number,
      required: true
    },
    // 可选：缓冲区大小（上下各缓冲多少项，默认为5，提高平滑性）
    buffer: {
      type: Number,
      default: 5
    },
  },
  data() {
    return {
      containerHeight: 0, // 容器实际高度（从样式动态获取）
      start: 0, // 可见项起始索引
      end: 0, // 可见项结束索引
      scrollEl: null, // SimpleBar 滚动元素引用
    };
  },
  computed: {
    // 总内容高度
    totalHeight() {
      return this.items.length * this.itemHeight;
    },
    // 可见项数量（基于容器高度 + 缓冲）
    visibleCount() {
      return Math.ceil(this.containerHeight / this.itemHeight) + this.buffer * 2;
    },
    // 实际渲染的可见项
    visibleItems() {
      return this.items.slice(this.start, this.end);
    },
    // 起始偏移（用于translateY）
    startOffset() {
      return this.start * this.itemHeight;
    },
    // 最大滚动距离
    maxScroll() {
      return this.totalHeight - this.containerHeight;
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.scrollEl = this.getScrollElement();
      if (this.scrollEl) {
        this.containerHeight = this.scrollEl.clientHeight;
      }
      this.updateVisibleRange();
    });
    this.initObserver();
  },
  beforeDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  },
  watch: {
    items() {
      this.updateVisibleRange();
    },
    itemHeight() {
      this.updateVisibleRange();
    }
  },
  methods: {
    // 获取 SimpleBar 滚动元素
    getScrollElement() {
      if (!this.scrollEl) {
        this.scrollEl = this.$refs.container?.$el?.querySelector('.simplebar-content-wrapper');
      }
      return this.scrollEl;
    },
    // 滚动距离顶部
    scrollTop() {
      return this.getScrollElement()?.scrollTop || 0;
    },
    // 更新容器高度
    updateContainerHeight() {
      const el = this.getScrollElement();
      if (el) {
        this.containerHeight = el.clientHeight;
      }
    },
    // 处理resize事件
    handleResize() {
      this.updateContainerHeight();
      this.updateVisibleRange();
    },
    // 更新可见项范围
    updateVisibleRange() {
      const scrollTop = this.scrollTop();
      this.start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
      this.end = Math.min(this.items.length, this.start + this.visibleCount);
    },
    // 处理容器滚动事件（通过 CustomScrollBar / SimpleBar 透传）
    handleScroll(event) {
      this.scrollEl = event.target;
      this.containerHeight = event.target.clientHeight;
      this.updateVisibleRange();
    },
    // 初始化观察器
    initObserver() {
      this.observer = new ResizeObserver(() => {
        this.handleResize();
      });
      this.observer.observe(this.$el);
    },

    /**
     * 滚动到指定索引的项
     * @param {number} index - 要滚动到的项目索引
     * @param {Object} [options] - 滚动选项
     * @param {string} [options.behavior='auto'] - 滚动行为 ('auto' 或 'smooth')
     * @param {string} [options.align='center'] - 对齐方式 ('start', 'center', 'end', 'nearest')
     */
    scrollToIndex(index, options = {}) {
      const {
        behavior = 'auto',
        align = 'center'
      } = options;

      // 确保索引在有效范围内
      const validIndex = Math.max(0, Math.min(index, this.items.length - 1));

      // 计算目标滚动位置
      let scrollTop = validIndex * this.itemHeight;

      // 根据对齐方式调整位置
      if (align === 'center') {
        scrollTop = scrollTop - this.containerHeight / 2 + this.itemHeight / 2;
      } else if (align === 'end') {
        scrollTop = scrollTop - this.containerHeight + this.itemHeight;
      } else if (align === 'nearest') {
        const currentScroll = this.scrollTop();
        const itemTop = validIndex * this.itemHeight;
        const itemBottom = itemTop + this.itemHeight;

        if (itemTop < currentScroll) {
          // 项目在当前视口上方，滚动到顶部
          scrollTop = itemTop;
        } else if (itemBottom > currentScroll + this.containerHeight) {
          // 项目在当前视口下方，滚动到底部
          scrollTop = itemBottom - this.containerHeight;
        } else {
          // 项目已经在视口中，不需要滚动
          return;
        }
      }

      // 限制滚动范围
      scrollTop = Math.max(0, Math.min(scrollTop, this.maxScroll));

      // 通过 SimpleBar 滚动元素执行滚动
      const el = this.getScrollElement();
      if (el) {
        el.scrollTo({
          top: scrollTop,
          behavior
        });
      }

      // 立即更新可见范围（不等待滚动动画）
      this.start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
      this.end = Math.min(this.items.length, this.start + this.visibleCount);
    }
  }
};
</script>

<style scoped>
.virtual-scroller {
  position: relative;
  width: 100%;
}

.scroll-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.content {
  position: relative;
}

.viewport {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
</style>
