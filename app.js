// === Supabase 專案設定資訊 ===
const SUPABASE_URL = 'https://otiyidlbqhypwqoafbgi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-QXTZjRq3Gsh4gOa1sUeHA_ahrsoFFe';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authSection = document.getElementById('auth-section');
const adminSection = document.getElementById('admin-section');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authMsg = document.getElementById('auth-msg');
const userInfo = document.getElementById('user-info');

let currentActiveTab = 'classes-tab'; 
let currentAnnSubTab = 'announcements'; 
let currentFinSubTab = 'reports'; 
let currentDeleteType = null; 

// 暫存當前正在編輯/新增的報表明細陣列（表身）
let currentReportDetails = [];
let activeEditingDetailIndex = -1; // -1 代表新增，>=0 代表編輯中的明細索引

// === 全螢幕載入中控制函數 ===
function showLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// === Supabase Storage 圖片上傳通用邏輯 (支援 PNG, JPG, JPEG) ===
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const BUCKET_NAME = 'receipts-and-attachments';

window.handleDragOver = function(e, type) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById(`${type}-drop-zone`);
    if (dropZone) dropZone.classList.add('drag-over');
};

window.handleDragLeave = function(e, type) {
    e.preventDefault();
    e.stopPropagation();
    const dropZone = document.getElementById(`${type}-drop-zone`);
    if (dropZone) dropZone.classList.remove('drag-over');
};

window.handleDrop = function(e, type) {
    e.preventDefault();
    e.stopPropagation();
    handleDragLeave(e, type);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        uploadImageToSupabase(files[0], type);
    }
};

window.handleFileSelect = function(e, type) {
    const files = e.target.files;
    if (files && files.length > 0) {
        uploadImageToSupabase(files[0], type);
    }
};

window.reselectFile = function(type) {
    const inputEl = document.getElementById(`${type}-file-input`);
    if (inputEl) inputEl.click();
};

async function uploadImageToSupabase(file, type) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        showToast('副檔名不符合！僅限制上傳 PNG, JPG, JPEG 格式圖檔', 'error');
        return;
    }

    showToast('圖片上傳中...', 'success');

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const folderPath = type === 'receipt' ? 'receipts' : 'attachments';
    const filePath = `${folderPath}/${fileName}`;

    const { data, error } = await supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

    if (error) {
        showToast('圖片上傳失敗: ' + error.message, 'error');
        return;
    }

    const { data: publicUrlData } = supabaseClient.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    if (type === 'receipt') {
        document.getElementById('modal-detail-receipt').value = publicUrl;
        showImagePreview('receipt', publicUrl);
    } else if (type === 'ann') {
        document.getElementById('ann-attachment-url').value = publicUrl;
        showImagePreview('ann', publicUrl);
    }

    showToast('圖片上傳成功！');
}

function showImagePreview(type, url) {
    const promptEl = document.getElementById(`${type}-upload-prompt`);
    const containerEl = document.getElementById(`${type}-upload-preview-container`);
    const imgEl = document.getElementById(`${type}-upload-preview-img`);

    if (url) {
        imgEl.src = url;
        containerEl.classList.remove('hidden');
        promptEl.classList.add('hidden');
    } else {
        containerEl.classList.add('hidden');
        promptEl.classList.remove('hidden');
        imgEl.src = '';
    }
}

// 自訂 Toast 提示訊息
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// 初始化 24 小時制下拉選單
function init24HourSelects() {
    const targets = [
        { h: 'ann-start-hour', m: 'ann-start-minute' },
        { h: 'ann-end-hour', m: 'ann-end-minute' },
        { h: 'fin-report-hour', m: 'fin-report-minute' }
    ];

    let hourHtml = '<option value="">請選擇</option>';
    for (let i = 0; i < 24; i++) {
        const val = String(i).padStart(2, '0');
        hourHtml += `<option value="${val}">${val}</option>`;
    }

    let minHtml = '<option value="">請選擇</option>';
    for (let i = 0; i < 60; i += 1) {
        const val = String(i).padStart(2, '0');
        minHtml += `<option value="${val}">${val}</option>`;
    }

    targets.forEach(t => {
        const hEl = document.getElementById(t.h);
        const mEl = document.getElementById(t.m);
        if (hEl) hEl.innerHTML = hourHtml;
        if (mEl) mEl.innerHTML = minHtml;
    });
}

function setTimeDropdownsByPrefix(prefix, timeStr) {
    const hSelect = document.getElementById(`${prefix}-hour`);
    const mSelect = document.getElementById(`${prefix}-minute`);
    if (timeStr && timeStr !== 'null' && timeStr.includes(':')) {
        const parts = timeStr.split(':');
        if (hSelect) hSelect.value = parts[0];
        if (mSelect) mSelect.value = parts[1];
    } else {
        if (hSelect) hSelect.value = '';
        if (mSelect) mSelect.value = '';
    }
}

function getTimeFromDropdownsByPrefix(prefix) {
    const hEl = document.getElementById(`${prefix}-hour`);
    const mEl = document.getElementById(`${prefix}-minute`);
    if (hEl && mEl && hEl.value && mEl.value) {
        return `${hEl.value}:${mEl.value}`;
    }
    return null;
}

// 主頁籤切換
window.switchTab = function(tabId) {
    currentActiveTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (btn) btn.classList.add('active');
    }
    
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'classes-tab') loadClasses();
    else if (tabId === 'ann-main-tab') {
        if (currentAnnSubTab === 'announcements') loadAnnouncements();
        else loadAnnouncementCategories();
    }
    else if (tabId === 'fin-main-tab') {
        if (currentFinSubTab === 'reports') loadFinancialReports();
        else loadFinancialCategories();
    }
};

// 公告子頁籤切換
window.switchAnnSubTab = function(subType) {
    currentAnnSubTab = subType;
    document.getElementById('sub-pill-ann').classList.toggle('active', subType === 'announcements');
    document.getElementById('sub-pill-cat').classList.toggle('active', subType === 'ann-cat');
    document.getElementById('ann-list-view').classList.toggle('hidden', subType !== 'announcements');
    document.getElementById('ann-cat-list-view').classList.toggle('hidden', subType !== 'ann-cat');

    if (subType === 'announcements') loadAnnouncements();
    else loadAnnouncementCategories();
};

// 財務子頁籤切換
window.switchFinSubTab = function(subType) {
    currentFinSubTab = subType;
    document.getElementById('sub-pill-fin-rep').classList.toggle('active', subType === 'reports');
    document.getElementById('sub-pill-fin-cat').classList.toggle('active', subType === 'fin-cat');
    document.getElementById('fin-report-view').classList.toggle('hidden', subType !== 'reports');
    document.getElementById('fin-cat-view').classList.toggle('hidden', subType !== 'fin-cat');

    if (subType === 'reports') loadFinancialReports();
    else loadFinancialCategories();
};

// 右下角 FAB 按鈕動作
window.handleFabClick = function() {
    if (currentActiveTab === 'classes-tab') openAddClassModal();
    else if (currentActiveTab === 'ann-main-tab') {
        if (currentAnnSubTab === 'announcements') openAddAnnModal();
        else openAddAnnCatModal();
    }
    else if (currentActiveTab === 'fin-main-tab') {
        if (currentFinSubTab === 'reports') openAddFinancialReportModal();
        else openAddFinancialCategoryModal();
    }
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
};

async function checkUser() {
    showLoading();
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            authSection.classList.add('hidden');
            adminSection.classList.remove('hidden');
            userInfo.textContent = `管理者: ${session.user.email}`;
            init24HourSelects();
            await loadClasses();
            await loadAnnouncementCategories();
            await loadAnnouncements();
            await loadFinancialCategories();
            await loadFinancialReports();
        } else {
            authSection.classList.remove('hidden');
            adminSection.classList.add('hidden');
        }
    } finally {
        hideLoading();
    }
}

loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    authMsg.textContent = '';
    showLoading();
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) authMsg.textContent = '登入失敗: ' + error.message;
        else await checkUser();
    } finally {
        hideLoading();
    }
});

logoutBtn.addEventListener('click', async () => {
    showLoading();
    try {
        await supabaseClient.auth.signOut();
        await checkUser();
    } finally {
        hideLoading();
    }
});

/* ===================================================
 * 1. 班級管理 (classes)
 * =================================================== */
const classListTable = document.getElementById('class-list-table');
const classModal = document.getElementById('class-modal');
const classModalTitle = document.getElementById('class-modal-title');
const classModalDeleteBtn = document.getElementById('class-modal-delete-btn');
const classEditUid = document.getElementById('class-edit-uid');
const classYear = document.getElementById('class-year');
const classCode = document.getElementById('class-code');
const className = document.getElementById('class-name');
const saveClassBtn = document.getElementById('save-class-btn');

async function loadClasses() {
    showLoading();
    try {
        const { data } = await supabaseClient.from('classes').select('*').order('academic_year', { ascending: false });
        classListTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                classListTable.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info">
                            <div class="card-title">${item.name}</div>
                            <div class="card-sub">${item.academic_year} ${item.class_name}</div>
                        </div>
                        <button class="icon-edit-btn" onclick="openEditClassModal('${item.uid}', '${item.academic_year}', '${item.class_name}', '${item.name}')" title="編輯">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                `;
            });
        } else {
            classListTable.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無班級資料</div>`;
        }
    } finally {
        hideLoading();
    }
}

window.openAddClassModal = function() {
    classEditUid.value = '';
    classYear.value = '';
    classCode.value = '';
    className.value = '';
    classModalTitle.textContent = '新增班級';
    saveClassBtn.textContent = '新增紀錄';
    classModalDeleteBtn.classList.add('hidden');
    classModal.classList.remove('hidden');
};

window.openEditClassModal = function(uid, year, code, name) {
    classEditUid.value = uid;
    classYear.value = year;
    classCode.value = code;
    className.value = name;
    classModalTitle.textContent = '編輯班級';
    saveClassBtn.textContent = '更新紀錄';
    classModalDeleteBtn.classList.remove('hidden');
    classModal.classList.remove('hidden');
};

saveClassBtn.addEventListener('click', async () => {
    const academic_year = classYear.value;
    const class_name = classCode.value;
    const name = className.value;
    const uid = classEditUid.value;
    if (!academic_year || !class_name || !name) return showToast('請填寫所有欄位！', 'error');

    showLoading();
    try {
        if (uid) {
            const { error } = await supabaseClient.from('classes').update({ academic_year, class_name, name }).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('class-modal'); await loadClasses(); }
        } else {
            const { error } = await supabaseClient.from('classes').insert([{ academic_year, class_name, name }]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('class-modal'); await loadClasses(); }
        }
    } finally {
        hideLoading();
    }
});

/* ===================================================
 * 2. 公告類別管理 (announcement_categories)
 * =================================================== */
const annCatListTable = document.getElementById('ann-cat-list-table');
const annCatModal = document.getElementById('ann-cat-modal');
const annCatModalTitle = document.getElementById('ann-cat-modal-title');
const annCatModalDeleteBtn = document.getElementById('ann-cat-modal-delete-btn');
const annCatEditUid = document.getElementById('ann-cat-edit-uid');
const annCatName = document.getElementById('ann-cat-name');
const annCatColor = document.getElementById('ann-cat-color');
const saveAnnCatBtn = document.getElementById('save-ann-cat-btn');

async function loadAnnouncementCategories() {
    showLoading();
    try {
        const { data } = await supabaseClient.from('announcement_categories').select('*');
        annCatListTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const colorHex = item.color || '#ccc';
                annCatListTable.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info">
                            <div class="card-title">${item.name}</div>
                            <div class="card-sub" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                                <span class="color-badge" style="background-color: ${colorHex};"></span><span>${colorHex}</span>
                            </div>
                        </div>
                        <button class="icon-edit-btn" onclick="openEditAnnCatModal('${item.uid}', '${item.name}', '${item.color}')" title="編輯"><i class="fa-solid fa-pen"></i></button>
                    </div>
                `;
            });
        } else {
            annCatListTable.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無公告類別</div>`;
        }
    } finally {
        hideLoading();
    }
}

window.openAddAnnCatModal = function() {
    annCatEditUid.value = '';
    annCatName.value = '';
    annCatColor.value = '#1890ff';
    annCatModalTitle.textContent = '新增公告類別';
    saveAnnCatBtn.textContent = '新增紀錄';
    annCatModalDeleteBtn.classList.add('hidden');
    annCatModal.classList.remove('hidden');
};

window.openEditAnnCatModal = function(uid, name, color) {
    annCatEditUid.value = uid;
    annCatName.value = name;
    annCatColor.value = color || '#1890ff';
    annCatModalTitle.textContent = '編輯公告類別';
    saveAnnCatBtn.textContent = '更新紀錄';
    annCatModalDeleteBtn.classList.remove('hidden');
    annCatModal.classList.remove('hidden');
};

saveAnnCatBtn.addEventListener('click', async () => {
    const name = annCatName.value;
    const color = annCatColor.value;
    const uid = annCatEditUid.value;
    if (!name) return showToast('請填寫類別名稱！', 'error');

    showLoading();
    try {
        if (uid) {
            const { error } = await supabaseClient.from('announcement_categories').update({ name, color }).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('ann-cat-modal'); await loadAnnouncementCategories(); }
        } else {
            const { error } = await supabaseClient.from('announcement_categories').insert([{ name, color }]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('ann-cat-modal'); await loadAnnouncementCategories(); }
        }
    } finally {
        hideLoading();
    }
});

/* ===================================================
 * 3. 公告發布與管理 (announcements)
 * =================================================== */
const annListTable = document.getElementById('ann-list-table');
const annModal = document.getElementById('ann-modal');
const annModalTitle = document.getElementById('ann-modal-title');
const annModalDeleteBtn = document.getElementById('ann-modal-delete-btn');
const annEditUid = document.getElementById('ann-edit-uid');
const annClassSelect = document.getElementById('ann-class-select');
const annCatSelect = document.getElementById('ann-cat-select');
const annTitle = document.getElementById('ann-title');
const annNote = document.getElementById('ann-note');
const annAttachmentUrl = document.getElementById('ann-attachment-url');
const annIsPinned = document.getElementById('ann-is-pinned');
const saveAnnBtn = document.getElementById('save-ann-btn');

async function loadAnnouncements() {
    showLoading();
    try {
        const { data } = await supabaseClient
            .from('announcements')
            .select(`uid, name, note, attachment_url, class_uid, category_uid, start_date, start_time, end_date, end_time, is_pinned, classes ( academic_year, class_name, name ), announcement_categories ( name, color )`)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        annListTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const classNameText = item.classes ? `${item.classes.academic_year} ${item.classes.class_name} - ${item.classes.name}` : '未指定';
                const catName = item.announcement_categories ? item.announcement_categories.name : '未指定';
                const catColor = item.announcement_categories ? item.announcement_categories.color : '#64748b';
                const pinBadge = item.is_pinned ? `<span class="pin-tag">置頂</span>` : '';
                
                let timeRangeText = '';
                const hasStart = item.start_date && item.start_date !== 'null';
                const hasEnd = item.end_date && item.end_date !== 'null';
                const startTimeStr = item.start_time ? ` ${item.start_time}` : '';
                const endTimeStr = item.end_time ? ` ${item.end_time}` : '';

                if (!hasStart && !hasEnd) timeRangeText = '無期限';
                else if (hasStart && !hasEnd) timeRangeText = `${item.start_date}${startTimeStr} 起`;
                else if (!hasStart && hasEnd) timeRangeText = `到 ${item.end_date}${endTimeStr} 為止`;
                else timeRangeText = `${item.start_date}${startTimeStr} ~ ${item.end_date}${endTimeStr}`;
                
                annListTable.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info" style="width: calc(100% - 45px);">
                            <div class="card-title">${pinBadge}${item.name}</div>
                            <div class="card-sub" style="margin-top: 6px; line-height: 1.5;">
                                <div style="margin-bottom: 4px;">
                                    <span class="category-badge" style="background-color: ${catColor};">${catName}</span>
                                </div>
                                <div style="color: #64748b;">${classNameText}</div>
                                <div style="color: #475569; font-size: 12px;"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${timeRangeText}</div>
                            </div>
                        </div>
                        <button class="icon-edit-btn" onclick="openEditAnnModal('${item.uid}', '${item.class_uid || ''}', '${item.category_uid || ''}', '${encodeURIComponent(item.name || '')}', '${encodeURIComponent(item.note || '')}', '${encodeURIComponent(item.attachment_url || '')}', '${item.start_date || ''}', '${item.start_time || ''}', '${item.end_date || ''}', '${item.end_time || ''}', ${item.is_pinned || false})" title="編輯"><i class="fa-solid fa-pen"></i></button>
                    </div>
                `;
            });
        } else {
            annListTable.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無公告資料</div>`;
        }
    } finally {
        hideLoading();
    }
}

async function loadAnnOptions() {
    const { data: classes } = await supabaseClient.from('classes').select('*');
    annClassSelect.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    if (classes) classes.forEach(c => annClassSelect.innerHTML += `<option value="${c.uid}">${c.academic_year} ${c.class_name} - ${c.name}</option>`);

    const { data: categories } = await supabaseClient.from('announcement_categories').select('*');
    annCatSelect.innerHTML = '<option value="">-- 請選擇公告類別 --</option>';
    if (categories) categories.forEach(cat => annCatSelect.innerHTML += `<option value="${cat.uid}">${cat.name}</option>`);
}

window.openAddAnnModal = async function() {
    showLoading();
    try {
        await loadAnnOptions();
        annEditUid.value = ''; annTitle.value = ''; annNote.value = ''; annAttachmentUrl.value = '';
        showImagePreview('ann', '');
        setTimeDropdownsByPrefix('ann-start', '');
        setTimeDropdownsByPrefix('ann-end', '');
        setCustomDateValue('start', '');
        setCustomDateValue('end', '');
        annIsPinned.checked = false;

        annModalTitle.textContent = '新增公告'; saveAnnBtn.textContent = '新增紀錄';
        annModalDeleteBtn.classList.add('hidden'); annModal.classList.remove('hidden');
    } finally {
        hideLoading();
    }
};

window.openEditAnnModal = async function(uid, classUid, catUid, encodedName, encodedNote, encodedAttachmentUrl, startDate, startTime, endDate, endTime, isPinned) {
    showLoading();
    try {
        await loadAnnOptions();
        annEditUid.value = uid; annClassSelect.value = classUid; annCatSelect.value = catUid;
        annTitle.value = decodeURIComponent(encodedName); 
        annNote.value = decodeURIComponent(encodedNote);
        const attachmentUrl = decodeURIComponent(encodedAttachmentUrl || '');
        annAttachmentUrl.value = attachmentUrl;
        showImagePreview('ann', attachmentUrl);

        setTimeDropdownsByPrefix('ann-start', startTime);
        setTimeDropdownsByPrefix('ann-end', endTime);
        setCustomDateValue('start', startDate !== 'null' ? startDate : '');
        setCustomDateValue('end', endDate !== 'null' ? endDate : '');
        annIsPinned.checked = isPinned === 'true' || isPinned === true;

        annModalTitle.textContent = '編輯公告'; saveAnnBtn.textContent = '更新紀錄';
        annModalDeleteBtn.classList.remove('hidden'); annModal.classList.remove('hidden');
    } finally {
        hideLoading();
    }
};

saveAnnBtn.addEventListener('click', async () => {
    const class_uid = annClassSelect.value;
    const category_uid = annCatSelect.value;
    const name = annTitle.value;
    const note = annNote.value;
    const attachment_url = annAttachmentUrl.value.trim() || null;
    const start_date = document.getElementById('ann-start-date').value || null;
    const end_date = document.getElementById('ann-end-date').value || null;
    const start_time = getTimeFromDropdownsByPrefix('ann-start');
    const end_time = getTimeFromDropdownsByPrefix('ann-end');
    const is_pinned = annIsPinned.checked;
    const uid = annEditUid.value;

    if (!class_uid || !category_uid || !name) return showToast('請選擇班級、類別並填寫標題！', 'error');

    showLoading();
    try {
        const payload = { class_uid, category_uid, name, note, attachment_url, start_date, start_time, end_date, end_time, is_pinned };
        if (uid) {
            const { error } = await supabaseClient.from('announcements').update(payload).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('ann-modal'); await loadAnnouncements(); }
        } else {
            const { error } = await supabaseClient.from('announcements').insert([payload]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('ann-modal'); await loadAnnouncements(); }
        }
    } finally {
        hideLoading();
    }
});

/* ===================================================
 * 4. 財務類別管理 (financial_categories)
 * =================================================== */
const finCatList = document.getElementById('fin-cat-list');
const finCatModal = document.getElementById('fin-cat-modal');
const finCatModalTitle = document.getElementById('fin-cat-modal-title');
const finCatModalDeleteBtn = document.getElementById('fin-cat-modal-delete-btn');
const finCatEditUid = document.getElementById('fin-cat-edit-uid');
const finCatName = document.getElementById('fin-cat-name');
const finCatColor = document.getElementById('fin-cat-color');
const saveFinCatBtn = document.getElementById('save-fin-cat-btn');

async function loadFinancialCategories() {
    showLoading();
    try {
        const { data } = await supabaseClient.from('financial_categories').select('*');
        finCatList.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const colorHex = item.color || '#faad14';
                finCatList.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info">
                            <div class="card-title">${item.name}</div>
                            <div class="card-sub" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                                <span class="color-badge" style="background-color: ${colorHex};"></span><span>${colorHex}</span>
                            </div>
                        </div>
                        <button class="icon-edit-btn" onclick="openEditFinancialCategoryModal('${item.uid}', '${item.name}', '${item.color}')" title="編輯"><i class="fa-solid fa-pen"></i></button>
                    </div>
                `;
            });
        } else {
            finCatList.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無財務類別</div>`;
        }
    } finally {
        hideLoading();
    }
}

window.openAddFinancialCategoryModal = function() {
    finCatEditUid.value = '';
    finCatName.value = '';
    finCatColor.value = '#faad14';
    finCatModalTitle.textContent = '新增財務類別';
    saveFinCatBtn.textContent = '新增紀錄';
    finCatModalDeleteBtn.classList.add('hidden');
    finCatModal.classList.remove('hidden');
};

window.openEditFinancialCategoryModal = function(uid, name, color) {
    finCatEditUid.value = uid;
    finCatName.value = name;
    finCatColor.value = color || '#faad14';
    finCatModalTitle.textContent = '編輯財務類別';
    saveFinCatBtn.textContent = '更新紀錄';
    finCatModalDeleteBtn.classList.remove('hidden');
    finCatModal.classList.remove('hidden');
};

saveFinCatBtn.addEventListener('click', async () => {
    const name = finCatName.value;
    const color = finCatColor.value;
    const uid = finCatEditUid.value;
    if (!name) return showToast('請填寫類別名稱！', 'error');

    showLoading();
    try {
        if (uid) {
            const { error } = await supabaseClient.from('financial_categories').update({ name, color }).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('fin-cat-modal'); await loadFinancialCategories(); }
        } else {
            const { error } = await supabaseClient.from('financial_categories').insert([{ name, color }]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('fin-cat-modal'); await loadFinancialCategories(); }
        }
    } finally {
        hideLoading();
    }
});

/* ===================================================
 * 5. 財務報表主檔與表身整合管理 (financial_reports)
 * =================================================== */
const finReportList = document.getElementById('fin-report-list');
const finReportModal = document.getElementById('fin-report-modal');
const finReportModalTitle = document.getElementById('fin-report-modal-title');
const finReportModalDeleteBtn = document.getElementById('fin-report-modal-delete-btn');
const finReportEditUid = document.getElementById('fin-report-edit-uid');
const finReportName = document.getElementById('fin-report-name');
const finReportClassSelect = document.getElementById('fin-report-class-select');
const finReportCatSelect = document.getElementById('fin-report-cat-select');
const finReportSemesterSelect = document.getElementById('fin-report-semester-select');
const saveFinReportBtn = document.getElementById('save-fin-report-btn');

// 表身明細相關元素
const modalDetailsList = document.getElementById('modal-details-list');
const modalDetailsSummary = document.getElementById('modal-details-summary');

// 明細子彈窗元素
const detailModal = document.getElementById('detail-modal');
const detailModalTitle = document.getElementById('detail-modal-title');
const detailModalDeleteBtn = document.getElementById('detail-modal-delete-btn');
const modalDetailName = document.getElementById('modal-detail-name');
const modalDetailType = document.getElementById('modal-detail-type');
const modalDetailAmount = document.getElementById('modal-detail-amount');
const modalDetailRemark = document.getElementById('modal-detail-remark');
const modalDetailReceipt = document.getElementById('modal-detail-receipt');
const saveDetailItemBtn = document.getElementById('save-detail-item-btn');

async function loadFinancialReports() {
    showLoading();
    try {
        const { data } = await supabaseClient
            .from('financial_reports')
            .select(`
                uid, name, date, time, class_uid, category_uid, semester_uid,
                classes ( academic_year, class_name, name ),
                financial_categories ( name, color ),
                semesters ( name )
            `)
            .order('date', { ascending: false });

        finReportList.innerHTML = '';
        if (data && data.length > 0) {
            for (let item of data) {
                const { data: details } = await supabaseClient
                    .from('financial_report_details')
                    .select('*')
                    .eq('report_uid', item.uid);
                
                let totalInc = 0, totalExp = 0;
                if (details) {
                    details.forEach(d => {
                        if (Number(d.type) === 1) totalInc += Number(d.amount) || 0;
                        else if (Number(d.type) === 0) totalExp += Number(d.amount) || 0;
                    });
                }
                const balance = totalInc - totalExp;
                const balanceColor = balance >= 0 ? '#00b96b' : '#ff4d4f';
                const balanceDisplay = `${balance >= 0 ? '+' : ''}$${balance.toLocaleString()}`;

                const classNameText = item.classes ? `${item.classes.academic_year} ${item.classes.class_name} - ${item.classes.name}` : '未指定班級';
                const catName = item.financial_categories ? item.financial_categories.name : '未指定類別';
                const catColor = item.financial_categories ? (item.financial_categories.color || '#faad14') : '#faad14';
                const semesterName = item.semesters ? item.semesters.name : '未指定學期';
                const dateTimeText = `${item.date || '無日期'} ${item.time || ''}`;

                finReportList.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info" style="flex: 1; min-width: 0; padding-right: 15px;">
                            <div class="card-title">${item.name}</div>
                            <div class="card-sub" style="margin-top: 6px; line-height: 1.5;">
                                <div style="margin-bottom: 4px;">
                                    <span class="category-badge" style="background-color: ${catColor};">${catName}</span>
                                </div>
                                <div style="color: #64748b;">${classNameText} &nbsp;|&nbsp; 學期: ${semesterName}</div>
                                <div style="color: #475569; font-size: 12px;"><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>${dateTimeText}</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0;">
                            <span style="color: ${balanceColor}; font-weight: bold; font-size: 16px;">${balanceDisplay}</span>
                            <button class="icon-edit-btn" onclick="openEditFinancialReportModal('${item.uid}', '${encodeURIComponent(item.name || '')}', '${item.date || ''}', '${item.time || ''}', '${item.class_uid || ''}', '${item.category_uid || ''}', '${item.semester_uid || ''}')" title="編輯報表與明細">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        } else {
            finReportList.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無財務報表</div>`;
        }
    } finally {
        hideLoading();
    }
}

async function loadFinancialReportOptions() {
    const { data: classes } = await supabaseClient.from('classes').select('*');
    finReportClassSelect.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    if (classes) classes.forEach(c => finReportClassSelect.innerHTML += `<option value="${c.uid}">${c.academic_year} ${c.class_name} - ${c.name}</option>`);

    const { data: categories } = await supabaseClient.from('financial_categories').select('*');
    finReportCatSelect.innerHTML = '<option value="">-- 請選擇財務類別 --</option>';
    if (categories) categories.forEach(cat => finReportCatSelect.innerHTML += `<option value="${cat.uid}">${cat.name}</option>`);

    const { data: semesters } = await supabaseClient.from('semesters').select('*');
    finReportSemesterSelect.innerHTML = '<option value="">-- 請選擇學期 --</option>';
    if (semesters) semesters.forEach(sem => finReportSemesterSelect.innerHTML += `<option value="${sem.uid}">${sem.name}</option>`);
}

window.openAddFinancialReportModal = async function() {
    showLoading();
    try {
        await loadFinancialReportOptions();
        finReportEditUid.value = ''; 
        finReportName.value = ''; 
        finReportSemesterSelect.value = '';
        setTimeDropdownsByPrefix('fin-report', '');
        setCustomDateValue('fin-report', '');
        
        currentReportDetails = [];
        renderModalDetailsList();

        finReportModalTitle.textContent = '新增財務報表（含明細）'; 
        saveFinReportBtn.textContent = '確認儲存';
        finReportModalDeleteBtn.classList.add('hidden'); 
        finReportModal.classList.remove('hidden');
    } finally {
        hideLoading();
    }
};

window.openEditFinancialReportModal = async function(uid, encodedName, date, time, classUid, catUid, semesterUid) {
    showLoading();
    try {
        await loadFinancialReportOptions();
        finReportEditUid.value = uid;
        finReportName.value = decodeURIComponent(encodedName);
        finReportClassSelect.value = classUid !== 'null' ? classUid : '';
        finReportCatSelect.value = catUid !== 'null' ? catUid : '';
        finReportSemesterSelect.value = semesterUid !== 'null' ? semesterUid : '';
        
        setTimeDropdownsByPrefix('fin-report', time);
        setCustomDateValue('fin-report', date !== 'null' ? date : '');

        const { data: details } = await supabaseClient
            .from('financial_report_details')
            .select('*')
            .eq('report_uid', uid);
        
        currentReportDetails = details ? details.map(d => ({
            uid: d.uid,
            name: d.name,
            type: Number(d.type),
            amount: d.amount,
            remark: d.remark || '',
            receipt_url: d.receipt_url || ''
        })) : [];
        renderModalDetailsList();

        finReportModalTitle.textContent = '編輯財務報表與明細'; 
        saveFinReportBtn.textContent = '更新紀錄';
        finReportModalDeleteBtn.classList.remove('hidden'); 
        finReportModal.classList.remove('hidden');
    } finally {
        hideLoading();
    }
};

/* --- 明細彈窗操作與邏輯 --- */
window.openAddDetailModal = function() {
    activeEditingDetailIndex = -1;
    modalDetailName.value = '';
    modalDetailType.value = '0'; // 預設支出
    modalDetailAmount.value = '';
    modalDetailRemark.value = '';
    modalDetailReceipt.value = '';
    showImagePreview('receipt', '');
    detailModalTitle.textContent = '新增明細項目';
    detailModalDeleteBtn.classList.add('hidden');
    detailModal.classList.remove('hidden');
};

window.openEditDetailModal = function(index) {
    activeEditingDetailIndex = index;
    const item = currentReportDetails[index];
    modalDetailName.value = item.name || '';
    modalDetailType.value = String(item.type);
    modalDetailAmount.value = item.amount || '';
    modalDetailRemark.value = item.remark || '';
    modalDetailReceipt.value = item.receipt_url || '';
    showImagePreview('receipt', item.receipt_url || '');
    detailModalTitle.textContent = '編輯明細項目';
    detailModalDeleteBtn.classList.remove('hidden');
    detailModal.classList.remove('hidden');
};

window.removeModalDetailItem = function(index) {
    currentReportDetails.splice(index, 1);
    renderModalDetailsList();
};

window.deleteCurrentDetailFromModal = function() {
    if (activeEditingDetailIndex >= 0) {
        removeModalDetailItem(activeEditingDetailIndex);
        closeModal('detail-modal');
        showToast('明細已刪除');
    }
};

saveDetailItemBtn.addEventListener('click', () => {
    const name = modalDetailName.value.trim();
    const type = parseInt(modalDetailType.value);
    const amount = parseFloat(modalDetailAmount.value);
    const remark = modalDetailRemark.value.trim();
    const receipt_url = modalDetailReceipt.value.trim();

    if (!name) return showToast('請填寫明細名稱！', 'error');
    if (isNaN(amount) || amount <= 0) return showToast('請輸入有效金額！', 'error');

    const detailData = { name, type, amount, remark, receipt_url };

    if (activeEditingDetailIndex >= 0) {
        currentReportDetails[activeEditingDetailIndex] = {
            ...currentReportDetails[activeEditingDetailIndex],
            ...detailData
        };
        showToast('明細已更新');
    } else {
        currentReportDetails.push(detailData);
        showToast('明細已加入');
    }

    closeModal('detail-modal');
    renderModalDetailsList();
});

function renderModalDetailsList() {
    modalDetailsList.innerHTML = '';
    let totalInc = 0, totalExp = 0;

    if (currentReportDetails.length > 0) {
        currentReportDetails.forEach((item, index) => {
            const isInc = Number(item.type) === 1;
            const amt = Number(item.amount) || 0;
            if (isInc) totalInc += amt;
            else totalExp += amt;

            const badge = isInc 
                ? `<span style="background: #e6f4ff; color: #0969da; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">收入</span>`
                : `<span style="background: #fff1f0; color: #ff4d4f; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">支出</span>`;

            modalDetailsList.innerHTML += `
                <div class="custom-card-item" style="padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="card-info" style="width: calc(100% - 90px);">
                        <div class="card-title" style="font-size: 15px; display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                            ${badge} <span>${item.name}</span>
                        </div>
                        ${item.remark ? `<div class="card-sub" style="margin-top: 2px;">備註: ${item.remark}</div>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="color: ${isInc ? '#00b96b' : '#ff4d4f'}; font-weight: bold; font-size: 15px; text-align: right; white-space: nowrap;">
                            ${isInc ? '+' : '-'}$${amt.toLocaleString()}
                        </span>
                        <button type="button" class="icon-edit-btn" onclick="openEditDetailModal(${index})" title="編輯明細">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    } else {
        modalDetailsList.innerHTML = `<div style="text-align: center; color: #aaa; padding: 15px; font-size: 13px;">尚未新增任何明細項目（至少需有一筆）</div>`;
    }

    const balance = totalInc - totalExp;
    modalDetailsSummary.innerHTML = `
        總收入: <span style="color: #00b96b; font-weight: bold;">+$${totalInc.toLocaleString()}</span> | 
        總支出: <span style="color: #ff4d4f; font-weight: bold;">-$${totalExp.toLocaleString()}</span> | 
        結餘: <span style="color: #0969da; font-weight: bold;">$${balance.toLocaleString()}</span>
    `;
}

// 儲存表頭與表身
saveFinReportBtn.addEventListener('click', async () => {
    const name = finReportName.value.trim();
    const class_uid = finReportClassSelect.value;
    const category_uid = finReportCatSelect.value;
    const semester_uid = finReportSemesterSelect.value;
    const date = document.getElementById('fin-report-date').value;
    const time = getTimeFromDropdownsByPrefix('fin-report');
    const uid = finReportEditUid.value;

    if (!name) return showToast('請填寫報表名稱！', 'error');
    if (!class_uid) return showToast('請選擇班級！', 'error');
    if (!category_uid) return showToast('請選擇財務類別！', 'error');
    if (!semester_uid) return showToast('請選擇學期！', 'error');
    if (!date) return showToast('請選擇報表日期！', 'error');
    if (!time) return showToast('請選擇報表時間！', 'error');
    
    if (currentReportDetails.length === 0) {
        return showToast('財務報表必須包含至少一筆明細資料（表身），不可空白存檔！', 'error');
    }

    showLoading();
    try {
        const payload = { name, class_uid, category_uid, semester_uid, date, time };
        let reportUid = uid;

        if (reportUid) {
            const { error } = await supabaseClient.from('financial_reports').update(payload).eq('uid', reportUid);
            if (error) {
                showToast('修改主檔失敗: ' + error.message, 'error');
                return;
            }
            await supabaseClient.from('financial_report_details').delete().eq('report_uid', reportUid);
        } else {
            const { data: newRep, error } = await supabaseClient.from('financial_reports').insert([payload]).select().single();
            if (error) {
                showToast('新增主檔失敗: ' + error.message, 'error');
                return;
            }
            reportUid = newRep.uid;
        }

        const detailsPayload = currentReportDetails.map(d => ({
            report_uid: reportUid,
            name: d.name,
            type: d.type,
            amount: d.amount,
            remark: d.remark || null,
            receipt_url: d.receipt_url || null
        }));

        const { error: detailError } = await supabaseClient.from('financial_report_details').insert(detailsPayload);
        if (detailError) {
            showToast('明細儲存失敗: ' + detailError.message, 'error');
        } else {
            showToast('財務報表與明細儲存成功！');
            closeModal('fin-report-modal');
            await loadFinancialReports();
        }
    } finally {
        hideLoading();
    }
});

/* ===================================================
 * 6. 獨立置中 Modal 日曆核心邏輯
 * =================================================== */
let activeTargetType = null; 
let modalDPState = { year: 2026, month: 9 }; 
let selectedDates = { start: '', end: '', 'fin-report': '' };

window.openModalDatePicker = function(type) {
    activeTargetType = type;
    const existingVal = selectedDates[type];
    if (existingVal) {
        const parts = existingVal.split('-');
        modalDPState.year = parseInt(parts[0]);
        modalDPState.month = parseInt(parts[1]) - 1;
    } else {
        const now = new Date();
        modalDPState.year = now.getFullYear();
        modalDPState.month = now.getMonth();
    }
    document.getElementById('datepicker-modal').classList.remove('hidden');
    renderModalDPGrid();
};

window.closeModalDatePicker = function() {
    document.getElementById('datepicker-modal').classList.add('hidden');
};

window.changeDPMonth = function(delta) {
    modalDPState.month += delta;
    if (modalDPState.month > 11) {
        modalDPState.month = 0;
        modalDPState.year++;
    } else if (modalDPState.month < 0) {
        modalDPState.month = 11;
        modalDPState.year--;
    }
    renderModalDPGrid();
};

function renderModalDPGrid() {
    const y = modalDPState.year;
    const m = modalDPState.month;
    document.getElementById('dp-current-month').textContent = `${y} / ${String(m + 1).padStart(2, '0')}`;

    const gridEl = document.getElementById('dp-days-grid');
    gridEl.innerHTML = '';

    const firstDayIndex = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const prevTotalDays = new Date(y, m, 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const item = document.createElement('div');
        item.className = 'dp-day-item other';
        item.textContent = prevTotalDays - i;
        gridEl.appendChild(item);
    }

    for (let day = 1; day <= totalDays; day++) {
        const item = document.createElement('div');
        const formattedDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        item.className = 'dp-day-item';
        if (selectedDates[activeTargetType] === formattedDate) {
            item.classList.add('selected');
        }
        item.textContent = day;
        item.onclick = () => {
            setCustomDateValue(activeTargetType, formattedDate);
            closeModalDatePicker();
        };
        gridEl.appendChild(item);
    }
}

function setCustomDateValue(type, val) {
    selectedDates[type] = val;
    let inputEl = null;
    let displayEl = null;

    if (type === 'start' || type === 'end') {
        inputEl = document.getElementById(`ann-${type}-date`);
        displayEl = document.getElementById(`${type}-date-display`);
    } else if (type === 'fin-report') {
        inputEl = document.getElementById('fin-report-date');
        displayEl = document.getElementById('fin-report-date-display');
    }

    if (inputEl) inputEl.value = val;
    if (displayEl) {
        if (val) {
            displayEl.textContent = val.replace(/-/g, ' / ');
            displayEl.classList.remove('placeholder');
        } else {
            displayEl.textContent = '年 / 月 / 日';
            displayEl.classList.add('placeholder');
        }
    }
}

/* ===================================================
 * 7. 通用刪除二次確認 Modal 邏輯
 * =================================================== */
const confirmDeleteModal = document.getElementById('confirm-delete-modal');

window.openConfirmDeleteModal = function(type) {
    currentDeleteType = type;
    confirmDeleteModal.classList.remove('hidden');
};

window.closeConfirmDeleteModal = function() {
    confirmDeleteModal.classList.add('hidden');
};

window.executeDelete = async function() {
    showLoading();
    try {
        if (currentDeleteType === 'class') {
            const uid = classEditUid.value;
            const { error } = await supabaseClient.from('classes').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('class-modal'); await loadClasses(); }
        } else if (currentDeleteType === 'ann-cat') {
            const uid = annCatEditUid.value;
            const { error } = await supabaseClient.from('announcement_categories').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('ann-cat-modal'); await loadAnnouncementCategories(); }
        } else if (currentDeleteType === 'ann') {
            const uid = annEditUid.value;
            const { error } = await supabaseClient.from('announcements').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('ann-modal'); await loadAnnouncements(); }
        } else if (currentDeleteType === 'fin-cat') {
            const uid = finCatEditUid.value;
            const { error } = await supabaseClient.from('financial_categories').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('fin-cat-modal'); await loadFinancialCategories(); }
        } else if (currentDeleteType === 'fin-report') {
            const uid = finReportEditUid.value;
            await supabaseClient.from('financial_report_details').delete().eq('report_uid', uid);
            const { error } = await supabaseClient.from('financial_reports').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('fin-report-modal'); await loadFinancialReports(); }
        }
    } finally {
        hideLoading();
        closeConfirmDeleteModal();
    }
};

checkUser();