import { resolve } from "node:path";

/**
 * 配置类，从环境变量读取配置
 */
export class Config {
  // Web 服务器配置
  WEB_HOST = process.env['WEB_HOST'] ?? '0.0.0.0';
  WEB_PORT = parseInt(process.env['WEB_PORT'] ?? '58471', 10);
  ONEBOT_WS_TOKEN = process.env['ONEBOT_WS_TOKEN'] ?? null;

  // 数据库配置
  DATABASE_FILE = process.env['DATABASE_FILE'] ?? resolve(process.cwd(), 'messages.db');

  // 消息过滤配置
  // ALLOWED_GROUPS = []  // 空列表表示允许所有群聊
  // ALLOWED_USERS = []  // 空列表表示允许所有私聊

  // NapCatQQ 的 Docker 容器名（当 NapCatQQ 使用 Docker时设置）
  // DOCKER_NAPCAT_NAME = process.env['DOCKER_NAPCAT_NAME'] ?? null
  // NapCatQQ 容器目录 /app/.config/QQ 的数据卷位置，结尾无需 '/' （当 NapCatQQ 使用 Docker 时设置）
  // DOCKER_NAPCAT_QQ_DATA_VOLUME = process.env['DOCKER_NAPCAT_QQ_DATA_VOLUME'] ?? null
}