// createEmojiList.cjs
const fs = require('fs');
const path = require('path');
const regedit = require('regedit').promisified;

// ====================== 配置区 ======================
const emojiDir = path.join(process.cwd(), 'public', 'QQ', 'EmojiSystermResource');
const targetDir = path.join(process.cwd(), 'src', 'QQ', 'EmojiConfig');
const outputFile = path.join(process.cwd(), 'src', 'assets', 'emoji_files.json');
// 查找 QQ 表情配置文件（用户文档目录）
const qqEmojiPath = path.join(
  process.env.USERPROFILE,
  'Documents\\Tencent Files\\nt_qq\\global\\nt_data\\Emoji\\emoji-resource\\face_config.json'
);

// =====================================================

/**
 * 读取注册表获取QQNT安装根目录（兼容新版注册表 DisplayIcon / Install 字段）
 * @returns {Promise<{qqDir: string|null, qqExe: string|null}>}
 */
async function getQQInstallPath() {
  const regKeys = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\QQ',
    'HKLM\\SOFTWARE\\WOW6432Node\\Tencent\\QQNT',
    'HKCU\\Software\\Tencent\\QQNT',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\QQ.exe'
  ];

  let qqDir = null;
  let qqExe = null;
  const regResult = await regedit.list(regKeys);

  for (const keyPath of regKeys) {
    const entry = regResult[keyPath];
    if (!entry.exists) continue;
    const values = entry.values;

    // 1. 适配新版注册表：Uninstall 项下 DisplayIcon 提取QQ完整exe路径
    if (keyPath.includes('Uninstall\\QQ') && values.DisplayIcon) {
      const icoRaw = values.DisplayIcon.value;
      const exePath = icoRaw.split(',')[0];
      if (fs.existsSync(exePath)) {
        qqExe = exePath;
        qqDir = path.dirname(qqExe);
        break;
      }
    }

    // 2. QQNT主键 Install 字段（新版QQNT存放根目录）
    if (values.Install) {
      qqDir = values.Install.value;
      qqExe = path.join(qqDir, 'QQ.exe');
      if (fs.existsSync(qqExe)) break;
    }

    // 兼容旧版QQNT InstallLocation
    if (values.InstallLocation) {
      qqDir = values.InstallLocation.value;
      qqExe = path.join(qqDir, 'QQ.exe');
      if (fs.existsSync(qqExe)) break;
    }
    // 兼容旧版 InstallDir
    if (values.InstallDir) {
      qqDir = values.InstallDir.value;
      qqExe = path.join(qqDir, 'QQ.exe');
      if (fs.existsSync(qqExe)) break;
    }
    // App Paths 兜底
    if (values[''] && values[''].value) {
      qqExe = values[''].value;
      qqDir = path.dirname(qqExe);
      if (fs.existsSync(qqExe)) break;
    }
  }

  if (qqExe && fs.existsSync(qqExe)) {
    return { qqDir, qqExe };
  }
  return { qqDir: null, qqExe: null };
}

/**
 * 递归获取目录下所有文件，输出项目相对web路径
 * @param {string} dir 扫描目录
 * @param {string[]} fileList 收集列表
 * @returns {string[]} 文件web路径数组
 */
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 如果是目录，递归处理
      getFiles(filePath, fileList);
    } else {
      // 如果是文件，添加到列表
      const relativePath = path.relative(
        path.join(process.cwd(), 'public'),
        filePath
      ).replace(/\\/g, '/'); // Windows 路径转换为正斜杠

      fileList.push(`/${relativePath}`);
    }
  });

  return fileList;
}

/**
 * 复制源目录一级下所有JSON文件到目标目录（非递归）
 * @param {string} sourceDir 源目录
 * @param {string} targetDir 输出目录
 * @returns {number} 复制文件数量
 */
function copyJsonFiles(sourceDir, targetDir) {
  // 确保目标目录存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 读取源目录下的文件（非递归）
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;

  files.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const stat = fs.statSync(sourcePath);

    // 只处理文件（不处理目录）且是JSON文件
    if (stat.isFile() && path.extname(file).toLowerCase() === '.json') {
      const targetPath = path.join(targetDir, file);
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
      console.log(`已复制: ${file}`);
    }
  });

  return copiedCount;
}

/**
 * 在QQNT versions目录下找到版本号最新的版本文件夹
 * @param {string} basePath versions根目录
 * @returns {string|null} 最新版本文件夹名
 */
function findLatestQQNTVersion(basePath) {
  try {
    const versions = fs.readdirSync(basePath)
      .filter(dir => /^\d+\.\d+\.\d+-\d+$/.test(dir))
      .sort((a, b) => {
        const [aVer, aBuild] = a.split('-');
        const [bVer, bBuild] = b.split('-');
        return bVer.localeCompare(aVer) || Number(bBuild) - Number(aBuild);
      });

    return versions.length > 0 ? versions[0] : null;
  } catch (e) {
    return null;
  }
}

/**
 * 通过遍历盘符查找QQNT程序目录下默认表情配置
 * @returns {string|null} default_config.json 完整路径
 */
function findQQNTEmojiConfigByDisk() {
  // 检查所有盘符
  const drives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  for (const drive of drives) {
    const programPath = `${drive}:\\Program Files\\Tencent\\QQNT\\versions`;
    if (!fs.existsSync(programPath)) continue;

    const latestVersion = findLatestQQNTVersion(programPath);
    if (!latestVersion) continue;

    const configPath = path.join(
      programPath,
      latestVersion,
      'resources\\app\\resource\\default-emojis\\default_config.json'
    );

    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * 优先使用注册表QQ安装路径精准查找default_config.json（替代全盘遍历，更快）
 * @param {string} qqRootDir QQNT安装根目录
 * @returns {string|null} default_config.json 完整路径
 */
function findQQNTEmojiConfigByRegPath(qqRootDir) {
  try {
    const versionsDir = path.join(qqRootDir, 'versions');
    if (!fs.existsSync(versionsDir)) return null;

    const latestVersion = findLatestQQNTVersion(versionsDir);
    if (!latestVersion) return null;

    const configPath = path.join(
      versionsDir,
      latestVersion,
      'resources\\app\\resource\\default-emojis\\default_config.json'
    );
    return fs.existsSync(configPath) ? configPath : null;
  } catch (err) {
    return null;
  }
}

// 主函数
async function main() {
  try {
    // 检查源目录是否存在
    if (!fs.existsSync(emojiDir)) {
      throw new Error(`目录不存在: ${emojiDir}`);
    }

    // 获取所有表情文件并生成json列表
    const emojiFiles = getFiles(emojiDir);
    // 确保输出目录存在
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(emojiFiles, null, 2));
    console.log(`成功生成 emoji 文件列表，共 ${emojiFiles.length} 个文件`);
    console.log(`输出文件: ${outputFile}`);

    // 复制JSON文件到src/assets目录
    // const copiedFiles = copyJsonFiles(emojiDir, targetDir);
    // console.log(`已复制 ${copiedFiles} 个JSON文件到 ${targetDir}`);

    // 1. 复制用户目录自定义表情配置 face_config.json
    if (fs.existsSync(qqEmojiPath)) {
      const targetFaceCfg = path.join(targetDir, 'face_config.json');
      fs.copyFileSync(qqEmojiPath, targetFaceCfg);
      console.log(`已复制用户表情配置到: ${targetFaceCfg}`);
    } else {
      console.log('未找到用户目录 face_config.json');
    }

    // 2. 优先通过注册表读取QQ安装目录，精准查找默认表情配置
    let qqntConfigPath = null;
    const qqInstallInfo = await getQQInstallPath();
    if (qqInstallInfo.qqDir) {
      console.log(`通过注册表读取QQ安装目录: ${qqInstallInfo.qqDir}`);
      qqntConfigPath = findQQNTEmojiConfigByRegPath(qqInstallInfo.qqDir);
    }
    // 注册表查找失败则兜底全盘遍历盘符
    if (!qqntConfigPath) {
      console.log('注册表未获取到有效QQ路径，开始全盘扫描...');
      qqntConfigPath = findQQNTEmojiConfigByDisk();
    }

    // 复制QQNT默认表情配置
    if (qqntConfigPath) {
      const targetDefaultCfg = path.join(targetDir, 'default_config.json');
      fs.copyFileSync(qqntConfigPath, targetDefaultCfg);
      console.log(`已复制QQNT默认表情配置到: ${targetDefaultCfg}`);
    } else {
      console.log('未找到QQNT程序目录 default_config.json');
    }
  } catch (error) {
    console.error('处理过程中出错:', error);
    process.exit(1);
  }
}

// 异步主函数执行
main();