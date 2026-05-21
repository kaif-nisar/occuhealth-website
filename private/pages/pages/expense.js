function expense() {
    'use strict';

let expenses = [];

// Utility to format date as DD/MM/YYYY
function formatDateYYYYMMDD(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}

// Calculate dates
const today = new Date();
const oneMonthAgo = new Date();
oneMonthAgo.setMonth(today.getMonth() - 1);

// Format
const startDateStr = formatDateYYYYMMDD(oneMonthAgo);
const endDateStr = formatDateYYYYMMDD(today);

// Set input value
document.getElementById('dateRange').value = `${startDateStr} - ${endDateStr}`;

fetchExpensesByDateRange(startDateStr, endDateStr);

async function fetchExpensesByDateRange(startDate, endDate) {
    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/fetchUserExpensesuser?startDate=${startDate}&endDate=${endDate}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
            expenses = data.data;
            updateUI();
        } else {
            console.log('Unexpected response:', data);
        }
    } catch (err) {
        console.error('Failed to fetch expenses:', err);
    }
}


document.getElementById('searchExpensesBtn').addEventListener('click', async () => {
    const dateRange = document.getElementById('dateRange').value;
    const [startDate, endDate] = dateRange.split(' - ');

    try {
        const res = await fetch(`${BASE_URL}/api/v1/user/fetchUserExpensesuser?startDate=${startDate}&endDate=${endDate}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
            expenses = data.data;
            updateUI();
        } else {
            console.error('Unexpected response:', data);
        }
    } catch (err) {
        console.error('Failed to fetch expenses:', err);
    }
});



// Utility for format date string to DD/MM/YYYY
function formatDate(isoDate) {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-GB');
}

// Elements
const expensesTableBody = document.getElementById('expensesTableBody');
const totalExpenseEl = document.getElementById('totalExpense');
const cashAmountEl = document.getElementById('cashAmount');
const cardAmountEl = document.getElementById('cardAmount');
const upiAmountEl = document.getElementById('upiAmount');
const categoryLegendEl = document.getElementById('categoryLegend');
const pieChartCtx = document.getElementById('categoryPieChart').getContext('2d');

// Modals and forms
const editModal = document.getElementById('editModal');
const addModal = document.getElementById('addModal');
const editExpenseForm = document.getElementById('editExpenseForm');
const addNewExpenseBtn = document.getElementById('addNewExpenseBtn');

// Current editing id
let editingId = null;

// Render functions
function renderTable() {
    expensesTableBody.innerHTML = '';
    expenses.forEach((e) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50";
        tr.innerHTML = `
        <td class="whitespace-nowrap px-4 py-3 text-sm">${formatDate(e.date)}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm capitalize">${e.category}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm">${e.title}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm">${e.paymentMode}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right font-medium text-sm">Rs.${parseFloat(e.amount).toFixed(2)}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm">${e.notes || ''}</td>
        <td class="whitespace-nowrap px-4 py-3 text-sm text-right">
          <button class="editBtn text-blue-600 hover:text-blue-800 font-semibold" data-id="${e._id}">Edit</button>
        </td>
      `;
        expensesTableBody.appendChild(tr);
    });

    // Attach edit buttons handlers
    document.querySelectorAll('.editBtn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const id = ev.target.dataset.id;
            openEditModal(id);
        });
    });
}

function calculateTotals() {
    let total = 0;
    const paymentSplits = { Cash: 0, Card: 0, UPI: 0 };
    const categorySums = {};

    expenses.forEach(e => {
        total += Number(e.amount);
        paymentSplits[e.paymentMode] = (paymentSplits[e.paymentMode] || 0) + Number(e.amount);
        categorySums[e.category] = (categorySums[e.category] || 0) + Number(e.amount);
    });

    return { total, paymentSplits, categorySums };
}

// Chart instance
let pieChart;

function renderSummary() {
    const { total, paymentSplits, categorySums } = calculateTotals();

    totalExpenseEl.textContent = `Rs.${total.toFixed(2)}`;
    cashAmountEl.textContent = `Rs.${(paymentSplits.Cash || 0).toFixed(2)}`;
    cardAmountEl.textContent = `Rs.${(paymentSplits.Credit || paymentSplits.Debit || 0).toFixed(2)}`;
    upiAmountEl.textContent = `Rs.${(paymentSplits.Online || 0).toFixed(2)}`;

    // Prepare data for chart
    const labels = Object.keys(categorySums);
    const data = Object.values(categorySums);
    const backgroundColors = labels.map((_, i) => chartColors[i % chartColors.length]);

    // Render the legend
    categoryLegendEl.innerHTML = '';
    labels.forEach((label, index) => {
        const color = backgroundColors[index];
        const amount = data[index];
        const legendItem = document.createElement('div');
        legendItem.className = 'flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap';
        legendItem.innerHTML = `
        <span aria-hidden="true" class="block h-4 w-4 rounded" style="background-color: ${color};"></span>
        ${label} (Rs.${amount.toFixed(2)})
      `;
        categoryLegendEl.appendChild(legendItem);
    });

    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieChartCtx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Category wise split',
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 0,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        },
    });
}

const chartColors = [
    '#2563EB', // Blue-600
    '#D97706', // Amber-600
    '#059669', // Green-600
    '#B91C1C', // Red-700
    '#7C3AED', // Purple-700
    '#EA580C', // Orange-600
    '#1E40AF', // Indigo-800
];

// Modal handlers
function openEditModal(id) {
    editingId = id;
    const expense = expenses.find(e => e._id === id);
    if (!expense) return;
    // Fill form
    editExpenseForm.date.value = expense.date;
    editExpenseForm.category.value = expense.category;
    editExpenseForm.date.valueAsDate = new Date(expense.date);
    editExpenseForm.name.value = expense.title;
    editExpenseForm.paymentMode.value = expense.paymentMode;
    editExpenseForm.amount.value = expense.amount;
    editExpenseForm.notes.value = expense.notes;
    showModal(editModal);
}
function closeEditModal() {
    editingId = null;
    hideModal(editModal);
}

function openAddModal() {
    // Default date today
    showModal(addModal);
}
function closeAddModal() {
    hideModal(addModal);
}

function showModal(modal) {
    modal.classList.remove('hidden');
    modal.querySelector('form')?.querySelector('input,select,textarea')?.focus();
}
function hideModal(modal) {
    modal.classList.add('hidden');
}

// Form submissions
editExpenseForm.addEventListener('submit', async (evt) => {
  evt.preventDefault();

  if (editingId === null) return;

  // Find index in local array
  const index = expenses.findIndex(e => e._id === editingId);
  if (index === -1) return;

  // Prepare updated expense data
  const updatedExpense = {
    date: editExpenseForm.date.value,
    category: editExpenseForm.category.value.trim(),
    title: editExpenseForm.name.value.trim(),
    paymentMode: editExpenseForm.paymentMode.value,
    amount: Number(editExpenseForm.amount.value),
    notes: editExpenseForm.notes.value.trim(),
  };

  try {
    // Send API request
    const response = await fetch(`${BASE_URL}/api/v1/user/editExpenseuser/${editingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedExpense)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update expense.');
    }

    const result = await response.json();

    // Update local array with API response
    expenses[index] = {
      id: result.data._id, // or result.data.id depending on your backend
      date: result.data.date,
      category: result.data.category,
      title: result.data.title,
      paymentMode: result.data.paymentMode,
      amount: result.data.amount,
      notes: result.data.notes
    };

    // Close modal and refresh UI
    closeEditModal();
    updateUI();

    alert('Expense updated successfully.');

  } catch (err) {
    console.error('Error updating expense:', err);
    alert(`Error: ${err.message}`);
  }
});


// Cancel and close buttons for modals
document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
document.getElementById('closeEditModalBtn').addEventListener('click', closeEditModal);
// document.getElementById('cancelAddBtn').addEventListener('click', closeAddModal);
// document.getElementById('closeAddModalBtn').addEventListener('click', closeAddModal);


// Close modal on outside click or Escape key
[editModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal(modal);
        }
    });
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!editModal.classList.contains('hidden')) closeEditModal();
        if (!addModal.classList.contains('hidden')) closeAddModal();
    }
});

// Initial render
function updateUI() {
    renderTable();
    renderSummary();
}

updateUI();


}
expense();