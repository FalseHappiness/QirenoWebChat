/**
 * 编辑器历史记录/撤销重做 composable
 * 管理 contenteditable 编辑器的撤销/重做栈、光标位置保存/恢复
 *
 * @param {Function|Object} editorRef - 编辑器 DOM 元素的 getter 函数，或包含 value 属性的对象
 */
export function useEditorHistory(editorRef) {
  // 历史记录栈
  const history = []
  // 当前历史位置
  let historyIndex = -1
  let inputTime = null
  // 忽略程序引起的DOM变化
  let ignoreChanges = false
  // 是否在拼词
  let isCompositing = false

  // 获取编辑器 DOM 元素
  function getEditor() {
    if (typeof editorRef === 'function') {
      return editorRef()
    }
    return editorRef?.value
  }

  // 获取节点的路径（从元素根开始）
  function getNodePath(node) {
    const editor = getEditor()
    if (!editor) return []
    const path = []
    while (node !== editor && node.parentNode) {
      const siblings = node.parentNode.childNodes
      let index = 0
      for (const sibling of siblings) {
        if (sibling === node) break
        index++
      }
      path.unshift({
        nodeType: node.nodeType,
        tagName: node.nodeType === 1 ? node.tagName : null,
        index,
      })
      node = node.parentNode
    }
    return path
  }

  // 根据路径获取节点
  function getNodeByPath(path) {
    const editor = getEditor()
    if (!editor) return null
    let node = editor
    for (const step of path) {
      const children = node.childNodes
      if (step.index < children.length && children[step.index].nodeType === step.nodeType) {
        node = children[step.index]
      } else {
        throw new Error('Path invalid')
      }
    }
    return node
  }

  // 保存光标位置（返回路径和偏移）
  function saveSelection() {
    const sel = window.getSelection()
    if (sel.rangeCount === 0) return null

    const range = sel.getRangeAt(0)
    return {
      startContainerPath: getNodePath(range.startContainer),
      startOffset: range.startOffset,
      endContainerPath: getNodePath(range.endContainer),
      endOffset: range.endOffset,
    }
  }

  // 恢复光标位置
  function restoreSelection(selData) {
    if (!selData) return

    try {
      const startContainer = getNodeByPath(selData.startContainerPath)
      const endContainer = getNodeByPath(selData.endContainerPath)
      if (!startContainer || !endContainer) return

      const sel = window.getSelection()
      sel.removeAllRanges()
      const range = new Range()

      range.setStart(startContainer, selData.startOffset)
      range.setEnd(endContainer, selData.endOffset)
      sel.addRange(range)
    } catch (e) {
      // 如果设置失败（可能路径失效），选择元素开头
      const editor = getEditor()
      if (!editor) return
      const sel = window.getSelection()
      sel.removeAllRanges()
      const range = new Range()
      range.selectNodeContents(editor)
      sel.addRange(range)
    }
  }

  // 用户在编辑后调用此方法记录状态
  function recordHistory() {
    const editor = getEditor()
    if (!editor) return
    // 获取当前 innerHTML
    const content = editor.innerHTML
    if (content === undefined) return
    // 保存光标位置（使用路径方式恢复）
    const selection = saveSelection()

    // 撤销时清除当前索引之后的未来历史
    history.length = historyIndex + 1
    history.push({ content, selection })
    historyIndex = history.length - 1
  }

  // 撤销
  function undo() {
    const editor = getEditor()
    if (!editor) return
    if (historyIndex > 0) {
      historyIndex--
      const state = history[historyIndex]
      editor.innerHTML = state.content
      restoreSelection(state.selection)
    }
  }

  // 重做
  function redo() {
    const editor = getEditor()
    if (!editor) return
    if (historyIndex < history.length - 1) {
      historyIndex++
      const state = history[historyIndex]
      editor.innerHTML = state.content
      restoreSelection(state.selection)
    }
  }

  // 移到末尾
  function moveCaretToEditorEnd() {
    const editor = getEditor()
    if (!editor) return
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)

    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }

  function handleCompositionStart() {
    isCompositing = true
  }

  function handleCompositionEnd() {
    isCompositing = false
    recordHistory()
  }

  function handleInput() {
    if (inputTime === null) {
      inputTime = Date.now()
    } else if ((Date.now() - inputTime > 300) && !isCompositing) {
      recordHistory()
      inputTime = null
    }
  }

  // 键盘事件处理（撤销/重做）
  function handleKeyDown(e) {
    // Ctrl+Z 或 Cmd+Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        // Ctrl+Shift+Z 重做
        redo()
      } else {
        // Ctrl+Z 撤销
        undo()
      }
      e.preventDefault()
      e.stopPropagation()
    }
    // Ctrl+Y 重做
    else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      redo()
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return {
    history,
    historyIndex,
    inputTime,
    ignoreChanges,
    isCompositing,
    recordHistory,
    undo,
    redo,
    saveSelection,
    restoreSelection,
    getNodePath,
    getNodeByPath,
    moveCaretToEditorEnd,
    handleCompositionStart,
    handleCompositionEnd,
    handleInput,
    handleKeyDown,
  }
}