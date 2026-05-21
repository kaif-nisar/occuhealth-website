// api.js - Frontend API Service

// Base API configuration
const API_BASE_URL = '/api';

// API request helper with authentication
const apiRequest = async (endpoint, method = 'GET', data = null) => {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeader()
        };

        const config = {
            method,
            headers,
            credentials: 'include' // Include cookies for sessions if used
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        // Handle authentication errors
        if (response.status === 401) {
            const refreshSuccessful = await refreshToken();
            if (refreshSuccessful) {
                // Retry the request with new token
                return apiRequest(endpoint, method, data);
            } else {
                logout();
                throw new Error('Authentication failed');
            }
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error(`API error (${endpoint}):`, error);
        throw error;
    }
};

// Auth API endpoints
const authAPI = {
    login: async (username, password, pin) => {
        return apiRequest('/auth/login', 'POST', { username, password, pin });
    },
    logout: async () => {
        return apiRequest('/auth/logout', 'POST');
    },
    verifyPin: async (pin) => {
        return apiRequest('/auth/verify-pin', 'POST', { pin });
    }
};

// User API endpoints
const userAPI = {
    getCurrentUser: async () => {
        return apiRequest('/user/profile');
    },
    createUser: async (userData) => {
        return apiRequest('/user/register', 'POST', userData);
    },
    createFranchisee: async (franchiseeData) => {
        return apiRequest('/user/super-franchisee/create', 'POST', franchiseeData);
    },
    getAllFranchisees: async () => {
        return apiRequest('/user/franchisees');
    }
};

// Panel API endpoints
const panelAPI = {
    getAllPanels: async () => {
        return apiRequest('/panels');
    },
    getPanelById: async (id) => {
        return apiRequest(`/panels/${id}`);
    },
    createPanel: async (panelData) => {
        return apiRequest('/panels', 'POST', panelData);
    },
    updatePanel: async (id, panelData) => {
        return apiRequest(`/panels/${id}`, 'PUT', panelData);
    },
    updatePanelOrder: async (orderData) => {
        return apiRequest('/panels/order', 'PUT', orderData);
    }
};

// Package API endpoints
const packageAPI = {
    getAllPackages: async () => {
        return apiRequest('/packages');
    },
    getPackageById: async (id) => {
        return apiRequest(`/packages/${id}`);
    },
    createPackage: async (packageData) => {
        return apiRequest('/packages', 'POST', packageData);
    },
    updatePackage: async (id, packageData) => {
        return apiRequest(`/packages/${id}`, 'PUT', packageData);
    }
};

// Test API endpoints
const testAPI = {
    getAllTests: async () => {
        return apiRequest('/tests');
    },
    getTestById: async (id) => {
        return apiRequest(`/tests/${id}`);
    },
    createTest: async (testData) => {
        return apiRequest('/tests', 'POST', testData);
    },
    updateTest: async (id, testData) => {
        return apiRequest(`/tests/${id}`, 'PUT', testData);
    },
    updateTestOrder: async (orderData) => {
        return apiRequest('/tests/order', 'PUT', orderData);
    },
    getTestCategories: async () => {
        return apiRequest('/tests/categories');
    }
};

// Transaction API endpoints
const transactionAPI = {
    sendMoney: async (recipientType, recipientId, amount) => {
        const endpoint = `/transaction/send-to-${recipientType.toLowerCase()}`;
        return apiRequest(endpoint, 'POST', { recipientId, amount });
    },
    debitMoney: async (debitType, accountId, amount) => {
        const endpoint = `/transaction/debit-from-${debitType.toLowerCase()}`;
        return apiRequest(endpoint, 'POST', { accountId, amount });
    },
    getTransactionHistory: async (filters) => {
        return apiRequest('/transaction/history', 'GET', filters);
    }
};