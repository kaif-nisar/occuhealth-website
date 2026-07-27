function updateUIStatus(isEnabled) {
    const statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) return;

    if (isEnabled) {
        statusIndicator.className = 'status-indicator active';
        statusIndicator.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Gateway is Currently ACTIVE';
    } else {
        statusIndicator.className = 'status-indicator inactive';
        statusIndicator.innerHTML = '<i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i> Gateway is Currently DISABLED';
    }
}

function updateHistory(updatedBy, updatedTime) {
    const updatedByLabel = document.getElementById('updatedByLabel');
    const updatedTimeLabel = document.getElementById('updatedTimeLabel');
    
    if (updatedByLabel) {
        updatedByLabel.textContent = updatedBy || "System";
    }
    
    if (updatedTimeLabel) {
        if (!updatedTime) {
            updatedTimeLabel.textContent = "N/A";
            return;
        }
        const dateObj = new Date(updatedTime);
        const options = { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        };
        updatedTimeLabel.textContent = dateObj.toLocaleDateString('en-US', options);
    }
}

async function fetchSettings() {
    try {
        const response = await fetch('/api/v1/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('accessToken')
            }
        });
        const result = await response.json();
        
        if (result.success && result.data) {
            const toggle = document.getElementById('paymentGatewayToggle');
            if (toggle) {
                toggle.checked = result.data.isPaymentGatewayEnabled;
                updateUIStatus(result.data.isPaymentGatewayEnabled);
                updateHistory(result.data.lastUpdatedBy, result.data.lastUpdatedTime);
            }
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
        updateUIStatus(false);
    }
}

document.getElementById('paymentGatewayToggle')?.addEventListener('change', async function(e) {
    const isChecked = e.target.checked;
    const overlay = document.getElementById('settingsLoadingOverlay');
    
    if (overlay) overlay.style.display = 'flex';
    
    try {
        const response = await fetch('/api/v1/settings/toggle-payment-gateway', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('accessToken')
            }
        });
        
        const result = await response.json();
        
        if (!result.success || !response.ok) {
            alert('Failed to update setting: ' + (result.message || 'Unauthorized'));
            e.target.checked = !isChecked; // Revert visually
        } else {
            // Update UI based on response
            updateUIStatus(result.data.isPaymentGatewayEnabled);
            updateHistory(result.data.lastUpdatedBy, result.data.lastUpdatedTime);
            
            // Notify success (optional)
            console.log('Payment Gateway has been ' + (result.data.isPaymentGatewayEnabled ? 'Enabled' : 'Disabled'));
        }
    } catch (error) {
        console.error("Error updating setting:", error);
        alert('An error occurred while updating settings.');
        e.target.checked = !isChecked; // Revert visually
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
});

// Load settings on init
fetchSettings();
