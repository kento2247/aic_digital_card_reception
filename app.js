// Config
const CONFIG_KEY = 'reception_app_config';
let config = {
    apiUrl: DEFAULT_CONFIG.apiUrl || '',
    apiKey: DEFAULT_CONFIG.apiKey || ''
};

// State
let state = {
    selectedEventId: null,
    isScanning: true,
    currentUser: null,
    currentBooking: null
};

// DOM Elements
const els = {
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    apiUrlInput: document.getElementById('api-url'),
    apiKeyInput: document.getElementById('api-key'),
    eventSelect: document.getElementById('event-select'),
    userModal: document.getElementById('user-modal'),
    closeUserModal: document.getElementById('close-user-modal'),
    userLoading: document.getElementById('user-loading'),
    userContent: document.getElementById('user-content'),
    userName: document.getElementById('user-name'),
    userIdDisplay: document.getElementById('user-id-display'),
    userTags: document.getElementById('user-tags'),
    bookingStatusContainer: document.getElementById('booking-status-container'),
    notRegisteredActions: document.getElementById('not-registered-actions'),
    checkinActions: document.getElementById('checkin-actions'),
    attendedActions: document.getElementById('attended-actions'),
    registerBtn: document.getElementById('register-btn'),
    confirmCheckinBtn: document.getElementById('confirm-checkin-btn'),
    scoreInput: document.getElementById('score-input'),
    coinInput: document.getElementById('coin-input'),
    toast: document.getElementById('toast'),
    manualInputBtn: document.getElementById('toggle-manual-input'),
    manualInputContainer: document.getElementById('manual-input-container'),
    manualUserIdInput: document.getElementById('manual-user-id'),
    manualSubmitBtn: document.getElementById('manual-submit-btn'),
    checkinTimeDisplay: document.getElementById('checkin-time-display')
};

// --- Initialization ---

function init() {
    loadConfig();
    setupEventListeners();

    // Start scanner if we at least have an API base URL configured.
    // Don't require `apiKey` to start scanning so mobile camera isn't blocked.
    if (!config.apiUrl) {
        showSettingsModal();
    } else {
        loadEvents();
        startScanner();
    }
}

function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
        config = JSON.parse(saved);
    }

    // Populate inputs with saved or default values
    els.apiUrlInput.value = config.apiUrl || DEFAULT_CONFIG.apiUrl || '';
    els.apiKeyInput.value = config.apiKey || DEFAULT_CONFIG.apiKey || '';
}

function saveConfig() {
    config.apiUrl = els.apiUrlInput.value.replace(/\/$/, ''); // Remove trailing slash
    config.apiKey = els.apiKeyInput.value;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    hideSettingsModal();
    showToast('Settings saved');
    loadEvents(); // Reload events with new config
}

// --- Event Listeners ---

function setupEventListeners() {
    els.settingsBtn.addEventListener('click', showSettingsModal);
    els.saveSettingsBtn.addEventListener('click', saveConfig);

    els.eventSelect.addEventListener('change', (e) => {
        state.selectedEventId = e.target.value;
    });

    els.closeUserModal.addEventListener('click', hideUserModal);

    // Close modal on outside click
    els.userModal.addEventListener('click', (e) => {
        if (e.target === els.userModal) hideUserModal();
    });

    els.manualInputBtn.addEventListener('click', () => {
        els.manualInputContainer.classList.toggle('hidden');
    });

    els.manualSubmitBtn.addEventListener('click', () => {
        const userId = els.manualUserIdInput.value.trim();
        if (userId) handleUserScan(userId);
    });

    // Number inputs
    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            const input = document.getElementById(targetId);
            const isPlus = e.target.classList.contains('plus');
            let val = parseInt(input.value) || 0;
            input.value = isPlus ? val + 10 : val - 10;
        });
    });

    els.registerBtn.addEventListener('click', registerUser);
    els.confirmCheckinBtn.addEventListener('click', confirmCheckin);
}

// --- API Client ---

async function apiCall(endpoint, method = 'GET', body = null) {
    if (!config.apiUrl || !config.apiKey) {
        showToast('API Config missing');
        throw new Error('Config missing');
    }

    const headers = {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
    };

    try {
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${config.apiUrl}${endpoint}`, options);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'API Error');
        }
        return data;
    } catch (err) {
        console.error('API Call Failed:', err);
        showToast(`Error: ${err.message}`);
        throw err;
    }
}

// --- Logic ---

async function loadEvents() {
    try {
        els.eventSelect.innerHTML = '<option>Loading...</option>';
        els.eventSelect.disabled = true;

        // Fetch all events
        const data = await apiCall('/api/events/all');

        els.eventSelect.innerHTML = '<option value="">-- Select Event --</option>';

        if (data.events && data.events.length > 0) {
            // Filter out events that ended more than 24 hours ago
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

            const activeEvents = data.events.filter(event => {
                const endDate = new Date(event.event_end_datetime);
                return endDate > oneDayAgo;
            });

            // Sort events: Closest upcoming/active first
            // We sort by start_datetime. 
            // If we want "current" events at top, we might want to sort by start_datetime ascending?
            // Actually, usually you want the event happening *now* or *soon*.
            // Let's sort by start_datetime descending (newest first) so future events are at top?
            // No, usually ascending (earliest first) is better for "upcoming".
            // But if there are many future events, the one today might be buried.
            // Let's stick to standard: Start datetime descending (newest first) often puts the latest created/scheduled event at top if they are added sequentially.
            // Wait, if I have an event next year and an event today.
            // Descending: Next year event comes first.
            // Ascending: Today event comes first.
            // Let's go with Ascending (Earliest first) but filter out old ones.
            // Actually, let's just sort by start_datetime descending so the "latest" event is first.
            activeEvents.sort((a, b) => {
                return new Date(b.event_start_datetime) - new Date(a.event_start_datetime);
            });

            if (activeEvents.length > 0) {
                activeEvents.forEach(event => {
                    const opt = document.createElement('option');
                    opt.value = event.event_id;
                    const startDate = new Date(event.event_start_datetime).toLocaleDateString();
                    opt.textContent = `${event.event_name} (${startDate})`;
                    els.eventSelect.appendChild(opt);
                });
                els.eventSelect.disabled = false;
            } else {
                els.eventSelect.innerHTML = '<option>No active events found</option>';
            }
        } else {
            els.eventSelect.innerHTML = '<option>No events found</option>';
        }
    } catch (err) {
        els.eventSelect.innerHTML = '<option>Error loading events</option>';
        console.error(err);
    }
}

function startScanner() {
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
    );

    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function onScanSuccess(decodedText, decodedResult) {
    // Prevent multiple scans
    if (state.isProcessing) return;

    // Basic validation: assume QR code is just the user_id
    // If it's a URL, extract the ID? For now assume raw ID.
    const userId = decodedText.trim();

    console.log(`Scan result: ${userId}`);
    handleUserScan(userId);
}

function onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning.
    // console.warn(`Code scan error = ${error}`);
}

async function handleUserScan(userId) {
    if (!state.selectedEventId) {
        showToast('Please select an event first');
        return;
    }

    state.isProcessing = true;
    showUserModal();
    setModalLoading(true);

    try {
        // 1. Fetch User Info
        // We need name, student_id, grade, etc.
        // Assuming we have read permissions for these.
        const userRes = await apiCall(`/api/user/read?user_id=${userId}`);
        state.currentUser = userRes.data; // Adjust based on actual response structure

        // 2. Fetch Booking Status
        // We use the status endpoint
        let bookingStatus = 'none';
        let bookingData = null;

        try {
            const statusRes = await apiCall(`/api/events/bookings/status?event_id=${state.selectedEventId}&user_id=${userId}`);
            bookingStatus = statusRes.status;
            bookingData = statusRes;
        } catch (err) {
            // 404 means no booking
            if (err.message.includes('404') || err.message.includes('not found')) {
                bookingStatus = 'none';
            } else {
                throw err;
            }
        }

        state.currentBooking = bookingData;
        renderUserModal(state.currentUser, bookingStatus, bookingData);

    } catch (err) {
        hideUserModal();
        showToast('Failed to load user data');
    } finally {
        setModalLoading(false);
        state.isProcessing = false;
    }
}

function renderUserModal(user, status, bookingData) {
    // User Info
    els.userName.textContent = user.name || 'Unknown User';
    els.userIdDisplay.textContent = `ID: ${user.id}`;

    els.userTags.innerHTML = '';
    const tags = [user.grade, user.affiliation, user.student_id].filter(Boolean);
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        els.userTags.appendChild(span);
    });

    // Reset Actions
    els.notRegisteredActions.classList.add('hidden');
    els.checkinActions.classList.add('hidden');
    els.attendedActions.classList.add('hidden');
    els.bookingStatusContainer.innerHTML = '';

    // Status Badge
    const badge = document.createElement('div');
    badge.className = `status-badge status-${status}`;
    badge.textContent = status.toUpperCase();
    els.bookingStatusContainer.appendChild(badge);

    // Logic
    if (status === 'none' || status === 'cancelled' || status === 'rejected') {
        els.notRegisteredActions.classList.remove('hidden');
    } else if (status === 'confirmed' || status === 'lottery') {
        els.checkinActions.classList.remove('hidden');
        // Reset inputs with default values
        const defaultScore = document.getElementById('default-score').value || 0;
        const defaultCoin = document.getElementById('default-coin').value || 0;
        els.scoreInput.value = defaultScore;
        els.coinInput.value = defaultCoin;
    } else if (status === 'attended') {
        els.attendedActions.classList.remove('hidden');
        // Show time if available (mocking for now as API might not return exact checkin time in status endpoint)
        els.checkinTimeDisplay.textContent = new Date().toLocaleTimeString();
    }
}

async function registerUser() {
    if (!confirm('Register this user for the event?')) return;

    try {
        setModalLoading(true);
        // Create booking
        await apiCall(`/api/events/${state.selectedEventId}/bookings`, 'POST', {
            user_id: state.currentUser.id
        });

        // Refresh status
        handleUserScan(state.currentUser.id);
        showToast('User registered successfully');
    } catch (err) {
        showToast('Registration failed');
        setModalLoading(false);
    }
}

async function confirmCheckin() {
    try {
        setModalLoading(true);

        // 1. Update Status to attended
        await apiCall(`/api/events/${state.selectedEventId}/bookings/status`, 'POST', {
            user_id: state.currentUser.id,
            status: 'attended'
        });

        // 2. Add Score (if > 0)
        const score = parseInt(els.scoreInput.value);
        if (score !== 0) {
            await apiCall('/api/score/write', 'POST', {
                user_id: state.currentUser.id,
                score_change: score,
                description: `Event Check-in: ${state.selectedEventId}`
            });
        }

        // 3. Add Coin (if > 0)
        const coin = parseInt(els.coinInput.value);
        if (coin !== 0) {
            await apiCall('/api/coin/write', 'POST', {
                user_id: state.currentUser.id,
                coin_change: coin,
                description: `Event Check-in: ${state.selectedEventId}`
            });
        }

        showToast('Check-in Complete!');
        hideUserModal();

    } catch (err) {
        showToast('Check-in failed');
        setModalLoading(false);
    }
}

// --- UI Helpers ---

function showSettingsModal() {
    els.settingsModal.classList.remove('hidden');
}

function hideSettingsModal() {
    els.settingsModal.classList.add('hidden');
}

function showUserModal() {
    els.userModal.classList.remove('hidden');
    els.userContent.classList.add('hidden');
}

function hideUserModal() {
    els.userModal.classList.add('hidden');
    state.isProcessing = false;
}

function setModalLoading(isLoading) {
    if (isLoading) {
        els.userLoading.classList.remove('hidden');
        els.userContent.classList.add('hidden');
    } else {
        els.userLoading.classList.add('hidden');
        els.userContent.classList.remove('hidden');
    }
}

function showToast(msg) {
    els.toast.querySelector('.toast-message').textContent = msg;
    els.toast.classList.remove('hidden');
    setTimeout(() => {
        els.toast.classList.add('hidden');
    }, 3000);
}

// Start
document.addEventListener('DOMContentLoaded', init);
