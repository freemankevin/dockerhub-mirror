#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通用工具函数
"""

import logging
from pathlib import Path
from datetime import datetime

# ANSI 颜色代码
COLOR_GREEN = "\033[92m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_BLUE = "\033[94m"
COLOR_CYAN = "\033[96m"
COLOR_RESET = "\033[0m"


def setup_logger(name: str, debug: bool = False, log_dir: Path = None) -> logging.Logger:
    """设置日志记录器"""
    logger = logging.getLogger(name)
    logger.handlers.clear()
    
    level = logging.DEBUG if debug else logging.INFO
    logger.setLevel(level)
    
    # 控制台处理器（带颜色）
    formatter = logging.Formatter(
        f'{COLOR_CYAN}%(asctime)s{COLOR_RESET} - '
        f'{COLOR_YELLOW}%(levelname)s{COLOR_RESET} - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 文件处理器（无颜色）
    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"{name}_{datetime.now().strftime('%Y%m%d')}.log"
        
        file_formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    logger.propagate = False
    return logger