#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
镜像清单管理器
负责加载、更新和保存镜像清单文件
"""

import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional


class ManifestManager:
    """镜像清单管理器"""
    
    def __init__(self, manifest_file: Path, logger=None):
        """初始化清单管理器
        
        Args:
            manifest_file: 清单文件路径
            logger: 日志记录器
        """
        self.manifest_file = manifest_file
        self.logger = logger
        self.manifest = None
        self._load_manifest()
    
    def _load_manifest(self) -> None:
        """加载清单文件"""
        try:
            with open(self.manifest_file, 'r', encoding='utf-8') as f:
                self.manifest = yaml.safe_load(f)
            
            if self.logger:
                self.logger.debug(f"已加载清单文件: {self.manifest_file}")
        except FileNotFoundError:
            if self.logger:
                self.logger.error(f"清单文件不存在: {self.manifest_file}")
            raise
        except yaml.YAMLError as e:
            if self.logger:
                self.logger.error(f"清单文件格式错误: {str(e)}")
            raise
    
    def _save_manifest(self) -> None:
        """保存清单文件"""
        try:
            # 更新最后检查时间
            if 'config' not in self.manifest:
                self.manifest['config'] = {}
            self.manifest['config']['last_checked'] = datetime.now(timezone.utc).isoformat()
            
            with open(self.manifest_file, 'w', encoding='utf-8') as f:
                yaml.dump(self.manifest, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
            
            if self.logger:
                self.logger.debug(f"已保存清单文件: {self.manifest_file}")
        except Exception as e:
            if self.logger:
                self.logger.error(f"保存清单文件失败: {str(e)}")
            raise
    
    def update_versions(self, api, dry_run: bool = False) -> int:
        """更新镜像版本
        
        Args:
            api: DockerHubAPI 实例
            dry_run: 预演模式，不修改文件
            
        Returns:
            更新的镜像数量
        """
        updated_count = 0
        
        for img in self.manifest.get('images', []):
            if not img.get('enabled', True):
                continue
            
            source = img['source']
            tag_pattern = img.get('tag_pattern')
            exclude_pattern = img.get('exclude_pattern')
            
            # 提取镜像名和当前版本
            if ':' in source:
                image_name, current_version = source.rsplit(':', 1)
            else:
                image_name = source
                current_version = 'latest'
            
            # 获取最新版本
            if tag_pattern:
                latest_version = api.get_latest_version(image_name, tag_pattern, exclude_pattern)
            else:
                latest_version = None
            
            if latest_version and latest_version != current_version:
                # 有新版本
                print(f"\n📦 {image_name}")
                print(f"   当前版本: {current_version}")
                print(f"   最新版本: {latest_version}")
                
                if not dry_run:
                    # 更新版本
                    img['source'] = f"{image_name}:{latest_version}"
                    updated_count += 1
                    print(f"   ✅ 已更新")
                else:
                    print(f"   ℹ️  预演模式：将更新")
                    updated_count += 1
        
        # 保存清单（如果不是预演模式）
        if updated_count > 0 and not dry_run:
            self._save_manifest()
        
        return updated_count
    
    def get_manifest(self) -> Dict:
        """获取清单数据"""
        return self.manifest
