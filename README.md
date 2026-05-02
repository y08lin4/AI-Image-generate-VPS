# AI-Image-generate-VPS

一个可部署在 VPS 的 AI 生图工作台：

- 前端：React + Vite
- 后端：Node.js + Express
- 数据：SQLite（`node:sqlite`）
- 图床：PiXhost（可自动上传）

在保留原 `/api/*` 协议的前提下，从 Cloudflare 版本迁移到 VPS 版本。

---

## 文档索引

- [新增能力（本次）](#whats-new)
- [功能概览](#features)
- [主要接口](#api)
- [环境变量](#env)
- [本地开发](#local-dev)
- [生产部署（VPS）](#deploy-vps)
- [VPS 详细部署教程](#vps-guide)
- [Docker 部署](#docker)
- [GitHub 自动打包镜像（GHCR）](#ghcr)
- [数据说明](#data)
- [安全建议](#security)

---

<a id="whats-new"></a>
## 新增能力（本次）

- **访问门禁**：进入页面前必须输入访问密码（`ACCESS_PASSWORD`）
- **用户系统**：
  - 用户注册 / 登录 / 退出（Cookie 会话）
  - 用户可发布作品到广场（标题 + 提示词 + 图片）
  - 支持点赞 / 取消点赞
  - 支持“我的作品”查看与删除
- **作品广场**：
  - 支持排序：最新 / 最热
  - 支持分页浏览
  - 支持收藏、评论
  - 支持查看用户公开主页
- **管理员面板**：
  - 输入管理员密码（`ADMIN_PASSWORD`）
  - 可在线修改访问密码
  - 查看“今日统计”：请求总张数、成功张数、失败张数、处理中张数
  - 查看失败原因聚合（Top）
  - 支持按作品 ID 下架 / 恢复作品
- **Docker + GitHub Actions**：支持自动构建并推送镜像到 GHCR

---

<a id="features"></a>
## 功能概览

- 文生图 / 图生图（最多 8 张参考图）
- 单任务最多 12 张，支持并发
- SSE 流式返回结果
- 后台任务队列（创建/查询/重试）
- 本地历史记录
- PiXhost 上传与图片代理
- 大图超过 10MB 时，走本地分片回传（不压缩）

---

<a id="api"></a>
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
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/my/works`
- `GET /api/my/favorites`
- `POST /api/works`
- `GET /api/works?sort=latest|hot&limit=20&offset=0`
- `GET /api/works/:id`
- `DELETE /api/works/:id`
- `POST /api/works/:id/like`
- `DELETE /api/works/:id/like`
- `POST /api/works/:id/favorite`
- `DELETE /api/works/:id/favorite`
- `GET /api/works/:id/comments`
- `POST /api/works/:id/comments`
- `DELETE /api/comments/:id`
- `GET /api/users/:id`
- `GET /api/users/:id/works`

管理员接口：

- `POST /api/admin/verify`
- `GET /api/admin/daily-report?date=YYYY-MM-DD`
- `POST /api/admin/access-password`
- `POST /api/admin/works/:id/hide`
- `POST /api/admin/works/:id/restore`

---

<a id="env"></a>
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

<a id="local-dev"></a>
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

<a id="deploy-vps"></a>
## 生产部署（VPS）

```bash
npm install
npm run build
npm run start
```

建议配合 Nginx + PM2/Systemd。

---

<a id="vps-guide"></a>
## VPS 详细部署教程（Ubuntu 22.04 / 24.04）

下面给一套可直接落地的方案：**Node.js + Systemd + Nginx + HTTPS**。  
适用于新机器从 0 到上线。

### 0）准备条件

- 一台 Linux VPS（Ubuntu 22.04/24.04）
- 一个域名（例如 `ai.example.com`）
- 域名 `A` 记录已指向 VPS 公网 IP
- 服务器放通 `22 / 80 / 443` 端口

---

### 1）系统初始化

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y git curl unzip ufw nginx
```

可选（建议）防火墙：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

---

### 2）安装 Node.js 22+

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

---

### 3）拉取项目并安装依赖

```bash
cd /opt
sudo git clone https://github.com/y08lin4/AI-Image-generate-VPS.git
sudo chown -R $USER:$USER /opt/AI-Image-generate-VPS
cd /opt/AI-Image-generate-VPS
npm install
```

---

### 4）配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`（必须改密码）：

```env
PORT=8787
ACCESS_PASSWORD=请改成强密码
ADMIN_PASSWORD=请改成另一个强密码
ALLOW_HTTP_API=false
ALLOW_PRIVATE_HOSTS=false
DB_PATH=./data/app.db
```

> 建议：`ACCESS_PASSWORD` 与 `ADMIN_PASSWORD` 不要相同。  
> 上线环境建议 `ALLOW_HTTP_API=false`，只允许 HTTPS 上游。

---

### 5）构建并本机验证

```bash
npm run build
npm run start
```

另开终端测试：

```bash
curl -H "X-Access-Password: 你的ACCESS_PASSWORD" http://127.0.0.1:8787/api/health
```

返回 `{"ok":true,...}` 即正常。  
验证后按 `Ctrl + C` 停掉前台进程，继续下一步。

---

### 6）配置 Systemd 常驻运行

创建服务文件：

```bash
sudo tee /etc/systemd/system/ai-image-generate.service > /dev/null <<'EOF'
[Unit]
Description=AI Image Generate VPS
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/AI-Image-generate-VPS
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

启动并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai-image-generate
sudo systemctl status ai-image-generate --no-pager
```

查看日志：

```bash
journalctl -u ai-image-generate -f
```

---

### 7）配置 Nginx 反向代理（含 SSE）

创建站点配置：

```bash
sudo tee /etc/nginx/sites-available/ai-image-generate > /dev/null <<'EOF'
server {
    listen 80;
    server_name ai.example.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 关键配置，避免流式被缓冲
        proxy_buffering off;
        proxy_request_buffering off;
        chunked_transfer_encoding off;
        proxy_read_timeout 3600;
    }
}
EOF
```

启用并重载：

```bash
sudo ln -sf /etc/nginx/sites-available/ai-image-generate /etc/nginx/sites-enabled/ai-image-generate
sudo nginx -t
sudo systemctl reload nginx
```

---

### 8）申请 HTTPS 证书（Let’s Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ai.example.com
```

测试自动续期：

```bash
sudo certbot renew --dry-run
```

---

### 9）上线后检查清单

- 打开 `https://ai.example.com` 能进入密码门禁页
- 输入 `ACCESS_PASSWORD` 可进入系统
- Admin 页面可用 `ADMIN_PASSWORD` 登录
- `/api/health` 返回 `ok: true`
- 后台任务可创建、可重试
- Nginx/系统日志无持续报错

---

### 10）升级发布流程（后续版本）

```bash
cd /opt/AI-Image-generate-VPS
git pull
npm install
npm run build
sudo systemctl restart ai-image-generate
sudo systemctl status ai-image-generate --no-pager
```

---

### 11）SQLite 备份与恢复

备份：

```bash
cd /opt/AI-Image-generate-VPS
mkdir -p backup
sqlite3 data/app.db ".backup './backup/app-$(date +%F-%H%M%S).db'"
```

恢复（示例）：

```bash
cp backup/app-2026-05-02-120000.db data/app.db
sudo systemctl restart ai-image-generate
```

---

### 12）常见问题

1. **页面一直提示密码错误**
   - 检查 `.env` 的 `ACCESS_PASSWORD`
   - 若管理员已改过密码，以管理员页最新密码为准（已写入数据库）

2. **Actions 显示成功，但服务器没更新**
   - GitHub 构建成功 ≠ 服务器自动拉取
   - VPS 仍需执行 `git pull && npm run build && systemctl restart`

3. **流式生成卡住**
   - 检查 Nginx 是否配置 `proxy_buffering off`
   - 检查上游 API 是否超时或限流

4. **管理员接口 503**
   - 说明 `ADMIN_PASSWORD` 未配置或仍是 `change-me`

---

<a id="docker"></a>
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

<a id="ghcr"></a>
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

<a id="data"></a>
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

<a id="security"></a>
## 安全建议

- 必须修改 `ACCESS_PASSWORD` 与 `ADMIN_PASSWORD`
- 建议全站 HTTPS
- 不需要 HTTP 上游时，设置 `ALLOW_HTTP_API=false`
- 默认会拦截 localhost/内网/metadata 地址，防止被滥用为内网代理
