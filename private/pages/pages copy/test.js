loadTest();

async function loadTest() {
    const loader = document.querySelector(".loader");
    loader.style.display = "block";
    try {
        // Retrieve the access token from cookies

        const response = await fetch(`${BASE_URL}/api/v1/user/test-database-tenant`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                // 'Cookie': cookiesY // Include cookies in headers
            },
            // body: JSON.stringify({ cookiesY }), // Include necessary body data
            credentials: 'include'
        });

        // Check if the response is ok
        if (!response.ok) {
            throw new Error("something went wrong"); // Throw a proper error message
        }

        const testData = await response.json();

        await populateLoadTest(testData.tests); // Call the function to handle the test data
    }
    catch (error) {
        console.error("Error in loadTest:", error); // Log the error message
    } finally {
        loader.style.display = "none";

    }
}

async function populateLoadTest(test) {
    const tbody = document.querySelector("#tbodyid");
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

    // Sort the tests by the order field
    test.sort((a, b) => a.order - b.order);

    for (const t of test) {
        const row = document.createElement('tr');
        row.setAttribute('draggable', true); // Make the row draggable
        row.setAttribute('data-id', t.order); // Store the order ID for reference

        // let catdoc = await loadcategory(t.category);

        row.innerHTML = `
            <td class="order"><i class="fa-solid fa-up-down"></i>${t.order}</td>
            <td>${t.Name}</td>
            <td>${t.Price}</td>
            <td>${t.sampleType}</td>
            <td>${t.Short_name}</td>
            <td>${t.category.category}</td>
            <td class="actions">
                <a href="#" onclick="loadPage('editTest', '${t._id}')"><i class="fa-solid fa-pen-to-square"></i> Edit</a>
            </td>`;

        tbody.appendChild(row);
    }

    // Add drag-and-drop functionality
    addDragAndDropListeners();

    // Add event listeners for edit buttons
    addEditButtonListeners();
}

function addDragAndDropListeners() {
    const rows = document.querySelectorAll("#tbodyid tr");
    let draggedRow = null;
    let scrollInterval = null;

    rows.forEach(row => {
        row.addEventListener("dragstart", (e) => {
            draggedRow = row;
            row.classList.add("dragging");
            e.dataTransfer.setDragImage(new Image(), 0, 0);

            // ✅ Auto-scroll start only on dragging
            scrollInterval = setInterval(() => scrollWhileDragging(e), 0);
        });

        row.addEventListener("dragover", (e) => {
            e.preventDefault();
            scrollWhileDragging(e); // ✅ Ensure smooth scroll while dragging
            const targetRow = e.target.closest("tr");
            if (targetRow && targetRow !== draggedRow) {
                targetRow.classList.add("drop-target");
            }
        });

        row.addEventListener("dragleave", (e) => {
            const targetRow = e.target.closest("tr");
            if (targetRow) {
                targetRow.classList.remove("drop-target");
            }
        });

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

        row.addEventListener("dragend", async () => {
            if (draggedRow) {
                draggedRow.classList.remove("dragging");
            }
            // 🛑 Stop auto-scroll when drag ends
            clearInterval(scrollInterval);
            await updateOrder();
        });
    });
}

function scrollWhileDragging(event) {
    const scrollSpeed = 10; // Adjust scroll speed
    const tableContainer = document.getElementById("tablecontainer");
    if (!tableContainer) return;

    const containerRect = tableContainer.getBoundingClientRect();
    const scrollTop = tableContainer.scrollTop;
    const maxScroll = tableContainer.scrollHeight - tableContainer.clientHeight;

    // 🟢 Scroll Up if cursor is above the tableContainer
    if (event.clientY < containerRect.top && scrollTop > 0) {
        tableContainer.scrollTop -= scrollSpeed;
    }
    // 🔴 Scroll Down if cursor is below the tableContainer
    else if (event.clientY > containerRect.bottom && scrollTop < maxScroll) {
        tableContainer.scrollTop += scrollSpeed;
    }
}

async function updateOrder() {
    const rows = document.querySelectorAll("#tbodyid tr");
    const updatedOrder = [];

    rows.forEach((row, index) => {
        const orderId = row.getAttribute('data-id');
        const orderCell = row.querySelector('td:first-child');
        orderCell.textContent = index + 1; // Update the order number visually
        updatedOrder.push({ id: orderId, order: index + 1 });
    });

    // Send the updated order to the server
    saveOrderToServer(updatedOrder);
}

async function saveOrderToServer(updatedOrder) {
    // Select table and container elements
    const tableContainer = document.getElementById("tableContainer"); // Assume this is the container holding the table
    const table = document.getElementById("categoriesTable");
    const loader = document.querySelector(".loader");
    loader.style.display = "block";

    // Hide the table container
    tableContainer.style.display = "none";

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/editTestOrder`, {
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

function addEditButtonListeners() {
    const editButtons = document.querySelectorAll('.actions a[data-page="editTest"]');
    editButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();

            const row = e.target.closest('tr');
            if (row && row.cells.length >= 3) {
                const cellvalue1 = row.cells[1].textContent.trim();
                const cellvalue2 = row.cells[2].textContent.trim();

                const url = `${BASE_URL}/admin.html?page=editTest&value1=${encodeURIComponent(cellvalue1)}&value2=${encodeURIComponent(cellvalue2)}`;
                window.location.href = url;
            } else {
                console.error("Row or cells not found!");
            }
        });
    });
}

function filterTable() {
    const searchInput = document.querySelector("#searchInput").value.toLowerCase(); // Get the search query
    const rows = document.querySelectorAll("#tbodyid tr");
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

