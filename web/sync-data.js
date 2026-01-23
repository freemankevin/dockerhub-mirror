/**
 * 数据同步脚本
 * 将项目根目录的 images.json 复制到 web 目录
 * 用于本地开发环境
 */

const fs = require('fs');
const path = require('path');

// 获取路径
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'images.json');
const targetPath = path.join(__dirname, 'images.json');

console.log('📦 开始同步数据文件...');
console.log(`📁 源文件: ${sourcePath}`);
console.log(`📁 目标文件: ${targetPath}`);

try {
  // 检查源文件是否存在
  if (!fs.existsSync(sourcePath)) {
    console.error('❌ 错误: 源文件 images.json 不存在于项目根目录');
    console.error('💡 请先运行脚本生成 images.json 文件');
    process.exit(1);
  }

  // 读取源文件
  const data = fs.readFileSync(sourcePath, 'utf8');

  // 验证JSON格式
  try {
    JSON.parse(data);
  } catch (error) {
    console.error('❌ 错误: images.json 格式无效');
    console.error(error.message);
    process.exit(1);
  }

  // 写入目标文件
  fs.writeFileSync(targetPath, data, 'utf8');

  console.log('✅ 数据文件同步成功!');
  console.log(`📊 同步了 ${JSON.parse(data).total_images || 0} 个镜像信息`);
} catch (error) {
  console.error('❌ 同步失败:', error.message);
  process.exit(1);
}
