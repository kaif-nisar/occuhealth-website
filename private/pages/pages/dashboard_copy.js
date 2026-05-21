// dashboard_copy.js - FIXED VERSION

// Wait for user data to be available
async function dashboard() {
    try {

        // ✅ Safe access with optional chaining
        const adminDetails = user?.tenantId?.adminDetails;
        console.log("user:", adminDetails.userId);
        if (!adminDetails) {
            console.error('Admin details not found in user data');
            return;
        }

        // Update admin username
        const adminUsernameEl = document.getElementById('admin-username');
        if (adminUsernameEl) {
            adminUsernameEl.innerText = adminDetails.userId.fullName || adminDetails.username || 'Admin';
        }

        // Update helpdesk list
        const helpdeskListEl = document.getElementById('helpdesk-list');
        if (helpdeskListEl) {
            helpdeskListEl.innerHTML = `
                <li>
                    <span>${adminDetails.userId.city}</span>
                    <button class="support-number">
                        ${adminDetails.userId.phoneNo || adminDetails.email || 'N/A'}
                    </button>
                </li>
            `;
        }

        // Show franchisee sections
        showFranchiseeSections(user);

        // --- Target progress functions ---
        async function fetchCurrentTarget() {
            try {
                const response = await fetch(`${BASE_URL}/api/v1/target/targets/current`, {
                    method: 'GET'
                });
                const data = await response.json();

                if (!response.ok) {
                    console.warn('Failed to fetch target:', data.message || data);
                    return;
                }

                if (data && data.data) {
                    updateTargetProgress(data.data);
                }
            } catch (err) {
                console.error('Error fetching current target:', err);
                showNotification('Unable to load target progress', 'error');
            }
        }

        function showFranchiseeSections(userdetails) {
            console.log("user details in modal:", userdetails);
            const usernoti = document.querySelector('.modal_one');
            if (!usernoti) return;

            usernoti.innerHTML = `
                <div class="modal-content_one">
                    <h3>User Details</h3>
                    <p class="Name"><strong>Name: ${userdetails.fullName || 'N/A'}</strong></p>
                    <p class="email"><strong>Email: ${userdetails.email || 'N/A'}</strong></p>
                    <p class="role"><strong>Role: ${userdetails.role || 'N/A'}</strong></p>
                </div>
            `;
        }

        function updateTargetProgress(target) {
            try {
                const targetAmountEl = document.getElementById('target-amount');
                const targetAchievedEl = document.getElementById('target-achieved');
                const progressBar = document.getElementById('target-progress-bar');
                const progressText = document.getElementById('target-progress-text');
                const targetMonthEl = document.getElementById('target-month');

                if (!targetAmountEl || !targetAchievedEl || !progressBar ||
                    !progressText || !targetMonthEl) return;

                const amount = Number(target.amount || 0);
                const achieved = Number(target.achieved || 0);

                targetAmountEl.innerText = amount.toLocaleString('en-IN');
                targetAchievedEl.innerText = achieved.toLocaleString('en-IN');

                const monthStr = target.month || new Date().toISOString().slice(0, 7);
                const date = new Date(monthStr + '-01');
                targetMonthEl.innerText = date.toLocaleString('default', {
                    month: 'long',
                    year: 'numeric'
                });

                const progress = amount > 0 ? (achieved / amount) * 100 : (achieved > 0 ? 100 : 0);
                const pct = Math.max(0, Math.min(100, Math.round(progress)));
                progressBar.style.width = pct + '%';
                progressText.innerText = Math.round(progress) + '%';

                // Color coding based on progress
                if (progress >= 100) {
                    progressBar.style.background = 'linear-gradient(to right, #28a745, #34ce57)';
                } else if (progress >= 75) {
                    progressBar.style.background = 'linear-gradient(to right, #2c5a91, #4c8ed7)';
                } else if (progress >= 50) {
                    progressBar.style.background = 'linear-gradient(to right, #ffc107, #ffcd39)';
                } else {
                    progressBar.style.background = 'linear-gradient(to right, #dc3545, #e4606d)';
                }
            } catch (err) {
                console.error('Error updating target UI:', err);
            }
        }

        // ✅ Use managed interval for cleanup
        if (window.addManagedInterval) {
            window.addManagedInterval(() => { fetchCurrentTarget(); }, 5 * 60 * 1000);
        } else {
            setInterval(() => { fetchCurrentTarget(); }, 5 * 60 * 1000);
        }

        // --- Dashboard data functions ---
        async function fetchDashboardData() {
            try {
                showLoading(true);

                // Fetch wallet and target in parallel
                await Promise.all([
                    fetchWalletAmount(),
                    fetchCurrentTarget()
                ]);

                const query = `?userId=${userId}`;
                const response = await fetch(`${BASE_URL}/api/v1/user/all-bookings${query}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log("Dashboard data fetched:", result);

                const bookings = result.data || result;
                updateDashboardUI(bookings);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                showNotification('Failed to load dashboard data. Please refresh.', 'error');
                updateDashboardUI([]);
            } finally {
                showLoading(false);
            }
        }

        async function fetchWalletAmount() {
            try {
                const response = await fetch(`${BASE_URL}/api/v1/user/wallet-amount/${userId}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch wallet amount');
                }

                const data = await response.json();
                const walletAmount = Math.round(data.wallet || 0);
                const balanceEl = document.getElementById('Balance');
                if (balanceEl) {
                    balanceEl.innerText = '₹' + walletAmount.toLocaleString('en-IN');
                }
            } catch (error) {
                console.error('Wallet fetch error:', error);
                const balanceEl = document.getElementById('Balance');
                if (balanceEl) {
                    balanceEl.innerText = '₹0';
                }
            }
        }

        function updateDashboardUI(bookings) {
            if (!Array.isArray(bookings)) {
                console.error('Invalid bookings data:', bookings);
                bookings = [];
            }

            const pendingCount = bookings.filter(b => b.status === "pending").length;
            const onHoldCount = bookings.filter(b => b.status === "On Hold").length;
            const completedCount = bookings.filter(b => b.status === "completed").length;

            const pendingEl = document.querySelector(".pending");
            const completeEl = document.querySelector(".complete");

            if (pendingEl) pendingEl.innerText = onHoldCount || 0;
            if (completeEl) completeEl.innerText = completedCount || 0;

            updateBookingsTable(bookings);
        }

        function updateBookingsTable(bookings) {
            const tbody = document.querySelector(".booking-table tbody");
            if (!tbody) return;

            tbody.innerHTML = "";

            if (bookings.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
                            No bookings found for today
                        </td>
                    </tr>
                `;
                return;
            }

            bookings.forEach(booking => {
                const row = document.createElement("tr");

                const statusColors = {
                    "On Hold": "orange",
                    "completed": "green",
                    "pending": "blue"
                };
                const statusColor = statusColors[booking.status] || "black";

                const dateObj = new Date(booking.createdAt);
                const formattedDate = dateObj.toLocaleDateString("en-IN");
                const formattedTime = dateObj.toLocaleTimeString("en-IN", {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });

                row.innerHTML = `
                    <td>${booking.bookingId || 'N/A'}</td>
                    <td>${booking.patientName || 'N/A'}</td>
                    <td>₹${(booking.total || 0).toLocaleString('en-IN')}</td>
                    <td>${formattedDate} ${formattedTime}</td>
                    <td style="color:${statusColor}; font-weight: bold;">
                        ${booking.status || 'Unknown'}
                    </td>
                `;

                tbody.appendChild(row);
            });
        }

        function showLoading(isLoading) {
            const tbody = document.querySelector(".booking-table tbody");
            if (tbody && isLoading) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 20px;">
                            Loading bookings...
                        </td>
                    </tr>
                `;
            }
        }

        function showNotification(message, type = 'info') {
            console[type === 'error' ? 'error' : 'log'](message);
        }

        // Initial load
        fetchDashboardData();

        // Initialize slider
        await sliderjs(user, userId, BASE_URL);

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('Failed to load dashboard. Please refresh the page.');
    }
}

// Slider function
async function sliderjs(user, userId, BASE_URL) {
    let slidesData = [];
    
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getLatestProduct`);
        const data = await response.json();

        if (!response.ok) {
            console.log(data.message);
        }

        if (!data.data || Object.keys(data.data).length === 0) {
            const sliderContainer = document.querySelector('.slider-container');
            if (sliderContainer) {
                sliderContainer.style.display = "none";
            }
            console.log("product not listed");
            return;
        }

        const obj = {
            imageUrl: data.data.mainImage.url,
            title: data.data.name,
        };
        slidesData.push(obj);

        data.data.additionalImages.forEach((elem) => {
            const obj = {
                imageUrl: elem.url,
                title: ""
            };
            slidesData.push(obj);
        });

        sliderclick(data.data._id, user, BASE_URL);

    } catch (error) {
        console.log(error.message);
        const sliderContainer = document.querySelector('.slider-container');
        if (sliderContainer) {
            sliderContainer.style.display = "none";
        }
        return;
    }

    const slider = document.getElementById('slider');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dotsContainer = document.getElementById('dotsContainer');

    if (!slider || !prevBtn || !nextBtn || !dotsContainer) {
        console.warn('Slider elements not found');
        return;
    }

    let currentSlide = 0;
    let slideInterval;
    const slideDuration = 5000;

    function initSlider() {
        slider.innerHTML = '';
        dotsContainer.innerHTML = '';

        slidesData.forEach((slide, index) => {
            const slideElement = document.createElement('div');
            slideElement.className = 'slide';

            const img = document.createElement('img');
            img.src = slide.imageUrl;
            img.alt = slide.title;

            const slideContent = document.createElement('div');
            slideContent.className = 'slide-content';
            slideContent.innerHTML = `<h2>${slide.title}</h2>`;

            slideElement.appendChild(img);
            slideElement.appendChild(slideContent);
            slider.appendChild(slideElement);

            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.index = index;
            dotsContainer.appendChild(dot);
        });

        slider.style.transform = `translateX(0%)`;
        updateDots();
        startAutoSlide();
    }

    function updateDots() {
        const dots = document.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }

    function goToSlide(index) {
        if (index < 0) {
            currentSlide = slidesData.length - 1;
        } else if (index >= slidesData.length) {
            currentSlide = 0;
        } else {
            currentSlide = index;
        }

        slider.style.transform = `translateX(-${currentSlide * 100}%)`;
        updateDots();
        resetAutoSlide();
    }

    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    function startAutoSlide() {
        slideInterval = setInterval(nextSlide, slideDuration);
    }

    function resetAutoSlide() {
        clearInterval(slideInterval);
        startAutoSlide();
    }

    // ✅ Add cleanup for slider interval
    if (window.CleanupManager) {
        window.CleanupManager.add(() => {
            clearInterval(slideInterval);
        });
    }

    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);

    dotsContainer.addEventListener('click', function (e) {
        if (e.target.classList.contains('dot')) {
            const slideIndex = parseInt(e.target.dataset.index);
            goToSlide(slideIndex);
        }
    });

    slider.addEventListener('mouseenter', () => {
        clearInterval(slideInterval);
    });

    slider.addEventListener('mouseleave', () => {
        resetAutoSlide();
    });

    let touchStartX = 0;
    let touchEndX = 0;

    slider.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        clearInterval(slideInterval);
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
        resetAutoSlide();
    }, { passive: true });

    function handleSwipe() {
        const threshold = 50;
        if (touchEndX < touchStartX - threshold) {
            nextSlide();
        } else if (touchEndX > touchStartX + threshold) {
            prevSlide();
        }
    }

    initSlider();

    function sliderclick(productId, user, BASE_URL) {
        const sliderElement = document.querySelector('.slider-container .slider');
        if (!sliderElement) return;

        sliderElement.addEventListener('click', () => {
            window.location.href =
                `${BASE_URL}/${user.role}/${user.role}.html?page=Productview&id=${productId}`;
        });
    }
}

// ✅ Initialize dashboard when page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', dashboard);
} else {
    dashboard();
}