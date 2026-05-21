(function () {
let razorpayScriptPromise = null;

function loadRazorpayScript() {
    if (window.Razorpay) {
        return Promise.resolve();
    }

    if (razorpayScriptPromise) {
        return razorpayScriptPromise;
    }

    const existingScript = document.querySelector('script[data-razorpay-checkout-loader="true"]');
    if (existingScript) {
        razorpayScriptPromise = new Promise((resolve, reject) => {
            existingScript.addEventListener('load', resolve, { once: true });
            existingScript.addEventListener('error', () => reject(new Error("Razorpay script failed to load")), { once: true });

            setTimeout(() => {
                if (window.Razorpay) {
                    resolve();
                }
            }, 0);
        });
        return razorpayScriptPromise;
    }

    razorpayScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.dataset.razorpayCheckoutLoader = "true";

        script.onload = () => {
            console.log("Razorpay script loaded successfully");
            resolve();
        };

        script.onerror = () => {
            console.error("Failed to load Razorpay script");
            reject(new Error("Razorpay script failed to load"));
        };

        document.head.appendChild(script);
    });

    return razorpayScriptPromise;
}

function getStoredToken() {
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || sessionStorage.getItem('token') || sessionStorage.getItem('accessToken');
}

function getAuthHeaders(extraHeaders = {}) {
    const token = getStoredToken();
    return token ? { ...extraHeaders, Authorization: `Bearer ${token}` } : extraHeaders;
}

async function fetchWalletBalance() {
    try {
        const response = await fetch('/api/v1/user/get-current-user', {
            credentials: 'include',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success && data.data) {
            const balance = data.data.bookingWallet || 0;
            const walletBalance = document.getElementById('currentWalletBalance');
            if (walletBalance) {
                walletBalance.innerText = balance.toFixed(2);
            }
            console.log("Wallet balance loaded:", balance);
        }
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
    }
}

async function initializeOnlinePaymentPage() {
    console.log("Online payment page loading...");

    try {
        await loadRazorpayScript();
        console.log("Razorpay ready");
    } catch (error) {
        console.error("Failed to initialize Razorpay:", error);
        alert("Payment gateway unavailable. Please try again later.");
    }

    await fetchWalletBalance();

    const payBtn = document.getElementById('payRazorpayBtn');
    if (payBtn && !payBtn.dataset.paymentHandlerAttached) {
        payBtn.addEventListener('click', handleWalletTopup);
        payBtn.dataset.paymentHandlerAttached = "true";
        console.log("Payment button ready");
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeOnlinePaymentPage, { once: true });
} else {
    initializeOnlinePaymentPage();
}

async function handleWalletTopup() {
    const amountInput = document.getElementById('topupAmount');
    const payBtn = document.getElementById('payRazorpayBtn');
    const amount = Number(amountInput?.value);

    if (!Number.isFinite(amount) || amount < 100 || amount > 100000) {
        alert("Invalid amount. Please enter between Rs.100 and Rs.100,000");
        return;
    }

    if (!payBtn) {
        alert("Payment button not found. Please refresh the page.");
        return;
    }

    payBtn.innerText = "Processing...";
    payBtn.disabled = true;

    const token = getStoredToken();

    try {
        await loadRazorpayScript();

        if (!window.Razorpay) {
            throw new Error("Payment gateway not available. Please refresh the page.");
        }

        console.log("Creating wallet top-up order:", { amount });

        const orderRes = await fetch('/api/v1/user/create-wallet-topup', {
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ amount })
        });

        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.success) {
            throw new Error(orderData.message || "Failed to create order");
        }

        console.log("Order created:", orderData.data.orderId);

        const options = {
            key: orderData.data.razorpayKeyId,
            amount: orderData.data.amount * 100,
            currency: orderData.data.currency || 'INR',
            name: "OccuHealth",
            description: "Booking Wallet Top-up",
            order_id: orderData.data.orderId,
            prefill: {
                email: localStorage.getItem('userEmail') || '',
                contact: localStorage.getItem('userPhone') || ''
            },
            handler: async function (response) {
                console.log("Payment successful:", response.razorpay_payment_id);
                await verifyPayment(response, amount, payBtn);
            },
            modal: {
                ondismiss: function () {
                    console.log("Payment cancelled by user");
                    resetButton(payBtn);
                }
            },
            theme: {
                color: "#1badad"
            }
        };

        const rzp = new window.Razorpay(options);

        rzp.on('payment.failed', function (response) {
            console.error("Payment failed:", response.error);
            alert("Payment Failed: " + (response.error.description || "Unknown error"));
            resetButton(payBtn);
        });

        rzp.open();
    } catch (error) {
        console.error("Payment error:", error);
        alert(error.message || "Something went wrong. Please try again.");
        resetButton(payBtn);
    }
}

async function verifyPayment(response, amount, payBtn) {
    try {
        console.log("Verifying payment...");

        const verifyRes = await fetch('/api/v1/user/verify-wallet-topup', {
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount
            })
        });

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.message || "Payment verification failed");
        }

        console.log("Payment verified successfully");
        alert("Wallet topped up successfully!\nNew Balance: Rs." + verifyData.data.newBalance.toFixed(2));

        const walletBalance = document.getElementById('currentWalletBalance');
        if (walletBalance) {
            walletBalance.innerText = verifyData.data.newBalance.toFixed(2);
        }

        const amountInput = document.getElementById('topupAmount');
        if (amountInput) {
            amountInput.value = '';
        }

        resetButton(payBtn);
    } catch (error) {
        console.error("Verification error:", error);
        alert("Payment received but verification failed. Please contact support.\nError: " + error.message);
        resetButton(payBtn);
    }
}

function resetButton(payBtn) {
    if (!payBtn) return;
    payBtn.innerText = "Add Money via Razorpay";
    payBtn.disabled = false;
    payBtn.style.backgroundColor = "#1badad";
}
})();
