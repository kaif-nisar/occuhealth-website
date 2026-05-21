document.querySelector('button[type="submit"]').addEventListener('click', async () => {
    const franchiseeId = document.getElementById('franchisee').value;
    const testId = document.getElementById('test').value;
    const currentPrice = document.getElementById('current-price').value;
    const testPrice = document.getElementById('test-price').value;
    const ratePercent = document.getElementById('rate-percent').value;
    const finalPrice = document.getElementById('final-price').value;
    const remarks = document.getElementById('remarks').value;

    if (!franchiseeId || !testId || !finalPrice) {
        alert("Please fill all required fields!");
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/v1/assign-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                franchiseeId,
                testId,
                testPrice: parseFloat(testPrice),
                ratePercent: parseFloat(ratePercent),
                finalPrice: parseFloat(finalPrice),
                remarks,
            }),
        });

        const result = await response.json();
        if (response.ok) {
            alert("Test assigned successfully!");
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to assign test!');
    }
});


document.querySelector('button[type="submit"]').addEventListener('click', async () => {
    const franchiseeId = document.getElementById('franchisee').value;
    const superFranchiseeId = "SUPERFRANCHISEE_ID_HERE"; // Replace with actual superfranchisee ID
    const testId = document.getElementById('test').value;
    const testPrice = document.getElementById('test-price').value;
    const ratePercent = document.getElementById('rate-percent').value;
    const finalPrice = document.getElementById('final-price').value;
    const remarks = document.getElementById('remarks').value;

    if (!franchiseeId || !testId || !finalPrice) {
        alert("Please fill all required fields!");
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/v1/assign-test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                franchiseeId,
                superFranchiseeId,
                testId,
                testPrice: parseFloat(testPrice),
                ratePercent: parseFloat(ratePercent),
                finalPrice: parseFloat(finalPrice),
                remarks,
            }),
        });

        const result = await response.json();
        if (response.ok) {
            alert("Test assigned successfully!");
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to assign test!');
    }
});
