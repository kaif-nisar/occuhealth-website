let isPasswordVisible = false;

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.querySelector('.password-toggle');

    if (isPasswordVisible) {
        passwordInput.type = 'password';
        toggleButton.textContent = '👁️';
        isPasswordVisible = false;
    } else {
        passwordInput.type = 'text';
        toggleButton.textContent = '🙈';
        isPasswordVisible = true;
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorDiv = document.getElementById(`${fieldId}-error`);

    field.classList.add('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function clearError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorDiv = document.getElementById(`${fieldId}-error`);

    field.classList.remove('error');
    errorDiv.style.display = 'none';
}

function clearAllErrors() {
    const requiredFields = ['username', 'email', 'password', 'fullName', 'phone', 'role'];
    requiredFields.forEach(fieldId => clearError(fieldId));
}

function validateForm() {
    clearAllErrors();
    let isValid = true;

    // Required field validation
    const requiredFields = {
        'username': 'Username is required',
        'email': 'Email is required',
        'password': 'Password is required',
        'fullName': 'Full name is required',
        'phone': 'Phone number is required',
        'role': 'Role is required'
    };

    for (const [fieldId, message] of Object.entries(requiredFields)) {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showError(fieldId, message);
            isValid = false;
        }
    }

    // Email validation
    const email = document.getElementById('email').value;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('email', 'Please enter a valid email address');
        isValid = false;
    }

    // Password validation
    const password = document.getElementById('password').value;
    if (password && password.length < 6) {
        showError('password', 'Password must be at least 6 characters long');
        isValid = false;
    }

    // Phone validation
    const phone = document.getElementById('phone').value;
    if (phone && !/^\d{10,}$/.test(phone.replace(/\D/g, ''))) {
        showError('phone', 'Please enter a valid phone number');
        isValid = false;
    }

    return isValid;
}

function setLoading(loading) {
    const submitBtn = document.getElementById('submitBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const btnText = document.getElementById('btnText');

    if (loading) {
        submitBtn.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        btnText.textContent = 'Registering...';
    } else {
        submitBtn.disabled = false;
        loadingSpinner.style.display = 'none';
        btnText.textContent = 'Register Super Admin';
    }
}

async function submitForm(formData) {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            showMessage('Super Admin registered successfully!', 'success');
            document.getElementById('registrationForm').reset();
        } else {
            showMessage(result.message || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please check your connection and try again.', 'error');
    }
}

// Form submission handler
document.getElementById('registrationForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!validateForm()) {
        return;
    }

    setLoading(true);

    // Collect form data
    const formData = {
        username: document.getElementById('username').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        fullName: document.getElementById('fullName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        role: document.getElementById('role').value,
        state: document.getElementById('state').value.trim() || undefined,
        city: document.getElementById('city').value.trim() || undefined,
        pinCode: document.getElementById('pinCode').value || undefined,
        address: document.getElementById('address').value.trim() || undefined,
        permissions: {
            canManageBookings: document.getElementById('canManageBookings').checked,
            canManageTest: document.getElementById('canManageTest').checked,
            canManagePayments: document.getElementById('canManagePayments').checked,
            canViewReports: document.getElementById('canViewReports').checked,
            canManageUsers: document.getElementById('canManageUsers').checked
        }
    };

    // Remove undefined fields
    Object.keys(formData).forEach(key => {
        if (formData[key] === undefined || formData[key] === '') {
            delete formData[key];
        }
    });

    await submitForm(formData);
    setLoading(false);
});

// Real-time validation
document.addEventListener('input', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        clearError(e.target.id);
    }
});
