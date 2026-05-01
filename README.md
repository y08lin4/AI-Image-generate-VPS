# AI-Image-generate-VPS

一个可部署在 VPS 的 AI 生图工作台：

- 前端：React + Vite
- 后端：Node.js + Express
- 数据：SQLite（`node:sqlite`）
- 图床：PiXhost（可自动上传）

在保留原 `/api/*` 协议的前提下，从 Cloudflare 版本迁移到 VPS 版本。

---

## 新增能力（本次）

- **访问门禁**：进入页面前必须输入访问密码（`ACCESS_PASSWORD`）
- **管理员面板**：
  - 输入管理员密码（`ADMIN_PASSWORD`）
  - 可在线修改访问密码
  - 查看“今日统计”：请求总张数、成功张数、失败张数、处理中张数
  - 查看失败原因聚合（Top）
- **Docker + GitHub Actions**：支持自动构建并推送镜像到 GHCR

---

## 功能概览

- 文生图 / 图生图（最多 8 张参考图）
- 单任务最多 12 张，支持并发
- SSE 流式返回结果
- 后台任务队列（创建/查询/重试）
- 本地历史记录
- PiXhost 上传与图片代理
- 大图超过 10MB 时，走本地分片回传（不压缩）

---

## 主要接口

- `/api/health`
- `/api/generate-stream`
- `/api/background-tasks`
- `/api/background-tasks/:id`
- `/api/background-tasks/:id/retry`
- `/api/background-tasks/:id/images/:index`
- `/api/upload-pixhost`
- `/api/image-proxy`
- `/api/stats`

管理员接口：

- `POST /api/admin/verify`
- `GET /api/admin/daily-report?date=YYYY-MM-DD`
- `POST /api/admin/access-password`

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
| `ADMIN_PASSWORD` | `change-me` | 管理员密码（必须修改） |
| `ALLOW_HTTP_API` | `true` | 是否允许上游使用 `http://` |
| `ALLOW_PRIVATE_HOSTS` | `false` | 是否允许代理 localhost/内网 |
| `DB_PATH` | `./data/app.db` | SQLite 文件路径 |

> 建议 Node.js 22+（22/24 LTS）。

---

## 本地开发

```bash
npm install
npm run dev
```

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8787`
- Vite 已配置 `/api` 反代到后端

也可分开运行：

```bash
npm run dev:server
npm run dev:client
```

---

## 生产部署（VPS）

```bash
npm install
npm run build
npm run start
```

建议配合 Nginx + PM2/Systemd。

---

## Docker 部署

### 本地构建

```bash
docker build -t ai-image-generate-vps:local .
```

### 本地运行

```bash
docker run -d \
  --name ai-image-generate-vps \
  -p 8787:8787 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  ai-image-generate-vps:local
```

### Docker Compose

```bash
docker compose up -d --build
```

---

## GitHub 自动打包镜像（GHCR）

已提供工作流：`.github/workflows/docker-publish.yml`

触发方式：

- push 到 `main`
- push `v*` tag
- 手动触发（Actions -> workflow_dispatch）

推送目标：

- `ghcr.io/<owner>/<repo>:latest`
- `ghcr.io/<owner>/<repo>:main`
- `ghcr.io/<owner>/<repo>:sha-xxxxxxx`
- tag 场景还会推 `vX.Y.Z`

使用前请确认：

1. 仓库 Actions 已启用
2. 仓库/组织允许写入 GitHub Packages
3. `GITHUB_TOKEN` 保持默认权限（workflow 内已声明 `packages: write`）

---

## 数据说明

服务端启动时自动建表：

- `tasks`
- `task_image_chunks`
- `stats`
- `app_settings`

说明：

- API Key 不入库（与原设计一致）
- 服务重启后，未完成任务会被标记为失败，需要前端“重试”并重新提供 API Key

---

## 安全建议

- 必须修改 `ACCESS_PASSWORD` 与 `ADMIN_PASSWORD`
- 建议全站 HTTPS
- 不需要 HTTP 上游时，设置 `ALLOW_HTTP_API=false`
- 默认会拦截 localhost/内网/metadata 地址，防止被滥用为内网代理
