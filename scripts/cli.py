#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
命令行接口
"""

import argparse
import yaml
from pathlib import Path

from .docker_hub_api import DockerHubAPI
from .manifest_manager import ManifestManager
from .mirror_sync import MirrorSync
from .utils import setup_logger, COLOR_GREEN, COLOR_YELLOW, COLOR_BLUE, COLOR_RED, COLOR_CYAN, COLOR_RESET

# ==================== 配置 ====================

PROJECT_ROOT = Path(__file__).parent.parent
MANIFEST_FILE = PROJECT_ROOT / "images-manifest.yml"
OUTPUT_FILE = PROJECT_ROOT / "images.json"  # ✅ 修改：移到根目录
LOGS_DIR = PROJECT_ROOT / "logs"


# ==================== 子命令处理函数 ====================

def cmd_update(args):
    """更新清单版本"""
    logger = setup_logger('update', args.debug, LOGS_DIR)
    
    print(f"\n{COLOR_BLUE}{'='*80}{COLOR_RESET}")
    print(f"{COLOR_GREEN}📄 更新镜像清单{COLOR_RESET}")
    print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}\n")
    
    manifest_file = args.manifest or MANIFEST_FILE
    
    if not manifest_file.exists():
        logger.error(f"清单文件不存在: {manifest_file}")
        return 1
    
    # 初始化 API 和管理器
    max_workers = getattr(args, 'max_workers', 5)
    api = DockerHubAPI(logger, max_workers=max_workers)
    manager = ManifestManager(manifest_file, logger)
    
    # 更新版本
    use_concurrency = getattr(args, 'concurrency', True)
    updated_count = manager.update_versions(api, dry_run=args.dry_run, use_concurrency=use_concurrency)
    
    if updated_count > 0 and not args.dry_run:
        print(f"\n{COLOR_GREEN}✓ 成功更新 {updated_count} 个镜像版本{COLOR_RESET}\n")
    elif updated_count > 0 and args.dry_run:
        print(f"\n{COLOR_YELLOW}ℹ️  预演模式：发现 {updated_count} 个可更新镜像{COLOR_RESET}\n")
    else:
        print(f"\n{COLOR_GREEN}✓ 所有镜像都是最新版本{COLOR_RESET}\n")
    
    return 0


def cmd_sync(args):
    """同步镜像"""
    logger = setup_logger('sync', args.debug, LOGS_DIR)

    print(f"\n{COLOR_BLUE}{'='*80}{COLOR_RESET}")
    print(f"{COLOR_GREEN}🚀 同步镜像到远程仓库{COLOR_RESET}")
    print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}")
    print(f"📍 目标仓库: {args.registry}/{args.owner}")
    print(f"📄 清单文件: {args.manifest or MANIFEST_FILE}")
    print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}\n")

    manifest_file = args.manifest or MANIFEST_FILE

    if not manifest_file.exists():
        logger.error(f"清单文件不存在: {manifest_file}")
        return 1

    # 加载清单
    with open(manifest_file, 'r', encoding='utf-8') as f:
        manifest = yaml.safe_load(f)

    # 初始化 API 和同步器
    max_workers = getattr(args, 'max_workers', 3)
    max_retries = getattr(args, 'max_retries', 3)
    retry_delay = getattr(args, 'retry_delay', 2.0)

    api = DockerHubAPI(logger, max_workers=max_workers)
    sync = MirrorSync(
        args.registry,
        args.owner,
        logger,
        max_workers=max_workers,
        max_retries=max_retries,
        retry_delay=retry_delay
    )

    # 执行同步
    use_concurrency = getattr(args, 'concurrency', True)
    result = sync.sync_from_manifest(manifest, api, use_concurrency=use_concurrency)

    # 输出结果
    if result['success_count'] > 0:
        print(f"\n{COLOR_GREEN}✓ 成功同步 {result['success_count']} 个镜像{COLOR_RESET}")

    if result['fail_count'] > 0:
        print(f"{COLOR_RED}✗ {result['fail_count']} 个镜像同步失败{COLOR_RESET}")

    # 同步成功后，生成 images.json
    if result['fail_count'] == 0 or args.continue_on_error:
        print(f"\n{COLOR_CYAN}📝 生成镜像列表 JSON...{COLOR_RESET}")
        try:
            from scripts.generate_images_json import generate_images_json
            
            output_file = args.output or OUTPUT_FILE
            generate_images_json(
                manifest_file,
                output_file,
                args.registry,
                args.owner,
                token=None,  # 可以从环境变量获取
                logger=logger
            )
        except Exception as e:
            logger.error(f"生成镜像列表失败: {str(e)}")
            if not args.continue_on_error:
                return 1

    print()
    return 0 if result['fail_count'] == 0 else 1


def cmd_run(args):
    """运行完整流程：更新 + 同步"""
    logger = setup_logger('run', args.debug, LOGS_DIR)

    print(f"\n{COLOR_BLUE}{'='*80}{COLOR_RESET}")
    print(f"{COLOR_GREEN}🔄 运行完整同步流程{COLOR_RESET}")
    print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}\n")

    # 步骤 1: 更新清单
    print(f"{COLOR_CYAN}步骤 1/2: 更新镜像清单{COLOR_RESET}\n")
    ret = cmd_update(args)
    if ret != 0 and not args.continue_on_error:
        return ret

    # 为同步步骤设置不同的参数
    original_max_workers = getattr(args, 'max_workers', None)
    original_max_retries = getattr(args, 'max_retries', None)
    original_retry_delay = getattr(args, 'retry_delay', None)

    if hasattr(args, 'max_workers_sync'):
        args.max_workers = args.max_workers_sync

    # 如果没有单独设置重试参数，使用默认值
    if not hasattr(args, 'max_retries') or args.max_retries is None:
        args.max_retries = 3
    if not hasattr(args, 'retry_delay') or args.retry_delay is None:
        args.retry_delay = 2.0

    print(f"\n{COLOR_CYAN}步骤 2/2: 同步镜像{COLOR_RESET}\n")
    ret = cmd_sync(args)

    # 恢复原始参数
    if original_max_workers is not None:
        args.max_workers = original_max_workers
    if original_max_retries is not None:
        args.max_retries = original_max_retries
    if original_retry_delay is not None:
        args.retry_delay = original_retry_delay

    print(f"\n{COLOR_BLUE}{'='*80}{COLOR_RESET}")
    print(f"{COLOR_GREEN}✅ 完整流程执行完成{COLOR_RESET}")
    print(f"{COLOR_BLUE}{'='*80}{COLOR_RESET}\n")

    return ret


# ==================== 主函数 ====================

def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description='Docker 镜像同步工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 更新清单
  python main.py update
  python main.py update --dry-run
  python main.py update -D
  python main.py update --max-workers 10

  # 同步镜像
  python main.py sync --owner username
  python main.py sync --owner username --registry ghcr.io
  python main.py sync --owner username --max-workers 5
  python main.py sync --owner username --max-workers 2 --max-retries 5 --retry-delay 3

  # 完整流程（更新+同步）
  python main.py run --owner username
  python main.py run --owner username --continue-on-error
  python main.py run --owner username --max-workers 10 --max-workers-sync 2 --max-retries 5 --retry-delay 3

  # 使用自定义清单
  python main.py update --manifest custom.yml

  # 禁用并发处理
  python main.py update --no-concurrency
  python main.py sync --owner username --no-concurrency

注意:
  - Docker Hub 对匿名用户有严格的速率限制（100次拉取/6小时）
  - 建议降低并发数（--max-workers 2-3）并增加重试次数（--max-retries 5）
  - 使用 --retry-delay 参数控制重试之间的延迟时间
        """
    )
    
    # 全局参数
    parser.add_argument('-D', '--debug',
                       action='store_true',
                       help='启用调试模式')
    parser.add_argument('--manifest',
                       type=Path,
                       help=f'清单文件路径 (默认: {MANIFEST_FILE})')
    
    # 子命令
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # update 命令
    parser_update = subparsers.add_parser('update', help='更新镜像清单')
    parser_update.add_argument('--dry-run',
                              action='store_true',
                              help='预演模式，不修改文件')
    parser_update.add_argument('--max-workers',
                              type=int,
                              default=5,
                              help='最大并发数 (默认: 5)')
    parser_update.add_argument('--no-concurrency',
                              action='store_true',
                              help='禁用并发处理')
    parser_update.set_defaults(func=cmd_update)
    
    # sync 命令
    parser_sync = subparsers.add_parser('sync', help='同步镜像')
    parser_sync.add_argument('--owner',
                            type=str,
                            required=True,
                            help='目标仓库所有者')
    parser_sync.add_argument('--registry',
                            type=str,
                            default='ghcr.io',
                            help='目标镜像仓库 (默认: ghcr.io)')
    parser_sync.add_argument('--output',
                            type=Path,
                            help=f'输出 JSON 文件路径 (默认: {OUTPUT_FILE})')
    parser_sync.add_argument('--max-workers',
                            type=int,
                            default=3,
                            help='最大并发数 (默认: 3)')
    parser_sync.add_argument('--max-retries',
                            type=int,
                            default=3,
                            help='最大重试次数 (默认: 3)')
    parser_sync.add_argument('--retry-delay',
                            type=float,
                            default=2.0,
                            help='重试延迟（秒）(默认: 2.0)')
    parser_sync.add_argument('--no-concurrency',
                            action='store_true',
                            help='禁用并发处理')
    parser_sync.set_defaults(func=cmd_sync)
    
    # run 命令（完整流程）
    parser_run = subparsers.add_parser('run', help='运行完整流程（更新+同步）')
    parser_run.add_argument('--owner',
                           type=str,
                           required=True,
                           help='目标仓库所有者')
    parser_run.add_argument('--registry',
                           type=str,
                           default='ghcr.io',
                           help='目标镜像仓库 (默认: ghcr.io)')
    parser_run.add_argument('--output',
                           type=Path,
                           help=f'输出 JSON 文件路径 (默认: {OUTPUT_FILE})')
    parser_run.add_argument('--dry-run',
                           action='store_true',
                           help='预演模式（仅对更新清单有效）')
    parser_run.add_argument('--continue-on-error',
                           action='store_true',
                           help='即使更新失败也继续同步')
    parser_run.add_argument('--max-workers',
                           type=int,
                           default=5,
                           help='更新清单的最大并发数 (默认: 5)')
    parser_run.add_argument('--max-workers-sync',
                           type=int,
                           default=3,
                           help='同步镜像的最大并发数 (默认: 3)')
    parser_run.add_argument('--max-retries',
                           type=int,
                           default=3,
                           help='最大重试次数 (默认: 3)')
    parser_run.add_argument('--retry-delay',
                           type=float,
                           default=2.0,
                           help='重试延迟（秒）(默认: 2.0)')
    parser_run.add_argument('--no-concurrency',
                           action='store_true',
                           help='禁用并发处理')
    parser_run.set_defaults(func=cmd_run)
    
    # 解析参数
    args = parser.parse_args()
    
    # 如果没有指定子命令，显示帮助
    if not args.command:
        parser.print_help()
        return 0
    
    # 设置并发标志（如果子命令支持）
    if hasattr(args, 'no_concurrency'):
        args.concurrency = not args.no_concurrency
    
    # 执行对应的命令
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print(f"\n\n{COLOR_YELLOW}⚠️  用户中断{COLOR_RESET}")
        return 1
    except Exception as e:
        print(f"\n{COLOR_RED}✗ 错误: {str(e)}{COLOR_RESET}")
        import traceback
        if args.debug:
            traceback.print_exc()
        return 1