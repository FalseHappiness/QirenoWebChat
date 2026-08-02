import { useGlobalStore } from "@/store/global.js";

// 全局常量
const DEFAULT_THEME = 'default'

// 1. 自动加载所有主题样式（一次性引入，无需手动@import）
import.meta.glob('@/styles/themes/*/index.scss', { eager: true })

// 2. 自动读取全部主题 theme.json 元数据
const themeJsonModules = import.meta.glob('@/styles/themes/*/theme.json', { eager: true })
// 生成主题列表 & 映射表
export const themeList = []
export const themeMap = {}
for (const path in themeJsonModules) {
  const meta = themeJsonModules[path].default
  themeList.push(meta)
  themeMap[meta.id] = meta
}
// 原地重排，default 在前
themeList.sort((a, b) => {
  if (a.id === DEFAULT_THEME) return -1
  if (b.id === DEFAULT_THEME) return 1
  return 0
})

// 获取当前主题ID
export function getTheme() {
  const store = useGlobalStore()
  return store.theme || DEFAULT_THEME
}

// 把主题挂载到 html data-theme
export function applyTheme(themeId) {
  const targetId = themeId ?? getTheme()
  document.documentElement.setAttribute('data-theme', targetId)
}

// 切换主题：存入pinia持久化 + 应用样式
export function changeTheme(themeId) {
  // 不存在该主题则兜底默认
  if (!themeMap[themeId]) {
    themeId = DEFAULT_THEME
  }
  const store = useGlobalStore()
  store.theme = themeId
  applyTheme(themeId)
}