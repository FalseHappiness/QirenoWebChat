<template>
  <div class="inline-keyboard-container">
    <div
      v-for="(row, rowIndex) in rows"
      :key="rowIndex"
      class="inline-keyboard-row"
    >
      <span
        v-for="(button, btnIndex) in row.buttons"
        :key="btnIndex"
        class="inline-keyboard-button"
        :class="button.style === 1 ? 'inline-keyboard-button-primary' : 'inline-keyboard-button-default'"
        :data-bot-app-id="botAppId"
      >
        <span class="inline-keyboard-button-text">{{ button.label }}</span>
      </span>
    </div>
  </div>
</template>

<script>
export default {
  name: "InlineKeyboardMessage",
  props: {
    rows: {
      type: Array,
      required: true,
      default: () => []
    },
    botAppId: {
      type: String,
      default: ''
    }
  },
  methods: {
    adjustFontSizes() {
      const container = this.$el
      if (!container) return

      const MAX_FONT = 15
      const MIN_FONT = 4

      const buttons = container.querySelectorAll('.inline-keyboard-button')
      buttons.forEach(btn => {
        const textSpan = btn.querySelector('.inline-keyboard-button-text')
        if (!textSpan) return

        const btnStyle = window.getComputedStyle(btn)
        const padLeft = parseFloat(btnStyle.paddingLeft)
        const padRight = parseFloat(btnStyle.paddingRight)
        const availableWidth = btn.clientWidth - padLeft - padRight
        if (availableWidth <= 0) return

        // 先设为最大字号检查是否直接适配
        textSpan.style.fontSize = MAX_FONT + 'px'
        if (textSpan.scrollWidth <= availableWidth) return

        // 二分法查找最佳字号
        let low = MIN_FONT
        let high = MAX_FONT
        let best = MIN_FONT

        for (let i = 0; i < 8; i++) {
          const mid = (low + high) / 2
          textSpan.style.fontSize = mid + 'px'
          if (textSpan.scrollWidth <= availableWidth) {
            best = mid
            low = mid
          } else {
            high = mid
          }
        }

        textSpan.style.fontSize = best + 'px'
      })
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.adjustFontSizes()
      this._resizeObserver = new ResizeObserver(() => {
        this.adjustFontSizes()
      })
      const container = this.$el
      if (container) {
        this._resizeObserver.observe(container)
      }
    })
  },
  beforeUnmount() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect()
      this._resizeObserver = null
    }
  },
  watch: {
    rows: {
      handler() {
        this.$nextTick(this.adjustFontSizes)
      },
      deep: true
    }
  }
}
</script>

<style scoped lang="scss">
.inline-keyboard-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  width: 100%;
}

.inline-keyboard-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
}

.inline-keyboard-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: $radius-btn;
  line-height: 1.4;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: background-color $transition-fast, transform 0.1s;
  flex: 1;
  min-width: 0;
  font-weight: bold;
  background-color: $color-bg-card;
  @extend %hover-active-bg;

  &:active {
    transform: scale(0.95);
  }
}

.inline-keyboard-button-text {
  font-size: 15px;
}

.inline-keyboard-button-default {
  color: $color-text-regular;
  border: 1px solid $color-text-muted;
}

.inline-keyboard-button-primary {
  color: $color-primary;
  border: 1px solid $color-primary;
  @include hover-active-bg(rgba(224, 238, 255, 0.8), rgba(224, 238, 255, 0.85));
}
</style>