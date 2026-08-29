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
    scheduleAutoTurnOff: document.getElementById('scheduleAutoTurnOff'),
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
    
    // TV Setup Fields
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

    // Jellyfin Setup Fields
    jfUrlInput: document.getElementById('jfUrlInput'),
    jfKeyInput: document.getElementById('jfKeyInput'),
    jfUserSelect: document.getElementById('jfUserSelect'),
    testJfBtn: document.getElementById('testJfBtn'),
    saveJfSettingsBtn: document.getElementById('saveJfSettingsBtn'),

    // Timezone Setup Fields
    timezoneSelect: document.getElementById('timezoneSelect'),
    browserTzHint: document.getElementById('browserTzHint'),
    browserClockPreview: document.getElementById('browserClockPreview'),
    serverClockPreview: document.getElementById('serverClockPreview'),
    saveTimezoneBtn: document.getElementById('saveTimezoneBtn'),
    autoDetectTzBtn: document.getElementById('autoDetectTzBtn'),

    toastContainer: document.getElementById('toastContainer'),
};

// --- Helper & Utility Functions ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
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

    async getTvStatus() {
        const res = await fetch('/api/tv/status');
        if (!res.ok) throw new Error('Failed to check TV status');
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
        
        elements.tvIpInput.value = settings.tv_ip || '';
        elements.tvPortInput.value = settings.adb_port || 5555;
        elements.tvNameInput.value = settings.tv_device_name || '';
        elements.jfUrlInput.value = settings.jellyfin_url || '';
        elements.jfKeyInput.value = settings.jellyfin_api_key || '';

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
            elements.headerStatusDot.className = 'status-led connected';
            elements.headerStatusLabel.textContent = status.device_name || 'TV Active';
        } else if (status.adb_reachable) {
            elements.headerStatusDot.className = 'status-led connected';
            elements.headerStatusLabel.textContent = 'TV Ready (ADB)';
        } else if (status.adb_state === 'unauthorized') {
            elements.headerStatusDot.className = 'status-led partial';
            elements.headerStatusLabel.textContent = 'Prompt on TV';
        } else if (!status.configured_tv_ip) {
            elements.headerStatusDot.className = 'status-led';
            elements.headerStatusLabel.textContent = 'Setup TV';
        } else {
            elements.headerStatusDot.className = 'status-led offline';
            elements.headerStatusLabel.textContent = 'TV Offline';
        }

        if (!status.configured_tv_ip || !state.settings.jellyfin_api_key) {
            elements.setupBanner.classList.remove('hidden');
            if (!status.configured_tv_ip) {
                elements.bannerMsg.textContent = 'Enter your TV IP address in Settings to enable automated wake-up.';
            } else {
                elements.bannerMsg.textContent = 'Configure your Jellyfin API key to load your media library.';
            }
        } else {
            elements.setupBanner.classList.add('hidden');
        }

        renderAdbStatusBox(status);
    } catch (err) {
        elements.headerStatusDot.className = 'status-led offline';
        elements.headerStatusLabel.textContent = 'Server Offline';
    }
}

function renderAdbStatusBox(status) {
    const st = status.adb_state || 'offline';
    elements.adbBoxDot.className = `status-led ${status.adb_reachable ? 'connected' : (st === 'unauthorized' ? 'partial' : 'offline')}`;
    
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
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Fetching media from library...</p>
        </div>
    `;

    try {
        const items = await api.fetchMedia(state.searchQuery, state.mediaTypeFilter, state.categoryFilter);
        renderMediaGrid(items);
    } catch (err) {
        elements.mediaContainer.innerHTML = `
            <div class="empty-state">
                <h3>Failed to load library</h3>
                <p>${escapeHtml(err.message)}</p>
                <button class="btn btn-primary btn-sm" onclick="openSettingsModal('jellyfin-tab')">Check Jellyfin Settings</button>
            </div>
        `;
    }
}

function renderMediaGrid(items) {
    if (!items || items.length === 0) {
        elements.mediaContainer.innerHTML = `
            <div class="empty-state">
                <h3>No media found</h3>
                <p>Try searching for a different title or select a different filter.</p>
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
        <div class="media-card" data-id="${item.id}" data-type="${item.type}" data-name="${escapeHtml(item.name)}" data-tag="${item.image_tag || ''}" data-year="${item.year || ''}" data-runtime="${item.runtime_minutes || ''}" data-overview="${escapeHtml(item.overview || '')}">
            <div class="poster-wrapper">
                ${item.image_tag 
                    ? `<img class="poster-img" src="${getImageUrl(item.id, item.image_tag)}" alt="${escapeHtml(item.name)}" loading="lazy">` 
                    : `<div class="poster-fallback">${item.type === 'Movie' ? 'Movie' : 'Series'}</div>`}
                <span class="media-type-badge">${badgeLabel}</span>
            </div>
            <div class="card-content">
                <div class="card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                <div class="card-meta">
                    ${item.year ? `<span>${item.year}</span>` : ''}
                    ${runtimeText ? `<span>· ${runtimeText}</span>` : ''}
                </div>
                <div class="card-actions-row">
                    <button class="card-btn action-schedule-btn">Schedule</button>
                    <button class="card-btn secondary action-playlist-btn">+ Playlist</button>
                </div>
            </div>
        </div>
    `;}).join('');

    elements.mediaContainer.innerHTML = `<div class="media-grid">${cardsHtml}</div>`;

    // Attach click listeners to cards
    elements.mediaContainer.querySelectorAll('.media-card').forEach(card => {
        card.querySelector('.poster-wrapper').addEventListener('click', (e) => {
            e.stopPropagation();
            const data = card.dataset;
            if (data.type === 'Series') {
                openSeriesDrilldown(data);
            } else {
                openScheduleModal({ ...data, target_type: 'media' });
            }
        });

        card.querySelector('.card-title').addEventListener('click', (e) => {
            e.stopPropagation();
            const data = card.dataset;
            if (data.type === 'Series') {
                openSeriesDrilldown(data);
            } else {
                openScheduleModal({ ...data, target_type: 'media' });
            }
        });

        card.querySelector('.action-schedule-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const data = card.dataset;
            if (data.type === 'Series') {
                openSeriesDrilldown(data);
            } else {
                openScheduleModal({ ...data, target_type: 'media' });
            }
        });

        card.querySelector('.action-playlist-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const data = card.dataset;
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
        ${seriesData.tag 
            ? `<img class="hero-poster" src="${getImageUrl(seriesData.id, seriesData.tag)}" alt="${escapeHtml(seriesData.name)}">` 
            : ''}
        <div class="hero-info">
            <h2>${escapeHtml(seriesData.name)}</h2>
            <div class="hero-meta">${seriesData.year || ''} · TV Series</div>
            <p class="hero-overview">${escapeHtml(seriesData.overview || '')}</p>
        </div>
    `;

    elements.seasonsSlider.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading seasons...</p></div>';
    elements.episodesList.innerHTML = '';

    try {
        const seasons = await api.getSeasons(seriesData.id);
        state.currentSeasons = seasons;

        if (!seasons || seasons.length === 0) {
            elements.seasonsSlider.innerHTML = '<p class="empty-state">No seasons found.</p>';
            return;
        }

        elements.seasonsSlider.innerHTML = seasons.map((season, idx) => `
            <button class="season-btn ${idx === 0 ? 'active' : ''}" data-id="${season.id}" data-num="${season.season_number || 1}">
                ${escapeHtml(season.name || `Season ${season.season_number || 1}`)}
            </button>
        `).join('');

        elements.seasonsSlider.querySelectorAll('.season-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                elements.seasonsSlider.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadSeasonEpisodes(seriesData.id, btn.dataset.id);
            });
        });

        loadSeasonEpisodes(seriesData.id, seasons[0].id);

    } catch (err) {
        elements.seasonsSlider.innerHTML = '<p class="empty-state">Failed to load seasons.</p>';
        showToast('Failed to load seasons', 'error');
    }
}

async function loadSeasonEpisodes(seriesId, seasonId) {
    elements.episodesList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading episodes...</p>
        </div>
    `;

    try {
        const episodes = await api.getEpisodes(seriesId, seasonId);
        
        if (!episodes || episodes.length === 0) {
            elements.episodesList.innerHTML = '<p class="empty-state">No episodes in this season.</p>';
            return;
        }

        elements.episodesList.innerHTML = episodes.map(ep => {
            const runtimeText = formatRuntime(ep.runtime_minutes);
            const epCode = `S${ep.season_number || 1}E${ep.episode_number || 1}`;
            return `
            <div class="episode-card" data-id="${ep.id}" data-name="${escapeHtml(state.currentSeries.name)} - ${epCode}: ${escapeHtml(ep.name)}" data-tag="${ep.image_tag || ''}" data-type="Episode" data-runtime="${ep.runtime_minutes || ''}">
                <div class="ep-num-box">
                    E${ep.episode_number || '1'}
                </div>
                <div class="ep-info">
                    <div class="ep-title">${escapeHtml(ep.name)}</div>
                    <div class="ep-meta">${runtimeText ? `${runtimeText}` : ''} ${ep.overview ? `· ${escapeHtml(ep.overview.slice(0, 120))}...` : ''}</div>
                </div>
                <div class="ep-actions-group">
                    <button class="btn btn-sm btn-primary action-schedule-ep">Schedule</button>
                    <button class="btn btn-sm btn-secondary action-playlist-ep">+ Playlist</button>
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
        elements.episodesList.innerHTML = '<p class="empty-state">Failed to load episodes.</p>';
        showToast('Failed to load episodes', 'error');
    }
}

// --- Playlists View Management ---
async function loadPlaylists() {
    elements.playlistDetailView.classList.add('hidden');
    elements.playlistsMainContainer.classList.remove('hidden');
    elements.playlistsGrid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading playlists...</p></div>';

    try {
        const playlists = await api.getPlaylists();
        state.playlists = playlists;
        renderPlaylistsGrid(playlists);
        updatePlaylistsCountBadge(playlists.length);
    } catch (err) {
        elements.playlistsGrid.innerHTML = `<p class="empty-state">Failed to load playlists: ${escapeHtml(err.message)}</p>`;
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
        <div class="playlist-card" data-id="${pl.id}">
            <div class="playlist-card-header">
                <div class="playlist-card-title">${escapeHtml(pl.name)}</div>
            </div>
            <p class="playlist-card-desc">${escapeHtml(pl.description || 'No description.')}</p>
            <div class="playlist-card-meta">
                <span class="playlist-meta-badge">${pl.items_count} item${pl.items_count === 1 ? '' : 's'}</span>
                <span>${totalDuration}</span>
            </div>
            <div class="playlist-card-actions">
                <button class="btn btn-sm btn-primary action-card-edit" data-id="${pl.id}">Edit</button>
                <button class="btn btn-sm btn-secondary action-card-play" data-id="${pl.id}">Play</button>
                <button class="btn btn-sm btn-secondary action-card-sched" data-id="${pl.id}">Schedule</button>
                <button class="btn btn-sm btn-danger action-card-del" data-id="${pl.id}">Delete</button>
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
                showToast(`Playing "${pl?.name || 'Playlist'}" on TV!`, 'success');
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
    elements.playlistHero.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading playlist...</p></div>';
    elements.playlistItemsList.innerHTML = '';

    try {
        const pl = await api.getPlaylist(playlistId);
        state.currentPlaylist = pl;

        const totalDuration = formatRuntime(pl.total_runtime_minutes) || '0m';

        elements.playlistHero.innerHTML = `
            <h2>${escapeHtml(pl.name)}</h2>
            <p>${escapeHtml(pl.description || 'No description.')}</p>
            <div class="playlist-hero-stats">
                <span class="playlist-hero-stat-badge">${pl.items_count} item${pl.items_count === 1 ? '' : 's'}</span>
                <span class="playlist-hero-stat-badge">Total Runtime: ${totalDuration}</span>
            </div>
        `;

        renderPlaylistItemsList(pl.items);

    } catch (err) {
        showToast(err.message, 'error');
        elements.playlistHero.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    }
}

function renderPlaylistItemsList(items) {
    if (!items || items.length === 0) {
        elements.playlistItemsList.innerHTML = `
            <div class="empty-state">
                <h3>Playlist is Empty</h3>
                <p>Click "Add Media" above to select movies or episodes from your library.</p>
            </div>
        `;
        return;
    }

    elements.playlistItemsList.innerHTML = items.map((item, idx) => {
        const itemRuntime = formatRuntime(item.runtime_minutes);
        const isEpisode = item.item_type === 'Episode' || (item.name && item.name.includes(' - S'));
        const orderPadded = String(idx + 1).padStart(2, '0');
        let itemPosterHtml = '';
        if (item.image_tag) {
            itemPosterHtml = `<img class="playlist-item-poster" src="${getImageUrl(item.jellyfin_item_id, item.image_tag)}" alt="${escapeHtml(item.name)}">`;
        } else if (isEpisode) {
            itemPosterHtml = `<div class="playlist-item-fallback ep">${escapeHtml(extractEpLabel(item.name))}</div>`;
        } else {
            itemPosterHtml = `<div class="playlist-item-fallback">${item.item_type === 'Movie' ? 'Movie' : 'Show'}</div>`;
        }

        return `
        <div class="playlist-item-row" data-id="${item.id}" data-idx="${idx}">
            <div class="playlist-item-order">${orderPadded}</div>
            ${itemPosterHtml}
            <div class="playlist-item-info">
                <div class="playlist-item-title">${escapeHtml(item.name)}</div>
                <div class="playlist-item-meta">${item.item_type || 'Media'} ${itemRuntime ? `· ${itemRuntime}` : ''}</div>
            </div>
            <div class="playlist-item-controls">
                <button class="btn-icon-subtle move-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-icon-subtle move-down" title="Move Down" ${idx === items.length - 1 ? 'disabled' : ''}>▼</button>
                <button class="btn-icon-subtle delete" title="Remove">✕</button>
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
    elements.playlistPickerContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Searching library...</p></div>';

    try {
        const items = await api.fetchMedia(query, 'Movie,Series');
        if (!items || items.length === 0) {
            elements.playlistPickerContainer.innerHTML = '<p class="empty-state">No media found.</p>';
            return;
        }

        elements.playlistPickerContainer.innerHTML = items.map(item => {
            const runtimeText = formatRuntime(item.runtime_minutes);
            return `
            <div class="picker-item-row" data-id="${item.id}" data-type="${item.type}" data-name="${escapeHtml(item.name)}" data-tag="${item.image_tag || ''}" data-runtime="${item.runtime_minutes || ''}">
                <div class="picker-item-left">
                    ${item.image_tag 
                        ? `<img class="picker-item-poster" src="${getImageUrl(item.id, item.image_tag)}" alt="${escapeHtml(item.name)}">` 
                        : `<div class="picker-item-fallback">${item.type === 'Movie' ? 'Movie' : 'Series'}</div>`}
                    <div>
                        <div class="picker-item-title">${escapeHtml(item.name)}</div>
                        <div class="picker-item-meta">${item.type} ${item.year ? `(${item.year})` : ''} ${runtimeText ? `· ${runtimeText}` : ''}</div>
                    </div>
                </div>
                <button class="btn btn-sm btn-primary add-to-active-pl-btn">+ Add</button>
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
                    btn.textContent = '✓ Added';
                    btn.classList.replace('btn-primary', 'btn-secondary');
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
        elements.playlistPickerContainer.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    }
}

// --- Add To Playlist Modal (from library cards) ---
async function openAddToPlaylistModal(mediaData) {
    state.targetForPlaylist = mediaData;
    const runtimeFormatted = formatRuntime(mediaData.runtime);

    const isEpisode = mediaData.type === 'Episode' || mediaData.item_type === 'Episode' || (mediaData.name && mediaData.name.includes(' - S'));
    let posterHtml = '';
    if (mediaData.tag) {
        posterHtml = `<img class="modal-media-poster" src="${getImageUrl(mediaData.id, mediaData.tag)}" alt="${escapeHtml(mediaData.name)}">`;
    } else if (isEpisode) {
        posterHtml = `<div class="modal-media-fallback ep-badge">${escapeHtml(extractEpLabel(mediaData.name))}</div>`;
    } else {
        posterHtml = `<div class="modal-media-fallback">${mediaData.type === 'Movie' ? 'Movie' : 'Series'}</div>`;
    }

    elements.addToPlaylistMediaCard.innerHTML = `
        ${posterHtml}
        <div class="modal-media-info">
            <h4>${escapeHtml(mediaData.name)}</h4>
            <p>${mediaData.type || 'Media'} ${runtimeFormatted ? `· ${runtimeFormatted}` : ''}</p>
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
    state.selectedMedia = targetData;
    const isPlaylist = targetData.target_type === 'playlist';
    const isEpisode = targetData.type === 'Episode' || targetData.item_type === 'Episode' || (targetData.name && targetData.name.includes(' - S'));
    const runtimeFormatted = formatRuntime(targetData.runtime || targetData.total_runtime_minutes);

    let posterHtml = '';
    if (targetData.tag) {
        posterHtml = `<img class="modal-media-poster" src="${getImageUrl(targetData.id, targetData.tag)}" alt="${escapeHtml(targetData.name)}">`;
    } else if (isEpisode) {
        posterHtml = `<div class="modal-media-fallback ep-badge">${escapeHtml(extractEpLabel(targetData.name))}</div>`;
    } else if (isPlaylist) {
        posterHtml = `<div class="modal-media-fallback">Playlist</div>`;
    } else {
        posterHtml = `<div class="modal-media-fallback">${targetData.type === 'Movie' ? 'Movie' : 'Series'}</div>`;
    }

    elements.modalMediaCard.innerHTML = `
        ${posterHtml}
        <div class="modal-media-info">
            <h4>${escapeHtml(targetData.name)}</h4>
            <p>${isPlaylist ? 'Custom Playlist' : (targetData.type || 'Media')} ${runtimeFormatted ? `· ${runtimeFormatted}` : ''}</p>
        </div>
    `;

    setRecurrenceFrequency('once');

    const defaultTime = new Date();
    defaultTime.setMinutes(defaultTime.getMinutes() + 15);
    elements.scheduleDatetime.value = toLocalDatetimeString(defaultTime);
    
    const defH = String(defaultTime.getHours()).padStart(2, '0');
    const defM = String(defaultTime.getMinutes()).padStart(2, '0');
    elements.scheduleTimeOfDay.value = `${defH}:${defM}`;
    elements.scheduleAutoTurnOff.checked = true;

    elements.scheduleModal.classList.remove('hidden');
}

function setRecurrenceFrequency(freq) {
    elements.recurrenceToggleGroup.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.freq === freq);
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
    const autoTurnOff = elements.scheduleAutoTurnOff.checked;

    let scheduledTime = null;
    let daysOfWeek = null;
    let timeOfDay = null;

    if (scheduleType === 'once') {
        const dtVal = elements.scheduleDatetime.value;
        if (!dtVal) {
            showToast('Please select date and time', 'error');
            return;
        }
        scheduledTime = new Date(dtVal).toISOString();
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
    elements.confirmScheduleBtn.textContent = 'Scheduling...';

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
        auto_turn_off: autoTurnOff,
    };

    try {
        await api.createSchedule(payload);
        showToast('Playback scheduled successfully', 'success');
        elements.scheduleModal.classList.add('hidden');
        switchView('timeline');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.confirmScheduleBtn.disabled = false;
        elements.confirmScheduleBtn.textContent = 'Schedule Job';
    }
}

async function handleInstantPlay() {
    if (!state.selectedMedia) return;
    const isPlaylist = state.selectedMedia.target_type === 'playlist';
    const autoTurnOff = elements.scheduleAutoTurnOff.checked;

    elements.instantPlayBtn.disabled = true;
    elements.instantPlayBtn.textContent = 'Starting...';

    try {
        if (isPlaylist) {
            await api.playPlaylistNow(state.selectedMedia.id);
        } else {
            await api.playNow([state.selectedMedia.id], autoTurnOff);
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
    elements.timelineList.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading scheduled jobs...</p></div>';

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
        elements.timelineList.innerHTML = `<p class="empty-state">Failed to load schedule: ${escapeHtml(err.message)}</p>`;
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
            timelinePosterHtml = `<img class="timeline-poster" src="${getImageUrl(job.jellyfin_item_id, job.image_tag)}" alt="${escapeHtml(job.name)}">`;
        } else if (isEpisode) {
            timelinePosterHtml = `<div class="timeline-fallback ep">${escapeHtml(extractEpLabel(job.name))}</div>`;
        } else {
            timelinePosterHtml = `<div class="timeline-fallback">${isPlaylist ? 'Playlist' : 'Media'}</div>`;
        }

        return `
        <div class="timeline-card ${job.status}" data-id="${job.id}">
            ${timelinePosterHtml}
            
            <div class="timeline-details">
                <div class="timeline-header">
                    <h4>${escapeHtml(job.name)}</h4>
                    <span class="status-badge ${job.status}">${job.status}</span>
                </div>
                <div class="timeline-meta">
                    <span class="schedule-time-badge">${scheduleLabel}</span>
                    <span class="type-pill">${isPlaylist ? 'Playlist' : (job.item_type || 'Media')}</span>
                    ${job.auto_turn_off ? `<span class="type-pill">Auto-sleep</span>` : ''}
                </div>
                ${job.error_message ? `<div style="color: var(--status-danger); font-size: 0.75rem; margin-top: 0.25rem;">${escapeHtml(job.error_message)}</div>` : ''}
            </div>

            <div class="timeline-actions">
                <button class="btn btn-sm btn-danger cancel-job-btn" data-id="${job.id}">
                    ${job.status === 'pending' ? 'Cancel' : 'Delete'}
                </button>
            </div>
        </div>
    `;}).join('');

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
function openSettingsModal(tabName = 'tv-tab') {
    elements.settingsModal.classList.remove('hidden');
    switchSettingsTab(tabName);
    updateClockPreviews();
}

function switchSettingsTab(tabName) {
    elements.settingsTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    elements.settingsPanels.forEach(panel => panel.classList.toggle('active', panel.id === tabName));
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
            tv_ip: ip,
            adb_port: port,
            tv_device_name: name,
        });
        showToast('TV settings saved', 'success');
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestWake() {
    try {
        const res = await api.testWake();
        showToast(res.message || 'Wake command sent', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestSleep() {
    try {
        const res = await api.testSleep();
        showToast(res.message || 'Sleep command sent', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestLaunchApp() {
    try {
        const res = await api.testLaunch();
        showToast(res.message || 'Launch Jellyfin sent', 'success');
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
        elements.testJfBtn.textContent = 'Test Connection & Fetch Users';
    }
}

async function handleSaveJfSettings() {
    const url = elements.jfUrlInput.value.trim();
    const apiKey = elements.jfKeyInput.value.trim();
    const userId = elements.jfUserSelect.value;

    try {
        await api.saveSettings({
            jellyfin_url: url,
            jellyfin_api_key: apiKey,
            jellyfin_user_id: userId,
        });
        showToast('Jellyfin settings saved', 'success');
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
    elements.viewTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.view === viewName));
    elements.browserView.classList.toggle('active', viewName === 'browser');
    elements.playlistsView.classList.toggle('active', viewName === 'playlists');
    elements.timelineView.classList.toggle('active', viewName === 'timeline');

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
            elements.filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
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
        elements.playlistFormModalTitle.textContent = `Edit Playlist "${state.currentPlaylist.name}"`;
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
            showToast(`Playing playlist "${state.currentPlaylist.name}" on TV!`, 'success');
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
            showToast('Please enter a playlist name', 'error');
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

    // TV Setup Buttons
    elements.connectTvBtn.addEventListener('click', handleConnectTv);
    elements.saveTvSettingsBtn.addEventListener('click', handleSaveTvSettings);
    elements.verifyAuthBtn.addEventListener('click', handleConnectTv);
    elements.refreshAdbStatusBtn.addEventListener('click', updateTvStatusUI);
    elements.testWakeBtn.addEventListener('click', handleTestWake);
    elements.testSleepBtn.addEventListener('click', handleTestSleep);
    elements.testLaunchAppBtn.addEventListener('click', handleTestLaunchApp);

    // Jellyfin Setup Buttons
    elements.testJfBtn.addEventListener('click', handleTestJellyfin);
    elements.saveJfSettingsBtn.addEventListener('click', handleSaveJfSettings);

    // Timezone Setup Buttons
    elements.saveTimezoneBtn.addEventListener('click', handleSaveTimezone);
    elements.autoDetectTzBtn.addEventListener('click', handleAutoDetectTimezone);
}

// Start application on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
