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
  // 只创建目标目录，不删除原有内容，已存在直接复用
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  // 排除 .DS_Store normal_emojiids.json super_emojiids.json 文件
  const excludeFiles = new Set(['.DS_Store', 'normal_emojiids.json', 'super_emojiids.json', 'redheart_emojiids.json']);

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    // 跳过符号链接
    if (entry.isSymbolicLink()) {
      console.log(`跳过符号链接: ${srcPath}`);
      continue;
    }
    // 黑名单跳过文件
    if (excludeFiles.has(entry.name)) continue;

    if (entry.isDirectory()) {
      await copyEntireDir(srcPath, destPath);
    } else if (entry.isFile()) {
      try {
        // 复制文件：源有则覆盖目标同名文件；源没有的目标文件直接保留，不会被删除
        await fs.promises.copyFile(srcPath, destPath);
        // 可选：校验文件大小，防止截断
        const srcStat = await fs.promises.stat(srcPath);
        const destStat = await fs.promises.stat(destPath);
        if (srcStat.size !== destStat.size) {
          throw new Error(`文件大小不一致 ${entry.name}`);
        }
      } catch (err) {
        // 文件被占用的提示
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          console.warn(`⚠️ 文件被占用，跳过：${srcPath}`);
        } else {
          console.error(`❌ 文件复制失败 ${srcPath}:`, err);
        }
      }
    }
  }
  // console.log(`✅ 目录处理完成: ${srcDir} -> ${destDir}`);
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

  // 【修改】不再删除重建目标目录，直接增量合并复制，原有多余文件保留
  // await deleteAndRecreateDir(emojiDir);

  // 复制最新的目录（增量合并，源不存在的文件目标保留）
  await copyEntireDir(best.path, emojiDir);
  console.log(`✅ 已增量合并Emoji资源, uin: ${best.uin}`);

  // ========== 复制 OnlineStatusSmallIcon 资源 ==========
  const onlineStatusSourceDir = path.join(
    best.userDoc, 'Tencent Files', best.uin,
    'nt_qq', 'nt_data', 'OnlineStatus', 'OnlineStatusSmallIcon'
  );
  const onlineStatusDestDir = path.join(baseDir, 'OnlineStatusSmallIcon');

  try {
    await access(onlineStatusSourceDir);
    console.log(`✅ 检测到 OnlineStatusSmallIcon 目录: ${onlineStatusSourceDir}`);

    // 【修改】不再删除重建目标目录，增量合并
    // await deleteAndRecreateDir(onlineStatusDestDir);

    // 复制目录（增量合并，源不存在的文件目标保留）
    await copyEntireDir(onlineStatusSourceDir, onlineStatusDestDir);
    console.log(`✅ 已增量合并 OnlineStatusSmallIcon 资源, uin: ${best.uin}`);
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
