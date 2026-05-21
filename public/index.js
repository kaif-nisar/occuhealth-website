
document.addEventListener("DOMContentLoaded", function () {

    const planscontainer = document.getElementById('planscontainer');
    const innerhtmlplanscontainer = planscontainer?.innerHTML;
    document.getElementById("billingToggle")?.addEventListener("change", function () {
        if (this.checked) {
            planscontainer.innerHTML = `<!-- Basic Plan -->
                <div id="basic" class="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
                    <h3 class="text-blue-600 text-sm font-semibold mb-2 uppercase">Starter Lab (Layer - 1)</h3>
                    <div class="text-3xl font-bold text-gray-800 mb-2">₹559 <span
                            class="text-base font-medium text-gray-500">+GST/month</span></div>
                    <p class="text-gray-500 text-sm mb-4">Billed annually with 20% discount</p>
                    <ul class="text-left space-y-3 mb-6">
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Testing Booking</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Doctor Manage</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Online Report</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Report QR Code</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Customized Profile</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Generate Bill</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Branding</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manager Staff</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Expense</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Business Analytics</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Test Data Base</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Trek Ledger</li>
                    </ul>
                    <button data-plan="Basic"
                        class="plan-select-btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium transition">Start
                        Free Trial</button>
                </div>

                <!-- Advanced Plan -->
                <div id="advance" class="bg-white border border-blue-500 rounded-lg p-6 flex flex-col shadow-lg">
                    <h3 class="text-blue-600 text-sm font-semibold mb-2 uppercase">Growth Lab (Layer - 2)</h3>
                    <div class="text-3xl font-bold text-gray-800 mb-2">₹1599 <span
                            class="text-base font-medium text-gray-500">+GST/month</span></div>
                    <p class="text-gray-500 text-sm mb-4">Billed annually with 20% discount</p>
                    <ul class="text-left space-y-3 mb-6">
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Testing Booking</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Doctor Manage</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Online Report</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Report QR Code</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Customized Profile</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Business Analytics</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Staff Login</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>LIS - per instrument - Cost Extra</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Generate Bill</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Staff</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Test-Database</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Dynamic Dashboard</li>
                    </ul>
                    <button data-plan="Advanced"
                        class="plan-select-btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium transition">Start
                        Free Trial</button>
                </div>

                <!-- Premium Plan -->
                <div id="premium" class="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
                    <h3 class="text-blue-600 text-sm font-semibold mb-2 uppercase">Professional Lab (Layer - 3)</h3>
                    <div class="text-3xl font-bold text-gray-800 mb-2">₹3999 <span
                            class="text-base font-medium text-gray-500">+GST/month</span></div>
                    <p class="text-gray-500 text-sm mb-4">Billed annually with 20% discount</p>
                    <ul class="text-left space-y-3 mb-6">
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Testing Booking</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Doctor Manage</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Online Report</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Report QR Code</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Customized Profile</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Business Analytics</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Staff Login</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>LIS - per instrument - Cost Extra</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Generate Bill</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Staff</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Test-Database</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Dynamic Dashboard</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Panel</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Packaging</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Staff Tracking</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Franchises</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Sub Franchises</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Franchisee Staff Login and Tracking</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Templates</li>
                    </ul>
                    <button data-plan="Premium"
                        class=" plan-select-btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium transition">Start
                        Free Trial</button>
                </div>

                <!-- Premium Plan -->
                <div id="premium" class="bg-white border border-gray-200 rounded-lg p-6 flex flex-col">
                    <h3 class="text-blue-600 text-sm font-semibold mb-2 uppercase">Enterprise (Layer - 4)</h3>
                    <div class="text-3xl font-bold text-gray-800 mb-2">₹7999 <span
                            class="text-base font-medium text-gray-500">+GST/month</span></div>
                    <p class="text-gray-500 text-sm mb-4">Billed annually with 20% discount</p>
                    <ul class="text-left space-y-3 mb-6">
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Testing Booking</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Doctor Manage</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Online Report</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Report QR Code</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Customized Profile</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Business Analytics</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Staff Login</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Ledger List</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Franchisee Login Unlimited</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Sub Franchisee Login Unlimited</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Franchisee KYC</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Bulk Test Pricing</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Certificate Management</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>LIS - per instrument - Cost Extra</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Inventory Management</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Reagent Stock Management</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Payment Gateway</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Website</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Branding</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Manage Domin</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>White Labeling On Extra Cost</li>
                        <li class="flex items-start"><span class="text-green-500 mt-1 mr-2"><i
                                    class="fas fa-check-circle"></i></span>Templates</li>
                    </ul>
                    <button data-plan="Premium"
                        class=" plan-select-btn bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-medium transition">Start
                        Free Trial</button>
                </div>
            </div>
                    `
            // Update pricing to yearly
        } else {
            planscontainer.innerHTML = innerhtmlplanscontainer;
        }
    });

    // Check if already visited
    const hasVisited = localStorage.getItem("visited");

    if (!hasVisited) {
        // Show modal
        document.getElementById("bookTestForm").classList.remove("hidden");

        // Set flag so it doesn't show again
        localStorage.setItem("visited", "true");
    }

    // Close button handler
    document.getElementById("closeModalBtn")?.addEventListener("click", function () {
        document.getElementById("bookTestForm").classList.add("hidden");
    });
});

const faders = document.querySelectorAll('.fade-in-section');
const appearOptions = { threshold: 0.1 };

const appearOnScroll = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        }
    });
}, appearOptions);

document.getElementById('menuToggle')?.addEventListener('click', () => {
    const menu = document.getElementById('dropdownMenu');
    menu.classList.toggle('hidden');
});


faders.forEach(fader => {
    appearOnScroll.observe(fader);
});
// Show/Hide Book Test Form
const bookTestForm = document.getElementById('bookTestForm');
const closeFormBtn = document.getElementById('closeFormBtn');

closeFormBtn?.addEventListener('click', () => {
    bookTestForm.classList.add('hidden');
});

// // Navbar scroll effect
// window.addEventListener('scroll', function () {
//     const navbar = document.querySelector('.navbar');

//     if (window.scrollY > 50) {
//         navbar.classList.add('scrolled');
//     } else {
//         navbar.classList.remove('scrolled');
//     }
// });

// Fade-in animation on scroll
const fadeElements = document.querySelectorAll('.fade-in');

const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.1
});

fadeElements.forEach(element => {
    fadeInObserver.observe(element);
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]')?.forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});
const slider = document.getElementById('slider');
const prev = document.getElementById('prev');
const next = document.getElementById('next');

prev?.addEventListener('click', () => {
    slider.scrollBy({ left: -300, behavior: 'smooth' });
});
next?.addEventListener('click', () => {
    slider.scrollBy({ left: 300, behavior: 'smooth' });
});

async function subscribefunction() {
    const form = document.getElementById('subscribeform');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('emailsubscribe').value;

        try {
            const res = await fetch('/api/v1/user/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            alert(data.message);
            form.reset();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });
}

subscribefunction();

function setupPlanFormHandler() {
    const popup = bookTestForm;
    const selectedPlanInput = document.getElementById('selectedPlan');
    const form = popup?.querySelector('form');

    const bookTestBtn = document.querySelectorAll('.bookTestTrigger');
    bookTestBtn?.forEach((btn) => {
        btn?.addEventListener('click', () => {
            const planName = btn.dataset.plan || 'Unknown Plan';
            selectedPlanInput.value = planName;
            popup.classList.remove('hidden');
        });
    })

    // Open popup when any button with class .plan-select-btn is clicked
    document.querySelectorAll('.plan-select-btn')?.forEach(btn => {
        btn.addEventListener('click', () => {
            const planName = btn.dataset.plan || 'Unknown Plan';
            selectedPlanInput.value = planName;
            popup.classList.remove('hidden');
        });
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Collect form data
        const name = form.querySelector('input[placeholder="Enter your name"]').value.trim();
        const email = form.querySelector('input[placeholder="Enter your email"]').value.trim();
        const phone = form.querySelector('input[placeholder="Enter your phone number"]').value.trim();
        const city = form.querySelector('input[placeholder="City"]').value.trim();
        const plan = selectedPlanInput.value;
        const agreed = form.querySelector('#termsCheckbox').checked;

        if (!agreed) {
            alert("Please agree to the terms and conditions before submitting.");
            return;
        }

        // Optional: Form validation
        if (!name || !email || !phone || !city) {
            alert("Please fill all fields.");
            return;
        }

        const base_url = window.location.origin;

        // Send to backend API
        try {
            const response = await fetch(`${base_url}/api/v1/user/handleRequest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    city,
                    plan
                })
            });

            const data = await response.json();
            if (response.ok) {
                alert("Your request has been submitted successfully!");
                form.reset();
                popup.classList.add('hidden');
            } else {
                alert("Failed to submit: " + (data.message || "Please try again."));
            }
        } catch (err) {
            console.error(err.message);
            alert("Something went wrong!");
        }
    });

}

setupPlanFormHandler();
