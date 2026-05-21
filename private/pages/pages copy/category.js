async function fetchAndPopulateCategories() {
    const loader = document.querySelector(".loader");
    loader.style.display = "block";
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/fetchCategories`, {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Failed to fetch categories");
        }

        const data = await response.json();
        if (data.categories) {
            populateCategories(data.categories);
        } else {
            console.error("No categories found");
        }
    } catch (error) {
        console.error("Error fetching categories:", error);
        alert("Error fetching categories. Please try again.");
    } finally {
    loader.style.display = "none";
    }
}


function populateCategories(categories) {
    const tbody = document.querySelector("#tbodyid");
    tbody.innerHTML = "";

    const noMatchRow = document.createElement("tr");
    noMatchRow.id = "noMatch";
    noMatchRow.style.display = "none";

    const cell = document.createElement("td");
    cell.setAttribute("colspan", "3");
    cell.textContent = "No matching row";
    cell.style.textAlign = "center";

    noMatchRow.appendChild(cell);
    tbody.appendChild(noMatchRow);

    categories.sort((a, b) => a.orderId - b.orderId);

    categories.forEach((category) => {
        const row = document.createElement("tr");
        row.setAttribute("draggable", true);
        row.setAttribute("data-id", category.orderId);

        const orderCell = document.createElement("td");
        orderCell.classList.add("order");
        orderCell.innerHTML = `<i class="fa-solid fa-up-down"></i>${category.orderId}`;

        const categoryCell = document.createElement("td");
        categoryCell.textContent = category.category;

        const actionsCell = document.createElement("td");
        actionsCell.classList.add("actions");
        actionsCell.innerHTML = `<a href="#" onclick="loadPage('editCategory', '${category._id}')">Edit</a>`;

        row.appendChild(orderCell);
        row.appendChild(categoryCell);
        row.appendChild(actionsCell);
        
        tbody.appendChild(row);
    });

    addDragAndDropListeners();
}


// Add drag-and-drop functionality
function addDragAndDropListeners() {
    const rows = document.querySelectorAll("#tbodyid tr");
    let draggedRow = null;

    rows.forEach((row) => {
        // Drag Start
        row.addEventListener("dragstart", (e) => {
            draggedRow = row;
            row.classList.add("dragging");
            e.dataTransfer.setDragImage(new Image(), 0, 0); // Optional: Hide default drag image
        });

        // Drag Over
        row.addEventListener("dragover", (e) => {
            e.preventDefault();
            const targetRow = e.target.closest("tr");
            if (targetRow && targetRow !== draggedRow) {
                targetRow.classList.add("drop-target");
            }
        });

        // Drag Leave
        row.addEventListener("dragleave", (e) => {
            const targetRow = e.target.closest("tr");
            if (targetRow) {
                targetRow.classList.remove("drop-target");
            }
        });

        // Drop
        row.addEventListener("drop", (e) => {
            e.preventDefault();
            const targetRow = e.target.closest("tr");
            if (targetRow && targetRow !== draggedRow) {
                const tbody = targetRow.parentElement;
                const draggedIndex = [...tbody.children].indexOf(draggedRow);
                const targetIndex = [...tbody.children].indexOf(targetRow);

                if (draggedIndex < targetIndex) {
                    tbody.insertBefore(draggedRow, targetRow.nextSibling);
                } else {
                    tbody.insertBefore(draggedRow, targetRow);
                }

                targetRow.classList.remove("drop-target");
            }
        });

        // Drag End
        row.addEventListener("dragend", () => {
            if (draggedRow) {
                draggedRow.classList.remove("dragging");
            }
            updateCategoryOrder(); // Update order after drag-and-drop
        });
    });
}

// Update category order and send it to the server
function updateCategoryOrder() {
    const rows = document.querySelectorAll("#tbodyid tr");
    const updatedOrder = [];

    rows.forEach((row, index) => {
        const id = row.getAttribute("data-id");
        const orderCell = row.querySelector(".order");
        orderCell.textContent = index + 1; // Update order in the UI
        updatedOrder.push({ id, orderId: index + 1 });
    });

    saveOrderToServer(updatedOrder);
}

async function saveOrderToServer(updatedOrder) {
    // Select table and container elements
    // const tableContainer = document.getElementById("tableContainer"); // Assume this is the container holding the table
    console.log(updatedOrder);
    const table = document.getElementById("categoriesTable");
    const loader = document.querySelector(".loader");
    loader.style.display = "block";

    // Hide the table container
    table.style.display = "none";

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/updatecategoryOrder`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ updatedOrder }),
        });

        if (!response.ok) {
            throw new Error("Failed to update order on server");
        }

        const result = await response.json();
        console.log("Order updated successfully:", result);
        location.reload();
    } catch (error) {
        console.error("Error updating order on server:", error);
        alert("Failed to save the order. Please try again.");
    } finally {
        // Show the table container and hide the loading animation
        table.style.display = "block";
    loader.style.display = "none";
    }
}

async function filterTable(event) {

    const rows = document.querySelectorAll("tbody tr");
    const inputValue = event.target.value;
    let match = false;

    rows.forEach((row) => {

        if(row.id === "noMatch") return;

        if(row.cells[1].textContent.toLowerCase().includes(inputValue.toLowerCase())) {
            row.style.display = "";
            match = true;
        } else {
            row.style.display = "none";
        }
    })

    const noMatchrow = document.getElementById("noMatch");
    if(match) {
        noMatchrow.style.display = "none";
    } else {
        noMatchrow.style.display = "";
    }
}

// Initialize the script
fetchAndPopulateCategories();