// --- State ---
let selectedMedia = null;
let currentSeriesId = null;
let searchTimeout = null;

// --- DOM Elements ---
const searchInput = document.getElementById('searchInput');
const searchType = document.getElementById('searchType');
const searchResults = document.getElementById('searchResults');
const searchSection = document.getElementById('searchSection');
const seriesSection = document.getElementById('seriesSection');
const seriesTitle = document.getElementById('seriesTitle');
const seasonsBar = document.getElementById('seasonsBar');
const episodeResults = document.getElementById('episodeResults');
const backToSearch = document.getElementById('backToSearch');
const scheduleSection = document.getElementById('scheduleSection');
const selectedMediaDiv = document.getElementById('selectedMedia');
const scheduleTime = document.getElementById('scheduleTime');
const scheduleBtn = document.getElementById('scheduleBtn');
const cancelSelect = document.getElementById('cancelSelect');
const timeline = document.getElementById('timeline');
const emptyTimeline = document.getElementById('emptyTimeline');
const refreshTimeline = document.getElementById('refreshTimeline');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');

// --- Utility ---
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function debounce(fn, delay) {
    return (...args) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fn(...args), delay);
    };
}

function formatDateTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
    }) + ' ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
    });
}

function imageUrl(itemId, tag) {
    let url = `/api/image/${itemId}`;
    if (tag) url += `?tag=${tag}`;
    return url;
}

// --- Search ---
async function doSearch() {
    const q = searchInput.value.trim();
    if (q.length < 2) {
        searchResults.innerHTML = '';
        return;
    }
    
    searchResults.innerHTML = '<div class="loading">Searching</div>';
    
    try {
        const type = searchType.value;
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`);
        if (!resp.ok) throw new Error('Search failed');
        const items = await resp.json();
        renderSearchResults(items);
    } catch (err) {
        searchResults.innerHTML = '<p class="empty-state">Search failed. Check Jellyfin connection.</p>';
        showToast(err.message, 'error');
    }
}

function renderSearchResults(items) {
    if (items.length === 0) {
        searchResults.innerHTML = '<p class="empty-state">No results found.</p>';
        return;
    }
    searchResults.innerHTML = items.map(item => `
        <div class="media-card" data-id="${item.id}" data-name="${item.name}" 
             data-type="${item.type}" data-tag="${item.image_tag || ''}"  
             data-year="${item.year || ''}" data-runtime="${item.runtime_minutes || ''}">
            ${item.image_tag 
                ? `<img class="poster" src="${imageUrl(item.id, item.image_tag)}" alt="${item.name}" loading="lazy">` 
                : `<div class="poster-placeholder">${item.type === 'Movie' ? '🎬' : '📺'}</div>`}
            <div class="card-info">
                <div class="card-title" title="${item.name}">${item.name}</div>
                <div class="card-meta">${item.year || ''} ${item.type === 'Movie' && item.runtime_minutes ? `• ${item.runtime_minutes}m` : ''}</div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    searchResults.querySelectorAll('.media-card').forEach(card => {
        card.addEventListener('click', () => onMediaSelect(card.dataset));
    });
}

// --- Media Selection ---
function onMediaSelect(data) {
    if (data.type === 'Series') {
        loadSeries(data.id, data.name);
    } else {
        selectForScheduling(data);
    }
}

async function loadSeries(seriesId, seriesName) {
    currentSeriesId = seriesId;
    seriesTitle.textContent = seriesName;
    searchSection.classList.add('hidden');
    seriesSection.classList.remove('hidden');
    scheduleSection.classList.add('hidden');
    
    try {
        const resp = await fetch(`/api/series/${seriesId}/seasons`);
        if (!resp.ok) throw new Error('Failed to load seasons');
        const seasons = await resp.json();
        
        seasonsBar.innerHTML = seasons.map(s => `
            <button class="season-btn" data-season-id="${s.id}" data-season-num="${s.season_number}">
                ${s.name}
            </button>
        `).join('');
        
        seasonsBar.querySelectorAll('.season-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                seasonsBar.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadEpisodes(seriesId, btn.dataset.seasonId);
            });
        });
        
        // Auto-select first season
        if (seasons.length > 0) {
            seasonsBar.querySelector('.season-btn').click();
        }
    } catch (err) {
        showToast('Failed to load seasons', 'error');
    }
}

async function loadEpisodes(seriesId, seasonId) {
    episodeResults.innerHTML = '<div class="loading">Loading episodes</div>';
    
    try {
        const resp = await fetch(`/api/series/${seriesId}/episodes?season_id=${seasonId}`);
        if (!resp.ok) throw new Error('Failed to load episodes');
        const episodes = await resp.json();
        
        episodeResults.innerHTML = episodes.map(ep => `
            <div class="media-card" data-id="${ep.id}" data-name="S${ep.season_number || '?'}E${ep.episode_number || '?'}: ${ep.name}" 
                 data-type="Episode" data-tag="${ep.image_tag || ''}" 
                 data-year="" data-runtime="${ep.runtime_minutes || ''}">
                ${ep.image_tag 
                    ? `<img class="poster" src="${imageUrl(ep.id, ep.image_tag)}" alt="${ep.name}" loading="lazy">` 
                    : `<div class="poster-placeholder">📺</div>`}
                <div class="card-info">
                    <div class="card-title" title="${ep.name}">E${ep.episode_number || '?'}: ${ep.name}</div>
                    <div class="card-meta">${ep.runtime_minutes ? `${ep.runtime_minutes}m` : ''}</div>
                </div>
            </div>
        `).join('');
        
        episodeResults.querySelectorAll('.media-card').forEach(card => {
            card.addEventListener('click', () => selectForScheduling(card.dataset));
        });
    } catch (err) {
        episodeResults.innerHTML = '<p class="empty-state">Failed to load episodes.</p>';
        showToast(err.message, 'error');
    }
}

function selectForScheduling(data) {
    selectedMedia = {
        id: data.id,
        name: data.name,
        type: data.type.toLowerCase(),
        imageTag: data.tag || null,
        year: data.year || '',
        runtime: data.runtime || '',
    };
    
    selectedMediaDiv.innerHTML = `
        ${selectedMedia.imageTag 
            ? `<img src="${imageUrl(selectedMedia.id, selectedMedia.imageTag)}" alt="${selectedMedia.name}">` 
            : ''}
        <div class="media-details">
            <h3>${selectedMedia.name}</h3>
            <p>${selectedMedia.year} ${selectedMedia.runtime ? `• ${selectedMedia.runtime}m` : ''}</p>
        </div>
    `;
    
    // Set default time to next round hour
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    scheduleTime.value = now.toISOString().slice(0, 16);
    
    scheduleSection.classList.remove('hidden');
    scheduleSection.scrollIntoView({ behavior: 'smooth' });
}

// --- Scheduling ---
async function submitSchedule() {
    if (!selectedMedia) return;
    
    const time = scheduleTime.value;
    if (!time) {
        showToast('Please select a time', 'error');
        return;
    }
    
    scheduleBtn.disabled = true;
    scheduleBtn.textContent = 'Scheduling...';
    
    try {
        const resp = await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: selectedMedia.name,
                jellyfin_item_id: selectedMedia.id,
                item_type: selectedMedia.type,
                image_tag: selectedMedia.imageTag,
                scheduled_time: new Date(time).toISOString(),
            }),
        });
        
        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Schedule failed');
        }
        
        showToast(`Scheduled: ${selectedMedia.name}`, 'success');
        clearSelection();
        loadTimeline();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        scheduleBtn.disabled = false;
        scheduleBtn.textContent = 'Schedule';
    }
}

function clearSelection() {
    selectedMedia = null;
    scheduleSection.classList.add('hidden');
    seriesSection.classList.add('hidden');
    searchSection.classList.remove('hidden');
}

// --- Timeline ---
async function loadTimeline() {
    try {
        const resp = await fetch('/api/schedule');
        if (!resp.ok) throw new Error('Failed to load schedule');
        const jobs = await resp.json();
        renderTimeline(jobs);
    } catch (err) {
        timeline.innerHTML = '<p class="empty-state">Failed to load timeline.</p>';
    }
}

function renderTimeline(jobs) {
    if (jobs.length === 0) {
        timeline.innerHTML = '';
        emptyTimeline.classList.remove('hidden');
        return;
    }
    
    emptyTimeline.classList.add('hidden');
    timeline.innerHTML = jobs.map(job => `
        <div class="timeline-item">
            <div class="job-info">
                <div class="job-name">${job.name}</div>
                <div class="job-time">${formatDateTime(job.scheduled_time)}</div>
            </div>
            <div class="job-actions">
                <span class="status-badge ${job.status}">${job.status}</span>
                ${job.status === 'pending' ? `<button class="btn btn-danger" onclick="deleteJob('${job.id}')">Cancel</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function deleteJob(jobId) {
    if (!confirm('Cancel this scheduled playback?')) return;
    
    try {
        const resp = await fetch(`/api/schedule/${jobId}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Delete failed');
        showToast('Job cancelled', 'success');
        loadTimeline();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- TV Status ---
async function checkTVStatus() {
    try {
        const resp = await fetch('/api/tv/status');
        if (!resp.ok) throw new Error();
        const status = await resp.json();
        
        if (status.session_found && status.is_active) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = status.device_name || 'TV Connected';
        } else if (status.adb_reachable) {
            statusDot.className = 'status-dot partial';
            statusText.textContent = 'ADB Only';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'TV Offline';
        }
    } catch {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Server Error';
    }
}

// --- Event Listeners ---
searchInput.addEventListener('input', debounce(doSearch, 300));
searchType.addEventListener('change', doSearch);
scheduleBtn.addEventListener('click', submitSchedule);
cancelSelect.addEventListener('click', clearSelection);
backToSearch.addEventListener('click', clearSelection);
refreshTimeline.addEventListener('click', loadTimeline);

// Make deleteJob global for inline onclick
window.deleteJob = deleteJob;

// --- Init ---
loadTimeline();
checkTVStatus();
setInterval(checkTVStatus, 30000);
setInterval(loadTimeline, 60000);
