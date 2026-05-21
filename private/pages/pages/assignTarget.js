function initializeTargetPage() {
    let franchisees = [];
    // Initialize form elements
    const franchiseeSelect = document.getElementById('franchisee');
    const targetMonth = document.getElementById('targetMonth');
    const targetAmount = document.getElementById('targetAmount');
    const remarks = document.getElementById('remarks');
    const submitButton = document.getElementById('submitTarget');
    const viewMonth = document.getElementById('viewMonth');

    // Set default month to current month
    const currentDate = new Date();
    targetMonth.value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    // Populate view month selector with last 12 months
    function populateMonthSelector() {
        const months = [];
        for (let i = 0; i < 12; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            months.push({ value, label });
        }

        viewMonth.innerHTML = months.map(month =>
            `<option value="${month.value}">${month.label}</option>`
        ).join('');

        // Set current month as default
        viewMonth.value = targetMonth.value;
    }

    // Fetch franchisees based on user role
    async function fetchFranchisees() {
        try {
            let endpoint = '';
            if (userRole === 'admin') {
                endpoint = `${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`;
            } else if (userRole === 'superFranchisee') {
                endpoint = `${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`;
            }

            const response = await fetch(endpoint);
            const data = await response.json();

            if (data.message && Array.isArray(data.message)) {
                franchisees = data.message;
                franchiseeSelect.innerHTML = '<option value="">Select Franchisee</option>' +
                    franchisees.map(f => {
                        return `<option value="${f._id}" data-name="${f.fullName}">${f.username}/${f.fullName}</option>`;
                    }).join('');
            }
        } catch (error) {
            console.error('Error fetching franchisees:', error);
            alert('Failed to load franchisees. Please refresh the page.');
        }
    }

    // Format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Fetch and display targets
    async function fetchTargets(month) {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/target/get-targets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    month,
                    role: userRole
                })
            });

            const data = await response.json();
            if (data.success) {
                displayTargets(data.data.targets);
                updateSummary(data.data.targets);
            }
        } catch (error) {
            console.error('Error fetching targets:', error);
            alert('Failed to load targets. Please try again.');
        }
    }

    // Display targets in cards
    function displayTargets(targets) {
        const targetCards = document.getElementById('targetCards');
        targetCards.innerHTML = targets.map(target => {
            const progress = (target.achieved / target.amount) * 100;
            const status = progress >= 100 ? 'achieved' : 'pending';
            // console.log(status)
            // console.log(progress)
            return `
                <div class="target-card">
                    <div style="display: flex; justify-content: space-between; align-items: center">
                        <h3>${target.fullName}</h3>
                        <span class="status-badge status-${status}">
                            ${status.toUpperCase()}
                        </span>
                    </div>
                    <div style="margin: 10px 0">
                        <div>Target: ${formatCurrency(target.amount)}</div>
                        <div>Achieved: ${formatCurrency(target.achieved)}</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                    </div>
                    <div style="margin-top: 5px; font-size: 14px; color: #666">
                        ${target.remarks || ''}
                    </div>
                </div>
            `;
        }).join('') || '<p>No targets found for this month</p>';
    }

    // Update summary cards
    function updateSummary(targets) {
        const totalTarget = targets.reduce((sum, t) => sum + t.amount, 0);
        const totalAchieved = targets.reduce((sum, t) => sum + t.achieved, 0);
        const achievementRate = totalTarget ? (totalAchieved / totalTarget) * 100 : 0;

        document.getElementById('totalTarget').textContent = formatCurrency(totalTarget);
        document.getElementById('totalAchieved').textContent = formatCurrency(totalAchieved);
        document.getElementById('achievementRate').textContent =
            `${achievementRate.toFixed(1)}%`;
    }

    // Handle target submission
    async function submitTarget() {
        const selectedOption = franchiseeSelect.options[franchiseeSelect.selectedIndex];
        const Name = selectedOption.getAttribute('data-name');
        const selectedFranchisee = franchiseeSelect.value;
        const month = targetMonth.value;
        const amount = parseFloat(targetAmount.value);
        console.log(Name)
        console.log(selectedOption.getAttribute('data-name'))
        if (!selectedFranchisee || !month || !amount) {
            alert('Please fill all required fields');
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/v1/target/assign-target`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    franchiseeId: selectedFranchisee,
                    fullName: Name,
                    assignedBy: userId,
                    month,
                    amount,
                    remarks: remarks.value
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Target assigned successfully!');
                // Reset form
                franchiseeSelect.value = '';
                targetAmount.value = '';
                remarks.value = '';
                // Refresh targets display
                fetchTargets(viewMonth.value);
            } else {
                alert(data.message || 'Failed to assign target');
            }
        } catch (error) {
            console.error('Error assigning target:', error);
            alert('Failed to assign target. Please try again.');
        }
    }

    // Event Listeners
    submitButton.addEventListener('click', submitTarget);
    viewMonth.addEventListener('change', () => fetchTargets(viewMonth.value));

    // Initialize page
    populateMonthSelector();
    fetchFranchisees();
    fetchTargets(viewMonth.value);

    // Hide assignment form for non-admin/non-super franchisee users
    if (!['admin', 'superFranchisee'].includes(userRole)) {
        document.getElementById('assignTargetForm').style.display = 'none';
    }
}

// Initialize when document is ready

initializeTargetPage();