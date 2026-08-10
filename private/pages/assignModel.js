(() => {
    // Select Model Logic
    const modelCards = document.querySelectorAll('.model-card');
    const rentDetails = document.getElementById('rentDetails');
    let selectedLayer = null;

    // Preview thumbnails for each report format box.
    const formatPreviewMap = {
        format1: `${BASE_URL}/images/format1.png`,
        format2: `${BASE_URL}/images/format2.png`,
        format3: `${BASE_URL}/images/format3.png`,
        format4: `${BASE_URL}/images/format4.svg`,
    };

    Object.entries(formatPreviewMap).forEach(([className, imageUrl]) => {
        const el = document.querySelector(`.${className}`);
        if (el) {
            el.style.backgroundImage = `url("${imageUrl}")`;
        }
    });

    // Format 1 warning - only for OccuHealth users
    const format1Warning = document.getElementById('format1Warning');
    const formatRadios = document.querySelectorAll('input[name="format"]');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (format1Warning) {
                format1Warning.style.display = radio.value === 'reportFormat1' ? 'block' : 'none';
            }
        });
    });

    modelCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selection from all cards
            modelCards.forEach(c => c.classList.remove('selected'));

            // Select clicked card
            card.classList.add('selected');
            selectedLayer = card.getAttribute('data-layer');

            // Show rent details with smooth animation
            rentDetails.style.display = 'block';
            rentDetails.style.animation = 'fadeIn 0.5s ease';
        });
    });

    // Assign Button Logic
    const assignButton = document.getElementById('assignButton');
    assignButton.addEventListener('click', async () => {
        const franchiseName = document.getElementById('franchiseName').value;
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const phoneNo = document.getElementById('phoneNo').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const state = document.getElementById('state').value;
        const district = document.getElementById('district').value;
        const pincode = document.getElementById('pincode').value;
        const address = document.getElementById('address').value;
        const rentAmount = document.getElementById('rentAmount').value;
        const leaseTerms = document.getElementById('leaseTerms').value;
        const referralCodeProvided = document.getElementById('referral').value;
        const pdfFormat = document.querySelector('input[name="format"]:checked')?.value || '';
        const showprintsetting = document.getElementById('printsetting').checked;
        const showtestdatabase = document.getElementById('testdatabase').checked;
        const showRandomBtn = document.getElementById('randomResult').checked;

        if (franchiseName && rentAmount && leaseTerms && selectedLayer && fullName && email && phoneNo && username && password && state && district && pincode && address && pdfFormat) {
            // Prepare payload for backend
            const payload = {
                name: franchiseName,
                modelType: `${selectedLayer}layer`,
                code: `FRANCHISE-${Date.now()}`, // Unique code for the franchise
                adminDetails: {
                    email,
                    username,
                    password,
                },
                subscriptionPlan: {
                    planType: leaseTerms,
                    startDate: new Date(),
                    endDate: new Date(new Date().setMonth(new Date().getMonth() + parseInt(leaseTerms))),
                    price: rentAmount,
                    paymentStatus: "paid",
                },
                addressDetails: {
                    fullName,
                    phoneNo,
                    state,
                    district,
                    pincode,
                    address,
                    pdfFormat,
                    showprintsetting,
                    showtestdatabase,
                    showRandomBtn
                },
                referralCodeProvided
            };

            try {
                // Send data to backend
                const response = await fetch(`${BASE_URL}/api/v1/user/tenants`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                const result = await response.json();

                if (response.ok) {
                    alert(`Franchise Model Assigned Successfully:
         Layer: ${selectedLayer} Layer Model
         Name: ${franchiseName}
         Monthly Rent: ₹${rentAmount}
         Lease Terms: ${leaseTerms} Months`);
                    // console.log(result);
                } else {
                    alert(`Error: ${result.message}`);
                }
            } catch (error) {
                alert(error.message);
            }
        } else {
            alert('Please complete all fields and select a model');
        }
    });

    // Add custom animation
    const style = document.createElement('style');
    style.innerHTML = `
@keyframes fadeIn {
 from { opacity: 0; transform: translateY(20px); }
 to { opacity: 1; transform: translateY(0); }
}
`;
    document.head.appendChild(style);

})();
