const addNewCategoryBtn = document.getElementById('addNewCategoryBtn');
const newCategoryForm = document.getElementById('newCategoryForm');
const cancelNewCategory = document.getElementById('cancelNewCategory');
const saveNewCategory = document.getElementById('saveNewCategory');
const categorySelect = document.getElementById('category');

document.getElementById('expenseDate').valueAsDate = new Date();

addNewCategoryBtn.addEventListener('click', () => {
    newCategoryForm.classList.remove('hidden');
    addNewCategoryBtn.classList.add('hidden');
    // Optional: Clear inputs
    document.getElementById('newCategoryName').value = '';
    document.getElementById('newCategoryDescription').value = '';
});
``
cancelNewCategory.addEventListener('click', () => {
    newCategoryForm.classList.add('hidden');
    addNewCategoryBtn.classList.remove('hidden');
});

// --- Category Save Logic ---
saveNewCategory.addEventListener('click', async () => {
    const nameInput = document.getElementById('newCategoryName');
    const descInput = document.getElementById('newCategoryDescription');

    const name = nameInput.value.trim();
    const desc = descInput.value.trim();

    if (name === '') {
        alert('Category Name is required.');
        nameInput.focus();
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/addNewCategory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, budget: desc }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Failed to save category.');
        }

        // Refresh dropdown
        await populateCategories();

        // Hide form
        newCategoryForm.classList.add('hidden');
        addNewCategoryBtn.classList.remove('hidden');

        // Select newly added category
        categorySelect.value = name.toUpperCase();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
});

// --- Populate Category Dropdown from API ---
async function populateCategories() {
    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/getAllCategories`);
        const data = await res.json();

        // Clear existing options
        categorySelect.innerHTML = '';

        data.data.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name.toUpperCase();
            option.textContent = cat.name.toUpperCase();
            option.title = cat.description || '';
            categorySelect.appendChild(option);
        });
    } catch (err) {
        alert('Failed to fetch categories.');
    }
}

// Call this once on page load
populateCategories();


// --- Save Expense ---
const expenseForm = document.getElementById('expenseForm');
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const mode = document.getElementById('mode').value;
    const category = document.getElementById('category').value;
    const notes = document.getElementById('notes').value.trim();
    const date = document.getElementById('expenseDate').value;

    if (!name || isNaN(amount)) {
        alert('Please fill all required fields.');
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/addNewExpense`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: name,
                amount,
                paymentMode: mode,
                category,
                notes,
                date
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Failed to save expense.');
        }

        // Success
        alert('Expense saved successfully!');
        location.reload();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
});


// Cancel button of expense form - just clears fields here
const cancelBtn = document.getElementById('cancelBtn');
cancelBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
        document.getElementById('expenseForm').reset();
        // Hide new category form if open
        newCategoryForm.classList.add('hidden');
        addNewCategoryBtn.classList.remove('hidden');

        window.history.back();
    }
});
