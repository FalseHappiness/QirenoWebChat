<script>
import { defineComponent, toRaw } from 'vue'
import VueResizable from 'vue-resizable/src/components/vue-resizable.vue';
import SimpleBar from "simplebar-vue";
import 'simplebar-vue/dist/simplebar.min.css';
import Tooltip from "../../../Common/Overlay/Tooltip.vue";
import { useGlobalStore } from "@/store/global.js";
import {
  fetchForwardSingleMsg,
  fetchRemainGroupAtAll,
  fetchSendFiles,
  fetchSendFileStream,
  fetchSendMessage
} from "@/scripts/backend-api.js";
import InputQuote from "./InputQuote.vue";
import VirtualScroller from "../../../Common/Scrolling/VirtualScroller.vue";
import { pinyin } from "pinyin-pro";
import FilesConfirm from "./FilesConfirm.vue";
import FilesUploadTasksViewer from "./FilesUploadTasksViewer.vue";
import ContactsPicker from "./ContactsPicker.vue";
import { Emitter } from "@/composables/useEventBus.js";
import { nanoid } from "nanoid";
import CustomScrollBar from "../../../Common/Scrolling/CustomScrollBar.vue";
import { showErrorToast, showInfoToast, showWarningToast } from "@/scripts/toast.js";
import { Icon } from "@iconify/vue";
import GroupAiRecordEditor from "./GroupAiRecordEditor.vue";
import { getPokeDescription } from "@/scripts/faces-config.js";
import { qqAppPoke, qqSystemEmoji } from "@/composables/useBase.js";
import { isArray, isBoolean, isFunction, isObject, isUndefined, isString } from "@/scripts/types-util.js";
import QIcon from "../../../Common/Icons/QIcon.vue";
import { getCacheGroupUserName, getGroupInfoCacheFromAll, isGroupOperator } from "@/scripts/user-info-util.js";
import { checkSameContact } from "@/scripts/contacts-util.js";
import { formatTimeOptions } from "@/scripts/util.js";

export default defineComponent({
  name: "MessageInputBox",
  components: {
    QIcon,
    GroupAiRecordEditor,
    CustomScrollBar,
    ContactsPicker,
    FilesConfirm,
    FilesUploadTasksViewer,
    VirtualScroller,
    InputQuote,
    Tooltip,
    VueResizable,
    SimpleBar,
    Icon,
  },
  inject: ['activeContact', "groupUsers", "filesUploadTasks", "selfId"],
  data() {
    return {
      lastCaretPosition: null,
      dragCounter: 0,
      draggedFragment: null,
      draggedRange: null,
      history: [],         // 历史记录栈
      historyIndex: -1,    // 当前历史位置
      inputTime: null,
      ignoreChanges: false, // 忽略程序引起的DOM变化
      isCompositing: false, // 是否在拼词
      refReady: false,
      global: undefined,
      quotedMessage: null,
      atInputPosition: null,
      atMentionText: '',
      atMentionRange: null,
      selectedAtIndex: 0,
      messageIdToForward: undefined,
      messageContentToForward: undefined,
      showFilesUploadTasks: false,
      remainGroupAtAll: undefined,
      isShowRecordPanel: false,
      isRecording: false,
      recordDuration: 0,
      recordTimer: null,
      mediaRecorder: null,
      audioChunks: [],
      recordActiveCount: 0,
      recordShouldCancel: false,
      recordStream: null,
      isHoveringCancel: false,
      isRecordLocked: false,   // 录音锁定状态
      isRecordPaused: false,   // 录音暂停状态
      showGroupAiRecordEditor: false,  // AI语音编辑器显示状态
      pendingUploadInfo: {
        files: [],
        confirming: false,
        type: null,
        attachInfo: null
      }
    }
  },
  mounted() {
    // console.log(this)
    this.recordHistory();
    this.$refs.editor.addEventListener('compositionstart', this.handleCompositionStart)
    this.$refs.editor.addEventListener('compositionend', this.handleCompositionEnd)
    document.addEventListener('selectionchange', this.handleSelectionChange);
    document.addEventListener('click', this.handleDocumentClick);
    window.addEventListener('keydown', this.handleWindowKeyDown);
    document.addEventListener('drop', this.handleDocumentDrop);
    document.addEventListener('dragover', this.handleDocumentDragover);
    window.addEventListener('keydown', this.handleWindowRecordKeyDown);
    window.addEventListener('keyup', this.handleWindowRecordKeyUp);

    this.$nextTick(() => {
      this.refReady = true
    })

    this.global = useGlobalStore()

    Emitter.on('forward-single-msg', this.handleForwardSingleMsg)
    Emitter.on('input-at-somebody', this.handleInputAtSomebody)
    Emitter.on('select-upload-group-files', this.handleSelectUploadGroupFiles)
    Emitter.on('show-files-upload-tasks', this.handleFilesUploadTasksViewer)
    Emitter.on('select-upload-group-images', this.handleSelectUploadGroupImages)
  },
  beforeDestroy() {
    this.handleUnmounted()
  },
  beforeUnmount() {
    this.handleUnmounted()
  },
  methods: {
    getCacheGroupUserName,
    handleUnmounted() {
      this.$refs.editor?.removeEventListener('compositionstart', this.handleCompositionStart)
      this.$refs.editor?.removeEventListener('compositionend', this.handleCompositionEnd)
      document.removeEventListener('click', this.handleDocumentClick);
      window.removeEventListener('keydown', this.handleWindowKeyDown);
      window.removeEventListener('keyup', this.handleWindowRecordKeyUp);
      window.removeEventListener('keydown', this.handleWindowRecordKeyDown);
      document.removeEventListener('drop', this.handleDocumentDrop);
      document.removeEventListener('dragover', this.handleDocumentDragover);

      Emitter.off('forward-single-msg')
      Emitter.off('input-at-somebody')
      Emitter.off('select-upload-group-files')
      Emitter.off('show-files-upload-tasks')
      Emitter.off('select-upload-group-images')
    },
    // 用户在编辑后调用此方法记录状态
    recordHistory() {
      // 获取当前 innerHTML
      const content = this.$refs.editor.innerHTML;
      // 保存光标位置（使用路径方式恢复）
      const selection = this.saveSelection();

      // 撤销时清除当前索引之后的未来历史
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push({ content, selection });
      this.historyIndex = this.history.length - 1;
    },

    // 撤销
    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const state = this.history[this.historyIndex];
        this.$refs.editor.innerHTML = state.content;
        this.restoreSelection(state.selection);
      }
    },

    // 重做
    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        const state = this.history[this.historyIndex];
        this.$refs.editor.innerHTML = state.content;
        this.restoreSelection(state.selection);
      }
    },

    // 保存光标位置（返回路径和偏移）
    saveSelection() {
      const sel = window.getSelection();
      if (sel.rangeCount === 0) return null;

      const range = sel.getRangeAt(0);
      return {
        startContainerPath: this.getNodePath(range.startContainer),
        startOffset: range.startOffset,
        endContainerPath: this.getNodePath(range.endContainer),
        endOffset: range.endOffset,
      };
    },

    // 恢复光标位置
    restoreSelection(selData) {
      if (!selData) return;

      const startContainer = this.getNodeByPath(selData.startContainerPath);
      const endContainer = this.getNodeByPath(selData.endContainerPath);

      const sel = window.getSelection();
      sel.removeAllRanges();
      const range = new Range();

      try {
        range.setStart(startContainer, selData.startOffset);
        range.setEnd(endContainer, selData.endOffset);
        sel.addRange(range);
      } catch (e) {
        // 如果设置失败（可能路径失效），选择元素开头
        range.selectNodeContents(this.$refs.editor);
        sel.addRange(range);
      }
    },

    // 获取节点的路径（从元素根开始）
    getNodePath(node) {
      const path = [];
      while (node !== this.$refs.editor && node.parentNode) {
        const siblings = node.parentNode.childNodes;
        let index = 0;
        for (const sibling of siblings) {
          if (sibling === node) break;
          index++;
        }
        path.unshift({
          nodeType: node.nodeType,
          tagName: node.nodeType === 1 ? node.tagName : null,
          index,
        });
        node = node.parentNode;
      }
      return path;
    },

    // 根据路径获取节点
    getNodeByPath(path) {
      let node = this.$refs.editor;
      for (const step of path) {
        const children = node.childNodes;
        if (step.index < children.length && children[step.index].nodeType === step.nodeType) {
          node = children[step.index];
        } else {
          throw new Error('Path invalid');
        }
      }
      return node;
    },

    handleCompositionStart() {
      this.isCompositing = true
    },

    handleCompositionEnd() {
      this.isCompositing = false
      this.recordHistory()
    },

    moveCaretToEditorEnd() {
      // 移到末尾
      const range = document.createRange();
      range.selectNodeContents(this.$refs.editor);
      range.collapse(false);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      this.updateCaretPosition()
    },

    handleInput() {
      if (this.inputTime === null) {
        this.inputTime = Date.now()
      } else if ((Date.now() - this.inputTime > 300) && !this.isCompositing) {
        this.recordHistory();
        this.inputTime = null
      }
    },

    // 键盘事件处理（撤销/重做）
    handleKeyDown(e) {
      // Ctrl+Z 或 Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Ctrl+Shift+Z 重做
          this.redo()
        } else {
          // Ctrl+Z 撤销
          this.undo()
        }
        e.preventDefault();
        e.stopPropagation();
      }
      // Ctrl+Y 重做
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        this.redo()
        e.preventDefault();
        e.stopPropagation();
      }
    },

    // 处理拖动开始（支持多元素）
    handleDragStart(e) {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return;

      // 获取当前选中的range和节点
      let draggedRange = selection.getRangeAt(0);
      const selectedAtUser = draggedRange.commonAncestorContainer.parentElement.closest('.message-input-editor-at-user');

      // 检查是否父元素有.message-input-editor-at-user类
      if (selectedAtUser && this.$refs.editor.contains(selectedAtUser)) {
        // 创建新的range选择整个.message-input-editor-at-user元素
        const newRange = document.createRange();
        newRange.selectNode(selectedAtUser);

        // 更新保存的range和fragment
        draggedRange = newRange;
        this.draggedFragment = newRange.cloneContents();
      } else {
        // 保持原来的行为
        this.draggedFragment = draggedRange.cloneContents();
      }
      this.draggedRange = draggedRange

      // 设置拖动数据
      e.dataTransfer.setData('text/plain', 'move-content');
      e.dataTransfer.effectAllowed = 'move';
    },

    parseDragTarget(e) {
      const target = e?.target
      if (isFunction(target?.closest)) {
        const closest = selectors => {
          return target.closest(selectors)
        }
        const isEditor = this.$refs.editor?.contains(target)
        const isChatContainer = closest('.chat-container')
        const isRecord = closest(".message-input-record-panel, .message-input-ctrl-icon-microphone")
        const isGroupFilesViewer = closest(".group-files-viewer-container")
        let isGroupAlbumViewer = closest(".group-album-viewer-container")
        let groupAlbumAttachInfo;
        if (isObject(isGroupAlbumViewer?.dataset)) {
          const { albumId, albumName } = isGroupAlbumViewer.dataset
          if (isString(albumId)) {
            groupAlbumAttachInfo = {
              album_id: albumId, album_name: albumName
            }
          } else {
            isGroupAlbumViewer = undefined
          }
        }
        return {
          target,
          isEditor,
          isChatContainer,
          isRecord,
          isGroupFilesViewer,
          isGroupAlbumViewer,
          groupAlbumAttachInfo,
          shouldHandle: isEditor || isChatContainer || isRecord || isGroupFilesViewer || isGroupAlbumViewer
        }
      }
      return {
        isEditor: false,
        isChatContainer: false,
        isRecord: false,
        isGroupFilesViewer: false,
        shouldHandle: false
      }
    },

    async handleDocumentDragover(e) {
      if (this.parseDragTarget(e).shouldHandle) {
        e.preventDefault();
      }
    },

    async handleDocumentDrop(e) {
      const {
        isEditor, isChatContainer, isRecord, isGroupFilesViewer, isGroupAlbumViewer, groupAlbumAttachInfo, shouldHandle
      } = this.parseDragTarget(e)
      if (shouldHandle) {
        e.preventDefault();
        if (isEditor) {
          await this.handleDrop(e);
        } else if (isChatContainer) {
          await this.handleDropFiles(e, 'file')
        } else if (isRecord) {
          await this.handleDropFiles(e, 'record')
        } else if (isGroupFilesViewer) {
          await this.handleDropFiles(e, 'file', { folder_id: isGroupFilesViewer.dataset?.folderId })
        } else if (isGroupAlbumViewer) {
          await this.handleDropFiles(
            e,
            'media',
            groupAlbumAttachInfo
          )
        }
      }
    },

    formatPendingUploadType(pendingUploadInfo) {
      const { type, attachInfo } = (isObject(pendingUploadInfo) ? pendingUploadInfo : this.pendingUploadInfo)

      if (type === 'record') {
        return "语音消息"
      } else if (type === 'file') {
        if (!attachInfo) {
          return "文件"
        }
        if (isObject(attachInfo)) {
          if (attachInfo.folder_id) {
            return "群文件"
          }
        }
      } else if (type === 'media') {
        if (attachInfo.album_id) {
          return "群相片"
        }
        return "图片/视频"
      }
      return ({
        record: "语音消息",
        image: "图片",
        video: "视频",
      })[type] || "未知类型"
    },

    clearPendingFilesUpload() {
      this.pendingUploadInfo = {
        files: [],
        confirming: false,
        type: null,
        attachInfo: null
      }
    },

    createPendingFilesUpload(files, type = 'file', attachInfo = null) {
      if (!files?.length) {
        this.clearPendingFilesUpload()
        return
      }
      this.pendingUploadInfo = {
        files,
        confirming: true,
        type,
        attachInfo
      }
    },

    async handleDropFiles(e, type = 'file', attachInfo = null) {
      const dataTransferItems = e?.dataTransfer?.items
      let files = e
      if (dataTransferItems instanceof DataTransferItemList) {
        files = await this.processDataTransferItems(dataTransferItems)
      }
      files = files
        .filter(item => item.kind === 'file')
        .map(item => item.data)
      if (files) {
        const filteredFiles = files.filter(file => file.size)
        if (filteredFiles.length !== files.length) {
          showInfoToast('已自动过滤空文件/文件夹')
        }
        // 语音消息额外过滤：只保留音频文件
        if (type === 'record') {
          const audioFiles = filteredFiles.filter(file => file.type.startsWith('audio/'))
          if (audioFiles.length !== filteredFiles.length) {
            showInfoToast('已自动过滤非音频文件')
          }
          this.createPendingFilesUpload(audioFiles, type, attachInfo)
        } else if (type === 'media') {
          // 处理图片和视频
          const mediaFiles = filteredFiles.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'))
          const otherFiles = filteredFiles.filter(file => !mediaFiles.includes(file))
          if (isObject(attachInfo)) {
            // 群相册上传：只处理图片/视频
            if (otherFiles.length !== 0) {
              showInfoToast('已自动过滤非图片/视频文件')
            }
            this.createPendingFilesUpload(
              mediaFiles,
              type,
              attachInfo
            )
          } else if (otherFiles.length > 0) {
            // 有非图片/视频文件，全部作为文件上传
            this.createPendingFilesUpload(
              filteredFiles,
              'file'
            )
          } else {
            // 纯图片+视频，插入编辑器
            await this.insertDataTransferItemsAtCursor(
              await this.convertDataTransferImageItems(
                this.processSelectedFiles(mediaFiles)
              )
            )
          }
        } else {
          this.createPendingFilesUpload(filteredFiles, type, attachInfo)
        }
      }
    },

    handleFilesConfirm() {
      const { type, files, attachInfo } = this.pendingUploadInfo
      this.clearPendingFilesUpload()
      const maxSize = 20 * 1024 * 1024; // 20MB
      const minFiles = isObject(attachInfo) ? [] : files.filter(f => f.size <= maxSize);
      const bigFiles = files.filter(f => !minFiles.includes(f))
      const contact = toRaw(this.activeContact)
      const handleResult = task => {
        return result => {
          if (result?.status === 'ok') {
            task.completed = true
          } else {
            handleError(task)(new Error(JSON.stringify(result)))
          }
        }
      }
      const handleError = task => {
        return error => {
          task.error = error?.message || error
          console.error("Send file error:", error)
        }
      }
      for (const file of minFiles) {
        const task_id = nanoid()
        const controller = new AbortController();
        this.filesUploadTasks.push({
          contact,
          controller,
          file,
          task_id,
          completed: false,
          cancelled: false,
          create_time: Date.now(),
          type,
          attachInfo,
        })
        const task = this.filesUploadTasks.find(t => t.task_id === task_id)
        controller.signal.onabort = () => {
          task.cancelled = true
        }
        fetchSendFiles({ contact, files: file, controller, type })
          .then(handleResult(task))
          .catch(handleError(task))
      }
      for (const file of bigFiles) {
        const task_id = nanoid()
        const controller = new AbortController()
        this.filesUploadTasks.push({
          task_id,
          contact,
          controller,
          file,
          create_time: Date.now(),
          chunked: true,
          start_timestamp: undefined,
          chunk_size: undefined,
          total_chunks: undefined,
          chunk_index: undefined,
          completed: false,
          cancelled: false,
          is_calc_hash: true, is_merging: false, is_backend_uploading: false,
          type,
          attachInfo,
        })
        // 获取 Proxy 对象
        const task = this.filesUploadTasks.find(t => t.task_id === task_id)
        controller.signal.onabort = () => {
          task.cancelled = true
        }
        const send = () => fetchSendFileStream(task)
          .then(handleResult(task))
          .catch(handleError(task))
        if (type === 'media') {
          task.type = file.type.startsWith("image/") ? "image" : "video"
          if (task.type === 'image') {
            task.is_converting_image = true
            this.convertImageToSafeType(file)
              .then(file => {
                task.is_converting_image = false
                task.file = file
                send()
              })
              .catch(handleError(task))
          } else {
            send()
          }
        } else {
          send()
        }
      }
    },

    async handleFilesConfirmCancel() {
      this.clearPendingFilesUpload()
    },

    // 将只有浏览器支持的图片转为 png
    async convertImageToSafeType(files) {
      const single = !isArray(files)
      if (single) files = [files]
      const convertedFiles = []

      // 辅助函数：创建图像对象
      function createImage(src) {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      }

      // 支持的图片类型白名单
      const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
      for (const file of files) {
        // 如果是非图片类型，直接添加到结果中
        if (!file.type.startsWith('image/')) {
          convertedFiles.push(file);
          continue;
        }

        // 如果已经是支持的图片格式，直接添加
        if (supportedImageTypes.includes(file.type)) {
          convertedFiles.push(file);
          continue;
        }

        try {
          // 读取文件数据
          const fileData = await this.readFileAsBase64(file);

          // 创建图像对象
          const img = await createImage(fileData);

          // 创建canvas进行转换
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0)
          const pngBlob = await new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), 'image/png');
          });

          // 创建新的File对象
          const pngFile = new File([pngBlob], file.name.replace(/\.[^/.]+$/, '') + '.png', {
            type: 'image/png'
          });

          // 添加到结果中
          convertedFiles.push(pngFile);
        } catch (error) {
          console.error('转换图片失败:', error);
          file.convertError = true
          // 如果转换失败，保留原文件
          convertedFiles.push(file);
        }
      }

      return single ? convertedFiles[0] : convertedFiles
    },

    // 转化非 jpg png gif 的图片为 png
    async convertDataTransferImageItems(files) {
      // 结果数组
      const convertedFiles = [];

      for (const file of files) {
        // 如果不是文件类型，直接添加到结果中
        if (file.kind !== 'file') {
          convertedFiles.push(file);
          continue;
        }

        const converted = await this.convertImageToSafeType(file.data);

        const result = {
          ...file,
          data: converted
        }

        if (converted.convertError) {
          result.errorImage = true
        }

        // 添加到结果中
        convertedFiles.push(result);
      }

      return convertedFiles;
    },

    // 处理拖放（支持多文件和多元素）
    async handleDrop(e) {
      this.dragCounter = 0;
      const items = e.dataTransfer.items;
      const data = e.dataTransfer.getData('text/plain');
      const whetherCopy = e.ctrlKey;

      // 1. 处理多文件拖入（外部文件）
      if (items.length > 0 && !this.draggedFragment) {
        e.preventDefault();

        await this.handleDropFiles(e, 'media')
      }

      // 2. 处理内部内容移动（多元素）
      if (data === 'move-content' && this.draggedFragment) {
        e.preventDefault();
        this.insertNodeAtCursor(whetherCopy);
        this.draggedFragment = null;
        this.draggedRange = null;
      }
    },

    // 移动多元素内容到光标位置
    insertNodeAtCursor(arg1, arg2) {
      let { copy, node } = isBoolean(arg1) ? { copy: arg1, node: arg2 } : { copy: arg2, node: arg1 }
      if (node === undefined) {
        node = this.draggedFragment
      }
      if (copy === undefined) {
        copy = false
      }
      // if (!this.lastCaretPosition || !node) return;
      if (!node) return;

      let range
      if (this.lastCaretPosition) {
        range = this.lastCaretPosition.range;
        range.deleteContents();
      }

      // 检测 contenteditable="false"，插入到前后
      if (range) {
        const editorRoot = this.$refs.editor;
        const startContainer = range.startContainer;
        let nonEditableEl = null;

        // 向上遍历查找最近 contenteditable="false" 元素
        let current = startContainer.nodeType === Node.ELEMENT_NODE ? startContainer : startContainer.parentElement;
        while (current) {
          // 边界1：到达编辑器根节点，停止
          if (current === editorRoot) break;
          // 边界2：遇到可编辑元素，停止向上查找
          if (current.nodeType === Node.ELEMENT_NODE && current.isContentEditable === true) break;

          if (current.nodeType === Node.ELEMENT_NODE && current.isContentEditable === false) {
            nonEditableEl = current;
            break;
          }
          current = current.parentElement;
        }

        if (nonEditableEl) {
          // 计算光标在元素内部相对偏移
          const tempRange = document.createRange();
          tempRange.setStart(nonEditableEl, 0);
          tempRange.setEnd(range.startContainer, range.startOffset);
          const charOffset = tempRange.toString().length;
          const totalChars = nonEditableEl.textContent.length;
          const moveToBefore = charOffset <= totalChars / 2;

          const parent = nonEditableEl.parentNode;
          const siblings = Array.from(parent.childNodes);
          const index = siblings.indexOf(nonEditableEl);

          if (moveToBefore) {
            // 靠左：插入到元素前面
            if (index > 0 && siblings[index - 1].nodeType === Node.TEXT_NODE) {
              range.setStart(siblings[index - 1], siblings[index - 1].textContent.length);
            } else {
              // 前置空白文本节点占位
              const emptyTextNode = document.createTextNode('');
              parent.insertBefore(emptyTextNode, nonEditableEl);
              range.setStart(emptyTextNode, 0);
            }
          } else {
            // 靠右：插入到元素后面
            if (index < siblings.length - 1 && siblings[index + 1].nodeType === Node.TEXT_NODE) {
              range.setStart(siblings[index + 1], 0);
            } else {
              // 后置空白文本节点占位
              const emptyTextNode = document.createTextNode('');
              parent.insertBefore(emptyTextNode, nonEditableEl.nextSibling);
              range.setStart(emptyTextNode, 0);
            }
          }
          range.collapse(true);
        }
      }

      // 克隆片段
      const clonedFragment = node.cloneNode(true);

      // 如果不是复制，删除原始内容
      if (!copy && this.draggedRange) {
        // 在片段插入前删除内容，防止片段插入在所选范围内而消失
        this.draggedRange.deleteContents();
      }

      // 插入片段
      if (range) {
        range.insertNode(clonedFragment);
      } else {
        this.$refs.editor.appendChild(clonedFragment);
        this.moveCaretToEditorEnd()
        return
      }


      // 获取插入后文档中的最后一个节点
      let lastInsertedNode = null;
      if (clonedFragment.childNodes.length > 0) {
        // 片段插入后，其子节点成为文档的一部分
        lastInsertedNode = clonedFragment.lastChild;

        // 如果最后一个节点是元素节点且有子节点，则获取其最后一个子节点
        while (lastInsertedNode.lastChild) {
          lastInsertedNode = lastInsertedNode.lastChild;
        }
      }

      // 更新光标位置
      const newRange = document.createRange();
      if (lastInsertedNode) {
        newRange.setStartAfter(lastInsertedNode);
      } else {
        // 如果没有找到最后一个节点，则使用范围末端
        newRange.setStart(range.endContainer, range.endOffset);
      }
      newRange.collapse(true);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(newRange);

      this.lastCaretPosition = {
        range: newRange,
        container: newRange.startContainer,
        offset: newRange.startOffset
      };

      this.recordHistory()
    },

    // 在光标位置插入图片
    async insertImageAtCursor(file) {
      const base64 = await this.readFileAsBase64(file);
      const img = document.createElement('img');
      img.classList.add("message-input-editor-image");
      img.src = base64;
      img.draggable = true;

      this.insertNodeAtCursor(img)
    },

    // 读取视频第一帧作为缩略图
    async getVideoFirstFrame(videoBase64) {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.src = videoBase64;

        video.onloadeddata = () => {
          video.currentTime = 0.1;
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            video.remove();
            resolve(dataUrl);
          } catch (e) {
            video.remove();
            resolve(null);
          }
        };

        video.onerror = () => {
          video.remove();
          resolve(null);
        };

        // 超时处理
        setTimeout(() => {
          video.remove();
          resolve(null);
        }, 5000);
      });
    },

    // 在光标位置插入视频（以缩略图展示，数据存储在 dataset 中）
    async insertVideoAtCursor(file) {
      const videoBase64 = await this.readFileAsBase64(file);
      const thumbnail = await this.getVideoFirstFrame(videoBase64);

      const wrapper = document.createElement('span');
      wrapper.classList.add("message-input-editor-video-wrapper");
      wrapper.contentEditable = "false";

      const img = document.createElement('img');
      img.classList.add("message-input-editor-video");
      img.src = thumbnail || '';
      img.draggable = true;
      img.dataset.videoSrc = videoBase64;
      img.dataset.videoName = file.name;

      wrapper.appendChild(img);
      this.insertNodeAtCursor(wrapper)
    },

    insertNodesAtCursor(...nodes) {
      // 创建一个文档片段
      const fragment = document.createDocumentFragment();

      // 将所有节点添加到片段中
      nodes.forEach(node => {
        fragment.appendChild(node);
      });

      this.insertNodeAtCursor(fragment);
    },

    isPokeEmoji(emoji_id) {
      return !!this.getPokeEmojiNum(emoji_id)
    },

    getPokeEmojiPath(emoji_id, dynamic = false) {
      const pokeId = this.getPokeEmojiNum(emoji_id);
      if (pokeId) {
        return qqAppPoke(pokeId, pokeId + (dynamic ? "_loop.webp" : ".png"))
      }
      return null
    },

    getPokeEmojiNum(emoji_id) {
      const pokeMatch = String(emoji_id).match(/^poke_([1-6])$/);
      return pokeMatch ? Number(pokeMatch[1]) : null
    },

    getPngEmojiUrl(emoji_id, forceStatic = false) {
      if (this.isPokeEmoji(emoji_id)) {
        return this.getPokeEmojiPath(emoji_id);
      }
      let add = ''
      if (forceStatic && this.isDynamicDefaultPngEmoji(emoji_id)) {
        add = `_0`
      }
      return qqSystemEmoji(emoji_id, 'png', `${emoji_id}${add}.png`)
    },

    isDynamicDefaultPngEmoji(emoji_id) {
      // 466, 468, 469 即使加了 _0 也是动态的
      return [367, 466, 468, 469].includes(Number(emoji_id))
    },

    getApngEmojiUrl(emoji_id) {
      if (this.isPokeEmoji(emoji_id)) {
        return this.getPokeEmojiPath(emoji_id, true);
      }
      const url = qqSystemEmoji(emoji_id, 'apng', `${emoji_id}.png`)
      return this.emojiFiles.includes(url) ? url : null
    },

    getAnimationEmojiUrl(emoji_id) {
      const animation_src = this.getApngEmojiUrl(emoji_id);
      return animation_src ? animation_src : this.getPngEmojiUrl(emoji_id);
    },

    getEmojiDescription(emoji_id) {
      const pokeId = this.getPokeEmojiNum(emoji_id)
      if (pokeId) {
        return getPokeDescription(pokeId)
      } else {
        return this.emojiDescribes[emoji_id]
      }
    },

    insertEmojiAtCursor(emoji_id) {
      emoji_id = String(emoji_id)
      const img = document.createElement('img');
      img.classList.add("message-input-editor-emoji");
      img.src = this.getAnimationEmojiUrl(emoji_id);
      img.dataset.emoji = emoji_id
      img.draggable = true;
      if (img.src) {
        this.insertNodeAtCursor(img)
      }
    },

    insertTextAtCursor(text) {
      this.insertNodeAtCursor(document.createTextNode(text))
    },

    // 递归清除元素内纯空白/换行文本节点，解决span之间空格
    clearEmptyTextNodes(el) {
      const childNodes = Array.from(el.childNodes);
      for (const node of childNodes) {
        // 纯空格、换行、制表符文本直接删除
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '') {
          node.remove();
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          this.clearEmptyTextNodes(node);
        }
      }
    },

    async insertDataTransferItemsAtCursor(items) {
      if (items.length > 0) {
        // console.log(items)
        for (const item of items) {
          if (item.type.startsWith("image")) {
            const file = item.data
            if (file) await this.insertImageAtCursor(file);
          } else if (item.type.startsWith("video")) {
            const file = item.data
            if (file) await this.insertVideoAtCursor(file);
          } else if (item.type === 'text/plain') {
            this.insertTextAtCursor(item.data)
          } else if (item.type === 'text/html') {
            let html = item.data;

            const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
            html = html.replace(new RegExp(`<!--<!--QQ:${uuidRegex.source}-->-->`, 'g'), '');

            // 创建一个range对象
            const range = document.createRange();
            // 设置上下文为document
            range.selectNode(document.documentElement);
            // 创建DocumentFragment
            let fragment = range.createContextualFragment(html);

            // 查找所有src以file:///开头的img元素
            const localImages = fragment.querySelectorAll('img[src^="file:///"]');
            // 替换它们
            localImages.forEach(img => {
              let emoji_describe = img.src.match(/^file:\/\/\/\[(.+)]$/i);
              emoji_describe = emoji_describe ? emoji_describe[1] : null;

              if (emoji_describe) {
                emoji_describe = decodeURIComponent(emoji_describe)
                const emoji_id = Object.keys(this.emojiDescribes).find(
                  key => this.emojiDescribes[key] === emoji_describe
                )
                if (emoji_id) {
                  const url = this.getAnimationEmojiUrl(emoji_id)
                  if (url) {
                    img.src = url
                    img.className = 'message-input-editor-emoji'
                    return
                  }
                }
              }

              const replacement = document.createElement('span');
              // replacement.textContent = ` [无法加载本地图片,请尝试粘贴仅包含的图片的内容: ${img.src}] `;
              replacement.textContent = ` [无权加载本地图片] `;

              img.parentNode.replaceChild(replacement, img);
            });

            const emojiFaceImages = fragment.querySelectorAll('img.msg-preview-emoji[data-emoji-id]');
            emojiFaceImages.forEach(img => {
              const emojiId = img.dataset.emojiId

              if (this.global.allEmojiids.includes(emojiId)) {
                const replacement = document.createElement('img');
                replacement.classList.add("message-input-editor-emoji");
                replacement.src = this.getAnimationEmojiUrl(emojiId);
                replacement.dataset.emoji = emojiId

                img.parentNode.replaceChild(replacement, img);
              }
            })

            const msgAtUsers = fragment.querySelectorAll('.at-somebody-link[data-user-id]')
            msgAtUsers.forEach(span => {
              const a = document.createElement('a')
              a.classList.add('message-input-editor-at-user')
              a.append(...span.childNodes)
              a.dataset.qq = span.dataset.userId

              span.parentNode.replaceChild(a, span)
            })

            fragment = this.keepOnlyAllowedNodes(fragment)

            // 新增：清除所有空白换行文本，消除span间隙
            this.clearEmptyTextNodes(fragment)

            this.insertNodeAtCursor(fragment)
          }
        }
      }
    },

    keepOnlyAllowedNodes(fragment) {
      // 需要完全删除的标签列表（移除 select/button，表单控件单独逻辑处理）
      const TAGS_TO_REMOVE = [
        'head', 'script', 'style', 'link', 'meta', 'noscript',
        'base', 'title', 'template', 'svg', 'canvas', 'iframe',
        'object', 'embed', 'audio', 'source', 'track', 'map', 'area', 'picture'
      ];

      // 块级元素列表（默认display: block的元素）
      const BLOCK_ELEMENTS = [
        'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
        'blockquote', 'pre', 'section', 'article', 'header', 'footer', 'nav',
        'table', 'form', 'fieldset', 'dd', 'dt', 'dl', 'figure', 'figcaption',
        'main', 'aside', 'details', 'summary', 'menu', 'menuitem', 'address',
        'tfoot', 'thead', 'tbody', 'tr', 'td', 'th', 'colgroup', 'col', 'caption'
      ];

      // 所有表单控件标签（需要特殊提取文本，不直接删除）
      const FORM_CTRL_TAGS = [
        'input', 'textarea', 'button', 'select', 'option', 'optgroup', 'legend'
      ];

      /**
       * 处理文本内容，将空格转换为 &nbsp;，合并连续空格
       * @param {string} text - 原始文本
       * @returns {string} 处理后的文本
       */
      function processTextContent(text) {
        if (!text) return '';
        text = text.replace(/ /g, '\u00A0');
        return text;
      }

      /**
       * 提取表单控件可读文本
       * @param {HTMLElement} el 表单元素
       * @returns {string}
       */
      function getFormControlText(el) {
        const tag = el.tagName.toLowerCase();
        switch (tag) {
          case 'input':
            // 优先取value，无值取placeholder
            return el.value?.trim() || el.placeholder || '';
          case 'textarea':
            return el.value || '';
          case 'button':
            // button文本由内部子节点渲染，这里返回空，后续递归取子节点
            return '';
          case 'select':
            // 拼接所有选中/全部option文本
            let optText = '';
            el.querySelectorAll('option').forEach(opt => {
              optText += opt.textContent + ' ';
            });
            return optText.trim();
          case 'option':
          case 'optgroup':
            return el.textContent || '';
          case 'legend':
            return el.textContent || '';
          default:
            return '';
        }
      }

      /**
       * 递归处理节点
       * @param {Node} node - 当前处理的节点
       * @returns {Node[]} 处理后的节点数组
       */
      function processNode(node) {
        // 1. 处理文本节点：转换空格
        if (node.nodeType === Node.TEXT_NODE) {
          const processedText = processTextContent(node.nodeValue);
          return [document.createTextNode(processedText)];
        }

        // 2. 处理元素节点
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();

          // 2.1 完全移除不需要的元素
          if (TAGS_TO_REMOVE.includes(tagName)) {
            return processChildren(node);
          }

          // ========== 新增：表单控件特殊处理分支 ==========
          if (FORM_CTRL_TAGS.includes(tagName)) {
            return handleFormElement(node);
          }

          // label 单独处理：保留标签容器，内部正常递归解析
          if (tagName === 'label') {
            const labelWrap = document.createElement('span');
            const childNodes = processChildren(node);
            childNodes.forEach(c => labelWrap.appendChild(c));
            return [labelWrap];
          }

          // 2.2 原有特殊元素
          switch (tagName) {
            case 'img':
              return [createCleanImage(node)];
            case 'br':
              return [document.createElement('br')];
            case 'hr':
              return [document.createElement('br')];
            case 'a':
              return [createCleanAnchor(node)]
          }

          // 2.3 处理内联样式display
          const displayStyle = node.style.display;

          // 如果元素被隐藏则直接删除
          if (displayStyle === 'none') {
            return [];
          }

          // 2.4 创建替换元素（div或span）
          let replacement;
          switch (displayStyle) {
            case 'block':
            case 'flex':
            case 'grid':
            case 'table':
              replacement = document.createElement('div');
              break;
            case 'inline':
            case 'inline-block':
            case 'inline-flex':
            case 'inline-grid':
              replacement = document.createElement('span');
              break;
            default:
              // 根据标签默认类型判断
              replacement = BLOCK_ELEMENTS.includes(tagName)
                ? document.createElement('div')
                : document.createElement('span');
          }

          // 2.5 处理子节点并添加到替换元素
          const childNodes = processChildren(node);
          childNodes.forEach(child => replacement.appendChild(child));

          // 2.6 特殊处理：空段落转换为换行
          if (tagName === 'p' && replacement.childNodes.length === 0) {
            return [document.createElement('br')];
          }

          return [replacement];
        }

        // 3. 其他类型节点（注释等）直接删除
        return [];
      }

      /**
       * 统一处理表单控件元素：丢弃控件标签，只输出可读文本/子内容
       * @param {HTMLElement} el
       * @returns {Node[]}
       */
      function handleFormElement(el) {
        const tag = el.tagName.toLowerCase();
        const text = getFormControlText(el);
        const resultNodes = [];

        // input / textarea / select / option / optgroup / legend：纯文本输出
        if (['input', 'textarea', 'select', 'option', 'optgroup', 'legend'].includes(tag)) {
          if (text) {
            resultNodes.push(document.createTextNode(processTextContent(text)));
          }
          // 不保留原标签，只返回提取的文本
          return resultNodes;
        }

        // button：丢弃button标签，递归解析内部所有子节点（图片、文字、br等）
        if (tag === 'button') {
          return processChildren(el);
        }

        return [];
      }

      /**
       * 处理元素的子节点
       * @param {Element} element - 父元素
       * @returns {Node[]} 处理后的子节点数组
       */
      function processChildren(element) {
        const result = [];
        for (const child of Array.from(element.childNodes)) {
          result.push(...processNode(child));
        }
        return result;
      }

      /**
       * 创建干净的图片元素
       * @param {HTMLImageElement} img - 原始图片元素
       * @returns {HTMLImageElement} 处理后的图片
       */
      function createCleanImage(img) {
        // 视频缩略图：用wrapper包裹并保留视频数据
        if (img.classList.contains("message-input-editor-video")) {
          const newImg = document.createElement('img');
          if (img.src) newImg.src = img.src;
          newImg.classList.add('message-input-editor-video');
          newImg.draggable = false;
          if (img.dataset.videoSrc) newImg.dataset.videoSrc = img.dataset.videoSrc;
          if (img.dataset.videoName) newImg.dataset.videoName = img.dataset.videoName;
          const wrapper = document.createElement('span');
          wrapper.classList.add('message-input-editor-video-wrapper');
          wrapper.contentEditable = "false";
          wrapper.appendChild(newImg);
          return wrapper;
        }
        const newImg = document.createElement('img');
        if (img.src) newImg.src = img.src;
        if (img.classList.contains("message-input-editor-emoji")) {
          newImg.classList.add('message-input-editor-emoji');
          newImg.dataset.emoji = img.dataset.emoji
        } else {
          newImg.classList.add('message-input-editor-image');
        }
        newImg.draggable = true;
        return newImg;
      }

      const createCleanAnchor = (anchor) => {
        let fragment = document.createDocumentFragment();
        fragment.append(...anchor.childNodes)
        fragment = this.keepOnlyAllowedNodes(fragment)
        let newAnchor = document.createElement('a');
        newAnchor.append(...fragment.childNodes)
        newAnchor.querySelectorAll('br').forEach(br => br.remove());

        if (anchor.classList.contains("message-input-editor-at-user") && anchor.dataset.qq) {
          newAnchor.classList.add("message-input-editor-at-user")
          newAnchor.dataset.qq = anchor.dataset.qq
          return newAnchor
        } else {
          const span = document.createElement('span')
          span.append(...fragment.childNodes)
          return span
        }
      }

      // 创建新的DocumentFragment用于存放处理结果
      const newFragment = document.createDocumentFragment();
      for (const node of processChildren(fragment)) {
        newFragment.appendChild(node);
      }

      return newFragment;
    },

    // 处理 event 中 clipboardData 的 items
    async processDataTransferItems(items) {
      let processedItems = [];
      let finalItems = [];

      const getAsString = (data) => {
        if (data instanceof DataTransferItem) {
          return new Promise((resolve, reject) => {
            data.getAsString((string) => {
              resolve(string); // 解析 Promise 并返回字符串
            });
          });
        } else {
          return Promise.resolve(""); // 如果不是 DataTransferItem 则返回空字符串的 Promise
        }
      };

      // 收集所有项目的 promises
      const promises = [];

      for (const item of items) {
        if (['file', "string"].includes(item.kind)) {
          const processedItem = {
            kind: item.kind,
            type: item.type
          };

          if (item.kind === 'file') {
            // 文件类型直接获取
            processedItem.data = item.getAsFile();
          } else {
            // 字符串类型添加到 promises 列表
            const promise = getAsString(item).then(string => {
              // 设置值
              processedItem.data = string
            });
            promises.push(promise);
          }

          processedItems.push(processedItem)
        }
      }

      // 等待所有 promises 完成
      await Promise.all(promises);

      // 判断是否有 kind 为 'file' 的对象
      const fileItems = processedItems.filter(item => item.kind === 'file');
      // 判断是否有 type 为 'text/html' 的对象
      const htmlItem = processedItems.find(item => item.type === 'text/html');
      // 判断是否有 type 为 'text/plain' 的对象
      const plainItem = processedItems.find(item => item.type === 'text/plain');
      if (htmlItem) {
        finalItems = [htmlItem];
      } else if (fileItems?.length) {
        finalItems = fileItems;
      } else if (plainItem) {
        finalItems = [plainItem];
      }

      return finalItems
    },

    // 处理多内容粘贴
    async handlePaste(e) {
      e.preventDefault();
      await this.insertDataTransferItemsAtCursor(
        await this.processDataTransferItems(e.clipboardData.items)
      )
    },

    // 更新光标位置
    updateCaretPosition() {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        this.lastCaretPosition = {
          range,
          container: range.startContainer,
          offset: range.startOffset
        };
      }
    },

    // 将CaretPosition转换为Range
    caretPositionToRange(caretPos) {
      if (!caretPos) return null;

      const range = document.createRange();
      range.setStart(caretPos.offsetNode, caretPos.offset);
      range.collapse(true);

      return range;
    },

    // 处理拖动悬停事件
    handleDragOver(e) {
      // 更新拖拽位置的光标
      const selection = window.getSelection();

      // 优先使用标准方法
      let range;
      if (document.caretPositionFromPoint) {
        const caretPos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (caretPos) {
          range = this.caretPositionToRange(caretPos);
        }
      }

      // 如果上面方法不可用或失败，尝试备选方法
      if (!range && document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      }

      if (range) {
        // 在设置选择前先调整 range
        range = this.adjustRangeToAvoidNoneditableElement(range);

        selection.removeAllRanges();
        selection.addRange(range);
        this.lastCaretPosition = {
          range,
          container: range.startContainer,
          offset: range.startOffset
        };
      }
    },

    // 读取文件为Base64
    readFileAsBase64(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    },

    handleExpressionInput(e) {
      let target = e.target
      if (target) {
        if (!target.classList.contains("message-input-expression-emoji-box")) {
          target = target.closest(".message-input-expression-emoji-box")
        }
        if (target) {
          const emoji = target.dataset.emoji
          if (this.isPokeEmoji(emoji)) {
            this.handleMessageInputShake(this.getPokeEmojiNum(emoji))
          } else {
            this.insertEmojiAtCursor(emoji)
          }
        }
      }
    },

    parseFragmentIntoMessage(fragment) {
      const addMessage = (messages, type, data) => {
        const msg = { type, data }
        messages.push(msg)
        return msg
      }

      const addText = (text, messages) => {
        return addMessage(messages, 'text', { text })
      }

      const addImage = (url, messages) => {
        return addMessage(messages, 'image', { url })
      }
      const addEmoji = (id, messages) => {
        return addMessage(messages, 'face', { id })
      }
      const addGroupAt = (qq, messages) => {
        return addMessage(messages, 'at', { qq })
      }

      const processElementNode = node => {
        const msg = {
          contents: [],
          occupyOneLine: node.tagName === 'DIV',
          elementNode: true
        }
        processNodes(node.childNodes, msg.contents)
        return msg
      }

      const processNodes = (nodes, parent_messages) => {
        nodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            addText(node.textContent, parent_messages)
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'A') {
              const qq = node.dataset.qq
              if (node.classList.contains('message-input-editor-at-user') && qq) {
                addGroupAt(qq, parent_messages)
                return
              }
            }
            if (node.childNodes.length) {
              const element_node_msg = processElementNode(node)
              if (element_node_msg.contents.length) {
                parent_messages.push(element_node_msg)
              }
            } else if (node.tagName === 'BR') {
              addText('\n', parent_messages)
            } else if (node.tagName === 'IMG') {
              if (node.classList.contains('message-input-editor-emoji')) {
                const emoji_id = node.dataset.emoji
                if (emoji_id && this.emojiFiles.includes(this.getPngEmojiUrl(emoji_id))) {
                  if (this.global.emojiEmojiids.includes(emoji_id)) {
                    addText(emoji_id, parent_messages)
                  } else {
                    addEmoji(emoji_id, parent_messages)
                  }
                }
              } else if (node.classList.contains('message-input-editor-video')) {
                addMessage(parent_messages, 'video', {
                  file: node.dataset.videoSrc || '',
                  name: node.dataset.videoName || ''
                })
              } else {
                addImage(node.src, parent_messages)
              }
            }
          }
        })
        return parent_messages
      }

      function processBasicMessages(list) {
        // 递归扁平化，返回消息数组（未合并文本）
        const flatten = (nodes) => {
          const result = [];

          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // 兄弟节点之间：前一个或当前节点是独占一行元素时，插入换行
            if (i > 0) {
              const prev = nodes[i - 1];
              const prevIsBlock = prev.elementNode && prev.occupyOneLine;
              const currIsBlock = node.elementNode && node.occupyOneLine;
              if (prevIsBlock || currIsBlock) {
                // 全新对象，不污染原数组
                result.push({ type: 'text', data: { text: '\n' } });
              }
            }

            if (node.elementNode) {
              if (node.occupyOneLine) {
                // 独占一行：递归子内容
                const children = flatten(node.contents);
                if (children.length === 0) {
                  // 空块生成一个换行（如 <div></div>）
                  result.push({ type: 'text', data: { text: '\n' } });
                } else {
                  for (const child of children) {
                    result.push(child);
                  }
                }
              } else {
                // 非独占一行（如 <span>）：直接展平内容，不加换行
                const children = flatten(node.contents);
                for (const child of children) {
                  result.push(child);
                }
              }
            } else {
              // 叶子消息（text/image/at/face 等），浅拷贝防修改原数组
              result.push({ ...node, data: { ...node.data } });
            }
          }

          return result;
        };

        const flatMessages = flatten(list);

        // 合并连续的 text 类型消息
        const merged = [];
        for (const msg of flatMessages) {
          if (msg.type === 'text' && merged.length > 0 && merged[merged.length - 1].type === 'text') {
            merged[merged.length - 1].data.text += msg.data.text;
          } else {
            merged.push(msg);
          }
        }

        return merged;
      }

      const basic_messages = processNodes(fragment.childNodes, [])

      return processBasicMessages(basic_messages)
    },

    handleSendMessage() {
      if (!this.activeContact) return
      // 创建模板元素并复制内容
      const template = document.createElement('template');
      template.innerHTML = this.$refs.editor.innerHTML;

      // 模板的 content 属性就是一个 DocumentFragment
      const message = this.parseFragmentIntoMessage(this.keepOnlyAllowedNodes(template.content));

      if (this.quotedMessage) {
        message.unshift({
          "type": "reply",
          "data": {
            "id": this.quotedMessage.message_id
          }
        })
      }

      console.log('Send message:', message)

      fetchSendMessage(this.activeContact, message).then(r => {
        if (r?.status === 'error') {
          console.log('Send message error:', r)
          showErrorToast('发送消息失败')
        }
      })

      this.$refs.editor.innerHTML = ''
      this.quotedMessage = null
    },

    async handleMessageInputShake(type = 1) {
      if (!this.isPrivate) return

      const result = await fetchSendMessage(this.activeContact, [{
        type: 'poke',
        data: {
          type,
          id: type
        }
      }])
      if (result?.status !== 'ok') {
        showErrorToast("发送窗口抖动失败")
        console.log("Send private shake error:", result)
      }
    },

    handleQuoteMessage(msg) {
      this.quotedMessage = msg
    },

    /**
     * 获取当前@提及的范围信息
     * @return {Object|null} 包含startPos, endPos, textNode的对象，或null
     */
    getCurrentAtMentionRange() {
      const selection = window.getSelection();
      if (!selection.rangeCount || this.isCompositing) return null;

      const range = selection.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      // 检查是否在文本节点内
      if (node.nodeType !== Node.TEXT_NODE) return null;

      const text = node.textContent;
      let startPos = -1;

      // 从光标位置向前查找@符号
      for (let i = offset - 1; i >= 0; i--) {
        if (text[i] === '@') {
          startPos = i;
          break;
        }
        if (/\s/.test(text[i])) break; // 遇到空格停止搜索
      }

      return startPos !== -1
        ? { startPos, endPos: offset, textNode: node }
        : null;
    },

    /**
     * 更新@提及状态
     */
    updateAtMentionState() {
      const rangeInfo = this.getCurrentAtMentionRange();

      if (rangeInfo) {
        this.atMentionText = rangeInfo.textNode.textContent.slice(
          rangeInfo.startPos + 1,
          rangeInfo.endPos
        );
        this.atMentionRange = rangeInfo;

        // 更新tooltip位置
        const selection = window.getSelection();
        const cursorRect = selection.getRangeAt(0).getBoundingClientRect();
        this.atInputPosition = cursorRect
          ? { x: cursorRect.x, y: cursorRect.y }
          : null;
      } else {
        this.resetAtMentionState();
      }
    },

    /**
     * 删除当前@提及
     */
    deleteAtMention() {
      if (!this.atMentionRange) return false;

      const { startPos, endPos, textNode } = this.atMentionRange;
      const selection = window.getSelection();

      // 执行删除
      textNode.textContent =
        textNode.textContent.slice(0, startPos) +
        textNode.textContent.slice(endPos);

      // 恢复光标位置
      const newRange = document.createRange();
      newRange.setStart(textNode, startPos);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      this.resetAtMentionState();

      this.lastCaretPosition = {
        range: newRange,
        container: newRange.startContainer,
        offset: newRange.startOffset
      };

      return true;
    },

    /**
     * 重置@提及状态
     */
    resetAtMentionState() {
      this.atMentionText = '';
      this.atMentionRange = null;
      this.atInputPosition = null;
    },

    handleSelectionChange() {
      // 排除tooltip内的选择和组合输入状态
      const selection = window.getSelection();
      if (this.$refs.atGroupUsersTooltip?.contains(selection.anchorNode) ||
        this.isCompositing) {
        return;
      }

      // 检查是否在编辑器外或非群组状态
      if (!selection.rangeCount ||
        !this.$refs.editor?.contains(selection.anchorNode) ||
        !this.isGroup) {
        this.resetAtMentionState();
        return;
      }

      // 获取当前 range 并调整
      const range = selection.getRangeAt(0);
      const adjustedRange = this.adjustRangeToAvoidNoneditableElement(range);

      // 如果 range 有变化，则更新选择
      if (adjustedRange !== range) {
        selection.removeAllRanges();
        selection.addRange(adjustedRange);
      }

      if (!range.collapsed || range.startContainer?.parentElement?.closest('.message-input-editor-at-user')) {
        return
      }
      this.updateAtMentionState();
    },

    /**
     * 光标落在 @用户 / video包装元素内时，选中整个组件节点
     * @param {Range} range
     * @returns {Range}
     */
    adjustRangeToAvoidNoneditableElement(range) {
      if (!range.collapsed) return range;

      // 匹配两类容器：@用户标签、视频包装容器
      const targetSelector = '.message-input-editor-at-user, .message-input-editor-video-wrapper';
      const wrapEl = range.startContainer?.parentElement?.closest(targetSelector);

      // 光标不在目标容器内，直接返回原range
      if (!wrapEl) return range;

      // ========== 核心改动：选中整个DOM元素 ==========
      const newRange = document.createRange();
      newRange.selectNode(wrapEl);
      return newRange;
    },

    // 点击 video 时选中
    handleMousedown(e) {
      // 查找点击目标所属的块容器
      const targetBlock = e.target.closest('.message-input-editor-video-wrapper');
      if (!targetBlock) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNode(targetBlock);
      sel.removeAllRanges();
      sel.addRange(range);
    },

    handleDocumentClick(event) {
      const target = event.target
      if (target && !this.$refs.atGroupUsersTooltip?.contains(target) && !target.closest('.message-input-editor')) {
        this.atInputPosition = null
      }
    },
    handleWindowKeyDown(event) {
      if (!this.filteredAtGroupUsers?.length || !this.isGroup || !this.atInputPosition) return;

      const { key } = event;
      const userCount = this.filteredAtGroupUsers.length;

      if (key === 'ArrowDown') {
        event.preventDefault();
        this.selectedAtIndex = (this.selectedAtIndex + 1) % userCount;
        this.scrollToSelected();
      } else if (key === 'ArrowUp') {
        event.preventDefault();
        this.selectedAtIndex = (this.selectedAtIndex - 1 + userCount) % userCount;
        this.scrollToSelected();
      } else if (key === 'Enter') {
        event.preventDefault();
        const selectedUser = this.filteredAtGroupUsers[this.selectedAtIndex];
        this.handleSelectAtUser(selectedUser);
      }
    },

    scrollToSelected() {
      this.$nextTick(() => {
        this.$refs.atUsersScroller?.scrollToIndex(this.selectedAtIndex, { behavior: 'smooth', align: 'nearest' })
      });
    },

    handleSelectAtUser(user) {
      // 处理选中用户的逻辑
      // console.log('Selected user:', user);
      this.insertAtUserAtCursor(user)
    },

    handleMouseEnterAtUser(index) {
      this.selectedAtIndex = index;
    },

    // 在光标位置插入@用户
    insertAtUserAtCursor(user) {
      this.deleteAtMention()
      const link = document.createElement('a');
      link.classList.add("message-input-editor-at-user");
      link.innerText = `@${user.name}`
      link.dataset.qq = user.qq
      link.contenteditable = false
      const span = document.createElement('span')
      span.innerHTML = '&nbsp;'
      this.insertNodesAtCursor(link, span)
    },

    handleInputAtSomebody(qq, name) {
      this.insertAtUserAtCursor({ qq, name })
    },

    handleForwardSingleMsg(message_id, message_content) {
      this.messageIdToForward = [message_id]
      this.messageContentToForward = { [message_id]: message_content }
    },

    async handleContactsPickerConfirm(selectedContacts) {
      const idList = toRaw(this.messageIdToForward)
      this.handleContactsPickerCancel()
      const promises = [];

      idList.flatMap(id => selectedContacts.map(contact =>
        promises.push(
          fetchForwardSingleMsg(id, contact).then(response => {
            return {
              status: response?.status || "error",
              msg_id: id,
              contact_id: contact.contact_id,
              type: contact.type,
              error: response?.message || '请求失败'
            };
          }).catch(error => {
            return {
              status: 'error', // 捕获错误时也标记为error
              msg_id: id,
              contact_id: contact.contact_id,
              type: contact.type,
              error: error?.message || '请求失败'
            };
          })
        )
      ));

      const allResults = await Promise.all(promises);

      // 筛选出失败的结果
      const failedResults = allResults.filter(result => result.status === 'error');

      if (failedResults.length > 0) {
        // 打印完整错误结果到控制台
        console.error('转发消息失败结果:', failedResults);
        if (failedResults.length !== allResults.length) {
          showToast('success', '部分转发成功')
          console.log('转发消息成功结果:', allResults.filter(result => result.status !== 'error'));
        }
        // 按消息ID和类型归类
        const errorsByMsgId = failedResults.reduce((acc, failed) => {
          if (!acc[failed.msg_id]) {
            acc[failed.msg_id] = {
              group: [],
              private: []
            };
          }

          if (failed.type === 'group') {
            acc[failed.msg_id].group.push(failed.contact_id);
          } else {
            acc[failed.msg_id].private.push(failed.contact_id);
          }

          return acc;
        }, {});

        // 构建错误消息，限制显示数量
        const displayedErrors = [];
        let msgCount = 0;

        for (const [msgId, contacts] of Object.entries(errorsByMsgId)) {
          if (msgCount >= 2) break;

          const parts = [];

          if (contacts.group.length > 0) {
            parts.push(`群聊: ${contacts.group.slice(0, 2).join(', ')}${contacts.group.length > 2 ? '...' : ''}`);
          }

          if (contacts.private.length > 0) {
            parts.push(`私聊: ${contacts.private.slice(0, 2).join(', ')}${contacts.private.length > 2 ? '...' : ''}`);
          }

          if (parts.length > 0) {
            displayedErrors.push(`消息ID: ${msgId} 发送失败, ${parts.join('; ')}`);
            msgCount++;
          }
        }

        const errorMessage = displayedErrors.join('; ') +
          (Object.keys(errorsByMsgId).length > 2 ? '; 更多失败项...' : '');

        showToast('error', errorMessage);
      } else {
        showToast('success', '已转发');
      }
    },

    handleContactsPickerCancel() {
      this.messageContentToForward = this.messageIdToForward = undefined
    },

    // 公共通用文件选择工具方法
    /**
     * 打开系统文件选择器，返回 File 数组
     * @param {Object} pickerOptions showOpenFilePicker 配置
     * @returns {Promise<File[]>}
     */
    async openFilePicker(pickerOptions) {
      // 浏览器API兼容校验
      if (!('showOpenFilePicker' in window)) {
        alert('您的浏览器不支持 File System Access API，请使用最新版 Chrome/Edge 浏览器，并在安全上下文打开网页');
        return [];
      }

      try {
        const fileHandles = await window.showOpenFilePicker(pickerOptions);
        // 批量读取 File 对象
        const fileList = await Promise.all(
          fileHandles.map(handle => handle.getFile())
        );
        // 过滤空大小文件
        const validFiles = fileList.filter(file => file.size > 0);
        // 存在空文件时提示
        if (validFiles.length !== fileList.length) {
          showToast('info', '已自动过滤空文件/文件夹');
        }
        return validFiles;
      } catch (error) {
        // 用户取消弹窗不报错
        if (error.name !== 'AbortError') {
          console.error('选择文件时出错:', error);
        }
        return [];
      }
    },

    // 转换文件列表为 processDataTransferItems 返回值兼容格式
    processSelectedFiles(files) {
      return files.map(f => ({ data: f, kind: 'file', type: f.type }))
    },

    // 选择图片并插入光标位置
    async handleMessageInputSelectImages(attachInfo) {
      const pickerOpts = {
        types: [
          {
            description: '图片 & 视频',
            accept: {
              'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg'],
              'video/*': ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.flv']
            }
          }
        ],
        multiple: true,
        excludeAcceptAllOption: false
      };

      await this.handleDropFiles(this.processSelectedFiles(await this.openFilePicker(pickerOpts)), 'media', attachInfo)
    },

    // 选择任意普通文件
    async handleMessageInputSelectFiles(attachInfo = null) {
      const pickerOpts = {
        types: [
          {
            description: '所有文件',
          }
        ],
        multiple: true,
        excludeAcceptAllOption: false
      };

      await this.handleDropFiles(this.processSelectedFiles(await this.openFilePicker(pickerOpts)), 'file', attachInfo)
    },

    // 选择音频文件
    async handleMessageInputSelectAudios() {
      const pickerOpts = {
        types: [
          {
            description: '音频文件',
            accept: {
              'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma']
            }
          }
        ],
        multiple: true,
        excludeAcceptAllOption: false
      };

      await this.handleDropFiles(this.processSelectedFiles(await this.openFilePicker(pickerOpts)), 'record')
    },

    handleFilesUploadTasksViewer() {
      this.showFilesUploadTasks = !this.showFilesUploadTasks
    },
    handleFilesUploadTasksViewerClose() {
      this.showFilesUploadTasks = false
    },

    handleSelectUploadGroupFiles(files, folder_id) {
      const attachInfo = { folder_id }
      if (isUndefined(files)) {
        this.handleMessageInputSelectFiles(attachInfo)
      } else if (files?.length) {
        this.handleDropFiles(this.processSelectedFiles(files), 'file', attachInfo)
      }
    },

    handleSelectUploadGroupImages(files, album_id, album_name) {
      const attachInfo = { album_id, album_name }
      if (isUndefined(files)) {
        this.handleMessageInputSelectImages(attachInfo)
      } else if (files?.length) {
        this.handleDropFiles(this.processSelectedFiles(files), 'media', attachInfo)
      }
    },

    // ====== 录音功能 ======

    formatRecordTime(seconds) {
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60
      let result = ''
      if (days > 0) result += `${String(days).padStart(2, '0')} 天 `
      if (hours > 0) result += `${String(hours).padStart(2, '0')}:`
      result += `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      return result
    },

    async requestRecordPermission() {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        console.error('获取录音权限失败:', err)
        showErrorToast('获取录音权限失败')
        return null
      }
    },

    /**
     * 打开AI语音录制编辑器
     */
    handleOpenGroupAiRecordEditor() {
      if (!this.isGroup) return
      this.showGroupAiRecordEditor = true
    },
    /**
     * 关闭AI语音录制编辑器
     */
    handleCloseGroupAiRecordEditor() {
      this.showGroupAiRecordEditor = false
    },

    /**
     * 打开录音面板（始终切换，不阻塞权限获取）
     * 仍然请求权限，但即使没有权限也切换到面板（方便拖放音频文件到面板上）
     */
    async handleOpenRecordPanel() {
      if (this.isShowRecordPanel) return
      // 先切换到面板，不阻塞
      this.isShowRecordPanel = true
      // 尝试获取权限，但不阻塞面板显示
      const stream = await this.requestRecordPermission()
      if (stream) {
        this.recordStream = stream
      }
    },

    /**
     * 开始录音的底层逻辑（不处理激活计数）
     */
    async startRecording() {
      if (!this.activeContact) return
      if (this.isRecording) return
      let stream = this.recordStream
      if (!stream) {
        stream = await this.requestRecordPermission()
        if (!stream) return
        this.recordStream = stream
      }
      this.isRecording = true
      this.recordShouldCancel = false
      this.isRecordPaused = false
      this.audioChunks = []
      this.recordDuration = 0

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      this.mediaRecorder = mediaRecorder

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
      }

      mediaRecorder.start()

      this.recordTimer = setInterval(() => {
        this.recordDuration++
      }, 1000)
    },

    /**
     * 增加一个录音激活源
     */
    async incrRecord() {
      if (!this.activeContact) return

      this.recordActiveCount++

      if (this.isRecording && !this.isRecordPaused) {
        // 已录音且非暂停：仅增加计数，保持录音
        return
      }

      if (this.isRecordPaused) {
        // 暂停状态下，恢复录音
        this.resumeRecord()
        return
      }

      // 未录音，开始录音
      if (this.recordActiveCount === 1) {
        await this.startRecording()
      }
    },

    /**
     * 减少一个录音激活源
     */
    decrRecord(event) {
      if (this.recordActiveCount <= 0) return
      this.recordActiveCount--

      // 锁定模式下不因激活源归零而停止录音
      if (this.isRecordLocked) return

      // 非锁定模式，所有激活源消失，根据状态决定后续操作
      if (this.recordActiveCount === 0) {
        this.evaluateRelease(event)
      }
    },

    /**
     * 所有激活源释放后，判断是发送、取消还是其他操作
     */
    evaluateRelease(event) {
      if (this.recordShouldCancel) {
        this.cancelRecord()
        return
      }

      // 如果正处于暂停状态，松手不做任何事
      if (this.isRecordPaused) return

      if (event) {
        const target = event.target
        // 在取消按钮上松开 -> 取消
        if (this.isHoveringCancel || (target && target.closest('.message-input-record-cancel'))) {
          this.cancelRecord()
          return
        }
        // 在锁按钮上松开 -> 切换为锁定模式并保持录音
        if (target && target.closest('.message-input-record-lock')) {
          this.isRecordLocked = true
          return
        }
        // 在播放/暂停按钮上松开 -> 解锁模式下非暂停则暂停
        if (target && target.closest('.message-input-record-play-switch')) {
          if (!this.isRecordPaused) {
            this.pauseRecord()
          }
          return
        }
      }

      // 其他情况：发送录音
      this.finishRecord()
    },

    /**
     * 暂停录音
     */
    pauseRecord() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause()
        this.isRecordPaused = true
        if (this.recordTimer) {
          clearInterval(this.recordTimer)
          this.recordTimer = null
        }
      }
    },

    /**
     * 恢复录音
     */
    resumeRecord() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume()
        this.isRecordPaused = false
        if (!this.recordTimer) {
          this.recordTimer = setInterval(() => {
            this.recordDuration++
          }, 1000)
        }
      }
    },

    /**
     * 完成录音并发送
     */
    async finishRecord() {
      if (!this.isRecording) return
      this.isRecording = false

      if (this.recordTimer) {
        clearInterval(this.recordTimer)
        this.recordTimer = null
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        await new Promise(resolve => {
          this.mediaRecorder.onstop = () => {
            resolve()
          }
          this.mediaRecorder.stop()
        })
      }
      this.mediaRecorder = null

      const duration = this.recordDuration
      this.recordDuration = 0
      this.isRecordPaused = false
      this.recordActiveCount = 0

      if (duration < 1) {
        showWarningToast('录音时间太短')
        this.audioChunks = []
        return
      }

      if (this.recordShouldCancel) {
        this.audioChunks = []
        this.recordShouldCancel = false
        return
      }

      if (this.audioChunks.length > 0) {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        this.audioChunks = []
        const fileName = `record_${Date.now()}.webm`
        const file = new File([audioBlob], fileName, { type: 'audio/webm' })
        const contact = toRaw(this.activeContact)
        if (contact) {
          fetchSendFiles({ contact, files: file, type: 'record' }).then(r => {
            if (r?.status === 'error') {
              console.log('Send record error:', r)
            }
          })
        }
      }
    },

    /**
     * 取消录音（不发送）
     */
    cancelRecord() {
      if (!this.isRecording && this.recordActiveCount <= 0) return

      this.recordShouldCancel = true
      this.recordActiveCount = 0
      this.isRecording = false
      this.isRecordPaused = false

      if (this.recordTimer) {
        clearInterval(this.recordTimer)
        this.recordTimer = null
      }

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop()
      }
      this.mediaRecorder = null

      this.recordDuration = 0
      this.audioChunks = []
    },

    async handleRecordIconMouseDown(e) {
      // 只处理麦克风图标的 mousedown，排除锁和播放按钮
      const target = e.target
      if (!target.closest('.message-input-record-microphone')) return

      // 锁定且正在录音时，忽略长按（麦克风此时作为发送按钮）
      if (this.isRecordLocked && this.isRecording) return
      await this.incrRecord()
      document.addEventListener('mouseup', this.handleRecordIconDocMouseUp)
    },

    handleRecordIconDocMouseUp(e) {
      document.removeEventListener('mouseup', this.handleRecordIconDocMouseUp)
      this.decrRecord(e)
    },

    /**
     * 发送录音（锁定模式时点击发送图标触发）
     */
    handleSendRecord() {
      if (this.isRecording) {
        this.finishRecord()
      }
    },

    handleWindowRecordKeyDown(e) {
      if (!this.isShowRecordPanel) return
      this.handleRecordPanelKeyDown(e)
    },

    handleWindowRecordKeyUp(e) {
      if (!this.isShowRecordPanel) return
      this.handleRecordPanelKeyUp(e)
    },

    async handleRecordPanelKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (this.isRecording) {
          this.cancelRecord()
        } else {
          this.isShowRecordPanel = false
        }
        return
      }

      // 空格键按下
      if (e.key === ' ' || e.code === 'Space') {
        if (!e.repeat) {
          e.preventDefault()
          if (this.isRecording && this.isRecordLocked) {
            // 锁定模式下，切换暂停/非暂停
            if (this.isRecordPaused) {
              this.resumeRecord()
            } else {
              this.pauseRecord()
            }
          } else {
            // 非锁定模式：增加激活源（开始录音或恢复录音）
            await this.incrRecord()
          }
        }
      }
    },

    handleRecordPanelKeyUp(e) {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        // 锁定模式下空格已在 keydown 中处理，keyup 不做任何事
        if (!(this.isRecording && this.isRecordLocked)) {
          this.decrRecord()
        }
      }
    },

    handleRecordCancelMouseEnter() {
      this.isHoveringCancel = true
    },

    handleRecordCancelMouseLeave() {
      this.isHoveringCancel = false
    },

    handleLockClick() {
      if (this.isRecording) {
        if (this.isRecordLocked) {
          // 锁定 -> 解锁，并暂停
          this.isRecordLocked = false
          this.pauseRecord()
        } else {
          // 解锁 -> 锁定，保持录音
          this.isRecordLocked = true
        }
      } else {
        // 未录音，仅切换锁定状态
        this.isRecordLocked = !this.isRecordLocked
      }
    },

    handlePlaySwitchClick() {
      if (!this.isRecording) {
        // 未录音：锁定并开始录音
        this.isRecordLocked = true
        this.startRecording()
      } else {
        // 录音中
        if (this.isRecordLocked) {
          // 锁定模式：自由切换暂停/恢复
          if (this.isRecordPaused) {
            this.resumeRecord()
          } else {
            this.pauseRecord()
          }
        } else {
          // 解锁模式
          if (this.isRecordPaused) {
            // 暂停状态：恢复录音并锁定
            this.resumeRecord()
            this.isRecordLocked = true
          } else {
            // 非暂停：暂停录音
            this.pauseRecord()
          }
        }
      }
    },

    handleExitRecordPanel() {
      if (this.isRecording) {
        this.cancelRecord()
      } else {
        this.isShowRecordPanel = false
      }
    },
  },
  computed: {
    lockIcon() {
      return this.isRecordLocked ? 'tabler:lock' : 'tabler:lock-open'
    },
    playSwitchIcon() {
      return (this.isRecording && !this.isRecordPaused)
        ? 'pause_24'
        : 'play_fill_24'
    },
    emojiGroupList() {
      const category = {
        "互动表情": [
          114, 358, 359,
          ...(this.isPrivate ? Array.from({ length: 6 }, (_, i) => `poke_${i + 1}`) : [])// 窗口抖动
        ],
        "汪汪": [360, 361, 362, 363, 364, 365, 366, 367, 396, 397],
        "喜花妮": [404, 405, 406, 407, 408, 409, 410, 411, 412, 413],
        "企鹅": [376, 377, 378, 379, 380, 381, 382, 383, 400, 401],
        "噗噗星人": [368, 369, 370, 371, 372, 373, 374, 375, 398, 399]
      }
      const usedId = []
      const specialList = []
      Object.entries(category).forEach(([title, list]) => {
        usedId.push(...list)
        specialList.push({ title, list })
      })
      return [
        ...specialList,
        { title: 'QQ 黄脸', list: this.global.superEmojiids.filter(id => !usedId.includes(parseInt(id))) },
        { title: '小黄脸表情', list: this.global.normalEmojiids },
        { title: 'emoji 表情', list: this.global.emojiEmojiids }
      ]
    },
    emojiDescribes() {
      return this.global.emojiDescribes
    },
    emojiFiles() {
      return this.global.emojiFiles
    },
    isGroup() {
      return this.activeContact?.type === 'group'
    },
    isPrivate() {
      return this.activeContact?.type === 'private'
    },
    filteredAtGroupUsers() {
      if (!isArray(this.groupUsers)) {
        return null;
      }
      const atGroupUsers = this.groupUsers.map(
        item => ({
          ...item,
          name: getCacheGroupUserName(item.group_id, item.user_id) || item.card || item.nickname
        })
      )

      if (this.remainGroupAtAll?.can_at_all) {
        atGroupUsers.unshift({ user_id: 'all', name: '全体成员' })
      }

      if (!this.atMentionText) {
        return atGroupUsers;
      }

      const searchText = this.atMentionText.toLowerCase();

      // 分类匹配结果
      const directMatches = [];
      const pinyinMatches = [];
      const qqMatches = [];

      atGroupUsers.forEach(user => {
        // 直接匹配 name
        if (user.name.toLowerCase().includes(searchText)) {
          directMatches.push(user);
          return;
        }

        // 拼音匹配
        const namePinyin = pinyin(user.name, { toneType: "none", type: "array" }).join('').toLowerCase();
        if (namePinyin.includes(searchText)) {
          pinyinMatches.push(user);
          return;
        }

        // QQ号匹配
        if (String(user.user_id).includes(searchText)) {
          qqMatches.push(user);
        }
      });

      // 合并结果，按优先级排序
      return [...directMatches, ...pinyinMatches, ...qqMatches];
    },

    currentFilesUploadTasks() {
      return this.filesUploadTasks
        .filter(({ contact }) => checkSameContact(contact, this.activeContact))
        .sort((a, b) => {
          // create_time 是 Date.now() 格式（毫秒时间戳，数字）
          return b.create_time - a.create_time;
        });
    },

    selfGroupInfo() {
      return this.groupUsers?.find?.(user => user.user_id === this.selfId)
    },

    isOperatorSelf() {
      if (!this.isGroup) return false
      return isGroupOperator(this.selfGroupInfo)
    },

    isGroupAllMuted() {
      if (!this.isGroup) return false
      return getGroupInfoCacheFromAll(this.activeContact.contact_id)?.group_all_shut === -1
    },

    hasBeenMuted() {
      return !!this.selfGroupInfo?.shut_up_timestamp || (this.isGroupAllMuted && !this.isOperatorSelf)
    },

    selfMutedEndTime() {
      return this.isGroupAllMuted ? "全员禁言中" : formatTimeOptions({
        timestamp: this.selfGroupInfo?.shut_up_timestamp || 0,
        alwaysMD: false
      })
    }
  },
  watch: {
    filteredAtGroupUsers() {
      this.selectedAtIndex = 0;
    },
    activeContact(newVal, oldVal) {
      if (oldVal?.type !== newVal?.type || oldVal?.contact_id !== newVal?.contact_id) {
        this.remainGroupAtAll = undefined
      }
    },
    async atInputPosition(val) {
      if (this.isGroup && val) {
        this.remainGroupAtAll = await fetchRemainGroupAtAll(this.activeContact.contact_id)
      } else {
        this.remainGroupAtAll = undefined
      }
    },
    isShowRecordPanel(val) {
      if (val) {
        this.$nextTick(() => {
          this.$refs.recordPanel?.focus()
        })
      } else {
        // 退出录音面板时，如果正在录音则取消
        if (this.isRecording) {
          this.cancelRecord()
        }
        // 停止并释放录音流
        if (this.recordStream) {
          this.recordStream.getTracks().forEach(track => track.stop())
          this.recordStream = null
        }
        // 重置状态
        // this.isRecordLocked = false
        this.isRecordPaused = false
      }
    }
  }
});
</script>

<template>
  <div class="message-input-box">
    <FilesUploadTasksViewer
      v-if="showFilesUploadTasks && currentFilesUploadTasks?.length"
      :tasks="currentFilesUploadTasks"
      @close="handleFilesUploadTasksViewerClose"
    />
    <FilesConfirm
      v-if="this.pendingUploadInfo.confirming && this.pendingUploadInfo.files?.length"
      :files="this.pendingUploadInfo.files"
      :contact-name="activeContact?.name"
      :on-confirm="handleFilesConfirm"
      :on-cancel="handleFilesConfirmCancel"
      :type-name="formatPendingUploadType()"
    />
    <ContactsPicker v-if="messageIdToForward?.length"
                    :on-confirm="handleContactsPickerConfirm"
                    :on-cancel="handleContactsPickerCancel"/>
    <Tooltip v-if="isGroup && atInputPosition && filteredAtGroupUsers?.length" :tip-position="atInputPosition"
             placement="tr">
      <template #content>
        <div class="tooltip-style" style="padding: 2px 0" ref="atGroupUsersTooltip">
          <VirtualScroller :item-height="32" :items="filteredAtGroupUsers" :buffer="20"
                           class="at-group-users-container"
                           ref="atUsersScroller">
            <template #default="{ item, index }">
              <div
                class="at-group-user-container"
                :class="{ 'selected': selectedAtIndex === index }"
                @mouseenter="handleMouseEnterAtUser(index)"
                @click="handleSelectAtUser(item)"
              >
                <div class="at-group-user" v-if="item.user_id === 'all'">
                  <div class="at-group-user-name">
                    <QIcon class="at-group-all-members-icon" name="at_24"></QIcon>
                    <span class="text-truncate">全体成员</span>
                  </div>
                  <span class="at-group-user-qq">剩余 {{
                      remainGroupAtAll?.remain_at_all_count_for_uin ?? "?"
                    }} 次</span>
                </div>
                <div class="at-group-user" v-else>
                  <div class="at-group-user-name">
                    <img alt="" :src="`https://q1.qlogo.cn/g?b=qq&nk=${item.user_id}&s=40`">
                    <span class="text-truncate">{{ item.name }}</span>
                  </div>
                  <span class="at-group-user-qq">{{ item.user_id }}</span>
                </div>
              </div>
            </template>
          </VirtualScroller>
        </div>
      </template>
    </Tooltip>
    <GroupAiRecordEditor
      v-if="showGroupAiRecordEditor && isGroup"
      :group_id="activeContact?.contact_id"
      @close="handleCloseGroupAiRecordEditor"
    />
    <vue-resizable
      class="message-input-resizeable"
      :active="['t']"
      :height="180"
      :minHeight="140"
    >
      <div class="message-input-muted-mask" :class="{ 'display-flex': hasBeenMuted }">
        禁言中...
        <p>解除时间：{{ selfMutedEndTime }}</p>
      </div>
      <div class="message-input-common-panel message-input-panel" :class="{ 'display-none': isShowRecordPanel }">
        <div class="message-input-controls">
          <div class="message-input-controls-left">
            <Tooltip
              content="表情"
              use-target-slot
            >
              <template #target>
                <QIcon ref="expressionControl" class="message-input-ctrl-icon" name="expression_24"/>
              </template>
            </Tooltip>
            <Tooltip
              v-if="refReady"
              :target="$refs.expressionControl.svg"
              :distance-from-target="6"
              z-index="1001"
              :always-exists="true"
              min-left="(window.innerWidth <= 570) ? 5px : (var(--sidebar-width) + 5px)"
              trigger="toggle"
            >
              <template #content>
                <div class="message-input-expression-box tooltip-style">
                  <CustomScrollBar class="message-input-expression-scroller">
                    <template v-for="(category, i) in emojiGroupList" :key="i">
                      <p class="message-input-expression-category-title">
                        {{ category.title }}
                      </p>
                      <div class="message-input-expression-category">
                        <Tooltip
                          :distance-from-target="0"
                          use-target-slot
                          v-for="(emoji, index) in category.list"
                          :key="index"
                          z-index="1002"
                        >
                          <template #target>
                            <div
                              class="message-input-expression-emoji-box"
                              @click="handleExpressionInput"
                              :data-emoji="emoji"
                            >
                              <img
                                :src="getPngEmojiUrl(emoji, true)"
                                alt=""
                                :data-emoji-animation="getApngEmojiUrl(emoji) ? 'static' : ''"
                              />

                              <img
                                v-if="getApngEmojiUrl(emoji)"
                                :src="getApngEmojiUrl(emoji)"
                                alt=""
                                data-emoji-animation="animation"
                              />
                            </div>
                          </template>
                          <template #content>
                            <div class="tooltip-style message-input-expression-emoji-tooltip"
                                 v-if="getEmojiDescription(emoji)">
                              {{ getEmojiDescription(emoji) }}
                            </div>
                          </template>
                        </Tooltip>
                      </div>
                    </template>
                  </CustomScrollBar>
                </div>
              </template>
            </Tooltip>

            <Tooltip
              content="文件"
              use-target-slot
            >
              <template #target>
                <QIcon @click="handleMessageInputSelectFiles()" class="message-input-ctrl-icon" name="folder_24"/>
              </template>
            </Tooltip>

            <Tooltip
              content="图片"
              use-target-slot
            >
              <template #target>
                <QIcon @click="handleMessageInputSelectImages()" class="message-input-ctrl-icon" name="image_24"/>
              </template>
            </Tooltip>

            <Tooltip
              v-if="isPrivate"
              content="窗口抖动"
              use-target-slot
            >
              <template #target>
                <QIcon @click="handleMessageInputShake()" class="message-input-ctrl-icon" name="shake_24"/>
              </template>
            </Tooltip>

            <Tooltip
              content="语言消息"
              use-target-slot
            >
              <template #target>
                <QIcon @click="handleOpenRecordPanel"
                       class="message-input-ctrl-icon message-input-ctrl-icon-microphone"
                       name="microphone_on_24"/>
              </template>
            </Tooltip>
          </div>


          <div class="message-input-controls-right">
            <Tooltip
              v-if="currentFilesUploadTasks?.length"
              content="文件上传列表"
              use-target-slot
            >
              <template #target>
                <QIcon
                  name="files_24"
                  class="message-input-ctrl-icon"
                  @click="handleFilesUploadTasksViewer"
                />
              </template>
            </Tooltip>
          </div>
        </div>

        <CustomScrollBar class="message-input-scroller">
          <InputQuote :msg="quotedMessage" v-if="quotedMessage"
                      @cancel-quote-message="quotedMessage=null" ref="inputQuote"></InputQuote>
          <div
            ref="editor"
            contenteditable
            class="message-input-editor"
            @paste="handlePaste"
            @dragover.prevent="handleDragOver"
            @dragenter.prevent
            @dragstart="handleDragStart"
            @click="updateCaretPosition"
            @keyup="updateCaretPosition"
            @keydown="handleKeyDown"
            @input="handleInput"
            @mousedown.capture="handleMousedown"
          ></div>
        </CustomScrollBar>

        <div class="message-input-send-button-container">
          <div class="message-input-send-button" @click="handleSendMessage">发送</div>
        </div>
      </div>
      <div class="message-input-record-panel message-input-panel"
           :class="{ 'display-flex': isShowRecordPanel }"
           tabindex="-1"
           ref="recordPanel">
        <div class="message-input-controls">
          <div class="message-input-controls-left">
            <Tooltip
              content="音频文件"
              use-target-slot
            >
              <template #target>
                <QIcon
                  name="folder_24"
                  class="message-input-ctrl-icon"
                  @click="handleMessageInputSelectAudios()"
                />
              </template>
            </Tooltip>
            <Tooltip
              content="AI 语音"
              use-target-slot
              v-if="isGroup"
            >
              <template #target>
                <QIcon
                  name="ai_label_16"
                  class="message-input-ctrl-icon"
                  @click="handleOpenGroupAiRecordEditor"
                />
              </template>
            </Tooltip>
          </div>
          <div class="message-input-controls-right">
            <Tooltip
              v-if="currentFilesUploadTasks?.filter(task=>task?.type==='record')?.length"
              content="音频上传列表"
              use-target-slot
            >
              <template #target>
                <QIcon
                  name="files_24"
                  class="message-input-ctrl-icon"
                  @click="handleFilesUploadTasksViewer"
                />
              </template>
            </Tooltip>
          </div>
        </div>
        <div class="message-input-record-timer">{{ formatRecordTime(recordDuration) }}</div>
        <div class="message-input-record-container"
             @mousedown="handleRecordIconMouseDown"
             @mouseleave="isHoveringCancel = false">
          <Icon
            :icon="lockIcon"
            @click.stop="handleLockClick"
            class="message-input-record-icon message-input-record-lock"/>
          <div class="message-input-record-microphone message-input-record-icon"
               :class="{ active: isRecording && !isRecordPaused }">
            <template v-if="isRecording && isRecordLocked">
              <Icon icon="tabler:send" @click.stop="handleSendRecord"/>
            </template>
            <template v-else>
              <QIcon name="microphone_on_24"></QIcon>
            </template>
          </div>
          <QIcon
            :name="playSwitchIcon"
            class="message-input-record-icon message-input-record-play-switch"
            @mousedown.stop
            @click.stop="handlePlaySwitchClick"
            :style="{ paddingLeft: playSwitchIcon === 'play_fill_24' ? '12px' : '10px' }"
          />
        </div>
        <div class="text-muted message-input-record-hint">
          <template v-if="isRecording">
            <!-- 录音中 -->
            <!-- 解锁、非暂停：松手发送 -->
            <template v-if="!isRecordLocked && !isRecordPaused">
              松手发送，按 Esc 键或点击
            </template>
            <!-- 解锁、暂停 -->
            <template v-else-if="!isRecordLocked && isRecordPaused">
              录音已暂停，按下空格键或长按麦克风恢复，按 Esc 键或点击
            </template>
            <!-- 锁定、暂停 -->
            <template v-else-if="isRecordLocked && isRecordPaused">
              录音已暂停（锁定），点击播放继续，点击锁解锁并保持暂停，按 Esc 键或点击
            </template>
            <!-- 锁定、非暂停 -->
            <template v-else>
              录音中（锁定），点击发送按钮发送，点击锁解锁并暂停，按 Esc 键或点击
            </template>
            <span @click="cancelRecord"
                  @mouseenter="handleRecordCancelMouseEnter"
                  @mouseleave="handleRecordCancelMouseLeave"
                  class="message-input-record-cancel">取消发送</span>
          </template>
          <template v-else>
            <!-- 未录音 -->
            <template v-if="isRecordLocked">
              已锁定，点击麦克风或空格键开始录音，点击
            </template>
            <template v-else>
              按住空格键开始说话，按 Esc 键或点击
            </template>
            <span @click="handleExitRecordPanel"
                  @mouseenter="handleRecordCancelMouseEnter"
                  @mouseleave="handleRecordCancelMouseLeave"
                  class="message-input-record-cancel">退出</span>
          </template>
        </div>
      </div>
    </vue-resizable>
  </div>
</template>

<style scoped lang="scss">
.message-input-box {
  background: $color-bg-chat;
  border-top: 1px solid $color-border;
  max-height: 50%;
  width: 100%;
}

.message-input-resizeable {
  top: 0 !important;
  max-height: 100%;
  padding: 0;
  width: 100% !important;
}

.message-input-controls {
  white-space: nowrap;
  display: flex;
  padding: 0;
  margin: 0;
  justify-content: space-between;
  align-items: center;
  height: 35px;
  flex-shrink: 0;
}

.message-input-ctrl-icon {
  height: 24px;
  width: 24px;
  display: inline-block;
  margin: 0 0 0 15px;
  color: black;
  vertical-align: middle;
}

.message-input-controls-right .message-input-ctrl-icon {
  margin: 0 15px 0 0;
}

.message-input-ctrl-icon:hover {
  color: $color-primary;
}

.message-input-send-button {
  background-color: $color-primary;
  border-radius: 4px;
  font-size: 13px;
  color: white;
  cursor: default;
  margin: 0 15px 0 0;
  display: inline-block;
  padding: 4px 20px;
  align-self: flex-end;
}

.message-input-send-button-container {
  height: 45px;
  display: flex;
  align-items: flex-end;
  flex-shrink: 0;
  flex-direction: column;
  justify-content: center;
}

.message-input-scroller {
  flex: 1;
  overflow: auto;
}

.message-input-editor {
  flex: 1;
  outline: none;
  line-height: 22px;
  word-wrap: break-word;
  word-break: break-all;
  overflow-wrap: break-word;
  color: black;
  white-space: pre-wrap;

  :deep(.message-input-editor-image), :deep(.message-input-editor-video) {
    max-width: 110px;
    max-height: 110px;
    min-width: 40px;
    min-height: 40px;
    cursor: default;
    border-radius: 4px;
    object-fit: cover;
    vertical-align: middle;
  }

  :deep(.message-input-editor-image) {
    background: #e8e8e8;
  }

  :deep(.message-input-editor-video) {
    @extend %no-user-select;
    background: #000;
    display: block;
  }

  :deep(.message-input-editor-video-wrapper) {
    display: inline-block;
    position: relative;
    line-height: 0;
    vertical-align: middle;
    border-radius: 4px;
    overflow: hidden;
    user-select: all;
  }

  :deep(.message-input-editor-video-wrapper)::after {
    content: '▶';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 20px;
    text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    line-height: 1;
  }
}

.tooltip-style.message-input-expression-box {
  height: 350px;
  width: 400px;
  max-height: 100%;
  max-width: 100%;
  padding: 15px 0;
}

.message-input-expression-category-title {
  color: $color-text-muted;
  font-size: 10px;
  margin: 5px 15px;
}

.message-input-expression-emoji-box {
  width: 35px;
  height: 35px;
  text-align: center;
  border-radius: 5px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  align-content: center;
  flex-wrap: nowrap;
}

.message-input-expression-emoji-box:hover {
  background-color: $color-bg-hover-alt;
}

.message-input-expression-emoji-box:active {
  background-color: $color-bg-active-alt;
}

.message-input-expression-category {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  flex-direction: row;
  gap: 2px;
  padding: 0 15px;
}

.message-input-expression-emoji-box img {
  width: 28px;
  height: 28px;
}

.message-input-expression-emoji-box img[data-emoji-animation='static'] {
  display: block;
}

.message-input-expression-emoji-box img[data-emoji-animation='animation'] {
  display: none;
}

.message-input-expression-emoji-box:hover img[data-emoji-animation='static'] {
  display: none;
}

.message-input-expression-emoji-box:hover img[data-emoji-animation='animation'] {
  display: block;
}

.tooltip-style.message-input-expression-emoji-tooltip {
  font-size: 11px;
  padding: 3px;
}

.message-input-editor {
  :deep(.message-input-editor-emoji) {
    width: 20px;
    height: 20px;
  }

  :deep(.message-input-editor-at-user) {
    color: $color-text-at-link;
    cursor: default;
    display: inline-block;
    -webkit-user-modify: read-only;
    -moz-user-modify: read-only;
    user-modify: read-only;
  }

  :deep(.message-input-editor-at-user):hover {
    color: $color-text-at-link;
  }
}

.at-group-users-container {
  width: 280px;
  max-height: 300px;
}

.at-group-user-container {
  height: 32px;
  overflow: hidden;
}

.at-group-user {
  height: 28px;
  margin: 2px 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  white-space: nowrap;
  border-radius: 5px;
  padding: 4px;
  cursor: pointer;
}

.at-group-user-container.selected .at-group-user {
  background-color: rgba(211, 211, 211, 0.3);
}

.at-group-user-name {
  white-space: nowrap;
  display: flex;
  flex: 1;
  align-items: center;
  overflow: hidden;
}

.at-group-user-name img, .at-group-all-members-icon {
  width: 20px;
  height: 20px;
  border-radius: 100%;
  margin: 0 5px 0 3px;
}


.at-group-user-name span {
  flex: 1;
}

.at-group-user-qq {
  color: $color-text-muted;
  font-size: 12px;
}

.at-group-all-members-icon {
  width: 20px;
  height: 20px;
  color: white;
  background-color: $color-primary;
  padding: 4px;
}

.message-input-panel {
  height: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  width: 100% !important;
}

.message-input-muted-mask {
  height: 100%;
  @extend %flex-center-children;
  @extend %flex-column;
  display: none;
  color: $color-text-muted;
}

.message-input-common-panel {
  align-items: stretch;
  justify-content: flex-start;
}

.message-input-record-panel {
  display: none;
  align-items: center;
  justify-content: center;
}

.message-input-record-timer {
  font-weight: 500;
  color: $color-text-regular;
  font-variant-numeric: tabular-nums;
}

.message-input-record-hint {
  font-size: 13px;
}

.message-input-record-container {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  gap: 30px;
  padding: 20px 0;
}

.message-input-record-exit,
.message-input-record-cancel {
  color: $color-text-record-cancel;
  cursor: pointer;
}

.message-input-record-panel .message-input-controls {
  position: absolute;
  right: 0;
  top: 0;
  width: 100%;
}

.message-input-record-icon {
  height: 45px;
  width: 45px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  --inner-color: transparent;
  --outer-color: transparent;
  background: radial-gradient(38.02% 38.02% at 50% 50%, var(--inner-color) 0px, var(--outer-color) 100%);
  color: white;
  padding: 10px;
}

.message-input-record-lock {
  --inner-color: rgb(255, 180, 50);
  --outer-color: rgb(255 134 0);
}

.message-input-record-play-switch {
  --inner-color: rgb(130 255 100);
  --outer-color: rgb(50, 200, 160);
}

.message-input-record-microphone {
  height: 52px;
  width: 52px;
  outline: rgba(0, 153, 255, 0.2) solid 2px;
  transition-duration: 0.3s;
  transition-timing-function: ease;
  transition-delay: 0s;
  transition-property: outline-width;
  --inner-color: rgb(0, 201, 255);
  --outer-color: rgb(0, 155, 255);
}

.message-input-record-microphone.active {
  outline-width: 6px;
  --inner-color: rgb(0, 177, 255);
  --outer-color: rgb(0, 128, 255);
}

.message-input-record-microphone svg {
  height: 24px;
  width: 24px;
}
</style>

<style>
.message-input-scroller .simplebar-scrollbar:before {
  left: 3px;
}

.message-input-scroller .simplebar-content-wrapper, .message-input-scroller .simplebar-content {
  height: 100% !important;
}

.message-input-scroller .simplebar-content {
  display: flex;
  flex-direction: column;
}

.message-input-scroller .simplebar-content-wrapper {
  padding: 0 15px;
}

.message-input-scroller .simplebar-track.simplebar-vertical {
  right: 5px;
}
</style>