<script>
import AdvancedBox from "./JSON/Base/AdvancedBox.vue";
import { isArray, isUndefined } from "@/scripts/types-util.js";
import { formatFileSize } from "./FileMessage.vue";
import { fetchFlashFileList, fetchFlashShareLink } from "@/scripts/backend-api.js";
import { qqWebFile } from "@/composables/useBase.js";

export default {
  name: "FlashTransferMessage",
  methods: {
    qqWebFile,
    coverError(e) {
      e.target.src = this.defaultCover;
    }
  },
  components: { AdvancedBox },
  props: {
    fileSetId: String,
    title: { type: String, default: "" },
    thumb: { type: String, default: undefined },
  },
  data() {
    return {
      shareLink: undefined,
      fileList: undefined,
      defaultCover: qqWebFile('flash_transfer', 'default_cover.png')
    }
  },
  computed: {
    info() {
      const files = this.fileList
      if (isUndefined(files)) {
        return "获取信息中"
      }
      if (!isArray(files)) {
        return "无有效信息"
      }
      return `${
        formatFileSize(
          files.reduce((size, file) => size + Number(file.size), 0)
        )
      } • ${ files.length } 项`
    }
  },
  async mounted() {
    const fileList = this.fileList = await fetchFlashFileList(this.fileSetId);
    const shareUrl = fileList?.[0]?.share_url
    if (shareUrl) {
      this.shareLink = shareUrl
    } else {
      this.shareLink = await fetchFlashShareLink(this.fileSetId);
    }
  }
}
</script>

<template>
  <AdvancedBox
    class="message-flash-transfer"
    footer-icon="https://qfile.qq.com/favicon.ico"
    footer-text="QQ 闪传"
    :jump-url="shareLink"
    :cover-url="thumb || defaultCover"
    @cover-error="coverError">
    <p class="title">{{ title }}</p>
    <p class="text-muted">{{ info }}</p>
  </AdvancedBox>
</template>

<style scoped lang="scss">
.message-flash-transfer:deep(.cover-img) {
  background-color: #e2e4eb;
}

p {
  margin: 0;
}

.title {
  margin-top: 4px;
}
</style>