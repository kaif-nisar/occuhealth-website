let products = [];
let filtered = [];
let page = 1;
const perPage = 5;

// DOM Elements
const tableBody = document.getElementById('inventoryTableBody');
const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('categoryFilter');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const showingFrom = document.getElementById('showingFrom');
const showingTo = document.getElementById('showingTo');
const totalCount = document.getElementById('totalCount');

const editModal = document.getElementById('editProductModal');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveEditBtn = document.getElementById('saveChangesBtn');
const editIdInput = document.getElementById('editId');
const editName = document.getElementById('editName');
const editSKU = document.getElementById('editSKU');
const editCategory = document.getElementById('editCategory');
const editPrice = document.getElementById('editPrice');
const editStock = document.getElementById('editStock');
const editStatus = document.getElementById('editstatus');
const editDiscount = document.getElementById('editdiscount');

// GET ALL PRODUCTS
async function fetchAllProducts() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getAllProducts`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            products = result.data;
            filtered = [...products]; // ✅ set global filtered array
            renderProducts(filtered);
        } else {
            console.error("❌ Failed to fetch products:", result.message);
        }

    } catch (error) {
        console.error("❌ Server error while fetching products:", error);
    }
}

function renderProducts(arr) {
    const start = (page - 1) * perPage, end = page * perPage;
    const slice = arr.slice(start, end);
    tableBody.innerHTML = '';
    slice.forEach(p => {
        const tr = document.createElement('tr');
        const statusClass = p.status === 'Active' ? 'status-active' : 'status-inactive';
        tr.innerHTML = `
        <td class="px-6 py-4">${new Date(p.createdAt).toLocaleDateString()}</td>
        <td class="px-6 py-4 flex items-center gap-3"><img src="${p.mainImage?.url}" class="h-10 w-10 rounded"/>
            <span>${p.name}</span></td>
        <td class="px-6 py-4">${p.skuId}</td>
        <td class="px-6 py-4">${p.category}</td>
        <td class="px-6 py-4">₹${p.price}</td>
        <td class="px-6 py-4">${p.stock}</td>
        <td class="px-6 py-4"><span class="${statusClass}">${p.status}</span></td>
        <td class="px-6 py-4 text-right">
            <button onclick="editProduct('${p._id}')" class="text-blue-600 hover:underline">Edit</button>
        </td>`;
        tableBody.appendChild(tr);
    });

    const total = arr.length;
    showingFrom.textContent = total === 0 ? 0 : start + 1;
    showingTo.textContent = Math.min(end, total);
    totalCount.textContent = total;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = end >= total;
}

function filterProducts() {
    const s = searchInput.value.toLowerCase();
    const cat = categoryFilter.value;

    filtered = products.filter(p =>
        (!s || (p.name + p.skuId + p.category).toLowerCase().includes(s)) &&
        (!cat || p.category === cat)
    );

    page = 1;
    renderProducts(filtered);
}

function editProduct(id) {
    const p = products.find(x => x._id === id);
    if (!p) return;
    editIdInput.value = p._id;
    editName.value = p.name;
    editSKU.value = p.skuId;
    editCategory.value = p.category;
    editPrice.value = p.price;
    editStock.value = p.stock;
    editStatus.value = p.status;
    editDiscount.value = p.discountPrice || '';
    editModal.classList.remove('hidden');
}

async function saveProductChanges() {
    const id = editIdInput.value;

    const updatedProduct = {
        name: editName.value,
        skuId: editSKU.value,
        category: editCategory.value,
        price: parseFloat(editPrice.value),
        stock: parseInt(editStock.value),
        status: editStatus.value,
        discountPrice: parseFloat(editDiscount.value)
    };

    // Client-side check for discount > price
    if (updatedProduct.discountPrice > updatedProduct.price) {
        return alert("❌ Discount price cannot be greater than original price.");
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/updateProduct/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedProduct)
        });

        const result = await response.json();

        if (result.success) {
            const index = products.findIndex(p => p._id === id);
            if (index !== -1) {
                products[index] = { ...products[index], ...updatedProduct };
                filterProducts(); // update UI
            }
            editModal.classList.add('hidden');
            alert(result.message);
        } else {
            alert("❌ Failed to update product: " + result.message);
        }

    } catch (error) {
        console.error("❌ Error while updating product:", error);
        alert("❌ Server error while updating product.");
    }
}

// Event Listeners
prevBtn.addEventListener('click', () => { page--; renderProducts(filtered); });
nextBtn.addEventListener('click', () => { page++; renderProducts(filtered); });
cancelEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));
saveEditBtn.addEventListener('click', saveProductChanges);
searchInput.addEventListener('input', filterProducts);
categoryFilter.addEventListener('change', filterProducts);

// Initial Call
fetchAllProducts();
