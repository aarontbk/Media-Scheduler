// --- Application State ---
const state = {
    activeView: 'browser', // 'browser' | 'timeline'
    mediaTypeFilter: 'Movie,Series',
    searchQuery: '',
    selectedMedia: null,
    currentSeries: null,
    currentSeasons: [],
    settings: {
        jellyfin_url: '',
        jellyfin_api_key: '',
        jellyfin_user_id: '',
        tv_device_name: '',
        tv_ip: '',
        adb_port: 5555,
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

    // Navigation
    viewTabs: document.querySelectorAll('.view-tab'),
    browserView: document.getElementById('browserView'),
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

    // Schedule Modal
    scheduleModal: document.getElementById('scheduleModal'),
    closeScheduleModal: document.getElementById('closeScheduleModal'),
    modalMediaCard: document.getElementById('modalMediaCard'),
    scheduleDatetime: document.getElementById('scheduleDatetime'),
    presetButtons: document.querySelectorAll('.btn-preset'),
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

    // Jellyfin Setup Fields
    jfUrlInput: document.getElementById('jfUrlInput'),
    jfKeyInput: document.getElementById('jfKeyInput'),
    jfUserSelect: document.getElementById('jfUserSelect'),
    testJfBtn: document.getElementById('testJfBtn'),
    saveJfSettingsBtn: document.getElementById('saveJfSettingsBtn'),

    toastContainer: document.getElementById('toastContainer'),
};

// --- Toast Feedback ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- Helper Functions ---
function getImageUrl(itemId, tag) {
    if (!itemId) return '';
    let url = `/api/image/${itemId}`;
    if (tag) url += `?tag=${tag}`;
    return url;
}

function formatDatetime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric'
    }) + ' ' + d.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit'
    });
}

function toLocalDatetimeString(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

    async testLaunch() {
        const res = await fetch('/api/tv/test-launch', { method: 'POST' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Launch app failed');
        }
        return await res.json();
    },

    async fetchMedia(query = '', type = 'Movie,Series') {
        const params = new URLSearchParams();
        if (query.trim()) params.append('q', query.trim());
        if (type) params.append('type', type);
        
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
        if (!res.ok) throw new Error('Failed to cancel job');
        return true;
    },

    async playNow(itemIds) {
        const res = await fetch('/api/play-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: Array.isArray(itemIds) ? itemIds : [itemIds] }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Immediate playback failed');
        }
        return await res.json();
    },
};

// --- Initialization & Status Updating ---
async function initApp() {
    setupEventListeners();
    await loadSettingsAndStatus();
    loadLibraryMedia();
    loadTimeline();
    
    // Background polling for TV status and Timeline
    setInterval(updateTvStatusUI, 20000);
    setInterval(loadTimeline, 45000);
}

async function loadSettingsAndStatus() {
    try {
        const settings = await api.getSettings();
        state.settings = settings;
        
        // Populate settings form inputs
        elements.tvIpInput.value = settings.tv_ip || '';
        elements.tvPortInput.value = settings.adb_port || 5555;
        elements.tvNameInput.value = settings.tv_device_name || '';
        elements.jfUrlInput.value = settings.jellyfin_url || '';
        elements.jfKeyInput.value = settings.jellyfin_api_key || '';

        // Populate users dropdown if available
        if (settings.jellyfin_users && settings.jellyfin_users.length > 0) {
            populateUsersDropdown(settings.jellyfin_users, settings.jellyfin_user_id);
        }

        updateTvStatusUI();
    } catch (err) {
        console.warn('Initial settings load warning:', err);
    }
}

async function updateTvStatusUI() {
    try {
        const status = await api.getTvStatus();
        state.tvStatus = status;

        // 1. Header Status Pill
        if (status.session_found && status.is_active) {
            elements.headerStatusDot.className = 'status-dot connected';
            elements.headerStatusLabel.textContent = status.device_name || 'TV Online';
        } else if (status.adb_reachable) {
            elements.headerStatusDot.className = 'status-dot partial';
            elements.headerStatusLabel.textContent = 'TV Paired (ADB)';
        } else if (status.adb_state === 'unauthorized') {
            elements.headerStatusDot.className = 'status-dot partial';
            elements.headerStatusLabel.textContent = 'Prompt on TV';
        } else if (!status.configured_tv_ip) {
            elements.headerStatusDot.className = 'status-dot';
            elements.headerStatusLabel.textContent = 'Setup TV';
        } else {
            elements.headerStatusDot.className = 'status-dot offline';
            elements.headerStatusLabel.textContent = 'TV Offline';
        }

        // 2. Banner configuration alert
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

        // 3. Settings Modal Status Box
        renderAdbStatusBox(status);

    } catch (err) {
        elements.headerStatusDot.className = 'status-dot offline';
        elements.headerStatusLabel.textContent = 'Server Offline';
    }
}

function renderAdbStatusBox(status) {
    const state = status.adb_state || 'offline';
    elements.adbBoxDot.className = `status-dot ${status.adb_reachable ? 'connected' : (state === 'unauthorized' ? 'partial' : 'offline')}`;
    
    if (state === 'device') {
        elements.adbBoxTitle.textContent = '🟢 TV Connected & Authorized';
        elements.adbBoxMessage.textContent = status.adb_message || 'The TV is authorized and ready for automated wake-up and playback.';
        elements.tvPromptCallout.classList.add('hidden');
    } else if (state === 'unauthorized') {
        elements.adbBoxTitle.textContent = '🟡 Authorization Required';
        elements.adbBoxMessage.textContent = 'Connection initiated, but waiting for permission on the TV.';
        elements.tvPromptCallout.classList.remove('hidden');
    } else if (state === 'cannot_connect') {
        elements.adbBoxTitle.textContent = '🔴 Cannot Reach TV';
        elements.adbBoxMessage.textContent = status.adb_message;
        elements.tvPromptCallout.classList.add('hidden');
    } else if (state === 'not_configured') {
        elements.adbBoxTitle.textContent = '⚙️ TV IP Not Configured';
        elements.adbBoxMessage.textContent = 'Enter your TV IP address below and click Connect.';
        elements.tvPromptCallout.classList.add('hidden');
    } else {
        elements.adbBoxTitle.textContent = '🔴 TV Offline';
        elements.adbBoxMessage.textContent = status.adb_message || 'Make sure the TV is powered on and connected to the network.';
        elements.tvPromptCallout.classList.add('hidden');
    }
}

function populateUsersDropdown(users, selectedId) {
    elements.jfUserSelect.innerHTML = users.map(u => `
        <option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>
            ${u.name} ${u.is_admin ? '(Admin)' : ''}
        </option>
    `).join('');
}

// --- Library Media Loading & Search ---
async function loadLibraryMedia() {
    elements.seriesView.classList.add('hidden');
    elements.mediaContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Fetching movies & TV shows...</p>
        </div>
    `;

    try {
        const items = await api.fetchMedia(state.searchQuery, state.mediaTypeFilter);
        renderMediaGrid(items);
    } catch (err) {
        elements.mediaContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Failed to load library</h3>
                <p>${err.message}</p>
                <button class="btn btn-primary btn-sm" onclick="openSettingsModal('jellyfin-tab')">Check Jellyfin Settings</button>
            </div>
        `;
    }
}

function renderMediaGrid(items) {
    if (!items || items.length === 0) {
        elements.mediaContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No media found</h3>
                <p>Try searching for a different title or select 'All' filter.</p>
            </div>
        `;
        return;
    }

    const cardsHtml = items.map(item => `
        <div class="media-card" data-id="${item.id}" data-type="${item.type}" data-name="${escapeHtml(item.name)}" data-tag="${item.image_tag || ''}" data-year="${item.year || ''}" data-runtime="${item.runtime_minutes || ''}" data-overview="${escapeHtml(item.overview || '')}">
            <div class="poster-wrapper">
                ${item.image_tag 
                    ? `<img class="poster-img" src="${getImageUrl(item.id, item.image_tag)}" alt="${escapeHtml(item.name)}" loading="lazy">` 
                    : `<div class="poster-fallback">${item.type === 'Movie' ? '🎬' : '📺'}</div>`}
                <span class="media-type-badge">${item.type === 'Movie' ? 'Movie' : 'Series'}</span>
            </div>
            <div class="card-content">
                <div class="card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                <div class="card-meta">
                    ${item.year ? `<span>${item.year}</span>` : ''}
                    ${item.runtime_minutes ? `<span>• ${item.runtime_minutes}m</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    elements.mediaContainer.innerHTML = `<div class="media-grid">${cardsHtml}</div>`;

    // Attach click listeners to cards
    elements.mediaContainer.querySelectorAll('.media-card').forEach(card => {
        card.addEventListener('click', () => {
            const data = card.dataset;
            if (data.type === 'Series') {
                openSeriesDrilldown(data);
            } else {
                openScheduleModal(data);
            }
        });
    });
}

// --- Series Drill-down View ---
async function openSeriesDrilldown(seriesData) {
    state.currentSeries = seriesData;
    elements.mediaContainer.innerHTML = '';
    elements.seriesView.classList.remove('hidden');

    // Render Hero Info
    elements.seriesHero.innerHTML = `
        ${seriesData.tag 
            ? `<img class="hero-poster" src="${getImageUrl(seriesData.id, seriesData.tag)}" alt="${seriesData.name}">` 
            : ''}
        <div class="hero-details">
            <h2>${seriesData.name} ${seriesData.year ? `(${seriesData.year})` : ''}</h2>
            <p>${seriesData.overview || 'TV Series'}</p>
        </div>
    `;

    elements.seasonsSlider.innerHTML = '<div class="spinner"></div>';
    elements.episodesList.innerHTML = '';

    try {
        const seasons = await api.getSeasons(seriesData.id);
        state.currentSeasons = seasons;

        if (!seasons || seasons.length === 0) {
            elements.seasonsSlider.innerHTML = '<p class="form-hint">No seasons found.</p>';
            return;
        }

        elements.seasonsSlider.innerHTML = seasons.map((s, idx) => `
            <button class="season-tab ${idx === 0 ? 'active' : ''}" data-season-id="${s.id}">
                ${escapeHtml(s.name)}
            </button>
        `).join('');

        elements.seasonsSlider.querySelectorAll('.season-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                elements.seasonsSlider.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                loadSeasonEpisodes(seriesData.id, tab.dataset.seasonId);
            });
        });

        // Load first season episodes
        loadSeasonEpisodes(seriesData.id, seasons[0].id);

    } catch (err) {
        showToast('Failed to load seasons', 'error');
        elements.seasonsSlider.innerHTML = '<p class="form-hint">Error loading seasons.</p>';
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

        elements.episodesList.innerHTML = episodes.map(ep => `
            <div class="episode-card" data-id="${ep.id}" data-name="${escapeHtml(state.currentSeries.name)} - S${ep.season_number || 1}E${ep.episode_number || 1}: ${escapeHtml(ep.name)}" data-tag="${ep.image_tag || state.currentSeries.tag || ''}" data-type="Episode" data-runtime="${ep.runtime_minutes || ''}">
                <div class="ep-num-box">
                    E${ep.episode_number || '1'}
                </div>
                <div class="ep-info">
                    <div class="ep-title">${escapeHtml(ep.name)}</div>
                    <div class="ep-meta">${ep.runtime_minutes ? `${ep.runtime_minutes} mins` : ''} ${ep.overview ? `• ${escapeHtml(ep.overview.slice(0, 100))}...` : ''}</div>
                </div>
                <button class="ep-action-btn">Schedule</button>
            </div>
        `).join('');

        elements.episodesList.querySelectorAll('.episode-card').forEach(card => {
            card.addEventListener('click', () => {
                openScheduleModal(card.dataset);
            });
        });

    } catch (err) {
        elements.episodesList.innerHTML = '<p class="empty-state">Failed to load episodes.</p>';
        showToast('Failed to load episodes', 'error');
    }
}

// --- Schedule Modal & Timing ---
function openScheduleModal(mediaData) {
    state.selectedMedia = mediaData;
    
    // Render media card preview
    elements.modalMediaCard.innerHTML = `
        ${mediaData.tag 
            ? `<img class="modal-media-poster" src="${getImageUrl(mediaData.id, mediaData.tag)}" alt="${escapeHtml(mediaData.name)}">` 
            : ''}
        <div class="modal-media-info">
            <h4>${escapeHtml(mediaData.name)}</h4>
            <p>${mediaData.type || 'Media'} ${mediaData.runtime ? `• ${mediaData.runtime}m` : ''}</p>
        </div>
    `;

    // Default time: next rounded 30 min or 1 hr
    const defaultTime = new Date();
    defaultTime.setMinutes(defaultTime.getMinutes() + 15);
    elements.scheduleDatetime.value = toLocalDatetimeString(defaultTime);

    elements.scheduleModal.classList.remove('hidden');
}

function handlePresetClick(btn) {
    const now = new Date();
    if (btn.dataset.offset) {
        const mins = parseInt(btn.dataset.offset);
        now.setMinutes(now.getMinutes() + mins);
    } else if (btn.dataset.preset === 'tonight-20') {
        now.setHours(20, 0, 0, 0);
        if (now < new Date()) now.setDate(now.getDate() + 1); // tomorrow 20:00 if past
    } else if (btn.dataset.preset === 'tonight-21') {
        now.setHours(21, 30, 0, 0);
        if (now < new Date()) now.setDate(now.getDate() + 1);
    }
    elements.scheduleDatetime.value = toLocalDatetimeString(now);
}

async function handleConfirmSchedule() {
    if (!state.selectedMedia) return;
    const timeValue = elements.scheduleDatetime.value;
    if (!timeValue) {
        showToast('Please select a date and time', 'warning');
        return;
    }

    elements.confirmScheduleBtn.disabled = true;
    elements.confirmScheduleBtn.textContent = 'Scheduling...';

    try {
        const scheduledTimeUtc = new Date(timeValue).toISOString();
        await api.createSchedule({
            name: state.selectedMedia.name,
            jellyfin_item_id: state.selectedMedia.id,
            item_type: state.selectedMedia.type || 'movie',
            image_tag: state.selectedMedia.tag || null,
            scheduled_time: scheduledTimeUtc,
        });

        showToast(`Scheduled "${state.selectedMedia.name}" successfully!`, 'success');
        elements.scheduleModal.classList.add('hidden');
        
        // Switch to timeline view to show the new job
        switchView('timeline');
        loadTimeline();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.confirmScheduleBtn.disabled = false;
        elements.confirmScheduleBtn.textContent = '📅 Schedule Job';
    }
}

async function handleInstantPlay() {
    if (!state.selectedMedia) return;
    
    elements.instantPlayBtn.disabled = true;
    elements.instantPlayBtn.textContent = '⚡ Sending to TV...';

    try {
        const res = await api.playNow(state.selectedMedia.id);
        showToast(res.message || `Started playing on TV!`, 'success');
        elements.scheduleModal.classList.add('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.instantPlayBtn.disabled = false;
        elements.instantPlayBtn.textContent = '⚡ Play Now';
    }
}

// --- Timeline View ---
async function loadTimeline() {
    try {
        const jobs = await api.getSchedules();
        state.scheduledJobs = jobs;
        
        const pendingCount = jobs.filter(j => j.status === 'pending').length;
        if (pendingCount > 0) {
            elements.pendingCountBadge.textContent = pendingCount;
            elements.pendingCountBadge.classList.remove('hidden');
        } else {
            elements.pendingCountBadge.classList.add('hidden');
        }

        renderTimeline(jobs);
    } catch (err) {
        console.warn('Failed to load timeline:', err);
    }
}

function renderTimeline(jobs) {
    if (!jobs || jobs.length === 0) {
        elements.timelineList.innerHTML = '';
        elements.emptyTimelineState.classList.remove('hidden');
        return;
    }

    elements.emptyTimelineState.classList.add('hidden');
    elements.timelineList.innerHTML = jobs.map(job => `
        <div class="timeline-card" data-job-id="${job.id}">
            <div class="timeline-main">
                ${job.image_tag 
                    ? `<img class="timeline-poster" src="${getImageUrl(job.jellyfin_item_id, job.image_tag)}" alt="${escapeHtml(job.name)}">` 
                    : `<div class="timeline-poster" style="background:var(--bg-surface);display:flex;align-items:center;justify-content:center;">📺</div>`}
                <div class="timeline-info">
                    <div class="timeline-title">${escapeHtml(job.name)}</div>
                    <div class="timeline-time">⏰ ${formatDatetime(job.scheduled_time)}</div>
                </div>
            </div>
            <div class="timeline-actions">
                <span class="status-badge ${job.status}">${job.status}</span>
                ${job.status === 'pending' ? `<button class="btn btn-danger btn-sm cancel-job-btn" data-job-id="${job.id}">Cancel</button>` : ''}
            </div>
        </div>
    `).join('');

    elements.timelineList.querySelectorAll('.cancel-job-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Cancel this scheduled playback job?')) {
                try {
                    await api.deleteSchedule(btn.dataset.jobId);
                    showToast('Scheduled playback cancelled', 'success');
                    loadTimeline();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    });
}

// --- Settings & TV Setup Actions ---
function openSettingsModal(tabName = 'tv-tab') {
    elements.settingsModal.classList.remove('hidden');
    switchSettingsTab(tabName);
    updateTvStatusUI();
}

function switchSettingsTab(tabId) {
    elements.settingsTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    elements.settingsPanels.forEach(p => p.classList.toggle('active', p.id === tabId));
}

async function handleConnectTv() {
    const ip = elements.tvIpInput.value.trim();
    const port = elements.tvPortInput.value.trim();
    const name = elements.tvNameInput.value.trim();

    if (!ip) {
        showToast('Please enter your TV IP address', 'warning');
        return;
    }

    elements.connectTvBtn.disabled = true;
    elements.connectTvBtn.textContent = 'Connecting...';

    try {
        // Save name and IP first
        await api.saveSettings({ tv_ip: ip, adb_port: parseInt(port) || 5555, tv_device_name: name });
        
        // Trigger ADB connection
        const res = await api.connectAdb(ip, port);
        renderAdbStatusBox(res);
        
        if (res.state === 'device') {
            showToast('TV Connected & Authorized!', 'success');
        } else if (res.state === 'unauthorized') {
            showToast('Prompt on TV screen! Check TV and press Allow.', 'warning');
        } else {
            showToast(res.message, 'error');
        }
        
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.connectTvBtn.disabled = false;
        elements.connectTvBtn.textContent = '🔗 Connect / Pair TV';
    }
}

async function handleSaveTvSettings() {
    const ip = elements.tvIpInput.value.trim();
    const port = parseInt(elements.tvPortInput.value.trim()) || 5555;
    const name = elements.tvNameInput.value.trim();

    try {
        await api.saveSettings({ tv_ip: ip, adb_port: port, tv_device_name: name });
        showToast('TV settings saved', 'success');
        updateTvStatusUI();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleTestWake() {
    elements.testWakeBtn.disabled = true;
    try {
        await api.testWake();
        showToast('Wake signal sent to TV!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.testWakeBtn.disabled = false;
    }
}

async function handleTestLaunchApp() {
    elements.testLaunchAppBtn.disabled = true;
    try {
        await api.testLaunch();
        showToast('Jellyfin app launched on TV!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        elements.testLaunchAppBtn.disabled = false;
    }
}

async function handleTestJellyfin() {
    const url = elements.jfUrlInput.value.trim();
    const apiKey = elements.jfKeyInput.value.trim();

    if (!url || !apiKey) {
        showToast('Please enter both Jellyfin URL and API Key', 'warning');
        return;
    }

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
        elements.testJfBtn.textContent = '🔍 Test Connection & Fetch Users';
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

// --- Navigation & View Switching ---
function switchView(viewName) {
    state.activeView = viewName;
    elements.viewTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.view === viewName));
    elements.browserView.classList.toggle('active', viewName === 'browser');
    elements.timelineView.classList.toggle('active', viewName === 'timeline');

    if (viewName === 'timeline') {
        loadTimeline();
    }
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

// --- Setup Event Listeners ---
function setupEventListeners() {
    // View switching
    elements.viewTabs.forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Header buttons
    elements.tvStatusPill.addEventListener('click', () => openSettingsModal('tv-tab'));
    elements.openSettingsBtn.addEventListener('click', () => openSettingsModal('tv-tab'));
    elements.bannerActionBtn.addEventListener('click', () => openSettingsModal('tv-tab'));
    elements.goToLibraryBtn.addEventListener('click', () => switchView('browser'));

    // Search & Filter
    elements.searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        elements.clearSearchBtn.classList.toggle('hidden', !val);
        clearTimeout(state.searchDebounceTimer);
        state.searchDebounceTimer = setTimeout(() => {
            state.searchQuery = val;
            loadLibraryMedia();
        }, 300);
    });

    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.clearSearchBtn.classList.add('hidden');
        state.searchQuery = '';
        loadLibraryMedia();
    });

    elements.filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.mediaTypeFilter = chip.dataset.type;
            loadLibraryMedia();
        });
    });

    elements.refreshMediaBtn.addEventListener('click', loadLibraryMedia);
    elements.backToLibraryBtn.addEventListener('click', () => {
        elements.seriesView.classList.add('hidden');
        loadLibraryMedia();
    });

    // Schedule Modal
    elements.closeScheduleModal.addEventListener('click', () => elements.scheduleModal.classList.add('hidden'));
    elements.presetButtons.forEach(btn => btn.addEventListener('click', () => handlePresetClick(btn)));
    elements.confirmScheduleBtn.addEventListener('click', handleConfirmSchedule);
    elements.instantPlayBtn.addEventListener('click', handleInstantPlay);

    // Timeline Refresh
    elements.refreshTimelineBtn.addEventListener('click', loadTimeline);

    // Settings Modal
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
    elements.testLaunchAppBtn.addEventListener('click', handleTestLaunchApp);

    // Jellyfin Setup Buttons
    elements.testJfBtn.addEventListener('click', handleTestJellyfin);
    elements.saveJfSettingsBtn.addEventListener('click', handleSaveJfSettings);
}

// Start application
document.addEventListener('DOMContentLoaded', initApp);
