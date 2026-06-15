// ==========================================================================
// Application State
// ==========================================================================
let responses = JSON.parse(localStorage.getItem('survey_responses')) || [];
const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw21DC_mJw0cfbMIjgAJhA8H_gM_QhZJ4Z4a-5f3DnzsaOTJQdxI5cz98Q4TLjyHM0o/exec';
let googleSheetsUrl = localStorage.getItem('google_sheets_url');

// 自動遷移舊版或空網址，確保使用最新雲端連結
if (!googleSheetsUrl || googleSheetsUrl.indexOf('AKfycbw21DC_mJw0cfbMIjgAJhA8H_gM_QhZJ4Z4a-5f3DnzsaOTJQdxI5cz98Q4TLjyHM0o') === -1) {
    googleSheetsUrl = DEFAULT_SHEETS_URL;
    localStorage.setItem('google_sheets_url', DEFAULT_SHEETS_URL);
}
let selectedRating = 0;
let bgmPlayer;
let isMusicPlaying = localStorage.getItem('bgm_playing') !== 'false';
let hasUserInteracted = false;

const RATING_DESCRIPTIONS = {
    0: '點擊粽子評分',
    1: '有待加強 🍙',
    2: '稍嫌複雜 🍙🍙',
    3: '普通順手 🍙🍙🍙',
    4: '蠻好操作的 🍙🍙🍙🍙',
    5: '非常直覺好上手 🍙🍙🍙🍙🍙'
};

// ==========================================================================
// Initial Setup & DOM Elements
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();
 
    // Initialize BGM Player
    bgmPlayer = document.getElementById('bgm-player');
    initBgmSource();
 
    // Load sheets urls into settings inputs
    const sheetsInput = document.getElementById('setting-sheets-url');
    if (sheetsInput) sheetsInput.value = googleSheetsUrl;
 
    // Set initial rating text
    updateRatingDisplay(0);
 
    // Initial Dashboard Render
    renderDashboard();
    updateConnectionStatusUI();
 
    // Event Listeners
    setupEventListeners();

    // Update initial BGM button state based on preference
    const musicIcon = document.getElementById('music-icon');
    const musicBtn = document.getElementById('music-toggle-btn');
    if (musicIcon && musicBtn) {
        if (isMusicPlaying) {
            musicIcon.setAttribute('data-lucide', 'music');
            musicBtn.title = '暫停音樂';
        } else {
            musicIcon.setAttribute('data-lucide', 'music-off');
            musicBtn.title = '播放音樂';
        }
        lucide.createIcons();
    }

    // Play BGM on first user interaction
    const initBgmPlay = () => {
        hasUserInteracted = true;
        if (isMusicPlaying) {
            playMusic();
        }
        document.removeEventListener('click', initBgmPlay);
        document.removeEventListener('keydown', initBgmPlay);
    };
    document.addEventListener('click', initBgmPlay);
    document.addEventListener('keydown', initBgmPlay);
});

// ==========================================================================
// Event Listeners Registration
// ==========================================================================
function setupEventListeners() {
    // View toggles
    document.getElementById('toggle-dashboard-btn').addEventListener('click', () => {
        requestDashboardAccess(() => switchView('dashboard-section'));
    });
 
    document.getElementById('btn-back-to-survey').addEventListener('click', () => {
        switchView('survey-section');
    });

    // Activity selection is now a text input, no radio listeners needed

    // Zongzi Rating Logic
    const ratingButtons = document.querySelectorAll('.rating-zongzi');
    ratingButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const value = parseInt(e.currentTarget.getAttribute('data-value'));
            selectedRating = value;
            updateRatingDisplay(value);
        });

        btn.addEventListener('mouseover', (e) => {
            const value = parseInt(e.currentTarget.getAttribute('data-value'));
            hoverRatingDisplay(value);
        });

        btn.addEventListener('mouseleave', () => {
            updateRatingDisplay(selectedRating);
        });
    });

    // Form Submission
    document.getElementById('survey-form').addEventListener('submit', handleFormSubmit);

    // Music Toggle
    document.getElementById('music-toggle-btn').addEventListener('click', toggleMusic);

    // Success Screen actions
    document.getElementById('btn-fill-another').addEventListener('click', () => {
        resetForm();
        switchView('survey-section');
    });

    document.getElementById('btn-success-dashboard').addEventListener('click', () => {
        requestDashboardAccess(() => switchView('dashboard-section'));
    });

    // Settings Modal
    document.getElementById('open-settings-btn').addEventListener('click', openSettingsModal);
    document.getElementById('btn-dashboard-settings').addEventListener('click', openSettingsModal);
    document.getElementById('close-settings-btn-x').addEventListener('click', closeSettingsModal);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    
    // Settings modal window click listener to close
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('settings-modal');
        if (e.target === modal) {
            closeSettingsModal();
        }
    });

    // Password Verification Modal events
    const closePasswordX = document.getElementById('close-password-btn-x');
    if (closePasswordX) {
        closePasswordX.addEventListener('click', closePasswordModal);
    }

    const submitPasswordBtn = document.getElementById('btn-submit-password');
    if (submitPasswordBtn) {
        submitPasswordBtn.addEventListener('click', submitPasswordVerification);
    }

    const passwordInput = document.getElementById('input-admin-password');
    if (passwordInput) {
        // Auto-submit as soon as the user types exactly "888"
        passwordInput.addEventListener('input', (e) => {
            if (e.target.value.trim() === '888') {
                submitPasswordVerification();
            }
        });

        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitPasswordVerification();
            }
        });
    }

    // Click outside password modal to close
    window.addEventListener('click', (e) => {
        const passwordModal = document.getElementById('password-modal');
        if (e.target === passwordModal) {
            closePasswordModal();
        }
    });

    // BGM Custom Upload file triggers
    const uploadBtn = document.getElementById('btn-upload-bgm');
    const fileInput = document.getElementById('setting-bgm-file');
    const clearBgmBtn = document.getElementById('btn-clear-bgm-file');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3')) {
                showToast('請上傳正確的 MP3 或音訊檔案！', 'error');
                return;
            }

            try {
                showToast('正在處理音樂檔案...', 'info');
                await saveBgmToDB(file, file.name);
                await initBgmSource();
                if (isMusicPlaying) {
                    playMusic();
                }
                showToast('音樂上傳成功！', 'success');
            } catch (err) {
                console.error(err);
                showToast('音樂儲存失敗，請重試！', 'error');
            }
        });
    }

    if (clearBgmBtn) {
        clearBgmBtn.addEventListener('click', async () => {
            if (confirm('確定要還原為系統預設配樂嗎？')) {
                try {
                    await deleteBgmFromDB();
                    await initBgmSource();
                    if (isMusicPlaying) {
                        playMusic();
                    }
                    showToast('已還原為預設配樂！', 'success');
                } catch (err) {
                    console.error(err);
                    showToast('操作失敗，請重試！', 'error');
                }
            }
        });
    }

    // Connection testing
    document.getElementById('btn-test-sheet').addEventListener('click', testSheetConnection);

    // Developer Seeding/Clearing
    document.getElementById('btn-seed-data').addEventListener('click', () => { seedMockData(); });
    document.getElementById('btn-seed-data-dashboard').addEventListener('click', () => { seedMockData(); });
    
    const clearBtn = document.getElementById('btn-clear-data');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllData);
    }
    
    const clearBtnSettings = document.getElementById('btn-clear-data-settings');
    if (clearBtnSettings) {
        clearBtnSettings.addEventListener('click', clearAllData);
    }

    // Dashboard Search filter
    document.getElementById('search-input').addEventListener('input', renderResponsesTable);

    // Export CSV
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

    // Refresh Dashboard (Sync Cloud)
    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const refreshIcon = document.getElementById('refresh-icon');
            if (refreshIcon) refreshIcon.classList.add('spin');
            
            await fetchResponsesFromSheets();
            
            if (refreshIcon) refreshIcon.classList.remove('spin');
            renderDashboard();
        });
    }
}

// ==========================================================================
// Background Music Helper Functions
// ==========================================================================
function playMusic() {
    if (bgmPlayer) {
        bgmPlayer.play().then(() => {
            const icon = document.getElementById('music-icon');
            if (icon) {
                icon.setAttribute('data-lucide', 'music');
                icon.classList.add('rotate-music');
            }
            const btn = document.getElementById('music-toggle-btn');
            if (btn) btn.title = '暫停音樂';
            lucide.createIcons();
        }).catch(err => {
            console.log("播放被瀏覽器阻擋，將於使用者操作後播放", err);
        });
    }
}

function pauseMusic() {
    if (bgmPlayer) {
        bgmPlayer.pause();
        const icon = document.getElementById('music-icon');
        if (icon) {
            icon.setAttribute('data-lucide', 'music-off');
            icon.classList.remove('rotate-music');
        }
        const btn = document.getElementById('music-toggle-btn');
        if (btn) btn.title = '播放音樂';
        lucide.createIcons();
    }
}

function toggleMusic() {
    isMusicPlaying = !isMusicPlaying;
    localStorage.setItem('bgm_playing', isMusicPlaying);
    if (isMusicPlaying) {
        playMusic();
        showToast('背景音樂已開啟 🎵', 'success');
    } else {
        pauseMusic();
        showToast('背景音樂已關閉', 'error');
    }
}

// ==========================================================================
// Navigation & Views & Access Control
// ==========================================================================
let pendingViewSwitch = null;

function requestDashboardAccess(callback) {
    // Always require password verification every time the instructor accesses the backend
    pendingViewSwitch = callback;
    openPasswordModal();
}

function openPasswordModal() {
    const modal = document.getElementById('password-modal');
    const input = document.getElementById('input-admin-password');
    const errorMsg = document.getElementById('password-error-msg');
    
    if (modal) {
        modal.classList.add('active');
        if (input) {
            input.value = '';
            input.focus();
        }
        if (errorMsg) errorMsg.style.display = 'none';
    }
}

function closePasswordModal() {
    const modal = document.getElementById('password-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    pendingViewSwitch = null;
}

function submitPasswordVerification() {
    const input = document.getElementById('input-admin-password');
    const errorMsg = document.getElementById('password-error-msg');
    if (!input) return;

    const password = input.value.trim();
    if (password === '888') {
        sessionStorage.setItem('dashboard_authorized', 'true');
        showToast('驗證成功，歡迎講師！🎉', 'success');
        
        const callback = pendingViewSwitch;
        closePasswordModal();
        if (callback) {
            callback();
        }
    } else {
        if (errorMsg) {
            errorMsg.style.display = 'block';
            input.focus();
            input.select();
        }
        showToast('密碼錯誤，拒絕存取！', 'error');
    }
}

function switchView(viewId) {
    try {
        // Hide all sections
        document.querySelectorAll('.main-card').forEach(card => {
            card.classList.remove('active');
        });

        // Show selected section
        const activeSection = document.getElementById(viewId);
        if (activeSection) {
            activeSection.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Adjust navigation button state
        const toggleBtn = document.getElementById('toggle-dashboard-btn');
        if (toggleBtn) {
            if (viewId === 'dashboard-section') {
                toggleBtn.classList.add('hidden');
                try {
                    renderDashboard();
                    // Background cloud sync
                    if (googleSheetsUrl) {
                        fetchResponsesFromSheets().then(() => {
                            renderDashboard();
                        });
                    }
                } catch (e) {
                    console.error('Error rendering dashboard:', e);
                }
            } else {
                toggleBtn.classList.remove('hidden');
            }
        }

        // Show walking viewport mascot only on survey page
        const fixedMascots = document.querySelectorAll('.mascot-wrapper');
        fixedMascots.forEach(mascot => {
            if (viewId === 'survey-section') {
                mascot.style.display = 'block';
            } else {
                mascot.style.display = 'none';
            }
        });
    } catch (err) {
        console.error('Error in switchView:', err);
    }
}

// ==========================================================================
// Rating Interactivity Helpers
// ==========================================================================
function updateRatingDisplay(rating) {
    const ratingButtons = document.querySelectorAll('.rating-zongzi');
    ratingButtons.forEach((btn, index) => {
        if (index < rating) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    const descText = document.getElementById('rating-desc');
    descText.innerText = RATING_DESCRIPTIONS[rating];
}

function hoverRatingDisplay(rating) {
    const ratingButtons = document.querySelectorAll('.rating-zongzi');
    ratingButtons.forEach((btn, index) => {
        if (index < rating) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const descText = document.getElementById('rating-desc');
    descText.innerText = RATING_DESCRIPTIONS[rating] + ' (預覽)';
}

// ==========================================================================
// Form Reset & UI Resets
// ==========================================================================
function resetForm() {
    const form = document.getElementById('survey-form');
    form.reset();
    
    // Clear errors
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('has-error');
    });

    // Reset rating
    selectedRating = 0;
    updateRatingDisplay(0);


}

// ==========================================================================
// Settings Modal Functions
// ==========================================================================
function openSettingsModal() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
    document.getElementById('sheet-test-result').className = 'test-result-label';
    document.getElementById('sheet-test-result').innerText = '';
}

function saveSettings() {
    const sheetsUrlInput = document.getElementById('setting-sheets-url').value.trim();
    
    if (sheetsUrlInput && !sheetsUrlInput.startsWith('https://script.google.com/')) {
        showToast('請輸入正確的 Google Apps Script 網頁應用程式網址', 'error');
        return;
    }

    googleSheetsUrl = sheetsUrlInput;
    localStorage.setItem('google_sheets_url', googleSheetsUrl);
    
    showToast('設定儲存成功！🎋', 'success');
    closeSettingsModal();
    updateConnectionStatusUI();
    renderDashboard();

    // Auto-fetch right after setting URL
    if (googleSheetsUrl) {
        fetchResponsesFromSheets().then(() => {
            renderDashboard();
        });
    }
}

function updateConnectionStatusUI() {
    const statusDot = document.getElementById('sheet-status-dot');
    const statusText = document.getElementById('sheet-status-text');
    
    if (googleSheetsUrl) {
        statusDot.classList.add('active');
        statusText.innerText = '已串接 Google 雲端試算表';
    } else {
        statusDot.classList.remove('active');
        statusText.innerText = '未設定 Google 雲端連線';
    }
}

// Testing google sheets connection with dry payload
async function testSheetConnection() {
    const url = document.getElementById('setting-sheets-url').value.trim();
    const resultLabel = document.getElementById('sheet-test-result');

    if (!url) {
        resultLabel.className = 'test-result-label error';
        resultLabel.innerText = '請先填寫網址！';
        return;
    }

    resultLabel.className = 'test-result-label loading';
    resultLabel.innerText = '測試中...';

    const testPayload = {
        name: "連線測試員",
        takeaways: "測試 Google Sheets 連線是否通暢",
        impactfulActivity: "系統連線測試",
        padletRating: 5,
        padletFeedback: "測試連線",
        instructorFeedback: "系統運作順利！"
    };

    try {
        // Use text/plain type to avoid pre-flight CORS block on Google Apps Script
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(testPayload)
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            resultLabel.className = 'test-result-label success';
            resultLabel.innerText = '連線測試成功！🎉 資料已寫入試算表';
        } else {
            resultLabel.className = 'test-result-label error';
            resultLabel.innerText = '測試失敗: ' + (data.message || '未知錯誤');
        }
    } catch (error) {
        // Sometimes CORS allows write but blocks read from client side
        // If it throws TypeError (often because of redirection/CORS headers issues in App Script),
        // but it still successfully writes. However, a properly deployed script allows reading.
        console.error('Connection test error:', error);
        resultLabel.className = 'test-result-label error';
        resultLabel.innerText = '連線出錯，請確認該 Apps Script 已部署為「任何人」均可存取。';
    }
}

// ==========================================================================
// Form Submission Handler
// ==========================================================================
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Clear errors
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('has-error');
    });

    let isValid = true;
    let firstErrorElement = null;

    // Validate 1: Name
    const nameInput = document.getElementById('input-name');
    if (!nameInput.value.trim()) {
        isValid = false;
        nameInput.closest('.form-group').classList.add('has-error');
        if (!firstErrorElement) firstErrorElement = nameInput;
    }

    // Validate 2: Takeaways
    const takeawaysInput = document.getElementById('input-takeaways');
    if (!takeawaysInput.value.trim()) {
        isValid = false;
        takeawaysInput.closest('.form-group').classList.add('has-error');
        if (!firstErrorElement) firstErrorElement = takeawaysInput;
    }

    // Validate 3: Activity
    const activityInput = document.getElementById('input-activity');
    let finalActivity = '';
    
    if (!activityInput.value.trim()) {
        isValid = false;
        activityInput.closest('.form-group').classList.add('has-error');
        if (!firstErrorElement) firstErrorElement = activityInput;
    } else {
        finalActivity = activityInput.value.trim();
    }

    // Validate 4: Padlet feedback
    const padletInput = document.getElementById('input-padlet');
    const padletGroup = padletInput.closest('.form-group');
    if (selectedRating === 0 || !padletInput.value.trim()) {
        isValid = false;
        padletGroup.classList.add('has-error');
        if (!firstErrorElement) firstErrorElement = padletInput;
    }

    // Validate 5: Instructor Feedback
    const instructorInput = document.getElementById('input-instructor');
    if (!instructorInput.value.trim()) {
        isValid = false;
        instructorInput.closest('.form-group').classList.add('has-error');
        if (!firstErrorElement) firstErrorElement = instructorInput;
    }

    // If validation fails, scroll to error field
    if (!isValid) {
        if (firstErrorElement) {
            firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast('欄位有漏寫喔，請確認！🍙', 'error');
        return;
    }

    // Prepare payload
    const padletFeedbackInput = document.getElementById('input-padlet');
    const submissionId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const dateObj = new Date();
    const timestampStr = dateObj.toLocaleString('zh-TW', { hour12: false });

    const newResponse = {
        id: submissionId,
        timestamp: timestampStr,
        name: nameInput.value.trim(),
        takeaways: takeawaysInput.value.trim(),
        impactfulActivity: finalActivity,
        padletRating: selectedRating || null,
        padletFeedback: padletFeedbackInput.value.trim(),
        instructorFeedback: instructorInput.value.trim(),
        synced: false
    };

    // Save to Local Storage immediately
    responses.push(newResponse);
    localStorage.setItem('survey_responses', JSON.stringify(responses));

    // Render local changes on dashboard in background
    renderDashboard();

    // Randomly choose a Dragon Boat Festival pun for the success page
    const greetingsPuns = ['「綜」情端午', '萬事包「綜」', '「綜」夏安康', '「綜」情大笑', '百發百「綜」'];
    const randomPun = greetingsPuns[Math.floor(Math.random() * greetingsPuns.length)];
    document.getElementById('pun-text').innerText = randomPun;

    // Show success view
    switchView('success-section');

    // Sync to Google Sheets
    const syncStatusBox = document.getElementById('success-sync-status');
    
    if (googleSheetsUrl) {
        syncStatusBox.className = 'google-sync-status';
        syncStatusBox.innerHTML = `
            <i data-lucide="cloud-lightning" class="sync-icon loading"></i>
            <span class="sync-text">正在同步至 Google 雲端試算表...</span>
        `;
        lucide.createIcons();

        try {
            const response = await fetch(googleSheetsUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(newResponse)
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // Update local storage record to synced
                const foundIndex = responses.findIndex(r => r.id === submissionId);
                if (foundIndex !== -1) {
                    responses[foundIndex].synced = true;
                    localStorage.setItem('survey_responses', JSON.stringify(responses));
                }
                
                syncStatusBox.className = 'google-sync-status success';
                syncStatusBox.innerHTML = `
                    <i data-lucide="cloud-check" class="sync-icon"></i>
                    <span class="sync-text">已成功同步寫入 Google 試算表！🎉</span>
                `;
                showToast('已同步寫入 Google Sheets！', 'success');
            } else {
                throw new Error(data.message || '雲端處理回傳錯誤');
            }
        } catch (error) {
            console.error('Auto sync error:', error);
            syncStatusBox.className = 'google-sync-status error';
            syncStatusBox.innerHTML = `
                <i data-lucide="cloud-off" class="sync-icon"></i>
                <span class="sync-text">寫入 Google 失敗 (已自動存於本地備份)</span>
            `;
            showToast('雲端同步失敗，已儲存在本地後台', 'error');
        }
    } else {
        // No Sheets Url set
        syncStatusBox.className = 'google-sync-status';
        syncStatusBox.innerHTML = `
            <i data-lucide="database" class="sync-icon"></i>
            <span class="sync-text">資料已成功儲存於本地 (未啟用雲端試算表)</span>
        `;
    }
    lucide.createIcons();
}

// ==========================================================================
// Cloud Sync (Google Sheets Data Retrieval)
// ==========================================================================
async function fetchResponsesFromSheets() {
    if (!googleSheetsUrl) return;

    const statusDot = document.getElementById('sheet-status-dot');
    const statusText = document.getElementById('sheet-status-text');

    if (statusDot) {
        statusDot.className = 'status-dot loading-spin';
    }
    if (statusText) {
        statusText.innerHTML = '<i data-lucide="refresh-cw" class="spin" style="display:inline-block; width:12px; height:12px; margin-right:4px;"></i> 正在同步雲端數據...';
        lucide.createIcons();
    }

    try {
        // Fetch data from Google Sheets via GET
        const response = await fetch(googleSheetsUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result && result.status === 'success' && Array.isArray(result.data)) {
            const fetched = result.data;
            
            // Merge logic: Use fetched items, append local items if their ID is not present
            const merged = [...fetched];
            responses.forEach(localItem => {
                const exists = fetched.some(f => f.id === localItem.id);
                if (!exists) {
                    merged.push(localItem);
                }
            });
            
            responses = merged;
            localStorage.setItem('survey_responses', JSON.stringify(responses));
            
            showToast('雲端數據同步成功！📊', 'success');
            
            if (statusDot) {
                statusDot.className = 'status-dot active';
            }
            if (statusText) {
                statusText.innerText = '已成功同步最新雲端數據';
            }
        } else {
            throw new Error(result.message || '格式異常');
        }
    } catch (err) {
        console.error('Error fetching responses from cloud:', err);
        showToast('雲端同步失敗，將載入本地數據。請確認 Apps Script 部署設定！', 'error');
        
        if (statusDot) {
            statusDot.className = 'status-dot error';
        }
        if (statusText) {
            statusText.innerText = '雲端同步失敗，顯示本地數據';
        }
    }
}

// ==========================================================================
// Dashboard Calculations & Rendering
// ==========================================================================
function renderDashboard() {
    try {
        if (!Array.isArray(responses)) {
            responses = [];
        }

        // 1. Render Stats values
        const totalCount = responses.length;
        const totalEl = document.getElementById('stat-total-responses');
        if (totalEl) totalEl.innerText = totalCount;

        const syncedCount = responses.filter(r => r.synced).length;
        const syncPercentage = totalCount > 0 ? Math.round((syncedCount / totalCount) * 100) : 0;
        const syncEl = document.getElementById('stat-sync-percentage');
        if (syncEl) syncEl.innerText = syncPercentage + '%';

        const ratedResponses = responses.filter(r => r.padletRating && r.padletRating > 0);
        const avgRating = ratedResponses.length > 0 
            ? (ratedResponses.reduce((sum, r) => sum + r.padletRating, 0) / ratedResponses.length).toFixed(1)
            : '0.0';
        const avgEl = document.getElementById('stat-avg-rating');
        if (avgEl) avgEl.innerText = avgRating;

        // 2. Render Activity Chart Bars
        try {
            renderActivityChart(totalCount);
        } catch (e) {
            console.error('Error rendering activity chart:', e);
        }

        // 3. Render Responses Table
        try {
            renderResponsesTable();
        } catch (e) {
            console.error('Error rendering responses table:', e);
        }
    } catch (err) {
        console.error('Error in renderDashboard:', err);
    }
}

function renderActivityChart(totalCount) {
    const container = document.getElementById('activity-chart-bars');
    container.innerHTML = '';

    if (totalCount === 0) {
        container.innerHTML = `<p class="text-muted" style="font-size:12px; text-align:center; padding: 10px 0;">尚無數據可進行統計圖表分析</p>`;
        return;
    }

    // Count frequencies
    const activityCounts = {};
    responses.forEach(r => {
        const act = r.impactfulActivity || '其他';
        activityCounts[act] = (activityCounts[act] || 0) + 1;
    });

    // Preset options to ensure standard display order, then add customized activities
    const standardActivities = ['破冰相見歡', '實務案例剖析', '小組腦力激盪', 'Padlet實機操作', '問答與回饋交流'];
    
    // Sort all activities by count descending
    const sortedActivities = Object.keys(activityCounts).sort((a, b) => activityCounts[b] - activityCounts[a]);

    sortedActivities.forEach(activity => {
        const count = activityCounts[activity];
        const percentage = Math.round((count / totalCount) * 100);
        
        const barRow = document.createElement('div');
        barRow.className = 'bar-row';
        barRow.innerHTML = `
            <div class="bar-label-group">
                <span class="bar-name">${activity}</span>
                <span class="bar-value">${count} 票 (${percentage}%)</span>
            </div>
            <div class="bar-bg">
                <div class="bar-fill" style="width: ${percentage}%"></div>
            </div>
        `;
        container.appendChild(barRow);
    });
}

function renderResponsesTable() {
    const tableBody = document.getElementById('responses-table-body');
    const emptyState = document.getElementById('empty-responses-state');
    const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
    
    tableBody.innerHTML = '';

    // Filter responses with safety guards for undefined/null fields
    const filteredResponses = responses.filter(r => {
        const name = r.name || '';
        const takeaways = r.takeaways || '';
        const impactfulActivity = r.impactfulActivity || '';
        const padletFeedback = r.padletFeedback || '';
        const instructorFeedback = r.instructorFeedback || '';
        
        return (
            name.toLowerCase().includes(searchQuery) ||
            takeaways.toLowerCase().includes(searchQuery) ||
            impactfulActivity.toLowerCase().includes(searchQuery) ||
            padletFeedback.toLowerCase().includes(searchQuery) ||
            instructorFeedback.toLowerCase().includes(searchQuery)
        );
    });

    // Sort: newest first
    const sorted = [...filteredResponses].reverse();

    if (sorted.length === 0) {
        emptyState.classList.remove('hidden');
        document.querySelector('.table-responsive').classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        document.querySelector('.table-responsive').classList.remove('hidden');

        sorted.forEach(r => {
            const tr = document.createElement('tr');
            
            // Format rating cell
            let ratingDisplay = '-';
            if (r.padletRating) {
                // Show tiny Zongzis or stars
                ratingDisplay = `${'🍙'.repeat(r.padletRating)} (${r.padletRating})`;
            }
            const padletCell = `
                <div>${ratingDisplay}</div>
                <div style="font-size:11px; color:#6c757d; margin-top:4px; max-width:200px; word-wrap:break-word; white-space:pre-line;">${r.padletFeedback || ''}</div>
            `;

            // Format sync cell
            const syncBadge = r.synced 
                ? '<span class="badge-sync done">已同步雲端</span>'
                : '<span class="badge-sync local">僅存本地</span>';

            tr.innerHTML = `
                <td style="white-space: nowrap; font-size:11px; color:#6c757d;">${r.timestamp}</td>
                <td style="font-weight: 700; color:var(--primary-color);">${escapeHTML(r.name)}</td>
                <td style="max-width:250px; word-wrap:break-word; white-space:pre-line;">${escapeHTML(r.takeaways)}</td>
                <td><span style="background:rgba(45, 106, 79, 0.05); padding:2px 8px; border-radius:12px; font-weight:600; font-size:11px;">${escapeHTML(r.impactfulActivity)}</span></td>
                <td>${padletCell}</td>
                <td style="max-width:220px; word-wrap:break-word; white-space:pre-line;">${escapeHTML(r.instructorFeedback)}</td>
                <td>${syncBadge}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
}

// Helper to escape HTML tags
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ==========================================================================
// CSV Export Functions
// ==========================================================================
function exportCSV() {
    if (responses.length === 0) {
        showToast('目前沒有任何填答資料可匯出！', 'error');
        return;
    }

    // CSV headers (UTF-8 BOM header for correct Traditional Chinese rendering in Excel)
    let csvContent = '\uFEFF'; 
    csvContent += '時間戳記,姓名,本日學習的收穫,最有感活動項目,Padlet操作評分,Padlet操作想法或疑問,給講師的一句話,同步狀態\n';

    responses.forEach(r => {
        const row = [
            r.timestamp,
            r.name,
            r.takeaways,
            r.impactfulActivity,
            r.padletRating || '未評分',
            r.padletFeedback || '',
            r.instructorFeedback,
            r.synced ? '已同步' : '未同步'
        ].map(val => {
            // Clean values for CSV escaping quotes
            let cleanVal = String(val).replace(/"/g, '""');
            return `"${cleanVal}"`;
        }).join(',');
        
        csvContent += row + '\n';
    });

    // Download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `端午學習問卷回饋表_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('問卷 CSV 資料已成功下載！📊', 'success');
}

// ==========================================================================
// Mock Data Seeding (Developer / Instructor testing helper)
// ==========================================================================
function seedMockData() {
    const mockResponses = [
        {
            id: 'mock_1',
            timestamp: new Date(Date.now() - 3600000 * 5).toLocaleString('zh-TW', { hour12: false }),
            name: '王小明',
            takeaways: '今天對 AI 寫作工具有了完整的認識，操作心法非常精湛實用！',
            impactfulActivity: '實務案例剖析',
            padletRating: 5,
            padletFeedback: 'Padlet 很好用！可以一眼看見大家上傳的點子，交流感覺非常熱烈！',
            instructorFeedback: '謝謝老師詳細又有趣的講解，收穫滿滿！',
            synced: false
        },
        {
            id: 'mock_2',
            timestamp: new Date(Date.now() - 3600000 * 4).toLocaleString('zh-TW', { hour12: false }),
            name: '李詩涵',
            takeaways: '學會了把複雜資訊結構化，並且能馬上有系統地進行分類歸納。',
            impactfulActivity: '小組腦力激盪',
            padletRating: 4,
            padletFeedback: '版面如果卡片很多的時候有點眼花，但操作算流暢。',
            instructorFeedback: '今天的小組活動設計得很巧妙，老師帶領的節奏也很棒！',
            synced: false
        },
        {
            id: 'mock_3',
            timestamp: new Date(Date.now() - 3600000 * 3.2).toLocaleString('zh-TW', { hour12: false }),
            name: '張家瑋',
            takeaways: '終於搞懂 Padlet 的幾種牆面格式差異，對於未來做專案管理很有幫助！',
            impactfulActivity: 'Padlet實機操作',
            padletRating: 5,
            padletFeedback: '用來收斂想法超直覺，我們組做得很開心！',
            instructorFeedback: '大推！老師非常有耐心，一步步操作對新手很友善。',
            synced: false
        },
        {
            id: 'mock_4',
            timestamp: new Date(Date.now() - 3600000 * 2.5).toLocaleString('zh-TW', { hour12: false }),
            name: '陳雅婷',
            takeaways: '透過案例學習避開專案盲點，這對工作非常實用。',
            impactfulActivity: '實務案例剖析',
            padletRating: 3,
            padletFeedback: '手機版瀏覽跟發文按鈕有點擠，要找一下位置。',
            instructorFeedback: '簡報做得超級精美，很有設計感！',
            synced: false
        },
        {
            id: 'mock_5',
            timestamp: new Date(Date.now() - 3600000 * 1.1).toLocaleString('zh-TW', { hour12: false }),
            name: '林志豪',
            takeaways: '在破冰活動跟其他部門的夥伴認識，很喜歡課程的互動氛圍！',
            impactfulActivity: '破冰相見歡',
            padletRating: 4,
            padletFeedback: '可以直接貼連結或拖拽圖片，覺得很方便。',
            instructorFeedback: '希望之後還能上老師的其他課程！',
            synced: false
        }
    ];

    responses = [...responses, ...mockResponses];
    localStorage.setItem('survey_responses', JSON.stringify(responses));
    
    showToast('成功載入 5 筆學員模擬測試數據！📊', 'success');
    renderDashboard();
    
    // Close modal if open
    document.getElementById('settings-modal').classList.remove('active');
}

function clearAllData() {
    if (confirm('確定要清空所有已收集的填答資料嗎？此操作不可逆。')) {
        responses = [];
        localStorage.removeItem('survey_responses');
        showToast('資料庫已清空', 'error');
        renderDashboard();
        
        // Close modal if open
        document.getElementById('settings-modal').classList.remove('active');
    }
}

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();

    // Auto dismiss
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3500);
}

// ==========================================================================
// IndexedDB Music File Manager & Loaders
// ==========================================================================
const DB_NAME = 'BGMDatabase';
const STORE_NAME = 'bgmStore';

function openBgmDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveBgmToDB(blob, fileName) {
    const db = await openBgmDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(blob, 'custom_bgm');
        request.onsuccess = () => {
            localStorage.setItem('custom_bgm_filename', fileName);
            resolve();
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function loadBgmFromDB() {
    const db = await openBgmDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get('custom_bgm');
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function deleteBgmFromDB() {
    const db = await openBgmDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete('custom_bgm');
        request.onsuccess = () => {
            localStorage.removeItem('custom_bgm_filename');
            resolve();
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function initBgmSource() {
    try {
        const customBlob = await loadBgmFromDB();
        let srcChanged = false;
        
        if (customBlob) {
            const blobUrl = URL.createObjectURL(customBlob);
            if (bgmPlayer.src !== blobUrl) {
                bgmPlayer.src = blobUrl;
                srcChanged = true;
            }
            updateBgmStatusUI(localStorage.getItem('custom_bgm_filename') || '自訂本地音樂檔案');
        } else {
            // Check literal src attribute to prevent reloading default file
            const currentSrc = bgmPlayer.getAttribute('src');
            if (currentSrc !== 'bgm.mp3') {
                bgmPlayer.src = 'bgm.mp3';
                srcChanged = true;
            }
            updateBgmStatusUI('');
        }

        // If source was changed, and user has already interacted, resume playback
        if (srcChanged && hasUserInteracted && isMusicPlaying) {
            playMusic();
        }
    } catch (e) {
        console.error('Failed to load custom BGM from IndexedDB:', e);
        const currentSrc = bgmPlayer.getAttribute('src');
        if (currentSrc !== 'bgm.mp3') {
            bgmPlayer.src = 'bgm.mp3';
        }
        updateBgmStatusUI('');
    }
}

function updateBgmStatusUI(filename) {
    const statusText = document.getElementById('upload-status');
    const clearBtn = document.getElementById('btn-clear-bgm-file');
    if (!statusText || !clearBtn) return;

    if (filename) {
        statusText.innerText = `已載入自訂配樂：${filename}`;
        clearBtn.classList.remove('hidden');
    } else {
        statusText.innerText = '正在播放系統預設配樂 (bgm.mp3)';
        clearBtn.classList.add('hidden');
    }
}
