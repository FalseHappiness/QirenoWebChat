import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue'
import vitePluginClean from 'vite-plugin-clean';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import * as path from "node:path";
import iconifyOffline from "vite-plugin-iconify-offline"

function isRelativePath(path) {
  if (!path) return false;
  // 去除首尾空白
  const str = path.trim();
  // 1. 匹配完整协议 http/https/ftp/wss
  const hasProtocol = /^(https?|ftp|wss?):\/\//.test(str);
  // 2. 匹配 // 协议简写
  const protoSlash = /^\/\//.test(str);
  // 3. 匹配根绝对路径 /
  const rootAbs = /^\//.test(str);
  // 4. Windows 盘符路径（本地文件场景可选）
  const winDrive = /^[A-Za-z]:[\\/]/.test(str);

  // 任意满足一条 = 绝对路径，否则是相对路径
  return !hasProtocol && !protoSlash && !rootAbs && !winDrive;
}

/**
 * 相对路径自动向上提升一级（加../）
 * @param {string} path
 * @returns {string}
 */
function upOneLevelRelative(path) {
  const str = path.trim();
  // 不是相对路径直接原样返回
  if (!isRelativePath(str)) return str;

  // 已经以 ../ 开头，无需修改
  if (str.startsWith('../')) return str;
  // 以 ./ 开头，替换为 ../
  if (str.startsWith('./')) return `../${str.slice(2)}`;
  // 普通相对路径，前面拼接 ../
  return `../${str}`;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载对应环境文件
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  function useBase() {
    return env.VITE_BASE ?? '/'
  }

  const base = useBase()

  return {
    plugins: [
      vue(),
      vitePluginClean({
        targetFiles: ['dist'] // 要删除的目录/文件
      }),
      createSvgIconsPlugin({
        // 扫描根目录下 src/QQ/icons
        iconDirs: [path.resolve(process.cwd(), 'src/QQ/icons')],
        symbolId: 'qq-icon-[name]',
      }),
      iconifyOffline({
        scanDir: "src",
        verbose: false,
        exclude: ["12"], // 直接屏蔽 12 这个不存在的图标集前缀
        icons: [] // 没有遗漏图标留空即可，缺图标再手动填 ["tabler:xxx"]
      }),
    ],
    external: ['vue'],
    resolve: {
      dedupe: ['vue'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    build: {
      emptyOutDir: true, // 构建前自动清空 dist 目录（没用？）
    },
    server: {
      // allowedHosts: true
    },
    base,
    css: {
      preprocessorOptions: {
        scss: {
          // css 输出到 assets 目录下，导致相对路径处理不正常
          additionalData: `
            $base-url: "${upOneLevelRelative(base)}";
          `
        }
      }
    }
  }
});