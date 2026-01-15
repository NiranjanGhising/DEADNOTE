// Shared JavaScript utilities for Personal Growth Diary

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/';
            return false;
        }

        // Update user info in sidebar
        const username = data.user.username;
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const currentUsername = document.getElementById('current-username');

        if (userAvatar) userAvatar.textContent = username.charAt(0).toUpperCase();
        if (userName) userName.textContent = username;
        if (currentUsername) currentUsername.textContent = username;

        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/';
        return false;
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        showToast('Failed to logout', 'error');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span>${icons[type] || icons.info}</span>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format date for display
function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

// Format relative time
function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Request notification permission
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
}

// Show browser notification
function showBrowserNotification(title, body, icon = '/icons/icon.png') {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon });
    }
}

// Local storage helpers
const storage = {
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage error:', e);
        }
    },
    remove: (key) => {
        localStorage.removeItem(key);
    }
};

// Theme toggle (if you want to add light theme later)
function toggleTheme() {
    const isDark = document.body.classList.toggle('light-theme');
    storage.set('theme', isDark ? 'light' : 'dark');
}

// Initialize theme from storage
function initTheme() {
    const theme = storage.get('theme', 'dark');
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Ctrl/Cmd + K for quick search (if implemented)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Could open a quick search modal
    }
});

// Close modal when clicking overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Service worker registration for PWA support (optional)
if ('serviceWorker' in navigator) {
    // Uncomment to enable PWA features
    // navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
}

// Check for pending notifications on page load
async function checkPendingNotifications() {
    try {
        const response = await fetch('/api/notifications/pending');
        const data = await response.json();

        const totalPending = data.pendingTodos.length + data.overdueTodos.length;
        
        // Update favicon badge or show notification
        if (totalPending > 0 && Notification.permission === 'granted') {
            // Could show a notification about pending items
        }

        return data;
    } catch (error) {
        console.error('Failed to check notifications:', error);
        return null;
    }
}

// Periodically check for notifications (every 30 minutes)
setInterval(() => {
    if (document.visibilityState === 'visible') {
        checkPendingNotifications();
    }
}, 30 * 60 * 1000);

// Export functions for use in other scripts
window.diaryUtils = {
    checkAuth,
    logout,
    showToast,
    escapeHtml,
    formatDisplayDate,
    formatRelativeTime,
    debounce,
    storage,
    requestNotificationPermission,
    showBrowserNotification
};
