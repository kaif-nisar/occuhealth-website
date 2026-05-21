 (async function loaad () {
    const fetchCommissionLedger = async () => {
        const startDate = document.getElementById("start").value;
        const endDate = document.getElementById("end").value;

        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/commission-ledger?userId=${userId}&startDate=${startDate}&endDate=${endDate}`);
            const result = await response.json();
            if (result.success) {
                populateTable(result.data);
            } else {
                alert("Failed to fetch commission data.");
            }
        } catch (error) {
            console.error("Error fetching commission data:", error);
        }
    };

    const populateTable = (data) => {
        const tbody = document.querySelector("#tbody");
        tbody.innerHTML = ``; // Clear previous rows
        data.forEach((entry, index) => {
            console.log(entry)
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${new Date(entry.createdAt).toLocaleDateString()}</td>
                <td>${entry.description}</td>
               <td>${entry.testDetails && entry.testDetails.length > 0 ? entry.testDetails.map((test) => test.testName).join(", ") : "N/A"}</td>
                <td>${entry.testDetails.map((test) => test.testPrice).join(", ")}</td>
                <td>${entry.amount.toFixed(2)}</td>
                <td>${entry.receivedFrom}</td>
                <td>${entry.testDetails.map((test) => test.testName).join(", ")}</td>
            `;

            tbody.appendChild(row);
        });
    };

    // Attach event listener to the search button
    document.querySelector(".search-section button").addEventListener("click", fetchCommissionLedger);
    document.getElementById("search").addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll("table tbody tr");
    
        rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll("td"));
            const matches = cells.some((cell) => cell.textContent.toLowerCase().includes(searchTerm));
            row.style.display = matches ? "" : "none";
        });
    });
    

    // Initial fetch on page load
    fetchCommissionLedger();
})();
