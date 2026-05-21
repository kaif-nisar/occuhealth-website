// Redirect to login page if the token is not available
window.onload = function () {
    const token = getCookie('accessToken');
    if (!token) {
        window.location.href = "login.html";
    }
};
// Function to get a specific cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
}

// Toggle the sidebar visibility
function toggleSidebar() {
    const sidebar = document.getElementById('left-navbar');
    const mainContent = document.getElementById('content-box');
    sidebar.classList.toggle('hidden');
    mainContent.classList.toggle('collapsed');
}

// Toggle the visibility of sub-items in the sidebar
function toggleSubItems(id) {
    const subItems = document.getElementById(id);
    const toggleItem = subItems.previousElementSibling;

    // Toggle visibility and rotation class
    subItems.style.display = subItems.style.display === "block" ? "none" : "block";
    toggleItem.classList.toggle('expanded');
}

// Dynamically load pages into the content-box
const initializedPages = new Set();

async function loadPage(page, params = {}, replaceHistory = false) {
    const spinner = document.getElementById('loading-spinner'); // Reference to the spinner
    const contentBox = document.getElementById('content-box');
    try {

        // Show the loading spinner
        spinner.classList.remove('hidden');

        const response = await fetch(`pages/${page}.html`);
        if (!response.ok) throw new Error('Failed to load page.');

        const html = await response.text();
        const contentBox = document.getElementById('content-box');

        // Cleanup existing scripts and global events
        if (typeof contentBox.cleanup === 'function') {
            contentBox.cleanup();
        }

        // Clear the content box and load new content
        contentBox.innerHTML = html;

        // Check if the page scripts are already initialized
        if (!initializedPages.has(page)) {
            const scripts = contentBox.querySelectorAll('script');
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                if (script.src) {
                    newScript.src = script.src;
                    newScript.async = false;
                } else {
                    newScript.textContent = script.textContent;
                }
                contentBox.appendChild(newScript);
            });

            // Mark the page as initialized
            initializedPages.add(page);
        }

        // Update browser history
        const queryString = new URLSearchParams(params).toString();
        const newUrl = `?page=${page}&${queryString}`;
        if (replaceHistory) {
            window.history.replaceState({ page, params }, '', newUrl);
        } else {
            window.history.pushState({ page, params }, '', newUrl);
        }

        // Add a cleanup function for the page
        contentBox.cleanup = function () {
            initializedPages.delete(page); // Allow reinitialization if needed
        };
    } catch (error) {
        console.error(`Error loading page ${page}:`, error);
    }finally {
        // Hide the loading spinner
        spinner.classList.add('hidden');
    }
}

// Handle navigation clicks (sidebar links, buttons, etc.)
document.addEventListener('click', (e) => {
    const target = e.target.closest('a[data-page]');
    if (target) {
        e.preventDefault();
        const page = target.getAttribute('data-page');
        const value1 = target.getAttribute('data-value1') || '';
        const value2 = target.getAttribute('data-value2') || '';
        loadPage(page, { value1, value2 });
    }
});

// Load the current page on page load or refresh
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page') || 'dashboard';
    const value1 = params.get('value1') || '';
    const value2 = params.get('value2') || '';
    const value3 = params.get('value3') || '';
    loadPage(page, { value1, value2, value3 }, true);
});

// Handle back/forward navigation
window.addEventListener('popstate', (event) => {
    const page = event.state ? event.state.page : 'dashboard';
    const params = event.state ? event.state.params : {};
    loadPage(page, params, true);
});
// Ensure navigation items are handled correctly
const sidebar = document.getElementById('left-navbar');
if (sidebar) {
    sidebar.addEventListener('click', (e) => {
        const target = e.target.closest('.nav-item');
        if (target) {
            e.preventDefault();
            const page = target.getAttribute('data-page');
            const value1 = target.getAttribute('data-value1') || '';
            const value2 = target.getAttribute('data-value2') || '';
            loadPage(page, { value1, value2 });
        }
    }, { once: true }); // Ensure this listener is attached only once
}