#!/bin/bash
# Docker Hub Mirror 一键启动脚本
# 自动构建并启动开发服务器

set -e

echo "=========================================="
echo "  Docker Hub Mirror - 开发环境启动"
echo "=========================================="

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo ""

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装 npm 依赖..."
    npm install
fi

echo ""
echo "🚀 启动开发服务器..."
echo ""

# 启动开发服务器
npm run start