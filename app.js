// Configuration
let API_BASE = localStorage.getItem('apiUrl') || 'https://studenthousingmeals.onrender.com/api/images';
let currentPage = 1;
let authToken = localStorage.getItem('authToken') || '';
let isLoading = false;
let currentSection = 'dashboard';

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('apiUrl').value = API_BASE;
    initializeAuth();
    setupEventListeners();
    loadDashboard();
});

function updateApiUrl() {
    const newUrl = document.getElementById('apiUrl').value.trim();
    if (newUrl) {
        API_BASE = newUrl.endsWith('/api/images') ? newUrl : newUrl + '/api/images';
        localStorage.setItem('apiUrl', API_BASE);
        showAlert('API URL updated successfully!', 'success');
        
        // Reload current section
        if (currentSection === 'dashboard') {
            loadDashboard();
        } else if (currentSection === 'images') {
            loadImages();
        } else if (currentSection === 'analytics') {
            loadAnalytics();
        }
    }
}

function initializeAuth() {
    const authStatus = document.getElementById('authStatus');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');

    if (authToken) {
        authStatus.textContent = 'Authenticated';
        authStatus.className = 'auth-status authenticated';
        loginForm.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        authStatus.textContent = 'Not Authenticated';
        authStatus.className = 'auth-status unauthenticated';
        loginForm.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
    }
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.dataset.section;
            showSection(section);
        });
    });

    // Forms
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
    document.getElementById('editForm').addEventListener('submit', handleEdit);

    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

function showSection(sectionName) {
    if (currentSection === sectionName) return; // Prevent unnecessary reloads
    
    currentSection = sectionName;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // Show section
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');

    // Reset pagination when switching sections
    currentPage = 1;

    // Load section data
    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'images':
            loadImages();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

async function apiCall(endpoint, options = {}) {
    if (isLoading && !options.force) {
        console.log('Request already in progress, skipping...');
        return;
    }

    const url = `${API_BASE}${endpoint}`;
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    if (authToken && !options.skipAuth) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    isLoading = true;
    
    try {
        const response = await fetch(url, config);
        let data;
        
        // Handle different response types
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = { message: await response.text() };
        }
        
        if (!response.ok) {
            // Handle specific HTTP error codes
            if (response.status === 401) {
                showAlert('Authentication failed. Please check your token.', 'error');
                handleLogout();
            } else if (response.status === 403) {
                showAlert('Access denied. Insufficient permissions.', 'error');
            } else if (response.status === 404) {
                showAlert('Resource not found.', 'error');
            } else if (response.status >= 500) {
                showAlert('Server error. Please try again later.', 'error');
            } else {
                showAlert(data.message || `Request failed with status: ${response.status}`, 'error');
            }
            throw new Error(data.message || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showAlert('Network error. Please check your connection and API URL.', 'error');
        } else if (!error.message.includes('HTTP')) {
            showAlert('Unexpected error occurred. Please try again.', 'error');
        }
        
        throw error;
    } finally {
        isLoading = false;
    }
}

async function loadDashboard() {
    try {
        const stats = await apiCall('/analytics/stats', { skipAuth: true });
        
        if (stats && stats.data && stats.data.overview) {
            document.getElementById('totalImages').textContent = stats.data.overview.total || 0;
            document.getElementById('activeImages').textContent = stats.data.overview.active || 0;
            document.getElementById('totalStorage').textContent = 
                ((stats.data.overview.totalStorageUsed || 0) / (1024 * 1024)).toFixed(2) + ' MB';
        } else {
            throw new Error('Invalid stats response format');
        }
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        // Show fallback values
        document.getElementById('totalImages').textContent = 'N/A';
        document.getElementById('activeImages').textContent = 'N/A';
        document.getElementById('totalStorage').textContent = 'N/A';
    }
}

async function loadImages() {
    const container = document.getElementById('imagesContainer');
    container.innerHTML = '<div class="loading">Loading images...</div>';

    try {
        const searchInput = document.getElementById('searchInput').value.trim();
        const typeFilter = document.getElementById('typeFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const sortBy = document.getElementById('sortBy').value;
        const sortOrder = document.getElementById('sortOrder').value;

        const params = new URLSearchParams({
            page: currentPage,
            limit: 12,
            sortBy,
            sortOrder
        });

        if (searchInput) params.append('search', searchInput);
        if (typeFilter) params.append('type', typeFilter);
        if (statusFilter) params.append('isActive', statusFilter);

        const response = await apiCall(`/list?${params}`, { skipAuth: true });
        
        if (response && response.data) {
            displayImages(response.data);
            if (response.pagination) {
                displayPagination(response.pagination);
            }
            updateTypeFilter(response.data);
        } else {
            throw new Error('Invalid response format');
        }
        
    } catch (error) {
        console.error('Failed to load images:', error);
        container.innerHTML = '<div class="alert alert-error">Failed to load images. Please check your API connection.</div>';
    }
}

function displayImages(images) {
    const container = document.getElementById('imagesContainer');
    
    if (!Array.isArray(images) || images.length === 0) {
        container.innerHTML = '<div class="alert">No images found</div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'image-grid';

    images.forEach(image => {
        const card = document.createElement('div');
        card.className = 'image-card';
        
        // Create image element with error handling
        const imgElement = document.createElement('img');
        imgElement.src = image.url || '';
        imgElement.alt = image.title || 'Image';
        imgElement.loading = 'lazy';
        imgElement.style.width = '100%';
        imgElement.style.height = '200px';
        imgElement.style.objectFit = 'cover';
        
        // Handle image load errors
        imgElement.onerror = function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2Yzc1N2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+';
            this.alt = 'Image not found';
        };
        
        const cardContent = document.createElement('div');
        cardContent.className = 'image-card-content';
        
        cardContent.innerHTML = `
            <h3>${escapeHtml(image.title || 'Untitled')}</h3>
            <p>Type: ${escapeHtml(image.type || 'Unknown')} | Size: ${image.size ? (image.size / 1024).toFixed(1) : '0'} KB</p>
            <p>${escapeHtml(image.description || 'No description')}</p>
            <div class="image-card-actions">
                <button class="btn btn-primary" onclick="viewImage('${image.id}')">View</button>
                ${authToken ? `
                    <button class="btn btn-secondary" id="viewbutton" onclick="editImage('${image.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="deleteImage('${image.id}')">Delete</button>
                ` : ''}
            </div>
        `;
        
        card.appendChild(imgElement);
        card.appendChild(cardContent);
        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayPagination(pagination) {
    const container = document.getElementById('pagination');
    container.innerHTML = '';

    if (pagination.pages <= 1) return;

    for (let i = 1; i <= pagination.pages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === pagination.current ? 'active' : '';
        btn.onclick = () => {
            currentPage = i;
            loadImages();
        };
        container.appendChild(btn);
    }
}

function updateTypeFilter(images) {
    const typeFilter = document.getElementById('typeFilter');
    const currentValue = typeFilter.value;
    const types = [...new Set(images.map(img => img.type))];
    
    typeFilter.innerHTML = '<option value="">All Types</option>';
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        if (type === currentValue) option.selected = true;
        typeFilter.appendChild(option);
    });
}

async function loadAnalytics() {
    const container = document.getElementById('analyticsContainer');
    container.innerHTML = '<div class="loading">Loading analytics...</div>';

    try {
        const stats = await apiCall('/analytics/stats', { skipAuth: true });
        displayAnalytics(stats.data);
    } catch (error) {
        container.innerHTML = '<div class="alert alert-error">Failed to load analytics</div>';
    }
}

function displayAnalytics(data) {
    const container = document.getElementById('analyticsContainer');
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>${data.overview.total}</h3>
                <p>Total Images</p>
            </div>
            <div class="stat-card">
                <h3>${data.overview.active}</h3>
                <p>Active Images</p>
            </div>
            <div class="stat-card">
                <h3>${data.overview.inactive}</h3>
                <p>Inactive Images</p>
            </div>
            <div class="stat-card">
                <h3>${(data.overview.totalStorageUsed / (1024 * 1024)).toFixed(2)} MB</h3>
                <p>Storage Used</p>
            </div>
            <div class="stat-card">
                <h3>${(data.overview.averageFileSize / 1024).toFixed(1)} KB</h3>
                <p>Average File Size</p>
            </div>
        </div>
        
        <h3>Images by Type</h3>
        <div class="stats-grid">
            ${data.byType.map(type => `
                <div class="stat-card">
                    <h3>${type.count}</h3>
                    <p>${type._id}</p>
                    <small>${(type.totalSize / 1024).toFixed(1)} KB total</small>
                </div>
            `).join('')}
        </div>
    `;
}

async function handleUpload(e) {
    e.preventDefault();
    
    if (!authToken) {
        showAlert('Please login to upload images', 'error');
        return;
    }

    const form = e.target;
    const formData = new FormData();
    
    // Validate required fields
    const imageFile = form.querySelector('#imageFile').files[0];
    const imageType = form.querySelector('#imageType').value.trim();
    
    if (!imageFile) {
        showAlert('Please select an image file', 'error');
        return;
    }
    
    if (!imageType) {
        showAlert('Please enter an image type', 'error');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(imageFile.type)) {
        showAlert('Please select a valid image file (JPG, PNG, GIF, WebP, SVG)', 'error');
        return;
    }
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (imageFile.size > maxSize) {
        showAlert('File size must be less than 10MB', 'error');
        return;
    }
    
    // Build form data
    formData.append('image', imageFile);
    formData.append('type', imageType);
    
    const title = form.querySelector('#imageTitle').value.trim();
    if (title) formData.append('title', title);
    
    const description = form.querySelector('#imageDescription').value.trim();
    if (description) formData.append('description', description);
    
    const tags = form.querySelector('#imageTags').value.trim();
    if (tags) formData.append('tags', tags);
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    
    try {
        const response = await apiCall('/upload/new', {
            method: 'POST',
            body: formData
        });
        
        showAlert('Image uploaded successfully!', 'success');
        form.reset();
        
        // Refresh images if on images section
        if (currentSection === 'images') {
            currentPage = 1; // Reset to first page
            loadImages();
        }
        
        // Update dashboard stats
        if (currentSection === 'dashboard') {
            loadDashboard();
        }
        
    } catch (error) {
        console.error('Upload failed:', error);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function viewImage(id) {
    try {
        const response = await apiCall(`/details/${id}`, { skipAuth: true });
        alert(`Image Details:\nTitle: ${response.data.title}\nType: ${response.data.type}\nSize: ${(response.data.size / 1024).toFixed(1)} KB\nFormat: ${response.data.format}\nDimensions: ${response.data.dimensions.width}x${response.data.dimensions.height}`);
    } catch (error) {
        console.error('Failed to load image details:', error);
    }
}

async function editImage(id) {
    if (!authToken) {
        showAlert('Please login to edit images', 'error');
        return;
    }

    try {
        const response = await apiCall(`/details/${id}`, { skipAuth: true });
        const image = response.data;
        
        document.getElementById('editImageId').value = image.id;
        document.getElementById('editImageType').value = image.type;
        document.getElementById('editImageTitle').value = image.title || '';
        document.getElementById('editImageDescription').value = image.description || '';
        document.getElementById('editImageTags').value = image.tags ? image.tags.join(', ') : '';
        
        document.getElementById('editModal').style.display = 'block';
    } catch (error) {
        console.error('Failed to load image for editing:', error);
    }
}

async function handleEdit(e) {
    e.preventDefault();
    
    const id = document.getElementById('editImageId').value;
    const formData = new FormData(e.target);
    
    try {
        const response = await apiCall(`/update/${id}`, {
            method: 'PUT',
            body: formData
        });
        
        showAlert('Image updated successfully!', 'success');
        closeEditModal();
        loadImages();
        
    } catch (error) {
        console.error('Update failed:', error);
    }
}

async function deleteImage(id) {
    if (!authToken) {
        showAlert('Please login to delete images', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
        await apiCall(`/remove/${id}`, { method: 'DELETE' });
        showAlert('Image deleted successfully!', 'success');
        loadImages();
    } catch (error) {
        console.error('Delete failed:', error);
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function handleLogin() {
    const tokenInput = document.getElementById('tokenInput');
    const token = tokenInput.value.trim();
    
    if (token) {
        authToken = token;
        localStorage.setItem('authToken', token);
        
        initializeAuth();
        showAlert('Logged in successfully!', 'success');
        tokenInput.value = ''; // Clear the input field
    } else {
        showAlert('Please enter a valid token', 'error');
    }
}

function handleLogout() {
    authToken = '';
    localStorage.removeItem('authToken');
    initializeAuth();
    showAlert('Logged out successfully!', 'success');
}

function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    document.querySelector('.container').insertBefore(alert, document.querySelector('.nav'));
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}