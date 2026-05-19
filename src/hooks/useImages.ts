import { useState, useEffect, useMemo } from 'react';
import type { ImagesData, ImageRecord, FailedImage, RegistryFilter } from '@/types';
import { getDisplayName, getSourceType, buildPullCmd } from '@/lib/utils';

const NORMALIZE_RE = /[:_/\-]/g;

function buildSearchIndex(record: ImageRecord) {
  const { path } = buildPullCmd(record);
  const allTags = (record.versions || []).map(v => v.version || v.tag || '').filter(Boolean);
  const parts = [
    record.displayName,
    record.description,
    record.name,
    path,
    record.source,
    ...allTags,
  ].filter(Boolean).map(s => String(s).toLowerCase());
  const plain = parts.join(' ');
  return { plain, normalized: plain.replace(NORMALIZE_RE, '') };
}

export function useImages() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [failedImages, setFailedImages] = useState<FailedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<RegistryFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/images.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data: ImagesData = await res.json();
        processData(data);
        setLoading(false);
      } catch (e) {
        setError(true);
        setLoading(false);
        processData({ images: sampleData(), failed_images: [] });
      }
    }
    load();
  }, []);

  function processData(data: ImagesData) {
    const records = Array.isArray(data) ? data : (data.images || []);
    const failedRecords = data.failed_images || [];

    const processed: ImageRecord[] = [];
    for (const img of records) {
      const name = img.name || (img as Record<string, unknown>).image || '';
      if (!name) continue;

      const versions = img.versions || [];
      const v0 = versions[0] || {};
      const latestVer = img.latest_version || (img as Record<string, unknown>).version || v0.version || v0.tag || 'latest';
      const latestSrc = v0.source || img.source ||
        ((name.startsWith('ghcr.io/') || name.startsWith('gcr.io/') || name.startsWith('quay.io/')) ? name : '');
      const sourceType = getSourceType(latestSrc, name);

      const record: ImageRecord = {
        name,
        displayName: getDisplayName(name),
        description: img.description || '',
        source: latestSrc,
        sourceType,
        size: v0.size || img.size || '',
        currentVersion: latestVer,
        versions,
        syncStatus: img.sync_status || 'success',
        platforms: img.platforms || [],
        layers: v0.layers || img.layers || '',
        totalVersions: img.total_versions || versions.length,
        updated: img.updated || v0.synced_at || v0.created_at || '',
        stars: img.stars || 0,
        official: img.official || false,
      };
      (record as unknown as Record<string, unknown>).searchIndex = buildSearchIndex(record);
      processed.push(record);
    }

    const processedFailed: FailedImage[] = [];
    for (const img of failedRecords) {
      const name = img.name || '';
      if (!name) continue;
      const imgAny = img as unknown as Record<string, unknown>;
      processedFailed.push({
        name,
        displayName: getDisplayName(name),
        source: img.source || '',
        sourceType: getSourceType(img.source || '', name),
        version: String(imgAny.version || ''),
        syncStatus: 'failed',
        failedAt: String(imgAny.failed_at || ''),
      });
    }

    setImages(processed);
    setFailedImages(processedFailed);
  }

  const filtered = useMemo(() => {
    const matchesFilter = (img: ImageRecord | FailedImage) => filter === 'all' || img.sourceType === filter;

    if (!search) {
      return {
        images: filter === 'all' ? images : images.filter(matchesFilter),
        failed: filter === 'all' ? failedImages : failedImages.filter(matchesFilter),
      };
    }

    const q = search.toLowerCase();
    const normQ = q.replace(NORMALIZE_RE, '');
    const tokens = q.split(/\s+/).filter(Boolean);
    const isMulti = tokens.length > 1;

    const matchesSearch = (img: ImageRecord) => {
      const idx = (img as unknown as Record<string, { plain: string; normalized: string }>).searchIndex;
      if (idx.plain.includes(q)) return true;
      if (idx.normalized.includes(normQ)) return true;
      if (isMulti) {
        return tokens.every(k => {
          const nk = k.replace(NORMALIZE_RE, '');
          return idx.plain.includes(k) || idx.normalized.includes(nk);
        });
      }
      return false;
    };

    return {
      images: images.filter(img => matchesFilter(img) && matchesSearch(img)),
      failed: failedImages.filter(img => matchesFilter(img)),
    };
  }, [images, failedImages, filter, search]);

  const counts = useMemo(() => {
    const counts = { dockerhub: 0, github: 0, google: 0, redhat: 0, aws: 0 };
    for (const img of images) {
      switch (img.sourceType) {
        case 'dockerhub': counts.dockerhub++; break;
        case 'github': counts.github++; break;
        case 'google': counts.google++; break;
        case 'redhat': counts.redhat++; break;
        case 'aws': counts.aws++; break;
      }
    }
    return {
      all: images.length,
      ...counts,
    };
  }, [images]);

  const stats = useMemo(() => {
    let totalSizeBytes = 0;
    const allPlatforms = new Set<string>();
    let totalVersions = 0;
    for (const img of images) {
      totalSizeBytes += (typeof img.size === 'string' ? parseSize(img.size) : img.size) || 0;
      totalVersions += img.totalVersions || img.versions.length;
      img.platforms?.forEach(p => allPlatforms.add(p));
    }
    return {
      totalImages: images.length,
      totalVersions,
      totalSize: formatTotalSize(totalSizeBytes),
      totalPlatforms: allPlatforms.size || '-',
    };
  }, [images]);

  return {
    images: filtered.images,
    failedImages: filtered.failed,
    counts,
    stats,
    loading,
    error,
    filter,
    setFilter,
    search,
    setSearch,
  };
}

function parseSize(str: string | number | undefined): number {
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

function formatTotalSize(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return bytes + ' B';
}

function sampleData(): ImageRecord[] {
  return [
    {
      name: 'library/elasticsearch',
      description: 'Elasticsearch search and analytics engine',
      source: 'docker.io/library/elasticsearch',
      sourceType: 'dockerhub',
      size: '1.2 GB',
      currentVersion: '9.3.0',
      official: true,
      versions: [
        { version: '9.3.0', source: 'docker.io/library/elasticsearch', size: '1.2 GB' },
        { version: '8.17.0', source: 'docker.io/library/elasticsearch', size: '1.1 GB' },
      ],
    },
    {
      name: 'minio/minio',
      description: 'MinIO high-performance object storage',
      source: 'docker.io/minio/minio',
      sourceType: 'dockerhub',
      size: '284 MB',
      currentVersion: 'RELEASE.2025-10-15',
      official: true,
      versions: [
        { version: 'RELEASE.2025-10-15', source: 'docker.io/minio/minio', size: '284 MB' },
        { version: 'RELEASE.2025-09-01', source: 'docker.io/minio/minio', size: '280 MB' },
      ],
    },
    {
      name: 'library/redis',
      description: 'Redis in-memory data structure store',
      source: 'docker.io/library/redis',
      sourceType: 'dockerhub',
      size: '138 MB',
      currentVersion: '7.4',
      official: true,
      versions: [
        { version: '7.4', source: 'docker.io/library/redis', size: '138 MB' },
        { version: '7.2', source: 'docker.io/library/redis', size: '130 MB' },
      ],
    },
    {
      name: 'library/nginx',
      description: 'Official build of Nginx web server',
      source: 'docker.io/library/nginx',
      sourceType: 'dockerhub',
      size: '67 MB',
      currentVersion: '1.27',
      official: true,
      versions: [
        { version: '1.27', source: 'docker.io/library/nginx', size: '67 MB' },
        { version: '1.26', source: 'docker.io/library/nginx', size: '65 MB' },
      ],
    },
    {
      name: 'google-containers/pause',
      description: 'The pause container image',
      source: 'gcr.io/google-containers/pause',
      sourceType: 'google',
      size: '750 KB',
      currentVersion: '3.9',
      versions: [
        { version: '3.9', source: 'gcr.io/google-containers/pause', size: '750 KB' },
        { version: '3.8', source: 'gcr.io/google-containers/pause', size: '720 KB' },
      ],
    },
    {
      name: 'ubi8/ubi',
      description: 'Red Hat Universal Base Image 8',
      source: 'quay.io/ubi8/ubi',
      sourceType: 'redhat',
      size: '215 MB',
      currentVersion: '8.10',
      versions: [
        { version: '8.10', source: 'quay.io/ubi8/ubi', size: '215 MB' },
        { version: '8.9', source: 'quay.io/ubi8/ubi', size: '210 MB' },
      ],
    },
  ] as ImageRecord[];
}
