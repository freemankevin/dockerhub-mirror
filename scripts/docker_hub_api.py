#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Docker Hub API 客户端
处理与 Docker Hub 的所有交互
"""

import re
import requests
from typing import Optional, Tuple, List
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading


class DockerHubAPI:
    """Docker Hub API 客户端"""
    
    def __init__(self, logger=None, max_workers: int = 5):
        self.base_url = "https://registry.hub.docker.com/v2"
        self.session = self._create_session()
        self.logger = logger
        self.max_workers = max_workers
        self._lock = threading.Lock()
    
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
            
            # 补齐到 3 位
            while len(parts) < 3:
                parts.append(0)
            
            return tuple(parts[:3])
        except Exception as e:
            if self.logger:
                self.logger.debug(f"版本号解析出错 {version_str}: {str(e)}")
            return (0, 0, 0)
    
    def get_all_matching_versions(
        self, 
        repository: str, 
        tag_pattern: str,
        exclude_pattern: Optional[str] = None,
        max_pages: int = 5
    ) -> List[str]:
        """获取符合模式的所有版本"""
        try:
            matching_tags = []
            page = 1

            while page <= max_pages:
                url = f"{self.base_url}/repositories/{repository}/tags"
                params = {
                    'page_size': 100,
                    'page': page,
                    'ordering': 'last_updated'
                }

                if self.logger:
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
                if self.logger:
                    self.logger.warning(f"未找到符合模式的标签: {repository}")
                return []

            # 去重并排序
            matching_tags = list(set(matching_tags))
            matching_tags.sort(key=self.version_key)

            if self.logger:
                self.logger.debug(f"找到 {len(matching_tags)} 个匹配标签")
            
            return matching_tags

        except requests.RequestException as e:
            if self.logger:
                self.logger.error(f"获取版本信息失败 {repository}: {str(e)}")
            return []
        except Exception as e:
            if self.logger:
                self.logger.error(f"未知错误 {repository}: {str(e)}")
            return []

    def get_latest_version(
        self, 
        repository: str, 
        tag_pattern: str,
        exclude_pattern: Optional[str] = None
    ) -> Optional[str]:
        """获取符合模式的最新版本"""
        matching_tags = self.get_all_matching_versions(
            repository, tag_pattern, exclude_pattern
        )

        if not matching_tags:
            return None

        latest = matching_tags[-1]
        if self.logger:
            self.logger.debug(f"找到 {len(matching_tags)} 个匹配标签，最新: {latest}")
        return latest
    
    def get_latest_versions_batch(
        self,
        repositories: List[Tuple[str, str, Optional[str]]],
        max_workers: Optional[int] = None
    ) -> List[Tuple[str, Optional[str]]]:
        """并发获取多个镜像的最新版本
        
        Args:
            repositories: 镜像列表，每个元素为 (repository, tag_pattern, exclude_pattern)
            max_workers: 最大并发数，默认使用实例的 max_workers
            
        Returns:
            返回列表，每个元素为 (repository, latest_version)
        """
        if max_workers is None:
            max_workers = self.max_workers
        
        results = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务
            future_to_repo = {
                executor.submit(
                    self.get_latest_version, 
                    repo, 
                    pattern, 
                    exclude
                ): repo 
                for repo, pattern, exclude in repositories
            }
            
            # 收集结果
            for future in as_completed(future_to_repo):
                repo = future_to_repo[future]
                try:
                    latest_version = future.result()
                    results.append((repo, latest_version))
                except Exception as e:
                    if self.logger:
                        self.logger.error(f"获取 {repo} 最新版本失败: {str(e)}")
                    results.append((repo, None))
        
        return results