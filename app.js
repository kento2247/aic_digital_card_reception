// Config
const CONFIG_KEY = 'reception_app_config';
const DEFAULT_CONFIG = { apiUrl: '', apiKey: '' };

let config = {
    apiUrl: DEFAULT_CONFIG.apiUrl || '',
    apiKey: DEFAULT_CONFIG.apiKey || ''
};

// State
let state = {
    selectedEventId: null,
    selectedEvent: null,
    isScanning: false,
    isProcessing: false,
    currentUser: null,
    currentBooking: null,
    selectedCameraId: null
};

// Html5Qrcode instance
let html5QrCode = null;

// DOM Elements
const els = {
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    apiUrlInput: document.getElementById('api-url'),
    apiKeyInput: document.getElementById('api-key'),
    eventSelect: document.getElementById('event-select'),
    cameraSelect: document.getElementById('camera-select'),
    startScanBtn: document.getElementById('start-scan-btn'),
    stopScanBtn: document.getElementById('stop-scan-btn'),
    scanStatus: document.getElementById('scan-status'),
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

    // Initialize scanner instance
    try {
        html5QrCode = new Html5Qrcode("reader");
    } catch (e) {
        console.warn("Failed to init Html5Qrcode", e);
    }

    // Load initial data
    if (config.apiUrl) {
        loadEvents();
    }

    // Always try to load cameras (user permission might be needed)
    loadCameras();
}

function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
        try {
            config = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse config", e);
        }
    }

    // Populate inputs with saved or default values
    if (els.apiUrlInput) els.apiUrlInput.value = config.apiUrl || '';
    if (els.apiKeyInput) els.apiKeyInput.value = config.apiKey || '';
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
        state.selectedEvent = (window.allEvents || []).find(event => event.event_id === e.target.value);
    });

    els.cameraSelect.addEventListener('change', (e) => {
        state.selectedCameraId = e.target.value;
    });

    els.startScanBtn.addEventListener('click', startScanner);
    els.stopScanBtn.addEventListener('click', stopScanner);

    els.closeUserModal.addEventListener('click', hideUserModal);

    // Close modal on outside click
    els.userModal.addEventListener('click', (e) => {
        if (e.target === els.userModal) hideUserModal();
    });

    if (els.manualInputBtn) {
        els.manualInputBtn.addEventListener('click', () => {
            els.manualInputContainer.classList.toggle('hidden');
        });
    }

    if (els.manualSubmitBtn) {
        els.manualSubmitBtn.addEventListener('click', () => {
            const userId = els.manualUserIdInput.value.trim();
            if (userId) {
                // If manual input usage also implies we should have an event and API key,
                // handleUserScan will check API key implicitly via apiCall, 
                // but we should check event selection explicitly.
                if (!checkPrerequisites()) return;
                handleUserScan(userId);
            }
        });
    }

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
        // Catch network errors specifically
        if (!res) throw new Error("Network Error");

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'API Error');
        }
        return data;
    } catch (err) {
        console.error('API Call Failed:', err);
        // Don't show toast here for 404s if we handle them elsewhere, 
        // but generally it's okay for critical failures.
        if (err.message && !err.message.includes('404')) {
            showToast(`Error: ${err.message}`);
        }
        throw err;
    }
}

// --- Logic ---

function checkPrerequisites() {
    if (!config.apiKey) {
        showToast("Please configure API Key first.");
        showSettingsModal();
        return false;
    }
    if (!state.selectedEventId) {
        showToast("Please select an event first.");
        return false;
    }
    return true;
}

async function loadCameras() {
    try {
        const cameras = await Html5Qrcode.getCameras();
        els.cameraSelect.innerHTML = '<option value="">Select Camera</option>';

        if (cameras && cameras.length) {
            cameras.forEach(camera => {
                const opt = document.createElement('option');
                opt.value = camera.id;
                opt.textContent = camera.label || `Camera ${camera.id}`;
                els.cameraSelect.appendChild(opt);
            });

            // Auto-select last camera (often back camera on mobile)
            if (cameras.length > 0) {
                state.selectedCameraId = cameras[cameras.length - 1].id;
                els.cameraSelect.value = state.selectedCameraId;
            }
        } else {
            els.cameraSelect.innerHTML = '<option value="">No cameras found</option>';
        }
    } catch (err) {
        console.error("Error getting cameras", err);
        els.cameraSelect.innerHTML = '<option value="">Camera Error (Check Permissions)</option>';
    }
}

async function startScanner() {
    if (state.isScanning) return;

    // 1. Check Logic Requirements
    if (!checkPrerequisites()) return;

    // Use selected camera or first available if not selected manually
    let cameraIdToUse = state.selectedCameraId;
    if (!cameraIdToUse) {
        // Try to pick one if list is populated but nothing selected
        if (els.cameraSelect.options.length > 1) {
            cameraIdToUse = els.cameraSelect.options[1].value; // 0 is placeholder
            state.selectedCameraId = cameraIdToUse;
            els.cameraSelect.value = cameraIdToUse;
        } else {
            showToast("No camera selected.");
            return;
        }
    }

    try {
        state.isScanning = true;
        setScanUI(true);
        els.scanStatus.textContent = "Starting Camera...";

        await html5QrCode.start(
            cameraIdToUse,
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            onScanSuccess,
            onScanFailure
        );

        els.scanStatus.textContent = "Scanning... Point at QR Code";

    } catch (err) {
        console.error("Failed to start scanner", err);
        showToast("Failed to start camera");
        state.isScanning = false;
        setScanUI(false);
        els.scanStatus.textContent = "Camera failed to start.";
    }
}

async function stopScanner() {
    if (!state.isScanning) return;

    try {
        await html5QrCode.stop();
        state.isScanning = false;
        setScanUI(false);
        els.scanStatus.textContent = "Scanner stopped.";
    } catch (err) {
        console.warn("Error stopping scanner", err);
        // Force UI reset anyway
        state.isScanning = false;
        setScanUI(false);
    }
}

function setScanUI(isScanning) {
    if (isScanning) {
        els.startScanBtn.classList.add('hidden');
        els.stopScanBtn.classList.remove('hidden');
        els.cameraSelect.disabled = true;
    } else {
        els.startScanBtn.classList.remove('hidden');
        els.stopScanBtn.classList.add('hidden');
        els.cameraSelect.disabled = false;
    }
}

function onScanSuccess(decodedText, decodedResult) {
    if (state.isProcessing) return;

    // Pause scanning visually/logically
    // We don't necessarily stop the stream, just pause processing
    state.isProcessing = true;
    html5QrCode.pause();

    console.log(`Scan result: ${decodedText}`);
    handleUserScan(decodedText.trim());
}

function onScanFailure(error) {
    // frequent, ignore
}

async function handleUserScan(userId) {
    // Show Modal Loading
    showUserModal();
    setModalLoading(true);

    // Reset fallback ID text to ensure we don't show old/default data
    els.userIdDisplay.textContent = `ID: ---`;
    els.userName.textContent = "Loading...";
    els.userTags.innerHTML = '';

    try {
        // 1. Fetch User Info
        const userRes = await apiCall(`/api/user/read?user_id=${userId}`);
        state.currentUser = userRes.data;

        // 2. Fetch Booking Status
        let bookingStatus = 'none';
        let bookingData = null;

        try {
            const statusRes = await apiCall(`/api/events/bookings/status?event_id=${state.selectedEventId}&user_id=${userId}`);
            bookingStatus = statusRes.status;
            bookingData = statusRes;
        } catch (err) {
            if (err.message && (err.message.includes('404') || err.message.includes('not found'))) {
                bookingStatus = 'none';
            } else {
                throw err;
            }
        }

        state.currentBooking = bookingData;
        renderUserModal(state.currentUser, bookingStatus, bookingData);

    } catch (err) {
        console.error(err);
        showToast('Failed to load user data');

        // Show error state in modal instead of default fake user
        els.userName.textContent = "Error";
        els.userIdDisplay.textContent = "ID: Error";
        els.bookingStatusContainer.innerHTML = `<div class="alert alert-warning">Could not find user or error occurred.</div>`;
        els.userTags.innerHTML = '';

        // Hide actions
        els.notRegisteredActions.classList.add('hidden');
        els.checkinActions.classList.add('hidden');
        els.attendedActions.classList.add('hidden');

    } finally {
        setModalLoading(false);
    }
}

async function loadEvents() {
    try {
        els.eventSelect.innerHTML = '<option>Loading...</option>';
        els.eventSelect.disabled = true;

        const data = await apiCall('/api/events/all');
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const activeEvents = (data.events || []).filter(event => {
            const endDate = new Date(event.event_end_datetime);
            return endDate > oneDayAgo;
        });

        // Sort: Latest start date first
        activeEvents.sort((a, b) => new Date(b.event_start_datetime) - new Date(a.event_start_datetime));

        // Global store
        window.allEvents = activeEvents;

        els.eventSelect.innerHTML = '<option value="">-- Select Event --</option>';
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

    } catch (err) {
        console.error(err);
        els.eventSelect.innerHTML = '<option>Error loading events</option>';
        els.eventSelect.disabled = false; // Allow retry or change config

        // Don't toast here, it's annoying on init if not configured yet
    }
}

// --- Modal Rendering & Actions ---

function renderUserModal(user, status, bookingData) {
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

    els.notRegisteredActions.classList.add('hidden');
    els.checkinActions.classList.add('hidden');
    els.attendedActions.classList.add('hidden');
    els.bookingStatusContainer.innerHTML = '';

    const badge = document.createElement('div');
    badge.className = `status-badge status-${status}`;
    badge.textContent = status.toUpperCase();
    els.bookingStatusContainer.appendChild(badge);

    if (status === 'none' || status === 'cancelled' || status === 'rejected') {
        els.notRegisteredActions.classList.remove('hidden');
    } else if (status === 'confirmed' || status === 'lottery') {
        els.checkinActions.classList.remove('hidden');
        const defaultScore = document.getElementById('default-score').value || 0;
        const defaultCoin = document.getElementById('default-coin').value || 0;
        els.scoreInput.value = defaultScore;
        els.coinInput.value = defaultCoin;
    } else if (status === 'attended') {
        els.attendedActions.classList.remove('hidden');
        els.checkinTimeDisplay.textContent = new Date().toLocaleTimeString();
    }
}

async function registerUser() {
    if (!confirm('Register this user for the event?')) return;
    try {
        setModalLoading(true);
        await apiCall(`/api/events/${state.selectedEventId}/bookings`, 'POST', {
            user_id: state.currentUser.id
        });
        showToast('User registered successfully');
        // Re-check user status
        handleUserScan(state.currentUser.id);
    } catch (err) {
        showToast('Registration failed');
        setModalLoading(false);
    }
}

async function confirmCheckin() {
    try {
        setModalLoading(true);
        await apiCall(`/api/events/${state.selectedEventId}/bookings/status`, 'POST', {
            user_id: state.currentUser.id,
            status: 'attended'
        });

        const score = parseInt(els.scoreInput.value);
        // Fallback for description
        const eventName = state.selectedEvent ? state.selectedEvent.event_name : 'Event Check-in';

        if (score !== 0) {
            await apiCall('/api/score/write', 'POST', {
                user_id: state.currentUser.id,
                score_change: score,
                description: eventName
            });
        }

        const coin = parseInt(els.coinInput.value);
        if (coin !== 0) {
            await apiCall('/api/coin/write', 'POST', {
                user_id: state.currentUser.id,
                coin_change: coin,
                description: eventName
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
    // If scanning, stop it? Or just let it run in background?
    // Better to stop it to save resources/conflicts
    if (state.isScanning) {
        // Maybe just pause? But stop is safer.
        // We won't auto-restart after settings though, user has to click Start again.
        stopScanner();
    }
}

function hideSettingsModal() {
    els.settingsModal.classList.add('hidden');
}

function showUserModal() {
    els.userModal.classList.remove('hidden');
    els.userContent.classList.add('hidden'); // Initially hidden until loaded
}

function hideUserModal() {
    els.userModal.classList.add('hidden');
    state.isProcessing = false;

    // Resume scanning if it was running
    if (state.isScanning) {
        try {
            html5QrCode.resume();
        } catch (e) {
            console.warn("Failed to resume, pausing/stopping instead", e);
            // If resume fails (e.g. not scanning), just ensure UI is reflected
        }
    }
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
    if (!els.toast) return;
    els.toast.querySelector('.toast-message').textContent = msg;
    els.toast.classList.remove('hidden');
    setTimeout(() => {
        els.toast.classList.add('hidden');
    }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
