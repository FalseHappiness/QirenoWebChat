# Qireno Web Chat Panel

[![GitHub Issues](https://img.shields.io/github/issues/FalseHappiness/QirenoWebChat)](https://github.com/FalseHappiness/QirenoWebChat/issues)
[![GitHub Stars](https://img.shields.io/github/stars/FalseHappiness/QirenoWebChat)](https://github.com/FalseHappiness/QirenoWebChat)
[![License](https://img.shields.io/github/license/FalseHappiness/QirenoWebChat)](LICENSE)

一个基于 **OneBot 11 协议** 的网页聊天面板，通过 OneBot 兼容框架的 WebSocket 反向连接获取消息，在前端呈现类 QQ
风格的聊天界面。

> 它通过 OneBot 11 WebSocket 接口接收消息，本质上是一个 **OneBot 11 的 Web 客户端**。
>
> **消息源支持：[NapCatQQ](https://github.com/NapNeko/NapCatQQ)** 和 **[SnowLuma](https://github.com/SnowLuma/SnowLuma)**
> 框架。
>
> **重要：本项目仅限个人学习与开发测试使用，严禁用于商业目的，请勿在公开平台或群组中大量分享传播。**

---

**在线 Demo：** [https://falsehappiness.github.io/QirenoWebChat/](https://falsehappiness.github.io/QirenoWebChat/) —
可直接体验前端直连模式。

> **📢 反馈问题 / 建议新特性：** 欢迎提交 [GitHub Issues](https://github.com/FalseHappiness/QirenoWebChat/issues)
> 反馈使用中遇到的问题或提出新功能建议。

---

## 功能特性

### 一、连接模式

- **后端模式**：通过 Node.js (Fastify) 后端中转，支持 SQLite 持久化存储消息，提供文件代理下载等能力
- **前端直连模式**：浏览器直接通过 WebSocket 连接 NapCatQQ / SnowLuma，消息存储基于 IndexedDB，无需后端
- **多账号管理**：支持多个 QQ 账号同时在线（关联多个 OneBot 连接），前端可切换不同 Bot
- **健康检测**：自动检测后端存活状态，获取已连接的 BOT 列表

### 二、消息系统

#### 消息收发

- **发送文本消息**（纯文本）
- **发送表情消息**（QQ 原生表情、系统表情、自定义表情）
- **发送图片消息**（支持 URL 及 Base64 编码上传）
- **发送语音消息**（录音并上传）
- **发送视频消息**
- **发送文件消息**（支持普通文件上传及**分片流式上传大文件**，每块 64KB，附带 SHA256 校验）
- **发送戳一戳**（窗口抖动 & 群聊戳一戳）
- **发送合并转发**（多条消息合并为转发记录）
- **发送群聊文件**（指定文件夹上传）
- **发送群相册图片/视频**（上传到指定群相册）
- **发送闪传文件**（Flash Transfer）
- **发送 JSON 卡片消息**（群分享卡片、小程序卡片等）
- **发送 Markdown 消息**（含 `@` 与 Markdown 混排）
- **发送联系人分享卡片**（将好友/群聊分享给其他联系人）
- **发送 Ai 语音**（群聊 AI 语音，指定角色与文本）
- **消息撤回**（支持群聊 & 私聊消息撤回）
- **回复消息**（引用回复）
- **@ 提及**（群内 @ 成员，支持 @ 全体成员）
- **消息预览**（最近会话列表显示最新消息摘要，支持文本/图片/表情/文件等类型预览）

#### 消息类型解析渲染

- 文本消息（支持换行、空格、表情转图片渲染）
- 图片消息（支持 GIF/静态图，带加载占位及兜底 fallback URL）
- 视频消息（行内播放）
- 语音消息（可播放的音频组件）
- 表情消息（QQ 表情、系统表情，支持 **APNG 动图** 和 **Lottie 动画**）
- 文件消息（显示文件图标、名称、大小，可下载）
- 戳一戳消息（含动画效果）
- 合并转发消息（可展开查看内容）
- 闪传文件消息
- JSON 卡片消息支持多种类型：
    - 群分享卡片（`com.tencent.troopsharecard`）
    - 小程序卡片（`com.tencent.miniapp_01`）
    - 群公告（`com.tencent.mannounce`）
    - 多消息合并（`com.tencent.multimsg`）
    - Feed 流（`com.tencent.feed.lua`）
    - 联系人卡片（`com.tencent.contact.lua`）
    - 活动消息（`com.tencent.activity.md`）
    - 新闻视图（`news`）
    - 邀请视图（`invite`）
    - 位置分享（`LocationShare`）
- Markdown 消息渲染
- 内联键盘消息（`inline_keyboard`）🔹 SnowLuma
- 骰子 / 猜拳消息（含 Lottie 动画结果展示）
- 通知消息（系统通知以交互式富文本渲染，支持点击命令）

#### 通知消息类型

- **戳一戳通知**（`poke`）— 显示发信人和动作详情
- **群头衔变更**（`title`）
- **群名称变更**（`group_name`）
- **精华消息**（`essence`）— 设为/取消精华的通知
- **群禁言**（`group_ban`）— 全员禁言 / 个人禁言 / 解除禁言
- **入群通知**（`group_increase`）— 邀请入群 / 审批入群
- **退群/踢出通知**（`group_decrease`）— 主动退群 / 被移出
- **表情回应通知**（`group_msg_emoji_like`）— 消息表情回应新增/取消
- **管理员变动**（`group_admin`）— 设为/取消管理员
- **消息撤回通知**（`group_recall` / `friend_recall`）— 显示撤回者

### 三、联系人管理

- **最近会话列表**（按最后消息时间排序，显示最新消息预览）
- **好友列表**（按分组展示，可折叠展开）
- **群聊列表**
- **联系人搜索**（支持：中文拼音全拼/简拼、前缀匹配优先、多字段权重排序、QQ 号匹配）
- **联系人信息查看**（弹窗展示用户/群信息）
- **好友备注修改**
- **群备注修改**
- **群名称修改**
- **删除好友**
- **退群/解散群**

### 四、群聊管理

#### 群成员管理

- **查看群成员列表**
- **群成员搜索**（支持拼音、昵称、备注、群名片多字段搜索）
- **设置群管理员**（群主专属）
- **修改群成员昵称（群名片）**
- **修改群成员头衔**（群主专属）
- **群成员禁言**（10 分钟 / 1 小时 / 12 小时 / 1 天 / 自定义时长 / 解除禁言）
- **移出群成员**
- **群成员右键菜单**（发送消息、@ 提及、戳一戳、查看资料、管理操作）

#### 群设置

- **设置群聊名称**
- **设置群聊备注**
- **设置加群方式**（允许任何人 / 需验证 / 不允许 / 需回答问题 / 需审核）
- **设置成员权限**（允许上传相册 / 允许临时会话 / 允许创建群聊）
- **设置成员邀请策略**（禁止 / 无需审核 / 需审核 / 少于 100 人无需审核）
- **设置新成员历史消息可见性**
- **设置群搜索方式**（不允许 / 群号搜索 / 群号及关键词搜索）
- **设置机器人入群方式**（禁止 / 无需审核 / 需审核）
- **全员禁言**（开启/关闭）
- **@ 全体剩余次数查询**

#### 群文件管理

- **查看群文件列表**（根目录 & 子文件夹）
- **创建文件夹**
- **重命名文件/文件夹**
- **删除文件/文件夹**
- **获取文件下载 URL**
- **文件代理下载**（支持断点续传 Range 请求）
- **文件系统信息查询**

#### 群相册管理

- **查看群相册列表**
- **查看相册媒体列表**（图片/视频）
- **上传图片/视频到相册**
- **删除相册媒体**

#### 群公告管理

- **查看群公告列表**（置顶优先，按发布时间排序）
- **发布群公告**（支持：内容、图片、弹窗展示、需确认、置顶、发送给新成员、引导修改群昵称）
- **删除群公告**

#### 群精华消息

- **获取精华消息列表**
- **设置精华消息**
- **取消精华消息**

#### 群待办（Todo）

- **获取群待办消息** 🔹 SnowLuma v1.14.4+
- **设置群待办**
- **取消群待办**

#### 群签到

- **群签到**
- **查看已签到列表**

#### 群 AI 语音

- **获取 AI 角色列表**
- **发送 AI 语音消息**

#### 群管理设置 🔹 SnowLuma v1.14.11+

- **获取群管理设置**

### 五、好友/私聊管理

- **查看好友列表**
- **好友备注修改**
- **设置好友请求**（同意/拒绝，可附带备注）
- **删除好友**
- **好友资料查看**
- **发送好友名片分享**

### 六、添加请求处理

- **查看所有待处理请求**（好友请求 + 加群请求统一展示）
- **按类型筛选**：全部 / 加群请求 / 可疑好友请求 / 忽略的入群请求
- **处理好友请求**：同意（可设置备注）/ 拒绝
- **处理加群请求**：同意 / 拒绝（可填写拒绝理由）
- **处理可疑好友请求**：同意（仅支持同意）
- **请求状态展示**：待处理 / 已同意 / 已拒绝
- **请求信息展示**：用户头像、昵称、留言、时间、邀请人信息

### 七、个人资料与在线状态

#### 个人资料编辑

- **修改昵称**
- **修改个性签名（长昵称）**
- **修改性别**

#### 在线状态

- **查看当前在线状态**
- **切换在线状态**：在线 / Q我吧 / 离开 / 忙碌 / 请勿打扰 / 隐身
- **状态主题**：我的电量 / 听歌中 / 做好事 / 出去浪 / 去旅行 / 被掏空 / 今日步数 / 今日天气 / 我 crush 了 / 爱你 /
  恋爱中 / 好运锦鲤 / 水逆退散 / 嗨到飞起 / 元气满满 / 一言难尽 / 难得糊涂 / emo 中 / 我太难了 / 我想开了 / 我没事 /
  想静静 / 悠哉哉 / 信号弱 / 睡觉中 / 肝作业 / 学习中 / 搬砖中 / 摸鱼中 / 无聊中 / TiMi 中 / 一起元梦 / 求星搭子 /
  熬夜中 / 追剧中
- **自定义在线状态**：选择 QQ 表情 + 自定义描述文字
- **查看他人在线状态**（含电量、自定义状态详情）
- **个人资料页点赞**（查看/发送赞）

### 八、收藏夹

- **查看收藏列表**（支持按分类筛选）
- **收藏夹导航视图**

### 九、主题系统

- **多主题支持**（自动加载 `styles/themes/` 目录下的主题）
- **主题切换 UI**（带预览卡片）
- **主题持久化**（通过 Pinia 存储用户选择）
- **默认主题与备选主题兜底**

### 十、UI/UX 特性

- **类 QQ 视觉风格**（界面布局、配色、图标、动画素材参考 QQ）
- **侧边栏可拖拽调整宽度**
- **虚拟滚动**（最近会话列表使用虚拟滚动优化性能）
- **自定义滚动条**
- **移动端响应式布局**（侧边栏与聊天区切换）
- **右键菜单**（联系人右键：查看资料、复制 QQ 号、分享；群成员右键：发消息、@、戳一戳、管理操作）
- **Toast 消息提示**（成功/错误/警告/普通提示）
- **确认框 / 输入框弹窗**（确认操作、输入信息）
- **下载进度弹窗**（直连模式下的文件下载进度展示，支持取消/重试）
- **联系人信息悬浮提示**（鼠标悬停显示联系人信息）
- **群精华消息列表展示**
- **群待办消息展示**
- **消息时间格式化显示**
- **消息内容可点击命令**（如 `@用户`、`跳转消息`、`查看用户信息`、`打开精华消息窗口`）
- **表情回应显示**（消息表情回应列表） 🔹 SnowLuma v1.14.12+
- **发送表情回应**（对消息添加/取消表情回应）

### 十一、消息历史与同步

- **消息历史加载**（支持向上/向下翻页，游标分页）
- **消息同步**（自动拉取新消息）
- **消息合并**（后端 API 消息与数据库消息合并去重）
- **撤回事件处理**（更新原始消息的撤回操作者信息）
- **通知消息与普通消息混合排序**（按时间线整合展示）

### 十二、后端架构 (Node.js Fastify)

- **Fastify Web 服务器**（高性能 Node.js 框架）
- **WebSocket 双通道管理**：
    - OneBot 连接管理（反向 WS 接收消息、发送 API 请求）
    - 前端连接管理（广播消息、处理 `send_action` / `req_backend` 请求）
- **SQLite 数据库**（WAL 模式，消息持久化存储）
- **REST API 接口**：
    - `GET/POST /api/messages` — 获取消息列表（支持多条件筛选、游标分页）
    - `GET/POST /api/get_msg` — 获取单条消息
    - `GET/POST /api/sync` — 同步新消息
    - `GET/POST /api/contacts` — 获取联系人列表（DB + API 合并）
    - `GET/POST /api/get_add_requests` — 获取添加请求列表
    - `GET /api/health` — 健康检查
    - `GET /api/bots` — 获取已连接 BOT 列表
    - `GET/POST /api/proxy_multimedia` — 多媒体代理（限安全域名）
    - `GET/POST /api/get_file_data` — 获取文件数据（支持语音转 MP3/WAV）
    - `GET/POST /api/get_stream_file_data` — 流式文件数据下载
    - `GET/POST /api/proxy_group_file` — 群文件代理下载（带 URL 缓存）
    - `GET/POST /api/proxy_private_file` — 私聊文件代理下载
- **OneBot 动作中转**：前端通过 `send_action` 经后端转发 OneBot API 请求，支持超时/取消
- **TTL 缓存**：文件 URL 缓存（10 分钟过期）
- **静态文件托管**：自动托管 `viewer/dist` 目录
- **前端路由兜底**：非 API 路由返回 `index.html` 支持 SPA

### 十三、前端架构 (Vue 3)

- **Vue 3 Composition API**
- **Vite 构建工具**
- **Pinia 状态管理**（全局状态、主题、缓存）
- **事件总线**（`CalledEmitter` / `Emitter` 模式，用于组件间通信）
- **Axios HTTP 客户端**
- **WebSocket 连接桥接**（`ConnectionBridge` / `ConnectionBridgeOnebot`）
- **虚拟滚动组件**（高性能列表渲染）
- **自定义指令**：右键菜单指令、双击指令
- **Ant Design Vue**（折叠面板组件）
- **SCSS 模块化样式**（变量、混合宏、占位符、主题系统）
- **雪碧图图标系统**（`QIcon` / `QMaskIcon` 组件）
- **响应式缓存系统**（`ResponseCache`，支持 TTL 自动过期）

### 十四、SnowLuma 特有功能（标记）

以下功能仅在使用 **SnowLuma** 框架时可用：

| 功能                | 说明                                                        |
|-------------------|-----------------------------------------------------------|
| 🔹 **群待办 (Todo)** | 获取群待办消息（v1.14.4+）                                         |
| 🔹 **群管理设置**      | 获取群管理设置（v1.14.11+）                                        |
| 🔹 **表情回应**       | 查看消息表情回应列表（v1.14.12+）                                     |
| 🔹 **内联键盘消息**     | `inline_keyboard` 类型消息渲染                                  |
| 🔹 **自定义表情移至首位**  | `move_custom_face_to_front` 接口                            |
| 🔹 **个性装扮获取**     | `_get_friend_dress` 接口获取头像挂件等装扮信息                         |
| 🔹 **数据格式转换层**    | SnowLuma 与 NapCatQQ 消息格式差异自动适配（`snow-luma-translator.js`） |
| 🔹 **闪传文件**       | 使用 `file_set_id` 字段而非 `fileSetId`                         |
| 🔹 **戳一戳事件**      | 戳一戳通知包含 `action`、`action_img_url`、`suffix` 等字段            |
| 🔹 **版本检测**       | 通过 `isSnowLuma()` / `gteSnowLuma()` 进行版本特性检测              |

### 十五、工具脚本

- **QQ 表情资源初始化**：`npm run init-emoji`（从本地 QQNT 安装目录复制系统表情资源）
- **表情列表生成**：`create-emoji-list.cjs` 生成表情索引
- **Canvas 下载工具**：`download-canvas-to-video.js` / `download-canvas-to-webm.js`
- **许可证生成**：构建时自动生成 `licenses.json` / `licenses-dev.json`

---

## 使用说明

### 1. 克隆项目

```bash
git clone https://github.com/FalseHappiness/QirenoWebChat.git
cd QirenoWebChat
```

### 2. 构建前端

前端使用 Vue 3 + Vite 构建，位于 [`viewer/`](viewer/) 目录下。

```bash
# 进入前端目录
cd viewer

# 安装依赖
npm install

# （可选）初始化 QQ 表情资源（需要 Windows 且安装 QQNT，最好使用管理员用户运行）
npm run init-emoji

# 构建前端（生成 dist 目录）
npm run build

# 返回项目根目录
cd ..
```

> 构建完成后，生成的 [`viewer/dist`](viewer/dist) 目录会被后端自动托管。
>
> 如果需要开发调试前端，可以单独启动开发服务器：
> ```bash
> cd viewer
> npm run dev
> ```
> 开发服务器默认运行在 `http://localhost:51730`。

可通过环境变量配置前端行为（参见 [`viewer/.env.development`](viewer/.env.development) / [
`viewer/.env.production`](viewer/.env.production)）：

`sitehost` 作为主机时将自动替换为当前网站主机。如不带端口，则使用当前网站端口；如带端口，将保留环境变量的端口。

| 环境变量                    | 说明                  | 开发环境默认值                           | 生产环境默认值                     |
|-------------------------|---------------------|-----------------------------------|-----------------------------|
| `VITE_API_BASE_URL`     | 后端 API 地址           | `http://sitehost:58471`           | `http://sitehost`           |
| `VITE_WS_URI`           | 前端 WebSocket 连接地址   | `ws://sitehost:58471/ws/frontend` | `ws://sitehost/ws/frontend` |
| `VITE_BACKEND_DETECTOR` | 是否检测后端连接状态          | `true`                            | `true`                      |
| `VITE_BASE`             | 前端部署基础路径（需以 `/` 结尾） | `/`                               | `/`                         |

### 3. 安装后端依赖并启动

后端使用 **TypeScript + Node.js (Fastify)** 实现，位于 [`server/`](server/) 目录下。
需要 **Node.js 18+**（推荐 Node.js 20+）。

```bash
# 进入后端目录
cd server

# 安装依赖
npm install

# 开发模式启动（热重载）
npm run dev

# 或构建后启动生产模式
npm run build
npm start
```

后端默认在 `http://0.0.0.0:58471` 启动。

可通过环境变量配置（参见 [`server/src/config.ts`](server/src/config.ts)）：

| 环境变量              | 说明                                   | 默认值           |
|-------------------|--------------------------------------|---------------|
| `WEB_HOST`        | 监听地址                                 | `0.0.0.0`     |
| `WEB_PORT`        | 监听端口                                 | `58471`       |
| `ONEBOT_WS_TOKEN` | NapCat / SnowLuma WebSocket 认证 Token | 无（不鉴权）        |
| `DATABASE_FILE`   | SQLite 数据库文件路径                       | `messages.db` |

### 4. 配置消息源：NapCatQQ 或 SnowLuma

项目提供 **两种连接模式**，可根据需要选择：

---

### 模式一：后端模式（通过 Node.js 后端中转）

使用浏览器打开后端地址，例如 `http://127.0.0.1:58471`，即可访问聊天面板。

要让消息源将消息推送给本项目的后端，需要配置 **WebSocket 反向连接（Reverse WebSocket）**。

> **消息源支持：** NapCatQQ 和 SnowLuma 框架均可使用。

#### 4.1 编辑 NapCat 配置文件（推荐）

到 NapCatQQ WebUI 网络配置 添加 Websocket 客户端，名称随意，URL 填写 `ws://localhost:58471/ws/napcat` 或
`ws://localhost:58471/ws/nc`，开启上报自身消息，消息格式为 Array

如果后端设置了 `ONEBOT_WS_TOKEN`，需要将 `Token` 设为相同的值：

#### 4.2 编辑 SnowLuma 配置文件（若使用 SnowLuma）

到 SnowLuma WebUI 节点配置 添加 WS 客户端，名称随意，URL 填写 `ws://localhost:58471/ws/snowluma` 或
`ws://localhost:58471/ws/sl`，开启上报自身消息，消息格式为 数组，角色为 Universal

如果后端设置了 `ONEBOT_WS_TOKEN`，需要将 `授权Token` 设为相同的值：

#### 4.3 配置生效

保存并启用配置后，配置自动生效。消息源会自动连接到本项目的后端 WebSocket。本项目程序终端日志中会输出类似以下信息：

```
OneBot connected: 1234567890
```

#### 4.4 验证连接

打开浏览器访问 `http://127.0.0.1:58471`，如果一切正常，你应该能看到聊天面板界面，并开始接收消息。

---

### 模式二：前端直连模式（无需后端）

如果不想启动后端，或者希望前端直接与 NapCatQQ / SnowLuma 通信，可以使用 **前端直连模式**。

前端直连模式下，前端浏览器直接通过 WebSocket 连接到 NapCatQQ 或 SnowLuma 的 **OneBot WS 服务器**，消息处理和存储完全在浏览器本地完成（基于
IndexedDB）。

> **在线 Demo：** [https://falsehappiness.github.io/QirenoWebChat/](https://falsehappiness.github.io/QirenoWebChat/) —
> 可直接体验前端直连模式。
>
> **适用场景：** 仅需查看消息、不依赖后端持久化存储的场景。部分需要后端中转的功能（如文件代理下载）将不可用。

#### 配置步骤

1. 在 NapCatQQ WebUI 或 SnowLuma WebUI 中**开启 WS 服务器**（而非反向 WS 客户端），消息格式为 数组/array，开启上报自身消息，SnowLuma
   角色选择 Universal，记下监听地址和端口（默认 NapCatQQ 为 `ws://0.0.0.0:3001`）。
2. 打开前端页面（例如 `http://127.0.0.1:51730` 开发服务器或直接访问构建后的 Demo）。
3. 在账号选择页面中，点击 **"前端直连 OneBot"** 区域的 **+** 按钮。
4. 填写 NapCatQQ / SnowLuma 的 WS 服务器地址，例如 `ws://127.0.0.1:3001`（如需 Token 则填写访问令牌）。
5. 点击 **"连接"** 即可开始使用。

> **注意：**
> - 如果前端运行在 HTTPS 安全上下文中，则必须使用 **WSS** 加密连接或本地回环地址。
> - 直连模式下，连接信息会保存在浏览器 `localStorage` 中，关闭页面后重开可自动重连。

---

## 项目结构

```
├── server/                    # TypeScript 后端 (Fastify)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # Fastify 后端主入口
│       ├── config.ts          # 后端配置
│       ├── db.ts              # SQLite 数据库操作
│       ├── onebot_handler.ts  # OneBot 消息处理
│       ├── onebot_manager.ts  # OneBot WebSocket 连接管理
│       ├── frontend_manager.ts# 前端 WebSocket 连接管理
│       ├── ttl_cache.ts       # TTL 缓存
│       └── utils.ts           # 工具函数
├── viewer/                    # 前端 Vue 3 项目
│   ├── .env.development       # 前端开发环境变量
│   ├── .env.production        # 前端生产环境变量
│   ├── package.json
│   ├── index.html
│   └── src/                   # 前端源码
│       ├── components/        # Vue 组件
│       │   ├── Navigation/    # 导航栏（最近会话、联系人、设置、收藏）
│       │   ├── Destination/   # 主内容区（聊天、许可证、主题、收藏、请求）
│       │   ├── Windows/       # 弹窗（个人资料编辑、在线状态、下载进度）
│       │   └── Common/        # 通用组件（图标、滚动条、弹窗等）
│       ├── composables/       # 组合式函数
│       ├── directives/        # 自定义指令
│       ├── scripts/           # 工具脚本
│       ├── store/             # Pinia 状态管理
│       ├── styles/            # 样式文件
│       └── views/             # 页面视图
└── README.md
```

---

## 技术栈

- **后端**: TypeScript (Node.js) + Fastify + better-sqlite3
- **前端**: Vue 3 + Vite + Pinia
- **数据库**: 后端模式 SQLite (前端直连模式: IndexedDB)
- **消息协议**: OneBot 11 (WebSocket)
- **消息源**: NapCatQQ、SnowLuma 等 OneBot 11 兼容框架

---

## 反馈与贡献

- **[提交 Bug / 问题反馈](https://github.com/FalseHappiness/QirenoWebChat/issues/new?template=bug_report.md)** —
  如果你在使用过程中遇到任何问题，请先搜索已有 Issues 确认是否已被报告，再提交新 Issue。
- **[建议新特性](https://github.com/FalseHappiness/QirenoWebChat/issues/new?template=feature_request.md)** —
  如果你有好的功能想法，欢迎提交特性请求，描述你的使用场景和期望行为。
- **[查看已有 Issues](https://github.com/FalseHappiness/QirenoWebChat/issues)** — 了解当前已知问题、待办事项和开发计划。

> **提示：** 提交 Issue 前请先搜索确认是否已有相似内容，避免重复。

---

## 相关链接

- [NapCatQQ](https://github.com/NapNeko/NapCatQQ) - 基于 OneBot 11 的 QQ 机器人框架
- [SnowLuma](https://github.com/SnowLuma/SnowLuma) - 基于 OneBot 11 的 QQ 机器人框架
- [OneBot 11 标准](https://github.com/botuniverse/onebot-11) - 通用聊天机器人应用接口标准

---

# 声明

> **本项目目前处于早期开发阶段，代码、界面、功能均可能发生重大变动，**
> **请勿在生产环境或正式社交场景中使用。**

## 关于项目性质与使用范围

- 本项目是基于 OneBot 11 协议开发的网页聊天面板，**并非腾讯 QQ 官方网页客户端**，和腾讯公司不存在任何从属、授权、合作关系。
- 程序依靠 NapCatQQ、SnowLuma 这类兼容 OneBot11 的第三方网关 WebSocket 接口收发消息；上述网关均属于非官方第三方QQ机器人工具。
- 启动使用本项目，代表使用者知悉：当前是借助第三方工具对接QQ服务，并非腾讯官方客户端、官方开放接口。
- 项目定位仅面向开发者用作技术学习、本地开发测试；**不建议投入任何商业业务场景**。
- 禁止于公共平台、社交群组进行大范围的公开散播，衍生版本同样遵守该传播约束。
- 仅供技术人员学习 OneBot 协议、WebSocket 通信、Vue 前端开发相关知识，不对普通终端用户提供适配与技术支持。

## 关于界面与图标资源

- 项目前端UI视觉参考QQ的设计风格，部分图标、表情、字体、动画素材版权归属腾讯及其权利人。
- 目录命名带有 `[QQ]` 的全部资源（`viewer/public/QQ/`、`viewer/src/QQ/` 内全部文件）知识产权归属于腾讯；本项目仅用作本地学习调试，不对该类资源主张任何版权。
- 后缀标记 `[.modify]` 的文件为基于原版QQ素材二次修改而来，修改后的素材版权依旧归属于原权利人。
- 如若相关素材使用存在侵权争议，可联系维护者，我方会第一时间移除、替换对应资源。

## 关于数据存储与安全

- 后端默认聊天记录以明文形式保存在本地文件。
- 用户需要知悉以下风险：
    - 聊天数据没有加密、脱敏处理，本机其他程序、设备使用者可以读取本地存储；
    - WebSocket 传输默认不会强制开启 TLS 加密，加密需要使用者自行配置；
    - 项目原生不带账号校验、访问鉴权、权限管控等安全机制。
- 禁止使用本项目传输隐私、敏感、机密资料；一切由数据泄露、丢失、信息滥用引发的损失，项目开发者不承担相关责任。

## 关于 NapCatQQ / SnowLuma 与腾讯风控

- 本项目依赖第三方非官方网关和QQ服务器通信，第三方工具随时有可能被腾讯限制、封禁。
- 接入工具的QQ账号、登录设备存在风控风险，包含功能受限、登录拦截、账号封禁等处罚；所有风险由使用者自行承担。
- 开发者不会为账号风控损失负责，同时不提供任何规避平台风控的方案。
- 推荐使用闲置测试账号体验软件，切勿登录日常主账号、存有重要资料的QQ账号。

## 关于开源协议与使用限制

- 项目源代码采用 MIT 许可证开源；在遵守保留原始版权声明的前提下，你可以自由使用、修改以及分发源代码。
- MIT 协议遵循「按现状交付」免责，不对软件稳定性、业务适配性作出任何担保，详细内容查阅根目录 `LICENSE` 文件。

> 重要区分：MIT 仅针对源代码版权作出许可；出于项目处于早期、没有经过完整安全审计、存在各类潜在隐患，
> **强烈劝阻使用者将项目用于正式环境、商业业务当中**。

## 最终提醒

- 下载、运行、编辑、二次分发本项目全部行为，视作你完整阅读并且同意本免责声明全部条款。
- 不接受该份声明的情况下，请立刻停止使用，删除全部项目代码以及本地产生的数据。
- 项目维护者拥有随时修订这份使用声明的权利，更新之后继续使用软件即默认接纳新版规约。

---

**项目仍处在迭代早期，仅限个人本地学习调试；请勿大范围公开传播。使用者全权负责自身聊天隐私以及账号安全。**