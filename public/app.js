const API = '';

// ===== State =====
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let pendingFiles = []; // Files staged for upload
let selectedForDelete = new Set(); // File IDs selected for bulk delete
let deleteCallback = null; // callback for delete modal confirm

// ===== DOM Elements =====
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const headerNav = document.getElementById('headerNav');
const userBadge = document.getElementById('userBadge');
const logoutBtn = document.getElementById('logoutBtn');

const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

const uploadCard = document.getElementById('uploadCard');
const uploadForm = document.getElementById('uploadForm');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const dropZone = document.getElementById('dropZone');
const pdfInput = document.getElementById('pdfInput');
const selectedFilesList = document.getElementById('selectedFilesList');
const refreshBtn = document.getElementById('refreshBtn');
const filesList = document.getElementById('filesList');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const deleteSelectedCount = document.getElementById('deleteSelectedCount');

// Delete modal elements
const deleteModal = document.getElementById('deleteModal');
const deleteModalTitle = document.getElementById('deleteModalTitle');
const deleteModalMessage = document.getElementById('deleteModalMessage');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');



// ===== Helpers =====
function showMessage(el, text, type) {
    el.textContent = text;
    el.className = `form-message ${type}`;
}

function clearMessages() {
    [loginMessage, uploadMessage].forEach(el => {
        el.textContent = '';
        el.className = 'form-message';
    });
}

function authHeaders() {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isUploader() {
    return user && user.role === 'uploader';
}

// ===== UI State =====
function updateUI() {
    if (token && user) {
        authSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        headerNav.style.display = 'flex';
        userBadge.textContent = `${user.name} (${user.role})`;

        if (user.role === 'uploader') {
            uploadCard.classList.remove('hidden');
        } else {
            uploadCard.classList.add('hidden');
        }

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
}


// ===== Login =====
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
        setTimeout(updateUI, 500);
    } catch (err) {
        showMessage(loginMessage, 'Network error. Try again.', 'error');
    }
});

// ===== Logout =====
logoutBtn.addEventListener('click', logout);

// ===== Multi-File Upload: Drag & Drop =====
dropZone.addEventListener('click', () => pdfInput.click());

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
    addPendingFiles(droppedFiles);
});

pdfInput.addEventListener('change', () => {
    const selected = Array.from(pdfInput.files).filter(f => f.type === 'application/pdf');
    addPendingFiles(selected);
    pdfInput.value = ''; // Reset so the same file(s) can be re-selected
});

function addPendingFiles(files) {
    // Prevent exceeding 10 total
    for (const f of files) {
        if (pendingFiles.length >= 10) break;
        // Avoid duplicates by name+size
        const exists = pendingFiles.some(p => p.name === f.name && p.size === f.size);
        if (!exists) {
            pendingFiles.push(f);
        }
    }
    renderPendingFiles();
}

function removePendingFile(index) {
    pendingFiles.splice(index, 1);
    renderPendingFiles();
}

function renderPendingFiles() {
    if (pendingFiles.length === 0) {
        selectedFilesList.classList.add('hidden');
        dropZone.classList.remove('hidden');
        uploadBtn.disabled = true;
        return;
    }

    selectedFilesList.classList.remove('hidden');
    dropZone.classList.add('hidden');
    uploadBtn.disabled = false;

    selectedFilesList.innerHTML = `
        <div class="pending-header">
            <span class="pending-count">${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''} selected</span>
            <button type="button" class="btn-link" onclick="clearPendingFiles()">Clear all</button>
        </div>
        ${pendingFiles.map((f, i) => `
            <div class="pending-file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pending-file-icon">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div class="pending-file-info">
                    <span class="pending-file-name">${f.name}</span>
                    <span class="pending-file-size">${formatSize(f.size)}</span>
                </div>
                <button type="button" class="btn-remove" onclick="removePendingFile(${i})" title="Remove">&times;</button>
            </div>
        `).join('')}
        <button type="button" class="btn-link add-more-btn" onclick="document.getElementById('pdfInput').click()">+ Add more files</button>
    `;
}

function clearPendingFiles() {
    pendingFiles = [];
    renderPendingFiles();
}

// ===== Upload =====
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    if (pendingFiles.length === 0) return;

    const btnText = uploadBtn.querySelector('.btn-text');
    const btnLoader = uploadBtn.querySelector('.btn-loader');
    uploadBtn.disabled = true;
    btnText.textContent = `Uploading ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}…`;
    btnLoader.classList.remove('hidden');

    const formData = new FormData();
    for (const f of pendingFiles) {
        formData.append('pdf', f);
    }

    try {
        const res = await fetch(`${API}/api/files/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            showMessage(uploadMessage, data.message || 'Upload failed.', 'error');
            return;
        }

        showMessage(uploadMessage, data.message || 'PDFs uploaded successfully!', 'success');
        pendingFiles = [];
        renderPendingFiles();
        fetchFiles();
    } catch (err) {
        showMessage(uploadMessage, 'Network error during upload.', 'error');
    } finally {
        uploadBtn.disabled = false;
        btnText.textContent = 'Upload PDFs';
        btnLoader.classList.add('hidden');
    }
});

// ===== Fetch Files =====
async function fetchFiles() {
    filesList.innerHTML = `
    <div class="loading-placeholder">
      <div class="spinner"></div>
      <p>Loading files…</p>
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
        selectedForDelete.clear();
        updateDeleteSelectedBtn();
        renderFiles(data.files);
    } catch (err) {
        filesList.innerHTML = `
      <div class="empty-state">
        <p>Failed to load files. Try refreshing.</p>
      </div>`;
    }
}

function renderFiles(files) {
    if (!files || files.length === 0) {
        filesList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <p>No PDFs uploaded yet.</p>
      </div>`;
        if (isUploader()) deleteSelectedBtn.classList.add('hidden');
        return;
    }

    const showDelete = isUploader();

    filesList.innerHTML = files.map(file => `
    <div class="file-item ${selectedForDelete.has(file._id) ? 'file-selected' : ''}" data-file-id="${file._id}">
      ${showDelete ? `
      <label class="file-checkbox-label">
        <input type="checkbox" class="file-checkbox" data-id="${file._id}" ${selectedForDelete.has(file._id) ? 'checked' : ''} />
        <span class="checkbox-custom"></span>
      </label>` : ''}
      <div class="file-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="file-info">
        <div class="file-name" title="${file.fileName}">${file.fileName}</div>
        <div class="file-meta">
          ${file.uploadedBy ? file.uploadedBy.name : 'Unknown'} · ${formatDate(file.uploadDate)}
        </div>
      </div>
      <div class="file-actions">
        <button class="btn-download" onclick="downloadFile('${file._id}', '${file.fileName.replace(/'/g, "\\'")}')">
          ↓ Download
        </button>
        ${showDelete ? `
        <button class="btn-delete-single" onclick="confirmDeleteSingle('${file._id}', '${file.fileName.replace(/'/g, "\\'")}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>` : ''}
      </div>
    </div>
  `).join('');

    // Attach checkbox listeners
    if (showDelete) {
        document.querySelectorAll('.file-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const fileItem = e.target.closest('.file-item');
                if (e.target.checked) {
                    selectedForDelete.add(id);
                    fileItem.classList.add('file-selected');
                } else {
                    selectedForDelete.delete(id);
                    fileItem.classList.remove('file-selected');
                }
                updateDeleteSelectedBtn();
            });
        });
    }
}

function updateDeleteSelectedBtn() {
    if (!isUploader()) {
        deleteSelectedBtn.classList.add('hidden');
        return;
    }
    if (selectedForDelete.size > 0) {
        deleteSelectedBtn.classList.remove('hidden');
        deleteSelectedCount.textContent = `Delete (${selectedForDelete.size})`;
    } else {
        deleteSelectedBtn.classList.add('hidden');
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
        deleteConfirmBtn.textContent = 'Delete';
        hideDeleteModal();
    }
});

// ===== Single Delete =====
function confirmDeleteSingle(id, name) {
    showDeleteModal(
        'Delete File?',
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        () => deleteSingleFile(id)
    );
}

async function deleteSingleFile(id) {
    try {
        const res = await fetch(`${API}/api/files/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.message || 'Delete failed.');
            return;
        }

        selectedForDelete.delete(id);
        updateDeleteSelectedBtn();
        fetchFiles();
    } catch (err) {
        alert('Network error during deletion.');
    }
}

// ===== Bulk Delete =====
deleteSelectedBtn.addEventListener('click', () => {
    const count = selectedForDelete.size;
    if (count === 0) return;

    showDeleteModal(
        `Delete ${count} File${count > 1 ? 's' : ''}?`,
        `Are you sure you want to delete ${count} selected file${count > 1 ? 's' : ''}? This action cannot be undone.`,
        bulkDeleteFiles
    );
});

async function bulkDeleteFiles() {
    const ids = Array.from(selectedForDelete);
    try {
        const res = await fetch(`${API}/api/files/delete-bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids }),
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.message || 'Bulk delete failed.');
            return;
        }

        selectedForDelete.clear();
        updateDeleteSelectedBtn();
        fetchFiles();
    } catch (err) {
        alert('Network error during bulk deletion.');
    }
}

// ===== Download =====
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
    } catch (err) {
        alert('Download failed. Please try again.');
    }
}

// ===== Refresh =====
refreshBtn.addEventListener('click', fetchFiles);

// ===== Init =====
updateUI();
