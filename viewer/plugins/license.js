import fs from 'node:fs';
import path from 'node:path';
import rollupLicense from 'rollup-plugin-license';

// 缓存依赖协议文本，减少重复IO
const pkgLicenseCache = new Map();

/**
 * 格式化author字段统一结构 {name,email,url}
 * @param {string|Record<string, string>|null} raw
 * @returns {{name:string|null,email:string|null,url:string|null}}
 */
function formatPersonMeta(raw) {
  if (!raw) return { name: null, email: null, url: null };
  if (typeof raw === 'string') {
    const match = raw.match(/^([^<(]+)?\s*(<([^>]+)>)?\s*\((.+)\)?$/);
    return {
      name: match?.[1]?.trim() || raw,
      email: match?.[3] || null,
      url: match?.[4] || null
    };
  }
  return {
    name: raw.name ?? null,
    email: raw.email ?? null,
    url: raw.url ?? null
  };
}

/**
 * 格式化contributors数组统一结构
 * @param {Array<string|Record>|unknown} rawList
 * @returns ReturnType<typeof formatPersonMeta>[]
 */
function formatContributorList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(item => formatPersonMeta(item));
}

/**
 * 读取项目自身 LICENSE，仅原生插件无法自动识别时使用兜底路径
 * @param {string} rootPkgPath 根package.json绝对路径
 * @param {string|null} fallbackLicensePath 用户传入自定义LICENSE路径
 * @returns {string|null}
 */
function tryReadSelfLicense(rootPkgPath, fallbackLicensePath) {
  try {
    const pkgDir = path.dirname(rootPkgPath);
    const licenseCandidates = ['LICENSE', 'LICENSE.txt', 'LICENSE-MIT', 'LICENSE-APACHE'];

    // 1. 优先原生默认目录查找
    for (const licName of licenseCandidates) {
      const licFullPath = path.resolve(pkgDir, licName);
      if (fs.existsSync(licFullPath)) {
        return fs.readFileSync(licFullPath, 'utf8');
      }
    }

    // 2. 原生找不到，才使用用户传入兜底文件
    if (fallbackLicensePath && fs.existsSync(fallbackLicensePath)) {
      return fs.readFileSync(fallbackLicensePath, 'utf8');
    }
  } catch {
  }
  return null;
}

/**
 * license 增强插件，兼容原生 rollup-plugin-license 所有配置
 * 自定义扩展配置仅插件内部使用，不传递给底层原生插件
 * @param {{
 *   banner: import('rollup-plugin-license').Options['banner'],
 *   thirdParty?: {
 *     // 自定义扩展字段（仅本插件识别）
 *     licenseFilePath?: string,
 *     includeDev?: boolean,
 *     devOutput?: { file: string; encoding?: string; template: (list: any[]) => string },
 *     // 原生rollup-plugin-license支持字段
 *     includePrivate?: boolean,
 *     includeSelf?: boolean,
 *     multipleVersions?: boolean,
 *     allow?: Record<string, any>,
 *     output?: Record<string, any>
 *   }
 * }} userOpts
 * @returns import('vite').Plugin
 */
export default function licensePlugin(userOpts) {
  const userThirdPartyRaw = userOpts?.thirdParty ?? {};

  // 剥离自定义扩展配置，不传给原生插件，消除未知字段警告
  const {
    licenseFilePath: fallbackLicPath,
    includeDev = false,
    devOutput,
    ...nativeThirdPartyCfg
  } = userThirdPartyRaw;

  // 根包缓存
  const rootPkgPath = path.resolve(process.cwd(), 'package.json');
  const rootMeta = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const selfLicenseText = tryReadSelfLicense(rootPkgPath, fallbackLicPath);

  // ========== 重写output.template，注入自身协议文本 ==========
  if (nativeThirdPartyCfg.output?.template) {
    const originalTemplate = nativeThirdPartyCfg.output.template;
    nativeThirdPartyCfg.output.template = (deps) => {
      // 遍历依赖列表，给 self=true 的条目填充 licenseText
      const filledDeps = deps.map(item => {
        if (item.self && !item.licenseText && selfLicenseText) {
          return {
            ...item,
            licenseText: selfLicenseText
          };
        }
        return item;
      });
      return originalTemplate(filledDeps);
    };
  }

  // 纯净原生插件配置（剔除自定义扩展key）
  const nativePluginOpts = {
    ...userOpts,
    thirdParty: nativeThirdPartyCfg
  };

  // 初始化底层rollup协议插件
  const corePlugin = (rollupLicense.default ?? rollupLicense)(nativePluginOpts);

  /**
   * 代理 renderChunk 钩子，原样透传原生逻辑
   */
  async function renderChunkProxy(code, chunk, outputOpts, meta) {
    if (typeof corePlugin.renderChunk !== 'function') return undefined;
    return corePlugin?.renderChunk(code, chunk, outputOpts, meta);
  }

  /**
   * 构建依赖结构化列表（仅用于dev开发依赖输出）
   */
  const buildDepMetaList = (depMap, isDev = false) => {
    const list = [];
    for (const [pkgName] of Object.entries(depMap)) {
      try {
        const pkgJsonPath = path.resolve(process.cwd(), 'node_modules', pkgName, 'package.json');
        const pkgMeta = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        let pkgLicenseText = null;
        const cacheKey = pkgJsonPath;
        if (pkgLicenseCache.has(cacheKey)) {
          pkgLicenseText = pkgLicenseCache.get(cacheKey);
        } else {
          const licFiles = ['LICENSE', 'LICENSE-MIT', 'LICENSE-APACHE', 'LICENSE.txt'];
          for (const licName of licFiles) {
            const licPath = path.resolve(path.dirname(pkgJsonPath), licName);
            if (fs.existsSync(licPath)) {
              pkgLicenseText = fs.readFileSync(licPath, 'utf8');
              pkgLicenseCache.set(cacheKey, pkgLicenseText);
              break;
            }
          }
        }
        list.push({
          self: false,
          dev: isDev,
          name: pkgMeta.name,
          version: pkgMeta.version,
          license: pkgMeta.license ?? null,
          licenseText: pkgLicenseText,
          description: pkgMeta.description ?? null,
          repository: pkgMeta.repository ?? null,
          homepage: pkgMeta.homepage ?? null,
          private: !!pkgMeta.private,
          author: formatPersonMeta(pkgMeta.author),
          contributors: formatContributorList(pkgMeta.contributors),
          maintainers: [],
          noticeText: null
        });
      } catch {
      }
    }
    return list;
  };

  /**
   * 使用原生renderChunk处理单个chunk代码，返回带banner的代码
   */
  async function applyBannerToChunk(rawCode, chunkInfo, outputOpts) {
    if (typeof corePlugin.renderChunk !== 'function') return rawCode;
    const result = await corePlugin?.renderChunk(rawCode, chunkInfo, outputOpts);
    if (!result) return rawCode;
    return typeof result === 'string' ? result : result.code;
  }

  /**
   * 打包结束钩子：
   * 1. 执行原生generateBundle（thirdParty协议文件输出）
   * 2. 遍历所有JS chunk主动追加banner，解决banner不生效问题
   * 3. 输出纯开发依赖devOutput文件（不含自身、运行时依赖）
   */
  async function generateBundle(outputOpts, bundleAssets, isWrite) {
    // 执行原生插件内置产物逻辑
    if (typeof corePlugin.generateBundle === 'function') {
      await corePlugin?.generateBundle(outputOpts, bundleAssets, isWrite);
    }

    // 遍历全部chunk，强制写入banner到bundle缓存
    for (const asset of Object.values(bundleAssets)) {
      if (asset.type === 'chunk' && typeof asset.code === 'string') {
        asset.code = await applyBannerToChunk(asset.code, asset, outputOpts);
      }
    }

    // 仅开启includeDev时输出开发依赖文件，只包含devDependencies
    if (!includeDev || !devOutput?.file) return;
    const pureDevList = buildDepMetaList(rootMeta.devDependencies ?? {}, true);
    const outputContent = devOutput.template(pureDevList);
    const outputAbsPath = path.resolve(devOutput.file);
    const outputDir = path.dirname(outputAbsPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputAbsPath, outputContent, devOutput.encoding ?? 'utf-8');
  }

  /**
   * config钩子完全透传原生插件，不修改banner、不注入任何自定义data
   */
  function config(configOpts) {
    if (typeof corePlugin.config === 'function') {
      return corePlugin?.config(configOpts);
    }
  }

  return {
    name: 'enhanced-rollup-license',
    renderChunk: renderChunkProxy,
    generateBundle: generateBundle,
    config
  };
}