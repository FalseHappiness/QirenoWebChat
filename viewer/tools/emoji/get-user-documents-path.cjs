/**
 * 获取本机所有用户的 Documents(文档) 真实路径
 * 需要管理员权限才能完整遍历全部用户目录
 * 方案1: PowerShell WMI 查询、方案2:兜底直接扫描 C:\Users
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const readdir = promisify(fs.readdir);
const execFileAsync = promisify(execFile);

async function getAllUsersDocumentsPath() {
  const paths = [];
  let profileDirs = [];
  try {
    // 全部使用标准ASCII减号，杜绝特殊字符导致powershell解析失败
    const psCmd = `Get-WmiObject Win32_UserProfile | Where-Object {$_.LocalPath -and (Test-Path $_.LocalPath)} | Select-Object -ExpandProperty LocalPath`;
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", psCmd],
      { windowsHide: true }
    );
    profileDirs = stdout
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  } catch (err) {
    console.warn('PowerShell WMI枚举失败,切换兜底方案扫描C:\\Users', err.message);
    // 兜底方案：直接遍历C:\Users目录
    try {
      const userRoot = path.join('C:\\', 'Users');
      const dirItems = await readdir(userRoot, { withFileTypes: true });
      profileDirs = dirItems
        .filter(d => d.isDirectory())
        .map(d => path.join(userRoot, d.name));
    } catch (e) {
      console.error('兜底扫描C:\\Users也失败', e.message);
    }
  }

  for (const userProfilePath of profileDirs) {
    // 同时兼容英文版 Documents / 中文版 文档
    const docStdPath = path.join(userProfilePath, 'Documents');
    const docCnPath = path.join(userProfilePath, '文档');
    for (const candidate of [docStdPath, docCnPath]) {
      try {
        const stat = await fs.promises.stat(candidate);
        if (stat.isDirectory()) {
          paths.push(candidate);
          break;
        }
      } catch {
        // 目录不存在直接跳过
      }
    }
  }

  // 兜底：加入当前用户文档目录，防止上面枚举为空
  const fallbackDoc = path.join(process.env.USERPROFILE, 'Documents');
  if (!paths.includes(fallbackDoc)) paths.push(fallbackDoc);

  // 去重
  return [...new Set(paths)];
}

module.exports = { getAllUsersDocumentsPath };