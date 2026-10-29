// ===== Configuration & State =====
const API = '';

let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

let allFiles = []; // Master list from backend
let filteredFiles = []; // Filtered & sorted view
let pendingFiles = []; // Staged files for upload: [{ file, customName, originalName, size }]
let selectedFiles = new Set(); // IDs selected for bulk actions
let deleteCallback = null;

let currentView = localStorage.getItem('pdf_view_mode') || 'grid'; // 'grid' | 'list'
let currentFilter = 'all'; // 'all' | 'today' | 'week' | 'month'
let currentSort = 'newest'; // 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'
let searchQuery = '';

// Auto-naming configuration state ("All - DD - MM")
const now = new Date();
let autoNameConfig = {
    enabled: true,
    prefix: 'All',
    day: String(now.getDate()).padStart(2, '0'),
    month: String(now.getMonth() + 1).padStart(2, '0'),
};

// ===== DOM Elements =====
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const headerNav = document.getElementById('headerNav');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userRoleBadge = document.getElementById('userRoleBadge');
const logoutBtn = document.getElementById('logoutBtn');

const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

// Stats elements
const statTotalFiles = document.getElementById('statTotalFiles');
const statStorageUsed = document.getElementById('statStorageUsed');
const statLatestTime = document.getElementById('statLatestTime');
const statNamingFormat = document.getElementById('statNamingFormat');

// Upload elements
const uploadCard = document.getElementById('uploadCard');
const uploadForm = document.getElementById('uploadForm');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const dropZone = document.getElementById('dropZone');
const pdfInput = document.getElementById('pdfInput');
const selectedFilesList = document.getElementById('selectedFilesList');

// Auto-naming controls
const autoNameToggle = document.getElementById('autoNameToggle');
const namingPrefix = document.getElementById('namingPrefix');
const namingDay = document.getElementById('namingDay');
const namingMonth = document.getElementById('namingMonth');
const namingPreviewFilename = document.getElementById('namingPreviewFilename');
const resetDateTodayBtn = document.getElementById('resetDateTodayBtn');

// File showcase & toolbar
const filesList = document.getElementById('filesList');
const fileCountChip = document.getElementById('fileCountChip');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const filterPills = document.getElementById('filterPills');
const sortSelect = document.getElementById('sortSelect');
const viewGridBtn = document.getElementById('viewGridBtn');
const viewListBtn = document.getElementById('viewListBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Selection bar
const selectionBar = document.getElementById('selectionBar');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const selectionText = document.getElementById('selectionText');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const deleteSelectedCount = document.getElementById('deleteSelectedCount');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');

// Delete Modal

const deleteModal = document.getElementById('deleteModal');
const deleteModalTitle = document.getElementById('deleteModalTitle');
const deleteModalMessage = document.getElementById('deleteModalMessage');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

const toastStack = document.getElementById('toastStack');

// ===== Toast Notification Helper =====
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    `;

    if (type === 'success') {
        icon = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="color: var(--success)">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
    } else if (type === 'error') {
        icon = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="color: var(--error)">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        `;
    }

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    toastStack.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 220);
    }, duration);
}

// ===== Formatting Helpers =====
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatRelativeTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSize(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isUploader() {
    return user && (user.role === 'admin' || user.role === 'uploader');
}

function showMessage(el, text, type) {
    el.textContent = text;
    el.className = `form-message ${type}`;
}

function clearMessages() {
    [loginMessage, uploadMessage].forEach(el => {
        if (el) {
            el.textContent = '';
            el.className = 'form-message';
        }
    });
}

// ===== Auto-Naming Logic ("All - DD - MM") =====
function updateNamingPreview() {
    const prefix = (namingPrefix.value || 'All').trim();
    const day = (namingDay.value || '01').trim().padStart(2, '0');
    const month = (namingMonth.value || '01').trim().padStart(2, '0');

    autoNameConfig.enabled = autoNameToggle.checked;
    autoNameConfig.prefix = prefix;
    autoNameConfig.day = day;
    autoNameConfig.month = month;

    const baseName = `${prefix} - ${day} - ${month}`;
    namingPreviewFilename.textContent = `${baseName}.pdf`;
    statNamingFormat.textContent = baseName;

    // If there are currently staged files, re-apply names
    if (pendingFiles.length > 0) {
        pendingFiles.forEach((item, idx) => {
            if (autoNameConfig.enabled) {
                item.customName = idx === 0 ? `${baseName}.pdf` : `${baseName} (${idx + 1}).pdf`;
            } else {
                item.customName = item.originalName;
            }
        });
        renderPendingFiles();
    }
}

function resetDateToToday() {
    const d = new Date();
    namingDay.value = String(d.getDate()).padStart(2, '0');
    namingMonth.value = String(d.getMonth() + 1).padStart(2, '0');
    updateNamingPreview();
    showToast(`Date set to today: ${namingDay.value}-${namingMonth.value}`, 'info');
}

autoNameToggle.addEventListener('change', updateNamingPreview);
namingPrefix.addEventListener('input', updateNamingPreview);
namingDay.addEventListener('input', updateNamingPreview);
namingMonth.addEventListener('input', updateNamingPreview);
resetDateTodayBtn.addEventListener('click', resetDateToToday);

// Initialize initial day/month values
resetDateToToday();

// ===== UI State & Authentication =====
function updateUI() {
    if (token && user) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        headerNav.style.display = 'flex';

        userName.textContent = user.name;
        userAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
        userRoleBadge.textContent = user.role;

        if (isUploader()) {
            uploadCard.classList.remove('hidden');
        } else {
            uploadCard.classList.add('hidden');
        }

        // Apply saved view
        setViewMode(currentView);

        fetchFiles();
    } else {
        authSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        headerNav.style.display = 'none';
    }
}

function saveAuth(data) {
    token = data.token;
    user = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function logout() {
    token = null;
    user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateUI();
    showToast('Signed out of vault', 'info');
}

logoutBtn.addEventListener('click', logout);

// ===== Login Form =====
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showMessage(loginMessage, data.message || 'Login failed.', 'error');
            return;
        }

        saveAuth(data);
        showMessage(loginMessage, 'Welcome back!', 'success');
        loginForm.reset();
        setTimeout(() => {
            updateUI();
            showToast(`Welcome back, ${data.user.name}!`, 'success');
        }, 400);
    } catch (err) {
        showMessage(loginMessage, 'Network error. Try again.', 'error');
    }
});

// ===== Multi-File Upload & Drag/Drop =====
dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('.browse-link') && e.target !== dropZone && !e.target.closest('.drop-zone-content')) return;
    pdfInput.click();
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (droppedFiles.length === 0) {
        showToast('Only PDF files are supported.', 'error');
        return;
    }
    addPendingFiles(droppedFiles);
});

pdfInput.addEventListener('change', () => {
    const selected = Array.from(pdfInput.files).filter(f => f.type === 'application/pdf');
    addPendingFiles(selected);
    pdfInput.value = ''; // Reset for re-selection
});

function addPendingFiles(files) {
    const baseName = `${autoNameConfig.prefix} - ${autoNameConfig.day} - ${autoNameConfig.month}`;

    for (const f of files) {
        if (pendingFiles.length >= 10) {
            showToast('Maximum 10 files can be uploaded at once.', 'warning');
            break;
        }

        // Avoid duplicate by size & original name
        const exists = pendingFiles.some(p => p.originalName === f.name && p.size === f.size);
        if (!exists) {
            let targetName = f.name;
            if (autoNameConfig.enabled) {
                const idx = pendingFiles.length;
                targetName = idx === 0 ? `${baseName}.pdf` : `${baseName} (${idx + 1}).pdf`;
            }

            pendingFiles.push({
                file: f,
                originalName: f.name,
                customName: targetName,
                size: f.size,
            });
        }
    }

    renderPendingFiles();
}

function removePendingFile(index) {
    pendingFiles.splice(index, 1);
    // If auto-naming is active, re-index filenames
    if (autoNameConfig.enabled) {
        const baseName = `${autoNameConfig.prefix} - ${autoNameConfig.day} - ${autoNameConfig.month}`;
        pendingFiles.forEach((item, idx) => {
            item.customName = idx === 0 ? `${baseName}.pdf` : `${baseName} (${idx + 1}).pdf`;
        });
    }
    renderPendingFiles();
}

function clearPendingFiles() {
    pendingFiles = [];
    renderPendingFiles();
}

function updatePendingCustomName(index, newName) {
    if (pendingFiles[index]) {
        let name = newName.trim();
        if (name && !name.toLowerCase().endsWith('.pdf')) {
            name += '.pdf';
        }
        pendingFiles[index].customName = name || pendingFiles[index].originalName;
    }
}

function renderPendingFiles() {
    if (pendingFiles.length === 0) {
        selectedFilesList.classList.add('hidden');
        dropZone.classList.remove('hidden');
        uploadBtn.disabled = true;
        return;
    }

    selectedFilesList.classList.remove('hidden');
    dropZone.classList.remove('hidden'); // keep drop zone visible so user can add more easily
    uploadBtn.disabled = false;

    selectedFilesList.innerHTML = `
      <div class="pending-header">
        <span class="pending-count">${pendingFiles.length} PDF${pendingFiles.length > 1 ? 's' : ''} Staged for Upload</span>
        <button type="button" class="btn-link" onclick="clearPendingFiles()">Clear all</button>
      </div>
      ${pendingFiles.map((item, i) => `
        <div class="pending-file">
          <div class="pending-file-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="pending-file-info">
            <div class="pending-rename-row">
              <input 
                type="text" 
                class="pending-name-input" 
                value="${escapeHtml(item.customName)}" 
                title="Edit upload filename"
                onchange="updatePendingCustomName(${i}, this.value)"
              />
              ${autoNameConfig.enabled ? `<span class="auto-renamed-tag">All - DD - MM</span>` : ''}
            </div>
            <div class="pending-meta-row">
              <span class="pending-original-name" title="Original: ${escapeHtml(item.originalName)}">Original: ${escapeHtml(item.originalName)}</span>
              <span class="pending-file-size">${formatSize(item.size)}</span>
            </div>
          </div>
          <button type="button" class="btn-remove" onclick="removePendingFile(${i})" title="Remove file">&times;</button>
        </div>
      `).join('')}
      <div class="add-more-row">
        <button type="button" class="btn btn-ghost btn-xs" onclick="document.getElementById('pdfInput').click()">
          + Add more files
        </button>
      </div>
    `;
}

// ===== Upload Handler =====
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    if (pendingFiles.length === 0) return;

    const btnText = uploadBtn.querySelector('.btn-text');
    const btnLoader = uploadBtn.querySelector('.btn-loader');
    uploadBtn.disabled = true;
    btnText.textContent = `Uploading ${pendingFiles.length} PDF${pendingFiles.length > 1 ? 's' : ''}…`;
    btnLoader.classList.remove('hidden');

    const formData = new FormData();
    const customNames = [];

    for (const item of pendingFiles) {
        let finalName = item.customName.trim();
        if (!finalName.toLowerCase().endsWith('.pdf')) {
            finalName += '.pdf';
        }
        customNames.push(finalName);

        // Rename File object so multer receives the formatted name cleanly
        const renamedFile = new File([item.file], finalName, { type: 'application/pdf' });
        formData.append('pdf', renamedFile);
    }

    formData.append('customNames', JSON.stringify(customNames));

    try {
        const res = await fetch(`${API}/api/files/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            showMessage(uploadMessage, data.message || 'Upload failed.', 'error');
            showToast(data.message || 'Upload failed', 'error');
            return;
        }

        showToast(data.message || 'PDFs uploaded successfully!', 'success');
        showMessage(uploadMessage, data.message || 'PDFs uploaded successfully!', 'success');
        pendingFiles = [];
        renderPendingFiles();
        fetchFiles();
    } catch (err) {
        showMessage(uploadMessage, 'Network error during upload.', 'error');
        showToast('Network error during upload.', 'error');
    } finally {
        uploadBtn.disabled = false;
        btnText.textContent = 'Upload PDFs';
        btnLoader.classList.add('hidden');
    }
});

// ===== Fetch Files =====
async function fetchFiles() {
    refreshBtn.classList.add('spinning');
    filesList.innerHTML = `
      <div class="loading-placeholder">
        <div class="spinner"></div>
        <p>Fetching your documents…</p>
      </div>`;

    try {
        const res = await fetch(`${API}/api/files`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) {
            if (res.status === 401) {
                logout();
                return;
            }
            throw new Error('Failed to fetch files');
        }

        const data = await res.json();
        allFiles = data.files || [];
        selectedFiles.clear();
        updateSelectionUI();
        updateStats();
        applyFiltersAndRender();
    } catch (err) {
        filesList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3>Unable to Load Files</h3>
            <p>Please check your connection or server status and click refresh.</p>
          </div>`;
    } finally {
        setTimeout(() => refreshBtn.classList.remove('spinning'), 400);
    }
}

// ===== Metrics / Stats Update =====
function updateStats() {
    statTotalFiles.textContent = allFiles.length;
    fileCountChip.textContent = `${allFiles.length} file${allFiles.length !== 1 ? 's' : ''}`;

    const totalBytes = allFiles.reduce((acc, f) => acc + (f.fileSize || 0), 0);
    statStorageUsed.textContent = formatSize(totalBytes);

    if (allFiles.length > 0) {
        const latest = allFiles[0];
        statLatestTime.textContent = formatRelativeTime(latest.uploadDate);
        statLatestTime.title = formatDate(latest.uploadDate);
    } else {
        statLatestTime.textContent = '—';
    }
}

// ===== Filter, Search & Sort Logic =====
function applyFiltersAndRender() {
    let result = [...allFiles];

    // 1. Search Query
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        result = result.filter(file => {
            const nameMatch = (file.fileName || '').toLowerCase().includes(q);
            const uploaderMatch = file.uploadedBy && file.uploadedBy.name && file.uploadedBy.name.toLowerCase().includes(q);
            return nameMatch || uploaderMatch;
        });
    }

    // 2. Date Quick Filter
    if (currentFilter !== 'all') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (currentFilter === 'today') {
            result = result.filter(f => new Date(f.uploadDate) >= startOfToday);
        } else if (currentFilter === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            result = result.filter(f => new Date(f.uploadDate) >= oneWeekAgo);
        } else if (currentFilter === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            result = result.filter(f => new Date(f.uploadDate) >= oneMonthAgo);
        }
    }

    // 3. Sorting
    result.sort((a, b) => {
        if (currentSort === 'newest') {
            return new Date(b.uploadDate) - new Date(a.uploadDate);
        } else if (currentSort === 'oldest') {
            return new Date(a.uploadDate) - new Date(b.uploadDate);
        } else if (currentSort === 'name-asc') {
            return (a.fileName || '').localeCompare(b.fileName || '', undefined, { sensitivity: 'base' });
        } else if (currentSort === 'name-desc') {
            return (b.fileName || '').localeCompare(a.fileName || '', undefined, { sensitivity: 'base' });
        } else if (currentSort === 'size-desc') {
            return (b.fileSize || 0) - (a.fileSize || 0);
        } else if (currentSort === 'size-asc') {
            return (a.fileSize || 0) - (b.fileSize || 0);
        }
        return 0;
    });

    filteredFiles = result;
    renderFiles();
}

// Search box listener
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (searchQuery) {
        searchClearBtn.classList.remove('hidden');
    } else {
        searchClearBtn.classList.add('hidden');
    }
    applyFiltersAndRender();
});

searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClearBtn.classList.add('hidden');
    applyFiltersAndRender();
    searchInput.focus();
});

// Quick keyboard shortcut "/" to focus search
window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
    } else if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.blur();
    }
});

// Filter pills listener
filterPills.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        filterPills.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.dataset.filter;
        applyFiltersAndRender();
    });
});

// Sort select listener
sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFiltersAndRender();
});

// View mode switcher
function setViewMode(mode) {
    currentView = mode;
    localStorage.setItem('pdf_view_mode', mode);

    if (mode === 'grid') {
        viewGridBtn.classList.add('active');
        viewListBtn.classList.remove('active');
        filesList.classList.add('files-grid');
        filesList.classList.remove('files-list');
    } else {
        viewListBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        filesList.classList.add('files-list');
        filesList.classList.remove('files-grid');
    }

    renderFiles();
}

viewGridBtn.addEventListener('click', () => setViewMode('grid'));
viewListBtn.addEventListener('click', () => setViewMode('list'));
refreshBtn.addEventListener('click', fetchFiles);

// ===== Render Files (Grid / List) =====
function renderFiles() {
    if (!filteredFiles || filteredFiles.length === 0) {
        if (allFiles.length === 0) {
            filesList.innerHTML = `
              <div class="empty-state">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="32" height="32">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <h3>No Documents Yet</h3>
                <p>Upload your first PDF document using the form above to start sharing.</p>
              </div>`;
        } else {
            filesList.innerHTML = `
              <div class="empty-state">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="32" height="32">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <h3>No Matching Documents</h3>
                <p>No files match your search criteria. Try a different term or clear the filter.</p>
              </div>`;
        }
        updateSelectionUI();
        return;
    }

    const showDelete = isUploader();

    if (currentView === 'grid') {
        filesList.innerHTML = filteredFiles.map(file => {
            const isSelected = selectedFiles.has(file._id);
            const uploaderName = file.uploadedBy ? file.uploadedBy.name : 'Unknown';
            const uploaderInitial = uploaderName.charAt(0).toUpperCase();
            const safeName = escapeHtml(file.fileName);
            const formattedDate = formatDate(file.uploadDate);
            const relativeTime = formatRelativeTime(file.uploadDate);

            return `
              <div class="modern-file-card ${isSelected ? 'file-selected' : ''}" data-file-id="${file._id}">
                <div class="card-top-bar">
                  <label class="custom-checkbox-wrap" title="Select document">
                    <input type="checkbox" class="file-select-checkbox" data-id="${file._id}" ${isSelected ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                  </label>
                  <div class="pdf-chip">PDF</div>
                  <div class="uploader-chip" title="Uploaded by ${escapeHtml(uploaderName)}">
                    <span class="uploader-chip-avatar">${uploaderInitial}</span>
                    <span>${escapeHtml(uploaderName)}</span>
                  </div>
                </div>

                <!-- Document Cover / Click to Download -->
                <div class="document-cover" onclick="downloadFile('${file._id}', '${safeName}')" title="Click to download ${safeName}">
                  <div class="doc-paper-sheet">
                    <div class="sheet-fold"></div>
                    <div class="sheet-line"></div>
                    <div class="sheet-line short"></div>
                    <div class="sheet-badge-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div class="card-details">
                  <div class="card-title-row">
                    <h4 class="file-display-name" title="${safeName}" onclick="downloadFile('${file._id}', '${safeName}')">
                      ${safeName}
                    </h4>
                  </div>
                  <div class="card-meta-pills">
                    <span class="meta-pill size-pill" title="File Size">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                      </svg>
                      ${formatSize(file.fileSize)}
                    </span>
                    <span class="meta-pill" title="${formattedDate}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      ${relativeTime}
                    </span>
                  </div>
                </div>

                <div class="card-action-bar">
                  <button type="button" class="action-btn-primary" onclick="downloadFile('${file._id}', '${safeName}')" title="Download ${safeName}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Download</span>
                  </button>
                  ${showDelete ? `
                    <button type="button" class="action-icon-btn action-danger-btn" onclick="confirmDeleteSingle('${file._id}', '${safeName}')" title="Delete permanently">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
        }).join('');
    } else {
        // List View Mode
        filesList.innerHTML = filteredFiles.map(file => {
            const isSelected = selectedFiles.has(file._id);
            const uploaderName = file.uploadedBy ? file.uploadedBy.name : 'Unknown';
            const safeName = escapeHtml(file.fileName);
            const formattedDate = formatDate(file.uploadDate);

            return `
              <div class="modern-list-item ${isSelected ? 'file-selected' : ''}" data-file-id="${file._id}">
                <label class="custom-checkbox-wrap" title="Select">
                  <input type="checkbox" class="file-select-checkbox" data-id="${file._id}" ${isSelected ? 'checked' : ''}>
                  <span class="checkbox-custom"></span>
                </label>
                <div class="list-file-icon" onclick="downloadFile('${file._id}', '${safeName}')" title="Click to download">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div class="list-file-info">
                  <h4 class="list-file-name" title="${safeName}" onclick="downloadFile('${file._id}', '${safeName}')">
                    ${safeName}
                  </h4>
                  <div class="list-file-meta">
                    <span>${escapeHtml(uploaderName)}</span>
                    <span>·</span>
                    <span>${formattedDate}</span>
                    <span>·</span>
                    <span class="size-pill">${formatSize(file.fileSize)}</span>
                  </div>
                </div>
                <div class="list-file-actions">
                  <button type="button" class="btn btn-primary btn-sm" onclick="downloadFile('${file._id}', '${safeName}')" title="Download">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Download</span>
                  </button>
                  ${showDelete ? `
                    <button type="button" class="action-icon-btn action-danger-btn" onclick="confirmDeleteSingle('${file._id}', '${safeName}')" title="Delete">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
        }).join('');
    }

    // Attach checkbox listeners
    document.querySelectorAll('.file-select-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const card = e.target.closest('.modern-file-card, .modern-list-item');
            if (e.target.checked) {
                selectedFiles.add(id);
                if (card) card.classList.add('file-selected');
            } else {
                selectedFiles.delete(id);
                if (card) card.classList.remove('file-selected');
            }
            updateSelectionUI();
        });
    });

    updateSelectionUI();
}

// ===== Selection Management =====
function updateSelectionUI() {
    const totalVisible = filteredFiles.length;
    const selectedCount = selectedFiles.size;

    if (selectedCount > 0) {
        selectionBar.classList.remove('hidden');
        selectionText.textContent = `${selectedCount} document${selectedCount > 1 ? 's' : ''} selected`;
        selectAllCheckbox.checked = (totalVisible > 0 && selectedCount === totalVisible);
        selectAllCheckbox.indeterminate = (selectedCount > 0 && selectedCount < totalVisible);

        if (isUploader()) {
            deleteSelectedBtn.classList.remove('hidden');
            deleteSelectedCount.textContent = `Delete (${selectedCount})`;
        } else {
            deleteSelectedBtn.classList.add('hidden');
        }
    } else {
        selectionBar.classList.add('hidden');
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
}

selectAllCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        filteredFiles.forEach(f => selectedFiles.add(f._id));
    } else {
        selectedFiles.clear();
    }
    renderFiles();
});

clearSelectionBtn.addEventListener('click', () => {
    selectedFiles.clear();
    renderFiles();
});

// Download selected batch
downloadSelectedBtn.addEventListener('click', async () => {
    if (selectedFiles.size === 0) return;
    const toDownload = filteredFiles.filter(f => selectedFiles.has(f._id));

    showToast(`Starting download of ${toDownload.length} document(s)…`, 'info');
    for (const f of toDownload) {
        await downloadFile(f._id, f.fileName);
        // Small delay so browser handles multiple downloads smoothly
        await new Promise(r => setTimeout(r, 450));
    }
});

// Bulk Delete
deleteSelectedBtn.addEventListener('click', () => {
    const count = selectedFiles.size;
    if (count === 0) return;

    showDeleteModal(
        `Delete ${count} Document${count > 1 ? 's' : ''}?`,
        `Are you sure you want to permanently delete ${count} selected file${count > 1 ? 's' : ''}? This action cannot be undone.`,
        bulkDeleteFiles
    );
});

async function bulkDeleteFiles() {
    const ids = Array.from(selectedFiles);
    try {
        const res = await fetch(`${API}/api/files/delete-bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids }),
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || 'Bulk delete failed.', 'error');
            return;
        }

        showToast(data.message || 'Files deleted successfully!', 'success');
        selectedFiles.clear();
        fetchFiles();
    } catch (err) {
        showToast('Network error during bulk deletion.', 'error');
    }
}

// ===== Single Delete =====
function confirmDeleteSingle(id, name) {
    showDeleteModal(
        'Delete Document?',
        `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`,
        () => deleteSingleFile(id)
    );
}

async function deleteSingleFile(id) {
    try {
        const res = await fetch(`${API}/api/files/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || 'Delete failed.', 'error');
            return;
        }

        showToast('Document deleted successfully', 'success');
        selectedFiles.delete(id);
        fetchFiles();
    } catch (err) {
        showToast('Network error during deletion.', 'error');
    }
}

// ===== Delete Modal =====
function showDeleteModal(title, message, onConfirm) {
    deleteModalTitle.textContent = title;
    deleteModalMessage.textContent = message;
    deleteCallback = onConfirm;
    deleteModal.classList.remove('hidden');
}

function hideDeleteModal() {
    deleteModal.classList.add('hidden');
    deleteCallback = null;
}

deleteCancelBtn.addEventListener('click', hideDeleteModal);
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) hideDeleteModal();
});

deleteConfirmBtn.addEventListener('click', async () => {
    if (deleteCallback) {
        deleteConfirmBtn.disabled = true;
        deleteConfirmBtn.textContent = 'Deleting…';
        await deleteCallback();
        deleteConfirmBtn.disabled = false;
        deleteConfirmBtn.textContent = 'Delete Permanently';
        hideDeleteModal();
    }
});

// ===== Download Helper =====
async function downloadFile(id, name) {
    try {
        const res = await fetch(`${API}/api/files/download/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Download failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Downloading: ${name}`, 'success');
    } catch (err) {
        showToast('Download failed. Please try again.', 'error');
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!deleteModal.classList.contains('hidden')) {
            hideDeleteModal();
        }
    }
});

// ===== Initialize =====
updateUI();
