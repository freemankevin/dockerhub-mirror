#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
镜像同步工具
处理 Docker 镜像的实际同步操作
"""

import json
import subprocess
import sys
import time
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading


class MirrorSync:
    """镜像同步管理器"""

    def __init__(self, registry: str, owner: str, logger=None, max_workers: int = 3,
                 max_retries: int = 3, retry_delay: float = 2.0):
        self.registry = registry
        self.owner = owner
        self.logger = logger
        self.max_workers = max_workers
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.mirrored_images = []
        self.success_count = 0
        self.fail_count = 0
        self._lock = threading.Lock()
    
    def _get_image_digest(self, image: str) -> Optional[str]:
        """获取镜像的 digest
        
        Args:
            image: 镜像名称
            
        Returns:
            镜像的 digest，如果获取失败返回 None
        """
        try:
            cmd = ['regctl', 'image', 'digest', image]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                digest = result.stdout.strip()
                if self.logger:
                    self.logger.debug(f"镜像 {image} 的 digest: {digest}")
                return digest
            else:
                # 镜像不存在
                if self.logger:
                    self.logger.debug(f"镜像 {image} 不存在或无法获取 digest")
                return None
        except Exception as e:
            if self.logger:
                self.logger.debug(f"获取镜像 digest 失败 {image}: {str(e)}")
            return None
    
    def _is_ghcr_source(self, source: str) -> bool:
        """检查源镜像是否来自 GitHub Container Registry
        
        Args:
            source: 源镜像地址
            
        Returns:
            True 表示源镜像来自 GHCR，False 表示来自其他仓库
        """
        return source.startswith('ghcr.io/')

    def needs_sync(self, source: str, target: str) -> bool:
        """检查镜像是否需要同步
        
        Args:
            source: 源镜像
            target: 目标镜像
            
        Returns:
            True 表示需要同步，False 表示可以跳过
        """
        # 获取源镜像的 digest
        source_digest = self._get_image_digest(source)
        if not source_digest:
            if self.logger:
                self.logger.warning(f"无法获取源镜像 {source} 的 digest，将强制同步")
            return True
        
        # 获取目标镜像的 digest
        target_digest = self._get_image_digest(target)
        if not target_digest:
            # 目标镜像不存在，需要同步
            if self.logger:
                self.logger.debug(f"目标镜像 {target} 不存在，需要同步")
            return True
        
        # 比较 digest
        if source_digest == target_digest:
            if self.logger:
                self.logger.info(f"镜像 {source} 与目标 {target} 的 digest 相同，跳过同步")
            return False
        else:
            if self.logger:
                self.logger.debug(f"镜像 {source} 与目标 {target} 的 digest 不同，需要同步")
            return True

    def mirror_image(self, source: str, target: str) -> bool:
        """镜像同步（带重试机制）"""
        # 先检查是否需要同步
        if not self.needs_sync(source, target):
            return True  # 跳过同步，视为成功
        
        for attempt in range(self.max_retries):
            try:
                # 添加随机延迟，避免同时发送请求
                if attempt > 0:
                    delay = self.retry_delay * (2 ** (attempt - 1)) + random.uniform(0, 1)
                    if self.logger:
                        self.logger.info(f"第 {attempt + 1} 次重试，等待 {delay:.2f} 秒...")
                    time.sleep(delay)

                cmd = [
                    'regctl', 'image', 'copy',
                    '--verbosity', 'info',
                    '--digest-tags',
                    '--include-external',
                    '--referrers',
                    source, target
                ]

                if self.logger:
                    self.logger.debug(f"执行命令: {' '.join(cmd)}")

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300
                )

                if result.returncode == 0:
                    return True
                else:
                    # 检查是否是速率限制错误
                    if 'rate limit exceeded' in result.stderr.lower() or 'TOOMANYREQUESTS' in result.stderr:
                        if attempt < self.max_retries - 1:
                            if self.logger:
                                self.logger.warning(f"遇到速率限制，将重试... ({attempt + 1}/{self.max_retries})")
                            continue
                        else:
                            if self.logger:
                                self.logger.error(f"同步失败（速率限制）: {result.stderr}")
                            return False
                    else:
                        if self.logger:
                            self.logger.error(f"同步失败: {result.stderr}")
                        return False

            except subprocess.TimeoutExpired:
                if self.logger:
                    self.logger.error(f"同步超时: {source}")
                if attempt < self.max_retries - 1:
                    continue
                return False
            except Exception as e:
                if self.logger:
                    self.logger.error(f"镜像同步异常: {str(e)}")
                if attempt < self.max_retries - 1:
                    continue
                return False

        return False
    
    def sync_single_version(
        self, 
        image_name: str, 
        version: str,
        description: str = ''
    ) -> bool:
        """同步单个版本"""
        source_image = f"{image_name}:{version}"
        repo_name = image_name.replace('/', '__')
        target_image = f"{self.registry}/{self.owner}/{repo_name}:{version}"
        
        print(f"\n🔄 Processing {source_image}...")
        print(f"📦 Source: {source_image}")
        print(f"🎯 Target: {target_image}")
        
        # 检查源镜像是否来自 GHCR
        if self._is_ghcr_source(source_image):
            print(f"ℹ️  源镜像来自 GHCR，跳过同步步骤")
            # 直接添加到镜像列表，不执行同步
            with self._lock:
                self.mirrored_images.append({
                    'name': image_name,
                    'source': source_image,
                    'target': source_image,  # GHCR 镜像本身就是目标
                    'version': version,
                    'description': description,
                    'repository': repo_name,
                    'synced_at': datetime.now(timezone.utc).isoformat()
                })
                self.success_count += 1
            return True
        
        if self.mirror_image(source_image, target_image):
            print(f"✅ Successfully mirrored {source_image}")
            
            # 线程安全地更新结果
            with self._lock:
                self.mirrored_images.append({
                    'name': image_name,
                    'source': source_image,
                    'target': target_image,
                    'version': version,
                    'description': description,
                    'repository': repo_name,
                    'synced_at': datetime.now(timezone.utc).isoformat()
                })
                self.success_count += 1
            return True
        else:
            print(f"❌ Failed to mirror {source_image}")
            
            # 线程安全地更新失败计数
            with self._lock:
                self.fail_count += 1
            return False
    
    def sync_from_manifest(
        self,
        manifest: Dict,
        api,
        output_file: Optional[Path] = None,
        use_concurrency: bool = True
    ) -> Dict:
        """从清单同步所有镜像

        Args:
            manifest: 镜像清单
            api: DockerHubAPI 实例
            output_file: 输出文件路径
            use_concurrency: 是否使用并发同步

        Returns:
            同步结果字典
        """
        # 收集所有需要同步的任务
        sync_tasks = []

        for img in manifest.get('images', []):
            if not img.get('enabled', True):
                continue

            source = img['source']
            description = img.get('description', '')
            tag_pattern = img.get('tag_pattern')
            exclude_pattern = img.get('exclude_pattern')
            sync_all = img.get('sync_all_matching', False)

            # 提取镜像名
            image_name = source.split(':')[0]

            # 确定要同步的版本列表
            versions_to_sync = []

            if sync_all:
                # 获取所有匹配的版本
                print(f"\n🔍 Fetching all matching versions for {image_name}...")
                all_versions = api.get_all_matching_versions(
                    image_name, tag_pattern, exclude_pattern
                )

                if all_versions:
                    versions_to_sync = all_versions
                    print(f"📋 Found {len(versions_to_sync)} versions to sync")
                else:
                    print(f"⚠️  No matching versions found for {image_name}")
                    continue
            else:
                # 只同步当前版本
                current_version = source.split(':')[1] if ':' in source else 'latest'
                versions_to_sync = [current_version]

            # 添加到同步任务列表
            for version in versions_to_sync:
                sync_tasks.append({
                    'image_name': image_name,
                    'version': version,
                    'description': description
                })

        # 执行同步
        if use_concurrency and sync_tasks:
            print(f"\n🚀 开始并发同步 {len(sync_tasks)} 个镜像...")
            print(f"⚙️  并发数: {self.max_workers}, 最大重试次数: {self.max_retries}")

            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                # 提交所有同步任务，添加延迟避免同时发送请求
                future_to_task = {}
                for i, task in enumerate(sync_tasks):
                    # 添加随机延迟，避免同时发送请求
                    if i > 0:
                        delay = random.uniform(0.5, 1.5)
                        if self.logger:
                            self.logger.debug(f"等待 {delay:.2f} 秒后提交下一个任务...")
                        time.sleep(delay)

                    future = executor.submit(
                        self.sync_single_version,
                        task['image_name'],
                        task['version'],
                        task['description']
                    )
                    future_to_task[future] = task

                # 等待所有任务完成
                for future in as_completed(future_to_task):
                    task = future_to_task[future]
                    try:
                        future.result()
                    except Exception as e:
                        if self.logger:
                            self.logger.error(
                                f"同步 {task['image_name']}:{task['version']} 异常: {str(e)}"
                            )
                        with self._lock:
                            self.fail_count += 1
        else:
            # 串行同步
            for task in sync_tasks:
                self.sync_single_version(
                    task['image_name'],
                    task['version'],
                    task['description']
                )

        # 打印统计
        print(f"\n📊 Summary:")
        print(f"   Total: {len(self.mirrored_images)}")
        print(f"   Success: {self.success_count}")
        print(f"   Failed: {self.fail_count}")

        # 返回简单的统计结果
        return {
            'success_count': self.success_count,
            'fail_count': self.fail_count
        }