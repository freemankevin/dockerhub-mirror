#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 GitHub Container Registry 生成镜像列表 JSON
"""

import json
import yaml
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List

# 设置标准输出编码为 UTF-8（解决 Windows 终端编码问题）
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.ghcr_api import GHCRRegistryAPI
from scripts.utils import setup_logger


def generate_images_json(
    manifest_file: Path,
    output_file: Path,
    registry: str = "ghcr.io",
    owner: str = "",
    token: str = None,
    logger=None
) -> Dict:
    """从 GHCR 生成镜像列表 JSON
    
    Args:
        manifest_file: 清单文件路径
        output_file: 输出文件路径
        registry: 镜像仓库地址
        owner: 仓库所有者
        token: GitHub Personal Access Token (可选)
        logger: 日志记录器
        
    Returns:
        生成的镜像数据
    """
    if not logger:
        logger = setup_logger('generate', False, project_root / 'logs')
    
    # 加载清单文件
    with open(manifest_file, 'r', encoding='utf-8') as f:
        manifest = yaml.safe_load(f)
    
    # 初始化 GHCR API 客户端
    ghcr_api = GHCRRegistryAPI(logger, token)
    
    # 收集所有镜像信息
    images = []
    
    for img in manifest.get('images', []):
        if not img.get('enabled', True):
            continue
        
        source = img['source']
        description = img.get('description', '')
        
        # 提取镜像名和版本
        if ':' in source:
            image_name, version = source.rsplit(':', 1)
        else:
            image_name = source
            version = 'latest'
        
        # 转换为 GHCR 仓库名
        repo_name = image_name.replace('/', '__')
        
        # 获取 GHCR 中的标签信息
        print(f"\n🔍 获取 {owner}/{repo_name} 的标签信息...")
        logger.debug(f"完整镜像路径: {registry}/{owner}/{repo_name}")
        logger.debug(f"原始源: {source}")
        logger.debug(f"目标版本: {version}")
        tags = ghcr_api.get_repository_tags(owner, repo_name)
        
        if tags:
            logger.debug(f"找到 {len(tags)} 个标签: {[tag['name'] for tag in tags]}")
            # 找到匹配的标签
            matching_tag = None
            for tag in tags:
                if tag['name'] == version:
                    matching_tag = tag
                    break
            
            if matching_tag:
                images.append({
                    'name': image_name,
                    'source': source,
                    'target': f"{registry}/{owner}/{repo_name}:{version}",
                    'version': version,
                    'description': description,
                    'repository': repo_name,
                    'digest': matching_tag.get('digest', ''),
                    'created_at': matching_tag.get('created_at'),
                    'synced_at': matching_tag.get('created_at')  # 使用创建时间作为同步时间
                })
                print(f"   ✅ 找到标签 {version}")
            else:
                print(f"   ⚠️  未找到标签 {version} (可用标签: {', '.join([tag['name'] for tag in tags[:5]])}{'...' if len(tags) > 5 else ''})")
        else:
            print(f"   ⚠️  未找到任何标签")
            logger.warning(f"仓库 {owner}/{repo_name} 可能不存在或需要认证")
    
    # 生成输出数据
    output_data = {
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'registry': registry,
        'owner': owner,
        'total_count': len(images),
        'success_count': len(images),  # 所有成功获取的镜像
        'fail_count': 0,  # 这里没有失败的情况，因为只是获取信息
        'images': images
    }
    
    # 保存到文件
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ 已生成 {output_file}")
    print(f"📊 总计: {len(images)} 个镜像")
    
    return output_data


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='从 GHCR 生成镜像列表 JSON')
    parser.add_argument('--owner',
                       type=str,
                       required=True,
                       help='GitHub 仓库所有者')
    parser.add_argument('--registry',
                       type=str,
                       default='ghcr.io',
                       help='镜像仓库地址 (默认: ghcr.io)')
    parser.add_argument('--manifest',
                       type=Path,
                       default=project_root / 'images-manifest.yml',
                       help='清单文件路径')
    parser.add_argument('--output',
                       type=Path,
                       default=project_root / 'images.json',
                       help='输出文件路径')
    parser.add_argument('--token',
                       type=str,
                       help='GitHub Personal Access Token (可选)')
    parser.add_argument('-D', '--debug',
                       action='store_true',
                       help='启用调试模式')
    
    args = parser.parse_args()
    
    logger = setup_logger('generate', args.debug, project_root / 'logs')
    
    try:
        generate_images_json(
            args.manifest,
            args.output,
            args.registry,
            args.owner,
            args.token,
            logger
        )
        sys.exit(0)
    except Exception as e:
        logger.error(f"生成镜像列表失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
