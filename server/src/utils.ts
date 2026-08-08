/**
 * 通用工具函数
 */

/**
 * 解析布尔值
 */
export function parseBool(value: unknown): boolean {
  if (typeof value === 'string') {
    return [ 'true', '1', 'yes', 'on' ].includes(value.toLowerCase());
  }
  return Boolean(value);
}

/**
 * 解析整数值
 */
export function parseInt(value: unknown, defaultVal: number = 0): number {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? defaultVal : n;
  }
  return defaultVal;
}

/**
 * 从 Authorization 头部提取 token
 */
export function extractToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = /^(?:token|bearer)\s+(\S+)$/i.exec(authHeader.trim());
  return match ? match[1]! : null;
}

/**
 * 判断目标 URL 是否在允许的代理域名白名单中
 */
export function isAllowedProxyDomain(targetUrl: string): boolean {
  try {
    const parsedUrl = new URL(targetUrl);
    const domain = parsedUrl.hostname;

    // 白名单数组统一管理
    // 完整匹配的域名列表
    const allowedFullDomains = [
      'multimedia.nt.qq.com.cn',
      'gxh.vip.qq.com',
      'gzc-download.ftn.qq.com',
      'grouptalk.c2c.qq.com',
    ];
    // 允许的域名后缀列表
    const allowedSuffixes = [
      '.gtimg.cn',
      '.qpic.cn',
      '.ugcimg.cn',
      '.ftn.qq.com',
    ];
    const allowedExactPaths = [
      '/asn.com/qqdownloadftnv5', // https://grouptalk.c2c.qq.com/asn.com/qqdownloadftnv5?
    ];

    // 严格路径匹配：完全相等 / 路径后紧跟?参数
    let matchPath = false;
    for (const p of allowedExactPaths) {
      if (parsedUrl.pathname === p || parsedUrl.pathname.startsWith(`${p}?`)) {
        matchPath = true;
        break;
      }
    }

    const matchFull = allowedFullDomains.includes(domain);
    const matchSuffix = allowedSuffixes.some((suf) => domain.endsWith(suf));

    return matchPath || matchFull || matchSuffix;
  } catch {
    // 如果解析失败（如非法URL），直接拒绝
    return false;
  }
}

/**
 * 获取 Content-Disposition 头
 * 兼容中文文件名，遵循 RFC 5987 标准
 */
export function getContentDisposition(filename: string, inline: boolean = true): string {
  const asciiName = encodeURIComponent(filename).replace(/%/g, '');
  const encodedName = encodeURIComponent(filename);
  if (inline) {
    return `inline; filename="${asciiName}"; filename*=utf-8''${encodedName}`;
  } else {
    return `attachment; filename="${asciiName}"; filename*=utf-8''${encodedName}`;
  }
}