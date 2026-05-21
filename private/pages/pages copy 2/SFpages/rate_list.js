document.querySelector('.trigger-price button').addEventListener('click', async () => {
    const franchiseeId = document.querySelector('.current-franchisee span').textContent.match(/\((.*?)\)/)[1];
    const ratePercent = document.querySelector('.trigger-price input').value;

    if (!franchiseeId || !ratePercent) {
        alert("Please enter all required details!");
        return;
    }

    // Fetch all the test details from the table dynamically
    const tests = [];
    document.querySelectorAll('.rate-list tbody tr').forEach(row => {
        const testId = row.cells[1].textContent.trim();
        const currentPrice = parseFloat(row.cells[4].textContent.trim());
        const assignedPrice = parseFloat(row.cells[6].textContent.trim());
        tests.push({
            testId,
            currentPrice,
            ratePercent: parseFloat(ratePercent),
            assignedPrice,
        });
    });

    try {
        const response = await fetch('http://localhost:5000/api/v1/assign-tests-bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                franchiseeId,
                tests,
            }),
        });

        const result = await response.json();
        if (response.ok) {
            alert("Tests assigned successfully in bulk!");
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to assign tests in bulk!');
    }
});
