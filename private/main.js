/**
 * Dynamic Page Loader
 * Handles navigation between pages without full page reload*/
// Define BASE_URL globally at the top

window.BASE_URL = window.location.origin;

function loaderfunction() {
    const doc = document,
        types = ['circle', 'semi-circle', 'square', 'triangle', 'triangle-2', 'rectangle'],
        colors = ['#836ee5', '#fe94b4', '#49d2f5', '#ff5354', '#00b1b4', '#ffe465', '#0071ff', '#03274b'];

    let shapes = doc.querySelectorAll('.shape');

    shapes.forEach((shape, index) => {
        setInterval(() => {
            let cl = shape.classList;
            shape.className = 'shape'; // Reset all classes, keep base

            // assign styles
            cl.add(types[~~(Math.random() * types.length)]);
            let offset = ((Math.random() * 4)) - 2;
            let opp = offset >= 0 ? '+ ' : '- ';
            let styles = [
                ['left', 'calc(50% ' + opp + offset + 'vw)'],
                ['--bounce-variance', ((Math.random() * 20)) - 10 + 'vh'],
                ['--base_scale', ((Math.random() * 6)) + 4 + 'vh'],
                ['--rotation', ((Math.random() * 180)) - 90 + 'deg'],
                ['--color', colors[~~(Math.random() * colors.length)]]
            ];
            styles.forEach(style => shape.style.setProperty(style[0], style[1]));

            // animate
            if (!cl.contains('bounce-up')) cl.add('bounce-up');
            cl.replace('bounce-down', 'bounce-up');
            setTimeout(() => cl.replace('bounce-up', 'bounce-down'), 400);
        }, 740);
    });
}

loaderfunction();

// Initialize when DOM is ready
// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
    // Track loaded resources to prevent duplicates
    // Add event listener to the logout button
    const logoutButton = document.getElementById("logout");
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    window.appState = {
        loadedScripts: new Set(),
        loadedStyles: new Set(),
        currentPage: null,
        pageParams: {}
    };

    // Initialize navigation
    initNavigation();

});


/**
 * Initialize navigation system
 */
function initNavigation() {
    // Update active menu item
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        item.addEventListener("click", function (e) {
            e.preventDefault();

            // Get the page to load
            const pageToLoad = this.getAttribute("data-page");


            // Toggle sidebar on mobile (if open)
            const sidebar = document.getElementById("sidebar");
            if (sidebar && sidebar.classList.contains("active")) {
                sidebar.classList.remove("active");
            }
        });
    });

    // Toggle sidebar for mobile
    const toggleSidebar = document.getElementById("toggle-sidebar");
    const sidebar = document.getElementById("sidebar");
    if (toggleSidebar && sidebar) {
        toggleSidebar.addEventListener("click", function () {
            sidebar.classList.toggle("active");
        });
    }
}

// This script handles the dynamic loading of pages and their respective scripts based on user interaction with the navigation menu.
// It also manages the browser's history state to ensure a smooth user experience when navigating back and forth.

const navItems = document.querySelectorAll('.menu-item');
const container = document.querySelector('.content');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.getAttribute('data-page');
        // Use the router instance if available
        if (window.router) {
            window.router.loadPage(page);
        } else {
            console.error('Router not initialized');
        }
        window.history.pushState({ page }, '', `?page=${page}`);
    });
});

// Enhanced SPA Router with improved error handling and structure
class SPARouter {
    constructor(containerSelector = '.content') {
        this.containerSelector = containerSelector;
        this.container = document.querySelector(containerSelector);
        this.BASE_URL = window.location.origin;
        this.loadedScripts = new Set();
        this.currentPageLoaded = null;
        this.currentScript = null;
        this.htmlCache = new Map();
        this.pendingPageFetches = new Map();

        // Check if container exists
        if (!this.container) {
            console.error(`Container element not found: ${containerSelector}`);
            console.log('Available elements:', Array.from(document.querySelectorAll('div')).map(el => `.${el.className}`));
            // Try alternative selectors
            this.container = document.querySelector('.content') ||
                document.querySelector('#content') ||
                document.querySelector('main') ||
                document.querySelector('#main') ||
                document.body;

            if (this.container) {
                console.log(`Using alternative container: ${this.container.tagName}.${this.container.className || this.container.id}`);
            } else {
                console.error('No suitable container found. Router will not function properly.');
                return;
            }
        }

        // Initialize the router
        this.init();
    }

    init() {
        // Check if container is available before proceeding
        if (!this.container) {
            console.error('Cannot initialize router: no container available');
            return;
        }

        // Load initial page
        const urlParams = new URLSearchParams(window.location.search);
        const currentPage = urlParams.get('page') || 'dashboard';
        this.loadPage(currentPage);

        // Handle browser back/forward navigation
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.page) {
                this.loadPage(event.state.page, null, null, null, null, false);
            }
        });
    }

    async loadPage(page, Name = null, _id = null, BASE_URL = null, name = null, updateHistory = true) {
        if (!this.container) {
            console.error('Cannot load page: no container available');
            return;
        }

        try {
            if (this.currentPageLoaded === page) {
                console.log(`Page ${page} is already loaded. Skipping.`);
                return;
            }

            this.showLoadingState();
            this.cleanPreviousPage();

            const html = await this.fetchPageHTML(page);
            this.container.innerHTML = html;

            // ✅ Pehle URL update karo
            if (updateHistory) {
                this.updateBrowserHistory(page, Name, _id, name);
            }

            // ✅ Fir script load karo
            await this.loadPageScript(`./editor.js`);
            // ✅ Fir script load karo
            await this.loadPageScript(`pages/${page}.js`);

            this.setupDynamicLinks();
            this.currentPageLoaded = page;
            this.hideLoadingState();
            console.log(`Page ${page} loaded successfully`);

        } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            this.handlePageLoadError(error);
        }
    }


    async fetchPageHTML(page) {
        if (this.htmlCache.has(page)) {
            return this.htmlCache.get(page);
        }

        if (this.pendingPageFetches.has(page)) {
            return this.pendingPageFetches.get(page);
        }

        const pendingFetch = fetch(`pages/${page}.html`, { cache: 'no-cache' })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
                }

                const html = await response.text();
                this.htmlCache.set(page, html);
                return html;
            })
            .finally(() => {
                this.pendingPageFetches.delete(page);
            });

        this.pendingPageFetches.set(page, pendingFetch);

        return pendingFetch;
    }

    async loadPageScript(page) {
        const scriptPath = page;

        // Check if script is already loaded
        if (this.loadedScripts.has(scriptPath)) {
            console.log(`Script already loaded: ${scriptPath}`);
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.setAttribute('data-dynamic', scriptPath);

            script.onload = () => {
                console.log(`Script loaded: ${scriptPath}`);
                this.loadedScripts.add(scriptPath);
                this.currentScript = script;
                resolve();
            };

            script.onerror = () => {
                const error = new Error(`Failed to load script: ${scriptPath}`);
                console.error(error.message);
                reject(error);
            };

            document.body.appendChild(script);
        });
    }

    updateBrowserHistory(page, Name, _id, name) {
        // Preserve existing query parameters
        const urlParams = new URLSearchParams(window.location.search);

        // Update or add new query parameters
        urlParams.set('page', page);
        if (Name) urlParams.set('Name', encodeURIComponent(Name));
        if (_id) urlParams.set('_id', encodeURIComponent(_id));
        if (name) urlParams.set('name', encodeURIComponent(name));

        // Push the updated URL with all parameters
        window.history.pushState({ page }, '', `?${urlParams.toString()}`);
    }

    setupDynamicLinks() {
        // Early return if no container
        if (!this.container) {
            console.error('Cannot setup dynamic links: no container available');
            return;
        }

        // Remove old event listeners to prevent memory leaks
        if (this.linkClickHandler) {
            this.container.removeEventListener('click', this.linkClickHandler);
        }

        // Add new event listener using event delegation
        this.linkClickHandler = (e) => {
            const link = e.target.closest('a[data-page]');
            if (link) {
                e.preventDefault();

                const nextPage = link.getAttribute('data-page');
                const nextName = link.getAttribute('data-test-name');
                const nextId = link.getAttribute('data-id');
                const nextPanelName = link.getAttribute('data-panel-name');

                this.loadPage(nextPage, nextName, nextId, null, nextPanelName);
            }
        };

        this.container.addEventListener('click', this.linkClickHandler);
    }

    cleanPreviousPage() {
        // Call cleanup function if it exists
        if (typeof window.cleanupCurrentPage === 'function') {
            try {
                window.cleanupCurrentPage();
                console.log("cleanupCurrentPage() called successfully");
            } catch (error) {
                console.error("Error in cleanupCurrentPage():", error);
            }
        }

        // Remove current script
        if (this.currentScript) {
            console.log("Removing script:", this.currentScript.src);
            this.loadedScripts.delete(this.currentScript.getAttribute("data-dynamic"));
            this.currentScript.remove();
            this.currentScript = null;
        }

        // Clear container content if container exists
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    showLoadingState() {
        // Check if container exists before manipulating it
        if (!this.container) {
            console.warn('Cannot show loading state: no container available');
            return;
        }

        // Optional: Add a loading spinner or message
        this.container.innerHTML = '<div class="loading">Loading...</div>';
    }

    hideLoadingState() {
        // Check if container exists
        if (!this.container) {
            console.warn('Cannot hide loading state: no container available');
            return;
        }

        // Remove loading state if it exists
        const loadingElement = this.container.querySelector('.loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    handlePageLoadError(error) {
        // Check if container exists before manipulating it
        if (!this.container) {
            console.error('Cannot handle page load error: no container available');
            console.error('Original error:', error);
            return;
        }

        // Display user-friendly error message
        this.container.innerHTML = `
            <div class="error">
                <h2>Oops! Something went wrong</h2>
                <p>Failed to load the requested page. Please try again.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
            </div>
        `;
    }

    // Method to manually navigate to a page
    navigateTo(page, params = {}) {
        const { Name, _id, name } = params;
        this.loadPage(page, Name, _id, null, name);
    }

    // Method to get current page
    getCurrentPage() {
        return this.currentPageLoaded;
    }

    // Method to clear all loaded scripts (useful for complete reset)
    clearAllScripts() {
        const dynamicScripts = document.querySelectorAll('script[data-dynamic]');
        dynamicScripts.forEach(script => {
            this.loadedScripts.delete(script.getAttribute("data-dynamic"));
            script.remove();
        });
        this.currentScript = null;
        console.log("All dynamic scripts cleared");
    }

    // Method to reinitialize with a different container
    reinitialize(containerSelector) {
        this.containerSelector = containerSelector;
        this.container = document.querySelector(containerSelector);

        if (!this.container) {
            console.error(`Container element not found: ${containerSelector}`);
            return false;
        }

        console.log(`Router reinitialized with container: ${containerSelector}`);
        return true;
    }
}

// Utility function to wait for element to exist
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

// Enhanced initialization with better error handling
async function initializeRouter() {
    try {
        // Wait for the container element to exist
        await waitForElement('.content', 5000);
        window.router = new SPARouter();
        console.log('Router initialized successfully');
    } catch (error) {
        console.error('Failed to initialize router with .container, trying alternatives...');

        // Try alternative containers
        const alternatives = ['.content', '#content', 'main', '#main'];
        let routerInitialized = false;

        for (const selector of alternatives) {
            try {
                await waitForElement(selector, 1000);
                window.router = new SPARouter(selector);
                console.log(`Router initialized with alternative container: ${selector}`);
                routerInitialized = true;
                break;
            } catch (altError) {
                console.log(`Container ${selector} not found, trying next...`);
            }
        }

        if (!routerInitialized) {
            console.error('Could not initialize router with any container. Available elements:');
            console.log(Array.from(document.querySelectorAll('div, main, section')).map(el =>
                `${el.tagName}.${el.className || '#' + el.id || '[no class/id]'}`
            ));
        }
    }
}

// Initialize the router when DOM is ready
document.addEventListener('DOMContentLoaded', initializeRouter);

// Fallback for cases where the script is loaded after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRouter);
} else {
    initializeRouter();
}

// Export for use in other scripts
window.SPARouter = SPARouter;

// Define the loadPage function globally to fix the reference error
window.loadPage = function (page, Name = null, _id = null, BASE_URL = null, name = null) {
    if (window.router) {
        window.router.loadPage(page, Name, _id, BASE_URL, name);
    } else {
        console.error('Router not initialized. Cannot load page:', page);
    }
};

function initCharts() {
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded, skipping chart initialization');
        return;
    }

    // Revenue chart
    initRevenueChart();

    // Model usage chart
    initModelUsageChart();

    // Any other charts...
}

function loaderfunction() {
    const doc = document,
        types = ['circle', 'semi-circle', 'square', 'triangle', 'triangle-2', 'rectangle'],
        colors = ['#836ee5', '#fe94b4', '#49d2f5', '#ff5354', '#00b1b4', '#ffe465', '#0071ff', '#03274b'];

    let shapes = doc.querySelectorAll('.shape');

    shapes.forEach((shape, index) => {
        setInterval(() => {
            let cl = shape.classList;
            shape.className = 'shape'; // Reset all classes, keep base

            // assign styles
            cl.add(types[~~(Math.random() * types.length)]);
            let offset = ((Math.random() * 4)) - 2;
            let opp = offset >= 0 ? '+ ' : '- ';
            let styles = [
                ['left', 'calc(50% ' + opp + offset + 'vw)'],
                ['--bounce-variance', ((Math.random() * 20)) - 10 + 'vh'],
                ['--base_scale', ((Math.random() * 6)) + 4 + 'vh'],
                ['--rotation', ((Math.random() * 180)) - 90 + 'deg'],
                ['--color', colors[~~(Math.random() * colors.length)]]
            ];
            styles.forEach(style => shape.style.setProperty(style[0], style[1]));

            // animate
            if (!cl.contains('bounce-up')) cl.add('bounce-up');
            cl.replace('bounce-down', 'bounce-up');
            setTimeout(() => cl.replace('bounce-up', 'bounce-down'), 400);
        }, 740);
    });
}

loaderfunction();

/**
 * Initialize revenue chart
 */
function initRevenueChart() {
    const revenueChartEl = document.getElementById("revenueChart");
    if (!revenueChartEl) return;

    // Check if chart instance already exists and destroy it
    if (revenueChartEl._chart) {
        revenueChartEl._chart.destroy();
    }

    const revenueChart = new Chart(revenueChartEl, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Revenue',
                data: [18000, 19500, 17000, 21000, 24000, 22500, 28000, 26000, 29000, 32000, 30000, 34000],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        borderDash: [3]
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Store chart instance for later reference
    revenueChartEl._chart = revenueChart;
}

// Logout functionality
function logout() {
    fetch(`${BASE_URL}/api/v1/user/logout/superAdmin`, {
        method: "POST",
        credentials: "include",
    })
        .then((response) => {
            if (response.ok) {
                localStorage.clear();
                sessionStorage.clear();
                console.log("Logout successful");
                window.location.href = `${BASE_URL}/login.html`;
            } else {
                throw new Error("Logout failed");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

/**
 * Initialize model usage chart
 */
function initModelUsageChart() {
    const modelUsageChartEl = document.getElementById("modelUsageChart");
    if (!modelUsageChartEl) return;

    // Check if chart instance already exists and destroy it
    if (modelUsageChartEl._chart) {
        modelUsageChartEl._chart.destroy();
    }

    const modelUsageChart = new Chart(modelUsageChartEl, {
        type: 'doughnut',
        data: {
            labels: ['1-Layer', '2-Layer', '3-Layer', '4-Layer'],
            datasets: [{
                data: [25, 35, 20, 20],
                backgroundColor: ['#4895ef', '#4361ee', '#3f37c9', '#4cc9f0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            cutout: '70%'
        }
    });

    // Store chart instance for later reference
    modelUsageChartEl._chart = modelUsageChart;
}
