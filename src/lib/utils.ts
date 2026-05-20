import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '__');
}

export function formatSize(bytes: number | string | undefined): string {
  if (!bytes && bytes !== 0) return '';
  if (typeof bytes === 'string') return bytes;
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return bytes + ' B';
}

export function parseSize(str: string | number | undefined): number {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const s = String(str).trim().toLowerCase().replace(/,/g, '');
  const match = s.match(/^(\d+(?:\.\d+)?)\s*([kmgtp]?b?)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15,
    k: 1e3, m: 1e6, g: 1e9, t: 1e12, p: 1e15,
  };
  return val * (multipliers[unit] || 1);
}

export function formatRelativeTime(isoString: string | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return '< 1m ago';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

const DISPLAY_NAME_MAP: Record<string, string> = {
  mc: 'MinIO Client',
  'nacos-server': 'Nacos Server',
  geoserver: 'GeoServer',
  nginx: 'Nginx',
  redis: 'Redis',
  rabbitmq: 'RabbitMQ',
  elasticsearch: 'Elasticsearch',
  mariadb: 'MariaDB',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  python: 'Python',
  node: 'Node.js',
  java: 'Java',
  openjdk: 'OpenJDK',
  ubuntu: 'Ubuntu',
  debian: 'Debian',
  alpine: 'Alpine',
  centos: 'CentOS',
  golang: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
  minio: 'MinIO',
  etcd: 'etcd',
  amazoncorretto: 'Amazon Corretto',
  netkit: 'NetKit',
  'nexus-cleanup': 'Nexus Cleanup',
  'postgresql-postgis': 'PostgreSQL PostGIS',
  'nacos-backup': 'Nacos Backup',
  'postgresql-backup': 'PostgreSQL Backup',
};

export function getDisplayName(name: string): string {
  const rawName = name.split('/').pop() || name;
  return DISPLAY_NAME_MAP[rawName] || (rawName.charAt(0).toUpperCase() + rawName.slice(1));
}

const APP_ICONS: [RegExp, string, string, boolean?][] = [
  [/corretto|openjdk|^java$/, 'java.svg', 'Java'],
  [/elasticsearch/, 'elasticsearch.svg', 'Elasticsearch'],
  [/nacos-backup/, 'nacos.svg', 'Nacos Backup'],
  [/nacos/, 'nacos.svg', 'Nacos'],
  [/nginx/, 'nginx.svg', 'Nginx'],
  [/rabbitmq/, 'rabbitmq.svg', 'RabbitMQ'],
  [/redis/, 'redis.svg', 'Redis'],
  [/postgres|postgis/, 'postgresql.svg', 'PostgreSQL'],
  [/minio/, 'minio-bird.svg', 'MinIO'],
  [/etcd/, 'etcd.svg', 'etcd'],
  [/^python$/, 'python.svg', 'Python'],
  [/geoserver/, 'geoserver.svg', 'GeoServer'],
  [/harbor/, 'harbor.svg', 'Harbor'],
  [/nexus/, 'nexus.svg', 'Nexus'],
  [/netkit/, 'netkit.svg', 'Network', true],
  [/freemankevin/, 'freemankevin.svg', 'FreemanKevin'],
];

export function getAppIcon(name: string): { file: string; alt: string; invert?: boolean } | null {
  const lower = name.toLowerCase();
  for (const [pattern, file, alt, invert] of APP_ICONS) {
    if (pattern.test(lower)) {
      return { file, alt, invert };
    }
  }
  return null;
}

export function getSourceType(source: string, name: string): string {
  const src = (source || name || '').toLowerCase();
  if (src.startsWith('gcr.io/') || src.startsWith('us.gcr.io/') || src.startsWith('k8s.gcr.io/') || src.startsWith('registry.k8s.io/')) return 'google';
  if (src.startsWith('quay.io/') || src.includes('redhat')) return 'redhat';
  if (src.startsWith('ghcr.io/')) return 'github';
  if (src.startsWith('public.ecr.aws/')) return 'aws';
  return 'dockerhub';
}

export function buildPullCmd(img: { source?: string; name: string; currentVersion: string; versions: Array<{ version?: string; tag?: string; target?: string; source?: string; size?: string | number }> }): { path: string; ver: string } {
  const ver = img.currentVersion;
  const versionObj = img.versions.find((v: { version?: string; tag?: string }) => (v.version || v.tag || '') === ver);
  if (versionObj && versionObj.target) {
    const target = versionObj.target;
    const colonIdx = target.lastIndexOf(':');
    if (colonIdx > 0) {
      return { path: target.substring(0, colonIdx), ver: target.substring(colonIdx + 1) };
    }
  }

  const src = img.source || '';
  if (src.startsWith('ghcr.io/')) return { path: src, ver };

  let cleaned = src;
  const colonIdx = cleaned.lastIndexOf(':');
  if (colonIdx > 0) cleaned = cleaned.substring(0, colonIdx);
  cleaned = cleaned.replace(/^(docker\.io\/|gcr\.io\/|us\.gcr\.io\/|k8s\.gcr\.io\/|registry\.k8s\.io\/|quay\.io\/|public\.ecr\.aws\/)/, '');
  return { path: `ghcr.io/freemankevin/${cleaned}`, ver };
}

export const REGISTRY_MAP: Record<string, string> = {
  dockerhub: 'Docker Hub',
  github: 'GHCR',
  google: 'GCR',
  redhat: 'Quay',
  aws: 'AWS',
};

export const REGISTRY_COLORS: Record<string, string> = {
  dockerhub: 'from-blue-500 to-blue-600',
  github: 'from-gray-500 to-gray-600',
  google: 'from-green-500 to-green-600',
  redhat: 'from-red-500 to-red-600',
  aws: 'from-amber-500 to-amber-600',
};
