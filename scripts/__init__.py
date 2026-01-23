#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Docker 镜像同步工具包
"""

from .docker_hub_api import DockerHubAPI
from .manifest_manager import ManifestManager
from .mirror_sync import MirrorSync
from .utils import (
    setup_logger,
    COLOR_GREEN,
    COLOR_RED,
    COLOR_YELLOW,
    COLOR_BLUE,
    COLOR_CYAN,
    COLOR_RESET
)

__version__ = '2.0.0'

__all__ = [
    'DockerHubAPI',
    'ManifestManager',
    'MirrorSync',
    'setup_logger',
    'COLOR_GREEN',
    'COLOR_RED',
    'COLOR_YELLOW',
    'COLOR_BLUE',
    'COLOR_CYAN',
    'COLOR_RESET',
]