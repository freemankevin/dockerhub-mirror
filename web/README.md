# 前端本地开发说明

## 项目结构

```
web/
├── index.html          # 主页面
├── css/
│   └── style.css      # 样式文件
├── js/
│   └── app.js         # 前端逻辑
├── sync-data.js       # 数据同步脚本
├── package.json       # 项目配置
└── README.md          # 本文档
```

## 本地开发

### 前置条件

1. 确保项目根目录存在 `images.json` 文件
2. 如果不存在，请运行以下命令生成：
   ```bash
   python scripts/generate_images_json.py
   ```

### 启动开发服务器

在 `web/` 目录下运行：

```bash
npm run dev
```

这个命令会：
1. 自动将项目根目录的 `images.json` 复制到 `web/` 目录
2. 启动本地开发服务器（端口 3000）

### 单独同步数据

如果只需要同步数据文件（不启动服务器）：

```bash
npm run sync
```

### 访问应用

打开浏览器访问：http://localhost:3000

## 工作原理

### 数据同步

- 项目根目录的 `images.json` 是主数据文件
- `sync-data.js` 脚本会在启动开发服务器前自动将数据复制到 `web/` 目录
- 这样前端可以通过 `/images.json` 路径访问数据

### 部署时

- Vercel 部署时，`vercel.json` 配置会从项目根目录读取 `images.json`
- 不需要手动同步数据文件
- `web/images.json` 已在 `.gitignore` 中，不会被提交到仓库

## 注意事项

1. 每次修改项目根目录的 `images.json` 后，需要重新运行 `npm run dev` 来同步数据
2. `web/images.json` 是自动生成的，不要手动修改
3. 确保在 `web/` 目录下运行命令

## 故障排查

### 问题：启动时报错 "源文件 images.json 不存在"

**解决方案**：在项目根目录运行以下命令生成数据文件：
```bash
python scripts/generate_images_json.py
```

### 问题：页面显示"加载失败"

**解决方案**：
1. 检查 `web/images.json` 是否存在
2. 运行 `npm run sync` 手动同步数据
3. 检查浏览器控制台的错误信息

### 问题：数据没有更新

**解决方案**：
1. 确认项目根目录的 `images.json` 已更新
2. 重新运行 `npm run dev` 来同步最新数据
