const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { getAllUsersDocumentsPath } = require('./get-user-documents-path.cjs');
const access = promisify(fs.access);
const readdir = promisify(fs.readdir);

async function deleteAndRecreateDir(dirPath) {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
    console.log(`已删除目录: ${dirPath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    console.log(`目录不存在，无需删除: ${dirPath}`);
  }
  await fs.promises.mkdir(dirPath, { recursive: true });
  console.log(`已创建目录: ${dirPath}`);
}

async function copyEntireDir(srcDir, destDir) {
  try {
    // 使用 filter 排除 .DS_Store 文件
    await fs.promises.cp(srcDir, destDir, {
      recursive: true,
      force: true,
      filter: (src) => {
        const filename = path.basename(src);
        // 排除 .DS_Store normal_emojiids.json super_emojiids.json 文件
        const excludeFiles = ['.DS_Store', 'normal_emojiids.json', 'super_emojiids.json', 'redheart_emojiids.json'];
        return !excludeFiles.includes(filename);
      }
    });
    console.log(`已复制目录: ${srcDir} -> ${destDir}`);
  } catch (err) {
    console.error(`复制目录时出错: ${srcDir}`, err);
    throw err;
  }
}

async function findAndCopyEmojiResources() {
  const baseDir = path.join(process.cwd(), 'public', 'QQ');
  const emojiDir = path.join(baseDir, 'EmojiSystermResource');

  // 获取全部用户文档目录（管理员权限可读到全部用户）
  const allUserDocPaths = await getAllUsersDocumentsPath();
  console.log('✅ 检测到用户文档目录列表：', allUserDocPaths);

  // 收集所有用户/UIN下的有效 EmojiSystermResource 目录及其 mtime
  /** @type {{path: string, mtime: number, uin: string, userDoc: string}[]} */
  const candidates = [];

  for (const userDoc of allUserDocPaths) {
    const tencentFilesDir = path.join(userDoc, 'Tencent Files');
    console.log(`正在扫描用户目录: ${tencentFilesDir}`);

    try {
      const items = await readdir(tencentFilesDir, { withFileTypes: true });
      const uinDirs = items.filter(dirent => dirent.isDirectory() && /^\d+$/.test(dirent.name));

      for (const dirent of uinDirs) {
        const uinDirPath = path.join(tencentFilesDir, dirent.name);
        const emojiSourceDir = path.join(
          uinDirPath,
          'nt_qq', 'nt_data', 'Emoji',
          'BaseEmojiSyastems', 'EmojiSystermResource'
        );

        try {
          await access(emojiSourceDir);
          const stats = await fs.promises.stat(emojiSourceDir);
          candidates.push({
            path: emojiSourceDir,
            mtime: stats.mtimeMs,
            uin: dirent.name,
            userDoc
          });
          console.log(`候选资源目录: ${emojiSourceDir} (mtime: ${new Date(stats.mtimeMs).toISOString()})`);
        } catch (err) {
          if (err.code !== 'ENOENT') console.error(`访问失败: ${emojiSourceDir}`, err);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`扫描目录失败 ${tencentFilesDir}:`, err.message);
      }
    }
  }

  if (candidates.length === 0) {
    console.log('⚠️ 未找到任何Emoji资源目录');
    return;
  }

  // 按 mtime 降序排序（最新的在前）
  candidates.sort((a, b) => b.mtime - a.mtime);

  const best = candidates[0];
  console.log(`✅ 选择最新资源目录: ${best.path} (uin: ${best.uin}, mtime: ${new Date(best.mtime).toISOString()})`);

  // 清理目标目录
  await deleteAndRecreateDir(emojiDir);

  // 复制最新的目录
  await copyEntireDir(best.path, emojiDir);
  console.log(`✅ 已替换全部Emoji资源, uin: ${best.uin}`);

  // ========== 复制 OnlineStatusSmallIcon 资源 ==========
  const onlineStatusSourceDir = path.join(
    best.userDoc, 'Tencent Files', best.uin,
    'nt_qq', 'nt_data', 'OnlineStatus', 'OnlineStatusSmallIcon'
  );
  const onlineStatusDestDir = path.join(baseDir, 'OnlineStatusSmallIcon');

  try {
    await access(onlineStatusSourceDir);
    console.log(`✅ 检测到 OnlineStatusSmallIcon 目录: ${onlineStatusSourceDir}`);

    // 清理目标目录
    await deleteAndRecreateDir(onlineStatusDestDir);

    // 复制目录
    await copyEntireDir(onlineStatusSourceDir, onlineStatusDestDir);
    console.log(`✅ 已替换 OnlineStatusSmallIcon 资源, uin: ${best.uin}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`⚠️ 未找到 OnlineStatusSmallIcon 目录: ${onlineStatusSourceDir}，跳过复制`);
    } else {
      console.error(`复制 OnlineStatusSmallIcon 时出错:`, err);
      throw err;
    }
  }
}

findAndCopyEmojiResources().catch(console.error);