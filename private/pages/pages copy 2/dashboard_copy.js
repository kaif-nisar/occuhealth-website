async function dashboard() {

    async function fetchDashboardData() {
        fetchWalletAmount();
        try {
            const query = `?userId=${userId}`;
            const response = await fetch(`${BASE_URL}/api/v1/user/all-bookings${query}`);
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            updateDashboardUI(data); // 🔹 Dashboard ko update karne ka function
            console.log(data)
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        }
    }

    async function fetchWalletAmount() {
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/wallet-amount/${userId}`);
            if (!response.ok) throw new Error('Failed to fetch wallet amount');
            const data = await response.json();
            document.getElementById('Balance').innerText = Math.round(data.wallet);
        } catch (error) {
            console.error(error);
        }
    }


    function updateDashboardUI(bookings) {
        // ✅ Status-wise count nikalna
        const pendingCount = bookings.filter(booking => booking.status === "pending").length;
        const onHoldCount = bookings.filter(booking => booking.status === "On Hold").length;
        const completedCount = bookings.filter(booking => booking.status === "completed").length;

        // ✅ UI me update karna
        document.querySelector(".Progress").innerText = pendingCount || 0;
        document.querySelector(".pending").innerText = onHoldCount || 0;
        document.querySelector(".complete").innerText = completedCount || 0;

        updateBookingsTable(bookings)
    }

    function updateBookingsTable(bookings) {
        const tbody = document.querySelector(".booking-table tbody");
        tbody.innerHTML = ""; // ✅ Purani rows clear karo

        bookings.forEach(booking => {
            const row = document.createElement("tr");

            // ✅ Status ke hisaab se row ka color change karna
            let statusColor = "black";
            if (booking.status === "On Hold") statusColor = "orange";
            if (booking.status === "completed") statusColor = "green";
            if (booking.status === "pending") statusColor = "blue";

            // ✅ createdAt ko Indian Standard Time (IST) me convert karna
            const dateObj = new Date(booking.createdAt);
            const formattedDate = dateObj.toLocaleDateString("en-IN"); // 📅 Date (DD/MM/YYYY)
            const formattedTime = dateObj.toLocaleTimeString("en-IN", { hour12: true }); // ⏰ Time (HH:MM AM/PM)

            row.innerHTML = `
                <td>${booking.bookingId}</td>
                <td>${booking.patientName}</td>
                <td>₹${booking.total}</td>
                <td>${formattedDate} - ${formattedTime}</td>
                <td style="color:${statusColor}; font-weight: bold;">${booking.status}</td>
            `;

            tbody.appendChild(row);
        });
    }

    fetchDashboardData(); // 🔹 API Call
}
dashboard();

async function sliderjs() {

    let slidesData = [];
    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/getLatestProduct`);
        const data = await response.json();
        if (!response.ok) {
            console.log(data.message);
        }

        if (!data.data || Object.keys(data.data).length === 0) {
            document.querySelector('.slider-container').style.display = "none";
            console.log("product not listed");
            return;
        }
        const obj = {
            imageUrl: data.data.mainImage.url,
            title: data.data.name,
        }
        slidesData.push(obj);
        data.data.additionalImages.forEach((elem) => {
            const obj = {
                imageUrl: elem.url,
                title: ""
            }
            slidesData.push(obj);
        })
        sliderclick(data.data._id);

    } catch (error) {
        console.log(error.message);
    }

    const slider = document.getElementById('slider');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const dotsContainer = document.getElementById('dotsContainer');

    let currentSlide = 0;
    let slideInterval;
    const slideDuration = 5000; // 5 seconds per slide

    // Initialize the slider
    function initSlider() {
        // Clear any existing slides
        slider.innerHTML = '';
        dotsContainer.innerHTML = '';

        // Create slides from the data
        slidesData.forEach((slide, index) => {
            // Create slide element
            const slideElement = document.createElement('div');
            slideElement.className = 'slide';

            // Create image
            const img = document.createElement('img');
            img.src = slide.imageUrl;
            img.alt = slide.title;

            // Create slide content
            const slideContent = document.createElement('div');
            slideContent.className = 'slide-content';
            slideContent.innerHTML = `
                        <h2>${slide.title}</h2>
                    `;

            // Append elements
            slideElement.appendChild(img);
            slideElement.appendChild(slideContent);
            slider.appendChild(slideElement);

            // Create dot
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.index = index;
            dotsContainer.appendChild(dot);
        });

        // Set initial active dot
        updateDots();

        // Start auto-sliding
        startAutoSlide();
    }

    // Update the active dot
    function updateDots() {
        const dots = document.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }

    // Go to a specific slide
    function goToSlide(index) {
        // Ensure index is within bounds
        if (index < 0) {
            currentSlide = slidesData.length - 1;
        } else if (index >= slidesData.length) {
            currentSlide = 0;
        } else {
            currentSlide = index;
        }

        // Update slider position
        slider.style.transform = `translateX(-${currentSlide * 100}%)`;

        // Update dots
        updateDots();

        // Reset auto-slide timer
        resetAutoSlide();
    }

    // Go to next slide
    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    // Go to previous slide
    function prevSlide() {
        goToSlide(currentSlide - 1);
    }

    // Start auto-sliding
    function startAutoSlide() {
        slideInterval = setInterval(nextSlide, slideDuration);
    }

    // Reset auto-slide timer
    function resetAutoSlide() {
        clearInterval(slideInterval);
        startAutoSlide();
    }

    // Event listeners
    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);

    // Dot click event delegation
    dotsContainer.addEventListener('click', function (e) {
        if (e.target.classList.contains('dot')) {
            const slideIndex = parseInt(e.target.dataset.index);
            goToSlide(slideIndex);
        }
    });

    // Pause on hover
    slider.addEventListener('mouseenter', () => {
        clearInterval(slideInterval);
    });

    slider.addEventListener('mouseleave', () => {
        resetAutoSlide();
    });

    // Touch support for mobile devices
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
        const threshold = 50; // Minimum swipe distance
        if (touchEndX < touchStartX - threshold) {
            nextSlide(); // Swipe left
        } else if (touchEndX > touchStartX + threshold) {
            prevSlide(); // Swipe right
        }
    }

    // Initialize the slider
    initSlider();

    // addEventListener for slider container 

    function sliderclick(productId) {
        const slider = document.querySelector('.slider-container .slider');
        slider.addEventListener('click', () => {
            window.location.href = `${BASE_URL}/subFranchisee.html?page=Productview&id=${productId}`;
        })
    }
}

sliderjs();
