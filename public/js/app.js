// app.js - Main application script that runs on all pages

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we're on
    const currentPage = getCurrentPage();
    
    // Initialize appropriate scripts
    switch (currentPage) {
        case 'login':
            initLoginPage();
            break;
        case 'dashboard':
        case 'admin':
        case 'franchisee':
        case 'super-franchisee':
        case 'sub-franchisee':
            initDashboard();
            break;
        default:
            // Check if user is authenticated for protected pages
            if (currentPage !== 'login' && !isAuthenticated()) {
                redirectToLogin();
            }
    }
    
    // Setup global event listeners
    setupGlobalListeners();
});

// Get current page type based on URL
const getCurrentPage = () => {
    const path = window.location.pathname;
    
    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
        return 'login';
    } else if (path.includes('dashboard.html')) {
        return 'dashboard';
    } else if (path.includes('admin')) {
        return 'admin';
    } else if (path.includes('franchisee')) {
        return 'franchisee';
    } else if (path.includes('super-franchisee')) {
        return 'super-franchisee';
    } else if (path.includes('sub-franchisee')) {
        return 'sub-franchisee';
    }
    
    return 'other';
};

// Initialize login page
const initLoginPage = () => {
    // If already logged in, redirect to appropriate dashboard
    if (isAuthenticated()) {
        redirectToDashboard();
        return;
    }
    
    // Setup login form submission
    const loginForm = document.getElementById('login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const pin = document.getElementById('pin')?.value || ''; // PIN may be optional
            const buttonSubmit = document.getElementById('login-button');
            
            try {
                // Show loading state
                buttonSubmit.disabled = true;
                buttonSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
                
                // Call login API
                const response = await authAPI.login(username, password, pin);
                
                // Store user data and tokens
                storeUserData(response.user, response.tokens);
                
                // Redirect to appropriate dashboard
                redirectToDashboard();
                
            } catch (error) {
                console.error('Login error:', error);
                
                // Show error message
                const errorMsg = document.getElementById('login-error');
                errorMsg.textContent = error.message || 'Invalid username or password. Please try again.';
                errorMsg.style.display = 'block';
                
                // Reset button
                buttonSubmit.disabled = false;
                buttonSubmit.innerHTML = 'Login';
            }
        });
    }
    
    // Setup PIN form if exists
    const pinForm = document.getElementById('pin-form');
    
    if (pinForm) {
        pinForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const pin = document.getElementById('pin').value;
            const buttonSubmit = document.getElementById('verify-pin-button');
            
            try {
                // Show loading state
                buttonSubmit.disabled = true;
                buttonSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Verifying...';
                
                // Call verify PIN API
                const response = await authAPI.verifyPin(pin);
                
                // Redirect to appropriate page based on response
                if (response.redirect) {
                    window.location.href = response.redirect;
                } else {
                    window.location.href = '/pages/dashboard.html';
                }
                
            } catch (error) {
                console.error('PIN verification error:', error);
                
                // Show error message
                const errorMsg = document.getElementById('pin-error');
                errorMsg.textContent = error.message || 'Invalid PIN. Please try again.';
                errorMsg.style.display = 'block';
                
                // Reset button
                buttonSubmit.disabled = false;
                buttonSubmit.innerHTML = 'Verify PIN';
            }
        });
    }
};

// Redirect to appropriate dashboard based on user role
const redirectToDashboard = () => {
    const user = getUserData();
    
    if (!user) {
        redirectToLogin();
        return;
    }
    
    switch (user.role) {
        case 'superAdmin':
            window.location.href = '/pages/admin/dashboard.html';
            break;
        case 'superFranchisee':
            window.location.href = '/pages/super-franchisee/dashboard.html';
            break;
        case 'franchisee':
            window.location.href = '/pages/franchisee/dashboard.html';
            break;
        case 'subFranchisee':
            window.location.href = '/pages/sub-franchisee/dashboard.html';
            break;
        default:
            window.location.href = '/pages/dashboard.html';
    }
};

// Redirect to login page
const redirectToLogin = () => {
    window.location.href = '/index.html';
};

// Setup global event listeners
const setupGlobalListeners = () => {
    // Close alert buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-close') && e.target.closest('.alert')) {
            const alert = e.target.closest('.alert');
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }
    });
    
    // Handle session timeout
    let sessionTimeoutId;
    
    const resetSessionTimeout = () => {
        clearTimeout(sessionTimeoutId);
        
        // Session timeout after 30 minutes of inactivity
        sessionTimeoutId = setTimeout(() => {
            if (isAuthenticated()) {
                alert('Your session has expired due to inactivity. Please login again.');
                logout();
            }
        }, 30 * 60 * 1000); // 30 minutes
    };
    
    // Reset timeout on user activity
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(eventType => {
        document.addEventListener(eventType, resetSessionTimeout);
    });
    
    // Initial reset
    resetSessionTimeout();
};