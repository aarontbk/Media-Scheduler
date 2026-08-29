// --- Application State ---
const state = {
    activeView: 'browser', // 'browser' | 'playlists' | 'timeline'
    mediaTypeFilter: 'Movie,Series',
    categoryFilter: '',
    searchQuery: '',
    selectedMedia: null, // target for scheduling (media item or playlist)
    targetForPlaylist: null, // item to add to playlist
    currentSeries: null,
    currentSeasons: [],
    playlists: [],
    currentPlaylist: null,
    settings: {
        jellyfin_url: '',
        jellyfin_api_key: '',
        jellyfin_user_id: '',
        tv_device_name: '',
        tv_ip: '',
        adb_port: 5555,
        plex_url: '',
        plex_token: '',
        plex_client_id: '',
        plex_player_ip: '',
        samsung_tv_ip: '',
        samsung_tv_mac: '',
        samsung_app_id: '3201807016499',
        media_provider: 'jellyfin',
        tv_type: 'android',
        app_timezone: 'Asia/Jerusalem',
        jellyfin_connected: false,
        adb_is_ready: false,
    },
    tvStatus: {
        session_found: false,
        adb_state: 'offline',
        adb_reachable: false,
        adb_message: '',
    },
    scheduledJobs: [],
    editingScheduleJob: null,
    searchDebounceTimer: null,
    playlistSearchDebounceTimer: null,
};

// --- DOM Elements Cache ---
const elements = {
    // Header & Banner
    headerStatusDot: document.getElementById('headerStatusDot'),
    headerStatusLabel: document.getElementById('headerStatusLabel'),
    tvStatusPill: document.getElementById('tvStatusPill'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    setupBanner: document.getElementById('setupBanner'),
    bannerMsg: document.getElementById('bannerMsg'),
    bannerActionBtn: document.getElementById('bannerActionBtn'),
    pendingCountBadge: document.getElementById('pendingCountBadge'),
    playlistsCountBadge: document.getElementById('playlistsCountBadge'),

    // Navigation
    viewTabs: document.querySelectorAll('.view-tab'),
    browserView: document.getElementById('browserView'),
    playlistsView: document.getElementById('playlistsView'),
    timelineView: document.getElementById('timelineView'),

    // Media Browser
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    filterChips: document.querySelectorAll('.chip'),
    refreshMediaBtn: document.getElementById('refreshMediaBtn'),
    mediaContainer: document.getElementById('mediaContainer'),

    // Series Drill-down
    seriesView: document.getElementById('seriesView'),
    backToLibraryBtn: document.getElementById('backToLibraryBtn'),
    seriesHero: document.getElementById('seriesHero'),
    seasonsSlider: document.getElementById('seasonsSlider'),
    episodesList: document.getElementById('episodesList'),

    // Playlists View
    playlistsMainContainer: document.getElementById('playlistsMainContainer'),
    playlistsGrid: document.getElementById('playlistsGrid'),
    emptyPlaylistsState: document.getElementById('emptyPlaylistsState'),
    openCreatePlaylistBtn: document.getElementById('openCreatePlaylistBtn'),
    createFirstPlaylistBtn: document.getElementById('createFirstPlaylistBtn'),
    playlistDetailView: document.getElementById('playlistDetailView'),
    backToPlaylistsBtn: document.getElementById('backToPlaylistsBtn'),
    openAddItemsToPlaylistBtn: document.getElementById('openAddItemsToPlaylistBtn'),
    editPlaylistInfoBtn: document.getElementById('editPlaylistInfoBtn'),
    deletePlaylistBtn: document.getElementById('deletePlaylistBtn'),
    playlistHero: document.getElementById('playlistHero'),
    playPlaylistNowBtn: document.getElementById('playPlaylistNowBtn'),
    schedulePlaylistBtn: document.getElementById('schedulePlaylistBtn'),
    playlistItemsList: document.getElementById('playlistItemsList'),

    // Browse & Add Items Modal (inside playlist detail)
    browseAddItemsModal: document.getElementById('browseAddItemsModal'),
    browseAddItemsModalTitle: document.getElementById('browseAddItemsModalTitle'),
    closeBrowseAddItemsModal: document.getElementById('closeBrowseAddItemsModal'),
    closeBrowseAddItemsBtn: document.getElementById('closeBrowseAddItemsBtn'),
    playlistSearchInput: document.getElementById('playlistSearchInput'),
    playlistPickerContainer: document.getElementById('playlistPickerContainer'),

    // Add to Playlist Modal (from library cards)
    addToPlaylistModal: document.getElementById('addToPlaylistModal'),
    closeAddToPlaylistModal: document.getElementById('closeAddToPlaylistModal'),
    addToPlaylistMediaCard: document.getElementById('addToPlaylistMediaCard'),
    targetPlaylistSelect: document.getElementById('targetPlaylistSelect'),
    newPlaylistInlineName: document.getElementById('newPlaylistInlineName'),
    cancelAddToPlaylistBtn: document.getElementById('cancelAddToPlaylistBtn'),
    confirmAddToPlaylistBtn: document.getElementById('confirmAddToPlaylistBtn'),

    // Create / Edit Playlist Modal
    playlistFormModal: document.getElementById('playlistFormModal'),
    closePlaylistFormModal: document.getElementById('closePlaylistFormModal'),
    playlistFormModalTitle: document.getElementById('playlistFormModalTitle'),
    playlistNameInput: document.getElementById('playlistNameInput'),
    playlistDescInput: document.getElementById('playlistDescInput'),
    cancelPlaylistFormBtn: document.getElementById('cancelPlaylistFormBtn'),
    savePlaylistFormBtn: document.getElementById('savePlaylistFormBtn'),

    // Schedule Modal
    scheduleModal: document.getElementById('scheduleModal'),
    closeScheduleModal: document.getElementById('closeScheduleModal'),
    modalMediaCard: document.getElementById('modalMediaCard'),
    recurrenceToggleGroup: document.getElementById('recurrenceToggleGroup'),
    timingOnceSection: document.getElementById('timingOnceSection'),
    timingRecurringSection: document.getElementById('timingRecurringSection'),
    scheduleDatetime: document.getElementById('scheduleDatetime'),
    presetButtons: document.querySelectorAll('.btn-preset'),
    weeklyDayGroup: document.getElementById('weeklyDayGroup'),
    scheduleWeeklyDay: document.getElementById('scheduleWeeklyDay'),
    customDaysGroup: document.getElementById('customDaysGroup'),
    scheduleTimeOfDay: document.getElementById('scheduleTimeOfDay'),
    instantPlayBtn: document.getElementById('instantPlayBtn'),
    confirmScheduleBtn: document.getElementById('confirmScheduleBtn'),

    // Timeline View
    timelineList: document.getElementById('timelineList'),
    emptyTimelineState: document.getElementById('emptyTimelineState'),
    refreshTimelineBtn: document.getElementById('refreshTimelineBtn'),
    goToLibraryBtn: document.getElementById('goToLibraryBtn'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModal: document.getElementById('closeSettingsModal'),
    settingsTabs: document.querySelectorAll('.settings-tab'),
    settingsPanels: document.querySelectorAll('.settings-panel'),
    
    // TV Type Selection
    tvTypeButtons: document.querySelectorAll('.tv-type-btn'),
    tvTypeAndroid: document.getElementById('tvTypeAndroid'),
    tvTypeSamsung: document.getElementById('tvTypeSamsung'),
    androidTvPanel: document.getElementById('androidTvPanel'),
    samsungTvPanel: document.getElementById('samsungTvPanel'),

    // Android TV Setup Fields
    adbBoxDot: document.getElementById('adbBoxDot'),
    adbBoxTitle: document.getElementById('adbBoxTitle'),
    adbBoxMessage: document.getElementById('adbBoxMessage'),
    tvPromptCallout: document.getElementById('tvPromptCallout'),
    verifyAuthBtn: document.getElementById('verifyAuthBtn'),
    refreshAdbStatusBtn: document.getElementById('refreshAdbStatusBtn'),
    tvIpInput: document.getElementById('tvIpInput'),
    tvPortInput: document.getElementById('tvPortInput'),
    tvNameInput: document.getElementById('tvNameInput'),
    connectTvBtn: document.getElementById('connectTvBtn'),
    saveTvSettingsBtn: document.getElementById('saveTvSettingsBtn'),
    testWakeBtn: document.getElementById('testWakeBtn'),
    testLaunchAppBtn: document.getElementById('testLaunchAppBtn'),
    testSleepBtn: document.getElementById('testSleepBtn'),

    // Samsung TV Setup Fields
    samsungStatusDot: document.getElementById('samsungStatusDot'),
    samsungStatusTitle: document.getElementById('samsungStatusTitle'),
    samsungStatusMessage: document.getElementById('samsungStatusMessage'),
    refreshSamsungStatusBtn: document.getElementById('refreshSamsungStatusBtn'),
    samsungIpInput: document.getElementById('samsungIpInput'),
    samsungMacInput: document.getElementById('samsungMacInput'),
    samsungAppSelect: document.getElementById('samsungAppSelect'),
    saveSamsungSettingsBtn: document.getElementById('saveSamsungSettingsBtn'),
    samsungWakeBtn: document.getElementById('samsungWakeBtn'),
    samsungLaunchBtn: document.getElementById('samsungLaunchBtn'),
    samsungSleepBtn: document.getElementById('samsungSleepBtn'),

    // Media Provider Selection
    mediaProviderButtons: document.querySelectorAll('.media-provider-btn'),
    mediaProviderJellyfin: document.getElementById('mediaProviderJellyfin'),
    mediaProviderPlex: document.getElementById('mediaProviderPlex'),
    jellyfinPanel: document.getElementById('jellyfinPanel'),
    plexPanel: document.getElementById('plexPanel'),

    // Jellyfin Setup Fields
    jfUrlInput: document.getElementById('jfUrlInput'),
    jfKeyInput: document.getElementById('jfKeyInput'),
    jfUserSelect: document.getElementById('jfUserSelect'),
    testJfBtn: document.getElementById('testJfBtn'),
    saveJfSettingsBtn: document.getElementById('saveJfSettingsBtn'),

    // Plex Setup Fields
    plexUrlInput: document.getElementById('plexUrlInput'),
    plexTokenInput: document.getElementById('plexTokenInput'),
    testPlexBtn: document.getElementById('testPlexBtn'),
    plexTestResult: document.getElementById('plexTestResult'),
    plexPlayerIpInput: document.getElementById('plexPlayerIpInput'),
    savePlexSettingsBtn: document.getElementById('savePlexSettingsBtn'),

    // Timezone Setup Fields
    timezoneSelect: document.getElementById('timezoneSelect'),
    browserTzHint: document.getElementById('browserTzHint'),
    browserClockPreview: document.getElementById('browserClockPreview'),
    serverClockPreview: document.getElementById('serverClockPreview'),
    saveTimezoneBtn: document.getElementById('saveTimezoneBtn'),
    autoDetectTzBtn: document.getElementById('autoDetectTzBtn'),

    toastContainer: document.getElementById('toastContainer'),
};

// --- Helper Functions ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

function debounce(fn, delay = 150) {
    return (...args) => {
        clearTimeout(state.searchDebounceTimer);
        state.searchDebounceTimer = setTimeout(() => fn(...args), delay);
    };
}

function formatRuntime(minutes) {
    if (!minutes || minutes <= 0) return '';
    const m = parseInt(minutes, 10);
    if (isNaN(m)) return '';
    if (m >= 60) {
        const hours = Math.floor(m / 60);
        const remMins = m % 60;
        return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    }
    return `${m}m`;
}

function extractEpLabel(name) {
    if (!name) return 'EP';
    const match = name.match(/S\d+E\d+|E\d+/i);
    return match ? match[0].toUpperCase() : 'EP';
}

function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric'
    }) + ' · ' + d.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit'
    });
}

function toLocalDatetimeString(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getImageUrl(itemId, tag) {
    let url = `/api/image/${itemId}`;
    if (tag) url += `?tag=${tag}`;
    return url;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- API Client Layer ---
const api = {
    async getSettings() {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        return await res.json();
    },

    async saveSettings(updates) {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('Failed to save settings');
        return await res.json();
    },

    async testJellyfin(url, apiKey) {
        let endpoint = '/api/jellyfin/test';
        const params = new URLSearchParams();
        if (url) params.append('url', url);
        if (apiKey) params.append('api_key', apiKey);
        if (params.toString()) endpoint += `?${params.toString()}`;
        const res = await fetch(endpoint);
        return await res.json();
    },

    async testPlex(url, token) {
        let endpoint = '/api/plex/test';
        const params = new URLSearchParams();
        if (url) params.append('url', url);
        if (token) params.append('token', token);
        if (params.toString()) endpoint += `?${params.toString()}`;
        const res = await fetch(endpoint);
        return await res.json();
    },

    async getTvStatus() {
        const res = await fetch('/api/tv/status');
        if (!res.ok) throw new Error('Failed to check TV status');
        return await res.json();
    },

    async getSamsungStatus() {
        const res = await fetch('/api/tv/samsung/status');
        if (!res.ok) throw new Error('Failed to check Samsung TV status');
        return await res.json();
    },

    async wakeSamsung(ip, mac) {
        const res = await fetch('/api/tv/samsung/wake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, mac }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Samsung wake failed');
        }
        return await res.json();
    },

    async launchSamsungApp(appId) {
        const res = await fetch('/api/tv/samsung/launch-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: appId }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Samsung launch app failed');
        }
        return await res.json();
    },

    async sendSamsungKey(key) {
        const res = await fetch('/api/tv/samsung/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Samsung key event failed');
        }
        return await res.json();
    },

    async connectAdb(ip, port = 5555) {
        const res = await fetch('/api/tv/adb-connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port: parseInt(port) || 5555 }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'ADB connection failed');
        }
        return await res.json();
    },

    async testWake() {
        const res = await fetch('/api/tv/test-wake', { method: 'POST' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Wake command failed');
        }
        return await res.json();
    },

    async testSleep() {
        const res = await fetch('/api/tv/test-sleep', { method: 'POST' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Sleep command failed');
        }
        return await res.json();
    },

    async testLaunch() {
        const res = await fetch('/api/tv/test-launch', { method: 'POST' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Launch app failed');
        }
        return await res.json();
    },


    async fetchMedia(query = '', type = 'Movie,Series', category = '') {
        const params = new URLSearchParams();
        if (query.trim()) params.append('q', query.trim());
        if (type) params.append('type', type);
        if (category) params.append('category', category);
        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch media from library');
        return await res.json();
    },

    async getSeasons(seriesId) {
        const res = await fetch(`/api/series/${seriesId}/seasons`);
        if (!res.ok) throw new Error('Failed to load seasons');
        return await res.json();
    },

    async getEpisodes(seriesId, seasonId) {
        const res = await fetch(`/api/series/${seriesId}/episodes?season_id=${seasonId}`);
        if (!res.ok) throw new Error('Failed to load episodes');
        return await res.json();
    },

    async getPlaylists() {
        const res = await fetch('/api/playlists');
        if (!res.ok) throw new Error('Failed to load playlists');
        return await res.json();
    },

    async createPlaylist(data) {
        const res = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create playlist');
        return await res.json();
    },

    async getPlaylist(id) {
        const res = await fetch(`/api/playlists/${id}`);
        if (!res.ok) throw new Error('Failed to fetch playlist details');
        return await res.json();
    },

    async updatePlaylist(id, data) {
        const res = await fetch(`/api/playlists/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update playlist');
        return await res.json();
    },

    async deletePlaylist(id) {
        const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete playlist');
    },

    async addItemToPlaylist(playlistId, itemData) {
        const res = await fetch(`/api/playlists/${playlistId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData),
        });
        if (!res.ok) throw new Error('Failed to add item to playlist');
        return await res.json();
    },

    async removeItemFromPlaylist(playlistId, itemId) {
        const res = await fetch(`/api/playlists/${playlistId}/items/${itemId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to remove item from playlist');
        return await res.json();
    },

    async reorderPlaylist(playlistId, itemIds) {
        const res = await fetch(`/api/playlists/${playlistId}/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: itemIds }),
        });
        if (!res.ok) throw new Error('Failed to reorder playlist');
        return await res.json();
    },

    async playPlaylistNow(playlistId) {
        const res = await fetch(`/api/playlists/${playlistId}/play-now`, { method: 'POST' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to start playlist playback');
        }
        return await res.json();
    },

    async getSchedules() {
        const res = await fetch('/api/schedule');
        if (!res.ok) throw new Error('Failed to load schedule');
        return await res.json();
    },

    async createSchedule(data) {
        const res = await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to create schedule');
        }
        return await res.json();
    },

    async updateSchedule(jobId, data) {
        const res = await fetch(`/api/schedule/${jobId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to update schedule');
        }
        return await res.json();
    },

    async deleteSchedule(jobId) {
        const res = await fetch(`/api/schedule/${jobId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to cancel scheduled job');
    },

    async playNow(itemIds, autoTurnOff = true) {
        const res = await fetch('/api/play-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: itemIds, auto_turn_off: autoTurnOff }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Play Now command failed');
        }
        return await res.json();
    },
};

// --- Initialization ---
async function initApp() {
    setupEventListeners();
    await loadInitialSettings();
    loadLibraryMedia();
    loadPlaylistsCount();
    loadTimeline();

    setInterval(updateTvStatusUI, 25000);
    setInterval(updateClockPreviews, 1000);
}

async function loadInitialSettings() {
    try {
        const settings = await api.getSettings();
        state.settings = settings;
        
        // Android TV Settings
        elements.tvIpInput.value = settings.tv_ip || '';
        elements.tvPortInput.value = settings.adb_port || 5555;
        elements.tvNameInput.value = settings.tv_device_name || '';
        
        // Samsung TV Settings
        if (elements.samsungIpInput) elements.samsungIpInput.value = settings.samsung_tv_ip || '';
        if (elements.samsungMacInput) elements.samsungMacInput.value = settings.samsung_tv_mac || '';
        if (elements.samsungAppSelect && settings.samsung_app_id) elements.samsungAppSelect.value = settings.samsung_app_id;

        // TV Type Switch
        switchTvType(settings.tv_type || 'android');

        // Media Server Settings
        elements.jfUrlInput.value = settings.jellyfin_url || '';
        elements.jfKeyInput.value = settings.jellyfin_api_key || '';
        if (elements.plexUrlInput) elements.plexUrlInput.value = settings.plex_url || '';
        if (elements.plexTokenInput) elements.plexTokenInput.value = settings.plex_token || '';
        if (elements.plexPlayerIpInput) elements.plexPlayerIpInput.value = settings.plex_player_ip || '';

        // Media Provider Switch
        switchMediaProvider(settings.media_provider || 'jellyfin');

        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
        elements.browserTzHint.textContent = `Detected browser timezone: ${browserTz}`;
        elements.timezoneSelect.value = settings.app_timezone || browserTz || 'Asia/Jerusalem';

        if (settings.jellyfin_users && settings.jellyfin_users.length > 0) {
            populateUsersDropdown(settings.jellyfin_users, settings.jellyfin_user_id);
        }

        updateTvStatusUI();
        updateClockPreviews();
    } catch (err) {
        console.warn('Settings load notice:', err);
    }
}

function updateClockPreviews() {
    const now = new Date();
    const tz = elements.timezoneSelect ? elements.timezoneSelect.value : (state.settings.app_timezone || 'Asia/Jerusalem');
    
    if (elements.browserClockPreview) {
        elements.browserClockPreview.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    if (elements.serverClockPreview) {
        try {
            elements.serverClockPreview.value = now.toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ` (${tz})`;
        } catch (e) {
            elements.serverClockPreview.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    }
}

async function updateTvStatusUI() {
    try {
        const status = await api.getTvStatus();
        state.tvStatus = status;

        if (status.session_found && status.is_active) {
            elements.headerStatusDot.className = 'w-2 h-2 rounded-full status-led connected';
            elements.headerStatusLabel.textContent = status.device_name || 'TV Active';
        } else if (status.adb_reachable) {
            elements.headerStatusDot.className = 'w-2 h-2 rounded-full status-led connected';
            elements.headerStatusLabel.textContent = 'TV Ready';
        } else if (status.adb_state === 'unauthorized') {
            elements.headerStatusDot.className = 'w-2 h-2 rounded-full status-led partial';
            elements.headerStatusLabel.textContent = 'Prompt on TV';
        } else if (!status.configured_tv_ip) {
            elements.headerStatusDot.className = 'w-2 h-2 rounded-full status-led';
            elements.headerStatusLabel.textContent = 'Setup TV';
        } else {
            elements.headerStatusDot.className = 'w-2 h-2 rounded-full status-led offline';
            elements.headerStatusLabel.textContent = 'TV Offline';
        }

        const isSamsung = (state.settings.tv_type === 'samsung');
        const tvConfigured = isSamsung ? !!state.settings.samsung_tv_ip : !!status.configured_tv_ip;
        const isPlex = (state.settings.media_provider === 'plex');
        const mediaConfigured = isPlex ? (!!state.settings.plex_url && !!state.settings.plex_token) : !!state.settings.jellyfin_api_key;

        if (!tvConfigured || !mediaConfigured) {
            elements.setupBanner.classList.remove('hidden');
            if (!tvConfigured) {
                elements.bannerMsg.textContent = isSamsung 
                    ? 'Enter your Samsung TV IP address in Settings to enable automated wake-up.'
                    : 'Enter your TV IP address in Settings to enable automated wake-up.';
            } else {
                elements.bannerMsg.textContent = isPlex
                    ? 'Configure your Plex Server URL & Token to load your media library.'
                    : 'Configure your Jellyfin API key to load your media library.';
            }
        } else {
            elements.setupBanner.classList.add('hidden');
        }

        renderAdbStatusBox(status);

        // Also fetch Samsung TV status if Samsung TV is selected
        if (isSamsung && state.settings.samsung_tv_ip) {
            api.getSamsungStatus().then(renderSamsungStatusBox).catch(() => {});
        }
    } catch (err) {
        elements.headerStatusDot.className = 'w-2 h-2 rounded-full status-led offline';
        elements.headerStatusLabel.textContent = 'Server Offline';
    }
}

function renderSamsungStatusBox(status) {
    if (!elements.samsungStatusDot) return;
    const st = status.state || 'offline';
    elements.samsungStatusDot.className = `w-2 h-2 rounded-full status-led ${status.is_ready ? 'connected' : (st === 'standby' ? 'partial' : 'offline')}`;
    elements.samsungStatusTitle.textContent = status.device_name ? `Samsung TV (${status.device_name})` : 'Samsung TV Status';
    elements.samsungStatusMessage.textContent = status.message || (status.is_ready ? 'Samsung TV is reachable.' : 'Samsung TV is offline or unreachable.');
}

function renderAdbStatusBox(status) {
    const st = status.adb_state || 'offline';
    elements.adbBoxDot.className = `w-2 h-2 rounded-full status-led ${status.adb_reachable ? 'connected' : (st === 'unauthorized' ? 'partial' : 'offline')}`;
    
    if (st === 'device') {
        elements.adbBoxTitle.textContent = 'TV Connected & Ready';
        elements.adbBoxMessage.textContent = status.adb_message || 'The TV is authorized and ready for automated wake-up, playback, and auto-sleep.';
        elements.tvPromptCallout.classList.add('hidden');
    } else if (st === 'unauthorized') {
        elements.adbBoxTitle.textContent = 'Authorization Required';
        elements.adbBoxMessage.textContent = 'Connection initiated, but waiting for permission on the TV.';
        elements.tvPromptCallout.classList.remove('hidden');
    } else if (st === 'cannot_connect') {
        elements.adbBoxTitle.textContent = 'Cannot Reach TV';
        elements.adbBoxMessage.textContent = status.adb_message;
        elements.tvPromptCallout.classList.add('hidden');
    } else if (st === 'not_configured') {
        elements.adbBoxTitle.textContent = 'TV IP Not Configured';
        elements.adbBoxMessage.textContent = 'Enter your TV IP address below and click Connect.';
        elements.tvPromptCallout.classList.add('hidden');
    } else {
        elements.adbBoxTitle.textContent = 'TV Offline';
        elements.adbBoxMessage.textContent = status.adb_message || 'Make sure the TV is powered on and connected to the network.';
        elements.tvPromptCallout.classList.add('hidden');
    }
}


function populateUsersDropdown(users, selectedId) {
    elements.jfUserSelect.innerHTML = users.map(u => `
        <option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>
            ${escapeHtml(u.name)} ${u.is_admin ? '(Admin)' : ''}
        </option>
    `).join('');
}

// --- Library Media Loading & Search ---
async function loadLibraryMedia() {
    elements.seriesView.classList.add('hidden');
    elements.mediaContainer.innerHTML = `
        <div class="loading-state flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div class="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p class="text-xs">Fetching media from library...</p>
        </div>
    `;

    try {
        const items = await api.fetchMedia(state.searchQuery, state.mediaTypeFilter, state.categoryFilter);
        renderMediaGrid(items);
    } catch (err) {
        elements.mediaContainer.innerHTML = `
            <div class="empty-state py-16 text-center text-slate-400 space-y-3">
                <h3 class="text-sm font-semibold text-white">Failed to Load Library</h3>
                <p class="text-xs max-w-sm mx-auto">${escapeHtml(err.message)}</p>
                <button class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-md transition" onclick="openSettingsModal('media-tab')">Check Media Server Settings</button>
            </div>
        `;
    }
}

function renderMediaGrid(items) {
    if (!items || items.length === 0) {
        elements.mediaContainer.innerHTML = `
            <div class="empty-state py-16 text-center text-slate-400 space-y-2">
                <h3 class="text-sm font-semibold text-white">No media found</h3>
                <p class="text-xs max-w-sm mx-auto">Try searching for a different title or select a different filter.</p>
            </div>
        `;
        return;
    }

    const cardsHtml = items.map(item => {
        const isAnime = (item.genres && item.genres.some(g => g.toLowerCase() === 'anime')) || state.categoryFilter === 'anime';
        let badgeLabel = item.type === 'Movie' ? 'Movie' : 'Series';
        if (isAnime) {
            badgeLabel = item.type === 'Movie' ? 'Anime Movie' : 'Anime';
        }
        const runtimeText = formatRuntime(item.runtime_minutes);

        return `
        <div class="media-card flex flex-col cursor-pointer group" data-id="${item.id}" data-type="${item.type}" data-name="${escapeHtml(item.name)}" data-tag="${item.image_tag || ''}" data-year="${item.year || ''}" data-runtime="${item.runtime_minutes || ''}" data-overview="${escapeHtml(item.overview || '')}">
            <div class="poster-wrapper relative">
                ${item.image_tag 
                    ? `<img class="poster-img" src="${getImageUrl(item.id, item.image_tag)}" alt="${escapeHtml(item.name)}" loading="lazy">` 
                    : `<div class="poster-fallback">${item.type === 'Movie' ? 'Movie' : 'Series'}</div>`}
                <span class="media-type-badge">${badgeLabel}</span>
            </div>
            <div class="mt-2.5 space-y-1">
                <div class="text-xs font-semibold text-white truncate" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                <div class="text-[11px] text-slate-400 flex items-center gap-1.5">
                    ${item.year ? `<span>${item.year}</span>` : ''}
                    ${runtimeText ? `<span>· ${runtimeText}</span>` : ''}
                </div>
                <div class="flex gap-1.5 pt-1">
                    <button class="action-schedule-btn flex-1 py-1 px-2 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition text-center">Schedule</button>
                    <button class="action-playlist-btn flex-1 py-1 px-2 text-[11px] font-medium bg-[#1a1d27] hover:bg-[#222634] text-slate-300 rounded border border-white/[0.08] transition text-center">+ Playlist</button>
                </div>
            </div>
        </div>
    `;}).join('');

    elements.mediaContainer.innerHTML = `<div class="media-grid">${cardsHtml}</div>`;

    // Attach click listeners to cards
    elements.mediaContainer.querySelectorAll('.media-card').forEach(card => {
        const data = card.dataset;

        card.querySelector('.poster-wrapper').addEventListener('click', (e) => {
            e.stopPropagation();
            if (data.type === 'Series') {
                openSeriesDrilldown(data);
            } else {
                openScheduleModal({ ...data, target_type: 'media' });
            }
        });

        card.querySelector('.action-schedule-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (data.type === 'Series') {
                openSeriesDrilldown(data);
            } else {
                openScheduleModal({ ...data, target_type: 'media' });
            }
        });

        card.querySelector('.action-playlist-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (data.type === 'Series') {
                openSeriesDrilldown(data);
            } else {
                openAddToPlaylistModal(data);
            }
        });
    });
}

// --- Series Drill-down View ---
async function openSeriesDrilldown(seriesData) {
    state.currentSeries = seriesData;
    elements.mediaContainer.innerHTML = '';
    elements.seriesView.classList.remove('hidden');

    elements.seriesHero.innerHTML = `
        <div class="flex flex-col sm:flex-row gap-5 items-start">
            ${seriesData.tag 
                ? `<img class="w-24 h-36 object-cover rounded-lg border border-white/[0.08] flex-shrink-0" src="${getImageUrl(seriesData.id, seriesData.tag)}" alt="${escapeHtml(seriesData.name)}">` 
                : ''}
            <div class="space-y-1.5">
                <h2 class="text-xl font-bold text-white tracking-tight">${escapeHtml(seriesData.name)}</h2>
                <div class="text-xs text-slate-400">${seriesData.year || ''} · TV Series</div>
                <p class="text-xs text-slate-300 leading-relaxed max-w-2xl">${escapeHtml(seriesData.overview || '')}</p>
            </div>
        </div>
    `;

    elements.seasonsSlider.innerHTML = '<div class="loading-state py-4 text-xs text-slate-400">Loading seasons...</div>';
    elements.episodesList.innerHTML = '';

    try {
        const seasons = await api.getSeasons(seriesData.id);
        state.currentSeasons = seasons;

        if (!seasons || seasons.length === 0) {
            elements.seasonsSlider.innerHTML = '<p class="text-xs text-slate-400">No seasons found.</p>';
            return;
        }

        elements.seasonsSlider.innerHTML = seasons.map((season, idx) => `
            <button class="season-btn ${idx === 0 ? 'bg-indigo-600 text-white' : 'bg-[#11131a] text-slate-400 hover:text-white'} px-3.5 py-1 text-xs font-medium rounded-full border border-white/[0.08] transition whitespace-nowrap" data-id="${season.id}">
                ${escapeHtml(season.name || `Season ${season.season_number || 1}`)}
            </button>
        `).join('');

        elements.seasonsSlider.querySelectorAll('.season-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                elements.seasonsSlider.querySelectorAll('.season-btn').forEach(b => {
                    b.classList.remove('bg-indigo-600', 'text-white');
                    b.classList.add('bg-[#11131a]', 'text-slate-400');
                });
                btn.classList.remove('bg-[#11131a]', 'text-slate-400');
                btn.classList.add('bg-indigo-600', 'text-white');
                loadSeasonEpisodes(seriesData.id, btn.dataset.id);
            });
        });

        loadSeasonEpisodes(seriesData.id, seasons[0].id);

    } catch (err) {
        elements.seasonsSlider.innerHTML = '<p class="text-xs text-slate-400">Failed to load seasons.</p>';
        showToast('Failed to load seasons', 'error');
    }
}

async function loadSeasonEpisodes(seriesId, seasonId) {
    elements.episodesList.innerHTML = `
        <div class="loading-state py-8 text-center text-xs text-slate-400">
            <div class="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2"></div>
            Loading episodes...
        </div>
    `;

    try {
        const episodes = await api.getEpisodes(seriesId, seasonId);
        
        if (!episodes || episodes.length === 0) {
            elements.episodesList.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No episodes in this season.</p>';
            return;
        }

        elements.episodesList.innerHTML = episodes.map(ep => {
            const runtimeText = formatRuntime(ep.runtime_minutes);
            const epCode = `S${ep.season_number || 1}E${ep.episode_number || 1}`;
            return `
            <div class="episode-card flex items-center justify-between gap-4 p-3 bg-[#11131a] hover:bg-[#161922] border border-white/[0.08] rounded-lg transition" data-id="${ep.id}" data-name="${escapeHtml(state.currentSeries.name)} - ${epCode}: ${escapeHtml(ep.name)}" data-tag="${ep.image_tag || ''}" data-type="Episode" data-runtime="${ep.runtime_minutes || ''}">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded bg-[#1a1d27] text-indigo-400 font-bold text-xs flex items-center justify-center flex-shrink-0">E${ep.episode_number || 1}</div>
                    <div class="min-w-0">
                        <div class="text-xs font-semibold text-white truncate">${escapeHtml(ep.name)}</div>
                        <div class="text-[11px] text-slate-400">${runtimeText ? `${runtimeText}` : ''} ${ep.overview ? `· ${escapeHtml(ep.overview.slice(0, 100))}...` : ''}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button class="action-schedule-ep px-2.5 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition">Schedule</button>
                    <button class="action-playlist-ep px-2.5 py-1 text-xs font-medium bg-[#1a1d27] hover:bg-[#222634] text-slate-300 rounded border border-white/[0.08] transition">+ Playlist</button>
                </div>
            </div>
        `;}).join('');

        elements.episodesList.querySelectorAll('.episode-card').forEach(card => {
            card.querySelector('.action-schedule-ep').addEventListener('click', (e) => {
                e.stopPropagation();
                openScheduleModal({ ...card.dataset, target_type: 'media' });
            });
            card.querySelector('.action-playlist-ep').addEventListener('click', (e) => {
                e.stopPropagation();
                openAddToPlaylistModal(card.dataset);
            });
        });

    } catch (err) {
        elements.episodesList.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">Failed to load episodes.</p>';
        showToast('Failed to load episodes', 'error');
    }
}

// --- Playlists View Management ---
async function loadPlaylists() {
    elements.playlistDetailView.classList.add('hidden');
    elements.playlistsMainContainer.classList.remove('hidden');
    elements.playlistsGrid.innerHTML = '<div class="loading-state py-8 text-xs text-slate-400 col-span-full text-center">Loading playlists...</div>';

    try {
        const playlists = await api.getPlaylists();
        state.playlists = playlists;
        renderPlaylistsGrid(playlists);
        updatePlaylistsCountBadge(playlists.length);
    } catch (err) {
        elements.playlistsGrid.innerHTML = `<p class="text-xs text-slate-400 col-span-full text-center">Failed to load playlists: ${escapeHtml(err.message)}</p>`;
    }
}

async function loadPlaylistsCount() {
    try {
        const playlists = await api.getPlaylists();
        state.playlists = playlists;
        updatePlaylistsCountBadge(playlists.length);
    } catch (e) {}
}

function updatePlaylistsCountBadge(count) {
    if (count > 0) {
        elements.playlistsCountBadge.textContent = count;
        elements.playlistsCountBadge.classList.remove('hidden');
    } else {
        elements.playlistsCountBadge.classList.add('hidden');
    }
}

function renderPlaylistsGrid(playlists) {
    if (!playlists || playlists.length === 0) {
        elements.playlistsGrid.innerHTML = '';
        elements.emptyPlaylistsState.classList.remove('hidden');
        return;
    }

    elements.emptyPlaylistsState.classList.add('hidden');

    elements.playlistsGrid.innerHTML = playlists.map(pl => {
        const totalDuration = formatRuntime(pl.total_runtime_minutes) || '0m';
        return `
        <div class="playlist-card bg-[#11131a] hover:bg-[#161922] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between transition cursor-pointer" data-id="${pl.id}">
            <div class="space-y-1">
                <div class="text-sm font-semibold text-white">${escapeHtml(pl.name)}</div>
                <p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(pl.description || 'No description.')}</p>
            </div>
            <div class="pt-3 border-t border-white/[0.08] mt-3 flex items-center justify-between text-xs text-slate-400">
                <span class="bg-[#1a1d27] px-2 py-0.5 rounded text-[11px] font-medium text-slate-300">${pl.items_count} item${pl.items_count === 1 ? '' : 's'}</span>
                <span>${totalDuration}</span>
            </div>
            <div class="playlist-card-actions flex gap-1.5 mt-3 pt-2">
                <button class="action-card-edit flex-1 py-1 text-xs font-medium bg-[#1a1d27] hover:bg-[#222634] text-slate-200 rounded border border-white/[0.08] transition text-center" data-id="${pl.id}">Edit</button>
                <button class="action-card-play flex-1 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded transition text-center" data-id="${pl.id}">Play</button>
                <button class="action-card-sched flex-1 py-1 text-xs font-medium bg-[#1a1d27] hover:bg-[#222634] text-slate-200 rounded border border-white/[0.08] transition text-center" data-id="${pl.id}">Schedule</button>
                <button class="action-card-del py-1 px-2.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded border border-rose-500/20 transition text-center" data-id="${pl.id}">Delete</button>
            </div>
        </div>
    `;}).join('');

    elements.playlistsGrid.querySelectorAll('.playlist-card').forEach(card => {
        const id = card.dataset.id;
        const pl = state.playlists.find(p => p.id === id);

        card.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-card-actions')) return;
            openPlaylistDetail(id);
        });

        card.querySelector('.action-card-edit')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openPlaylistDetail(id);
        });

        card.querySelector('.action-card-play')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await api.playPlaylistNow(id);
                showToast(`Playing "${pl?.name || 'Playlist'}" on TV`, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        card.querySelector('.action-card-sched')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pl) {
                openScheduleModal({
                    id: pl.id,
                    name: pl.name,
                    total_runtime_minutes: pl.total_runtime_minutes,
                    target_type: 'playlist',
                });
            }
        });

        card.querySelector('.action-card-del')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete playlist "${pl?.name || 'this playlist'}"?`)) {
                try {
                    await api.deletePlaylist(id);
                    showToast('Playlist deleted', 'success');
                    loadPlaylists();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    });
}

async function openPlaylistDetail(playlistId) {
    elements.playlistsMainContainer.classList.add('hidden');
    elements.playlistDetailView.classList.remove('hidden');
    elements.playlistHero.innerHTML = '<div class="loading-state py-4 text-xs text-slate-400">Loading playlist details...</div>';
    elements.playlistItemsList.innerHTML = '';

    try {
        const pl = await api.getPlaylist(playlistId);
        state.currentPlaylist = pl;

        const totalDuration = formatRuntime(pl.total_runtime_minutes) || '0m';

        elements.playlistHero.innerHTML = `
            <div class="space-y-1">
                <h2 class="text-xl font-bold text-white tracking-tight">${escapeHtml(pl.name)}</h2>
                <p class="text-xs text-slate-400">${escapeHtml(pl.description || 'No description provided.')}</p>
                <div class="flex items-center gap-3 pt-2 text-xs">
                    <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-medium">${pl.items_count} item${pl.items_count === 1 ? '' : 's'}</span>
                    <span class="text-slate-400">Total Duration: <strong class="text-white font-medium">${totalDuration}</strong></span>
                </div>
            </div>
        `;

        renderPlaylistItemsList(pl.items);

    } catch (err) {
        showToast(err.message, 'error');
        elements.playlistHero.innerHTML = `<p class="text-xs text-slate-400">${escapeHtml(err.message)}</p>`;
    }
}

function renderPlaylistItemsList(items) {
    if (!items || items.length === 0) {
        elements.playlistItemsList.innerHTML = `
            <div class="empty-state py-8 text-center text-slate-400 space-y-1">
                <h3 class="text-xs font-semibold text-white">Queue is Empty</h3>
                <p class="text-xs">Click "Add Media" above to append items to this sequence.</p>
            </div>
        `;
        return;
    }

    elements.playlistItemsList.innerHTML = items.map((item, idx) => {
        const itemRuntime = formatRuntime(item.runtime_minutes);
        const orderPadded = String(idx + 1).padStart(2, '0');
        let itemPosterHtml = '';
        if (item.image_tag) {
            itemPosterHtml = `<img class="w-9 h-14 object-cover rounded border border-white/[0.08] flex-shrink-0" src="${getImageUrl(item.jellyfin_item_id, item.image_tag)}" alt="${escapeHtml(item.name)}">`;
        } else {
            itemPosterHtml = `<div class="w-9 h-14 bg-[#1a1d27] rounded flex items-center justify-center text-[10px] font-bold text-indigo-400 flex-shrink-0">${item.item_type === 'Episode' ? extractEpLabel(item.name) : 'MEDIA'}</div>`;
        }

        return `
        <div class="playlist-item-row bg-[#11131a] border border-white/[0.08] rounded-lg p-2.5 flex items-center gap-3 transition" data-id="${item.id}" data-idx="${idx}">
            <span class="text-xs font-bold text-slate-500 w-5 text-center">${orderPadded}</span>
            ${itemPosterHtml}
            <div class="flex-1 min-w-0">
                <div class="text-xs font-semibold text-white truncate">${escapeHtml(item.name)}</div>
                <div class="text-[11px] text-slate-400">${item.item_type || 'Media'} ${itemRuntime ? `· ${itemRuntime}` : ''}</div>
            </div>
            <div class="flex items-center gap-1">
                <button class="move-up px-2 py-1 bg-[#1a1d27] hover:bg-[#222634] text-slate-300 text-xs rounded border border-white/[0.08] transition" ${idx === 0 ? 'disabled' : ''}>Up</button>
                <button class="move-down px-2 py-1 bg-[#1a1d27] hover:bg-[#222634] text-slate-300 text-xs rounded border border-white/[0.08] transition" ${idx === items.length - 1 ? 'disabled' : ''}>Down</button>
                <button class="delete px-2 py-1 text-rose-400 hover:bg-rose-500/10 text-xs rounded border border-rose-500/20 transition">Remove</button>
            </div>
        </div>
    `;}).join('');

    // Attach row listeners
    elements.playlistItemsList.querySelectorAll('.playlist-item-row').forEach(row => {
        const itemId = row.dataset.id;
        const idx = parseInt(row.dataset.idx, 10);

        row.querySelector('.move-up')?.addEventListener('click', async () => {
            if (idx <= 0) return;
            const itemsCopy = [...state.currentPlaylist.items];
            [itemsCopy[idx - 1], itemsCopy[idx]] = [itemsCopy[idx], itemsCopy[idx - 1]];
            const newOrderIds = itemsCopy.map(x => x.id);
            try {
                const updatedPl = await api.reorderPlaylist(state.currentPlaylist.id, newOrderIds);
                state.currentPlaylist = updatedPl;
                renderPlaylistItemsList(updatedPl.items);
            } catch (e) {
                showToast('Failed to reorder', 'error');
            }
        });

        row.querySelector('.move-down')?.addEventListener('click', async () => {
            if (idx >= state.currentPlaylist.items.length - 1) return;
            const itemsCopy = [...state.currentPlaylist.items];
            [itemsCopy[idx], itemsCopy[idx + 1]] = [itemsCopy[idx + 1], itemsCopy[idx]];
            const newOrderIds = itemsCopy.map(x => x.id);
            try {
                const updatedPl = await api.reorderPlaylist(state.currentPlaylist.id, newOrderIds);
                state.currentPlaylist = updatedPl;
                renderPlaylistItemsList(updatedPl.items);
            } catch (e) {
                showToast('Failed to reorder', 'error');
            }
        });

        row.querySelector('.delete')?.addEventListener('click', async () => {
            try {
                const updatedPl = await api.removeItemFromPlaylist(state.currentPlaylist.id, itemId);
                state.currentPlaylist = updatedPl;
                openPlaylistDetail(state.currentPlaylist.id);
                showToast('Item removed', 'success');
            } catch (e) {
                showToast('Failed to remove item', 'error');
            }
        });
    });
}

// --- Browse & Add Items to Playlist Modal ---
async function openBrowseAddItemsModal() {
    if (!state.currentPlaylist) return;
    elements.browseAddItemsModalTitle.textContent = `Add Media to "${state.currentPlaylist.name}"`;
    elements.playlistSearchInput.value = '';
    elements.browseAddItemsModal.classList.remove('hidden');
    loadPlaylistPickerResults('');
}

async function loadPlaylistPickerResults(query = '') {
    elements.playlistPickerContainer.innerHTML = '<div class="loading-state py-6 text-xs text-slate-400 text-center">Searching library...</div>';

    try {
        const items = await api.fetchMedia(query, 'Movie,Series');
        if (!items || items.length === 0) {
            elements.playlistPickerContainer.innerHTML = '<p class="text-xs text-slate-400 py-4 text-center">No media found.</p>';
            return;
        }

        elements.playlistPickerContainer.innerHTML = items.map(item => {
            const runtimeText = formatRuntime(item.runtime_minutes);
            return `
            <div class="picker-item-row bg-[#090a0f] border border-white/[0.08] rounded-lg p-2.5 flex items-center justify-between gap-3" data-id="${item.id}" data-type="${item.type}" data-name="${escapeHtml(item.name)}" data-tag="${item.image_tag || ''}" data-runtime="${item.runtime_minutes || ''}">
                <div class="flex items-center gap-2.5 min-w-0">
                    ${item.image_tag 
                        ? `<img class="w-8 h-12 object-cover rounded border border-white/[0.08] flex-shrink-0" src="${getImageUrl(item.id, item.image_tag)}" alt="${escapeHtml(item.name)}">` 
                        : `<div class="w-8 h-12 bg-[#1a1d27] rounded flex items-center justify-center text-[10px] font-bold text-indigo-400 flex-shrink-0">MEDIA</div>`}
                    <div class="min-w-0">
                        <div class="text-xs font-semibold text-white truncate">${escapeHtml(item.name)}</div>
                        <div class="text-[11px] text-slate-400">${item.type} ${item.year ? `(${item.year})` : ''} ${runtimeText ? `· ${runtimeText}` : ''}</div>
                    </div>
                </div>
                <button class="add-to-active-pl-btn px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition">+ Add</button>
            </div>
        `;}).join('');

        elements.playlistPickerContainer.querySelectorAll('.picker-item-row').forEach(row => {
            row.querySelector('.add-to-active-pl-btn').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.textContent = 'Adding...';

                const itemData = {
                    jellyfin_item_id: row.dataset.id,
                    name: row.dataset.name,
                    item_type: row.dataset.type,
                    image_tag: row.dataset.tag || null,
                    runtime_minutes: parseInt(row.dataset.runtime) || null,
                };

                try {
                    const updatedPl = await api.addItemToPlaylist(state.currentPlaylist.id, itemData);
                    state.currentPlaylist = updatedPl;
                    btn.textContent = 'Added';
                    btn.classList.replace('bg-indigo-600', 'bg-emerald-600');
                    showToast(`Added "${itemData.name}"`, 'success');
                    renderPlaylistItemsList(updatedPl.items);
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = '+ Add';
                }
            });
        });

    } catch (err) {
        elements.playlistPickerContainer.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">${escapeHtml(err.message)}</p>`;
    }
}

// --- Add To Playlist Modal (from library cards) ---
async function openAddToPlaylistModal(mediaData) {
    state.targetForPlaylist = mediaData;
    const runtimeFormatted = formatRuntime(mediaData.runtime);

    const isEpisode = mediaData.type === 'Episode' || mediaData.item_type === 'Episode' || (mediaData.name && mediaData.name.includes(' - S'));
    let posterHtml = '';
    if (mediaData.tag) {
        posterHtml = `<img class="w-12 h-18 object-cover rounded border border-white/[0.08] flex-shrink-0" src="${getImageUrl(mediaData.id, mediaData.tag)}" alt="${escapeHtml(mediaData.name)}">`;
    } else if (isEpisode) {
        posterHtml = `<div class="w-12 h-18 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded flex items-center justify-center font-bold text-xs flex-shrink-0">${escapeHtml(extractEpLabel(mediaData.name))}</div>`;
    } else {
        posterHtml = `<div class="w-12 h-18 bg-[#1a1d27] rounded flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">MEDIA</div>`;
    }

    elements.addToPlaylistMediaCard.innerHTML = `
        ${posterHtml}
        <div class="min-w-0">
            <h4 class="text-xs font-semibold text-white truncate">${escapeHtml(mediaData.name)}</h4>
            <p class="text-[11px] text-slate-400">${mediaData.type || 'Media'} ${runtimeFormatted ? `· ${runtimeFormatted}` : ''}</p>
        </div>
    `;

    elements.newPlaylistInlineName.value = '';

    try {
        const playlists = await api.getPlaylists();
        state.playlists = playlists;
        if (playlists.length > 0) {
            elements.targetPlaylistSelect.innerHTML = playlists.map(p => `
                <option value="${p.id}">${escapeHtml(p.name)} (${p.items_count} items)</option>
            `).join('');
            elements.targetPlaylistSelect.disabled = false;
        } else {
            elements.targetPlaylistSelect.innerHTML = '<option value="">-- No playlists created yet --</option>';
            elements.targetPlaylistSelect.disabled = true;
        }
    } catch (e) {
        elements.targetPlaylistSelect.innerHTML = '<option value="">Failed to load playlists</option>';
    }

    elements.addToPlaylistModal.classList.remove('hidden');
}

async function handleConfirmAddToPlaylist() {
    const itemData = {
        jellyfin_item_id: state.targetForPlaylist.id,
        name: state.targetForPlaylist.name,
        item_type: state.targetForPlaylist.type || 'Movie',
        image_tag: state.targetForPlaylist.tag || null,
        runtime_minutes: parseInt(state.targetForPlaylist.runtime) || null,
    };

    const newName = elements.newPlaylistInlineName.value.trim();
    let targetPlaylistId = elements.targetPlaylistSelect.value;

    elements.confirmAddToPlaylistBtn.disabled = true;
    elements.confirmAddToPlaylistBtn.textContent = 'Adding...';

    try {
        if (newName) {
            const newPl = await api.createPlaylist({ name: newName });
            targetPlaylistId = newPl.id;
        }

        if (!targetPlaylistId) {
            throw new Error('Please select a playlist or enter a new playlist name');
        }

        await api.addItemToPlaylist(targetPlaylistId, itemData);
        showToast('Added to playlist successfully', 'success');
        elements.addToPlaylistModal.classList.add('hidden');
        loadPlaylistsCount();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.confirmAddToPlaylistBtn.disabled = false;
        elements.confirmAddToPlaylistBtn.textContent = 'Add to Playlist';
    }
}

// --- Schedule Modal & Timing ---
function openScheduleModal(targetData) {
    state.editingScheduleJob = null;
    state.selectedMedia = targetData;
    const isPlaylist = targetData.target_type === 'playlist';
    const isEpisode = targetData.type === 'Episode' || targetData.item_type === 'Episode' || (targetData.name && targetData.name.includes(' - S'));
    const runtimeFormatted = formatRuntime(targetData.runtime || targetData.total_runtime_minutes);

    const titleEl = document.getElementById('scheduleModalTitle');
    if (titleEl) titleEl.textContent = 'Schedule Playback';
    elements.confirmScheduleBtn.textContent = 'Schedule Job';
    elements.instantPlayBtn.classList.remove('hidden');

    let posterHtml = '';
    if (targetData.tag) {
        posterHtml = `<img class="w-12 h-18 object-cover rounded border border-white/[0.08] flex-shrink-0" src="${getImageUrl(targetData.id, targetData.tag)}" alt="${escapeHtml(targetData.name)}">`;
    } else if (isEpisode) {
        posterHtml = `<div class="w-12 h-18 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded flex items-center justify-center font-bold text-xs flex-shrink-0">${escapeHtml(extractEpLabel(targetData.name))}</div>`;
    } else if (isPlaylist) {
        posterHtml = `<div class="w-12 h-18 bg-[#1a1d27] rounded flex items-center justify-center text-[10px] font-bold text-indigo-400 flex-shrink-0">LIST</div>`;
    } else {
        posterHtml = `<div class="w-12 h-18 bg-[#1a1d27] rounded flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">MEDIA</div>`;
    }

    elements.modalMediaCard.innerHTML = `
        ${posterHtml}
        <div class="min-w-0">
            <h4 class="text-xs font-semibold text-white truncate">${escapeHtml(targetData.name)}</h4>
            <p class="text-[11px] text-slate-400">${isPlaylist ? 'Custom Playlist' : (targetData.type || 'Media')} ${runtimeFormatted ? `· ${runtimeFormatted}` : ''}</p>
        </div>
    `;

    setRecurrenceFrequency('once');

    const defaultTime = new Date();
    defaultTime.setMinutes(defaultTime.getMinutes() + 15);
    elements.scheduleDatetime.value = toLocalDatetimeString(defaultTime);
    
    const defH = String(defaultTime.getHours()).padStart(2, '0');
    const defM = String(defaultTime.getMinutes()).padStart(2, '0');
    elements.scheduleTimeOfDay.value = `${defH}:${defM}`;

    elements.scheduleModal.classList.remove('hidden');
}

function openEditScheduleModal(job) {
    state.editingScheduleJob = job;
    state.selectedMedia = {
        id: job.jellyfin_item_id,
        name: job.name,
        target_type: job.target_type,
        type: job.item_type,
        tag: job.image_tag,
    };

    const isPlaylist = job.target_type === 'playlist' || job.item_type === 'Playlist';
    const isEpisode = job.item_type === 'Episode' || (job.name && job.name.includes(' - S'));

    const titleEl = document.getElementById('scheduleModalTitle');
    if (titleEl) titleEl.textContent = `Edit Schedule: ${job.name}`;
    elements.confirmScheduleBtn.textContent = 'Save Changes';
    elements.instantPlayBtn.classList.add('hidden');

    let posterHtml = '';
    if (job.image_tag) {
        posterHtml = `<img class="w-12 h-18 object-cover rounded border border-white/[0.08] flex-shrink-0" src="${getImageUrl(job.jellyfin_item_id, job.image_tag)}" alt="${escapeHtml(job.name)}">`;
    } else if (isEpisode) {
        posterHtml = `<div class="w-12 h-18 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded flex items-center justify-center font-bold text-xs flex-shrink-0">${escapeHtml(extractEpLabel(job.name))}</div>`;
    } else if (isPlaylist) {
        posterHtml = `<div class="w-12 h-18 bg-[#1a1d27] rounded flex items-center justify-center text-[10px] font-bold text-indigo-400 flex-shrink-0">LIST</div>`;
    } else {
        posterHtml = `<div class="w-12 h-18 bg-[#1a1d27] rounded flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">MEDIA</div>`;
    }

    elements.modalMediaCard.innerHTML = `
        ${posterHtml}
        <div class="min-w-0">
            <h4 class="text-xs font-semibold text-white truncate">${escapeHtml(job.name)}</h4>
            <p class="text-[11px] text-slate-400">${isPlaylist ? 'Custom Playlist' : (job.item_type || 'Media')}</p>
        </div>
    `;

    const freq = job.schedule_type || 'once';
    setRecurrenceFrequency(freq);

    if (freq === 'once') {
        const dt = job.scheduled_time ? new Date(job.scheduled_time) : new Date();
        elements.scheduleDatetime.value = toLocalDatetimeString(dt);
    } else {
        elements.scheduleTimeOfDay.value = job.time_of_day || '20:00';
        if (freq === 'weekly') {
            elements.scheduleWeeklyDay.value = job.days_of_week || 'fri';
        } else if (freq === 'custom_days') {
            const activeDays = (job.days_of_week || '').split(',');
            elements.customDaysGroup.querySelectorAll('input').forEach(inp => {
                inp.checked = activeDays.includes(inp.value);
            });
        }
    }

    elements.scheduleModal.classList.remove('hidden');
}

function setRecurrenceFrequency(freq) {
    elements.recurrenceToggleGroup.querySelectorAll('.toggle-btn').forEach(btn => {
        const isActive = btn.dataset.freq === freq;
        btn.classList.toggle('active', isActive);
        if (isActive) {
            btn.className = 'toggle-btn active py-1.5 text-xs font-medium text-center rounded text-white bg-[#1a1d27] transition';
        } else {
            btn.className = 'toggle-btn py-1.5 text-xs font-medium text-center rounded text-slate-400 hover:text-white transition';
        }
    });

    if (freq === 'once') {
        elements.timingOnceSection.classList.remove('hidden');
        elements.timingRecurringSection.classList.add('hidden');
    } else {
        elements.timingOnceSection.classList.add('hidden');
        elements.timingRecurringSection.classList.remove('hidden');

        elements.weeklyDayGroup.classList.toggle('hidden', freq !== 'weekly');
        elements.customDaysGroup.classList.toggle('hidden', freq !== 'custom_days');
    }
}

function handlePresetClick(btn) {
    const now = new Date();
    if (btn.dataset.offset) {
        const mins = parseInt(btn.dataset.offset, 10);
        now.setMinutes(now.getMinutes() + mins);
    } else if (btn.dataset.preset === 'tonight-20') {
        now.setHours(20, 0, 0, 0);
        if (now < new Date()) now.setDate(now.getDate() + 1);
    } else if (btn.dataset.preset === 'tonight-21') {
        now.setHours(21, 30, 0, 0);
        if (now < new Date()) now.setDate(now.getDate() + 1);
    }
    elements.scheduleDatetime.value = toLocalDatetimeString(now);
}

async function handleConfirmSchedule() {
    if (!state.selectedMedia) return;

    const activeFreqBtn = elements.recurrenceToggleGroup.querySelector('.toggle-btn.active');
    const scheduleType = activeFreqBtn ? activeFreqBtn.dataset.freq : 'once';
    const isPlaylist = state.selectedMedia.target_type === 'playlist';

    let scheduledTime = null;
    let daysOfWeek = null;
    let timeOfDay = null;

    if (scheduleType === 'once') {
        const dtVal = elements.scheduleDatetime.value;
        if (!dtVal) {
            showToast('Please select date and time', 'error');
            return;
        }
        scheduledTime = dtVal.length === 16 ? `${dtVal}:00` : dtVal;
    } else {
        timeOfDay = elements.scheduleTimeOfDay.value || '20:00';
        if (scheduleType === 'weekly') {
            daysOfWeek = elements.scheduleWeeklyDay.value || 'fri';
        } else if (scheduleType === 'custom_days') {
            const checkedDays = Array.from(elements.customDaysGroup.querySelectorAll('input:checked')).map(i => i.value);
            if (checkedDays.length === 0) {
                showToast('Please select at least one day', 'error');
                return;
            }
            daysOfWeek = checkedDays.join(',');
        }
    }

    elements.confirmScheduleBtn.disabled = true;
    elements.confirmScheduleBtn.textContent = 'Saving...';

    const payload = {
        name: state.selectedMedia.name,
        target_type: isPlaylist ? 'playlist' : 'media',
        jellyfin_item_id: state.selectedMedia.id,
        item_type: isPlaylist ? 'Playlist' : (state.selectedMedia.type || 'Movie'),
        image_tag: state.selectedMedia.tag || null,
        scheduled_time: scheduledTime,
        schedule_type: scheduleType,
        days_of_week: daysOfWeek,
        time_of_day: timeOfDay,
        auto_turn_off: true,
    };

    try {
        if (state.editingScheduleJob) {
            await api.updateSchedule(state.editingScheduleJob.id, payload);
            showToast('Scheduled job updated successfully', 'success');
        } else {
            await api.createSchedule(payload);
            showToast('Playback scheduled successfully', 'success');
        }
        elements.scheduleModal.classList.add('hidden');
        switchView('timeline');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.confirmScheduleBtn.disabled = false;
        elements.confirmScheduleBtn.textContent = state.editingScheduleJob ? 'Save Changes' : 'Schedule Job';
    }
}

async function handleInstantPlay() {
    if (!state.selectedMedia) return;
    const isPlaylist = state.selectedMedia.target_type === 'playlist';

    elements.instantPlayBtn.disabled = true;
    elements.instantPlayBtn.textContent = 'Starting...';

    try {
        if (isPlaylist) {
            await api.playPlaylistNow(state.selectedMedia.id);
        } else {
            await api.playNow([state.selectedMedia.id], true);
        }
        showToast('Playback started on TV', 'success');
        elements.scheduleModal.classList.add('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.instantPlayBtn.disabled = false;
        elements.instantPlayBtn.textContent = 'Play Now';
    }
}

// --- Timeline Rendering ---
async function loadTimeline() {
    elements.timelineList.innerHTML = '<div class="loading-state py-8 text-center text-xs text-slate-400">Loading scheduled jobs...</div>';

    try {
        const jobs = await api.getSchedules();
        state.scheduledJobs = jobs;
        renderTimeline(jobs);
        
        const pendingCount = jobs.filter(j => j.status === 'pending').length;
        if (pendingCount > 0) {
            elements.pendingCountBadge.textContent = pendingCount;
            elements.pendingCountBadge.classList.remove('hidden');
        } else {
            elements.pendingCountBadge.classList.add('hidden');
        }
    } catch (err) {
        elements.timelineList.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">Failed to load schedule: ${escapeHtml(err.message)}</p>`;
    }
}

function renderTimeline(jobs) {
    if (!jobs || jobs.length === 0) {
        elements.timelineList.innerHTML = '';
        elements.emptyTimelineState.classList.remove('hidden');
        return;
    }

    elements.emptyTimelineState.classList.add('hidden');

    elements.timelineList.innerHTML = jobs.map(job => {
        let scheduleLabel = '';
        if (job.schedule_type === 'daily') {
            scheduleLabel = `Daily at ${job.time_of_day || '20:00'}`;
        } else if (job.schedule_type === 'weekly') {
            scheduleLabel = `Weekly (${(job.days_of_week || 'fri').toUpperCase()}) at ${job.time_of_day || '20:00'}`;
        } else if (job.schedule_type === 'custom_days') {
            scheduleLabel = `${(job.days_of_week || '').toUpperCase()} at ${job.time_of_day || '20:00'}`;
        } else {
            scheduleLabel = formatDateTime(job.scheduled_time);
        }

        const isPlaylist = job.target_type === 'playlist' || job.item_type === 'Playlist';
        const isEpisode = job.item_type === 'Episode' || (job.name && job.name.includes(' - S'));
        let timelinePosterHtml = '';
        if (job.image_tag) {
            timelinePosterHtml = `<img class="w-10 h-15 object-cover rounded border border-white/[0.08] flex-shrink-0" src="${getImageUrl(job.jellyfin_item_id, job.image_tag)}" alt="${escapeHtml(job.name)}">`;
        } else if (isEpisode) {
            timelinePosterHtml = `<div class="w-10 h-15 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded flex items-center justify-center font-bold text-xs flex-shrink-0">${escapeHtml(extractEpLabel(job.name))}</div>`;
        } else {
            timelinePosterHtml = `<div class="w-10 h-15 bg-[#1a1d27] rounded flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">${isPlaylist ? 'LIST' : 'MEDIA'}</div>`;
        }

        return `
        <div class="timeline-card bg-[#11131a] border border-white/[0.08] rounded-xl p-3.5 flex items-center justify-between gap-4" data-id="${job.id}">
            <div class="flex items-center gap-3 min-w-0">
                ${timelinePosterHtml}
                <div class="min-w-0 space-y-1">
                    <div class="flex items-center gap-2">
                        <h4 class="text-xs font-semibold text-white truncate">${escapeHtml(job.name)}</h4>
                        <span class="status-badge ${job.status}">${job.status}</span>
                    </div>
                    <div class="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                        <span class="text-indigo-400 font-medium">${scheduleLabel}</span>
                        <span>·</span>
                        <span>${isPlaylist ? 'Playlist' : (job.item_type || 'Media')}</span>
                    </div>
                    ${job.error_message ? `<div class="text-rose-400 text-[11px]">${escapeHtml(job.error_message)}</div>` : ''}
                </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
                <button class="edit-job-btn px-3 py-1.5 text-xs font-medium bg-[#1a1d27] hover:bg-[#222634] text-slate-300 rounded border border-white/[0.08] transition" data-id="${job.id}">Edit</button>
                <button class="cancel-job-btn px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded border border-rose-500/20 transition" data-id="${job.id}">
                    ${job.status === 'pending' ? 'Cancel' : 'Delete'}
                </button>
            </div>
        </div>
    `;}).join('');

    elements.timelineList.querySelectorAll('.edit-job-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const jobId = btn.dataset.id;
            const job = state.scheduledJobs.find(j => j.id === jobId);
            if (job) openEditScheduleModal(job);
        });
    });

    elements.timelineList.querySelectorAll('.cancel-job-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const jobId = btn.dataset.id;
            try {
                await api.deleteSchedule(jobId);
                showToast('Job removed', 'success');
                loadTimeline();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}

// --- Settings Modals & Handlers ---
async function openSettingsModal(tabName = 'tv-tab') {
    elements.settingsModal.classList.remove('hidden');
    switchSettingsTab(tabName);
    await loadInitialSettings();
    updateClockPreviews();
}

function switchSettingsTab(tabName) {
    elements.settingsTabs.forEach(tab => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle('active', isActive);
        if (isActive) {
            tab.className = 'settings-tab active flex-1 py-2.5 text-xs font-medium text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5 transition';
        } else {
            tab.className = 'settings-tab flex-1 py-2.5 text-xs font-medium text-slate-400 hover:text-white border-b-2 border-transparent transition';
        }
    });
    elements.settingsPanels.forEach(panel => {
        const isActive = panel.id === tabName;
        panel.classList.toggle('active', isActive);
        panel.classList.toggle('hidden', !isActive);
    });
}

function switchTvType(type) {
    state.settings.tv_type = type;
    const isAndroid = type === 'android';
    if (elements.tvTypeAndroid && elements.tvTypeSamsung) {
        elements.tvTypeAndroid.className = `tv-type-btn flex-1 py-1.5 text-xs font-medium rounded-md border transition ${isAndroid ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#090a0f] border-white/[0.08] text-slate-400 hover:text-white'}`;
        elements.tvTypeSamsung.className = `tv-type-btn flex-1 py-1.5 text-xs font-medium rounded-md border transition ${!isAndroid ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#090a0f] border-white/[0.08] text-slate-400 hover:text-white'}`;
    }
    if (elements.androidTvPanel && elements.samsungTvPanel) {
        elements.androidTvPanel.classList.toggle('hidden', !isAndroid);
        elements.samsungTvPanel.classList.toggle('hidden', isAndroid);
    }
}

function switchMediaProvider(provider) {
    state.settings.media_provider = provider;
    const isJf = provider === 'jellyfin';
    if (elements.mediaProviderJellyfin && elements.mediaProviderPlex) {
        elements.mediaProviderJellyfin.className = `media-provider-btn flex-1 py-1.5 text-xs font-medium rounded-md border transition ${isJf ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#090a0f] border-white/[0.08] text-slate-400 hover:text-white'}`;
        elements.mediaProviderPlex.className = `media-provider-btn flex-1 py-1.5 text-xs font-medium rounded-md border transition ${!isJf ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#090a0f] border-white/[0.08] text-slate-400 hover:text-white'}`;
    }
    if (elements.jellyfinPanel && elements.plexPanel) {
        elements.jellyfinPanel.classList.toggle('hidden', !isJf);
        elements.plexPanel.classList.toggle('hidden', isJf);
    }
}

async function handleConnectTv() {
    const ip = elements.tvIpInput.value.trim();
    const port = elements.tvPortInput.value.trim();

    if (!ip) {
        showToast('Please enter TV IP address', 'error');
        return;
    }

    elements.connectTvBtn.disabled = true;
    elements.connectTvBtn.textContent = 'Connecting...';

    try {
        const res = await api.connectAdb(ip, port);
        renderAdbStatusBox(res);
        if (res.is_ready) {
            showToast('TV Connected & Authorized', 'success');
        } else if (res.state === 'unauthorized') {
            showToast('Prompt sent to TV screen — please allow USB debugging', 'warning');
        } else {
            showToast(res.message || 'Cannot reach TV', 'error');
        }
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.connectTvBtn.disabled = false;
        elements.connectTvBtn.textContent = 'Connect / Pair TV';
    }
}

async function handleSaveTvSettings() {
    const ip = elements.tvIpInput.value.trim();
    const port = parseInt(elements.tvPortInput.value) || 5555;
    const name = elements.tvNameInput.value.trim();

    try {
        await api.saveSettings({
            tv_type: 'android',
            tv_ip: ip,
            adb_port: port,
            tv_device_name: name,
        });
        state.settings.tv_type = 'android';
        showToast('Android TV settings saved', 'success');
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleSaveSamsungSettings() {
    const ip = elements.samsungIpInput.value.trim();
    const mac = elements.samsungMacInput.value.trim();
    const appId = elements.samsungAppSelect.value;
    try {
        await api.saveSettings({
            tv_type: 'samsung',
            samsung_tv_ip: ip,
            samsung_tv_mac: mac,
            samsung_app_id: appId,
        });
        state.settings.tv_type = 'samsung';
        state.settings.samsung_tv_ip = ip;
        state.settings.samsung_tv_mac = mac;
        state.settings.samsung_app_id = appId;
        showToast('Samsung TV settings saved', 'success');
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleSamsungWake() {
    const ip = elements.samsungIpInput.value.trim();
    const mac = elements.samsungMacInput.value.trim();
    try {
        const res = await api.wakeSamsung(ip, mac);
        showToast(res.message || 'Wake command sent to Samsung TV', 'success');
        setTimeout(updateTvStatusUI, 3000);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleSamsungLaunch() {
    const appId = elements.samsungAppSelect.value;
    try {
        const res = await api.launchSamsungApp(appId);
        showToast(res.message || 'App launch command sent to Samsung TV', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleSamsungSleep() {
    try {
        const res = await api.sendSamsungKey('KEY_POWER');
        showToast(res.message || 'Standby command sent to Samsung TV', 'success');
        setTimeout(updateTvStatusUI, 2000);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestWake() {
    try {
        const res = await api.testWake();
        showToast(res.message || 'Screen wake sent', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestSleep() {
    try {
        const res = await api.testSleep();
        showToast(res.message || 'Standby command sent', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestLaunchApp() {
    try {
        const res = await api.testLaunch();
        showToast(res.message || 'Launch media app sent', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestJellyfin() {
    const url = elements.jfUrlInput.value.trim();
    const apiKey = elements.jfKeyInput.value.trim();

    elements.testJfBtn.disabled = true;
    elements.testJfBtn.textContent = 'Testing...';

    try {
        const res = await api.testJellyfin(url, apiKey);
        if (res.connected) {
            showToast(`Connected to "${res.server_name}" (v${res.version})`, 'success');
            if (res.users && res.users.length > 0) {
                populateUsersDropdown(res.users, state.settings.jellyfin_user_id);
            }
        } else {
            showToast(res.error || 'Connection failed', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.testJfBtn.disabled = false;
        elements.testJfBtn.textContent = 'Test Connection & Fetch Profiles';
    }
}

async function handleSaveJfSettings() {
    const url = elements.jfUrlInput.value.trim();
    const apiKey = elements.jfKeyInput.value.trim();
    const userId = elements.jfUserSelect.value;

    try {
        await api.saveSettings({
            media_provider: 'jellyfin',
            jellyfin_url: url,
            jellyfin_api_key: apiKey,
            jellyfin_user_id: userId,
        });
        state.settings.media_provider = 'jellyfin';
        showToast('Jellyfin settings saved', 'success');
        elements.settingsModal.classList.add('hidden');
        loadLibraryMedia();
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestPlex() {
    const url = elements.plexUrlInput.value.trim();
    const token = elements.plexTokenInput.value.trim();

    if (!url || !token) {
        showToast('Please enter Plex server URL and Token', 'error');
        return;
    }

    elements.testPlexBtn.disabled = true;
    elements.testPlexBtn.textContent = 'Testing...';

    try {
        const res = await api.testPlex(url, token);
        if (res.connected) {
            elements.plexTestResult.classList.remove('hidden');
            const libNames = (res.libraries || []).map(l => l.title).join(', ');
            elements.plexTestResult.innerHTML = `
                <div class="text-emerald-400 font-medium">Connected to "${escapeHtml(res.server_name)}" (v${escapeHtml(res.version)})</div>
                <div class="text-slate-400 mt-1">Libraries (${(res.libraries || []).length}): ${escapeHtml(libNames || 'None')}</div>
            `;
            showToast(`Connected to Plex server "${res.server_name}"`, 'success');
        } else {
            elements.plexTestResult.classList.remove('hidden');
            elements.plexTestResult.innerHTML = `<div class="text-rose-400">${escapeHtml(res.error || 'Connection failed')}</div>`;
            showToast(res.error || 'Plex connection failed', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.testPlexBtn.disabled = false;
        elements.testPlexBtn.textContent = 'Test Plex Connection';
    }
}

async function handleSavePlexSettings() {
    const url = elements.plexUrlInput.value.trim();
    const token = elements.plexTokenInput.value.trim();
    const playerIp = elements.plexPlayerIpInput.value.trim();

    try {
        await api.saveSettings({
            media_provider: 'plex',
            plex_url: url,
            plex_token: token,
            plex_player_ip: playerIp,
        });
        state.settings.media_provider = 'plex';
        state.settings.plex_url = url;
        state.settings.plex_token = token;
        state.settings.plex_player_ip = playerIp;
        showToast('Plex settings saved', 'success');
        elements.settingsModal.classList.add('hidden');
        loadLibraryMedia();
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleSaveTimezone() {
    const tz = elements.timezoneSelect.value;
    try {
        await api.saveSettings({ app_timezone: tz });
        state.settings.app_timezone = tz;
        showToast(`Timezone saved: ${tz}`, 'success');
        updateClockPreviews();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function handleAutoDetectTimezone() {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
    elements.timezoneSelect.value = browserTz;
    handleSaveTimezone();
}

// --- Navigation & View Switching ---
function switchView(viewName) {
    state.activeView = viewName;
    elements.viewTabs.forEach(tab => {
        const isActive = tab.dataset.view === viewName;
        tab.classList.toggle('active', isActive);
        if (isActive) {
            tab.className = 'nav-pill view-tab active px-3.5 py-1 text-xs font-medium rounded-full transition-all text-white bg-[#1a1d27] shadow-sm flex items-center gap-1.5';
        } else {
            tab.className = 'nav-pill view-tab px-3.5 py-1 text-xs font-medium rounded-full transition-all text-slate-400 hover:text-white flex items-center gap-1.5';
        }
    });

    elements.browserView.classList.toggle('active', viewName === 'browser');
    elements.browserView.classList.toggle('hidden', viewName !== 'browser');

    elements.playlistsView.classList.toggle('active', viewName === 'playlists');
    elements.playlistsView.classList.toggle('hidden', viewName !== 'playlists');

    elements.timelineView.classList.toggle('active', viewName === 'timeline');
    elements.timelineView.classList.toggle('hidden', viewName !== 'timeline');

    if (viewName === 'playlists') {
        loadPlaylists();
    } else if (viewName === 'timeline') {
        loadTimeline();
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    elements.viewTabs.forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    elements.tvStatusPill.addEventListener('click', () => openSettingsModal('tv-tab'));
    elements.openSettingsBtn.addEventListener('click', () => openSettingsModal('tv-tab'));
    elements.bannerActionBtn.addEventListener('click', () => openSettingsModal('tv-tab'));
    elements.goToLibraryBtn.addEventListener('click', () => switchView('browser'));

    // Fast Responsive Search (150ms debounce)
    const onSearchInput = debounce(() => {
        const val = elements.searchInput.value.trim();
        elements.clearSearchBtn.classList.toggle('hidden', !val);
        state.searchQuery = val;
        loadLibraryMedia();
    }, 150);

    elements.searchInput.addEventListener('input', onSearchInput);
    elements.searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            elements.searchInput.value = '';
            elements.clearSearchBtn.classList.add('hidden');
            state.searchQuery = '';
            loadLibraryMedia();
        }
    });

    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.clearSearchBtn.classList.add('hidden');
        state.searchQuery = '';
        loadLibraryMedia();
    });

    // Category / Type Chips
    elements.filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.filterChips.forEach(c => {
                c.classList.remove('active');
                c.className = 'filter-chip chip px-3 py-1.5 text-xs font-medium rounded-md border border-white/[0.08] text-slate-400 hover:text-white transition';
            });
            chip.classList.add('active');
            chip.className = 'filter-chip chip active px-3 py-1.5 text-xs font-medium rounded-md border border-white/[0.08] text-slate-300 hover:text-white transition';
            state.mediaTypeFilter = chip.dataset.type || 'Movie,Series';
            state.categoryFilter = chip.dataset.category || '';
            loadLibraryMedia();
        });
    });

    elements.refreshMediaBtn.addEventListener('click', loadLibraryMedia);
    elements.backToLibraryBtn.addEventListener('click', () => {
        elements.seriesView.classList.add('hidden');
        loadLibraryMedia();
    });

    // Playlists View buttons
    elements.openCreatePlaylistBtn.addEventListener('click', () => {
        elements.playlistFormModalTitle.textContent = 'New Playlist';
        elements.playlistNameInput.value = '';
        elements.playlistDescInput.value = '';
        state.currentPlaylist = null;
        elements.playlistFormModal.classList.remove('hidden');
    });

    elements.createFirstPlaylistBtn?.addEventListener('click', () => {
        elements.playlistFormModalTitle.textContent = 'New Playlist';
        elements.playlistNameInput.value = '';
        elements.playlistDescInput.value = '';
        state.currentPlaylist = null;
        elements.playlistFormModal.classList.remove('hidden');
    });

    elements.backToPlaylistsBtn.addEventListener('click', () => {
        elements.playlistDetailView.classList.add('hidden');
        elements.playlistsMainContainer.classList.remove('hidden');
        loadPlaylists();
    });

    elements.openAddItemsToPlaylistBtn.addEventListener('click', openBrowseAddItemsModal);

    elements.editPlaylistInfoBtn.addEventListener('click', () => {
        if (!state.currentPlaylist) return;
        elements.playlistFormModalTitle.textContent = `Edit Playlist: ${state.currentPlaylist.name}`;
        elements.playlistNameInput.value = state.currentPlaylist.name || '';
        elements.playlistDescInput.value = state.currentPlaylist.description || '';
        elements.playlistFormModal.classList.remove('hidden');
    });

    elements.deletePlaylistBtn.addEventListener('click', async () => {
        if (!state.currentPlaylist) return;
        if (confirm(`Are you sure you want to delete playlist "${state.currentPlaylist.name}"?`)) {
            try {
                await api.deletePlaylist(state.currentPlaylist.id);
                showToast('Playlist deleted', 'success');
                elements.playlistDetailView.classList.add('hidden');
                elements.playlistsMainContainer.classList.remove('hidden');
                loadPlaylists();
            } catch (e) {
                showToast(e.message, 'error');
            }
        }
    });

    elements.playPlaylistNowBtn.addEventListener('click', async () => {
        if (!state.currentPlaylist) return;
        elements.playPlaylistNowBtn.disabled = true;
        elements.playPlaylistNowBtn.textContent = 'Starting...';
        try {
            await api.playPlaylistNow(state.currentPlaylist.id);
            showToast(`Playing playlist "${state.currentPlaylist.name}" on TV`, 'success');
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            elements.playPlaylistNowBtn.disabled = false;
            elements.playPlaylistNowBtn.textContent = 'Play on TV';
        }
    });

    elements.schedulePlaylistBtn.addEventListener('click', () => {
        if (!state.currentPlaylist) return;
        openScheduleModal({
            id: state.currentPlaylist.id,
            name: state.currentPlaylist.name,
            total_runtime_minutes: state.currentPlaylist.total_runtime_minutes,
            target_type: 'playlist',
        });
    });

    // Browse Add Items Modal (Search items to add to playlist)
    elements.closeBrowseAddItemsModal.addEventListener('click', () => elements.browseAddItemsModal.classList.add('hidden'));
    elements.closeBrowseAddItemsBtn.addEventListener('click', () => elements.browseAddItemsModal.classList.add('hidden'));
    elements.playlistSearchInput.addEventListener('input', (e) => {
        clearTimeout(state.playlistSearchDebounceTimer);
        state.playlistSearchDebounceTimer = setTimeout(() => {
            loadPlaylistPickerResults(e.target.value.trim());
        }, 150);
    });

    // Create / Edit Playlist Modal handlers
    elements.closePlaylistFormModal.addEventListener('click', () => elements.playlistFormModal.classList.add('hidden'));
    elements.cancelPlaylistFormBtn.addEventListener('click', () => elements.playlistFormModal.classList.add('hidden'));
    elements.savePlaylistFormBtn.addEventListener('click', async () => {
        const name = elements.playlistNameInput.value.trim();
        const desc = elements.playlistDescInput.value.trim();
        if (!name) {
            showToast('Please enter a playlist title', 'error');
            return;
        }

        try {
            if (state.currentPlaylist) {
                const updated = await api.updatePlaylist(state.currentPlaylist.id, { name, description: desc });
                state.currentPlaylist = updated;
                openPlaylistDetail(updated.id);
                showToast('Playlist updated', 'success');
            } else {
                await api.createPlaylist({ name, description: desc });
                showToast('Playlist created', 'success');
                loadPlaylists();
            }
            elements.playlistFormModal.classList.add('hidden');
        } catch (e) {
            showToast(e.message, 'error');
        }
    });

    // Add To Playlist Modal handlers
    elements.closeAddToPlaylistModal.addEventListener('click', () => elements.addToPlaylistModal.classList.add('hidden'));
    elements.cancelAddToPlaylistBtn.addEventListener('click', () => elements.addToPlaylistModal.classList.add('hidden'));
    elements.confirmAddToPlaylistBtn.addEventListener('click', handleConfirmAddToPlaylist);

    // Schedule Modal handlers
    elements.closeScheduleModal.addEventListener('click', () => elements.scheduleModal.classList.add('hidden'));
    elements.recurrenceToggleGroup.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => setRecurrenceFrequency(btn.dataset.freq));
    });
    elements.presetButtons.forEach(btn => btn.addEventListener('click', () => handlePresetClick(btn)));
    elements.confirmScheduleBtn.addEventListener('click', handleConfirmSchedule);
    elements.instantPlayBtn.addEventListener('click', handleInstantPlay);

    // Timeline Refresh
    elements.refreshTimelineBtn.addEventListener('click', loadTimeline);

    // Settings Modal handlers
    elements.closeSettingsModal.addEventListener('click', () => elements.settingsModal.classList.add('hidden'));
    elements.settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
    });

    // TV Type Toggles
    elements.tvTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTvType(btn.dataset.type));
    });

    // Media Provider Toggles
    elements.mediaProviderButtons.forEach(btn => {
        btn.addEventListener('click', () => switchMediaProvider(btn.dataset.provider));
    });

    // Android TV Setup Buttons
    elements.connectTvBtn.addEventListener('click', handleConnectTv);
    elements.saveTvSettingsBtn.addEventListener('click', handleSaveTvSettings);
    elements.verifyAuthBtn.addEventListener('click', handleConnectTv);
    elements.refreshAdbStatusBtn.addEventListener('click', updateTvStatusUI);
    elements.testWakeBtn.addEventListener('click', handleTestWake);
    elements.testSleepBtn.addEventListener('click', handleTestSleep);
    elements.testLaunchAppBtn.addEventListener('click', handleTestLaunchApp);

    // Samsung TV Setup Buttons
    elements.refreshSamsungStatusBtn?.addEventListener('click', () => {
        api.getSamsungStatus().then(renderSamsungStatusBox).catch(() => {});
    });
    elements.saveSamsungSettingsBtn?.addEventListener('click', handleSaveSamsungSettings);
    elements.samsungWakeBtn?.addEventListener('click', handleSamsungWake);
    elements.samsungLaunchBtn?.addEventListener('click', handleSamsungLaunch);
    elements.samsungSleepBtn?.addEventListener('click', handleSamsungSleep);

    // Jellyfin Setup Buttons
    elements.testJfBtn.addEventListener('click', handleTestJellyfin);
    elements.saveJfSettingsBtn.addEventListener('click', handleSaveJfSettings);

    // Plex Setup Buttons
    elements.testPlexBtn?.addEventListener('click', handleTestPlex);
    elements.savePlexSettingsBtn?.addEventListener('click', handleSavePlexSettings);

    // Timezone Setup Buttons
    elements.saveTimezoneBtn.addEventListener('click', handleSaveTimezone);
    elements.autoDetectTzBtn.addEventListener('click', handleAutoDetectTimezone);
    elements.timezoneSelect.addEventListener('change', updateClockPreviews);

    // Keep live clocks accurate
    setInterval(updateClockPreviews, 1000);
}

// Start application on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
