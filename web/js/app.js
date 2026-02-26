/* ============================================
   Docker Sync Engine — app.js
   ============================================ */

'use strict';

// ── State ──────────────────────────────────────
const ITEMS_PER_PAGE = 10;
let allImages    = [];   // flat list of display objects
let imageData    = {};   // name → full record (with versions[])
let currentFilter = 'all';
let currentSearch = '';
let currentPage   = 1;

// ── Source detection ──────────────────────────
function getSourceType(img) {
  const src = (img.source || '').toLowerCase();
  if (src.startsWith('gcr.io/')   || src.startsWith('us.gcr.io/') ||
      src.startsWith('k8s.gcr.io/') || src.startsWith('registry.k8s.io/')) return 'google';
  if (src.startsWith('quay.io/') || src.includes('redhat'))                 return 'redhat';
  if (src.startsWith('ghcr.io/'))                                            return 'github';
  return 'dockerhub';
}

function getSourceLabel(type) {
  return { dockerhub:'#dockerhub', github:'#ghcr', google:'#gcr', redhat:'#quay' }[type] || '#dockerhub';
}

// ── Theme ─────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  const dark  = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches;
  document.documentElement.className = dark ? 'dark' : 'light';
  updateThemeIcon(dark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  document.documentElement.classList.toggle('light', !isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('themeIcon');
  if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

// ── Data loading ──────────────────────────────
async function loadImages() {
  try {
    const res = await fetch('/images.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    processData(data);
  } catch (e) {
    // Use sample data so UI renders
    processData(sampleData());
  }
}

function processData(data) {
  imageData = {};
  allImages = [];

  const records = Array.isArray(data) ? data : (data.images || Object.values(data));

  records.forEach(img => {
    const name = img.name || img.image || '';
    if (!name) return;

    const versions = img.versions || (img.version ? [{ tag: img.version, source: img.source, size: img.size }] : []);
    const latestVer = img.latest_version || img.version || (versions[0] && versions[0].tag) || 'latest';
    const latestSrc = img.source || (versions[0] && versions[0].source) || '';
    const latestSize = img.size || (versions[0] && versions[0].size) || '';

    const record = {
      name,
      displayName: getDisplayName(name),
      description: img.description || '',
      stars:       img.stars  || img.pulls || 0,
      layers:      img.layers || 0,
      updated:     img.updated || img.last_updated || img.synced_at || '',
      platforms:   img.platforms || img.architectures || ['AMD64','ARM64'],
      official:    isOfficial(name),
      source:      latestSrc,
      sourceType:  getSourceType({ source: latestSrc || img.source || '' }),
      size:        latestSize,
      currentVersion: latestVer,
      versions,
    };

    imageData[name] = record;
    allImages.push(record);
  });

  render();
}

// ── Helpers ───────────────────────────────────
function getDisplayName(name) {
  const parts = name.split('/');
  return parts[parts.length - 1];
}

function isOfficial(name) {
  return name.startsWith('library/') || !name.includes('/');
}

function formatAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const mins  = Math.round((Date.now() - d) / 60000);
  if (mins < 60)    return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24)     return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  if (days < 30)    return days + 'd ago';
  const mos  = Math.round(days / 30);
  return mos + 'mo ago';
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (typeof bytes === 'string') return bytes;
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB';
  return bytes + ' B';
}

function parseSizeToMB(sizeStr) {
  if (!sizeStr) return 0;
  if (typeof sizeStr === 'number') return sizeStr / 1e6;
  const s = sizeStr.trim().toUpperCase();
  const match = s.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2];
  const map = { B: 1e-6, KB: 1e-3, MB: 1, GB: 1e3, TB: 1e6 };
  return val * (map[unit] || 0);
}

function animateStatValue(elementId, target, duration = 800) {
  const el = document.getElementById(elementId);
  if (!el || typeof target !== 'number') return;

  let current = parseFloat(el.textContent) || 0;
  if (current === target) return;

  const start = current;
  const startTime = performance.now();

  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2; // ease-out quad

    current = start + (target - start) * eased;
    el.textContent = Number.isInteger(target) ? Math.round(current) : current.toFixed(1);

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = Number.isInteger(target) ? target : target.toFixed(1);
    }
  };

  requestAnimationFrame(step);
}

// ── Filtering ─────────────────────────────────
function getFiltered() {
  return allImages.filter(img => {
    if (currentFilter !== 'all' && img.sourceType !== currentFilter) return false;
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      if (!img.displayName.toLowerCase().includes(q) &&
          !img.description.toLowerCase().includes(q) &&
          !img.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function setFilter(f) {
  currentFilter = f;
  currentPage   = 1;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === f);
  });
  render();
}

function handleSearch(val) {
  currentSearch = val.trim();
  currentPage   = 1;
  render();
}

// ── Stats ─────────────────────────────────────
function updateStats() {
  const total    = allImages.length;
  const versions = allImages.reduce((s, img) => s + Math.max(img.versions.length, 1), 0);
  const avgVersions = total ? (versions / total).toFixed(1) : '0';

  // latest update this week
  const weekAgo = Date.now() - 7 * 86400000;
  const recent  = allImages.filter(img => img.updated && new Date(img.updated) > weekAgo).length;

  // storage size (sum of all version sizes)
  let totalSizeMB = 0;
  for (const img of allImages) {
    // sum each version's size, fallback to img.size if no versions
    if (img.versions && img.versions.length) {
      for (const v of img.versions) {
        totalSizeMB += parseSizeToMB(v.size);
      }
    } else {
      totalSizeMB += parseSizeToMB(img.size);
    }
  }
  const avgSizeMB = total ? totalSizeMB / total : 0;

  // last synced image
  let lastImg = allImages.reduce((best, img) => {
    if (!img.updated) return best;
    if (!best || new Date(img.updated) > new Date(best.updated)) return img;
    return best;
  }, null);

  const dockerCount  = allImages.filter(i => i.sourceType === 'dockerhub').length;
  const githubCount  = allImages.filter(i => i.sourceType === 'github').length;
  const googleCount  = allImages.filter(i => i.sourceType === 'google').length;
  const redhatCount  = allImages.filter(i => i.sourceType === 'redhat').length;

  // Animate numeric stats
  animateStatValue('statTotal', total);
  // animateStatValue('statVersions', versions); // No corresponding UI element
  animateStatValue('statLatestCount', recent || total);
  animateStatValue('statAvgVersions', parseFloat(avgVersions));

  // Format size stats
  setText('statStorage', formatSize(totalSizeMB * 1e6)); // convert MB to bytes for formatSize
  setText('statAvg', formatSize(avgSizeMB * 1e6));

  setText('statLastSyncAge', lastImg ? formatAgo(lastImg.updated) : '–');
  setText('statLastSyncName', lastImg ? lastImg.displayName : '–');
  setText('statSub', '+' + total + ' this week');

  setText('cnt-all',       allImages.length);
  setText('cnt-dockerhub', dockerCount);
  setText('cnt-github',    githubCount);
  setText('cnt-google',    googleCount);
  setText('cnt-redhat',    redhatCount);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Card rendering ────────────────────────────
function buildIcon(sourceType) {
  const icons = {
    dockerhub: `<div class="card-icon icon-docker"><svg viewBox="0 0 24 24" fill="#2496ED" width="20" height="20"><path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186h-2.12a.186.186 0 0 0-.185.186v1.887c0 .102.084.185.186.185m-2.929 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.887c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z"/></svg></div>`,
    github:    `<div class="card-icon icon-github"><i class="fab fa-github" style="font-size:20px;color:#6b7280"></i></div>`,
    google:    `<div class="card-icon icon-google"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg></div>`,
    redhat:    `<div class="card-icon icon-redhat"><svg viewBox="0 0 256 256" width="22" height="22"><circle cx="128" cy="128" r="128" fill="#EE0000"/><path fill="white" d="M155 118c12 0 30-5 30-18 0-9-7-14-19-14h-47l-10 32h46zm-53 61h-30l6-18h30l-6 18zm-8-33l6-18h50c7 0 11 2 11 7 0 8-12 11-22 11H94z"/></svg></div>`,
  };
  return icons[sourceType] || icons.dockerhub;
}

function buildPullCmd(img) {
  // Prefer the target field from the version object if available
  const ver = img.currentVersion;
  const src = img.source || '';

  // Find the version object that matches currentVersion
  const versionObj = img.versions.find(v => (v.version || v.tag || v) === ver);
  if (versionObj && versionObj.target) {
    const target = versionObj.target;
    const colonIdx = target.lastIndexOf(':');
    if (colonIdx > 0) {
      const path = target.substring(0, colonIdx);
      const verFromTarget = target.substring(colonIdx + 1);
      return { path, ver: verFromTarget };
    }
  }

  // Fallback: construct path from source
  let mirrorPath = src;
  if (!src.startsWith('ghcr.io/')) {
    const cleaned = src.replace(/[:\/]/g, '_').replace(/^_/, '');
    mirrorPath = `ghcr.io/freemankevin/${cleaned}`;
  }

  return { path: mirrorPath, ver };
}

function buildCard(img, index) {
  const { path, ver } = buildPullCmd(img);
  const sourceLabel = getSourceLabel(img.sourceType);
  const ago = formatAgo(img.updated);
  const size = formatSize(img.size);
  const isDark = document.documentElement.classList.contains('dark');

  // Icon classes
  const iconClass = img.sourceType === 'dockerhub' ? 'source-icon-docker' : 'source-icon-github';
  const iconColor = img.sourceType === 'dockerhub' ? 'accent-blue' : (isDark ? 'text-gray-300' : 'text-gray-600');

  // Platform badges
  const platforms = Array.isArray(img.platforms) ? img.platforms : ['AMD64', 'ARM64'];
  const archBadges = platforms.map(a => {
    const colorClass = a.toUpperCase().includes('ARM') ? 'text-purple-500' : 'text-blue-500';
    const bgClass = isDark ? '' : (a.toUpperCase().includes('ARM') ? 'bg-purple-50' : 'bg-blue-50');
    return `<span class="text-[11px] font-medium ${colorClass} ${bgClass} px-1.5 py-0.5 rounded">${a.toUpperCase()}</span>`;
  }).join('');

  // Version options
  const versionOptions = img.versions.length > 1
    ? img.versions.map(v => {
        const tag = v.version || v.tag || v;
        return `<option value="${tag}" ${tag === ver ? 'selected' : ''}>${tag}</option>`;
      }).join('')
    : `<option>${ver}</option>`;

  const versionEl = img.versions.length > 1
    ? `<select onchange="changeVersion('${img.name}', this.value)" class="version-select px-3 py-1.5 rounded-lg text-sm border cursor-pointer mono" aria-label="Select version for ${escHtml(img.displayName)}">${versionOptions}</select>`
    : `<span class="version-select">${ver}</span>`;

  const officialBadge = img.official
    ? '<span class="badge badge-official">official</span>'
    : '';

  return `
<article class="surface rounded-lg p-4 animate-fade-in" role="listitem" data-name="${img.name}" style="animation-delay:${index * 0.05}s" aria-label="${escHtml(img.displayName)} mirror">
  <div class="flex flex-col lg:flex-row gap-4">
    <div class="flex gap-3 flex-1 min-w-0">
      <div class="w-10 h-10 rounded-lg ${iconClass} border flex items-center justify-center flex-shrink-0">
        ${img.sourceType === 'dockerhub'
          ? '<i class="fab fa-docker ' + iconColor + ' text-lg"></i>'
          : '<i class="fab fa-github ' + iconColor + ' text-lg"></i>'}
      </div>
      
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <h3 class="text-base font-semibold text-primary truncate">${escHtml(img.displayName)}</h3>
          ${officialBadge}
          <span class="tag">${sourceLabel}</span>
        </div>
        
        <p class="text-sm text-secondary mb-2 line-clamp-1">${escHtml(img.description)}</p>
        
        <div class="flex items-center gap-3 text-xs text-tertiary mono flex-wrap">
          ${img.stars ? `<button onclick="toggleStar('${img.name}')" class="star-btn flex items-center gap-1 hover:text-amber-500 transition-colors" aria-label="Star ${escHtml(img.displayName)}" aria-pressed="false">
            <i class="fas fa-star"></i>
            <span>${img.stars}</span>
          </button>` : ''}
          ${img.layers ? `<span class="flex items-center gap-1">
            <i class="fas fa-layer-group text-purple-500/60"></i>
            ${img.layers} layers
          </span>` : ''}
          ${ago ? `<span>${ago}</span>` : ''}
          <div class="flex items-center gap-1.5">
            ${archBadges}
          </div>
        </div>
      </div>
    </div>
    
    <div class="flex items-center gap-2 flex-shrink-0">
      ${versionEl}
    </div>
  </div>
  
  <div class="mt-4 pt-3 border-t border-muted">
    <div class="code-window rounded-lg p-3 flex items-center gap-2 group">
      <code class="code-block text-tertiary truncate flex-1">
        <span class="text-purple-500 select-none">$</span>
        <span class="text-primary">docker pull</span>
        <span class="accent-blue">${escHtml(path)}</span>:<span class="accent-yellow">${escHtml(ver)}</span>
      </code>
      <button onclick="copyCmd('${img.name}')"
              class="copy-btn p-2 rounded-lg hover:bg-emphasis transition-all text-tertiary hover:text-primary flex-shrink-0"
              aria-label="Copy pull command"
              title="Copy to clipboard">
        <i class="fas fa-copy text-xs"></i>
      </button>
    </div>
    
    <div class="mt-2 flex items-center justify-between text-xs text-tertiary mono">
      <span class="truncate" title="${escHtml(img.source || '')}">Source: ${escHtml(img.source || '')}</span>
      ${size ? `<span class="flex-shrink-0 ml-2">${size}</span>` : ''}
    </div>
  </div>
</article>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Version switching ─────────────────────────
function changeVersion(name, tag) {
  const img = imageData[name];
  if (!img) return;

  const vObj = img.versions.find(v => (v.version || v.tag || v) === tag);
  img.currentVersion = tag;
  if (vObj && vObj.source) img.source = vObj.source;
  if (vObj && vObj.size)   img.size   = vObj.size;

  // Also update allImages entry
  const flat = allImages.find(i => i.name === name);
  if (flat) {
    flat.currentVersion = tag;
    if (vObj && vObj.source) flat.source = vObj.source;
  }

  // Patch DOM instead of full re-render
  const { path, ver } = buildPullCmd(img);
  const pathEl = document.getElementById('cmd-path-' + name);
  const verEl  = document.getElementById('cmd-ver-'  + name);
  const srcEl  = document.getElementById('footer-src-' + name);
  if (pathEl) pathEl.textContent = path;
  if (verEl)  verEl.textContent  = ver;
  if (srcEl)  srcEl.textContent  = 'Source: ' + (img.source || '');
}

// ── Copy ──────────────────────────────────────
function copyCmd(name) {
  const img = imageData[name] || allImages.find(i => i.name === name);
  if (!img) return;

  const { path, ver } = buildPullCmd(img);
  const cmd = `docker pull ${path}:${ver}`;

  const iconEl = document.getElementById('copy-icon-' + name);

  if (navigator.clipboard) {
    navigator.clipboard.writeText(cmd).then(() => flash(iconEl));
  } else {
    const ta = document.createElement('textarea');
    ta.value = cmd; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    flash(iconEl);
  }

  showToast('Copied to clipboard!');
}

function flash(iconEl) {
  if (!iconEl) return;
  iconEl.className = 'fas fa-check';
  setTimeout(() => { iconEl.className = 'fas fa-copy'; }, 1500);
}

// ── Star toggle ──────────────────────────────
function toggleStar(name) {
  const btn = document.querySelector(`button[onclick="toggleStar('${name}')"]`);
  if (!btn) return;
  const isStarred = btn.getAttribute('aria-pressed') === 'true';
  btn.setAttribute('aria-pressed', !isStarred);
  const icon = btn.querySelector('i');
  if (icon) {
    if (!isStarred) {
      icon.className = 'fas fa-star text-amber-500';
      // Increment star count
      const countSpan = btn.querySelector('span');
      if (countSpan) {
        const count = parseInt(countSpan.textContent) || 0;
        countSpan.textContent = count + 1;
      }
      showToast('Added to favorites');
    } else {
      icon.className = 'fas fa-star';
      // Decrement star count
      const countSpan = btn.querySelector('span');
      if (countSpan) {
        const count = parseInt(countSpan.textContent) || 1;
        countSpan.textContent = Math.max(0, count - 1);
      }
      showToast('Removed from favorites');
    }
  }
}

// ── Toast ─────────────────────────────────────
function showToast(msg) {
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
  wrap.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => { t.classList.add('show'); }); });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 2000);
}

// ── Pagination ────────────────────────────────
function buildPagination(total, filtered) {
  const totalPages = Math.ceil(filtered / ITEMS_PER_PAGE);
  const container  = document.getElementById('pagination');
  if (!container) return;

  if (totalPages <= 1) { container.innerHTML = ''; return; }

  const from = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const to   = Math.min(currentPage * ITEMS_PER_PAGE, filtered);

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const btns = pages.map(p => {
    if (p === '…') return `<span class="pag-ellipsis">…</span>`;
    return `<button class="pag-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
  }).join('');

  container.innerHTML = `
    <div class="pag-wrap">
      <span class="pag-info">Showing <strong>${from}–${to}</strong> of <strong>${filtered}</strong></span>
      <div class="pag-btns">
        <button class="pag-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
          <i class="fas fa-chevron-left"></i>
        </button>
        ${btns}
        <button class="pag-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>`;
}

function goToPage(p) {
  const filtered = getFiltered();
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderList(filtered);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Render ────────────────────────────────────
function renderList(filtered) {
  const list     = document.getElementById('mirrorList');
  const empty    = document.getElementById('emptyState');
  const pagEl    = document.getElementById('pagination');

  if (!filtered.length) {
    list.innerHTML  = '';
    pagEl.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const page  = filtered.slice(start, start + ITEMS_PER_PAGE);

  list.innerHTML = page.map((img, i) => buildCard(img, i)).join('');

  buildPagination(allImages.length, filtered.length);
}

function render() {
  updateStats();
  const filtered = getFiltered();
  renderList(filtered);
}

// ── Sample data (used when images.json not found) ──
function sampleData() {
  return [
    {
      name: 'library/elasticsearch',
      description: 'Elasticsearch search and analytics engine',
      stars: 124, layers: 12,
      updated: new Date(Date.now() - 4 * 86400000).toISOString(),
      platforms: ['AMD64','ARM64'],
      source: 'docker.io/library/elasticsearch',
      size: '1.2 GB',
      versions: [
        { tag: '9.3.0', source: 'docker.io/library/elasticsearch', size: '1.2 GB' },
        { tag: '8.17.0', source: 'docker.io/library/elasticsearch', size: '1.1 GB' },
      ],
    },
    {
      name: 'minio/minio',
      description: 'MinIO high-performance object storage',
      stars: 89, layers: 8,
      updated: new Date(Date.now() - 19 * 86400000).toISOString(),
      platforms: ['AMD64','ARM64'],
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
      stars: 210, layers: 6,
      updated: new Date(Date.now() - 1 * 86400000).toISOString(),
      platforms: ['AMD64','ARM64'],
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
      stars: 305, layers: 7,
      updated: new Date(Date.now() - 3 * 86400000).toISOString(),
      platforms: ['AMD64','ARM64'],
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
      stars: 0, layers: 2,
      updated: new Date(Date.now() - 60 * 86400000).toISOString(),
      platforms: ['AMD64','ARM64'],
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
      stars: 0, layers: 4,
      updated: new Date(Date.now() - 14 * 86400000).toISOString(),
      platforms: ['AMD64','ARM64'],
      source: 'quay.io/ubi8/ubi',
      size: '215 MB',
      versions: [
        { tag: '8.10', source: 'quay.io/ubi8/ubi', size: '215 MB' },
        { tag: '8.9',  source: 'quay.io/ubi8/ubi', size: '210 MB' },
      ],
    },
  ];
}

// ── Boot ──────────────────────────────────────
initTheme();
loadImages();
