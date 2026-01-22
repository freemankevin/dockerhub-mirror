// 全局变量
let allImages = [];
let imageVersions = {}; // 存储每个镜像的所有版本

// 格式化时间
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
  return date.toLocaleDateString('zh-CN');
}

// 规范化版本号显示
function normalizeVersion(version) {
  if (!version || version === 'latest') return 'latest';
  // 移除开头的 v
  return version.replace(/^v+/i, '');
}

// 创建烟花效果
function createFireworks(element) {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'];
  const particleCount = 12;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'firework';
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    const angle = (i / particleCount) * Math.PI * 2;
    const distance = 20 + Math.random() * 20;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    
    particle.style.transform = `translate(${tx}px, ${ty}px)`;
    document.body.appendChild(particle);
    
    setTimeout(() => particle.remove(), 600);
  }
}

// 复制命令
function copyCommand(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalHTML = btn.innerHTML;
    btn.classList.add('copied');
    
    // 显示复制成功反馈
    btn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      <span class="copy-feedback">已复制</span>
    `;
    
    // 创建烟花效果
    createFireworks(btn);
    
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalHTML;
    }, 2000);
  });
}

// 版本切换
function changeVersion(imageName, selectEl) {
  const selectedVersion = selectEl.value;
  const versions = imageVersions[imageName];
  const versionData = versions.find(v => v.version === selectedVersion);
  
  if (versionData) {
    const commandEl = selectEl.closest('.terminal-window').querySelector('.terminal-command');
    commandEl.textContent = `docker pull ${versionData.target}`;
  }
}

// 创建版本选择器
function createVersionSelector(imageName, currentVersion) {
  const versions = imageVersions[imageName] || [];
  
  // 无论是一个还是多个版本，都显示下拉菜单
  const options = versions.map(v => 
    `<option value="${v.version}" ${v.version === currentVersion ? 'selected' : ''}>
      ${normalizeVersion(v.version)}
    </option>`
  ).join('');
  
  return `<select class="version-select" onchange="changeVersion('${imageName}', this)">${options}</select>`;
}

// 创建镜像卡片
function createImageCard(img) {
  const displayVersion = normalizeVersion(img.version);
  
  return `
    <div class="bg-white rounded-xl shadow-sm p-6 card-hover">
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          <h3 class="text-xl font-semibold text-gray-900 mb-2">${img.name.split('/').pop()}</h3>
          <p class="text-gray-600 text-sm mb-3">${img.description || '无描述'}</p>
          <div class="flex flex-wrap gap-2 items-center">
            ${createVersionSelector(img.name, img.version)}
            <span class="badge badge-green">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              已同步
            </span>
            <span class="text-xs text-gray-500 flex items-center">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              ${formatDate(img.synced_at)}
            </span>
          </div>
        </div>
      </div>
      <div class="space-y-3">
        <div class="terminal-window">
          <div class="terminal-header">
            <div class="terminal-dot dot-red"></div>
            <div class="terminal-dot dot-yellow"></div>
            <div class="terminal-dot dot-green"></div>
            <span class="text-xs text-gray-400 ml-2">Docker Pull 命令</span>
            <button onclick="copyCommand('docker pull ${img.target}', this)" class="ml-auto copy-button text-gray-400 hover:text-white px-2 py-1 rounded flex items-center text-xs">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              复制
            </button>
          </div>
          <div class="terminal-body">
            <span class="terminal-prompt">$</span> <span class="terminal-command">docker pull ${img.target}</span>
          </div>
        </div>
        <div class="flex items-center text-xs text-gray-500">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          源镜像: ${img.source}
        </div>
      </div>
    </div>
  `;
}

// 渲染镜像列表
function renderImages(images) {
  const container = document.getElementById('images-container');
  const emptyState = document.getElementById('empty-state');

  if (images.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  container.classList.remove('hidden');
  emptyState.classList.add('hidden');
  container.innerHTML = images.map(createImageCard).join('');
}

// 搜索过滤
function filterImages(query) {
  const filtered = allImages.filter(img => 
    img.name.toLowerCase().includes(query.toLowerCase()) ||
    (img.description && img.description.toLowerCase().includes(query.toLowerCase()))
  );
  renderImages(filtered);
}

// 加载镜像数据
async function loadImages() {
  try {
    const response = await fetch('/public/images.json');
    const data = await response.json();
    
    // 按镜像名称分组,支持多版本
    const imageMap = {};
    data.images.forEach(img => {
      if (!imageMap[img.name]) {
        imageMap[img.name] = [];
      }
      imageMap[img.name].push(img);
    });
    
    // 存储版本信息
    imageVersions = imageMap;
    
    // 每个镜像只显示最新版本
    allImages = Object.values(imageMap).map(versions => {
      // 按同步时间排序,取最新的
      versions.sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at));
      return versions[0];
    });
    
    // 更新统计
    document.getElementById('total-count').textContent = Object.keys(imageMap).length;
    document.getElementById('last-update').textContent = formatDate(data.updated_at);
    document.getElementById('registry-info').textContent = `${data.registry}/${data.owner}`;
    
    renderImages(allImages);
    document.querySelectorAll('.skeleton-card').forEach(el => el.remove());
  } catch (error) {
    console.error('Failed to load images:', error);
    document.getElementById('images-container').innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 class="mt-4 text-lg font-medium text-red-900">加载失败</h3>
        <p class="mt-2 text-red-700">无法加载镜像数据,请稍后重试</p>
      </div>
    `;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-input').addEventListener('input', (e) => filterImages(e.target.value));
  loadImages();
});
