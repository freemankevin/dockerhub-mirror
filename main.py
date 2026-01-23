#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Docker 镜像同步工具 - 主入口
"""

import sys

# 设置标准输出编码为 UTF-8（解决 Windows 终端编码问题）
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

from scripts.cli import main

if __name__ == "__main__":
    sys.exit(main())