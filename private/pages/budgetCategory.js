// Get authentication token (adjust based on your auth system)
function getAuthToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// API Headers
function getHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// DOM Elements (same as before)
const categoryList = document.getElementById('categoryList');
const searchInput = document.getElementById('searchInput');
const totalCategories = document.getElementById('totalCategories');
const totalBudget = document.getElementById('totalBudget');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const categoryModal = document.getElementById('categoryModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const modalTitle = document.getElementById('modalTitle');
const categoryForm = document.getElementById('categoryForm');
const categoryName = document.getElementById('categoryName');
const categoryBudget = document.getElementById('categoryBudget');
const saveCategoryBtn = document.getElementById('saveCategoryBtn');
const saveBtnText = document.getElementById('saveBtnText');
const nameError = document.getElementById('nameError');
const budgetError = document.getElementById('budgetError');

// Current category being edited
let currentEditId = null;

// Initialize the page
    loadCategories();
    
    // Event Listeners
    addCategoryBtn.addEventListener('click', openAddModal);
    closeModal.addEventListener('click', closeCategoryModal);
    cancelBtn.addEventListener('click', closeCategoryModal);
    saveCategoryBtn.addEventListener('click', saveCategory);
    searchInput.addEventListener('input', handleSearch);
    
    // Close modal when clicking outside
    categoryModal.addEventListener('click', function(e) {
        if (e.target === categoryModal) {
            closeCategoryModal();
        }
    });

// Load categories from backend
async function loadCategories() {
    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/api/v1/user/getAllCategories`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch categories');
        }

        const result = await response.json();
        
        if (result.success) {
            renderCategories(result.data);
            await loadStats();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showError('Failed to load categories: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getCategoryStats`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                updateStats(result.data);
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Render categories to the DOM
function renderCategories(categories) {
    if (!categories || categories.length === 0) {
        categoryList.innerHTML = '<div class="no-categories">No categories found. Create your first budget category!</div>';
        return;
    }

    categoryList.innerHTML = '';
    categories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.innerHTML = `
            <div class="category-name">${category.name}</div>
            <div class="category-budget">₹${category.budget.toLocaleString()}</div>
            <div class="category-date">${formatDate(category.createdAt)}</div>
            <div class="category-actions">
                <button class="btn btn-edit" onclick="editCategory('${category._id}')">Edit</button>
                <button class="btn btn-delete" onclick="deleteCategory('${category._id}')">Delete</button>
            </div>
        `;
        categoryList.appendChild(categoryItem);
    });
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-IN', options);
}

// Update statistics display
function updateStats(stats) {
    totalCategories.textContent = stats.totalCategories;
    totalBudget.textContent = `₹${stats.totalBudget.toLocaleString()}`;
}

// Handle search functionality
async function handleSearch() {
    const query = searchInput.value.trim();
    
    if (query === '') {
        loadCategories();
        return;
    }

    try {
        showLoading();
        const response = await fetch(`${BASE_URL}/api/v1/user/searchCategories?query=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                renderCategories(result.data);
            }
        }
    } catch (error) {
        console.error('Error searching categories:', error);
        showError('Failed to search categories');
    } finally {
        hideLoading();
    }
}

// Open modal for adding a new category
function openAddModal() {
    modalTitle.textContent = 'Add New Category';
    categoryName.value = '';
    categoryBudget.value = '';
    currentEditId = null;
    hideErrors();
    categoryModal.classList.add('active');
}

// Open modal for editing a category
async function editCategory(id) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getCategoryById/${id}`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch category');
        }

        const result = await response.json();
        
        if (result.success) {
            const category = result.data;
            modalTitle.textContent = 'Edit Category';
            categoryName.value = category.name;
            categoryBudget.value = category.budget;
            currentEditId = id;
            hideErrors();
            categoryModal.classList.add('active');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error fetching category:', error);
        showError('Failed to load category for editing');
    }
}

// Close the modal
function closeCategoryModal() {
    categoryModal.classList.remove('active');
}

// Hide error messages
function hideErrors() {
    nameError.classList.remove('show');
    budgetError.classList.remove('show');
}

// Validate form inputs
function validateForm() {
    let isValid = true;
    
    if (!categoryName.value.trim()) {
        nameError.classList.add('show');
        isValid = false;
    } else {
        nameError.classList.remove('show');
    }
    
    if (!categoryBudget.value || parseFloat(categoryBudget.value) <= 0) {
        budgetError.classList.add('show');
        isValid = false;
    } else {
        budgetError.classList.remove('show');
    }
    
    return isValid;
}

// Save category (add or update)
async function saveCategory() {
    if (!validateForm()) return;
    
    try {
        // Show loading state
        saveBtnText.innerHTML = '<span class="spinner"></span> Saving...';
        saveCategoryBtn.disabled = true;
        
        const categoryData = {
            name: categoryName.value.trim(),
            budget: parseFloat(categoryBudget.value)
        };

        const url = currentEditId 
            ? `${BASE_URL}/api/v1/user/updateCategory/${currentEditId}`
            : `${BASE_URL}/api/v1/user/addNewCategory`;
            
        const method = currentEditId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify(categoryData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to save category');
        }

        if (result.success) {
            // Reload categories to get updated list
            await loadCategories();
            closeCategoryModal();
            showSuccess(`Category ${currentEditId ? 'updated' : 'added'} successfully!`);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error saving category:', error);
        showError('Failed to save category: ' + error.message);
    } finally {
        // Reset button state
        saveBtnText.textContent = 'Save Category';
        saveCategoryBtn.disabled = false;
    }
}

// Delete a category
async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category?')) {
        return;
    }

    try {
        // Show loading state
        const deleteBtn = event.target;
        const originalText = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<span class="spinner"></span> Deleting...';
        deleteBtn.disabled = true;
        
        const response = await fetch(`${BASE_URL}/api/v1/user/deleteCategory/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to delete category');
        }

        if (result.success) {
            // Reload categories to get updated list
            await loadCategories();
            showSuccess('Category deleted successfully!');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showError('Failed to delete category: ' + error.message);
    }
}

// Utility functions
function showLoading() {
    // Add your loading indicator implementation
    categoryList.innerHTML = '<div class="no-categories">Loading...</div>';
}

function hideLoading() {
    // Remove your loading indicator
}

function showError(message) {
    alert('Error: ' + message);
}

function showSuccess(message) {
    alert('Success: ' + message);
}