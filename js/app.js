/* ============================================
   Registry Sync — app.js
   ============================================ */

'use strict';

// ── State ─────────────────────────────────────
let allImages    = [];
let imageData    = {};
let failedImages = [];
let currentFilter = 'all';
let currentSearch = '';
let searchDebounceTimer = null;

// ── Source classification ─────────────────────
function getSourceType(img) {
  const src = (img.source || img.name || '').toLowerCase();
  if (src.startsWith('gcr.io/')   || src.startsWith('us.gcr.io/') ||
      src.startsWith('k8s.gcr.io/') || src.startsWith('registry.k8s.io/')) return 'google';
  if (src.startsWith('quay.io/') || src.includes('redhat'))                 return 'redhat';
  if (src.startsWith('ghcr.io/'))                                            return 'github';
  if (src.startsWith('public.ecr.aws/'))                                     return 'aws';
  return 'dockerhub';
}

// ── Theme ─────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  const dark  = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches;
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(dark ? 'dark' : 'light');
  updateThemeIcon(dark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newDark = !isDark;
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(newDark ? 'dark' : 'light');
  localStorage.setItem('theme', newDark ? 'dark' : 'light');
  updateThemeIcon(newDark);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeIcon');
  const btn  = document.getElementById('themeBtn');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    refreshIcons();
  }
  if (btn) btn.title = isDark ? 'Light Mode' : 'Dark Mode';
}

// ── Display helpers ───────────────────────────
const DISPLAY_NAME_MAP = {
  'mc': 'MinIO Client',
  'nacos-server': 'Nacos Server',
  'geoserver': 'GeoServer',
  'nginx': 'Nginx',
  'redis': 'Redis',
  'rabbitmq': 'RabbitMQ',
  'elasticsearch': 'Elasticsearch',
  'mariadb': 'MariaDB',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'mysql': 'MySQL',
  'mongo': 'MongoDB',
  'mongodb': 'MongoDB',
  'python': 'Python',
  'node': 'Node.js',
  'java': 'Java',
  'openjdk': 'OpenJDK',
  'ubuntu': 'Ubuntu',
  'debian': 'Debian',
  'alpine': 'Alpine',
  'centos': 'CentOS',
  'golang': 'Go',
  'rust': 'Rust',
  'php': 'PHP',
  'ruby': 'Ruby',
  'minio': 'MinIO',
  'etcd': 'etcd',
  'amazoncorretto': 'Amazon Corretto',
  'netkit': 'NetKit',
  'postgresql-postgis': 'PostgreSQL PostGIS',
  'postgresql-backup': 'PostgreSQL Backup'
};

function getDisplayName(name) {
  const rawName = name.split('/').pop();
  return DISPLAY_NAME_MAP[rawName] || (rawName.charAt(0).toUpperCase() + rawName.slice(1));
}

const APP_ICONS = [
  [/corretto|openjdk|java-local|^java$/, 'java.svg',          'Java'],
  [/elasticsearch/,                       'elasticsearch.svg', 'Elasticsearch'],
  [/nacos/,                               'nacos.svg',         'Nacos'],
  [/nginx/,                               'nginx.svg',         'Nginx'],
  [/rabbitmq/,                            'rabbitmq.svg',      'RabbitMQ'],
  [/redis/,                               'redis.svg',         'Redis'],
  [/postgres|postgis/,                    'postgresql.svg',    'PostgreSQL'],
  [/minio/,                               'minio-bird.svg',    'MinIO'],
  [/etcd/,                                'etcd.svg',          'etcd'],
  [/python/,                              'python.svg',        'Python'],
  [/geoserver/,                           'geoserver.svg',     'GeoServer'],
  [/harbor/,                              'harbor.svg',        'Harbor'],
  [/netkit/,                              'netkit.svg',        'Network'],
  [/freemankevin/,                        'freemankevin.svg',  'FreemanKevin'],
];

function getAppIcon(name) {
  const lower = name.toLowerCase();
  for (const [pattern, file, alt] of APP_ICONS) {
    if (pattern.test(lower)) {
      return `<img src="/public/logo/${file}" class="app-icon" alt="${alt}">`;
    }
  }
  return '';
}

// ── Pull cmd ──────────────────────────────────
const REGISTRY_PREFIX_RE = /^(docker\.io\/|gcr\.io\/|us\.gcr\.io\/|k8s\.gcr\.io\/|registry\.k8s\.io\/|quay\.io\/|public\.ecr\.aws\/)/;

function buildPullCmd(img) {
  const ver = img.currentVersion;
  const versionObj = img.versions.find(v => (v.version || v.tag || v) === ver);
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
  cleaned = cleaned.replace(REGISTRY_PREFIX_RE, '');
  return { path: `ghcr.io/freemankevin/${cleaned}`, ver };
}

// ── Format helpers ────────────────────────────
function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (typeof bytes === 'string') return bytes;
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return bytes + ' B';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeId(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '__');
}

function parseSize(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const s = String(str).trim().toLowerCase().replace(/,/g, '');
  const match = s.match(/^([\d.]+)\s*([kmgtp]?b?)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2];
  const multipliers = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15, k: 1e3, m: 1e6, g: 1e9, t: 1e12, p: 1e15 };
  return val * (multipliers[unit] || 1);
}

function formatTotalSize(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return bytes + ' B';
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const t = (k) => k;
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `< 1${t('time.ago.m')}`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}${t('time.ago.m')}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}${t('time.ago.h')}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}${t('time.ago.d')}`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}${t('time.ago.mo')}`;
}

// ── Search index ──────────────────────────────
const NORMALIZE_RE = /[:_/\-]/g;

function buildSearchIndex(record) {
  const { path } = buildPullCmd(record);
  const allTags = (record.versions || []).map(v => v.version || v.tag || v).filter(Boolean);
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

// ── Data loading ──────────────────────────────
async function loadImages() {
  const loadingEl = document.getElementById('loadingState');
  const errorEl   = document.getElementById('errorState');

  try {
    const res = await fetch('/images.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl)   errorEl.classList.add('hidden');
    processData(data);
  } catch (e) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl)   errorEl.classList.remove('hidden');
    processData(sampleData());
  }
}

function processData(data) {
  imageData    = {};
  allImages    = [];
  failedImages = [];

  const records       = Array.isArray(data) ? data : (data.images || Object.values(data));
  const failedRecords = data.failed_images || [];

  for (const img of records) {
    const name = img.name || img.image || '';
    if (!name) continue;

    const versions = img.versions || [];
    const v0 = versions[0] || {};
    const latestVer = img.latest_version || img.version || v0.version || v0.tag || 'latest';
    const latestSrc = v0.source || img.source ||
      ((name.startsWith('ghcr.io/') || name.startsWith('gcr.io/') || name.startsWith('quay.io/')) ? name : '');
    const sourceType = getSourceType({ source: latestSrc, name });

    const record = {
      name,
      displayName:    getDisplayName(name),
      description:    img.description || '',
      source:         latestSrc,
      sourceType,
      size:           v0.size || img.size || '',
      currentVersion: latestVer,
      versions,
      syncStatus:     img.sync_status || 'success',
      platforms:      img.platforms || [],
      layers:         v0.layers || img.layers || '',
      totalVersions:  img.total_versions || versions.length,
      updated:        img.updated || v0.synced_at || v0.created_at || '',
      stars:          img.stars || 0,
    };
    record.searchIndex = buildSearchIndex(record);

    imageData[name] = record;
    allImages.push(record);
  }

  for (const img of failedRecords) {
    const name = img.name || '';
    if (!name) continue;
    failedImages.push({
      name,
      displayName: getDisplayName(name),
      source:      img.source || '',
      sourceType:  getSourceType({ source: img.source || '', name }),
      version:     img.version || '',
      syncStatus:  'failed',
      failedAt:    img.failed_at || '',
    });
  }

  render();
}

// ── Filtering ─────────────────────────────────
function getFiltered() {
  const matchesFilter = (img) => currentFilter === 'all' || img.sourceType === currentFilter;

  if (!currentSearch) {
    return currentFilter === 'all' ? allImages : allImages.filter(matchesFilter);
  }

  const q       = currentSearch.toLowerCase();
  const normQ   = q.replace(NORMALIZE_RE, '');
  const tokens  = q.split(/\s+/).filter(Boolean);
  const isMulti = tokens.length > 1;

  return allImages.filter(img => {
    if (!matchesFilter(img)) return false;
    const idx = img.searchIndex;
    if (idx.plain.includes(q))           return true;
    if (idx.normalized.includes(normQ))  return true;
    if (isMulti) {
      return tokens.every(k => {
        const nk = k.replace(NORMALIZE_RE, '');
        return idx.plain.includes(k) || idx.normalized.includes(nk);
      });
    }
    return false;
  });
}

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => {
    const active = t.dataset.filter === f;
    t.classList.toggle('active', active);
    t.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  render();
}

function handleSearch(val) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentSearch = val.trim();
    render();
  }, 150);
}

// ── Counts ────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateCounts() {
  let docker = 0, github = 0, google = 0, redhat = 0, aws = 0;
  for (const img of allImages) {
    switch (img.sourceType) {
      case 'dockerhub': docker++; break;
      case 'github':    github++; break;
      case 'google':    google++; break;
      case 'redhat':    redhat++; break;
      case 'aws':       aws++;    break;
    }
  }
  setText('cnt-all',       allImages.length);
  setText('cnt-dockerhub', docker);
  setText('cnt-github',    github);
  setText('cnt-google',    google);
  setText('cnt-redhat',    redhat);
  setText('cnt-aws',       aws);
}

// ── Card rendering ────────────────────────────
function buildVersionSelect(img, ver) {
  const versions = img.versions.length > 1
    ? img.versions.map(v => v.version || v.tag || v)
    : [ver];
  const sid = safeId(img.name);
  const escName = escHtml(img.name);

  const optionsHtml = versions.map(v => {
    const isSelected = v === ver;
    return `<div class="custom-select-option ${isSelected ? 'selected' : ''}" data-action="select-version" data-name="${escName}" data-value="${escHtml(v)}">${escHtml(v)}</div>`;
  }).join('');

  return `
    <div class="custom-select" id="version-select-${sid}">
      <div class="custom-select-trigger" data-action="toggle-version-select" data-name="${escName}">
        <span class="mono">${escHtml(ver)}</span>
        <i class="fas fa-chevron-down custom-select-arrow"></i>
      </div>
      <div class="custom-select-options">${optionsHtml}</div>
    </div>`;
}

function buildCard(img, index) {
  const { path, ver } = buildPullCmd(img);
  const size = formatSize(img.size);
  const appIcon = getAppIcon(img.name);
  const escName = escHtml(img.name);
  const sid = safeId(img.name);
  const isOfficial = img.name.startsWith('library/') || (img.source || '').includes('docker.io/library/');

  const platformsShort = (img.platforms || []).map(p => {
    const lower = p.toLowerCase();
    if (lower.includes('amd64')) return 'amd64';
    if (lower.includes('arm64')) return 'arm64';
    return lower;
  }).join('/');

  const registryMap = {
    dockerhub: 'Docker Hub',
    github: 'GHCR',
    google: 'GCR',
    redhat: 'Quay',
    aws: 'AWS'
  };

  return `
<article class="surface rounded-xl animate-fade-in" role="listitem" data-name="${escName}" style="animation-delay:${index * 0.05}s" aria-label="${escHtml(img.displayName)} mirror">
  <div class="card-top-bar card-top-bar--${img.sourceType}"></div>
  <div class="card-body">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        ${appIcon ? `<span class="app-icon-wrapper" style="width:20px;height:20px;">${appIcon}</span>` : ''}
        <h3 class="text-sm font-semibold text-primary truncate">${escHtml(img.displayName)}</h3>
        ${isOfficial ? `<span class="official-dot" title="${t('card.official')}"></span>` : ''}
      </div>
      <div class="flex-shrink-0">${buildVersionSelect(img, ver)}</div>
    </div>

    <div class="command-block">
      <code class="code-block cmd-text truncate flex-1" style="font-size: 12px;">
        <span class="cmd-prompt select-none">$</span>
        ${t('card.dockerPull')} ${escHtml(path)}:${escHtml(ver)}
      </code>
      <button data-action="copy-cmd" data-name="${escName}" class="copy-btn-compact" aria-label="${t('buttons.copy')}">
        <i data-lucide="copy" style="width:12px;height:12px;"></i>
      </button>
    </div>

    <div class="card-footer-meta">
      <span class="registry-tag registry-tag--${img.sourceType}">${registryMap[img.sourceType] || img.sourceType}</span>
      ${platformsShort ? `<span class="meta-text">${platformsShort}</span>` : ''}
      ${size ? `<span class="meta-text">${size}</span>` : ''}
    </div>
  </div>
</article>`;
}

function buildFailedCard(img, index) {
  return `
<article class="surface rounded-xl p-5 animate-fade-in border-2 border-red-500/30 bg-red-500/5" role="listitem" data-name="${escHtml(img.name)}" style="animation-delay:${index * 0.05}s" aria-label="${escHtml(img.displayName)} - ${t('aria.failedLabel')}">
  <div class="flex flex-col lg:flex-row gap-5">
    <div class="flex gap-4 flex-1 min-w-0 items-center">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
          <h3 class="text-base font-bold text-gray-400 truncate">${escHtml(img.displayName)}</h3>
          <span class="badge badge-failed">${t('card.syncFailed')}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-4">
    <div class="terminal-window rounded-xl flex items-center gap-3 group opacity-50">
      <code class="code-block text-gray-400 truncate flex-1">
        <span class="text-gray-400 select-none" style="font-size: 13px;">$</span>
        <span class="text-gray-400" style="font-size: 13px;">${t('card.dockerPull')}</span>
        <span class="text-gray-400" style="font-size: 13px;">${escHtml(img.source || 'N/A')}</span>
      </code>
      <span class="flex items-center justify-center opacity-50" style="width:28px;height:28px;">
        <i data-lucide="alert-triangle" class="text-red-500" style="width:14px;height:14px;"></i>
      </span>
    </div>

    <div class="mt-3 flex items-center justify-between text-sm text-gray-400 mono">
      <span class="truncate" style="font-size: 12px;" title="${escHtml(img.source || '')}">${t('card.source')}: ${escHtml(img.source || 'N/A')}</span>
      <span class="flex-shrink-0 ml-3 text-red-400" style="font-size: 12px;">⚠️ ${t('card.imageNotSynced')}</span>
    </div>
  </div>
</article>`;
}

// ── Custom Version Select ─────────────────────
function toggleVersionSelect(name) {
  const sid = safeId(name);
  const selectEl = document.getElementById(`version-select-${sid}`);
  if (!selectEl) return;
  const isOpen = selectEl.classList.contains('open');

  document.querySelectorAll('.custom-select.open').forEach(el => {
    if (el.id === `version-select-${sid}`) return;
    el.classList.remove('open');
    const card = el.closest('article.surface');
    if (card) card.style.zIndex = '';
  });

  selectEl.classList.toggle('open', !isOpen);
  const card = selectEl.closest('article.surface');
  if (card) card.style.zIndex = isOpen ? '' : '1000';
}

function selectVersion(name, tag) {
  const img = imageData[name];
  if (!img) return;

  const vObj = img.versions.find(v => (v.version || v.tag || v) === tag);
  img.currentVersion = tag;
  if (vObj && vObj.source) img.source = vObj.source;
  if (vObj && vObj.size)   img.size   = vObj.size;

  const sid = safeId(name);
  const selectEl = document.getElementById(`version-select-${sid}`);
  if (selectEl) {
    selectEl.classList.remove('open');
    const card = selectEl.closest('article.surface');
    if (card) card.style.zIndex = '';
  }

  render();
}

// ── Copy ──────────────────────────────────────
function copyCmd(name) {
  const img = imageData[name];
  if (!img) return;
  const { path, ver } = buildPullCmd(img);
  const cmd = `docker pull ${path}:${ver}`;

  const btnEl = document.querySelector(`button[data-action="copy-cmd"][data-name="${CSS.escape(name)}"]`);
  const doFlash = () => flash(btnEl);

  if (navigator.clipboard) {
    navigator.clipboard.writeText(cmd).then(doFlash).catch(doFlash);
  } else {
    const ta = document.createElement('textarea');
    ta.value = cmd;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    doFlash();
  }
}

function flash(btnEl) {
  if (!btnEl) return;
  btnEl.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;"></i>';
  btnEl.classList.add('copied');
  refreshIcons();
  setTimeout(() => {
    btnEl.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px;"></i>';
    btnEl.classList.remove('copied');
    refreshIcons();
  }, 2000);
}

// ── Render ────────────────────────────────────
function renderList(filtered) {
  const list          = document.getElementById('mirrorList');
  const failedList    = document.getElementById('failedMirrorList');
  const empty         = document.getElementById('emptyState');
  const failedSection = document.getElementById('failedSection');

  const filteredFailed = currentFilter === 'all'
    ? failedImages
    : failedImages.filter(img => img.sourceType === currentFilter);

  if (filteredFailed.length > 0 && failedList && failedSection) {
    failedSection.classList.remove('hidden');
    failedList.innerHTML = filteredFailed.map(buildFailedCard).join('');
    setText('failedSectionCount', filteredFailed.length);
  } else if (failedSection) {
    failedSection.classList.add('hidden');
  }

  if (!filtered.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = filtered.map(buildCard).join('');
}

function renderStats() {
  const bar = document.getElementById('statsBar');
  if (!bar) return;

  let totalSizeBytes = 0;
  const allPlatforms = new Set();
  let totalVersions = 0;

  for (const img of allImages) {
    totalSizeBytes += parseSize(img.size);
    totalVersions += img.totalVersions || img.versions.length;
    if (img.platforms) {
      img.platforms.forEach(p => allPlatforms.add(p));
    }
  }

  const t = (k) => k;

  bar.innerHTML = `
    <span class="stat-pill"><strong>${allImages.length}</strong>${t('stats.totalMirrors')}</span>
    <span class="stat-dot">·</span>
    <span class="stat-pill"><strong>${totalVersions}</strong>${t('stats.availableVersions')}</span>
    <span class="stat-dot">·</span>
    <span class="stat-pill"><strong>${formatTotalSize(totalSizeBytes)}</strong></span>
    <span class="stat-dot">·</span>
    <span class="stat-pill"><strong>${allPlatforms.size || '-'}</strong>${t('stats.platforms')}</span>
  `;
}

function render() {
  updateCounts();
  renderStats();
  renderList(getFiltered());
  refreshIcons();
}

// ── Event delegation ──────────────────────────
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const { action, name, value } = actionEl.dataset;
    if (action === 'copy-cmd')              { copyCmd(name); return; }
    if (action === 'toggle-version-select') { toggleVersionSelect(name); return; }
    if (action === 'select-version')        { selectVersion(name, value); return; }
  }
  const filterTab = e.target.closest('[data-filter]');
  if (filterTab) {
    setFilter(filterTab.dataset.filter);
    return;
  }
  if (!e.target.closest('.custom-select')) {
    document.querySelectorAll('.custom-select.open').forEach(el => {
      el.classList.remove('open');
      const card = el.closest('article.surface');
      if (card) card.style.zIndex = '';
    });
  }
});

function initEvents() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  }
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  const backToTop = document.getElementById('backToTop');
  if (backToTop) backToTop.addEventListener('click', scrollToTop);
}

// ── Sample data (when images.json fails) ──────
function sampleData() {
  return [
    {
      name: 'library/elasticsearch',
      description: 'Elasticsearch search and analytics engine',
      source: 'docker.io/library/elasticsearch',
      size: '1.2 GB',
      versions: [
        { tag: '9.3.0',  source: 'docker.io/library/elasticsearch', size: '1.2 GB' },
        { tag: '8.17.0', source: 'docker.io/library/elasticsearch', size: '1.1 GB' },
      ],
    },
    {
      name: 'minio/minio',
      description: 'MinIO high-performance object storage',
      source: 'docker.io/minio/minio',
      size: '284 MB',
      versions: [
        { tag: 'RELEASE.2025-10-15', source: 'docker.io/minio/minio', size: '284 MB' },
        { tag: 'RELEASE.2025-09-01', source: 'docker.io/minio/minio', size: '280 MB' },
      ],
    },
    {
      name: 'library/redis',
      description: 'Redis in-memory data structure store',
      source: 'docker.io/library/redis',
      size: '138 MB',
      versions: [
        { tag: '7.4', source: 'docker.io/library/redis', size: '138 MB' },
        { tag: '7.2', source: 'docker.io/library/redis', size: '130 MB' },
      ],
    },
    {
      name: 'library/nginx',
      description: 'Official build of Nginx web server',
      source: 'docker.io/library/nginx',
      size: '67 MB',
      versions: [
        { tag: '1.27', source: 'docker.io/library/nginx', size: '67 MB' },
        { tag: '1.26', source: 'docker.io/library/nginx', size: '65 MB' },
      ],
    },
    {
      name: 'google-containers/pause',
      description: 'The pause container image — Google Container Registry',
      source: 'gcr.io/google-containers/pause',
      size: '750 KB',
      versions: [
        { tag: '3.9', source: 'gcr.io/google-containers/pause', size: '750 KB' },
        { tag: '3.8', source: 'gcr.io/google-containers/pause', size: '720 KB' },
      ],
    },
    {
      name: 'ubi8/ubi',
      description: 'Red Hat Universal Base Image 8',
      source: 'quay.io/ubi8/ubi',
      size: '215 MB',
      versions: [
        { tag: '8.10', source: 'quay.io/ubi8/ubi', size: '215 MB' },
        { tag: '8.9',  source: 'quay.io/ubi8/ubi', size: '210 MB' },
      ],
    },
  ];
}

// ── Back to Top ───────────────────────────────
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  const threshold = 300;
  window.addEventListener('scroll', () => {
    if (window.scrollY > threshold) {
      btn.classList.add('visible');
      btn.classList.remove('hidden');
    } else {
      btn.classList.remove('visible');
      btn.classList.add('hidden');
    }
  }, { passive: true });
}

// ── Boot ──────────────────────────────────────
initTheme();
initEvents();
initBackToTop();
loadImages();
