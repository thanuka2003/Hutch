const toggleBtn = document.getElementById('toggle-btn');
const statusBadge = document.getElementById('status-badge');
const networkSelect = document.getElementById('network-select');
const intervalSelect = document.getElementById('interval-select');
const customUrlContainer = document.getElementById('custom-url-container');
const customUrlInput = document.getElementById('custom-url-input');
const saveUrlBtn = document.getElementById('save-url-btn');
const logConsole = document.getElementById('log-console');
const statSent = document.getElementById('stat-sent');
const statDrops = document.getElementById('stat-drops');
const lastPingTime = document.getElementById('last-ping-time');
const resetStatsBtn = document.getElementById('reset-stats-btn');

let isRunning = false;
let customUrl = '';

// Load initial state
chrome.storage.local.get(['isRunning', 'pingInterval', 'targetUrl', 'logs', 'customUrl', 'sentCount', 'dropCount'], (result) => {
    isRunning = result.isRunning || false;
    updateUI();

    if (result.sentCount !== undefined) statSent.textContent = result.sentCount;
    if (result.dropCount !== undefined) statDrops.textContent = result.dropCount;

    if (result.pingInterval) intervalSelect.value = result.pingInterval;
    
    if (result.targetUrl) {
        let found = false;
        Array.from(networkSelect.options).forEach(opt => {
            if (opt.value === result.targetUrl) {
                networkSelect.value = result.targetUrl;
                found = true;
            }
        });
        if (!found && result.targetUrl !== 'custom') {
            networkSelect.value = 'custom';
            customUrlInput.value = result.targetUrl;
            customUrlContainer.classList.remove('hidden');
        }
    }

    if (result.customUrl) {
        customUrl = result.customUrl;
        if (networkSelect.value === 'custom') {
            customUrlInput.value = customUrl;
        }
    }

    if (result.logs && result.logs.length > 0) {
        lastPingTime.textContent = `Last Ping: ${result.logs[0].time}`;
        renderLogs(result.logs);
    }
});

toggleBtn.addEventListener('click', () => {
    isRunning = !isRunning;
    updateUI();
    chrome.runtime.sendMessage({ type: 'TOGGLE_PINGER', value: isRunning });
});

networkSelect.addEventListener('change', () => {
    if (networkSelect.value === 'custom') {
        customUrlContainer.classList.remove('hidden');
    } else {
        customUrlContainer.classList.add('hidden');
        updateSettings();
    }
});

saveUrlBtn.addEventListener('click', () => {
    customUrl = customUrlInput.value;
    chrome.storage.local.set({ customUrl });
    updateSettings();
});

intervalSelect.addEventListener('change', () => {
    updateSettings();
});

resetStatsBtn.addEventListener('click', () => {
    if (confirm('Reset all stats and logs?')) {
        chrome.runtime.sendMessage({ type: 'RESET_ALL' });
        statSent.textContent = '0';
        statDrops.textContent = '0';
        lastPingTime.textContent = 'Last Ping: --:--:--';
        logConsole.innerHTML = '<div class="empty-logs">No logs yet...</div>';
    }
});

function updateUI() {
    if (isRunning) {
        toggleBtn.classList.add('active');
        statusBadge.textContent = 'STATUS: PINGING';
        statusBadge.className = 'status-pinging';
    } else {
        toggleBtn.classList.remove('active');
        statusBadge.textContent = 'STATUS: DISCONNECTED';
        statusBadge.className = 'status-disconnected';
    }
}

function updateSettings() {
    let target = networkSelect.value;
    if (target === 'custom') {
        target = customUrlInput.value || 'https://www.google.com';
    }

    chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        targetUrl: target,
        pingInterval: parseInt(intervalSelect.value)
    });
}

function renderLogs(logs) {
    if (!logs || logs.length === 0) {
        logConsole.innerHTML = '<div class="empty-logs">No logs yet...</div>';
        return;
    }

    logConsole.innerHTML = '';
    logs.forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        const time = document.createElement('span');
        time.className = 'log-time';
        time.textContent = `[${log.time}] `;
        
        const msg = document.createElement('span');
        msg.className = log.success ? 'log-msg-success' : 'log-msg-error';
        
        // Simplify message: Hide long URLs
        let displayMessage = log.message;
        if (log.message.includes('Success: ')) {
            const url = log.message.split('Success: ')[1];
            displayMessage = 'Ping Success: ' + getFriendlyName(url);
        } else if (log.message.includes('Failed: ')) {
             const parts = log.message.split('Failed: ');
             displayMessage = 'Ping Failed';
        }

        msg.textContent = displayMessage;

        entry.appendChild(time);
        entry.appendChild(msg);
        logConsole.appendChild(entry);
    });
}

function getFriendlyName(url) {
    if (url.includes('google.com')) return 'Google';
    if (url.includes('hutch.lk')) return 'Hutch';
    if (url.includes('dialog.lk')) return 'Dialog';
    if (url.includes('mobitel.lk')) return 'Mobitel';
    if (url.includes('airtel.lk')) return 'Airtel';
    return url.length > 20 ? url.substring(0, 17) + '...' : url;
}

// Listen for live updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LOG_UPDATE') {
        if (message.sentCount !== undefined) statSent.textContent = message.sentCount;
        if (message.dropCount !== undefined) statDrops.textContent = message.dropCount;
        if (message.log && message.log.time) lastPingTime.textContent = `Last Ping: ${message.log.time}`;
        
        chrome.storage.local.get(['logs'], (result) => {
            renderLogs(result.logs);
        });
    }
});
