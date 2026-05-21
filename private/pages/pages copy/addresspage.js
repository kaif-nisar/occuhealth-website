const addressForm = document.getElementById('addressForm');
const pincodeInput = document.getElementById('pincode');

pincodeInput.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '').substring(0, 6);
});

let savedAddressSection = null;
let addressContainer = null;
let addNewAddressBtn = null;

fetchAndPopulateAddresses();

async function fetchAndPopulateAddresses() {
    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/getAllAddresses`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await res.json();

        if (!res.ok || !Array.isArray(result.data) || result.data.length === 0) {
            showAddressFormOnly();
            return;
        }

        const address = result.data.find(a => a.isDefault) || result.data[0];
        createSavedAddressSection();
        populateAddressUI(address);
    } catch (err) {
        console.error("Failed to fetch address:", err);
        showAddressFormOnly();
    }
}

function showAddressFormOnly() {
    addressForm.classList.remove('hidden');
    if (savedAddressSection) savedAddressSection.remove();
}

function createSavedAddressSection() {
    if (savedAddressSection) return;

    savedAddressSection = document.createElement('div');
    savedAddressSection.style.marginBottom = "30px";

    addressContainer = document.createElement('div');
    addressContainer.className = 'saved-address';
    addressContainer.style.border = '1px solid #e5e7eb';
    addressContainer.style.borderRadius = '8px';
    addressContainer.style.padding = '20px';

    addNewAddressBtn = document.createElement('button');
    addNewAddressBtn.className = 'btn btn-outline';
    addNewAddressBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Address';
    addNewAddressBtn.style.marginTop = '20px';
    addNewAddressBtn.addEventListener('click', () => {
        addressForm.classList.remove('hidden');
        savedAddressSection.classList.add('hidden');
    });

    savedAddressSection.appendChild(addressContainer);
    savedAddressSection.appendChild(addNewAddressBtn);

    // Insert before form
    addressForm.parentNode.insertBefore(savedAddressSection, addressForm);
}

function populateAddressUI(address) {
    addressForm.classList.add('hidden');

    addressContainer.innerHTML = `
        <h3 style="margin-bottom: 10px; color: #10b981;">
            <i class="fas fa-check-circle"></i> Default Address
        </h3>
        <div class="address-details">
            <p>${address.firstName} ${address.lastName || ''}</p>
            <p>${address.address1}</p>
            ${address.address2 ? `<p>${address.address2}</p>` : ''}
            <p>${address.city}, ${address.state} ${address.pincode}</p>
            <p>${address.country}</p>
            <p>Phone: ${address.phone}</p>
            ${address.email ? `<p>Email: ${address.email}</p>` : ''}
        </div>
        <div class="address-actions" style="margin-top: 15px; display: flex; gap: 10px;">
            <button id="editAddressBtn" class="btn btn-outline btn-small">Edit</button>
            <button id="proceedAddressBtn" class="btn btn-primary btn-small">🚚 Ship it here!</button>
        </div>
    `;

    document.getElementById('editAddressBtn')?.addEventListener('click', () => {
        showAddressFormWithValues(address);
    });

    document.getElementById('proceedAddressBtn')?.addEventListener('click', () => {
        proceedToPayment(address);
    });
}

function showAddressFormWithValues(address) {
    addressForm.classList.remove('hidden');
    savedAddressSection.classList.add('hidden');

    document.getElementById('firstName').value = address?.firstName || '';
    document.getElementById('lastName').value = address?.lastName || '';
    document.getElementById('address').value = address?.address1 || '';
    document.getElementById('address2').value = address?.address2 || '';
    document.getElementById('city').value = address?.city || '';
    document.getElementById('state').value = address?.state || '';
    document.getElementById('pincode').value = address?.pincode || '';
    document.getElementById('phone').value = address?.phone || '';
    document.getElementById('email').value = address?.email || '';
    document.getElementById('saveAddress').checked = true;
}

// SUBMIT NEW ADDRESS
addressForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!this.checkValidity()) {
        alert('Please fill all required fields correctly');
        return;
    }

    const formData = new FormData(this);
    const addressData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        address1: formData.get('address'),
        address2: formData.get('address2'),
        city: formData.get('city'),
        state: formData.get('state'),
        pincode: formData.get('pincode'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        country: formData.get('country') || 'India',
        isDefault: true,
    };

    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/saveAddress`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(addressData),
        });

        const result = await res.json();

        if (!res.ok) {
            alert('Failed to save address');
            return;
        }

        fetchAndPopulateAddresses();
        location.reload();

    } catch (err) {
        console.error('Error saving address:', err);
        alert('Something went wrong');
    }
});

// PROCEED TO PAYMENT - send address + dummy cart to backend
async function proceedToPayment(address) {
    localStorage.setItem('address', JSON.stringify(address));
    window.location.href = `${BASE_URL}/${user.role}.html?page=invoice`;
}
