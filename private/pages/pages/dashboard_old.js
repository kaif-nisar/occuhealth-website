async function dashboard() {
    // Check permissions at the start
    const permissions = user.permissions || {};
    const isStaff = user.role === 'staff';

    await fetchDashboardData();

    // Apply permission-based visibility
    applyPermissions(permissions, isStaff);

    function showFranchiseeSections(userdetails) {
        console.log("user details in modal:", userdetails);
        const usernoti = document.getElementById('userModal');
        
        // Check if element exists before setting innerHTML
        if (!usernoti) {
            console.warn("userModal element not found in DOM");
            return;
        }
        
        usernoti.innerHTML = `
            <div class="modal-content_one">
                <h3>User Details</h3>
                <p class="Name"><strong>Name: ${userdetails.fullName}</strong></p>
                <p class="email"><strong>Email: ${userdetails.email}</strong></p>
                <p class="role"><strong>Role: ${userdetails.role}</strong></p>
            </div>
        `;
    }

    // Call only if user data is available
    if (user && user.fullName) {
        showFranchiseeSections(user);
    }

    // Single API call for all dashboard data
    async function fetchDashboardData() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/get-booking-for-dashboard`);
            const data = await response.json();
            
            if (!response.ok) {
                console.log(data.message || "Failed to fetch dashboard data");
                return;
            }

            // Batch DOM updates using requestAnimationFrame for smooth rendering
            requestAnimationFrame(() => {
                updateDashboard(data.stats, permissions);
                updateCharts(data.charts, permissions);
                updateFranchisee(data.franchisees, permissions);
            });
            
        } catch (error) {
            console.error("Error fetching dashboard data:", error.message);
        }
    }

    function updateDashboard(stats, permissions) {
        if (!stats) return;

        // Total Bookings
        if (permissions.canManageBookings) {
            const elem = document.getElementById("totalBookings");
            if (elem) elem.innerText = stats.totalBookings;
        }

        // Total Revenue
        if (permissions.canManagePayments || permissions.canViewReports) {
            const elem = document.getElementById("totalRevenue");
            if (elem) elem.innerText = stats.totalRevenue;
        }

        // Pending Tests
        if (permissions.canManageBookings) {
            const elem = document.getElementById("pendingTests");
            if (elem) elem.innerText = stats.pendingTests;
        }

        // Balance
        if (permissions.canManagePayments || permissions.canViewReports) {
            const elem = document.getElementById("myBalance");
            if (elem) elem.innerText = `${user.commissionWallet}/-`;
        }

        // Active Franchises
        if (permissions.canManageUsers) {
            const elem = document.getElementById("activeFranchises");
            if (elem) elem.innerText = stats.activeFranchises;
        }
    }

    function updateCharts(charts, permissions) {
        if (!charts) return;

        // Only show charts if user has permission
        if (!permissions.canViewReports && !permissions.canManagePayments) {
            return;
        }

        // Monthly Revenue Chart
        if ((permissions.canViewReports || permissions.canManagePayments) && charts.monthlyRevenue?.labels?.length > 0) {
            createChart(
                "revenueChart",
                "line",
                "Monthly Balance",
                charts.monthlyRevenue.labels,
                charts.monthlyRevenue.data,
                'rgba(0, 123, 255, 0.2)',
                'rgba(0, 123, 255, 1)'
            );
        }

        // Daily Revenue Chart
        if ((permissions.canViewReports || permissions.canManagePayments) && charts.dailyRevenue?.labels?.length > 0) {
            createChart(
                "samplesChart",
                "bar",
                "Daily Balance",
                charts.dailyRevenue.labels,
                charts.dailyRevenue.data,
                'rgba(40, 167, 69, 0.2)',
                'rgba(40, 167, 69, 1)'
            );
        }

        // Top Test Categories Chart
        if ((permissions.canManageBookings || permissions.canViewReports) && charts.topTests?.labels?.length > 0) {
            const canvas = document.getElementById("testCategoriesChart");
            if (!canvas) return;

            const colors = [
                'rgba(54, 215, 232, 1)',
                'rgba(254, 112, 150, 1)',
                'rgba(6, 185, 157, 1)',
                '#da8cff'
            ];

            createChart(
                "testCategoriesChart",
                "doughnut",
                "Top 4 Test Categories",
                charts.topTests.labels,
                charts.topTests.data,
                colors
            );
        }
    }

    function updateFranchisee(franchisees, permissions) {
        // Only update if user has permission
        if (!permissions.canManageUsers && isStaff) {
            return;
        }

        if (!franchisees || franchisees.length === 0) {
            return;
        }

        const tableBody = document.querySelector('#tbody');
        if (!tableBody) return;

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        franchisees.forEach((franchisee) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${franchisee.fullName || ''}</td>
                <td>${franchisee.address || ''}</td>
                <td>${franchisee.phoneNo || ''}<br>${franchisee.email || ''}</td>
                <td>
                    <a href="#" onclick="loadPage('editFranchisee', '${franchisee._id}')">Edit</a>
                    <a href="#" class="status-link" style="color: ${franchisee.isActive ? 'green' : 'red'};">
                        ${franchisee.isActive ? 'Active' : 'Inactive'}
                    </a>
                </td>
            `;
            fragment.appendChild(row);
        });

        // Clear and append in one operation
        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);
    }

    function createChart(canvasId, type, label, labels, data, bgColor = 'rgba(255, 99, 132, 0.2)') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas ${canvasId} not found`);
            return;
        }

        // Destroy existing chart if present
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        try {
            new Chart(canvas.getContext("2d"), {
                type: type,
                data: {
                    labels: labels,
                    datasets: [{
                        label: label,
                        data: data,
                        backgroundColor: bgColor,
                        fill: type === "line"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                }
            });
        } catch (error) {
            console.error(`Error creating chart ${canvasId}:`, error);
        }
    }

    function applyPermissions(permissions, isStaff) {
        // If not staff, show everything (admin/superAdmin)
        if (!isStaff) {
            return;
        }

        // Hide booking-related elements if no permission
        if (!permissions.canManageBookings) {
            hideElements([
                '#totalBookings',
                '#pendingTests',
                '.booking-card',
                '.booking-section',
                '#testCategoriesChart'
            ]);
        }

        // Hide payment-related elements if no permission
        if (!permissions.canManagePayments) {
            hideElements([
                '#totalRevenue',
                '#myBalance',
                '.payment-card',
                '.payment-section',
                '.revenue-section'
            ]);
        }

        // Hide reports/charts if no permission
        if (!permissions.canViewReports && !permissions.canManagePayments) {
            hideElements([
                '#revenueChart',
                '#samplesChart',
                '.chart-container',
                '.reports-section'
            ]);
        }

        // Hide user management elements if no permission
        if (!permissions.canManageUsers) {
            hideElements([
                '#activeFranchises',
                '#tbody',
                '.franchisee-table',
                '.user-management-section',
                '.forhide'
            ]);
        }

        // Hide test management elements if no permission
        if (!permissions.canManageTest) {
            hideElements([
                '.test-management-section',
                '.test-database-section'
            ]);
        }
    }

    function hideElements(selectors) {
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(elem => {
                if (elem) {
                    elem.style.display = 'none';
                    // Also hide parent card if needed
                    const parentCard = elem.closest('.card');
                    if (parentCard) {
                        parentCard.style.display = 'none';
                    }
                }
            });
        });
    }

    function trackmodel() {
        if (!user?.tenantId?.modelType) return;
        
        const islayerone = user.tenantId.modelType === "1layer";
        if (islayerone) {
            document.querySelectorAll('.forhide').forEach(elem => {
                elem.style.display = 'none';
            });
        }
    }

    trackmodel();
}

async function initialization() {
    const loader = document.querySelector(".loader");
    if (loader) loader.style.display = "block";
    
    try {
        await dashboard();
    } catch (error) {
        console.error("Dashboard initialization error:", error);
    } finally {
        if (loader) loader.style.display = "none";
    }
}

initialization();