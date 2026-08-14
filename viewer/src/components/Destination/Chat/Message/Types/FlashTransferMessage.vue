<script>
import AdvancedBox from "./JSON/Base/AdvancedBox.vue";
import { isArray, isUndefined } from "@/scripts/types-util.js";
import { formatFileSize } from "./FileMessage.vue";
import { fetchFlashFileList, fetchFlashShareLink } from "@/scripts/backend-api.js";
import { qqWebFile } from "@/composables/useBase.js";

export default {
  name: "FlashTransferMessage",
  methods: { qqWebFile },
  components: { AdvancedBox },
  props: {
    fileSetId: String,
    title: { type: String, default: "" },
  },
  data() {
    return {
      shareLink: undefined,
      fileList: undefined,
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
    :cover-url="qqWebFile('flash_transfer', 'poster.DLsmWTVn.png')">
    <p class="title">{{ title }}</p>
    <p class="text-muted">{{ info }}</p>
  </AdvancedBox>
</template>

<style scoped lang="scss">
.message-flash-transfer {
  :deep(.cover-img) {
    padding: 0 20px;
    background-color: #F0F1F5;
  }
}

p {
  margin: 0;
}

.title {
  margin-top: 4px;
}
</style>