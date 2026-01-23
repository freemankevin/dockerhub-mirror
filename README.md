# DockerHub Mirror

> 一个强大的 Docker 镜像同步工具，支持自动从 Docker Hub 同步镜像到 GHCR 容器仓库，并提供 Web 界面查看镜像列表。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ 功能特性

- 🔄 **镜像同步**：将 Docker Hub 镜像同步到 GHCR 等容器仓库
- 📋 **版本管理**：自动检测并更新镜像版本
- 🚀 **并发处理**：支持多线程并发同步，提高效率
- 🔁 **智能重试**：内置重试机制，应对网络波动和速率限制
- 🎯 **灵活配置**：通过 YAML 清单文件管理镜像配置
- 🌐 **Web 界面**：提供美观的 Web 界面查看镜像列表
- 📊 **版本过滤**：支持正则表达式匹配和排除特定版本
- 💾 **版本保留**：可配置保留的版本数量

## 📦 安装

### 前置要求

- Python 3.7+
- Node.js 14+（用于 Web 界面）
- [regctl](https://github.com/regclient/regclient) 工具（用于镜像同步）
- Docker（可选，用于本地测试）

### 安装步骤

1. 克隆仓库：
```bash
git clone https://github.com/freemankevin/dockerhub-mirror.git
cd dockerhub-mirror
```

2. 安装 Python 依赖：
```bash
pip install -r requirements.txt
```

3. 安装 regctl：
```bash
# macOS
brew install regclient

# Linux
wget https://github.com/regclient/regclient/releases/latest/download/regctl-linux-amd64
chmod +x regctl-linux-amd64
sudo mv regctl-linux-amd64 /usr/local/bin/regctl

# Windows
# 下载 https://github.com/regclient/regclient/releases/latest/download/regctl-windows-amd64.exe
# 并将其添加到 PATH
```

4. （可选）安装 Web 界面依赖：
```bash
cd web
npm install
```

## 🚀 使用方法

### 命令行工具

#### 1. 更新镜像清单

检查并更新清单中镜像的最新版本：

```bash
# 更新清单
python main.py update

# 预演模式（不修改文件）
python main.py update --dry-run

# 指定并发数
python main.py update --max-workers 10

# 禁用并发
python main.py update --no-concurrency
```

#### 2. 同步镜像

将镜像同步到目标仓库：

```bash
# 同步到 GHCR（默认）
python main.py sync --owner freemankevin

# 指定目标仓库
python main.py sync --owner freemankevin --registry ghcr.io

# 调整并发数和重试次数
python main.py sync --owner freemankevin --max-workers 2 --max-retries 5 --retry-delay 3

# 即使同步失败也继续生成 JSON
python main.py sync --owner freemankevin --continue-on-error
```

#### 3. 运行完整流程

执行更新和同步的完整流程：

```bash
# 运行完整流程
python main.py run --owner freemankevin

# 即使更新失败也继续同步
python main.py run --owner freemankevin --continue-on-error

# 分别设置更新和同步的并发数
python main.py run --owner freemankevin --max-workers 10 --max-workers-sync 2 --max-retries 5
```

#### 4. 使用自定义清单

```bash
python main.py update --manifest custom.yml
python main.py sync --owner freemankevin --manifest custom.yml
```

### Web 界面

#### 本地开发

```bash
cd web
npm run dev
```

访问 http://localhost:3000 查看镜像列表。

#### 部署到 Vercel

项目已配置 Vercel 部署，直接连接仓库即可自动部署。

## 📁 项目结构

```
dockerhub-mirror/
├── main.py                    # 主入口文件
├── requirements.txt           # Python 依赖
├── images-manifest.yml        # 镜像清单配置
├── images.json                # 生成的镜像列表
├── vercel.json                # Vercel 部署配置
├── scripts/                   # 核心脚本
│   ├── __init__.py
│   ├── cli.py                 # 命令行接口
│   ├── docker_hub_api.py      # Docker Hub API
│   ├── ghcr_api.py            # GHCR API
│   ├── manifest_manager.py    # 清单管理
│   ├── mirror_sync.py         # 镜像同步
│   ├── utils.py               # 工具函数
│   └── generate_images_json.py # 生成镜像 JSON
└── web/                       # Web 界面
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   └── app.js
    ├── sync-data.js
    ├── package.json
    └── README.md
```

## ⚙️ 配置说明

### 镜像清单 (images-manifest.yml)

```yaml
images:
  - source: library/nginx:1.29.4-alpine
    enabled: true
    description: Nginx 高性能 Web 服务器
    tag_pattern: ^[0-9]+\.[0-9]+\.[0-9]+-alpine$
    sync_all_matching: false

  - source: freelabspace/postgresql-postgis:18.1
    enabled: true
    description: PostgreSQL 数据库 + PostGIS 扩展
    tag_pattern: ^(1[3-8])\.[0-9]+$
    exclude_pattern: ^buildcache-.*
    sync_all_matching: true
    version_range: 13.x-18.x
    retention:
      max_versions: 3

config:
  registry: ghcr.io
  owner: freemankevin
  check_exist: true
  update_index: true
  retention:
    max_versions: 3
    cleanup_old_versions: false
```

### 配置项说明

| 字段 | 说明 |
|------|------|
| `source` | 源镜像名称和标签 |
| `enabled` | 是否启用该镜像 |
| `description` | 镜像描述 |
| `tag_pattern` | 标签匹配正则表达式 |
| `exclude_pattern` | 标签排除正则表达式 |
| `sync_all_matching` | 是否同步所有匹配的版本 |
| `version_range` | 版本范围说明 |
| `retention.max_versions` | 保留的最大版本数 |

## ⚠️ 注意事项

1. **速率限制**：Docker Hub 对匿名用户有严格的速率限制（100次拉取/6小时），建议：
   - 降低并发数（`--max-workers 2-3`）
   - 增加重试次数（`--max-retries 5`）
   - 使用 `--retry-delay` 参数控制重试延迟

2. **认证**：如需访问私有镜像或提高速率限制，请配置 Docker Hub 认证。

3. **存储空间**：同步大量镜像会占用大量存储空间，请确保有足够的磁盘空间。

4. **网络环境**：同步过程需要稳定的网络连接，建议在网络良好的环境下运行。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

本项目受到了 [dockerhub-mirror/dockerhub-mirror](https://github.com/dockerhub-mirror/dockerhub-mirror.git) 项目的启发。
