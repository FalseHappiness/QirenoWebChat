# Qireno Web Chat Panel

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

# （可选）初始化 QQ 表情资源
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

#### 4.1 编辑 SnowLuma 配置文件（若使用 SnowLuma）

到 SnowLuma WebUI 节点配置 添加 WS 客户端，名称随意，URL 填写 `ws://localhost:58471/ws/snowluma` 或
`ws://localhost:58471/ws/sl`，开启上报自身消息，消息格式为 数组，角色为 Universal

如果后端设置了 `ONEBOT_WS_TOKEN`，需要将 `授权Token` 设为相同的值：

#### 4.2 配置生效

保存并启用配置后，配置自动生效。消息源会自动连接到本项目的后端 WebSocket。本项目程序终端日志中会输出类似以下信息：

```
OneBot connected: 1234567890
```

#### 4.3 验证连接

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