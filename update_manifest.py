#!/usr/bin/env python3
"""
动态镜像列表更新脚本
自动检查 Docker Hub 中镜像的最新版本，并更新 images-manifest.yml
"""

import sys
import yaml
import logging
import argparse
import re
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ==================== 配置 ====================

PROJECT_ROOT = Path(__file__).parent
MANIFEST_FILE = PROJECT_ROOT / "images-manifest.yml"
LOGS_DIR = PROJECT_ROOT / "logs"

# ANSI 颜色代码
COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_BLUE = "\033[94m"
COLOR_CYAN = "\033[96m"
COLOR_RESET = "\033[0m"

# ==================== 日志配置 ====================

def setup_logger(debug: bool = False) -> logging.Logger:
    """设置日志记录器"""
    logger = logging.getLogger('ManifestUpdater')
    logger.handlers.clear()
    
    level = logging.DEBUG if debug else logging.INFO
    logger.setLevel(level)
    
    formatter = logging.Formatter(
        f'{COLOR_CYAN}%(asctime)s{COLOR_RESET} - {COLOR_YELLOW}%(levelname)s{COLOR_RESET} - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 文件处理器
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOGS_DIR / f"update_manifest_{datetime.now().strftime('%Y%m%d')}.log"
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    logger.propagate = False
    return logger

# ==================== Docker Hub API ====================

class DockerHubAPI:
    """Docker Hub API 客户端"""
    
    def __init__(self, logger: logging.Logger):
        self.base_url = "https://registry.hub.docker.com/v2"
        self.session = self._create_session()
        self.logger = logger
    
    def _create_session(self) -> requests.Session:
        """创建带重试策略的会话"""
        session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retries, pool_maxsize=10)
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        return session
    
    def version_key(self, version_str: str) -> Tuple[int, ...]:
        """将版本号字符串转换为可比较的元组"""
        try:
            if not version_str:
                return (0, 0, 0)
            
            # 处理 RELEASE 格式（如 RELEASE.2025-10-15T17-29-55Z）
            if version_str.startswith('RELEASE.'):
                date_match = re.search(r'(\d{4})-(\d{2})-(\d{2})', version_str)
                if date_match:
                    return tuple(map(int, date_match.groups()))
            
            # 移除 v 前缀
            if version_str.startswith('v'):
                version_str = version_str[1:]
            
            # 分割版本号（移除后缀如 -alpine）
            version_parts = version_str.split('-')[0]
            parts = []
            for part in version_parts.split('.'):
                try:
                    parts.append(int(part))
                except ValueError:
                    parts.append(0)
            
            while len(parts) < 3:
                parts.append(0)
            
            return tuple(parts[:3])
        except Exception as e:
            self.logger.debug(f"版本号解析出错 {version_str}: {str(e)}")
            return (0, 0, 0)
    
    def get_latest_version(self, repository: str, tag_pattern: str, 
                          exclude_pattern: Optional[str] = None) -> Optional[str]:
        """获取符合模式的最新版本"""
        try:
            matching_tags = []
            page = 1
            max_pages = 3  # 限制最大页数，避免过度请求
            
            while page <= max_pages:
                url = f"{self.base_url}/repositories/{repository}/tags"
                params = {
                    'page_size': 100,
                    'page': page,
                    'ordering': 'last_updated'
                }
                
                self.logger.debug(f"获取 {repository} 的标签列表，页面: {page}")
                
                response = self.session.get(url, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                results = data.get('results', [])
                if not results:
                    break
                
                # 筛选符合模式的版本
                for tag in results:
                    tag_name = tag['name']
                    # 匹配 tag_pattern
                    if not re.match(tag_pattern, tag_name):
                        continue
                    # 排除 exclude_pattern（如果有）
                    if exclude_pattern and re.match(exclude_pattern, tag_name):
                        continue
                    matching_tags.append(tag_name)
                
                # 检查是否有下一页
                if not data.get('next'):
                    break
                
                page += 1
            
            if not matching_tags:
                self.logger.warning(f"未找到符合模式的标签: {repository}")
                return None
            
            # 排序并返回最新版本
            matching_tags.sort(key=self.version_key)
            latest = matching_tags[-1]
            
            self.logger.debug(f"找到 {len(matching_tags)} 个匹配标签，最新: {latest}")
            return latest
            
        except requests.RequestException as e:
            self.logger.error(f"获取版本信息失败 {repository}: {str(e)}")
            return None
        except Exception as e:
            self.logger.error(f"未知错误 {repository}: {str(e)}")
            return None

# ==================== 清单管理 ====================

class ManifestManager:
    """镜像清单管理器"""
    
    def __init__(self, manifest_file: Path, logger: logging.Logger):
        self.manifest_file = manifest_file
        self.logger = logger
    
    def load_manifest(self) -> dict:
        """加载现有清单文件"""
        try:
            if self.manifest_file.exists():
                with open(self.manifest_file, 'r', encoding='utf-8') as f:
                    manifest = yaml.safe_load(f) or {}
                    self.logger.info(f"{COLOR_GREEN}✓{COLOR_RESET} 加载清单文件: {self.manifest_file.name}")
                    return manifest
            else:
                self.logger.warning("清单文件不存在，创建新清单")
                return {'images': [], 'config': {}}
        except Exception as e:
            self.logger.error(f"加载清单失败: {str(e)}")
            return {'images': [], 'config': {}}
    
    def save_manifest(self, manifest: dict):
        """保存清单文件"""
        try:
            with open(self.manifest_file, 'w', encoding='utf-8') as f:
                yaml.dump(manifest, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
            self.logger.info(f"{COLOR_GREEN}✓{COLOR_RESET} 清单已保存: {self.manifest_file.name}")
        except Exception as e:
            self.logger.error(f"保存清单失败: {str(e)}")
            raise
    
    def update_versions(self, api: DockerHubAPI, dry_run: bool = False) -> int:
        """更新清单中的版本号"""
        manifest = self.load_manifest()
        
        if 'images' not in manifest:
            manifest['images'] = []
        
        updated_count = 0
        unchanged_count = 0
        failed_count = 0
        
        print(f"\n{COLOR_BLUE}{'='*80}{COLOR_RESET}")
        print(f"{COLOR_CYAN}开始检查镜像版本{COLOR_RESET}")
        print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}\n")
        
        for idx, img in enumerate(manifest['images'], 1):
            if not img.get('enabled', True):
                self.logger.info(f"[{idx}] ⏭️  跳过已禁用的镜像")
                continue
            
            source = img['source']
            tag_pattern = img.get('tag_pattern')
            exclude_pattern = img.get('exclude_pattern')
            description = img.get('description', '')
            
            if not tag_pattern:
                self.logger.warning(f"[{idx}] {source} - 缺少 tag_pattern")
                failed_count += 1
                continue
            
            # 解析镜像信息
            parts = source.split(':')
            if len(parts) != 2:
                self.logger.warning(f"[{idx}] {source} - 格式无效")
                failed_count += 1
                continue
            
            repository = parts[0]
            current_version = parts[1]
            
            print(f"{COLOR_CYAN}[{idx}] {repository}{COLOR_RESET}")
            print(f"  📝 {description}")
            print(f"  📌 当前版本: {COLOR_YELLOW}{current_version}{COLOR_RESET}")
            
            # 获取最新版本
            latest_version = api.get_latest_version(repository, tag_pattern, exclude_pattern)
            
            if latest_version:
                if current_version != latest_version:
                    print(f"  {COLOR_GREEN}🔄 发现更新: {latest_version}{COLOR_RESET}")
                    if not dry_run:
                        img['source'] = f"{repository}:{latest_version}"
                    updated_count += 1
                else:
                    print(f"  {COLOR_GREEN}✓ 已是最新版本{COLOR_RESET}")
                    unchanged_count += 1
            else:
                print(f"  {COLOR_RED}✗ 无法获取最新版本{COLOR_RESET}")
                failed_count += 1
            
            print()
        
        # 更新配置
        if 'config' not in manifest:
            manifest['config'] = {}
        
        manifest['config']['last_checked'] = datetime.now().isoformat()
        
        # 保存清单
        if not dry_run and updated_count > 0:
            self.save_manifest(manifest)
        
        # 打印统计
        print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}")
        print(f"{COLOR_CYAN}检查完成！{COLOR_RESET}")
        print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}\n")
        print(f"  {COLOR_GREEN}✓ 已是最新:{COLOR_RESET} {unchanged_count} 个")
        print(f"  {COLOR_YELLOW}🔄 需要更新:{COLOR_RESET} {updated_count} 个")
        print(f"  {COLOR_RED}✗ 获取失败:{COLOR_RESET} {failed_count} 个")
        
        if dry_run and updated_count > 0:
            print(f"\n{COLOR_YELLOW}ℹ️  这是预演模式，未实际修改文件{COLOR_RESET}")
        
        return updated_count

# ==================== 主程序 ====================

def main():
    """主程序入口"""
    parser = argparse.ArgumentParser(
        description='更新 Docker 镜像清单中的版本号',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python update_manifest.py              # 检查并更新所有镜像
  python update_manifest.py -D           # 调试模式
  python update_manifest.py --dry-run    # 预演模式（不修改文件）
  python update_manifest.py --manifest custom.yml  # 使用自定义清单文件
        """
    )
    
    parser.add_argument('-D', '--debug', 
                       action='store_true',
                       help='启用调试模式，显示详细日志')
    parser.add_argument('--dry-run', 
                       action='store_true',
                       help='预演模式，不实际修改文件')
    parser.add_argument('--manifest', 
                       type=Path,
                       default=MANIFEST_FILE,
                       help='清单文件路径')
    
    args = parser.parse_args()
    
    try:
        logger = setup_logger(args.debug)
        
        print(f"\n{COLOR_BLUE}{'='*80}{COLOR_RESET}")
        print(f"{COLOR_GREEN}Docker 镜像清单更新工具{COLOR_RESET}")
        print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}")
        
        if not args.manifest.exists():
            logger.error(f"清单文件不存在: {args.manifest}")
            return 1
        
        # 初始化 API 和管理器
        api = DockerHubAPI(logger)
        manager = ManifestManager(args.manifest, logger)
        
        # 更新版本
        updated_count = manager.update_versions(api, dry_run=args.dry_run)
        
        if updated_count > 0 and not args.dry_run:
            print(f"\n{COLOR_GREEN}✓ 成功更新 {updated_count} 个镜像版本{COLOR_RESET}")
        elif updated_count > 0 and args.dry_run:
            print(f"\n{COLOR_YELLOW}ℹ️  预演模式：发现 {updated_count} 个可更新镜像{COLOR_RESET}")
        else:
            print(f"\n{COLOR_GREEN}✓ 所有镜像都是最新版本{COLOR_RESET}")
        
        print()
        return 0
        
    except KeyboardInterrupt:
        print(f"\n\n{COLOR_YELLOW}⚠️  用户中断{COLOR_RESET}")
        return 1
    except Exception as e:
        print(f"\n\n{COLOR_RED}✗ 程序执行出错: {str(e)}{COLOR_RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())