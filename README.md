# Docker Hub Mirror

一个强大的 Docker 镜像同步工具，支持将 Docker Hub、GCR、Quay 等镜像仓库的镜像同步到 GitHub Container Registry (GHCR)。

## 项目结构

```
dockerhub-mirror/
├── index.html              # Web 前端入口
├── package.json            # Node.js 项目配置
├── css/                    # CSS 样式文件
├── js/                     # JavaScript 文件
├── images.json             # 镜像列表数据
├── images-manifest.yml     # 镜像清单配置
├── startup.sh              # 一键启动脚本
├── vercel.json             # Vercel 部署配置
└── scripts/                # Python 脚本目录
    ├── main.py             # Python 主入口
    ├── requirements.txt    # Python 依赖
    ├── api/                # API 客户端模块
    │   ├── docker_hub_api.py
    │   ├── ghcr_api.py
    │   └── registry_api.py
    ├── core/               # 核心业务逻辑
    │   ├── manifest_manager.py
    │   ├── mirror_sync.py
    │   └── generate_images_json.py
    ├── cli/                # CLI 命令处理
    │   └── cli.py
    ├── utils/              # 工具函数
    │   └── utils.py
    └── dev_server.py       # 本地开发服务器
```

## 功能特性

- 🔄 **镜像同步**: 支持从 Docker Hub、GCR、Quay 同步镜像到 GHCR
- 📋 **版本管理**: 自动检测并更新镜像版本
- 🌐 **Web 界面**: 纯前端展示镜像列表，支持搜索和过滤
- 🚀 **一键启动**: startup.sh 脚本快速启动开发环境

## 快速开始

### 前端开发

```bash
# 使用一键启动脚本
chmod +x startup.sh
./startup.sh

# 或手动启动
npm install
npm run start
```

访问 http://localhost:7886 查看 Web 界面。

### 镜像同步

```bash
# 安装 Python 依赖
pip install -r scripts/requirements.txt

# 显示帮助信息
python scripts/main.py help

# 更新镜像清单
python scripts/main.py update

# 同步镜像到 GHCR
python scripts/main.py sync --owner <your-github-username>

# 完整流程（更新+同步）
python scripts/main.py run --owner <your-github-username>
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `python scripts/main.py help` | 显示帮助信息 |
| `python scripts/main.py update` | 更新镜像清单版本 |
| `python scripts/main.py sync` | 同步镜像到 GHCR |
| `python scripts/main.py run` | 执行完整流程 |
| `python scripts/main.py generate` | 生成镜像列表 JSON |
| `python scripts/main.py dev` | 启动本地开发服务器 |
| `npm run start` | 启动前端开发服务器 |

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `GHCR_TOKEN` | GitHub Personal Access Token |
| `DOCKER_HUB_USERNAME` | Docker Hub 用户名 (可选) |
| `DOCKER_HUB_TOKEN` | Docker Hub Token (可选) |

## 部署

项目配置了 Vercel 部署，可直接部署到 Vercel 平台。

## License

MIT License