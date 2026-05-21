function showRatelist(list) {
    document.getElementById('in-ratelist').classList.add('hidden');
    document.getElementById('not-in-ratelist').classList.add('hidden');
    document.getElementById('in-ratelist-tab').classList.remove('active');
    document.getElementById('not-in-ratelist-tab').classList.remove('active');

    if (list === 'in-ratelist') {
        document.getElementById('in-ratelist').classList.remove('hidden');
        document.getElementById('in-ratelist-tab').classList.add('active');
    } else {
        document.getElementById('not-in-ratelist').classList.remove('hidden');
        document.getElementById('not-in-ratelist-tab').classList.add('active');
    }
}


async function fetchingpackagesfromDatabase() {
    const loader = document.querySelector(".loader");
    loader.style.display = "block";
    
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/all-packages`, { method: "POST" })

        if (!response.ok) {
            throw new Error("something went wrong while fetching details")
        }

        const packageData = await response.json();

        printpackagesInTable(packageData);

    } catch (error) {
        console.log(error);
    } finally {
        loader.style.display = "none";
    }
}

function printpackagesInTable(allpackages) {
    const pannelTableBody = document.querySelector('#in-ratelist tbody');
    pannelTableBody.innerHTML = '';
    let orderId = 0;

    const noMatchRow = document.createElement("tr");
    noMatchRow.id = "noMatch";
    noMatchRow.style.display = "none";

    const cell = document.createElement("td");
    cell.setAttribute("colspan", "7");
    cell.textContent = "No matching row";
    cell.style.textAlign = "center";

    noMatchRow.appendChild(cell);
    pannelTableBody.appendChild(noMatchRow);

    allpackages.forEach(package => {
        const row = document.createElement('tr');
        orderId++;
        // console.log(package);

        row.innerHTML = `
        <td>${orderId}</td>
        <td>${package.packageName}</td>
        <td>${package.packageFee}</td>
        <td>${package.pannelname.join(",")},${package.testname.join(",")}</td>
        <td>${package.testSample.join(",")},${package.pannelSample.join(",")}</td>
         <td class="actions">
                <a href="#" onclick="loadPage('editPackage', '${package._id}')">Edit</a>
            </td>`

        pannelTableBody.appendChild(row);
    })
};

fetchingpackagesfromDatabase();

function filterTable() {
    const searchInput = document.querySelector("#searchInput").value.toLowerCase(); // Get the search query
    const rows = document.querySelectorAll("#packagetbody tr");
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