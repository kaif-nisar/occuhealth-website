async function dashboard() {
    console.log("this is the user:", user);

    await fetchData();
    await fetchFranchisee();
    async function fetchData() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-booking-all`);
            const apiData = await response.json();
            // 🟢 Parallel Execution
            requestAnimationFrame(() => updateDashboard(apiData.data));
            requestAnimationFrame(() => updateCharts(apiData.data));
            // 👉 Sequential Execution

        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }
    //fetch franchisee
    async function fetchFranchisee() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-franchisee-all`);
            const data = await response.json();
            updateFranchisee(data.data)
        } catch (error) {
            console.error("Error fetching franchisee data:", error);
        }
    }

    function updateFranchisee(data) {
        document.getElementById("activeFranchises").innerText = data.length - 1;
        const tableBody = document.querySelector('#tbody');
        tableBody.innerHTML = ''; // Clear existing rows
        data.forEach((franchisee, index) => {
            if (franchisee.createdBy === "679a0e36413ee0ae2ff2eb11") {
                const row = document.createElement("tr");
                row.innerHTML = `
        <td>${franchisee.fullName}</td>
        <td>${franchisee.address}</td>
        <td>${franchisee.phoneNo}<br>${franchisee.email}}</td>
        <td>
        <a href="#" onclick="loadPage('editFranchisee', '${franchisee._id}')">Edit</a>
        <a href="#" class="status-link" style="color: ${franchisee.isActive ? 'green' : 'red'};">
                    ${franchisee.isActive ? 'Active' : 'Inactive'}
                </a>
        </td>`;
                tableBody.appendChild(row);
            }
        })
    }
    function updateDashboard(data) {

        // Update Total Bookings
        document.getElementById("totalBookings").innerText = data.length;

        // Use Map & Reduce for Fast Calculation
        let totalRevenue = 0;
        let pendingTests = 0;

        data.forEach(item => {
            totalRevenue += item.total || 0;
            if (item.status === "On Hold") pendingTests++;
        });

        document.getElementById("totalRevenue").innerText = Math.round(totalRevenue);
        document.getElementById("pendingTests").innerText = pendingTests;

    }
    function updateCharts(data) {

        const dailyBalance = {};
        const monthlyBalance = {};

        data.forEach(item => {
            if (!item.date) {
                console.warn("Skipping invalid data (no date):", item);
                return; // Skip if date is missing
            }

            const date = new Date(item.date);
            if (isNaN(date)) {
                console.warn("Invalid Date:", item.date);
                return;
            }

            const month = `${date.getFullYear()}-${date.getMonth() + 1}`; // YYYY-MM
            const day = date.toLocaleDateString(); // DD/MM/YYYY

            // 🟢 **Balance `item.total` me hai, `item.tableData[0].total` nahi hai**
            const balance = isNaN(item.total) ? 0 : item.total;

            // 🔹 Monthly Balance Calculation
            if (!monthlyBalance[month]) monthlyBalance[month] = 0;
            monthlyBalance[month] += balance;

            // 🔹 Daily Balance Calculation
            if (!dailyBalance[day]) dailyBalance[day] = 0;
            dailyBalance[day] += balance;
        });

        // 🟢 Correct Sorting for Monthly Balance
        const sortedMonthlyKeys = Object.keys(monthlyBalance)
            .sort((a, b) => new Date(a) - new Date(b)); // Sort months chronologically

        const sortedMonthlyValues = sortedMonthlyKeys.map(month => monthlyBalance[month]); // Map values accordingly

        // 🟢 Create Monthly Balance Chart (Sorted)
        createChart(
            "revenueChart",
            "line",
            "Monthly Balance",
            sortedMonthlyKeys,  // Sorted months
            sortedMonthlyValues,  // Sorted data
            'rgba(0, 123, 255, 0.2)',
            'rgba(0, 123, 255, 1)'
        );


        // 🟢 Create Daily Balance Chart (Reverse Labels & Data)
        createChart(
            "samplesChart",
            "bar",
            "Daily Balance",
            Object.keys(dailyBalance).reverse(),
            Object.values(dailyBalance).reverse(),
            'rgba(40, 167, 69, 0.2)',
            'rgba(40, 167, 69, 1)'
        );

        const testCategories = data.reduce((acc, item) => {
            if (item.tableData && item.tableData.length > 0) {
                const testName = item.tableData[0].testName || "Unknown";
                acc[testName] = (acc[testName] || 0) + 1;
            }
            return acc;
        }, {});

        // 🎯 Convert object to array, sort by count, and get top 5
        const sortedTests = Object.entries(testCategories)
            .sort((a, b) => b[1] - a[1]) // Sort descending by count
            .slice(0, 5); // Get top 5

        const topTestNames = sortedTests.map(item => item[0]);  // Test names
        const topTestCounts = sortedTests.map(item => item[1]); // Test counts

        // 🎨 Unique colors for top 5 tests
        const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A8", "#FFD433"];

        createChart("testCategoriesChart", "doughnut", "Top 5 Test Categories", topTestNames, topTestCounts, colors);
    }

    function createChart(canvasId, type, label, labels, data, bgColor = 'rgba(255, 99, 132, 0.2)', borderColor = 'rgba(255, 99, 132, 1)') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return;
        }
        new Chart(canvas.getContext("2d"), {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                    fill: type === "line"
                }]
            },
            options: { responsive: true }
        });
    }
}

async function initialization() {
    const loader = document.querySelector(".loader");
    loader.style.display = "block";
    try {
        await dashboard();
    } catch (error) {
        console.log(error);
    } finally {
        loader.style.display = "none";
    }
}

initialization();