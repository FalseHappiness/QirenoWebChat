import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue'
import vitePluginClean from 'vite-plugin-clean';

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
      {
        name: 'ignore-json-safety',
        resolveId(id) {
          // 匹配目标目录所有json
          if (/src\/components\/MessageTypes\/MessageJSON\/.*\.json$/.test(id)) {
            return false
          }
        }
      }
    ],
    external: ['vue'],
    resolve: {
      dedupe: ['vue']
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
          additionalData: `
            $env-base: "${base}";
            $base-url: "${base}";
          `
        }
      }
    }
  }
});