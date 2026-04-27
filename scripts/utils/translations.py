#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
镜像描述翻译工具
"""

# 常见镜像的预定义中文描述映射（高质量人工翻译）
IMAGE_DESCRIPTION_ZH = {
    'nginx': '官方构建的高性能 HTTP 和反向代理服务器',
    'elasticsearch': '分布式、RESTful 搜索和分析引擎',
    'redis': '高性能内存数据结构存储，用作数据库、缓存和消息代理',
    'postgres': '强大的开源对象关系数据库系统',
    'postgresql': '强大的开源对象关系数据库系统',
    'postgresql-postgis': 'PostgreSQL 数据库，包含 PostGIS 空间数据扩展',
    'postgresql-backup': 'PostgreSQL 数据库备份工具',
    'mysql': '世界上最流行的开源数据库',
    'mongodb': '面向文档的 NoSQL 数据库，提供高性能、高可用性和易扩展性',
    'rabbitmq': '开源消息代理软件，支持多种消息协议',
    'nacos-server': '动态服务发现、配置和服务管理平台',
    'node': '基于事件驱动的 JavaScript 运行环境',
    'python': '强大且易学的编程语言',
    'java': 'Java 编程语言运行环境',
    'golang': 'Go 编程语言编译器和运行环境',
    'rust': '注重安全和性能的系统编程语言',
    'ruby': '简单快捷的面向对象脚本语言',
    'php': '流行的通用脚本语言，特别适合 Web 开发',
    'perl': '强大的文本处理和脚本语言',
    'ubuntu': '流行的 Linux 操作系统发行版',
    'alpine': '轻量级 Linux 发行版，基于 musl libc 和 busybox',
    'debian': '稳定且安全的 Linux 操作系统',
    'centos': '企业级 Linux 发行版',
    'fedora': '前沿的 Linux 发行版',
    'busybox': '嵌入式系统的瑞士军刀，包含多个精简的 Unix 工具',
    'docker': '容器化应用的标准平台',
    'git': '分布式版本控制系统',
    'jenkins': '开源自动化服务器，用于持续集成和持续交付',
    'grafana': '开源分析和可视化平台',
    'prometheus': '系统监控和告警工具包',
    'traefik': '现代 HTTP 反向代理和负载均衡器',
    'caddy': '自动 HTTPS 的现代 Web 服务器',
    'haproxy': '可靠、高性能的 TCP/HTTP 负载均衡器',
    'vault': '用于管理秘密和保护敏感数据的工具',
    'consul': '服务发现和配置管理工具',
    'etcd': '分布式键值存储，用于共享配置和服务发现',
    'minio': '高性能对象存储服务器，兼容 Amazon S3 API',
    'kafka': '分布式流处理平台',
    'zookeeper': '分布式协调服务',
    'tomcat': 'Java Servlet 和 JavaServer Pages 技术的实现',
    'jetty': '轻量级 Java Web 服务器和 Servlet 容器',
    'wildfly': '灵活、轻量级、快速的应用服务器',
    'gradle': '强大的构建自动化工具',
    'maven': 'Java 项目管理和构建工具',
    'composer': 'PHP 依赖管理工具',
    'npm': 'Node.js 包管理器',
    'yarn': '快速、可靠、安全的依赖管理工具',
    'pip': 'Python 包安装器',
    'cassandra': '分布式宽列存储数据库',
    'couchbase': '高性能 NoSQL 文档数据库',
    'solr': '企业级搜索平台',
    'drupal': '开源内容管理系统',
    'wordpress': '开源博客和网站内容管理系统',
    'magento': '开源电商平台',
    'nextcloud': '开源文件共享和协作平台',
    'owncloud': '开源文件同步和分享服务',
    'mediawiki': '维基软件平台',
    'flask': '轻量级 Python Web 框架',
    'django': '高级 Python Web 框架',
    'express': '快速、开放、极简的 Node.js Web 框架',
    'react': '用于构建用户界面的 JavaScript 库',
    'vue': '渐进式 JavaScript 框架',
    'angular': '一个应用设计框架和开发平台',
    'spring': 'Java 企业级开发框架',
    'laravel': '优雅的 PHP Web 框架',
    'rails': 'Ruby Web 应用开发框架',
    'tensorflow': '端到端开源机器学习平台',
    'pytorch': '深度学习框架',
    'opencv': '开源计算机视觉和机器学习库',
    'ffmpeg': '完整的跨平台音视频处理解决方案',
    'imagemagick': '创建、编辑、合成或转换数字图像的软件套件',
    'blender': '专业的开源 3D 创作套件',
    'netkit': '容器化环境的网络诊断工具集（curl、wget、ping、nslookup、dig、telnet、nc、tcpdump）',
    'harbor-export': 'Harbor 镜像仓库指标导出器',
    'harbor-export-ui': 'Harbor 镜像仓库指标导出器 UI',
    'java-local': 'Java 开发环境，包含常用工具',
    'python-local': 'Python 开发环境，包含 PyTorch',
    'freemankevin': '个人 GitHub Pages 站点容器',
    'pause': 'Kubernetes 基础设施容器，用于保持 Pod 网络配置',
    'kube-apiserver': 'Kubernetes API 服务器',
    'kube-controller-manager': 'Kubernetes 控制器管理器',
    'kube-scheduler': 'Kubernetes 调度器',
    'kube-proxy': 'Kubernetes 网络代理',
    'coredns': '快速灵活的 DNS 服务器',
    'etcd-manager': 'etcd 集群管理工具',
    'ubi': 'Red Hat Universal Base Image',
    'amazoncorretto': 'Amazon Corretto JDK（Amazon Linux 2023）',
    'geoserver': '开源地理信息系统服务器',
    'postgis': 'PostgreSQL 的空间数据库扩展',
    'qgis': '开源地理信息系统',
    'mapserver': '开源地图发布平台',
    'gdal': '地理空间数据抽象库',
}

def translate_description(description: str, image_name: str = '') -> str:
    """
    翻译镜像描述为中文
    
    Args:
        description: 英文描述
        image_name: 镜像名称（用于查找预定义翻译）
        
    Returns:
        中文描述
    """
    if not description:
        return ''
    
    # 1. 尝试从预定义映射中查找
    # 先尝试完整镜像名
    if image_name in IMAGE_DESCRIPTION_ZH:
        return IMAGE_DESCRIPTION_ZH[image_name]
    
    # 尝试镜像名最后一部分（如 library/nginx -> nginx）
    if '/' in image_name:
        short_name = image_name.split('/')[-1]
        if short_name in IMAGE_DESCRIPTION_ZH:
            return IMAGE_DESCRIPTION_ZH[short_name]
    
    # 尝试 library/ 前缀镜像名
    if f'library/{image_name}' in IMAGE_DESCRIPTION_ZH:
        return IMAGE_DESCRIPTION_ZH[f'library/{image_name}']
    
    # 2. 如果没有预定义翻译，返回空字符串（前端会显示英文）
    # 不自动翻译以避免质量问题
    return ''


def add_chinese_description(image_data: dict) -> dict:
    """
    为镜像数据添加中文描述
    
    Args:
        image_data: 镜像数据字典
        
    Returns:
        添加了 description_zh 字段的镜像数据
    """
    description = image_data.get('description', '')
    image_name = image_data.get('name', '')
    
    description_zh = translate_description(description, image_name)
    
    if description_zh:
        image_data['description_zh'] = description_zh
    
    return image_data