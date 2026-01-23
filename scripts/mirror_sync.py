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
    
    def mirror_image(self, source: str, target: str) -> bool:
        """镜像同步（带重试机制）"""
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

        # 生成镜像清单 JSON
        output_data = {
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'registry': self.registry,
            'owner': self.owner,
            'total_count': len(self.mirrored_images),
            'success_count': self.success_count,
            'fail_count': self.fail_count,
            'images': self.mirrored_images
        }

        # 保存到文件
        if output_file:
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"\n✅ Generated {output_file}")

        # 打印统计
        print(f"\n📊 Summary:")
        print(f"   Total: {len(self.mirrored_images)}")
        print(f"   Success: {self.success_count}")
        print(f"   Failed: {self.fail_count}")

        return output_data