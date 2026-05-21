// auth.js - Frontend Authentication System

// Check if user is authenticated
const isAuthenticated = () => {
    const token = localStorage.getItem('accessToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || !user.role) {
        return false;
    }
    
    // Check if token is expired
    try {
        // Simple expiry check based on decoded token
        const tokenData = parseJwt(token);
        const currentTime = Date.now() / 1000;
        
        if (tokenData.exp < currentTime) {
            // Try to refresh the token
            return refreshToken();
        }
        
        return true;
    } catch (err) {
        console.error("Authentication error:", err);
        return false;
    }
};

// Parse JWT token
const parseJwt = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

// Handle token refresh
const refreshToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
        logout();
        return false;
    }
    
    try {
        const response = await fetch('/api/auth/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) {
            throw new Error('Token refresh failed');
        }
        
        const data = await response.json();
        
        // Store new tokens
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        
        return true;
    } catch (err) {
        console.error("Token refresh error:", err);
        logout();
        return false;
    }
};

// Store user data in localStorage
const storeUserData = (userData, tokens) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
};

// Get user data
const getUserData = () => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
};

// Get user role
const getUserRole = () => {
    const userData = getUserData();
    return userData ? userData.role : null;
};

// Check if user has specific role
const hasRole = (requiredRole) => {
    const userRole = getUserRole();
    
    if (!userRole) return false;
    
    // Role hierarchy (higher roles have access to lower role pages)
    const roleHierarchy = {
        'superAdmin': 4,
        'superFranchisee': 3,
        'franchisee': 2,
        'subFranchisee': 1,
        'user': 0
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Logout user
const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/index.html'; // Redirect to login page
};

// Protect routes based on user role
const protectRoute = (requiredRole) => {
    if (!isAuthenticated()) {
        window.location.href = '/index.html';
        return false;
    }
    
    if (!hasRole(requiredRole)) {
        window.location.href = '/pages/unauthorized.html';
        return false;
    }
    
    return true;
};

// Add auth header to API requests
const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};