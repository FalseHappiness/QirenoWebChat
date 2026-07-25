function useBase() {
  return import.meta.env.VITE_BASE
}

function wrapBase(...paths) {
  const base = useBase();
  // 过滤空值、自动处理首尾斜杠，避免出现 // 双斜杠 （不处理 base）
  const validPaths = paths.filter(p => p != null && p !== '');
  // 全部拼接后统一分割再重组，标准化斜杠
  const allSegments = [...validPaths]
    .flatMap(item => String(item).split('/'))
    .filter(s => s && s.trim() !== '');
  return base + allSegments.join('/');
}

function qqWrapBase(...paths) {
  return wrapBase("QQ", ...paths)
}

function qqIcon(name) {
  return qqWrapBase("icons", name)
}

function qqIconSvg(name) {
  return qqIcon(name + '.svg')
}

function qqApp(subPath, ...paths) {
  return qqWrapBase("app", subPath, ...paths)
}

function qqAppImg(name) {
  return qqApp('img', name)
}

function qqFileIcon(name) {
  return qqWrapBase('fileIcon', name)
}

function qqAppPoke(pokeId, fileName) {
  return qqApp('poke', pokeId, fileName)
}

function qqSystemEmoji(emojiId, type, fileName) {
  return qqWrapBase("EmojiSystermResource", emojiId, type, fileName)
}

export {
  useBase,
  wrapBase,
  qqIcon,
  qqAppImg,
  qqIconSvg,
  qqFileIcon,
  qqAppPoke,
  qqSystemEmoji,
}