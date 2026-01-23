#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GitHub Container Registry API 客户端
处理与 GitHub Container Registry 的所有交互
"""

import requests
from typing import Optional, List, Dict
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from datetime import datetime, timezone


class GHCRRegistryAPI:
    """GitHub Container Registry API 客户端"""
    
    def __init__(self, logger=None, token: Optional[str] = None):
        """初始化 GHCR API 客户端
        
        Args:
            logger: 日志记录器
            token: GitHub Personal Access Token (可选，用于私有仓库)
        """
        self.base_url = "https://ghcr.io/v2"
        self.session = self._create_session()
        self.logger = logger
        self.token = token
        
        # 如果提供了 token，添加到 session headers
        if token:
            self.session.headers.update({
                'Authorization': f'Bearer {token}'
            })
    
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
    
    def get_repository_tags(self, owner: str, repository: str) -> List[Dict]:
        """获取仓库中的所有标签
        
        Args:
            owner: 仓库所有者
            repository: 仓库名称
            
        Returns:
            标签列表，每个标签包含 name、digest、created 等信息
        """
        try:
            # 获取标签列表
            url = f"{self.base_url}/{owner}/{repository}/tags/list"
            
            if self.logger:
                self.logger.debug(f"获取 {owner}/{repository} 的标签列表")
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            tags = data.get('tags', [])
            
            # 获取每个标签的详细信息
            tag_details = []
            for tag in tags:
                try:
                    # 获取标签的 manifest
                    manifest_url = f"{self.base_url}/{owner}/{repository}/manifests/{tag}"
                    manifest_response = self.session.get(
                        manifest_url,
                        headers={'Accept': 'application/vnd.docker.distribution.manifest.v2+json'},
                        timeout=30
                    )
                    manifest_response.raise_for_status()
                    manifest = manifest_response.json()
                    
                    # 获取 digest
                    digest = manifest.get('config', {}).get('digest', '')
                    
                    # 获取创建时间（从 config 的 history 中）
                    created_at = None
                    config_url = f"{self.base_url}/{owner}/{repository}/blobs/{digest}"
                    try:
                        config_response = self.session.get(config_url, timeout=30)
                        config_response.raise_for_status()
                        config = config_response.json()
                        history = config.get('history', [])
                        if history:
                            created_str = history[0].get('created', '')
                            if created_str:
                                try:
                                    created_at = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                                except:
                                    pass
                    except Exception as e:
                        if self.logger:
                            self.logger.debug(f"获取标签 {tag} 的配置失败: {str(e)}")
                    
                    tag_details.append({
                        'name': tag,
                        'digest': digest,
                        'created_at': created_at.isoformat() if created_at else None
                    })
                    
                except Exception as e:
                    if self.logger:
                        self.logger.debug(f"获取标签 {tag} 的详细信息失败: {str(e)}")
                    # 即使获取详细信息失败，也添加基本信息
                    tag_details.append({
                        'name': tag,
                        'digest': '',
                        'created_at': None
                    })
            
            if self.logger:
                self.logger.debug(f"找到 {len(tag_details)} 个标签")
            
            return tag_details
        
        except requests.RequestException as e:
            if self.logger:
                self.logger.error(f"获取标签列表失败 {owner}/{repository}: {str(e)}")
            return []
        except Exception as e:
            if self.logger:
                self.logger.error(f"未知错误 {owner}/{repository}: {str(e)}")
            return []
    
    def get_all_repositories(self, owner: str) -> List[str]:
        """获取所有仓库列表
        
        Args:
            owner: 仓库所有者
            
        Returns:
            仓库名称列表
        """
        try:
            # 注意：GHCR 没有直接列出所有仓库的 API
            # 这里我们假设仓库命名遵循某种模式
            # 实际使用时，可能需要从其他地方获取仓库列表
            
            if self.logger:
                self.logger.warning(f"GHCR 没有直接列出所有仓库的 API，需要从其他地方获取仓库列表")
            
            return []
        
        except Exception as e:
            if self.logger:
                self.logger.error(f"获取仓库列表失败: {str(e)}")
            return []
    
    def get_image_info(self, owner: str, repository: str, tag: str) -> Optional[Dict]:
        """获取特定镜像的信息
        
        Args:
            owner: 仓库所有者
            repository: 仓库名称
            tag: 标签名称
            
        Returns:
            镜像信息字典
        """
        try:
            # 获取 manifest
            url = f"{self.base_url}/{owner}/{repository}/manifests/{tag}"
            response = self.session.get(
                url,
                headers={'Accept': 'application/vnd.docker.distribution.manifest.v2+json'},
                timeout=30
            )
            response.raise_for_status()
            manifest = response.json()
            
            # 获取 digest
            digest = manifest.get('config', {}).get('digest', '')
            
            # 获取创建时间
            created_at = None
            if digest:
                config_url = f"{self.base_url}/{owner}/{repository}/blobs/{digest}"
                try:
                    config_response = self.session.get(config_url, timeout=30)
                    config_response.raise_for_status()
                    config = config_response.json()
                    history = config.get('history', [])
                    if history:
                        created_str = history[0].get('created', '')
                        if created_str:
                            try:
                                created_at = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                            except:
                                pass
                except Exception as e:
                    if self.logger:
                        self.logger.debug(f"获取镜像配置失败: {str(e)}")
            
            return {
                'name': f"{owner}/{repository}:{tag}",
                'digest': digest,
                'created_at': created_at.isoformat() if created_at else None
            }
        
        except requests.RequestException as e:
            if self.logger:
                self.logger.error(f"获取镜像信息失败 {owner}/{repository}:{tag}: {str(e)}")
            return None
        except Exception as e:
            if self.logger:
                self.logger.error(f"未知错误 {owner}/{repository}:{tag}: {str(e)}")
            return None
