const API = '';

// ===== State =====
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

// ===== DOM Elements =====
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const headerNav = document.getElementById('headerNav');
const userBadge = document.getElementById('userBadge');
const logoutBtn = document.getElementById('logoutBtn');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginMessage = document.getElementById('loginMessage');
const registerMessage = document.getElementById('registerMessage');

const uploadCard = document.getElementById('uploadCard');
const uploadForm = document.getElementById('uploadForm');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMessage = document.getElementById('uploadMessage');
const dropZone = document.getElementById('dropZone');
const pdfInput = document.getElementById('pdfInput');
const selectedFile = document.getElementById('selectedFile');
const selectedFileName = document.getElementById('selectedFileName');
const removeFileBtn = document.getElementById('removeFile');
const refreshBtn = document.getElementById('refreshBtn');
const filesList = document.getElementById('filesList');

// ===== Auth Tabs =====
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.dataset.tab;
        loginForm.classList.toggle('hidden', target !== 'login');
        registerForm.classList.toggle('hidden', target !== 'register');
        clearMessages();
    });
});

// ===== Helpers =====
function showMessage(el, text, type) {
    el.textContent = text;
    el.className = `form-message ${type}`;
}

function clearMessages() {
    [loginMessage, registerMessage, uploadMessage].forEach(el => {
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

// ===== Register =====
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;

    try {
        const res = await fetch(`${API}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role }),
        });

        const data = await res.json();

        if (!res.ok) {
            showMessage(registerMessage, data.message || 'Registration failed.', 'error');
            return;
        }

        saveAuth(data);
        showMessage(registerMessage, 'Account created!', 'success');
        registerForm.reset();
        setTimeout(updateUI, 500);
    } catch (err) {
        showMessage(registerMessage, 'Network error. Try again.', 'error');
    }
});

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

// ===== File Upload: Drag & Drop =====
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
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        setSelectedFile(file);
    }
});

pdfInput.addEventListener('change', () => {
    if (pdfInput.files[0]) {
        setSelectedFile(pdfInput.files[0]);
    }
});

function setSelectedFile(file) {
    // Store file reference via DataTransfer trick
    const dt = new DataTransfer();
    dt.items.add(file);
    pdfInput.files = dt.files;

    selectedFileName.textContent = file.name;
    selectedFile.classList.remove('hidden');
    dropZone.classList.add('hidden');
    uploadBtn.disabled = false;
}

removeFileBtn.addEventListener('click', () => {
    pdfInput.value = '';
    selectedFile.classList.add('hidden');
    dropZone.classList.remove('hidden');
    uploadBtn.disabled = true;
});

// ===== Upload =====
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const file = pdfInput.files[0];
    if (!file) return;

    const btnText = uploadBtn.querySelector('.btn-text');
    const btnLoader = uploadBtn.querySelector('.btn-loader');
    uploadBtn.disabled = true;
    btnText.textContent = 'Uploading…';
    btnLoader.classList.remove('hidden');

    const formData = new FormData();
    formData.append('pdf', file);

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

        showMessage(uploadMessage, 'PDF uploaded successfully!', 'success');
        pdfInput.value = '';
        selectedFile.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fetchFiles();
    } catch (err) {
        showMessage(uploadMessage, 'Network error during upload.', 'error');
    } finally {
        uploadBtn.disabled = false;
        btnText.textContent = 'Upload PDF';
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
        return;
    }

    filesList.innerHTML = files.map(file => `
    <div class="file-item">
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
      <button class="btn-download" onclick="downloadFile('${file._id}', '${file.fileName.replace(/'/g, "\\'")}')">
        ↓ Download
      </button>
    </div>
  `).join('');
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
