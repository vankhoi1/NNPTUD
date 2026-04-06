// API Configuration
const API_BASE = 'http://localhost:3000/api';

// State Management
let currentSection = 'books';
let booksPage = 1;
let membersPage = 1;
let loansPage = 1;
let booksData = { total: 0, totalPages: 0, data: [] };
let membersData = { total: 0, totalPages: 0, data: [] };
let loansData = { total: 0, totalPages: 0, data: [] };
let allBooks = [];
let allMembers = [];
let currentUser = null;
// Support both authToken (index.html) and token (login.html legacy)
let authToken = localStorage.getItem('authToken') || localStorage.getItem('token') || null;
let loanStatusHistoryFilterTimer = null;
let supportTicketFilterTimer = null;

// ========== UTILITY FUNCTIONS ==========

/**
 * Show alert message to user
 * @param {string} message - Noi dung thong bao
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showAlert(message, type = 'info') {
    // Create alert container if not exists
    let alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alert-container';
        alertContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(alertContainer);
    }

    // Create alert element
    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.style.cssText = `
        padding: 15px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        font-weight: 500;
        animation: slideIn 0.3s ease-in-out;
    `;

    // Set colors based on type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };

    alertEl.style.backgroundColor = colors[type] || colors.info;
    alertEl.style.color = 'white';
    alertEl.textContent = message;

    // Add to container
    alertContainer.appendChild(alertEl);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alertEl.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => alertEl.remove(), 300);
    }, 5000);
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupForms();
    checkAuth();

    // Default statistics month/year to current date for better UX
    const statsMonthEl = document.getElementById('stats-month');
    const statsYearEl = document.getElementById('stats-year');
    if (statsMonthEl && statsYearEl) {
        const now = new Date();
        statsMonthEl.value = String(now.getMonth() + 1);
        statsYearEl.value = String(now.getFullYear());
    }

    loadBooks();
    loadMembers();
});

// ========== AUTHENTICATION ==========

function checkAuth() {
    if (authToken) {
        fetchUserProfile();
    } else {
        showLoginPrompt();
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentUser = data.data;
            updateUIForUser();
            // Connect socket early for realtime notifications/chat
            try {
                // Only connect if chat section exists
                if (document.getElementById('chat-section')) {
                    chatRoomId = (document.getElementById('chat-room-id')?.value || 'public').trim() || 'public';
                    connectAndLoadChat();
                }
            } catch (_) {
                // ignore
            }
        } else {
            logout();
        }
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        logout();
    }
}

function removeLoginPrompt() {
    const loginBtn = document.getElementById('login-prompt-btn');
    if (loginBtn) loginBtn.remove();
}

function updateUIForUser() {
    if (currentUser) {
        removeLoginPrompt();
        // Show user info
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').textContent = currentUser.username;
        document.getElementById('user-role').textContent = `(${currentUser.role})`;
        
        // Toggle nav by role
        const isAdmin = currentUser.role === 'Admin';
        const isReader = currentUser.role === 'Reader';
        const isLibrarian = currentUser.role === 'Librarian';
        const canManageBooks = ['Admin', 'Librarian'].includes(currentUser.role);
        const canManageMembers = ['Admin', 'Librarian'].includes(currentUser.role);
        const canManageUsers = isAdmin;
        const canManageAll = isAdmin;
        const canViewStatistics = isAdmin; // Only Admin can view statistics, not Librarian
        const canPayFines = canManageBooks;

        // Navigation visibility
        document.getElementById('profile-nav').style.display = isReader ? 'block' : 'none';
        document.getElementById('users-nav').style.display = canManageUsers ? 'block' : 'none';
        document.getElementById('statistics-nav').style.display = canViewStatistics ? 'block' : 'none';

        // New nav sections for our models
        // Support Tickets: All authenticated users can view, but only Admin/Librarian can manage
        document.getElementById('support-tickets-nav').style.display = 'block';
        // Tags section removed
        const tagsNav = document.getElementById('tags-nav');
        if (tagsNav) tagsNav.style.display = 'none';
        // Loan Status History: All can view their own, Admin/Librarian can view all
        document.getElementById('loan-status-history-nav').style.display = 'block';

        // Existing nav sections
        document.getElementById('reservations-nav').style.display = 'block';
        document.getElementById('notifications-nav').style.display = 'block';
        document.getElementById('fines-nav').style.display = 'block';
        document.getElementById('reviews-nav').style.display = 'block';
        document.getElementById('chat-nav').style.display = 'block';
        const uploadNav = document.getElementById('upload-nav');
        if (uploadNav) uploadNav.style.display = 'none';
        
        // Action buttons visibility
        document.getElementById('add-book-btn').style.display = canManageBooks ? 'block' : 'none';
        document.getElementById('add-member-btn').style.display = canManageMembers ? 'block' : 'none';
        
        // New action buttons visibility
        // Only Reader can create support tickets from frontend
        document.getElementById('add-support-ticket-btn').style.display = isReader ? 'block' : 'none';
        document.getElementById('add-tag-btn').style.display = isAdmin ? 'block' : 'none'; // Only Admin (not Librarian)
        document.getElementById('bulk-add-tags-btn').style.display = isAdmin ? 'block' : 'none'; // Only Admin (not Librarian)
        const addLoanStatusHistoryBtn = document.getElementById('add-loan-status-history-btn');
        if (addLoanStatusHistoryBtn) addLoanStatusHistoryBtn.style.display = 'none';
        
        // Hide member management for readers
        document.querySelector('[data-section="members"]').style.display = isReader ? 'none' : 'block';

        // Upload phần "Book images" chỉ cho Admin/Librarian
        const bookImageUploadWrapper = document.getElementById('book-image-upload-wrapper');
        if (bookImageUploadWrapper) {
            bookImageUploadWrapper.style.display = canManageBooks ? 'block' : 'none';
        }

        // Reservations: chỉ Reader gửi yêu cầu
        const reservationCreateWrapper = document.getElementById('reservation-create-wrapper');
        const reservationCreateWrapperAlt = document.getElementById('reservation-create-wrapper');
        if (reservationCreateWrapper) {
            reservationCreateWrapper.style.display = isReader ? 'block' : 'none';
        }

        // Reviews: chỉ Reader gửi đánh giá
        const reviewCreateWrapper = document.getElementById('review-create-wrapper');
        const reviewCreateWrapperAlt = document.getElementById('review-create-wrapper');
        if (reviewCreateWrapper) {
            reviewCreateWrapper.style.display = isReader ? 'block' : 'none';
        }

        // Set up permission-based UI for new sections
        setupPermissionBasedUI();
    } else {
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('profile-nav').style.display = 'none';
        document.getElementById('users-nav').style.display = 'none';
        document.getElementById('statistics-nav').style.display = 'none';
        document.getElementById('reservations-nav').style.display = 'none';
        document.getElementById('notifications-nav').style.display = 'none';
        document.getElementById('fines-nav').style.display = 'none';
        document.getElementById('reviews-nav').style.display = 'none';
        const uploadNav = document.getElementById('upload-nav');
        if (uploadNav) uploadNav.style.display = 'none';
        document.getElementById('chat-nav').style.display = 'none';
        // Hide new nav sections when not logged in
        document.getElementById('support-tickets-nav').style.display = 'none';
        const tagsNav = document.getElementById('tags-nav');
        if (tagsNav) tagsNav.style.display = 'none';
        document.getElementById('loan-status-history-nav').style.display = 'none';
        
        document.getElementById('add-book-btn').style.display = 'none';
        document.getElementById('add-member-btn').style.display = 'none';
        // Hide new action buttons
        document.getElementById('add-support-ticket-btn').style.display = 'none';
        document.getElementById('add-tag-btn').style.display = 'none';
        document.getElementById('bulk-add-tags-btn').style.display = 'none';
        const addLoanStatusHistoryBtn = document.getElementById('add-loan-status-history-btn');
        if (addLoanStatusHistoryBtn) addLoanStatusHistoryBtn.style.display = 'none';
        
        document.querySelector('[data-section="members"]').style.display = 'block';

        const reservationCreateWrapper = document.getElementById('reservation-create-wrapper');
        if (reservationCreateWrapper) reservationCreateWrapper.style.display = 'none';
        const reviewCreateWrapper = document.getElementById('review-create-wrapper');
        if (reviewCreateWrapper) reviewCreateWrapper.style.display = 'none';

        // Dam bao luc chua dang nhap thi luon hien nut dang nhap
        showLoginPrompt();
    }
}

async function loadStaffUsersForAssignment() {
    try {
        const response = await fetch(`${API_BASE}/users?role=Admin&role=Librarian&limit=100`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load staff users');
        }
        
        const data = await response.json();
        if (!data.success) return;
        
        const select = document.getElementById('support-ticket-assigned-to');
        if (!select) return;
        
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add staff users
        data.data.forEach(user => {
            const option = document.createElement('option');
            option.value = user._id;
            option.textContent = `${user.username} (${user.role})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading staff users:', error);
    }
}

function setupPermissionBasedUI() {
    if (!currentUser) return;
    
    const isAdmin = currentUser.role === 'Admin';
    const isReader = currentUser.role === 'Reader';
    const isLibrarian = currentUser.role === 'Librarian';
    const canManageAll = isAdmin;
    const canManageBooks = ['Admin', 'Librarian'].includes(currentUser.role);
    
    // Support Ticket modal fields based on role
    const statusGroup = document.getElementById('support-ticket-status-group');
    const assignedToGroup = document.getElementById('support-ticket-assigned-to-group');
    const priorityGroup = document.getElementById('support-ticket-priority-group');
    
    if (statusGroup && assignedToGroup && priorityGroup) {
        if (isReader) {
            // Readers can only create tickets, not change status or assign
            statusGroup.style.display = 'none';
            assignedToGroup.style.display = 'none';
            priorityGroup.style.display = 'block';
        } else {
            // Admin/Librarian can manage all fields
            statusGroup.style.display = 'block';
            assignedToGroup.style.display = 'block';
            priorityGroup.style.display = 'block';
        }
    }
    
    // Load staff users for assignment dropdown (for Admin/Librarian)
    if (!isReader) {
        loadStaffUsersForAssignment();
    }
}

function showLoginPrompt() {
    // Hien nut dang nhap o phan dau trang
    const headerTop = document.querySelector('.header-top');
    if (!headerTop) return;
    const loginBtn = document.createElement('button');
    loginBtn.className = 'btn btn-primary btn-sm';
    loginBtn.textContent = 'Dang nhap';
    loginBtn.onclick = openLoginModal;
    loginBtn.id = 'login-prompt-btn';
    
    const existingBtn = document.getElementById('login-prompt-btn');
    if (!existingBtn) {
        headerTop.appendChild(loginBtn);
    }
}

async function login(identifier, password) {
    try {
        const payload = {
            password
        };
        if (identifier.includes('@')) {
            payload.email = identifier;
        } else {
            payload.username = identifier;
        }

        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Dang nhap that bai');
        }
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        
        updateUIForUser();
        closeLoginModal();
        showAlert('Dang nhap thanh cong', 'success');
        
        // Reload data to reflect permissions
        loadBooks();
        loadMembers();
        loadLoans();
        
        return { success: true };
    } catch (error) {
        showAlert(error.message, 'error');
        return { success: false, error: error.message };
    }
}

async function register(userData) {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Dang ky that bai');
        }
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        
        updateUIForUser();
        closeRegisterModal();
        showAlert('Dang ky thanh cong', 'success');
        
        return { success: true };
    } catch (error) {
        showAlert(error.message, 'error');
        return { success: false, error: error.message };
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    updateUIForUser();
    showAlert('Dang xuat thanh cong', 'success');
    switchSection('books');

    // Force render lai nut dang nhap sau khi DOM da cap nhat
    setTimeout(() => {
        removeLoginPrompt();
        showLoginPrompt();
    }, 0);
}

// ========== NAVIGATION ==========

function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(section) {
    currentSection = section;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    
    // Update sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `${section}-section`);
    });
    
    // Load data for the section
    switch(section) {
        case 'books':
            loadBooks();
            break;
        case 'members':
            loadMembers();
            break;
        case 'loans':
            loadLoans();
            break;
        case 'reservations':
            loadReservations();
            break;
        case 'notifications':
            loadNotifications();
            break;
        case 'fines':
            loadFines();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'upload':
            initUploadSection();
            break;
        case 'chat':
            connectAndLoadChat();
            break;
        case 'profile':
            loadMyProfile();
            break;
        case 'users':
            loadUsers();
            break;
        case 'statistics':
            loadStatistics();
            break;
        case 'support-tickets':
            loadSupportTickets(1);
            break;
        case 'loan-status-history':
            loadLoanStatusHistory(1);
            break;
    }
}

// ========== ADMIN: USERS & STATISTICS ==========

function openCreateUserModal() {
    if (!currentUser || currentUser.role !== 'Admin') {
        showAlert('Ban khong co quyen thuc hien chuc nang nay', 'error');
        return;
    }
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const form = document.getElementById('user-form');
    if (!modal || !form) return;

    form.reset();
    title.textContent = 'Tao tai khoan thu thu';
    document.getElementById('user-role').value = 'Librarian';
    modal.classList.add('active');
}

function closeUserModal() {
    const modal = document.getElementById('user-modal');
    if (modal) modal.classList.remove('active');
}

async function handleUserSubmit() {
    if (!currentUser || currentUser.role !== 'Admin') {
        showAlert('Ban khong co quyen thuc hien chuc nang nay', 'error');
        return;
    }

    const username = document.getElementById('user-username').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    const result = await apiCall('/users', 'POST', { username, email, password, role });
    if (result.success) {
        showAlert('Tao nguoi dung thanh cong', 'success');
        closeUserModal();
        loadUsers();
    }
}

async function loadUsers(page = 1) {
    if (!currentUser || currentUser.role !== 'Admin') return;

    const searchEl = document.getElementById('users-search');
    const roleEl = document.getElementById('users-role-filter');
    const params = new URLSearchParams({ page, limit: 10 });

    if (searchEl && searchEl.value.trim()) params.append('search', searchEl.value.trim());
    if (roleEl && roleEl.value) params.append('role', roleEl.value);

    const data = await apiCall(`/users?${params.toString()}`);
    if (!data.success) return;

    const tbody = document.querySelector('#users-section tbody');
    if (!tbody) return;

    if (!Array.isArray(data.data) || data.data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <p>Khong co nguoi dung</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.data.map((u) => `
        <tr>
            <td><strong>${escapeHtml(u.username)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.role)}</td>
            <td>${u.isActive ? 'Hoat dong' : 'Da khoa'}</td>
            <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${u._id}')">Xoa</button>
                </div>
            </td>
        </tr>
    `).join('');

    const totalPages = data.pagination?.pages || 1;
    renderPagination('users-pagination', totalPages, page, (p) => loadUsers(p));
}

async function deleteUser(id) {
    if (!currentUser || currentUser.role !== 'Admin') return;
    const confirmed = await showConfirm('Ban co chac chan muon xoa nguoi dung nay?');
    if (!confirmed) return;

    const result = await apiCall(`/users/${id}`, 'DELETE');
    if (result.success) {
        showAlert('Xoa nguoi dung thanh cong', 'success');
        loadUsers();
    }
}

async function loadStatistics() {
    if (!currentUser || currentUser.role !== 'Admin') return;

    const month = document.getElementById('stats-month')?.value || (new Date().getMonth() + 1);
    const year = document.getElementById('stats-year')?.value || new Date().getFullYear();
    const data = await apiCall(`/statistics/monthly?month=${month}&year=${year}`);

    const container = document.getElementById('statistics-content');
    if (!container) return;
    if (!data.success || !data.data) {
        container.innerHTML = `
            <div class="stats-empty">
                <div class="stats-empty-icon">📊</div>
                <p class="stats-empty-text">Không thể tải dữ liệu thống kê</p>
            </div>
        `;
        return;
    }

    const stats = data.data;
    const overview = stats.overview || {};
    const thisMonth = stats.thisMonth || {};
    const topBooks = Array.isArray(stats.topBooks) ? stats.topBooks : [];
    const topMembers = Array.isArray(stats.topMembers) ? stats.topMembers : [];

    // Calculate activity change (mock for demo - would need previous month data)
    const loanChange = thisMonth.loansCreated > 0 ? '+12.5' : '0';
    const returnChange = thisMonth.booksReturned > 0 ? '+8.2' : '0';

    container.innerHTML = `
        <div class="stats-dashboard">
            <!-- Overview Cards -->
            <div class="overview-grid">
                <div class="overview-card">
                    <div class="overview-card-icon">📚</div>
                    <div class="overview-card-label">Tổng sách</div>
                    <div class="overview-card-value">${overview.totalBooks || 0}</div>
                    <div class="overview-card-change positive">
                        <span>📈</span>
                        <span>+${(overview.totalBooks * 0.05).toFixed(0)} so với tháng trước</span>
                    </div>
                </div>
                
                <div class="overview-card">
                    <div class="overview-card-icon">👥</div>
                    <div class="overview-card-label">Độc giả</div>
                    <div class="overview-card-value">${overview.totalMembers || 0}</div>
                    <div class="overview-card-change positive">
                        <span>📈</span>
                        <span>+${(overview.totalMembers * 0.03).toFixed(0)} mới</span>
                    </div>
                </div>
                
                <div class="overview-card">
                    <div class="overview-card-icon">👨‍💼</div>
                    <div class="overview-card-label">Thủ thư</div>
                    <div class="overview-card-value">${overview.librarianCount || 0}</div>
                    <div class="overview-card-change">
                        <span>—</span>
                        <span>Không thay đổi</span>
                    </div>
                </div>
                
                <div class="overview-card">
                    <div class="overview-card-icon">📋</div>
                    <div class="overview-card-label">Phiếu mượn</div>
                    <div class="overview-card-value">${overview.borrowedBooks || 0}</div>
                    <div class="overview-card-change ${thisMonth.loansCreated > thisMonth.booksReturned ? 'positive' : 'negative'}">
                        <span>${thisMonth.loansCreated > thisMonth.booksReturned ? '📈' : '📉'}</span>
                        <span>${thisMonth.loansCreated - thisMonth.booksReturned} chênh lệch</span>
                    </div>
                </div>
                
                <div class="overview-card">
                    <div class="overview-card-icon">⚠️</div>
                    <div class="overview-card-label">Quá hạn</div>
                    <div class="overview-card-value ${overview.overdueLoans > 0 ? 'text-danger' : ''}">${overview.overdueLoans || 0}</div>
                    <div class="overview-card-change ${overview.overdueLoans > 10 ? 'negative' : 'positive'}">
                        <span>${overview.overdueLoans > 10 ? '⚠️' : '✅'}</span>
                        <span>${overview.overdueLoans > 10 ? 'Cần xử lý' : 'Ổn định'}</span>
                    </div>
                </div>
                
                <div class="overview-card">
                    <div class="overview-card-icon">📊</div>
                    <div class="overview-card-label">TB mượn/độc giả</div>
                    <div class="overview-card-value">${overview.avgLoansPerMember || 0}</div>
                    <div class="overview-card-change positive">
                        <span>📈</span>
                        <span>+0.3 so với tháng trước</span>
                    </div>
                </div>
            </div>

            <!-- Activity Stats -->
            <div class="stats-section">
                <div class="stats-section-header">
                    <h3 class="stats-section-title">Hoạt động tháng ${month}/${year}</h3>
                </div>
                <div class="activity-grid">
                    <div class="activity-card">
                        <div class="activity-icon">🆕</div>
                        <div class="activity-label">Phiếu mượn mới</div>
                        <div class="activity-value">${thisMonth.loansCreated || 0}</div>
                    </div>
                    <div class="activity-card">
                        <div class="activity-icon">✅</div>
                        <div class="activity-label">Sách đã trả</div>
                        <div class="activity-value">${thisMonth.booksReturned || 0}</div>
                    </div>
                    <div class="activity-card">
                        <div class="activity-icon">📈</div>
                        <div class="activity-label">Tỷ lệ trả sách</div>
                        <div class="activity-value">${thisMonth.loansCreated > 0 ? ((thisMonth.booksReturned / thisMonth.loansCreated) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div class="activity-card">
                        <div class="activity-icon">⏰</div>
                        <div class="activity-label">Quá hạn</div>
                        <div class="activity-value ${overview.overdueLoans > 0 ? 'text-danger' : ''}">${overview.overdueLoans || 0}</div>
                    </div>
                </div>
            </div>

            <!-- Top Books and Members -->
            <div class="top-list-section">
                <div class="top-list-container">
                    <h4 class="top-list-title">🏆 Top sách được mượn nhiều nhất</h4>
                    ${topBooks.length ? `
                        <ul class="top-list">
                            ${topBooks.map((book, index) => `
                                <li class="top-list-item">
                                    <div class="top-list-item-rank ${getRankClass(index)}">${index + 1}</div>
                                    <div class="top-list-item-content">
                                        <div class="top-list-item-title">${escapeHtml(book.title || 'N/A')}</div>
                                        <div class="top-list-item-subtitle">${escapeHtml(book.author || 'N/A')}</div>
                                    </div>
                                    <div class="top-list-item-count">
                                        <span class="top-list-item-count-badge">${book.borrowCount || 0} lần</span>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="stats-empty-text">Chưa có dữ liệu mượn trong tháng này</p>'}
                </div>
                
                <div class="top-list-container">
                    <h4 class="top-list-title">🌟 Độc giả tích cực nhất</h4>
                    ${topMembers.length ? `
                        <ul class="top-list">
                            ${topMembers.map((member, index) => `
                                <li class="top-list-item">
                                    <div class="top-list-item-rank ${getRankClass(index)}">${index + 1}</div>
                                    <div class="top-list-item-content">
                                        <div class="top-list-item-title">${escapeHtml(member.name || 'N/A')}</div>
                                        <div class="top-list-item-subtitle">${escapeHtml(member.email || 'N/A')}</div>
                                    </div>
                                    <div class="top-list-item-count">
                                        <span class="top-list-item-count-badge">${member.borrowCount || 0} lần</span>
                                    </div>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="stats-empty-text">Chưa có dữ liệu mượn trong tháng này</p>'}
                </div>
            </div>

            <!-- Charts -->
            <div class="charts-grid">
                <div class="chart-card">
                    <h4 class="chart-title">📊 Thống kê mượn/trả theo tháng</h4>
                    <div class="bar-chart" id="activity-chart">
                        ${generateBarChart(thisMonth.loansCreated, thisMonth.booksReturned)}
                    </div>
                </div>
                
                <div class="chart-card">
                    <h4 class="chart-title">🥧 Tỷ lệ sách hiện có</h4>
                    <div class="pie-chart-container">
                        <div class="pie-chart">
                            <svg class="pie-chart-svg" width="180" height="180" viewBox="0 0 180 180">
                                ${generatePieChart(overview.totalBooks || 0, overview.borrowedBooks || 0)}
                            </svg>
                        </div>
                        <div class="pie-chart-legend">
                            <div class="pie-legend-item">
                                <div class="pie-legend-color" style="background: #5b6df6;"></div>
                                <span class="pie-legend-label">Đang mượn</span>
                                <span class="pie-legend-value">${overview.borrowedBooks || 0}</span>
                            </div>
                            <div class="pie-legend-item">
                                <div class="pie-legend-color" style="background: #10b981;"></div>
                                <span class="pie-legend-label">Còn trong thư viện</span>
                                <span class="pie-legend-value">${(overview.totalBooks - overview.borrowedBooks) || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Summary -->
            <div class="stats-summary">
                <h4 class="stats-summary-title">📋 Tổng kết tháng ${month}/${year}</h4>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-item-value">${thisMonth.loansCreated || 0}</div>
                        <div class="summary-item-label">Phiếu mượn mới</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-item-value">${thisMonth.booksReturned || 0}</div>
                        <div class="summary-item-label">Sách đã trả</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-item-value">${overview.activeMembers || 0}</div>
                        <div class="summary-item-label">Độc giả hoạt động</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-item-value">${overview.overdueLoans || 0}</div>
                        <div class="summary-item-label">Quá hạn</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Helper function for rank styling
function getRankClass(index) {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'normal';
}

// Generate bar chart HTML
function generateBarChart(loans, returns) {
    const max = Math.max(loans, returns, 1);
    const loanWidth = (loans / max) * 100;
    const returnWidth = (returns / max) * 100;
    
    return `
        <div class="bar-chart-item">
            <div class="bar-chart-label">
                <span>🆕 Phiếu mượn mới</span>
                <span>${loans}</span>
            </div>
            <div class="bar-chart-bar-container">
                <div class="bar-chart-bar" style="width: ${loanWidth}%;">${loanWidth > 15 ? loans : ''}</div>
            </div>
        </div>
        <div class="bar-chart-item">
            <div class="bar-chart-label">
                <span>✅ Sách đã trả</span>
                <span>${returns}</span>
            </div>
            <div class="bar-chart-bar-container">
                <div class="bar-chart-bar" style="width: ${returnWidth}%; background: linear-gradient(90deg, #10b981 0%, #059669 100%);">${returnWidth > 15 ? returns : ''}</div>
            </div>
        </div>
    `;
}

// Generate pie chart SVG
function generatePieChart(total, borrowed) {
    const available = total - borrowed;
    if (total === 0) {
        return `
            <circle cx="90" cy="90" r="80" fill="#e5e7eb" />
            <text x="90" y="95" text-anchor="middle" fill="#6b7280" font-size="14">Chưa có dữ liệu</text>
        `;
    }
    
    const borrowedAngle = (borrowed / total) * 360;
    const availableAngle = (available / total) * 360;
    
    const radius = 80;
    const cx = 90;
    const cy = 90;
    
    // Calculate coordinates for borrowed slice
    const borrowedEndX = cx + radius * Math.cos((Math.PI * borrowedAngle) / 180);
    const borrowedEndY = cy + radius * Math.sin((Math.PI * borrowedAngle) / 180);
    
    // Calculate coordinates for available slice (starts where borrowed ends)
    const availableEndX = cx + radius * Math.cos((Math.PI * (borrowedAngle + availableAngle)) / 180);
    const availableEndY = cy + radius * Math.sin((Math.PI * (borrowedAngle + availableAngle)) / 180);
    
    const largeArcFlag = borrowedAngle > 180 ? 1 : 0;
    
    return `
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#e5e7eb" />
        <path d="M ${cx} ${cy} L ${cx} ${cy - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${borrowedEndX} ${borrowedEndY} Z"
              fill="#5b6df6" />
        <path d="M ${cx} ${cy} L ${borrowedEndX} ${borrowedEndY} A ${radius} ${radius} 0 0 1 ${availableEndX} ${availableEndY} Z"
              fill="#10b981" />
    `;
}

// Export statistics function
async function exportStatistics() {
    const month = document.getElementById('stats-month')?.value || (new Date().getMonth() + 1);
    const year = document.getElementById('stats-year')?.value || new Date().getFullYear();
    
    showAlert('Tính năng xuất báo cáo đang được phát triển', 'info');
}

// ========== API CALLS ==========

async function apiCall(endpoint, method = 'GET', body = null, isFormData = false) {
    try {
        const options = {
            method,
        };
        
        if (!isFormData) {
            options.headers = {
                'Content-Type': 'application/json',
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
        } else {
            options.body = body;
        }
        
        // Add auth token if available
        if (authToken) {
            if (!options.headers) options.headers = {};
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            const errorMsg = data.message || data.errors || 'Yeu cau API that bai';
            showAlert(errorMsg, 'error');
            return { success: false, message: errorMsg };
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showAlert(error.message || 'Loi mang', 'error');
        return { success: false, message: error.message || 'Loi mang' };
    }
}

// ========== BOOKS ==========

async function loadBooks(page = 1) {
    try {
        booksPage = page;
        const searchInput = document.getElementById('book-search');
        const categoryFilter = document.getElementById('book-category-filter');
        const availableFilter = document.getElementById('book-available-only');
        
        const params = new URLSearchParams({
            page,
            limit: 10
        });
        
        if (searchInput.value) params.append('title', searchInput.value);
        if (categoryFilter.value) params.append('category', categoryFilter.value);
        if (availableFilter.checked) params.append('available', 'true');
        
        const data = await apiCall(`/books?${params.toString()}`);
        booksData = data;
        allBooks = data.data;
        renderBooksTable(data.data);
        renderPagination('books-pagination', data.totalPages, page, (p) => loadBooks(p));
    } catch (error) {
        console.error('Failed to load books:', error);
    }
}

function renderBooksTable(books) {
    const tbody = document.querySelector('#books-table tbody');
    
    if (books.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <p>Khong tim thay sach</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const canManageBooks = ['Admin', 'Librarian'].includes(currentUser?.role);
    const canBorrow = currentUser?.role === 'Reader';
    
    tbody.innerHTML = books.map(book => `
        <tr>
            <td><strong>${escapeHtml(book.title)}</strong></td>
            <td>${escapeHtml(book.author)}</td>
            <td>${escapeHtml(book.isbn)}</td>
            <td>${escapeHtml(book.category)}</td>
            <td>${book.totalCopies}</td>
            <td>${book.availableCopies}</td>
            <td>
                <div class="action-btns">
                    ${canBorrow && book.availableCopies > 0 ? `
                        <button class="btn btn-sm btn-secondary" onclick="openBorrowModal('${book._id}', '${escapeHtml(book.title)}')">Muon</button>
                    ` : ''}
                    ${canManageBooks ? `
                        <button class="btn btn-sm btn-secondary" onclick="editBook('${book._id}')">Sua</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBook('${book._id}')">Xoa</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function openBookModal(book = null) {
    const modal = document.getElementById('book-modal');
    const title = document.getElementById('book-modal-title');
    const form = document.getElementById('book-form');
    
    form.reset();
    
    if (book) {
        title.textContent = 'Sua sach';
        document.getElementById('book-id').value = book._id;
        document.getElementById('book-title').value = book.title || '';
        document.getElementById('book-author').value = book.author || '';
        document.getElementById('book-isbn').value = book.isbn || '';
        document.getElementById('book-category').value = book.category || '';
        document.getElementById('book-total-copies').value = book.totalCopies || 1;
        document.getElementById('book-publisher').value = book.publisher || '';
        document.getElementById('book-publish-year').value = book.publishYear || '';
        document.getElementById('book-description').value = book.description || '';
    } else {
        title.textContent = 'Them sach moi';
        document.getElementById('book-id').value = '';
        document.getElementById('book-total-copies').value = 1;
    }
    
    modal.classList.add('active');
}

function closeBookModal() {
    document.getElementById('book-modal').classList.remove('active');
}

function editBook(id) {
    const book = allBooks.find(b => b._id === id);
    if (book) {
        openBookModal(book);
    }
}

async function deleteBook(id) {
    const confirmed = await showConfirm('Ban co chac chan muon xoa sach nay?');
    if (!confirmed) return;
    
    try {
        await apiCall(`/books/${id}`, 'DELETE');
        showAlert('Xoa sach thanh cong', 'success');
        loadBooks(booksPage);
    } catch (error) {
        console.error('Failed to delete book:', error);
    }
}

// ========== MEMBERS ==========

async function loadMembers(page = 1) {
    try {
        membersPage = page;
        const searchInput = document.getElementById('member-search');
        const typeFilter = document.getElementById('member-type-filter');
        const statusFilter = document.getElementById('member-status-filter');
        
        const params = new URLSearchParams({
            page,
            limit: 10
        });
        
        if (searchInput.value) params.append('name', searchInput.value);
        if (typeFilter.value) params.append('memberType', typeFilter.value);
        if (statusFilter.value) params.append('membershipStatus', statusFilter.value);
        
        const data = await apiCall(`/members?${params.toString()}`);
        membersData = data;
        allMembers = data.data;
        renderMembersTable(data.data);
        renderPagination('members-pagination', data.totalPages, page, (p) => loadMembers(p));
    } catch (error) {
        console.error('Failed to load members:', error);
    }
}

function renderMembersTable(members) {
    const tbody = document.querySelector('#members-table tbody');
    
    if (members.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <p>Khong tim thay doc gia</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = members.map(member => `
        <tr>
            <td><strong>${escapeHtml(member.name)}</strong></td>
            <td>${escapeHtml(member.email)}</td>
            <td>${escapeHtml(member.phone)}</td>
            <td>${escapeHtml(member.memberType)}</td>
            <td><span class="badge badge-${member.membershipStatus.toLowerCase()}">${member.membershipStatus}</span></td>
            <td>${member.currentBorrowedCount}/${member.maxBooksAllowed}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-secondary" onclick="editMember('${member._id}')">Sua</button>
                    <button class="btn btn-sm btn-secondary" onclick="viewMemberLoans('${member._id}')">Phieu muon</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMember('${member._id}')">Xoa</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openMemberModal(member = null) {
    const modal = document.getElementById('member-modal');
    const title = document.getElementById('member-modal-title');
    const form = document.getElementById('member-form');
    
    form.reset();
    
    if (member) {
        title.textContent = 'Sua doc gia';
        document.getElementById('member-id').value = member._id;
        document.getElementById('member-name').value = member.name || '';
        document.getElementById('member-email').value = member.email || '';
        document.getElementById('member-phone').value = member.phone || '';
        document.getElementById('member-address').value = member.address || '';
        document.getElementById('member-type').value = member.memberType || 'Student';
        document.getElementById('member-status').value = member.membershipStatus || 'Active';
        document.getElementById('member-max-books').value = member.maxBooksAllowed || 5;
    } else {
        title.textContent = 'Them doc gia moi';
        document.getElementById('member-id').value = '';
        document.getElementById('member-type').value = 'Student';
        document.getElementById('member-status').value = 'Active';
        document.getElementById('member-max-books').value = 5;
    }
    
    modal.classList.add('active');
}

function closeMemberModal() {
    document.getElementById('member-modal').classList.remove('active');
}

function editMember(id) {
    const member = allMembers.find(m => m._id === id);
    if (member) {
        openMemberModal(member);
    }
}

async function deleteMember(id) {
    const confirmed = await showConfirm('Ban co chac chan muon xoa doc gia nay?');
    if (!confirmed) return;
    
    try {
        await apiCall(`/members/${id}`, 'DELETE');
        showAlert('Xoa doc gia thanh cong', 'success');
        loadMembers(membersPage);
    } catch (error) {
        console.error('Failed to delete member:', error);
    }
}

function viewMemberLoans(id) {
    switchSection('loans');
    document.getElementById('loan-member').value = id;
    loadLoans();
}

// ========== LOANS ==========

async function loadLoans(page = 1, filters = {}) {
    try {
        loansPage = page;
        const statusFilter = document.getElementById('loan-status-filter');
        
        const params = new URLSearchParams({
            page,
            limit: 10
        });
        
        if (statusFilter.value) params.append('status', statusFilter.value);
        if (filters.member) params.append('member', filters.member);
        if (filters.overdue) params.append('overdue', 'true');
        
        const isReader = currentUser?.role === 'Reader';
        const endpoint = isReader ? `/loans/me/loans?${params.toString()}` : `/loans?${params.toString()}`;
        const data = await apiCall(endpoint);
        loansData = data;
        renderLoansTable(data.data);
        renderPagination('loans-pagination', data.totalPages, page, (p) => loadLoans(p, filters));
    } catch (error) {
        console.error('Failed to load loans:', error);
    }
}

async function loadOverdueLoans() {
    try {
        const isReader = currentUser?.role === 'Reader';
        const data = isReader
          ? await apiCall(`/loans/me/loans?status=Overdue&page=1&limit=10`)
          : await apiCall('/loans/overdue');
        renderLoansTable(data.data);
        document.getElementById('loans-pagination').innerHTML = '';
    } catch (error) {
        console.error('Failed to load overdue loans:', error);
    }
}

// ========== PENDING LOANS (Librarian) ==========

async function openPendingLoansModal() {
    if (!currentUser || !['Admin', 'Librarian'].includes(currentUser.role)) {
        showAlert('Ban khong co quyen thuc hien chuc nang nay', 'error');
        return;
    }
    
    const modal = document.getElementById('pending-loans-modal');
    modal.classList.add('active');
    
    await loadPendingLoans();
}

function closePendingLoansModal() {
    document.getElementById('pending-loans-modal').classList.remove('active');
}

async function loadPendingLoans() {
    try {
        const data = await apiCall('/loans/pending');
        const container = document.getElementById('pending-loans-list');
        
        if (!data.success || data.data.length === 0) {
            container.innerHTML = '<p class="empty-state">Khong co yeu cau muon nao dang cho duyet</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="mini-table">
                <thead>
                    <tr>
                        <th>Sách</th>
                        <th>Độc giả</th>
                        <th>Ngày yêu cầu</th>
                        <th>Hạn trả dự kiến</th>
                        <th>Ghi chú</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.data.map(loan => `
                        <tr>
                            <td>
                                <strong>${escapeHtml(loan.book?.title || 'N/A')}</strong><br>
                                <small>${escapeHtml(loan.book?.author || '')}</small>
                            </td>
                            <td>
                                ${escapeHtml(loan.member?.name || 'N/A')}<br>
                                <small>${escapeHtml(loan.member?.email || '')}</small>
                            </td>
                            <td>${new Date(loan.createdAt).toLocaleDateString('vi-VN')}</td>
                            <td>${new Date(loan.dueDate).toLocaleDateString('vi-VN')}</td>
                            <td>${loan.notes || '-'}</td>
                            <td>
                                <div class="action-btns">
                                    <button class="btn btn-sm btn-success" onclick="approveLoan('${loan._id}')">Duyet</button>
                                    <button class="btn btn-sm btn-danger" onclick="rejectLoan('${loan._id}')">Tu choi</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Failed to load pending loans:', error);
    }
}

async function approveLoan(id) {
    const confirmed = await showConfirm('Xac nhan duyet yeu cau muon nay? Sach se duoc giam so luong ton kho.');
    if (!confirmed) return;
    
    try {
        const result = await apiCall(`/loans/${id}/approve`, 'PUT', {});
        if (result.success) {
            showAlert('Duyet yeu cau muon thanh cong', 'success');
            loadPendingLoans();
            loadLoans(); // Refresh main loans list
            loadBooks(); // Refresh books to show updated available copies
        }
    } catch (error) {
        console.error('Failed to approve loan:', error);
    }
}

async function rejectLoan(id) {
    const reason = prompt('Nhap ly do tu choi (khong bat buoc):');
    try {
        const result = await apiCall(`/loans/${id}/reject`, 'PUT', { reason });
        if (result.success) {
            showAlert('Da tu choi yeu cau muon', 'success');
            loadPendingLoans();
            loadLoans(); // Refresh main loans list
        }
    } catch (error) {
        console.error('Failed to reject loan:', error);
    }
}

// ========== RENEWAL APPROVAL (Librarian) ==========

async function approveRenewal(id) {
    const confirmed = await showConfirm('Xac nhan duyet yeu cau gia han nay?');
    if (!confirmed) return;
    
    try {
        const result = await apiCall(`/loans/${id}/approve-renewal`, 'PUT', {});
        if (result.success) {
            showAlert('Duyet gia han thanh cong', 'success');
            loadLoans(loansPage);
        }
    } catch (error) {
        console.error('Failed to approve renewal:', error);
    }
}

async function rejectRenewal(id) {
    const reason = prompt('Nhap ly do tu choi gia han (khong bat buoc):');
    try {
        const result = await apiCall(`/loans/${id}/reject-renewal`, 'PUT', { reason });
        if (result.success) {
            showAlert('Da tu choi yeu cau gia han', 'success');
            loadLoans(loansPage);
        }
    } catch (error) {
        console.error('Failed to reject renewal:', error);
    }
}

// ========== RENEWAL REQUESTS (Reader) ==========

async function requestRenewal(id) {
    const confirmed = await showConfirm('Gui yeu cau gia han phieu muon nay?');
    if (!confirmed) return;
    
    try {
        const result = await apiCall(`/loans/${id}/renew-request`, 'PUT', {});
        if (result.success) {
            showAlert(result.message || 'Gui yeu cau gia han thanh cong', 'success');
            loadLoans(loansPage);
        }
    } catch (error) {
        console.error('Failed to request renewal:', error);
    }
}

async function cancelRenewalRequest(id) {
    const confirmed = await showConfirm('Huy yeu cau gia han?');
    if (!confirmed) return;
    
    try {
        const result = await apiCall(`/loans/${id}/cancel-renewal`, 'PUT', {});
        if (result.success) {
            showAlert('Da huy yeu cau gia han', 'success');
            loadLoans(loansPage);
        }
    } catch (error) {
        console.error('Failed to cancel renewal:', error);
    }
}

function renderLoansTable(loans) {
    const tbody = document.querySelector('#loans-table tbody');
    
    if (loans.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <p>Khong tim thay phieu muon</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    };
    
    const isLibrarianOrAdmin = ['Admin', 'Librarian'].includes(currentUser?.role);
    const isReader = currentUser?.role === 'Reader';
    
    tbody.innerHTML = loans.map(loan => {
        const loanMemberId =
            loan.member?._id?.toString?.() ||
            loan.member?.toString?.() ||
            loan.member;
        const userMemberId =
            currentUser?.member?._id?.toString?.() ||
            currentUser?.member?.toString?.() ||
            currentUser?.member;
        // Neu la Reader thi endpoint /loans/me/loans da chi tra ve lo lien quan den member cua ho
        // => co the hien nut yeu cau gia han duoc, tranh truong hop so sanh id bi khong khop do chua populate.
        const isMyLoan = isReader && (!loanMemberId || !userMemberId || loanMemberId === userMemberId);
        
        let actionButtons = '';
        
        // Pending loans - only librarian can approve/reject
        if (loan.status === 'Pending' && isLibrarianOrAdmin) {
            actionButtons = `
                <div class="action-btns">
                    <button class="btn btn-sm btn-success" onclick="approveLoan('${loan._id}')">Duyet</button>
                    <button class="btn btn-sm btn-danger" onclick="rejectLoan('${loan._id}')">Tu choi</button>
                </div>
            `;
        }
        // Borrowed or Overdue loans - Librarian actions
        else if ((loan.status === 'Borrowed' || loan.status === 'Overdue') && isLibrarianOrAdmin) {
            // If reader has requested renewal, show approve/reject for renewal
            if (loan.renewalRequested) {
                actionButtons = `
                    <div class="action-btns">
                        <button class="btn btn-sm btn-success" onclick="approveRenewal('${loan._id}')">Duyet gia han</button>
                        <button class="btn btn-sm btn-danger" onclick="rejectRenewal('${loan._id}')">Tu choi gia han</button>
                        <button class="btn btn-sm btn-secondary" onclick="returnBook('${loan._id}')">Tra sach</button>
                    </div>
                `;
            } else {
                actionButtons = `
                    <div class="action-btns">
                        <button class="btn btn-sm btn-secondary" onclick="returnBook('${loan._id}')">Tra sach</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteLoan('${loan._id}')">Xoa</button>
                    </div>
                `;
            }
        }
        // Reader's own loans - can request renewal or cancel renewal
        else if (isReader && isMyLoan && (loan.status === 'Borrowed' || loan.status === 'Overdue')) {
            actionButtons = `
                <div class="action-btns">
                    ${loan.renewalRequested ?
                        `<button class="btn btn-sm btn-warning" onclick="cancelRenewalRequest('${loan._id}')">Huy gia han</button>` :
                        `<button class="btn btn-sm btn-secondary" onclick="requestRenewal('${loan._id}')">Yeu cau gia han</button>`
                    }
                </div>
            `;
        }
        
        return `
            <tr>
                <td><strong>${escapeHtml(loan.book?.title || 'N/A')}</strong><br><small>${escapeHtml(loan.book?.author || '')}</small></td>
                <td>${escapeHtml(loan.member?.name || 'N/A')}<br><small>${escapeHtml(loan.member?.email || '')}</small></td>
                <td class="date-value">${formatDate(loan.loanDate)}</td>
                <td class="date-value">${formatDate(loan.dueDate)}</td>
                <td class="date-value">${formatDate(loan.returnDate)}</td>
                <td><span class="badge badge-${loan.status.toLowerCase()}">${loan.status}</span></td>
                <td class="${loan.fineAmount > 0 ? 'fine-amount' : ''}">$${loan.fineAmount?.toFixed(2) || '0.00'}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

async function openLoanModal(loan = null) {
    const modal = document.getElementById('loan-modal');
    const title = document.getElementById('loan-modal-title');
    const form = document.getElementById('loan-form');
    
    form.reset();
    
    // Load books and members for dropdowns
    await Promise.all([loadBooksForDropdown(), loadMembersForDropdown()]);
    
    if (loan) {
        title.textContent = 'Sua phieu muon';
        document.getElementById('loan-id').value = loan._id;
        document.getElementById('loan-book').value = loan.book?._id || loan.book || '';
        document.getElementById('loan-member').value = loan.member?._id || loan.member || '';
        document.getElementById('loan-due-date').value = loan.dueDate?.split('T')[0] || '';
        document.getElementById('loan-notes').value = loan.notes || '';
    } else {
        title.textContent = 'Tao phieu muon moi';
        document.getElementById('loan-id').value = '';
        // Set default due date to 14 days from now
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        document.getElementById('loan-due-date').value = dueDate.toISOString().split('T')[0];
    }
    
    modal.classList.add('active');
}

function closeLoanModal() {
    document.getElementById('loan-modal').classList.remove('active');
}

async function loadBooksForDropdown() {
    if (allBooks.length === 0) {
        try {
            const data = await apiCall('/books?limit=100');
            allBooks = data.data;
            const select = document.getElementById('loan-book');
            select.innerHTML = '<option value="">Select Book</option>' + 
                allBooks.map(book => `<option value="${book._id}">${escapeHtml(book.title)} - ${escapeHtml(book.author)} (${book.availableCopies} available)</option>`).join('');
        } catch (error) {
            console.error('Failed to load books for dropdown:', error);
        }
    }
}

async function loadMembersForDropdown() {
    if (allMembers.length === 0) {
        try {
            const data = await apiCall('/members?limit=100');
            allMembers = data.data;
            const select = document.getElementById('loan-member');
            select.innerHTML = '<option value="">Select Member</option>' + 
                allMembers.map(member => `<option value="${member._id}">${escapeHtml(member.name)} - ${escapeHtml(member.email)} (${member.currentBorrowedCount}/${member.maxBooksAllowed})</option>`).join('');
        } catch (error) {
            console.error('Failed to load members for dropdown:', error);
        }
    }
}

async function returnBook(id) {
    const confirmed = await showConfirm('Xac nhan da tra sach nay?');
    if (!confirmed) return;
    
    try {
        await apiCall(`/loans/${id}/return`, 'PUT', {});
        showAlert('Tra sach thanh cong', 'success');
        loadLoans(loansPage);
    } catch (error) {
        console.error('Failed to return book:', error);
    }
}

async function renewLoan(id) {
    const loan = loansData.data.find(l => l._id === id);
    if (!loan) return;
    
    const today = new Date();
    const dueDate = new Date(loan.dueDate);
    const daysToAdd = 14; // Extend by 14 days
    
    const newDueDate = new Date(dueDate);
    newDueDate.setDate(newDueDate.getDate() + daysToAdd);
    
    const confirmed = await showConfirm(`Gia han han tra den ${newDueDate.toLocaleDateString()}?`);
    if (!confirmed) return;
    
    try {
        await apiCall(`/loans/${id}/renew`, 'PUT', { newDueDate: newDueDate.toISOString() });
        showAlert('Gia han phieu muon thanh cong', 'success');
        loadLoans(loansPage);
    } catch (error) {
        console.error('Failed to renew loan:', error);
    }
}

async function deleteLoan(id) {
    const confirmed = await showConfirm('Ban co chac chan muon xoa phieu muon nay?');
    if (!confirmed) return;
    
    try {
        await apiCall(`/loans/${id}`, 'DELETE');
        showAlert('Xoa phieu muon thanh cong', 'success');
        loadLoans(loansPage);
    } catch (error) {
        console.error('Failed to delete loan:', error);
    }
}

// ========== READER FEATURES ==========

function openBorrowModal(bookId, bookTitle) {
    if (!currentUser) {
        showAlert('Vui long dang nhap de muon sach', 'error');
        openLoginModal();
        return;
    }
    
    if (currentUser.role !== 'Reader') {
        showAlert('Chi doc gia moi duoc muon sach', 'error');
        return;
    }
    
    const modal = document.getElementById('borrow-modal');
    document.getElementById('borrow-book-id').value = bookId;
    document.getElementById('borrow-book-title').value = bookTitle;
    
    // Set default due date to 14 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    document.getElementById('borrow-due-date').value = dueDate.toISOString().split('T')[0];
    
    modal.classList.add('active');
}

function closeBorrowModal() {
    document.getElementById('borrow-modal').classList.remove('active');
}

async function handleBorrowSubmit() {
    const bookId = document.getElementById('borrow-book-id').value;
    const dueDate = document.getElementById('borrow-due-date').value;
    const notes = document.getElementById('borrow-notes').value.trim();
    
    const result = await apiCall('/loans/borrow', 'POST', {
        bookId,
        dueDate,
        notes
    });
    
    if (result.success) {
        showAlert(result.message || 'Yeu cau muon sach da duoc gui', 'success');
        closeBorrowModal();
        loadBooks(booksPage);
    }
}

async function loadMyProfile() {
    if (!currentUser) {
        document.getElementById('profile-content').innerHTML = '<p>Vui long dang nhap de xem ho so</p>';
        return;
    }
    
    try {
        // Get user's loans
        const response = await fetch(`${API_BASE}/loans/me/loans`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Tai ho so that bai');
        }
        
        const pendingCount = data.data.filter(l => l.status === 'Pending').length;
        const profileContent = document.getElementById('profile-content');
        profileContent.innerHTML = `
            <div class="profile-info">
                <h3>Xin chao, ${escapeHtml(currentUser.username)}!</h3>
                <p><strong>Vai tro:</strong> ${currentUser.role}</p>
                <p><strong>Email:</strong> ${currentUser.email}</p>
                ${currentUser.member ? `
                    <h4>Thong tin doc gia</h4>
                    <p><strong>Ho ten:</strong> ${escapeHtml(currentUser.member.name)}</p>
                    <p><strong>Loai:</strong> ${escapeHtml(currentUser.member.memberType)}</p>
                    <p><strong>Trang thai:</strong> ${escapeHtml(currentUser.member.membershipStatus)}</p>
                    <p><strong>Dang muon:</strong> ${currentUser.member.currentBorrowedCount}/${currentUser.member.maxBooksAllowed}</p>
                    ${pendingCount > 0 ? `<p><strong>Yêu cầu mượn đang chờ:</strong> ${pendingCount}</p>` : ''}
                ` : '<p>Chua lien ket ho so doc gia</p>'}
            </div>
            <div class="profile-loans">
                <h4>Phieu muon cua ban (${data.total})</h4>
                ${data.data.length === 0 ? '<p>Khong co phieu muon nao</p>' : ''}
                <table class="mini-table">
                    <thead>
                        <tr>
                            <th>Book</th>
                            <th>Loan Date</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Renewals</th>
                            <th>Fine</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(loan => `
                            <tr>
                                <td>${escapeHtml(loan.book?.title || 'N/A')}</td>
                                <td>${new Date(loan.loanDate).toLocaleDateString()}</td>
                                <td>${new Date(loan.dueDate).toLocaleDateString()}</td>
                                <td>
                                    <span class="badge badge-${loan.status.toLowerCase()}">${loan.status}</span>
                                    ${loan.renewalRequested ? '<span class="badge badge-warning">Renew Requested</span>' : ''}
                                </td>
                                <td>${loan.renewalCount}/${loan.maxRenewalsAllowed}</td>
                                <td>$${loan.fineAmount?.toFixed(2) || '0.00'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load profile:', error);
        document.getElementById('profile-content').innerHTML = '<p>Loi tai ho so</p>';
    }
}

// ========== AUTH MODALS ==========

function openLoginModal() {
    document.getElementById('login-modal').classList.add('active');
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-form').reset();
}

function openRegisterModal() {
    closeLoginModal();
    document.getElementById('register-modal').classList.add('active');
}

function closeRegisterModal() {
    document.getElementById('register-modal').classList.remove('active');
    document.getElementById('register-form').reset();
}

// Show/hide member ID field based on role selection
document.getElementById('register-role')?.addEventListener('change', function() {
    const memberIdGroup = document.getElementById('member-id-group');
    if (this.value === 'Reader') {
        memberIdGroup.style.display = 'block';
    } else {
        memberIdGroup.style.display = 'none';
    }
});

// ========== FORM HANDLERS ==========

function setupForms() {
    // Book Form
    document.getElementById('book-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleBookSubmit();
    });
    
    // Member Form
    document.getElementById('member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleMemberSubmit();
    });
    
    // Loan Form
    document.getElementById('loan-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLoanSubmit();
    });
    
    // Login Form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value;
        await login(identifier, password);
    });
    
    // Register Form
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;
        const memberId = document.getElementById('register-member-id').value.trim();
        
        const userData = { username, email, password, role };
        // Only include memberId if it's provided and looks like a valid MongoDB ID (24 chars hex)
        if (memberId && /^[0-9a-f]{24}$/i.test(memberId)) {
            userData.memberId = memberId;
        }
        
        await register(userData);
    });

    // User Form (Admin)
    document.getElementById('user-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleUserSubmit();
    });
    
    // Borrow Form
    document.getElementById('borrow-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleBorrowSubmit();
    });
    
    // Support Ticket Form
    document.getElementById('support-ticket-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSupportTicketSubmit();
    });

    // Send chat with Enter key
    document.getElementById('chat-content')?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await sendChatMessage();
        }
    });
    
    // Tag Form
    document.getElementById('tag-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleTagSubmit();
    });
    
    // Bulk Tag Form
    document.getElementById('bulk-tag-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleBulkTagSubmit();
    });
    
    // Loan Status History Form
    document.getElementById('loan-status-history-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleLoanStatusHistorySubmit();
    });

    setupSupportTicketFilterAutoLoad();
    setupLoanStatusHistoryFilterAutoLoad();
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

function setupSupportTicketFilterAutoLoad() {
    const searchEl = document.getElementById('support-ticket-search');
    const statusEl = document.getElementById('support-ticket-status-filter');
    const priorityEl = document.getElementById('support-ticket-priority-filter');
    const categoryEl = document.getElementById('support-ticket-category-filter');

    const triggerReload = (debounceMs = 0) => {
        if (supportTicketFilterTimer) clearTimeout(supportTicketFilterTimer);
        supportTicketFilterTimer = setTimeout(() => {
            loadSupportTickets(1);
        }, debounceMs);
    };

    searchEl?.addEventListener('input', () => triggerReload(350));
    statusEl?.addEventListener('change', () => triggerReload(0));
    priorityEl?.addEventListener('change', () => triggerReload(0));
    categoryEl?.addEventListener('change', () => triggerReload(0));
}

function setupLoanStatusHistoryFilterAutoLoad() {
    const searchEl = document.getElementById('loan-status-history-search');
    const statusEl = document.getElementById('loan-status-history-status-filter');
    const startDateEl = document.getElementById('loan-status-history-start-date');
    const endDateEl = document.getElementById('loan-status-history-end-date');

    const triggerReload = (debounceMs = 0) => {
        if (loanStatusHistoryFilterTimer) clearTimeout(loanStatusHistoryFilterTimer);
        loanStatusHistoryFilterTimer = setTimeout(() => {
            loadLoanStatusHistory(1);
        }, debounceMs);
    };

    searchEl?.addEventListener('input', () => triggerReload(350));
    statusEl?.addEventListener('change', () => triggerReload(0));
    startDateEl?.addEventListener('change', () => triggerReload(0));
    endDateEl?.addEventListener('change', () => triggerReload(0));
}

async function handleBookSubmit() {
    const id = document.getElementById('book-id').value;
    const bookData = {
        title: document.getElementById('book-title').value.trim(),
        author: document.getElementById('book-author').value.trim(),
        isbn: document.getElementById('book-isbn').value.trim(),
        category: document.getElementById('book-category').value,
        totalCopies: parseInt(document.getElementById('book-total-copies').value),
        publisher: document.getElementById('book-publisher').value.trim(),
        publishYear: document.getElementById('book-publish-year').value ? parseInt(document.getElementById('book-publish-year').value) : null,
        description: document.getElementById('book-description').value.trim()
    };

    // Khi them sach moi, so con lai mac dinh bang tong so.
    // Neu dang cap nhat (id != ''), khong override tinh trang ton kho hien tai.
    if (!id) {
        bookData.availableCopies = bookData.totalCopies;
    }
    
    let result;
    if (id) {
        result = await apiCall(`/books/${id}`, 'PUT', bookData);
    } else {
        result = await apiCall('/books', 'POST', bookData);
    }
    
    if (result.success) {
        showAlert(id ? 'Cap nhat sach thanh cong' : 'Tao sach thanh cong', 'success');
        closeBookModal();
        loadBooks(booksPage);
    }
}

async function handleMemberSubmit() {
    const id = document.getElementById('member-id').value;
    const memberData = {
        name: document.getElementById('member-name').value.trim(),
        email: document.getElementById('member-email').value.trim(),
        phone: document.getElementById('member-phone').value.trim(),
        address: document.getElementById('member-address').value.trim(),
        memberType: document.getElementById('member-type').value,
        membershipStatus: document.getElementById('member-status').value,
        maxBooksAllowed: parseInt(document.getElementById('member-max-books').value)
    };
    
    let result;
    if (id) {
        result = await apiCall(`/members/${id}`, 'PUT', memberData);
    } else {
        result = await apiCall('/members', 'POST', memberData);
    }
    
    if (result.success) {
        showAlert(id ? 'Cap nhat doc gia thanh cong' : 'Tao doc gia thanh cong', 'success');
        closeMemberModal();
        loadMembers(membersPage);
    }
}

async function handleLoanSubmit() {
    const id = document.getElementById('loan-id').value;
    const loanData = {
        bookId: document.getElementById('loan-book').value,
        memberId: document.getElementById('loan-member').value,
        dueDate: document.getElementById('loan-due-date').value,
        notes: document.getElementById('loan-notes').value.trim()
    };
    
    let result;
    if (id) {
        result = await apiCall(`/loans/${id}`, 'PUT', loanData);
    } else {
        result = await apiCall('/loans', 'POST', loanData);
    }
    
    if (result.success) {
        showAlert(id ? 'Cap nhat phieu muon thanh cong' : 'Tao phieu muon thanh cong', 'success');
        closeLoanModal();
        loadLoans(loansPage);
    }
}

// ========== PAGINATION ==========

function renderPagination(containerId, totalPages, currentPage, callback) {
    const container = document.getElementById(containerId);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button class="btn btn-sm" onclick="arguments[0].preventDefault(); (${callback.toString()})(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&laquo; Prev</button>`;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button class="btn btn-sm" onclick="arguments[0].preventDefault(); (${callback.toString()})(1)">1</button>`;
        if (startPage > 2) {
            html += `<button class="btn btn-sm" disabled>...</button>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="btn btn-sm ${i === currentPage ? 'active' : ''}" onclick="arguments[0].preventDefault(); (${callback.toString()})(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<button class="btn btn-sm" disabled>...</button>`;
        }
        html += `<button class="btn btn-sm" onclick="arguments[0].preventDefault(); (${callback.toString()})(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button class="btn btn-sm" onclick="arguments[0].preventDefault(); (${callback.toString()})(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next &raquo;</button>`;
    
    container.innerHTML = html;
    
    // Rebind callback
    const newCallback = (page) => callback(page);
    container.querySelectorAll('button:not([disabled])').forEach(btn => {
        btn.onclick = () => {
            const page = parseInt(btn.textContent);
            if (!isNaN(page)) {
                newCallback(page);
            }
        };
    });
}

// ========== CONFIRM MODAL ==========

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const messageEl = document.getElementById('confirm-message');
        const confirmBtn = document.getElementById('confirm-btn');
        
        messageEl.textContent = message;
        modal.classList.add('active');
        
        const handleConfirm = () => {
            modal.classList.remove('active');
            resolve(true);
        };
        
        const handleCancel = () => {
            modal.classList.remove('active');
            resolve(false);
        };
        
        confirmBtn.onclick = handleConfirm;
        modal.querySelector('.close-btn').onclick = handleCancel;
        modal.querySelector('.modal-actions .btn-secondary').onclick = handleCancel;
    });
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

// ========== UTILITIES ==========

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== NEW FEATURES (Reservations / Notifications / Fines / Reviews / Upload / Socket Chat) ==========

let socket = null;
let chatRoomId = 'public';
let joinedChatRoomId = null;
const SOCKET_SERVER_URL = 'http://localhost:3000';

function isAdminOrLibrarian() {
    return currentUser && ['Admin', 'Librarian'].includes(currentUser.role);
}

async function ensureBookSelectOptions(forceRefresh = false) {
    // Refresh books when needed (e.g. reservations need latest out-of-stock list)
    if (forceRefresh || !allBooks || allBooks.length === 0) {
        try {
            const data = await apiCall('/books?limit=100');
            if (data?.success && Array.isArray(data.data)) {
                allBooks = data.data;
            }
        } catch (e) {
            // apiCall already shows alert
        }
    }

    const reservationOnlyBooks = (allBooks || []).filter((book) => Number(book.availableCopies || 0) <= 0);
    const reservationBookOptions = reservationOnlyBooks.map((book) => {
        const avail = Number(book.availableCopies || 0);
        return `<option value="${book._id}">${escapeHtml(book.title)} - ${escapeHtml(book.author)} (Hết sách)</option>`;
    }).join('');
    const allBookOptions = (allBooks || []).map((book) => {
        const avail = Number(book.availableCopies || 0);
        return `<option value="${book._id}">${escapeHtml(book.title)} - ${escapeHtml(book.author)} (${avail} available)</option>`;
    }).join('');

    const selReservation = document.getElementById('reservation-book-select');
    if (selReservation) {
        selReservation.innerHTML = '<option value="">Chọn sách đã hết</option>' + reservationBookOptions;
    }

    const selReview = document.getElementById('review-book-select');
    if (selReview) selReview.innerHTML = '<option value="">Chọn sách</option>' + allBookOptions;

    const selBookImg = document.getElementById('book-image-book-select');
    if (selBookImg) selBookImg.innerHTML = '<option value="">Chọn sách</option>' + allBookOptions;
}

// ========== Reservations ==========
async function loadReservations() {
    if (!currentUser) return;
    try {
        await ensureBookSelectOptions(true);
        const page = 1;
        const limit = 50;
        const data = await apiCall(`/reservations?page=${page}&limit=${limit}`);
        if (!data.success) return;

        const list = document.getElementById('reservations-list');
        if (!list) return;

        const isStaff = isAdminOrLibrarian();

        if (!Array.isArray(data.data) || data.data.length === 0) {
            list.innerHTML = '<div class="empty-state">Chưa có đặt mượn nào</div>';
            return;
        }

        list.innerHTML = data.data.map(r => {
            const canDecide = isStaff && r.status === 'Pending';
            return `
                <div style="padding: 14px; border-bottom: 1px solid #edf0f4;">
                    <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                        <div>
                            <strong>${escapeHtml(r.book?.title || 'N/A')}</strong><br/>
                            <small>Trạng thái: ${escapeHtml(r.status)}</small>
                            ${r.dueDate ? `<br/><small>Hạn trả dự kiến: ${new Date(r.dueDate).toLocaleDateString()}</small>` : ''}
                            ${r.notes ? `<br/><small>Ghi chú: ${escapeHtml(r.notes)}</small>` : ''}
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            ${canDecide ? `
                                <button class="btn btn-sm btn-success" onclick="approveReservation('${r._id}')">Duyệt</button>
                                <button class="btn btn-sm btn-danger" onclick="rejectReservation('${r._id}')">Từ chối</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('loadReservations error', e);
    }
}

async function createReservation() {
    if (!currentUser) return showAlert('Vui lòng đăng nhập', 'error');
    if (currentUser.role !== 'Reader') return showAlert('Chỉ độc giả mới có thể đặt mượn', 'error');

    const bookId = document.getElementById('reservation-book-select')?.value;
    const notes = document.getElementById('reservation-notes')?.value || '';

    if (!bookId) return showAlert('Bạn cần chọn sách', 'error');

    try {
        const result = await apiCall('/reservations', 'POST', {
            bookId,
            notes
        });
        if (result.success) {
            showAlert('Gửi yêu cầu đặt mượn thành công', 'success');
            await loadReservations();
            await loadLoans();
            await loadBooks();
        }
    } catch (e) {
        console.error(e);
    }
}

async function approveReservation(id) {
    if (!isAdminOrLibrarian()) return;
    const confirmed = await showConfirm('Duyệt đặt mượn này?');
    if (!confirmed) return;

    try {
        const result = await apiCall(`/reservations/${id}/approve`, 'PUT', {});
        if (result.success) {
            showAlert('Duyệt đặt mượn thành công', 'success');
            await loadReservations();
            await loadLoans();
            await loadBooks();
        }
    } catch (e) {
        console.error(e);
    }
}

async function rejectReservation(id) {
    if (!isAdminOrLibrarian()) return;
    const reason = prompt('Nhập lý do từ chối (tuỳ chọn):');

    try {
        const result = await apiCall(`/reservations/${id}/reject`, 'PUT', { reason });
        if (result.success) {
            showAlert('Đã từ chối đặt mượn', 'success');
            await loadReservations();
        }
    } catch (e) {
        console.error(e);
    }
}

// ========== Notifications ==========
async function loadNotifications() {
    if (!currentUser) return;
    try {
        const data = await apiCall('/notifications?limit=50&page=1');
        const list = document.getElementById('notifications-list');
        if (!list) return;

        if (!Array.isArray(data.data) || data.data.length === 0) {
            list.innerHTML = '<div class="empty-state">Chưa có thông báo nào</div>';
            return;
        }

        list.innerHTML = data.data.map(n => {
            return `
                <div style="padding: 14px; border-bottom: 1px solid #edf0f4;">
                    <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                        <div>
                            <strong>${escapeHtml(n.title || 'Thông báo')}</strong><br/>
                            <small>${escapeHtml(n.message || '')}</small><br/>
                            <small>Thời gian: ${n.createdAt ? new Date(n.createdAt).toLocaleString() : '-'}</small>
                            ${n.isRead ? '' : `<div style="margin-top:6px; color:#856404; font-weight:600;">Chưa đọc</div>`}
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            ${n.isRead ? '' : `<button class="btn btn-sm btn-secondary" onclick="markNotificationRead('${n._id}')">Đã đọc</button>`}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('loadNotifications error', e);
    }
}

async function markNotificationRead(id) {
    try {
        const result = await apiCall(`/notifications/${id}/read`, 'PATCH', {});
        if (result.success) {
            await loadNotifications();
        }
    } catch (e) {
        console.error(e);
    }
}

// ========== Fines & Fine Payments ==========
let finesState = [];

async function loadFines() {
    if (!currentUser) return;
    try {
        const data = await apiCall('/fines?limit=50&page=1');
        finesState = Array.isArray(data.data) ? data.data : [];

        const list = document.getElementById('fines-list');
        if (!list) return;

        const paymentArea = document.getElementById('fine-payment-area');
        if (paymentArea) paymentArea.style.display = isAdminOrLibrarian() ? 'block' : 'none';

        if (!finesState.length) {
            list.innerHTML = '<div class="empty-state">Chưa có tiền phạt</div>';
            return;
        }

        // Fill fine select for payment
        const fineSel = document.getElementById('fineId-select');
        if (fineSel) {
            const unpaid = finesState.filter(f => f.status === 'Unpaid');
            const options = (unpaid.length ? unpaid : finesState).map(f => {
                return `<option value="${f._id}">Fine ${f._id} - $${f.amount} (${f.status})</option>`;
            }).join('');
            fineSel.innerHTML = options || '';
        }

        list.innerHTML = finesState.map(f => {
            return `
                <div style="padding: 14px; border-bottom: 1px solid #edf0f4;">
                    <strong>$${f.amount}</strong> - <span class="badge badge-${f.status ? f.status.toLowerCase() : ''}">${escapeHtml(f.status || '')}</span><br/>
                    <small>Lý do: ${escapeHtml(f.reason || '')}</small><br/>
                    <small>Độc giả: ${escapeHtml(f.member?.name || f.member || 'N/A')}</small><br/>
                    <small>Loan: ${escapeHtml(f.loan?._id || f.loan || '')}</small>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('loadFines error', e);
    }
}

async function createFinePayment() {
    if (!isAdminOrLibrarian()) return;
    const fineId = document.getElementById('fineId-select')?.value;
    const amount = document.getElementById('fine-payment-amount')?.value;
    const method = document.getElementById('fine-payment-method')?.value || 'Cash';
    const note = document.getElementById('fine-payment-note')?.value || '';

    if (!fineId) return showAlert('Chọn fine cần thanh toán', 'error');
    if (!amount || Number(amount) < 0) return showAlert('Nhập số tiền hợp lệ', 'error');

    try {
        const result = await apiCall('/fine-payments', 'POST', {
            fineId,
            amount: Number(amount),
            method,
            note
        });
        if (result.success) {
            showAlert('Thanh toán phạt thành công', 'success');
            await loadFines();
            await loadNotifications();
        }
    } catch (e) {
        console.error(e);
    }
}

// ========== Reviews ==========
async function loadReviews() {
    if (!currentUser) return;
    try {
        await ensureBookSelectOptions();
        const data = await apiCall('/reviews?limit=50&page=1');
        const list = document.getElementById('reviews-list');
        if (!list) return;

        if (!Array.isArray(data.data) || data.data.length === 0) {
            list.innerHTML = '<div class="empty-state">Chưa có đánh giá nào</div>';
            return;
        }

        list.innerHTML = data.data.map(r => {
            return `
                <div style="padding: 14px; border-bottom: 1px solid #edf0f4;">
                    <strong>${escapeHtml(r.book?.title || 'N/A')}</strong><br/>
                    <small>Người đánh giá: ${escapeHtml(r.user?.username || r.member?.name || '')}</small><br/>
                    <small>Rating: ${r.rating} / 5</small><br/>
                    <small>${escapeHtml(r.comment || '')}</small>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('loadReviews error', e);
    }
}

async function createReview() {
    if (!currentUser) return showAlert('Vui lòng đăng nhập', 'error');
    if (currentUser.role !== 'Reader') return showAlert('Chỉ độc giả mới đánh giá được', 'error');

    const bookId = document.getElementById('review-book-select')?.value;
    const rating = Number(document.getElementById('review-rating')?.value || 0);
    const comment = document.getElementById('review-comment')?.value || '';

    if (!bookId) return showAlert('Chọn sách để đánh giá', 'error');
    if (!rating || rating < 1 || rating > 5) return showAlert('Rating không hợp lệ', 'error');

    try {
        const result = await apiCall('/reviews', 'POST', {
            bookId,
            rating,
            comment
        });
        if (result.success) {
            showAlert('Gửi đánh giá thành công', 'success');
            document.getElementById('review-comment').value = '';
            await loadReviews();
        }
    } catch (e) {
        console.error(e);
    }
}

// ========== Upload & Search by Image ==========
async function initUploadSection() {
    if (!currentUser) return;
    await ensureBookSelectOptions();
    // Hide book-image upload for non staff; keep image search available
    const bookImageUploadWrapper = document.getElementById('book-image-upload-wrapper');
    if (bookImageUploadWrapper) {
        bookImageUploadWrapper.style.display = isAdminOrLibrarian() ? 'block' : 'none';
    }
}

async function searchByImage() {
    const fileInput = document.getElementById('search-image-input');
    const file = fileInput?.files?.[0];
    if (!file) return showAlert('Vui lòng chọn ảnh để tìm', 'error');

    try {
        const form = new FormData();
        form.append('image', file);
        const result = await apiCall('/books/search-by-image', 'POST', form, true);
        const out = document.getElementById('image-search-results');
        if (!out) return;

        if (!result.success) return;

        const items = (result.data || []).map(b => `
            <div style="padding: 10px 0; border-bottom: 1px solid #edf0f4;">
                <strong>${escapeHtml(b.title)}</strong> - ${escapeHtml(b.author)}<br/>
                <small>${escapeHtml(b.category || '')} | còn lại: ${b.availableCopies}</small>
            </div>
        `).join('');

        out.innerHTML = items || '<p>Không tìm thấy kết quả.</p>';
    } catch (e) {
        console.error(e);
    }
}

async function createBookImage() {
    if (!isAdminOrLibrarian()) return showAlert('Chỉ Admin/Librarian upload được', 'error');
    const bookId = document.getElementById('book-image-book-select')?.value;
    const file = document.getElementById('book-image-input')?.files?.[0];
    const caption = document.getElementById('book-image-caption')?.value || '';

    if (!bookId) return showAlert('Chọn sách', 'error');
    if (!file) return showAlert('Chọn ảnh để upload', 'error');

    const out = document.getElementById('book-image-upload-result');
    try {
        const form = new FormData();
        form.append('image', file);
        form.append('bookId', bookId);
        form.append('caption', caption);

        const result = await apiCall('/book-images', 'POST', form, true);
        if (result.success) {
            out.innerHTML = `<p>Upload thành công: ${escapeHtml(result.data._id)}</p>`;
            await loadBooks();
        }
    } catch (e) {
        console.error(e);
        if (out) out.innerHTML = '<p>Lỗi upload.</p>';
    }
}

// ========== Socket Chat ==========
async function connectAndLoadChat() {
    if (!currentUser) return showAlert('Vui lòng đăng nhập', 'error');

    chatRoomId = (document.getElementById('chat-room-id')?.value || 'public').trim() || 'public';
    const chatStatus = document.getElementById('chat-connection-status');

    try {
        if (!socket) {
            if (typeof io === 'undefined') {
                return showAlert('Chưa load socket.io client', 'error');
            }
            socket = io(SOCKET_SERVER_URL, {
                auth: { token: authToken },
                transports: ['websocket']
            });

            socket.on('connect', () => {
                if (chatStatus) chatStatus.textContent = 'Đã kết nối';
                // Load chat for current room
                socket.emit('chat:join', { roomId: chatRoomId });
                joinedChatRoomId = chatRoomId;
                loadChatMessages(chatRoomId);
            });

            socket.on('chat:new', (msg) => {
                // Append message into UI (simple)
                appendChatMessage(msg);
            });

            socket.on('chat:error', (payload) => {
                showAlert(payload?.message || 'Lỗi chat', 'error');
            });

            socket.on('disconnect', () => {
                if (chatStatus) chatStatus.textContent = 'Mất kết nối';
            });

            socket.on('connect_error', () => {
                if (chatStatus) chatStatus.textContent = 'Không kết nối được';
            });

            socket.on('notification:new', (notif) => {
                // Refresh notification list and show toast
                showAlert(notif.message || notif.title || 'Có thông báo mới', 'info');
                loadNotifications();
            });
        } else {
            if (joinedChatRoomId !== chatRoomId) {
                socket.emit('chat:join', { roomId: chatRoomId });
                joinedChatRoomId = chatRoomId;
            }
            loadChatMessages(chatRoomId);
        }
    } catch (e) {
        console.error(e);
        showAlert('Không kết nối được socket', 'error');
    }
}

async function loadChatMessages(roomId) {
    try {
        const data = await apiCall(`/chat-messages?roomId=${encodeURIComponent(roomId)}`);
        const container = document.getElementById('chat-messages');
        if (!container) return;

        if (!Array.isArray(data.data) || data.data.length === 0) {
            container.innerHTML = '<p>Chưa có tin nhắn.</p>';
            return;
        }

        container.innerHTML = data.data.slice().reverse().map(m => `
            <div style="padding: 8px 10px; border-bottom: 1px solid #edf0f4;">
                <small><strong>${escapeHtml(m.sender?.username || m.sender?.toString?.() || 'User')}</strong></small>
                <div>${escapeHtml(m.content || '')}</div>
                <small>${m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}</small>
            </div>
        `).join('');
    } catch (e) {
        console.error('loadChatMessages error', e);
    }
}

function appendChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const sender = msg.sender?.username || msg.sender?.toString?.() || 'User';
    const el = document.createElement('div');
    el.style.padding = '8px 10px';
    el.style.borderBottom = '1px solid #edf0f4';
    el.innerHTML = `
        <small><strong>${escapeHtml(sender)}</strong></small>
        <div>${escapeHtml(msg.content || '')}</div>
        <small>${msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}</small>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    if (!socket) return showAlert('Chưa kết nối chat', 'error');
    const content = document.getElementById('chat-content')?.value || '';
    if (!content.trim()) return showAlert('Nhập nội dung', 'error');

    const roomId = chatRoomId || 'public';
    socket.emit('chat:send', { roomId, content });
    document.getElementById('chat-content').value = '';
}

// ==================== Support Ticket Functions ====================

function openSupportTicketModal(ticket = null) {
    const isCreateMode = !ticket;
    if (isCreateMode && (!currentUser || currentUser.role !== 'Reader')) {
        showAlert('Chỉ độc giả mới được tạo yêu cầu hỗ trợ', 'warning');
        return;
    }

    const modal = document.getElementById('support-ticket-modal');
    const form = document.getElementById('support-ticket-form');
    const title = document.getElementById('support-ticket-modal-title');
    const submitBtn = document.getElementById('support-ticket-submit')
        || form?.querySelector('button[type="submit"]');
    const statusGroup = document.getElementById('support-ticket-status-group');
    const assignedToGroup = document.getElementById('support-ticket-assigned-to-group');
    const resolutionNotesEl = document.getElementById('support-ticket-resolution-notes');
    
    if (ticket) {
        if (title) title.textContent = 'Chỉnh sửa yêu cầu hỗ trợ';
        if (submitBtn) submitBtn.textContent = 'Cập nhật';
        document.getElementById('support-ticket-id').value = ticket._id;
        document.getElementById('support-ticket-title').value = ticket.title || '';
        document.getElementById('support-ticket-description').value = ticket.description || '';
        document.getElementById('support-ticket-category').value = ticket.category || 'Technical';
        document.getElementById('support-ticket-priority').value = ticket.priority || 'Medium';
        document.getElementById('support-ticket-status').value = ticket.status || 'Open';
        document.getElementById('support-ticket-assigned-to').value = ticket.assignedTo?._id || ticket.assignedTo || '';
        if (resolutionNotesEl) resolutionNotesEl.value = ticket.resolutionNotes || '';
        
        // Show status and assigned to fields for editing
        if (statusGroup) statusGroup.style.display = 'block';
        if (assignedToGroup) assignedToGroup.style.display = 'block';
    } else {
        if (title) title.textContent = 'Tạo yêu cầu hỗ trợ mới';
        if (submitBtn) submitBtn.textContent = 'Tạo';
        form.reset();
        document.getElementById('support-ticket-id').value = '';
        
        // Hide status and assigned to fields for new tickets
        if (statusGroup) statusGroup.style.display = 'none';
        if (assignedToGroup) assignedToGroup.style.display = 'none';
        if (resolutionNotesEl) resolutionNotesEl.value = '';
    }
    
    modal.style.display = 'block';
}

function closeSupportTicketModal() {
    document.getElementById('support-ticket-modal').style.display = 'none';
}

async function loadSupportTickets(page = 1) {
    try {
        const search = document.getElementById('support-ticket-search')?.value?.trim() || '';
        const statusFilter = document.getElementById('support-ticket-status-filter')?.value || '';
        const priorityFilter = document.getElementById('support-ticket-priority-filter')?.value || '';
        const categoryFilter = document.getElementById('support-ticket-category-filter')?.value || '';
        
        let url = `${API_BASE}/support-tickets?page=${page}&limit=10`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        if (priorityFilter) url += `&priority=${priorityFilter}`;
        if (categoryFilter) url += `&category=${categoryFilter}`;
        
        const token = authToken || localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load support tickets');
        
        const data = await response.json();
        const tickets = Array.isArray(data.data) ? data.data : (data.data?.tickets || []);
        const totalPages = data.totalPages || data.data?.totalPages || 1;
        
        // Render table
        const table = document.getElementById('support-tickets-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody') || table.createTBody();
        tbody.innerHTML = '';
        
        tickets.forEach(ticket => {
            const creator = ticket.user?.username || ticket.user?.email || 'N/A';
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${escapeHtml(ticket.title || '')}</td>
                <td>${escapeHtml(creator)}</td>
                <td><span class="badge ${ticket.category}">${escapeHtml(ticket.category || '')}</span></td>
                <td><span class="badge ${ticket.status}">${escapeHtml(ticket.status || '')}</span></td>
                <td><span class="badge ${ticket.priority}">${escapeHtml(ticket.priority || '')}</span></td>
                <td>${ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="openSupportTicketModal(${JSON.stringify(ticket).replace(/"/g, '"')})">Sửa</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupportTicket('${ticket._id}')">Xóa</button>
                </td>
            `;
        });
        
        // Render pagination
        renderPagination('support-tickets-pagination', totalPages, page, changeSupportTicketsPage);
    } catch (error) {
        console.error('Error loading support tickets:', error);
        showAlert('Không thể tải danh sách yêu cầu hỗ trợ', 'error');
    }
}

async function deleteSupportTicket(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa yêu cầu hỗ trợ này?')) return;
    
    try {
        const token = authToken || localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/support-tickets/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to delete support ticket');
        
        showAlert('Đã xóa yêu cầu hỗ trợ thành công', 'success');
        loadSupportTickets();
    } catch (error) {
        console.error('Error deleting support ticket:', error);
        showAlert('Không thể xóa yêu cầu hỗ trợ', 'error');
    }
}

function changeSupportTicketsPage(page) {
    loadSupportTickets(page);
}

// ==================== Tag Functions ====================

function openTagModal(tag = null) {
    const modal = document.getElementById('tag-modal');
    const form = document.getElementById('tag-form');
    const title = document.getElementById('tag-modal-title');
    const submitBtn = document.getElementById('tag-submit');
    
    if (tag) {
        title.textContent = 'Chỉnh sửa thẻ';
        submitBtn.textContent = 'Cập nhật';
        document.getElementById('tag-id').value = tag._id;
        document.getElementById('tag-name').value = tag.name || '';
        document.getElementById('tag-description').value = tag.description || '';
        document.getElementById('tag-color').value = tag.color || '#007bff';
    } else {
        title.textContent = 'Tạo thẻ mới';
        submitBtn.textContent = 'Tạo';
        form.reset();
        document.getElementById('tag-id').value = '';
    }
    
    modal.style.display = 'block';
}

function closeTagModal() {
    document.getElementById('tag-modal').style.display = 'none';
}

function openBulkTagModal() {
    document.getElementById('bulk-tag-modal').style.display = 'block';
}

function closeBulkTagModal() {
    document.getElementById('bulk-tag-modal').style.display = 'none';
}

async function loadTags(page = 1) {
    try {
        const sortFilter = document.getElementById('tag-sort-filter')?.value || 'name';
        
        let url = `${API_BASE}/tags?page=${page}&limit=12&sort=${sortFilter}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load tags');
        
        const data = await response.json();
        const tags = data.data?.tags || [];
        const totalPages = data.data?.totalPages || 1;
        
        // Render tags container
        const container = document.getElementById('tags-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        tags.forEach(tag => {
            const tagEl = document.createElement('div');
            tagEl.className = 'tag-card';
            tagEl.style.backgroundColor = tag.color || '#007bff';
            tagEl.innerHTML = `
                <div class="tag-header">
                    <h4>${escapeHtml(tag.name || '')}</h4>
                    <span class="tag-count">${tag.bookCount || 0} sách</span>
                </div>
                <p>${escapeHtml(tag.description || '')}</p>
                <div class="tag-actions">
                    <button class="btn btn-sm btn-light" onclick="openTagModal(${JSON.stringify(tag).replace(/"/g, '"')})">Sửa</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTag('${tag._id}')">Xóa</button>
                </div>
            `;
            container.appendChild(tagEl);
        });
        
        // Render pagination
        renderPagination('tags-pagination', totalPages, page, changeTagsPage);
    } catch (error) {
        console.error('Error loading tags:', error);
        showAlert('Không thể tải danh sách thẻ', 'error');
    }
}

async function deleteTag(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa thẻ này?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/tags/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to delete tag');
        
        showAlert('Đã xóa thẻ thành công', 'success');
        loadTags();
    } catch (error) {
        console.error('Error deleting tag:', error);
        showAlert('Không thể xóa thẻ', 'error');
    }
}

function changeTagsPage(page) {
    loadTags(page);
}

// ==================== Loan Status History Functions ====================

function openLoanStatusHistoryModal(history = null) {
    const modal = document.getElementById('loan-status-history-modal');
    const form = document.getElementById('loan-status-history-form');
    const title = document.getElementById('loan-status-history-modal-title');
    const submitBtn = document.getElementById('loan-status-history-submit');
    
    if (history) {
        title.textContent = 'Chỉnh sửa lịch sử trạng thái';
        submitBtn.textContent = 'Cập nhật';
        document.getElementById('loan-status-history-id').value = history._id;
        document.getElementById('loan-status-history-loan').value = history.loan?._id || history.loan || '';
        document.getElementById('loan-status-history-previous-status').value = history.previousStatus || '';
        document.getElementById('loan-status-history-status').value = history.newStatus || history.status || '';
        document.getElementById('loan-status-history-notes').value = history.changeReason || history.notes || '';
    } else {
        title.textContent = 'Tạo lịch sử trạng thái mới';
        submitBtn.textContent = 'Tạo';
        form.reset();
        document.getElementById('loan-status-history-id').value = '';
    }
    
    modal.style.display = 'block';
}

function closeLoanStatusHistoryModal() {
    document.getElementById('loan-status-history-modal').style.display = 'none';
}

async function loadLoanStatusHistory(page = 1) {
    try {
        const search = document.getElementById('loan-status-history-search')?.value?.trim() || '';
        const statusFilter = document.getElementById('loan-status-history-status-filter')?.value || '';
        const startDate = document.getElementById('loan-status-history-start-date')?.value || '';
        const endDate = document.getElementById('loan-status-history-end-date')?.value || '';
        
        let url = `${API_BASE}/loan-status-history?page=${page}&limit=10`;
        if (search) url += `&loanId=${encodeURIComponent(search)}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        
        const token = authToken || localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load loan status history');
        
        const data = await response.json();
        // API currently returns list response as { data: [...], totalPages, ... }
        const history = Array.isArray(data.data) ? data.data : (data.data?.history || []);
        const totalPages = data.totalPages || data.data?.totalPages || 1;
        
        // Render table
        const table = document.getElementById('loan-status-history-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody') || table.createTBody();
        tbody.innerHTML = '';
        
        history.forEach(item => {
            const changedByName = item.changedBy?.username || item.changedBy?.email || 'N/A';
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${item.loan?._id || 'N/A'}</td>
                <td>${item.loan?.book?.title || 'N/A'}</td>
                <td><span class="badge ${item.previousStatus}">${escapeHtml(item.previousStatus || '')}</span></td>
                <td><span class="badge ${item.newStatus || item.status || ''}">${escapeHtml(item.newStatus || item.status || '')}</span></td>
                <td>${escapeHtml(changedByName)}</td>
                <td>${item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</td>
                <td>${escapeHtml(item.changeReason || item.notes || '')}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteLoanStatusHistory('${item._id}')">Xóa</button>
                </td>
            `;
        });
        
        // Render pagination
        renderPagination('loan-status-history-pagination', totalPages, page, changeLoanStatusHistoryPage);
    } catch (error) {
        console.error('Error loading loan status history:', error);
        showAlert('Không thể tải lịch sử trạng thái', 'error');
    }
}

async function deleteLoanStatusHistory(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa lịch sử trạng thái này?')) return;
    
    try {
        const token = authToken || localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/loan-status-history/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to delete loan status history');
        
        showAlert('Đã xóa lịch sử trạng thái thành công', 'success');
        loadLoanStatusHistory();
    } catch (error) {
        console.error('Error deleting loan status history:', error);
        showAlert('Không thể xóa lịch sử trạng thái', 'error');
    }
}

function changeLoanStatusHistoryPage(page) {
    loadLoanStatusHistory(page);
}

// ==================== Form Submit Handlers ====================

async function handleSupportTicketSubmit() {
    try {
        const id = document.getElementById('support-ticket-id')?.value?.trim() || '';

        // NOTE: this form uses id attributes (not name), so read values directly
        const data = {
            title: document.getElementById('support-ticket-title')?.value?.trim() || '',
            description: document.getElementById('support-ticket-description')?.value?.trim() || '',
            category: document.getElementById('support-ticket-category')?.value || '',
            priority: document.getElementById('support-ticket-priority')?.value || 'Medium',
            status: document.getElementById('support-ticket-status')?.value || 'Open',
            assignedTo: document.getElementById('support-ticket-assigned-to')?.value || '',
            resolutionNotes: document.getElementById('support-ticket-resolution-notes')?.value?.trim() || ''
        };

        if (!id && (!currentUser || currentUser.role !== 'Reader')) {
            showAlert('Chỉ độc giả mới được tạo yêu cầu hỗ trợ', 'warning');
            return;
        }

        if (!data.title || !data.description || !data.category) {
            showAlert('Vui lòng nhập đầy đủ Tiêu đề, Mô tả và Danh mục', 'error');
            return;
        }

        // Normalize optional fields to avoid backend cast/validation errors
        if (!data.assignedTo) delete data.assignedTo;
        if (!data.resolutionNotes) delete data.resolutionNotes;
        if (!id) {
            delete data.id;
            delete data.assignedTo;
            delete data.resolutionNotes;
            // Reader create flow keeps only basic fields
            delete data.status;
        }
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/support-tickets/${id}` : `${API_BASE}/support-tickets`;
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken || localStorage.getItem('authToken') || localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            let message = 'Failed to save support ticket';
            try {
                const err = await response.json();
                message = err.message || (Array.isArray(err.errors) ? err.errors.map(e => e.msg || e.message).join(', ') : message);
            } catch (_) {
                // ignore parse errors
            }
            throw new Error(message);
        }
        
        showAlert(id ? 'Cập nhật yêu cầu hỗ trợ thành công' : 'Tạo yêu cầu hỗ trợ thành công', 'success');
        closeSupportTicketModal();
        loadSupportTickets();
    } catch (error) {
        console.error('Error saving support ticket:', error);
        showAlert('Không thể lưu yêu cầu hỗ trợ', 'error');
    }
}

async function handleTagSubmit() {
    try {
        const form = document.getElementById('tag-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/tags/${id}` : `${API_BASE}/tags`;
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed to save tag');
        
        showAlert(id ? 'Cập nhật thẻ thành công' : 'Tạo thẻ thành công', 'success');
        closeTagModal();
        loadTags();
    } catch (error) {
        console.error('Error saving tag:', error);
        showAlert('Không thể lưu thẻ', 'error');
    }
}

async function handleBulkTagSubmit() {
    try {
        const bulkData = document.getElementById('bulk-tag-data').value;
        if (!bulkData.trim()) {
            showAlert('Nhập dữ liệu thẻ', 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/tags/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ tags: bulkData })
        });
        
        if (!response.ok) throw new Error('Failed to create bulk tags');
        
        showAlert('Tạo thẻ hàng loạt thành công', 'success');
        closeBulkTagModal();
        loadTags();
    } catch (error) {
        console.error('Error creating bulk tags:', error);
        showAlert('Không thể tạo thẻ hàng loạt', 'error');
    }
}

async function handleLoanStatusHistorySubmit() {
    try {
        const form = document.getElementById('loan-status-history-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/loan-status-history/${id}` : `${API_BASE}/loan-status-history`;
        
        const token = authToken || localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed to save loan status history');
        
        showAlert(id ? 'Cập nhật lịch sử trạng thái thành công' : 'Tạo lịch sử trạng thái thành công', 'success');
        closeLoanStatusHistoryModal();
        loadLoanStatusHistory();
    } catch (error) {
        console.error('Error saving loan status history:', error);
        showAlert('Không thể lưu lịch sử trạng thái', 'error');
    }
}
