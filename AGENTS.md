# AGENTS.md — Registry Sync

> 本文件面向 AI Coding Agent。如果你对该项目一无所知，请从这里开始阅读。

## 项目概述

Registry Sync 是一个**多源 Docker 镜像同步服务**，核心功能是将外部镜像仓库（Docker Hub、GHCR、GCR、Quay、AWS ECR Public）的容器镜像同步到 **GitHub Container Registry (GHCR)**，并提供一个纯前端静态页面展示镜像列表和拉取命令。

项目包含两部分：
1. **Python 同步工具链**（`scripts/`）—— 负责镜像版本检测、同步、清理、生成数据文件。
2. **纯前端展示页面**（`index.html` + `css/` + `js/`）—— 静态 HTML，从 `images.json` 读取数据并渲染镜像卡片。

前端部署在 **Vercel**（静态托管），同步流程由 **GitHub Actions** 定时触发。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML5 + CSS3 + JavaScript（无框架） |
| 样式 | Tailwind CSS（CDN 引入）+ 自定义 `css/style.css` |
| 图标 | Font Awesome 6（CDN） |
| 前端构建 | 无构建步骤，纯静态文件 |
| 后端脚本 | Python 3.11 |
| 外部依赖 | `requests`, `pyyaml`, `python-dotenv` |
| 镜像复制 | [`regctl`](https://github.com/regclient/regclient)（命令行工具） |
| 部署 | Vercel 静态托管 |
| CI/CD | GitHub Actions（`.github/workflows/mirror-images.yml`） |

---

## 项目结构

```
.
├── index.html                  # 前端入口（纯静态）
├── images.json                 # 镜像列表数据（由脚本生成，前端读取）
├── images-manifest.yml         # 镜像同步配置清单（核心配置）
├── package.json                # Node 配置（仅用于 dev server）
├── vercel.json                 # Vercel 部署配置（路由、缓存头）
├── startup.sh                  # 前端开发服务器一键启动脚本
├── css/
│   └── style.css               # 自定义样式（覆盖 Tailwind + 主题动画）
├── js/
│   ├── app.js                  # 前端主逻辑：数据加载、渲染、搜索、筛选、主题
│   └── i18n.js                 # 国际化（中/英双语）
├── public/                     # 静态资源（logo、字体、背景图、favicon）
├── scripts/                    # Python 工具链
│   ├── main.py                 # CLI 入口
│   ├── requirements.txt        # Python 依赖
│   ├── cli/
│   │   └── cli.py              # 子命令解析与调度（update/sync/run/generate/cleanup）
│   ├── api/
│   │   ├── registry_api.py     # 多仓库 API 客户端（Docker Hub/GCR/Quay/ECR）
│   │   ├── ghcr_api.py         # GHCR API 客户端（GitHub REST API）
│   │   └── docker_hub_api.py   # Docker Hub 专用 API（保留文件）
│   ├── core/
│   │   ├── manifest_manager.py # 镜像清单管理（加载、更新版本、保存）
│   │   ├── mirror_sync.py      # 镜像同步核心逻辑（调用 regctl）
│   │   ├── cleanup.py          # 旧镜像清理工具
│   │   └── generate_images_json.py  # 生成 images.json 数据文件
│   ├── utils/
│   │   └── utils.py            # 通用工具（镜像名解析、日志、环境变量）
│   └── test/                   # 测试/调试脚本（非自动化测试）
└── .github/workflows/
    └── mirror-images.yml       # GitHub Actions：定时同步工作流
```

---

## 核心配置文件

### `images-manifest.yml`
定义需要同步的镜像列表及其规则。每个镜像条目支持：

- `source`: 源镜像完整地址（含标签）
- `enabled`: 是否启用同步
- `repository`: 自定义 GHCR 仓库路径（可选，覆盖默认路径转换规则）
- `description`: 镜像描述
- `tag_pattern`: 标签匹配正则（用于检测新版本）
- `exclude_pattern`: 排除标签正则
- `sync_all_matching`: 是否同步所有匹配标签（还是仅当前标签）
- `retention`: 版本保留策略
  - `strategy`: `max_versions` / `latest_per_major` / `latest_per_minor`
  - `max_versions`: 最大保留版本数
  - `major_versions`: 按主版本保留时指定的主版本列表
  - `keep_minor_versions`: 按次版本保留时指定的次版本列表

全局配置在 `config` 节点下：
- `registry`: 目标仓库（默认 `ghcr.io`）
- `owner`: GHCR 组织/用户名称
- `retention`: 全局默认保留策略

### `images.json`
由 `generate` 命令生成的数据文件，供前端读取。包含每个镜像的元数据、版本列表、同步状态、大小、层数、平台等。

---

## 常用命令

### 前端开发

```bash
# 一键启动本地开发服务器（端口 7886）
chmod +x startup.sh
./startup.sh

# 或使用 npm
npm run dev      # npx serve . -p 7886
npm run start    # build + dev
```

### Python 镜像同步

```bash
# 安装依赖
pip install -r scripts/requirements.txt

# 更新镜像清单版本（检测各源仓库最新版本并写入 manifest）
python scripts/main.py update

# 同步镜像到 GHCR（需要 Docker 登录和 GHCR_TOKEN）
python scripts/main.py sync --owner <owner> --registry ghcr.io

# 完整流程：更新 + 同步
python scripts/main.py run --owner <owner>

# 生成/刷新 images.json（供前端使用）
python scripts/main.py generate --owner <owner>

# 清理旧镜像（默认 dry-run，加 --force 才实际删除）
python scripts/main.py cleanup --owner <owner> --force
```

常用参数：
- `--max-workers N`: 并发数（update 默认 5，sync 默认 3）
- `--max-retries N`: 同步失败重试次数（默认 3）
- `--retry-delay S`: 重试延迟秒数（默认 2.0）
- `--dry-run`: 预演模式，不修改文件
- `--debug` / `-D`: 开启调试日志

---

## 环境变量

复制 `.env.sample` 为 `.env` 或 `.env.local`：

| 变量 | 说明 | 必需 |
|------|------|------|
| `GHCR_TOKEN` | GitHub Personal Access Token（需 `read:packages`, `write:packages`, `delete:packages`） | **是** |
| `DOCKER_HUB_USERNAME` | Docker Hub 用户名（可选，提升 API 限额） | 否 |
| `DOCKER_HUB_TOKEN` | Docker Hub Token（可选） | 否 |
| `GITHUB_OWNER` | 默认 GHCR 所有者 | 否 |
| `GITHUB_REGISTRY` | 默认目标仓库（默认 `ghcr.io`） | 否 |

环境变量加载顺序（优先级从高到低）：`.env.local` → `.env` → 系统环境变量。

---

## CI/CD（GitHub Actions）

`.github/workflows/mirror-images.yml`：

- **触发条件**：
  - 定时：`cron: '30 1 * * *'`（每天 UTC 01:30）
  - `push`/`pull_request`：当 `images-manifest.yml`、工作流文件或 `scripts/**` 变更时
  - `workflow_dispatch`：支持手动触发，可选 `cleanup` 参数

- **执行步骤**：
  1. `update`：检测并更新 `images-manifest.yml` 中的版本号
  2. `sync`：使用 `regctl image copy` 同步镜像到 GHCR
  3. `cleanup`：删除不符合保留策略的旧镜像版本（非 PR 时执行）
  4. `generate`：重新生成 `images.json`
  5. 自动提交并推送变更到仓库

- **Secrets 要求**：
  - `PAT_TOKEN`：用于 GHCR 登录和 API 调用（等同于 `GHCR_TOKEN`）
  - `DOCKER_HUB_TOKEN`：用于 Docker Hub 登录（避免匿名拉取限额）
  - `GITHUB_TOKEN`：用于仓库 checkout 和 push

---

## 代码组织规范

### Python 侧
- 使用 `#!/usr/bin/env python3` 和 `# -*- coding: utf-8 -*-` 头部
- 模块按职责分层：`api/`（外部 API）、`core/`（业务逻辑）、`cli/`（命令解析）、`utils/`（通用工具）
- 每个模块文件通常包含独立的功能类（如 `RegistryAPI`、`GHCRRegistryAPI`、`ManifestManager`、`MirrorSync`、`ImageCleanup`）
- 日志通过 `setup_logger()` 创建，支持文件落盘到 `logs/` 目录
- Windows 兼容性处理：在 `main.py` 中重定向 `sys.stdout/stderr` 为 UTF-8

### 前端侧
- `index.html` 为单页应用，无路由
- `app.js` 按功能分区注释（State / Theme / Data loading / Filtering / Stats / Card rendering / Copy / Toast / Render / Boot）
- `i18n.js` 提供 `window.i18n` 全局对象，支持中英文切换，自动检测浏览器语言
- 主题切换通过 `localStorage` 持久化，并在 `<html>` 标签上设置 `dark`/`light` class
- 搜索支持：名称、描述、源镜像地址、拉取命令路径的模糊匹配，支持多关键词分词
- 背景图轮播：每 30 分钟自动切换，初始随机

---

## 关键外部依赖

| 依赖 | 用途 |
|------|------|
| `regctl` | 实际的镜像复制工具（`regctl image copy`），GitHub Actions 中通过 `iarekylew00t/regctl-installer@v4` 安装 |
| `requests` | Python HTTP 客户端（API 调用） |
| `pyyaml` | YAML 清单文件读写 |
| `python-dotenv` | 加载 `.env` / `.env.local` |
| `serve`（npm devDep） | 本地静态文件服务器 |

---

## 安全注意事项

- **Token 管理**：`GHCR_TOKEN` 需具备 `write:packages` 和 `delete:packages` 权限，不要在代码中硬编码。GitHub Actions 中使用 Secrets 注入。
- **cleanup 危险**：`cleanup --force` 会**永久删除** GHCR 上的镜像版本，默认 `dry-run` 保护。工作流中仅在非 PR 且手动触发时才可能强制清理。
- **Rate Limit**：Docker Hub 匿名用户有 100 次/6小时的拉取限额，同步时建议降低并发（`--max-workers 2-3`）并增加重试。
- **regctl 超时**：单次镜像同步命令超时时间为 600 秒，超大镜像可能超时失败。

---

## 修改建议

- 新增镜像：编辑 `images-manifest.yml`，添加条目后运行 `python scripts/main.py run --owner <owner>` 验证
- 前端调整：直接修改 `index.html` / `css/style.css` / `js/app.js`，刷新即可生效（无构建步骤）
- 新增源仓库支持：在 `scripts/api/registry_api.py` 的 `RegistryAPI` 中添加新的 registry 类型检测和标签获取方法
