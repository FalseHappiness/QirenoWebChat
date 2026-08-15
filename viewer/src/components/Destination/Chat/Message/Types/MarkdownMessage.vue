<template>
  <div class="message-markdown-box" v-html="renderedContent"></div>
</template>

<script>
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 自定义图片渲染器：解析 alt(text) 中的 #width #height 语法
// marked v5+ renderer 函数接收 token 对象 { href, text, title }
const customImageRenderer = (href, text, title) => {
  const sizes = { width: '', height: '' };
  // 匹配 alt 中形如 #900px 或 #900 的标记
  const cleanedAlt = (text || '').replace(/#(\d+(?:\.\d+)?)(px|em|rem|%|pt|mm|cm|in|pc|ex|ch|vw|vh|vmin|vmax)?\s*/gi, (match, value, unit) => {
    const unitStr = unit || 'px';
    if (!sizes.width) {
      sizes.width = value + unitStr;
    } else if (!sizes.height) {
      sizes.height = value + unitStr;
    }
    return '';
  }).trim();

  let imgTag = `<img src="${ href }" alt="${ cleanedAlt }"`;
  if (title) {
    imgTag += ` title="${ title }"`;
  }
  if (sizes.width) {
    imgTag += ` width="${ sizes.width }"`;
  }
  if (sizes.height) {
    imgTag += ` height="${ sizes.height }"`;
  }
  imgTag += '>';
  return imgTag;
};

// 注册自定义图片 renderer（模块加载时只执行一次）
// marked v5+ 的 renderer 函数接收 token 对象，而非展开的参数
marked.use({
  renderer: {
    image(token) {
      return customImageRenderer(token.href, token.text, token.title);
    }
  }
});

export default {
  name: 'MarkdownMessage',
  props: {
    content: {
      type: String,
      required: true,
      default: ''
    },
    // 可选：是否使用 GitHub 风格的 Markdown
    gfm: {
      type: Boolean,
      default: true
    },
    // 可选：是否在表格和代码块中使用更严格的解析
    breaks: {
      type: Boolean,
      // 是否单回车换行
      default: true
    },
    // 可选：是否启用代码高亮
    highlight: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    renderedContent() {
      // 配置 marked 选项
      marked.setOptions({
        gfm: this.gfm,
        breaks: this.breaks,
        highlight: this.highlight ? this.highlightCode : null
      });

      // 渲染 Markdown 并净化 HTML
      const rawMarkdown = marked(this.content || '');
      return DOMPurify.sanitize(rawMarkdown, {
        ADD_ATTR: ['width', 'height']
      });
    }
  },
  methods: {
    // 可选的代码高亮方法
    highlightCode(code, language) {
      // 这里可以集成 highlight.js 或其他高亮库
      // 例如：
      // const hljs = require('highlight.js');
      // try {
      //   return hljs.highlight(language, code).value;
      // } catch (e) {
      //   return hljs.highlightAuto(code).value;
      // }
      return code;
    }
  }
};
</script>

<style scoped lang="scss">
.message-markdown-box {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: $color-text-regular;
  display: block;
  white-space: normal;
  width: 350px;
  max-width: 100%;

  :deep() {
    img {
      max-width: 100%;
      height: auto;
      object-fit: contain;
      border-radius: $radius-sm;
    }

    hr {
      border-top: 1px solid $color-border-markdown-hr;
    }

    h1 {
      font-size: 2em;
      border-bottom: 1px solid $color-border-markdown-heading;
      padding-bottom: 0.3em;
    }

    h2 {
      font-size: 1.5em;
      border-bottom: 1px solid $color-border-markdown-heading;
      padding-bottom: 0.3em;
    }

    p {
      margin: 0;
    }

    a {
      color: $color-text-link-markdown;
      text-decoration: none;
      cursor: pointer;

      &:hover {
        color: $color-text-link-markdown;
        text-decoration: none;
      }
    }

    code {
      background-color: rgba(27, 31, 35, 0.05);
      border-radius: 3px;
      padding: 0.2em 0.4em;
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
    }

    pre {
      background-color: $color-bg-code;
      border-radius: $radius-xs;
      padding: 16px;
      overflow: auto;

      code {
        background-color: transparent;
        padding: 0;
      }
    }

    blockquote {
      border-left: 2px solid $color-bg-card-alt;
      color: $color-text-muted;
      padding: 0 1em;
      margin: 0 0 8px 0;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;

      th, td {
        border: 1px solid $color-border-markdown-table;
        padding: 6px 13px;
      }

      tr {
        background-color: $color-bg-card;
        border-top: 1px solid $color-border-markdown-table-header;

        &:nth-child(2n) {
          background-color: $color-bg-code;
        }
      }
    }

    hr {
      margin: 10px 0;
    }

    /* 针对文档流中DOM上紧跟空a的br */
    a:empty + br {
      display: none;
      visibility: hidden;
      height: 0;
    }
  }
}
</style>