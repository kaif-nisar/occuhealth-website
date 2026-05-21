
// async function fetchingPannelsfromDatabase() {
//     try {
//         const response = await fetch(`${BASE_URL}/api/v1/user/all-pannels`,{method:"POST"})

//         if(!response.ok) {
//             throw new Error("something went wrong while fetching details")
//         }

//         const allpannels = await response.json();
//         printPannelsInTable(allpannels);

//     } catch (error) {
//         console.log(error);
//     }
// }

// function printPannelsInTable(allpannels) {
//     const pannelTableBody = document.querySelector('#pannel-table tbody');
//     pannelTableBody.innerHTML = '';
//     let orderId = 0;

//     allpannels.forEach(pannel => {
//         const row = document.createElement('tr');
//         orderId++;

//         row.innerHTML = `
//         <td>${orderId}</td>
//         <td>${pannel.name}</td>
//         <td>${pannel.category}</td>
//         <td>${pannel.price}</td>
//         <td>${pannel.tests}</td>
//         <td>${pannel.sample_types}</td>
//          <td class="actions">
//                 <a href="#" onclick="loadPage('editPanels', '${pannel._id}')">Edit</a>
//             </td>`

//         pannelTableBody.appendChild(row);
//     })
// }

// fetchingPannelsfromDatabase();




async function fetchingPannelsfromDatabase() {
    const loader = document.querySelector(".loader");
    loader.style.display = "block";

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-pannels-tenant`, { method: "POST" });

        if (!response.ok) {
            throw new Error("Something went wrong while fetching details");
        }

        const panelData = await response.json();

        populatePannelsTable(panelData.panels);

    } catch (error) {
        console.log(error);
    } finally {
    loader.style.display = "none";
    }
}

async function populatePannelsTable(pannels) {
    console.log(pannels)
    const tbody = document.querySelector("#pannel-table tbody");
    tbody.innerHTML = "";

    const noMatchRow = document.createElement("tr");
    noMatchRow.id = "noMatch";
    noMatchRow.style.display = "none";

    const cell = document.createElement("td");
    cell.setAttribute("colspan", "7");
    cell.textContent = "No matching row";
    cell.style.textAlign = "center";

    noMatchRow.appendChild(cell);
    tbody.appendChild(noMatchRow);
    // Sort pannels by the order field if available
    pannels.sort((a, b) => a.order - b.order);

    for (const pannel of pannels) {
        const row = document.createElement('tr');
        row.setAttribute('draggable', true);
        row.setAttribute('data-id', pannel.order); // Store order ID for reference

        // const catdoc = await loadcategory(pannel.category);

        row.innerHTML = `
            <td class="order"><i class="fa-solid fa-up-down"></i>${pannel.order}</td>
            <td>${pannel.name}</td>
            <td>${pannel.category.category}</td>
            <td>${pannel.price}</td>
            <td class="pannelTests">${pannel.tests}</td>
            <td>${pannel.sample_types}</td>
            <td class="actions">
                <a href="#" onclick="loadPage('editPanels', '${pannel._id}')">Edit</a>
            </td>`;

        tbody.appendChild(row);
    }

    // Add drag-and-drop functionality
    addDragAndDropListeners();
}

function addDragAndDropListeners() {
    const rows = document.querySelectorAll("#pannel-table tbody tr");
    let draggedRow = null;

    rows.forEach(row => {
        // Drag Start
        row.addEventListener('dragstart', (e) => {
            draggedRow = row;
            row.classList.add('dragging');

            e.dataTransfer.setDragImage(new Image(), 0, 0);
        });

        // Drag Over
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetRow = e.target.closest('tr');
            if (targetRow && targetRow !== draggedRow) {
                targetRow.classList.add('drop-target');
            }
        });

        // Drag Leave
        row.addEventListener('dragleave', (e) => {
            const targetRow = e.target.closest('tr');
            if (targetRow) {
                targetRow.classList.remove('drop-target');
            }
        });

        // Drop
        row.addEventListener('drop', (e) => {
            e.preventDefault();

            const targetRow = e.target.closest('tr');
            if (targetRow && targetRow !== draggedRow) {
                const tbody = targetRow.parentElement;
                const draggedIndex = [...tbody.children].indexOf(draggedRow);
                const targetIndex = [...tbody.children].indexOf(targetRow);

                if (draggedIndex < targetIndex) {
                    tbody.insertBefore(draggedRow, targetRow.nextSibling);
                } else {
                    tbody.insertBefore(draggedRow, targetRow);
                }

                targetRow.classList.remove('drop-target');
            }
        });

        // Drag End
        row.addEventListener('dragend', () => {
            if (draggedRow) {
                draggedRow.classList.remove('dragging');
            }
            updateOrder(); // Save new order
        });
    });
}

function updateOrder() {
    const rows = document.querySelectorAll("#pannel-table tbody tr");
    const updatedOrder = [];

    rows.forEach((row, index) => {
        const orderId = row.getAttribute('data-id');
        const orderCell = row.querySelector('td:first-child');
        orderCell.textContent = index + 1; // Update order visually
        updatedOrder.push({ id: orderId, order: index + 1 });
    });

    // Save new order to the server
    saveOrderToServer(updatedOrder);
}

async function saveOrderToServer(updatedOrder) {
    // Select table and container elements
    const tableContainer = document.getElementById("pannel-table"); // Assume this is the container holding the table
    const table = document.getElementById("categoriesTable");
    const loader = document.querySelector(".loader");
    loader.style.display = "block";

    // Hide the table container
    tableContainer.style.display = "none";
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/updatePannelOrder`, {
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
        tableContainer.style.display = "block";
    loader.style.display = "none";
    }
}
fetchingPannelsfromDatabase();

function filterTable() {
    const searchInput = document.querySelector("#searchInput").value.toLowerCase(); // Get the search query
    const rows = document.querySelectorAll("#panel-tbody tr");
    let match = false;

    rows.forEach(row => {

        if (row.id === "noMatch") return;

        const rowData = Array.from(row.cells)
            .map(cell => cell.textContent.toLowerCase())
            .join(" "); // Concatenate all cell text in a row

        // Show the row if it includes the search query, otherwise hide it
        if (rowData.includes(searchInput)) {
            row.style.display = ""; // Show row
            match = true;
        } else {
            row.style.display = "none"; // Hide row
        }

        const noMatchrow = document.getElementById("noMatch");
        if (match) {
            noMatchrow.style.display = "none";
        } else {
            noMatchrow.style.display = "";
        }
    });
}
