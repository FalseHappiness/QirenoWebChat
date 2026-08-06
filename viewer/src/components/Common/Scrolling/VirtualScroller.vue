<template>
  <div class="virtual-scroller" :style="{ height: `${totalHeight}px` }">
    <CustomScrollBar ref="container" class="scroll-container" @scroll="handleScroll">
      <div class="content" :style="{ height: `${totalHeight}px` }">
        <div class="viewport" :style="{ transform: `translateY(${startOffset}px)` }">
          <slot
            v-for="pack in visibleItemsWithMeta"
            :key="pack.originalIndex"
            :item="pack.item"
            :index="pack.originalIndex"
            :isStickyActive="pack.isStickyActive"
          ></slot>
        </div>
      </div>
    </CustomScrollBar>

    <!-- 粘性标题覆盖层 -->
    <div
      v-if="activeHeaderInfo && activeHeaderInfo.stickyOffset > -headerHeight"
      class="sticky-header"
      :style="{
        transform: `translateY(${activeHeaderInfo.stickyOffset}px)`,
        height: `${headerHeight}px`,
        lineHeight: `${headerHeight}px`
      }"
    >
      <slot name="sticky-header" :header="activeHeaderInfo">
        {{ activeHeaderInfo.text }}
      </slot>
    </div>
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
    // 每个普通项的高度（像素）
    itemHeight: {
      type: Number,
      required: true
    },
    // 可选：粘性标题的高度（像素）
    headerHeight: {
      type: Number,
      default: 0
    },
    // 缓冲区大小（上下各缓冲多少项，默认为5）
    buffer: {
      type: Number,
      default: 5
    },
    // 标题字段的键名，用于识别标题项
    headerKey: {
      type: String,
      default: 'header'
    },
  },
  data() {
    return {
      containerHeight: 0,
      start: 0,
      end: 0,
      scrollEl: null,
      scrollTop: 0
    }
  },
  computed: {
    totalHeight() {
      const headersLength = this.headerItems.length
      return headersLength * this.headerHeight + (this.items.length - headersLength) * this.itemHeight
    },
    visibleCount() {
      return Math.ceil(this.containerHeight / this.itemHeight) + this.buffer * 2
    },
    visibleItems() {
      return this.items.slice(this.start, this.end)
    },
    visibleItemsWithMeta() {
      return this.visibleItems.map((item, idx) => {
        const originalIndex = this.start + idx
        return {
          item,
          originalIndex,
          isStickyActive:
            this.activeHeaderInfo !== null &&
            originalIndex === this.activeHeaderInfo.index
        }
      })
    },
    startOffset() {
      return this.start * this.itemHeight
    },
    maxScroll() {
      return this.totalHeight - this.containerHeight
    },
    headerItems() {
      const key = this.headerKey
      return this.items.reduce((headers, item, index) => {
        const text = item[key]
        if (text != null && text !== '') {
          headers.push({ index, text: String(text) })
        }
        return headers
      }, [])
    },
    activeHeaderInfo() {
      const headers = this.headerItems
      if (!headers.length) return null

      const st = this.scrollTop
      let activeIdx = -1
      // 找到最后一个已滚过的标题
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].index * this.itemHeight <= st) {
          activeIdx = i
        } else {
          break
        }
      }
      if (activeIdx === -1) return null

      const current = headers[activeIdx]
      const next = headers[activeIdx + 1] || null
      let stickyOffset = -1

      if (next) {
        const nextTop = next.index * this.itemHeight
        // 下一标题推挤当前标题（使用 headerHeight 作为参考高度）
        if (nextTop - st < this.headerHeight) {
          stickyOffset = Math.max(-this.headerHeight, nextTop - st - this.headerHeight)
        }
      }

      return {
        text: current.text,
        index: current.index,
        stickyOffset
      }
    }
  },
  watch: {
    items() {
      this.updateVisibleRange()
    },
    itemHeight() {
      this.updateVisibleRange()
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.scrollEl = this.getScrollElement()
      if (this.scrollEl) {
        this.containerHeight = this.scrollEl.clientHeight
        this.scrollTop = this.scrollEl.scrollTop || 0
      }
      this.updateVisibleRange()
    })
    this.initObserver()
  },
  beforeDestroy() {
    if (this.observer) {
      this.observer.disconnect()
    }
  },
  methods: {
    getScrollElement() {
      if (!this.scrollEl) {
        this.scrollEl = this.$refs.container?.$el?.querySelector('.simplebar-content-wrapper')
      }
      return this.scrollEl
    },
    updateContainerHeight() {
      const el = this.getScrollElement()
      if (el) {
        this.containerHeight = el.clientHeight
      }
    },
    handleResize() {
      this.updateContainerHeight()
      const el = this.getScrollElement()
      this.scrollTop = el ? el.scrollTop : 0
      this.updateVisibleRange()
    },
    updateVisibleRange() {
      const scrollTop = this.scrollTop
      this.start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer)
      this.end = Math.min(this.items.length, this.start + this.visibleCount)
    },
    handleScroll(event) {
      this.scrollEl = event.target
      this.containerHeight = event.target.clientHeight
      this.scrollTop = event.target.scrollTop
      this.updateVisibleRange()
    },
    initObserver() {
      this.observer = new ResizeObserver(() => {
        this.handleResize()
      })
      this.observer.observe(this.$el)
    },
    scrollToIndex(index, options = {}) {
      const { behavior = 'auto', align = 'center' } = options
      const validIndex = Math.max(0, Math.min(index, this.items.length - 1))
      let scrollTop = validIndex * this.itemHeight

      if (align === 'center') {
        scrollTop = scrollTop - this.containerHeight / 2 + this.itemHeight / 2
      } else if (align === 'end') {
        scrollTop = scrollTop - this.containerHeight + this.itemHeight
      } else if (align === 'nearest') {
        const currentScroll = this.scrollTop
        const itemTop = validIndex * this.itemHeight
        const itemBottom = itemTop + this.itemHeight
        if (itemTop < currentScroll) {
          scrollTop = itemTop
        } else if (itemBottom > currentScroll + this.containerHeight) {
          scrollTop = itemBottom - this.containerHeight
        } else {
          return
        }
      }

      scrollTop = Math.max(0, Math.min(scrollTop, this.maxScroll))
      const el = this.getScrollElement()
      if (el) {
        el.scrollTo({ top: scrollTop, behavior })
      }
      this.start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer)
      this.end = Math.min(this.items.length, this.start + this.visibleCount)
    }
  }
}
</script>

<style scoped lang="scss">
.virtual-scroller {
  position: relative;
  width: 100%;
  overflow: hidden;
  max-height: 100%;
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

.sticky-header {
  z-index: 5;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background: $color-bg-page;
  box-sizing: border-box;
  pointer-events: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: 0 12px;
  border-bottom: 1px solid $color-border;
  color: $color-text-regular;
  will-change: transform;
}

/* 确保滚动条层级高于粘性标题，避免遮挡 */
:deep(.simplebar-track) {
  z-index: 10;
}
</style>