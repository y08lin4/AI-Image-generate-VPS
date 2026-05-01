# AI Image Generate VPS

轻量级 AI 生图工作台（VPS 版）：

- 前端：React + Vite
- 后端：Node.js + Express（使用 `node:sqlite`）
- 任务存储：SQLite（本地文件）
- 支持模式：文生图、图生图、多图生成、并发、任务队列、SSE 流式返回、PiXhost 图床上传、历史记录

> 这是从 Cloudflare Worker 版本完整迁移到 VPS 的实现，前端 API 协议保持兼容（`/api/*`）。
> 建议 Node.js 22+（推荐 22/24 LTS）。

---

## 功能说明

- API URL / API Key 仅保存在浏览器本地。
- 服务端访问密码由环境变量 `ACCESS_PASSWORD` 控制。
- 支持三种请求方式：
  - **服务端流式代理**（推荐）
  - **服务端后台任务**
  - **浏览器直连**
- 图生图支持最多 8 张参考图。
- 单次最多 12 张，按并发拆分请求，完成一张展示一张。
- 后台任务状态、统计、失败信息存储在 SQLite。
- 支持 PiXhost 自动上传与手动上传。
- PiXhost 超过 10MB 的图会走本地分片回传（不压缩、不改格式）。

---

## 架构

### 1）服务端流式代理

`Browser -> /api/generate-stream -> VPS Server -> 上游 /images/generations|edits`

- 使用 SSE，每 10 秒发送一次 `ping`
- 需要 `X-Access-Password`

### 2）服务端后台任务

`Browser/App -> /api/background-tasks -> SQLite Queue -> 上游接口 -> PiXhost`

- 支持创建任务、轮询任务、失败重试
- 统计接口：`/api/stats`

### 3）浏览器直连

`Browser -> 上游 API`

- API Key 不经过服务端
- 上游必须支持 CORS

---

## 接口约定

本项目针对 `gpt-image-2` 的两个接口：

- 文生图：`POST /v1/images/generations`
- 图生图：`POST /v1/images/edits`

设置中的 API URL 填写根地址，例如：

```text
https://api.openai.com/v1
```

如果误填到完整接口（如 `/images/generations`），服务端会自动规整回根地址。

---

## 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 服务监听端口 |
| `ACCESS_PASSWORD` | `change-me` | 访问密码（必须修改） |
| `ALLOW_HTTP_API` | `true` | 是否允许上游使用 `http://` |
| `ALLOW_PRIVATE_HOSTS` | `false` | 是否允许代理内网/localhost |
| `DB_PATH` | `./data/app.db` | SQLite 文件路径 |

---

## 本地开发

```bash
npm install
npm run dev
```

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8787`
- Vite 已配置 `/api` 代理到后端。

单独运行：

```bash
npm run dev:server
npm run dev:client
```

---

## 生产部署（VPS）

### 1）构建

```bash
npm install
npm run build
```

### 2）启动

```bash
npm run start
```

建议配合 PM2/Systemd 守护，并在 Nginx 里反代到 `PORT`。

---

## Docker 部署（可选）

```bash
docker build -t ai-image-generate-vps .
docker run -d \
  --name ai-image-generate-vps \
  -p 8787:8787 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  ai-image-generate-vps
```

---

## 数据库

服务端启动时会自动建表（无需手动迁移）：

- `tasks`
- `task_image_chunks`
- `stats`

> 说明：为了与原设计一致，API Key 不写入数据库。
> 因此当服务重启时，未完成任务会被标记为失败，需在前端点击“重试”并重新提供 API Key。
> 首次启动可能看到 Node 对 `node:sqlite` 的 ExperimentalWarning，不影响正常使用。

---

## 安全建议

- 务必修改 `ACCESS_PASSWORD`，不要使用默认值 `change-me`。
- 建议仅通过 HTTPS 暴露服务。
- 如果不需要 HTTP 上游，设置 `ALLOW_HTTP_API=false`。
- 默认会拦截 `localhost`、内网 IP、metadata 地址，防止被滥用为内网代理。

---

## 与 Cloudflare 版差异

- 移除 Cloudflare Worker / D1 / Workflows 依赖。
- 后台任务改为 VPS 本地队列 + SQLite。
- 其余前端交互与 API 路径保持一致，迁移成本低。
