const authSection = document.getElementById('auth-section');
const adminSection = document.getElementById('admin-section');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authMsg = document.getElementById('auth-msg');

let currentActiveTab = 'ann-main-tab'; 
let currentAnnSubTab = 'announcements'; 
let currentFinSubTab = 'records'; 
let currentClassSubTab = 'classes'; 
let currentTrackSubTab = 'student_track_status'; 
let currentTrackStatusMode = 'simple'; 
let currentTrackTargetStatus = '缺交'; 
let currentDeleteType = null; 
let quillEditor = null; 
let savedRangeForLink = null; 

// 學生狀態對應顏色定義
const STATUS_COLORS = {
    '缺交': '#ff4d4f', // 紅色
    '已交': '#00b96b', // 綠色
    '補交': '#f5b041'  // 黃色
};

function resetModalScroll(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const card = modal.querySelector('.modal-card');
        if (card) card.scrollTop = 0;
    }
}

function initQuillEditor() {
    if (quillEditor) return;
    const container = document.getElementById('ann-quill-editor');
    if (!container) return;

    quillEditor = new Quill('#ann-quill-editor', {
        theme: 'snow',
        placeholder: '請在此輸入詳細公告內容...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'align': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'clean']
            ]
        }
    });

    const toolbar = quillEditor.getModule('toolbar');
    toolbar.addHandler('link', function(value) {
        if (value) {
            savedRangeForLink = quillEditor.getSelection();
            openLinkModal();
        } else {
            quillEditor.format('link', false);
        }
    });
}

function openLinkModal() {
    let modal = document.getElementById('custom-link-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-link-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>插入超連結</h3>
                    <button type="button" class="dp-x-btn" onclick="closeLinkModal()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <label>請輸入網址 (URL)</label>
                <input type="text" id="custom-link-input" placeholder="https://example.com" style="margin-bottom: 16px;">
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeLinkModal()">取消</button>
                    <button type="button" onclick="confirmInsertLink()">確認</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('custom-link-input').value = 'https://';
    modal.classList.remove('hidden');
    resetModalScroll('custom-link-modal');
    setTimeout(() => {
        const input = document.getElementById('custom-link-input');
        if (input) { input.focus(); input.select(); }
    }, 100);
}

window.closeLinkModal = function() {
    const modal = document.getElementById('custom-link-modal');
    if (modal) modal.classList.add('hidden');
};

window.confirmInsertLink = function() {
    const urlInput = document.getElementById('custom-link-input');
    const url = urlInput ? urlInput.value.trim() : '';
    if (url && quillEditor) {
        if (savedRangeForLink) quillEditor.setSelection(savedRangeForLink);
        quillEditor.format('link', url);
    }
    closeLinkModal();
};

function showLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('global-loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

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
    if (files && files.length > 0) uploadImageToSupabase(files[0], type);
};

window.handleFileSelect = function(e, type) {
    const files = e.target.files;
    if (files && files.length > 0) uploadImageToSupabase(files[0], type);
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
    const folderPath = type === 'fin-rcp' ? 'receipts' : 'attachments';
    const filePath = `${folderPath}/${fileName}`;

    const { data, error } = await supabaseClient.storage.from(BUCKET_NAME).upload(filePath, file);
    if (error) {
        showToast('圖片上傳失敗: ' + error.message, 'error');
        return;
    }
    const { data: publicUrlData } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;

    if (type === 'fin-rcp') {
        document.getElementById('fin-receipt-url').value = publicUrl;
        showImagePreview('fin-rcp', publicUrl);
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

function init24HourSelects() {
    const targets = [
        { h: 'ann-start-hour', m: 'ann-start-minute', defaultH: '00', defaultM: '00' },
        { h: 'ann-end-hour', m: 'ann-end-minute', defaultH: '23', defaultM: '59' }
    ];

    targets.forEach(t => {
        const hEl = document.getElementById(t.h);
        const mEl = document.getElementById(t.m);
        if (!hEl || !mEl) return;
        let hourHtml = '';
        for (let i = 0; i < 24; i++) {
            const val = String(i).padStart(2, '0');
            hourHtml += `<option value="${val}">${val}</option>`;
        }
        hEl.innerHTML = hourHtml;
        let minHtml = '';
        for (let i = 0; i < 60; i += 1) {
            const val = String(i).padStart(2, '0');
            minHtml += `<option value="${val}">${val}</option>`;
        }
        mEl.innerHTML = minHtml;
        if (t.defaultH) hEl.value = t.defaultH;
        if (t.defaultM) mEl.value = t.defaultM;
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
        if (hSelect) hSelect.value = prefix.includes('start') ? '00' : '23';
        if (mSelect) mSelect.value = prefix.includes('start') ? '00' : '59';
    }
}

function getTimeFromDropdownsByPrefix(prefix) {
    const hEl = document.getElementById(`${prefix}-hour`);
    const mEl = document.getElementById(`${prefix}-minute`);
    if (hEl && mEl && hEl.value && mEl.value) return `${hEl.value}:${mEl.value}`;
    return null;
}

window.clearDateRange = function(type) {
    setCustomDateValue(type, '');
    const defH = type === 'start' ? '00' : '23';
    const defM = type === 'start' ? '00' : '59';
    const hEl = document.getElementById(`ann-${type}-hour`);
    const mEl = document.getElementById(`ann-${type}-minute`);
    if (hEl) hEl.value = defH;
    if (mEl) mEl.value = defM;
};

window.switchTab = async function(tabId) {
    currentActiveTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    } else {
        const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (btn) btn.classList.add('active');
    }
    
    document.getElementById(tabId).classList.add('active');

    const fabBtn = document.getElementById('main-fab-btn');
    if (fabBtn) {
        if (tabId === 'track-main-tab' && currentTrackSubTab === 'student_track_status') {
            fabBtn.classList.add('hidden');
        } else {
            fabBtn.classList.remove('hidden');
        }
    }

    await loadGlobalAnnClasses();
    await loadGlobalFinFilters();
    await loadGlobalTrackFilters();

    if (tabId === 'classes-tab') {
        if (currentClassSubTab === 'classes') loadClasses();
        else if (currentClassSubTab === 'semesters') loadSemesters();
        else if (currentClassSubTab === 'schools') loadSchools();
    }
    else if (tabId === 'ann-main-tab') {
        if (currentAnnSubTab === 'announcements') loadAnnouncements();
        else loadAnnouncementCategories();
    }
    else if (tabId === 'fin-main-tab') {
        if (currentFinSubTab === 'records') loadFinancialRecords();
        else loadFinancialReceipts();
    }
    else if (tabId === 'track-main-tab') {
        if (currentTrackSubTab === 'tracking_items') loadTrackingItems();
        else loadStudentTrackStatusView();
    }
};

window.switchClassSubTab = function(subType) {
    currentClassSubTab = subType;
    document.getElementById('sub-pill-class-setting').classList.toggle('active', subType === 'classes');
    document.getElementById('sub-pill-semester-setting').classList.toggle('active', subType === 'semesters');
    document.getElementById('sub-pill-school-setting').classList.toggle('active', subType === 'schools');

    document.getElementById('class-setting-view').classList.toggle('hidden', subType !== 'classes');
    document.getElementById('semester-setting-view').classList.toggle('hidden', subType !== 'semesters');
    document.getElementById('school-setting-view').classList.toggle('hidden', subType !== 'schools');

    if (subType === 'classes') loadClasses();
    else if (subType === 'semesters') loadSemesters();
    else if (subType === 'schools') loadSchools();
};

window.switchAnnSubTab = function(subType) {
    currentAnnSubTab = subType;
    document.getElementById('sub-pill-ann').classList.toggle('active', subType === 'announcements');
    document.getElementById('sub-pill-cat').classList.toggle('active', subType === 'ann-cat');
    document.getElementById('ann-list-view').classList.toggle('hidden', subType !== 'announcements');
    document.getElementById('ann-cat-list-view').classList.toggle('hidden', subType !== 'ann-cat');

    if (subType === 'announcements') loadAnnouncements();
    else loadAnnouncementCategories();
};

window.switchFinSubTab = function(subType) {
    currentFinSubTab = subType;
    document.getElementById('sub-pill-fin-rec').classList.toggle('active', subType === 'records');
    document.getElementById('sub-pill-fin-rcp').classList.toggle('active', subType === 'receipts');
    document.getElementById('fin-record-view').classList.toggle('hidden', subType !== 'records');
    document.getElementById('fin-receipt-view').classList.toggle('hidden', subType !== 'receipts');

    if (subType === 'records') loadFinancialRecords();
    else loadFinancialReceipts();
};

window.switchTrackSubTab = function(subType) {
    currentTrackSubTab = subType;
    document.getElementById('sub-pill-track-items').classList.toggle('active', subType === 'tracking_items');
    document.getElementById('sub-pill-track-status').classList.toggle('active', subType === 'student_track_status');
    document.getElementById('track-items-view').classList.toggle('hidden', subType !== 'tracking_items');
    document.getElementById('track-status-view').classList.toggle('hidden', subType !== 'student_track_status');

    const fabBtn = document.getElementById('main-fab-btn');
    if (fabBtn) {
        if (subType === 'student_track_status') fabBtn.classList.add('hidden');
        else fabBtn.classList.remove('hidden');
    }

    if (subType === 'tracking_items') loadTrackingItems();
    else loadStudentTrackStatusView();
};

window.switchTrackStatusMode = async function(mode) {
    currentTrackStatusMode = mode;
    document.getElementById('sub-pill-track-simple').classList.toggle('active', mode === 'simple');
    document.getElementById('sub-pill-track-detail').classList.toggle('active', mode === 'detail');
    document.getElementById('track-simple-control-bar').classList.toggle('hidden', mode !== 'simple');
    
    await loadStudentTrackStatusView();
};

async function loadGlobalAnnClasses() {
    const selectEl = document.getElementById('global-ann-class-select');
    if (!selectEl) return;
    const { data: classes } = await supabaseClient.from('classes').select('*, school(name)').order('academic_year', { ascending: false });
    selectEl.innerHTML = '<option value="">-- 全部班級 --</option>';
    let defaultUid = '';
    if (classes) {
        classes.forEach(c => {
            const schoolName = c.school ? `${c.school.name} ` : '';
            selectEl.innerHTML += `<option value="${c.uid}">${c.academic_year} - ${schoolName}${c.name}</option>`;
            if (c.is_default) defaultUid = c.uid;
        });
    }
    selectEl.value = defaultUid || "";
}

window.onGlobalAnnClassChanged = function() {
    if (currentActiveTab === 'ann-main-tab' && currentAnnSubTab === 'announcements') loadAnnouncements();
};

async function loadGlobalFinFilters() {
    const semesterSelect = document.getElementById('global-fin-semester-select');
    const classSelect = document.getElementById('global-fin-class-select');
    if (!semesterSelect || !classSelect) return;

    const { data: semesters } = await supabaseClient.from('semesters').select('*').order('created_at', { ascending: true });
    semesterSelect.innerHTML = '<option value="">-- 全部學期 --</option>';
    let defaultSemUid = '';
    if (semesters) {
        semesters.forEach(s => {
            semesterSelect.innerHTML += `<option value="${s.uid}">${s.name}</option>`;
            if (s.is_default) defaultSemUid = s.uid;
        });
        semesterSelect.value = defaultSemUid || "";
    }

    const { data: classes } = await supabaseClient.from('classes').select('*, school(name)').order('academic_year', { ascending: false });
    classSelect.innerHTML = '<option value="">-- 全部班級 --</option>';
    let defaultClassUid = '';
    if (classes) {
        classes.forEach(c => {
            const schoolName = c.school ? `${c.school.name} ` : '';
            classSelect.innerHTML += `<option value="${c.uid}">${c.academic_year} - ${schoolName}${c.name}</option>`;
            if (c.is_default) defaultClassUid = c.uid;
        });
        classSelect.value = defaultClassUid || "";
    }
}

window.onGlobalFinFilterChanged = function() {
    if (currentActiveTab === 'fin-main-tab') {
        if (currentFinSubTab === 'records') loadFinancialRecords();
        else loadFinancialReceipts();
    }
};

async function loadGlobalTrackFilters() {
    const classSelect = document.getElementById('global-track-class-select');
    if (!classSelect) return;

    const { data: classes } = await supabaseClient.from('classes').select('*, school(name)').order('academic_year', { ascending: false });
    classSelect.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    let defaultClassUid = '';
    if (classes) {
        classes.forEach(c => {
            const schoolName = c.school ? `${c.school.name} ` : '';
            classSelect.innerHTML += `<option value="${c.uid}">${c.academic_year} - ${schoolName}${c.name}</option>`;
            if (c.is_default) defaultClassUid = c.uid;
        });
        if (!classSelect.value) classSelect.value = defaultClassUid || (classes[0]?.uid || '');
    }
}

window.onGlobalTrackFilterChanged = async function() {
    if (currentTrackSubTab === 'tracking_items') {
        await loadTrackingItems();
    } else {
        await loadTrackStatusItemOptions();
    }
};

window.handleFabClick = async function() {
    if (currentActiveTab === 'classes-tab') {
        if (currentClassSubTab === 'classes') openAddClassModal();
        else if (currentClassSubTab === 'semesters') openAddSemesterModal();
        else if (currentClassSubTab === 'schools') openAddSchoolModal();
    }
    else if (currentActiveTab === 'ann-main-tab') {
        if (currentAnnSubTab === 'announcements') {
            const globalClassSelect = document.getElementById('global-ann-class-select');
            openAddAnnModal(globalClassSelect ? globalClassSelect.value : null);
        }
        else openAddAnnCatModal();
    }
    else if (currentActiveTab === 'fin-main-tab') {
        const semesterSelect = document.getElementById('global-fin-semester-select');
        const classSelect = document.getElementById('global-fin-class-select');
        if (currentFinSubTab === 'records') {
            await openDirectAddFinRecord(classSelect?.value, semesterSelect?.value);
        } else {
            await openDirectAddFinReceiptModal(classSelect?.value, semesterSelect?.value);
        }
    }
    else if (currentActiveTab === 'track-main-tab') {
        if (currentTrackSubTab === 'tracking_items') {
            const classUid = document.getElementById('global-track-class-select')?.value;
            openAddTrackingItemModal(classUid);
        }
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
            if (logoutBtn) logoutBtn.classList.remove('hidden');

            init24HourSelects();
            initQuillEditor();
            await loadClasses();
            await loadSemesters();
            await loadSchools();
            await loadGlobalAnnClasses();
            await loadGlobalFinFilters();
            await loadGlobalTrackFilters();
            await loadAnnouncementCategories();
            await loadAnnouncements();
            await loadFinancialRecords();
            await loadFinancialReceipts();
            await loadTrackingItems();
        } else {
            authSection.classList.remove('hidden');
            adminSection.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
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

/* =================== 1. 學校管理 =================== */
const schoolListTable = document.getElementById('school-list-table');
const schoolModal = document.getElementById('school-modal');
const schoolModalTitle = document.getElementById('school-modal-title');
const schoolModalDeleteBtn = document.getElementById('school-modal-delete-btn');
const schoolEditUid = document.getElementById('school-edit-uid');
const schoolNameInput = document.getElementById('school-name');
const schoolIsDefault = document.getElementById('school-is-default');
const saveSchoolBtn = document.getElementById('save-school-btn');

async function loadSchools() {
    showLoading();
    try {
        const { data } = await supabaseClient.from('school').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: true });
        schoolListTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const defaultBadge = item.is_default ? `<span style="background: #fff8e1; color: #f5b041; border: 1px solid #ffe0b2; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 8px;"><i class="fa-solid fa-star"></i>預設</span>` : '';
                schoolListTable.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info"><div class="card-title">${defaultBadge}${item.name}</div></div>
                        <button class="icon-edit-btn" onclick="openEditSchoolModal('${item.uid}', '${encodeURIComponent(item.name || '')}', ${item.is_default})" title="編輯"><i class="fa-solid fa-pen"></i></button>
                    </div>
                `;
            });
        } else {
            schoolListTable.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無學校資料</div>`;
        }
    } finally {
        hideLoading();
    }
}

window.openAddSchoolModal = function() {
    schoolEditUid.value = '';
    schoolNameInput.value = '';
    schoolIsDefault.checked = false;
    schoolModalTitle.textContent = '新增學校';
    saveSchoolBtn.textContent = '新增';
    schoolModalDeleteBtn.classList.add('hidden');
    schoolModal.classList.remove('hidden');
    resetModalScroll('school-modal');
};

window.openEditSchoolModal = function(uid, encodedName, isDefault) {
    schoolEditUid.value = uid;
    schoolNameInput.value = decodeURIComponent(encodedName || '');
    schoolIsDefault.checked = isDefault === true || isDefault === 'true';
    schoolModalTitle.textContent = '編輯學校';
    saveSchoolBtn.textContent = '更新';
    schoolModalDeleteBtn.classList.remove('hidden');
    schoolModal.classList.remove('hidden');
    resetModalScroll('school-modal');
};

saveSchoolBtn.addEventListener('click', async () => {
    const name = schoolNameInput.value.trim();
    const is_default = schoolIsDefault.checked;
    const uid = schoolEditUid.value;
    if (!name) return showToast('請填寫學校名稱！', 'error');

    showLoading();
    try {
        if (is_default) await supabaseClient.from('school').update({ is_default: false }).neq('uid', uid || 'none');
        if (uid) {
            const { error } = await supabaseClient.from('school').update({ name, is_default }).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('school-modal'); await loadSchools(); await loadClasses(); }
        } else {
            const { error } = await supabaseClient.from('school').insert([{ name, is_default }]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('school-modal'); await loadSchools(); }
        }
    } finally {
        hideLoading();
    }
});

/* =================== 2. 班級管理 =================== */
const classListTable = document.getElementById('class-list-table');
const classModal = document.getElementById('class-modal');
const classModalTitle = document.getElementById('class-modal-title');
const classModalDeleteBtn = document.getElementById('class-modal-delete-btn');
const classEditUid = document.getElementById('class-edit-uid');
const classSchoolUidSelect = document.getElementById('class-school-uid');
const classYear = document.getElementById('class-year');
const classNameInput = document.getElementById('class-name');
const classIsDefault = document.getElementById('class-is-default');
const saveClassBtn = document.getElementById('save-class-btn');

async function populateSchoolDropdown(selectedUid = '') {
    const { data: schools } = await supabaseClient.from('school').select('*').order('name', { ascending: true });
    classSchoolUidSelect.innerHTML = '<option value="">-- 請選擇學校 --</option>';
    if (schools) schools.forEach(s => { classSchoolUidSelect.innerHTML += `<option value="${s.uid}">${s.name}</option>`; });
    if (selectedUid) classSchoolUidSelect.value = selectedUid;
}

async function loadClasses() {
    showLoading();
    try {
        const { data } = await supabaseClient.from('classes').select('*, school(uid, name)').order('is_default', { ascending: false }).order('created_at', { ascending: true });
        classListTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const defaultBadge = item.is_default ? `<span style="background: #fff8e1; color: #f5b041; border: 1px solid #ffe0b2; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 8px;"><i class="fa-solid fa-star"></i></span>` : '';
                const schoolName = item.school ? `${item.school.name} - ` : '';
                classListTable.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info">
                            <div class="card-title">${defaultBadge}${schoolName}${item.name}</div>
                            <div class="card-sub">${item.academic_year}學年度</div>
                        </div>
                        <button class="icon-edit-btn" onclick="openEditClassModal('${item.uid}', '${item.school_uid || ''}', '${item.academic_year}', '${encodeURIComponent(item.name || '')}', ${item.is_default})" title="編輯">
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

window.openAddClassModal = async function() {
    await populateSchoolDropdown();
    classEditUid.value = '';
    classYear.value = '';
    classNameInput.value = '';
    classIsDefault.checked = false;
    classModalTitle.textContent = '新增班級';
    saveClassBtn.textContent = '新增';
    classModalDeleteBtn.classList.add('hidden');
    document.getElementById('class-qrcode-section').classList.add('hidden');
    classModal.classList.remove('hidden');
    resetModalScroll('class-modal');
};

window.openEditClassModal = async function(uid, schoolUid, year, encodedName, isDefault) {
    await populateSchoolDropdown(schoolUid);
    classEditUid.value = uid;
    classYear.value = year;
    classNameInput.value = decodeURIComponent(encodedName || '');
    classIsDefault.checked = isDefault === true || isDefault === 'true';
    classModalTitle.textContent = '編輯班級';
    saveClassBtn.textContent = '更新';
    classModalDeleteBtn.classList.remove('hidden');

    const parentUrl = `https://peggylin0727-hub.github.io/school-board/?uid=${uid}`;
    document.getElementById('class-parent-url-text').textContent = parentUrl;

    const qrcodeContainer = document.getElementById('qrcode-container');
    qrcodeContainer.innerHTML = '';
    new QRCode(qrcodeContainer, { text: parentUrl, width: 128, height: 128, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });

    document.getElementById('class-qrcode-section').classList.remove('hidden');
    classModal.classList.remove('hidden');
    resetModalScroll('class-modal');
};

window.copyParentUrl = function() {
    const urlText = document.getElementById('class-parent-url-text').textContent;
    navigator.clipboard.writeText(urlText).then(() => { showToast('已成功複製網址！', 'success'); }).catch(() => { showToast('複製失敗', 'error'); });
};

saveClassBtn.addEventListener('click', async () => {
    const school_uid = classSchoolUidSelect.value;
    const academic_year = classYear.value.trim();
    const name = classNameInput.value.trim();
    const is_default = classIsDefault.checked;
    const uid = classEditUid.value;
    
    if (!school_uid) return showToast('請選擇學校！', 'error');
    if (!academic_year || !name) return showToast('請填寫年度與班級全名！', 'error');

    showLoading();
    try {
        if (is_default) await supabaseClient.from('classes').update({ is_default: false }).neq('uid', uid || 'none');
        const payload = { school_uid, academic_year, name, is_default };
        if (uid) {
            const { error } = await supabaseClient.from('classes').update(payload).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('class-modal'); await loadClasses(); await loadGlobalAnnClasses(); await loadGlobalFinFilters(); await loadGlobalTrackFilters(); }
        } else {
            const { error } = await supabaseClient.from('classes').insert([payload]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('class-modal'); await loadClasses(); await loadGlobalAnnClasses(); await loadGlobalFinFilters(); await loadGlobalTrackFilters(); }
        }
    } finally {
        hideLoading();
    }
});

/* =================== 3. 學期管理 =================== */
const semesterListTable = document.getElementById('semester-list-table');
const semesterModal = document.getElementById('semester-modal');
const semesterModalTitle = document.getElementById('semester-modal-title');
const semesterModalDeleteBtn = document.getElementById('semester-modal-delete-btn');
const semesterEditUid = document.getElementById('semester-edit-uid');
const semesterNameInput = document.getElementById('semester-name');
const semesterIsDefault = document.getElementById('semester-is-default');
const saveSemesterBtn = document.getElementById('save-semester-btn');

async function loadSemesters() {
    showLoading();
    try {
        const { data } = await supabaseClient.from('semesters').select('*').order('created_at', { ascending: true });
        if (semesterListTable) {
            semesterListTable.innerHTML = '';
            if (data && data.length > 0) {
                data.forEach(item => {
                    const defaultBadge = item.is_default ? `<span style="background: #fff8e1; color: #f5b041; border: 1px solid #ffe0b2; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 8px;"><i class="fa-solid fa-star"></i></span>` : '';
                    semesterListTable.innerHTML += `
                        <div class="custom-card-item">
                            <div class="card-info"><div class="card-title">${defaultBadge}${item.name}</div></div>
                            <button class="icon-edit-btn" onclick="openEditSemesterModal('${item.uid}', '${encodeURIComponent(item.name || '')}', ${item.is_default})" title="編輯"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    `;
                });
            } else {
                semesterListTable.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無學期資料</div>`;
            }
        }
    } finally {
        hideLoading();
    }
}

window.openAddSemesterModal = function() {
    semesterEditUid.value = '';
    semesterNameInput.value = '';
    semesterIsDefault.checked = false;
    semesterModalTitle.textContent = '新增學期';
    saveSemesterBtn.textContent = '新增';
    semesterModalDeleteBtn.classList.add('hidden');
    semesterModal.classList.remove('hidden');
    resetModalScroll('semester-modal');
};

window.openEditSemesterModal = function(uid, encodedName, isDefault) {
    semesterEditUid.value = uid;
    semesterNameInput.value = decodeURIComponent(encodedName || '');
    semesterIsDefault.checked = isDefault === true || isDefault === 'true';
    semesterModalTitle.textContent = '編輯學期';
    saveSemesterBtn.textContent = '更新';
    semesterModalDeleteBtn.classList.remove('hidden');
    semesterModal.classList.remove('hidden');
    resetModalScroll('semester-modal');
};

saveSemesterBtn.addEventListener('click', async () => {
    const name = semesterNameInput.value.trim();
    const is_default = semesterIsDefault.checked;
    const uid = semesterEditUid.value;
    if (!name) return showToast('請填寫學期名稱！', 'error');

    showLoading();
    try {
        if (is_default) await supabaseClient.from('semesters').update({ is_default: false }).neq('uid', uid || 'none');
        if (uid) {
            const { error } = await supabaseClient.from('semesters').update({ name, is_default }).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('semester-modal'); await loadSemesters(); await loadGlobalFinFilters(); }
        } else {
            const { error } = await supabaseClient.from('semesters').insert([{ name, is_default }]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('semester-modal'); await loadSemesters(); await loadGlobalFinFilters(); }
        }
    } finally {
        hideLoading();
    }
});

/* =================== 4. 公告類別管理 =================== */
const annCatListTable = document.getElementById('ann-cat-list-table');
const annCatModal = document.getElementById('ann-cat-modal');
const annCatModalTitle = document.getElementById('ann-cat-modal-title');
const annCatModalDeleteBtn = document.getElementById('ann-cat-modal-delete-btn');
const annCatEditUid = document.getElementById('ann-cat-edit-uid');
const annCatName = document.getElementById('ann-cat-name');
const annCatColor = document.getElementById('ann-cat-color');
const annCatIsDefault = document.getElementById('ann-cat-is-default');
const saveAnnCatBtn = document.getElementById('save-ann-cat-btn');

async function loadAnnouncementCategories() {
    showLoading();
    try {
        const { data } = await supabaseClient.from('announcement_categories').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: true });
        annCatListTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const colorHex = item.color || '#ccc';
                const defaultBadge = item.is_default ? `<span style="background: #fff8e1; color: #f5b041; border: 1px solid #ffe0b2; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 8px;"><i class="fa-solid fa-star"></i></span>` : '';
                annCatListTable.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info">
                            <div class="card-title">${defaultBadge}${item.name}</div>
                            <div class="card-sub" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                                <span class="color-badge" style="background-color: ${colorHex};"></span><span>${colorHex}</span>
                            </div>
                        </div>
                        <button class="icon-edit-btn" onclick="openEditAnnCatModal('${item.uid}', '${encodeURIComponent(item.name || '')}', '${item.color}', ${item.is_default})" title="編輯"><i class="fa-solid fa-pen"></i></button>
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
    annCatIsDefault.checked = false;
    annCatModalTitle.textContent = '新增公告類別';
    saveAnnCatBtn.textContent = '新增';
    annCatModalDeleteBtn.classList.add('hidden');
    annCatModal.classList.remove('hidden');
    resetModalScroll('ann-cat-modal');
};

window.openEditAnnCatModal = function(uid, encodedName, color, isDefault) {
    annCatEditUid.value = uid;
    annCatName.value = decodeURIComponent(encodedName || '');
    annCatColor.value = color || '#1890ff';
    annCatIsDefault.checked = isDefault === true || isDefault === 'true';
    annCatModalTitle.textContent = '編輯公告類別';
    saveAnnCatBtn.textContent = '更新';
    annCatModalDeleteBtn.classList.remove('hidden');
    annCatModal.classList.remove('hidden');
    resetModalScroll('ann-cat-modal');
};

saveAnnCatBtn.addEventListener('click', async () => {
    const name = annCatName.value.trim();
    const color = annCatColor.value;
    const is_default = annCatIsDefault.checked;
    const uid = annCatEditUid.value;
    if (!name) return showToast('請填寫類別名稱！', 'error');

    showLoading();
    try {
        if (is_default) await supabaseClient.from('announcement_categories').update({ is_default: false }).neq('uid', uid || 'none');
        if (uid) {
            const { error } = await supabaseClient.from('announcement_categories').update({ name, color, is_default }).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('ann-cat-modal'); await loadAnnouncementCategories(); }
        } else {
            const { error } = await supabaseClient.from('announcement_categories').insert([{ name, color, is_default }]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('ann-cat-modal'); await loadAnnouncementCategories(); }
        }
    } finally {
        hideLoading();
    }
});

/* =================== 5. 公告發布與管理 =================== */
const annListTable = document.getElementById('ann-list-table');
const annModal = document.getElementById('ann-modal');
const annModalTitle = document.getElementById('ann-modal-title');
const annModalDeleteBtn = document.getElementById('ann-modal-delete-btn');
const annEditUid = document.getElementById('ann-edit-uid');
const annClassSelect = document.getElementById('ann-class-select');
const annCatSelect = document.getElementById('ann-cat-select');
const annTitle = document.getElementById('ann-title');
const annAttachmentUrl = document.getElementById('ann-attachment-url');
const annIsPinned = document.getElementById('ann-is-pinned');
const saveAnnBtn = document.getElementById('save-ann-btn');

async function loadAnnouncements() {
    showLoading();
    try {
        const globalClassSelect = document.getElementById('global-ann-class-select');
        const selectedClassUid = globalClassSelect ? globalClassSelect.value : '';

        let query = supabaseClient.from('announcements').select(`uid, name, note, attachment_url, class_uid, category_uid, start_date, start_time, end_date, end_time, is_pinned, classes ( academic_year, name, school ( name ) ), announcement_categories ( name, color )`).order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
        if (selectedClassUid) query = query.eq('class_uid', selectedClassUid);
        const { data } = await query;

        annListTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const schoolName = (item.classes && item.classes.school) ? `${item.classes.school.name} ` : '';
                const classNameText = item.classes ? `${item.classes.academic_year} - ${schoolName}${item.classes.name}` : '未指定';
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
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                ${pinBadge}
                                <span class="category-badge" style="background-color: ${catColor};">${catName}</span>
                            </div>
                            <div class="card-title" style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">${item.name}</div>
                            <div class="card-sub" style="margin-top: 6px; line-height: 1.5;">
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

async function loadAnnOptions(defaultClassUid = null, defaultCatUid = null) {
    const { data: classes } = await supabaseClient.from('classes').select('*, school(name)').order('academic_year', { ascending: false });
    annClassSelect.innerHTML = '<option value="">-- 請選擇班級 --</option>';
    let targetClassUid = defaultClassUid;
    if (!targetClassUid && classes) {
        const defClass = classes.find(c => c.is_default);
        if (defClass) targetClassUid = defClass.uid;
        else if (classes.length > 0) targetClassUid = classes[0].uid;
    }
    if (classes) classes.forEach(c => {
        const schoolName = c.school ? `${c.school.name} ` : '';
        annClassSelect.innerHTML += `<option value="${c.uid}">${c.academic_year} - ${schoolName}${c.name}</option>`;
    });
    if (targetClassUid) annClassSelect.value = targetClassUid;

    const { data: categories } = await supabaseClient.from('announcement_categories').select('*');
    annCatSelect.innerHTML = '<option value="">-- 請選擇公告類別 --</option>';
    let targetCatUid = defaultCatUid;
    if (!targetCatUid && categories) {
        const defCat = categories.find(cat => cat.is_default);
        if (defCat) targetCatUid = defCat.uid;
        else if (categories.length > 0) targetCatUid = categories[0].uid;
    }
    if (categories) categories.forEach(cat => { annCatSelect.innerHTML += `<option value="${cat.uid}">${cat.name}</option>`; });
    if (targetCatUid) annCatSelect.value = targetCatUid;
}

window.openAddAnnModal = async function(preselectedClassUid = null) {
    showLoading();
    try {
        const globalClassSelect = document.getElementById('global-ann-class-select');
        const targetClassUid = preselectedClassUid || (globalClassSelect ? globalClassSelect.value : null);
        await loadAnnOptions(targetClassUid);
        annEditUid.value = ''; annTitle.value = ''; annAttachmentUrl.value = '';
        if (quillEditor) quillEditor.root.innerHTML = '';
        showImagePreview('ann', '');
        setTimeDropdownsByPrefix('ann-start', '00:00');
        setTimeDropdownsByPrefix('ann-end', '23:59');
        setCustomDateValue('start', '');
        setCustomDateValue('end', '');
        annIsPinned.checked = false;
        annModalTitle.textContent = '新增公告'; saveAnnBtn.textContent = '新增';
        annModalDeleteBtn.classList.add('hidden'); 
        annModal.classList.remove('hidden');
        resetModalScroll('ann-modal');
    } finally {
        hideLoading();
    }
};

window.openEditAnnModal = async function(uid, classUid, catUid, encodedName, encodedNote, encodedAttachmentUrl, startDate, startTime, endDate, endTime, isPinned) {
    showLoading();
    try {
        await loadAnnOptions(classUid !== 'null' ? classUid : null, catUid !== 'null' ? catUid : null);
        annEditUid.value = uid; 
        if (classUid !== 'null') annClassSelect.value = classUid;
        if (catUid !== 'null') annCatSelect.value = catUid;
        annTitle.value = decodeURIComponent(encodedName); 
        const noteHtml = decodeURIComponent(encodedNote || '');
        if (quillEditor) quillEditor.root.innerHTML = noteHtml;
        const attachmentUrl = decodeURIComponent(encodedAttachmentUrl || '');
        annAttachmentUrl.value = attachmentUrl;
        showImagePreview('ann', attachmentUrl);
        setTimeDropdownsByPrefix('ann-start', startTime || '00:00');
        setTimeDropdownsByPrefix('ann-end', endTime || '23:59');
        setCustomDateValue('start', startDate !== 'null' ? startDate : '');
        setCustomDateValue('end', endDate !== 'null' ? endDate : '');
        annIsPinned.checked = isPinned === 'true' || isPinned === true;
        annModalTitle.textContent = '編輯公告'; saveAnnBtn.textContent = '更新';
        annModalDeleteBtn.classList.remove('hidden'); 
        annModal.classList.remove('hidden');
        resetModalScroll('ann-modal');
    } finally {
       hideLoading();
    }
};

saveAnnBtn.addEventListener('click', async () => {
    const class_uid = annClassSelect.value;
    const category_uid = annCatSelect.value;
    const name = annTitle.value;
    const note = quillEditor ? quillEditor.root.innerHTML : '';
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

/* =================== 6. 財務管理 =================== */
async function loadFinancialRecords() {
    showLoading();
    try {
        const semesterSelect = document.getElementById('global-fin-semester-select');
        const classSelect = document.getElementById('global-fin-class-select');
        const selectedSemesterUid = semesterSelect ? semesterSelect.value : '';
        const selectedClassUid = classSelect ? classSelect.value : '';

        let query = supabaseClient.from('financial_records').select(`uid, name, remark, date, amount, type, class_uid, semester_uid, classes ( academic_year, name, school ( name ) ), semesters ( name )`).order('created_at', { ascending: false });
        if (selectedSemesterUid) query = query.eq('semester_uid', selectedSemesterUid);
        if (selectedClassUid) query = query.eq('class_uid', selectedClassUid);
        const { data } = await query;

        let totalClassBalance = 0, totalClassInc = 0, totalClassExp = 0;
        if (selectedClassUid) {
            const { data: allClassRecords } = await supabaseClient.from('financial_records').select('amount, type').eq('class_uid', selectedClassUid);
            if (allClassRecords) {
                allClassRecords.forEach(r => {
                    const amt = Number(r.amount) || 0;
                    if (Number(r.type) === 1) totalClassInc += amt; else totalClassExp += amt;
                });
                totalClassBalance = totalClassInc - totalClassExp;
            }
        } else {
            const { data: allRecords } = await supabaseClient.from('financial_records').select('amount, type');
            if (allRecords) {
                allRecords.forEach(r => {
                    const amt = Number(r.amount) || 0;
                    if (Number(r.type) === 1) totalClassInc += amt; else totalClassExp += amt;
                });
                totalClassBalance = totalClassInc - totalClassExp;
            }
        }

        const recordListEl = document.getElementById('fin-record-list');
        const summaryEl = document.getElementById('fin-record-summary');
        recordListEl.innerHTML = '';
        let totalInc = 0, totalExp = 0;

        if (data && data.length > 0) {
            data.forEach(item => {
                const isInc = Number(item.type) === 1;
                const amt = Number(item.amount) || 0;
                if (isInc) totalInc += amt; else totalExp += amt;
                const schoolName = (item.classes && item.classes.school) ? `${item.classes.school.name} ` : '';
                const className = item.classes ? `${item.classes.academic_year} - ${schoolName}${item.classes.name}` : '未知班級';
                const semesterName = item.semesters ? item.semesters.name : '未知學期';
                const badge = isInc ? `<span class="type-badge inc">收入</span>` : `<span class="type-badge exp">支出</span>`;

                recordListEl.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info" style="flex: 1; min-width: 0; padding-right: 15px;">
                            <div class="card-title">${badge} <span>${item.name}</span></div>
                            <div class="card-sub" style="margin-top: 6px; line-height: 1.5;">
                                <div style="color: #64748b;">${className} &nbsp;|&nbsp; ${semesterName}</div>
                                <div style="color: #475569; font-size: 12px;"><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>日期: ${item.date || ''}</div>
                                ${item.remark ? `<div style="color: #64748b; font-size: 12px; margin-top: 2px;">備註: ${item.remark}</div>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0;">
                            <span style="color: ${isInc ? '#00b96b' : '#ff4d4f'}; font-weight: bold; font-size: 16px;">${isInc ? '+' : '-'}$${amt.toLocaleString()}</span>
                            <button class="icon-edit-btn" onclick="openEditFinRecordModal('${item.uid}', '${encodeURIComponent(item.name || '')}', '${item.amount}', '${item.type}', '${item.date}', '${encodeURIComponent(item.remark || '')}', '${item.class_uid}', '${item.semester_uid}')" title="編輯"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </div>
                `;
            });
        } else {
            recordListEl.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無金額明細紀錄</div>`;
        }

        const balance = totalInc - totalExp;
        summaryEl.innerHTML = `
            <div class="summary-item"><span class="summary-label">收入:</span><span class="inc">+$${totalInc.toLocaleString()}</span></div>
            <div class="summary-item"><span class="summary-label">支出:</span><span class="exp">-$${totalExp.toLocaleString()}</span></div>
            <div class="summary-item"><span class="summary-label">結餘:</span><span class="balance" style="color: ${balance >= 0 ? '#00b96b' : '#ff4d4f'}">$${balance.toLocaleString()}</span></div>
            <div class="summary-item"><span class="summary-label">總餘:</span><span class="total-balance" style="color: ${totalClassBalance >= 0 ? '#00b96b' : '#ff4d4f'}">$${totalClassBalance.toLocaleString()}</span></div>
        `;
    } finally {
        hideLoading();
    }
}

async function loadFinancialReceipts() {
    showLoading();
    try {
        const semesterSelect = document.getElementById('global-fin-semester-select');
        const classSelect = document.getElementById('global-fin-class-select');
        const selectedSemesterUid = semesterSelect ? semesterSelect.value : '';
        const selectedClassUid = classSelect ? classSelect.value : '';

        let query = supabaseClient.from('financial_receipts').select(`uid, receipt_url, remark, created_at, class_uid, semester_uid, classes ( academic_year, name, school ( name ) ), semesters ( name )`).order('created_at', { ascending: false });
        if (selectedSemesterUid) query = query.eq('semester_uid', selectedSemesterUid);
        if (selectedClassUid) query = query.eq('class_uid', selectedClassUid);
        const { data } = await query;
        const receiptListEl = document.getElementById('fin-receipt-list');
        receiptListEl.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(item => {
                const schoolName = (item.classes && item.classes.school) ? `${item.classes.school.name} ` : '';
                const className = item.classes ? `${item.classes.academic_year} - ${schoolName}${item.classes.name}` : '未知班級';
                const semesterName = item.semesters ? item.semesters.name : '未知學期';
                const createdDate = item.created_at ? item.created_at.split('T')[0] : '';

                receiptListEl.innerHTML += `
                    <div class="custom-card-item">
                        <div style="display: flex; gap: 14px; align-items: center; width: calc(100% - 45px);">
                            <div style="flex-shrink: 0; cursor: pointer;" onclick="openImagePreviewModal('${item.receipt_url}')">
                                <img src="${item.receipt_url}" alt="發票憑證" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;">
                            </div>
                            <div class="card-info" style="flex: 1; min-width: 0;">
                                <div class="card-title">${className}</div>
                                <div class="card-sub" style="margin-top: 4px; line-height: 1.4;">
                                    <div>學期: ${semesterName}</div>
                                    ${item.remark ? `<div style="color: #1e293b; font-weight: 500;">備註: ${item.remark}</div>` : ''}
                                    <div style="color: #94a3b8; font-size: 11px;">上傳時間: ${createdDate}</div>
                                </div>
                            </div>
                        </div>
                        <button class="icon-edit-btn" onclick="openEditFinReceiptModal('${item.uid}', '${encodeURIComponent(item.receipt_url || '')}', '${encodeURIComponent(item.remark || '')}', '${item.class_uid}', '${item.semester_uid}')" title="編輯"><i class="fa-solid fa-pen"></i></button>
                    </div>
                `;
            });
        } else {
            receiptListEl.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無發票與收據憑證</div>`;
        }
    } finally {
        hideLoading();
    }
}

async function populateFinModalDropdowns(targetClassUid, targetSemesterUid) {
    const { data: classes } = await supabaseClient.from('classes').select('*, school(name)').order('academic_year', { ascending: false });
    const { data: semesters } = await supabaseClient.from('semesters').select('*').order('created_at', { ascending: true });

    let defaultClassUid = '';
    if (classes) classes.forEach(c => { if (c.is_default) defaultClassUid = c.uid; });
    let defaultSemesterUid = '';
    if (semesters) semesters.forEach(s => { if (s.is_default) defaultSemesterUid = s.uid; });

    const finalClassUid = targetClassUid || defaultClassUid || (classes && classes.length > 0 ? classes[0].uid : '');
    const finalSemesterUid = targetSemesterUid || defaultSemesterUid || (semesters && semesters.length > 0 ? semesters[0].uid : '');

    const cSelects = [document.getElementById('fin-record-class-select'), document.getElementById('fin-receipt-class-select')];
    const sSelects = [document.getElementById('fin-record-semester-select'), document.getElementById('fin-receipt-semester-select')];

    cSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- 請選擇班級 --</option>';
        if (classes) classes.forEach(c => { 
            const schoolName = c.school ? `${c.school.name} ` : '';
            sel.innerHTML += `<option value="${c.uid}">${c.academic_year} - ${schoolName}${c.name}</option>`; 
        });
        sel.value = finalClassUid;
    });

    sSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- 請選擇學期 --</option>';
        if (semesters) semesters.forEach(s => { sel.innerHTML += `<option value="${s.uid}">${s.name}</option>`; });
        sel.value = finalSemesterUid;
    });
}

window.openDirectAddFinRecord = async function(classUid, semesterUid) {
    showLoading();
    try {
        await populateFinModalDropdowns(classUid, semesterUid);
        document.getElementById('fin-record-edit-uid').value = '';
        document.getElementById('fin-record-name').value = '';
        document.getElementById('fin-record-type').value = '0';
        document.getElementById('fin-record-amount').value = '';
        document.getElementById('fin-record-remark').value = '';
        const today = new Date().toISOString().split('T')[0];
        setCustomDateValue('fin-record', today);

        document.getElementById('fin-record-modal-title').textContent = '新增金額明細';
        document.getElementById('save-fin-record-btn').textContent = '新增';
        document.getElementById('fin-record-modal-delete-btn').classList.add('hidden');
        document.getElementById('fin-record-modal').classList.remove('hidden');
        resetModalScroll('fin-record-modal');
    } finally {
        hideLoading();
    }
};

window.openDirectAddFinReceiptModal = async function(classUid, semesterUid) {
    showLoading();
    try {
        await populateFinModalDropdowns(classUid, semesterUid);
        document.getElementById('fin-receipt-edit-uid').value = '';
        document.getElementById('fin-receipt-url').value = '';
        document.getElementById('fin-receipt-remark').value = '';
        showImagePreview('fin-rcp', '');

        document.getElementById('fin-receipt-modal-title').textContent = '上傳發票與收據憑證';
        document.getElementById('save-fin-receipt-btn').textContent = '新增';
        document.getElementById('fin-receipt-modal-delete-btn').classList.add('hidden');
        document.getElementById('fin-receipt-modal').classList.remove('hidden');
        resetModalScroll('fin-receipt-modal');
    } finally {
        hideLoading();
    }
};

window.openEditFinRecordModal = async function(uid, encodedName, amount, type, date, encodedRemark, classUid, semesterUid) {
    showLoading();
    try {
        await populateFinModalDropdowns(classUid, semesterUid);
        document.getElementById('fin-record-edit-uid').value = uid;
        document.getElementById('fin-record-name').value = decodeURIComponent(encodedName);
        document.getElementById('fin-record-type').value = String(type);
        document.getElementById('fin-record-amount').value = amount;
        document.getElementById('fin-record-remark').value = decodeURIComponent(encodedRemark);
        setCustomDateValue('fin-record', date || '');

        document.getElementById('fin-record-modal-title').textContent = '編輯金額明細';
        document.getElementById('save-fin-record-btn').textContent = '更新';
        document.getElementById('fin-record-modal-delete-btn').classList.remove('hidden');
        document.getElementById('fin-record-modal').classList.remove('hidden');
        resetModalScroll('fin-record-modal');
    } finally {
        hideLoading();
    }
};

window.openEditFinReceiptModal = async function(uid, encodedUrl, encodedRemark, classUid, semesterUid) {
    showLoading();
    try {
        await populateFinModalDropdowns(classUid, semesterUid);
        const url = decodeURIComponent(encodedUrl);
        document.getElementById('fin-receipt-edit-uid').value = uid;
        document.getElementById('fin-receipt-url').value = url;
        document.getElementById('fin-receipt-remark').value = decodeURIComponent(encodedRemark);
        showImagePreview('fin-rcp', url);

        document.getElementById('fin-receipt-modal-title').textContent = '編輯發票與收據憑證';
        document.getElementById('save-fin-receipt-btn').textContent = '更新';
        document.getElementById('fin-receipt-modal-delete-btn').classList.remove('hidden');
        document.getElementById('fin-receipt-modal').classList.remove('hidden');
        resetModalScroll('fin-receipt-modal');
    } finally {
        hideLoading();
    }
};

document.getElementById('save-fin-record-btn').addEventListener('click', async () => {
    const uid = document.getElementById('fin-record-edit-uid').value;
    const class_uid = document.getElementById('fin-record-class-select').value;
    const semester_uid = document.getElementById('fin-record-semester-select').value;
    const name = document.getElementById('fin-record-name').value.trim();
    const type = parseInt(document.getElementById('fin-record-type').value);
    const amount = parseFloat(document.getElementById('fin-record-amount').value);
    const date = document.getElementById('fin-record-date').value;
    const remark = document.getElementById('fin-record-remark').value.trim();

    if (!class_uid) return showToast('請選擇班級！', 'error');
    if (!semester_uid) return showToast('請選擇學期！', 'error');
    if (!name) return showToast('請填寫項目名稱！', 'error');
    if (isNaN(amount) || amount <= 0) return showToast('請填寫有效金額！', 'error');
    if (!date) return showToast('請選擇日期！', 'error');

    showLoading();
    try {
        const payload = { name, type, amount, date, remark, class_uid, semester_uid };
        if (uid) {
            const { error } = await supabaseClient.from('financial_records').update(payload).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('fin-record-modal'); await loadFinancialRecords(); }
        } else {
            const { error } = await supabaseClient.from('financial_records').insert([payload]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('fin-record-modal'); await loadFinancialRecords(); }
        }
    } finally {
        hideLoading();
    }
});

document.getElementById('save-fin-receipt-btn').addEventListener('click', async () => {
    const uid = document.getElementById('fin-receipt-edit-uid').value;
    const class_uid = document.getElementById('fin-receipt-class-select').value;
    const semester_uid = document.getElementById('fin-receipt-semester-select').value;
    const receipt_url = document.getElementById('fin-receipt-url').value.trim();
    const remark = document.getElementById('fin-receipt-remark').value.trim();

    if (!class_uid) return showToast('請選擇班級！', 'error');
    if (!semester_uid) return showToast('請選擇學期！', 'error');
    if (!receipt_url) return showToast('請先上傳發票/收據圖片！', 'error');

    showLoading();
    try {
        const payload = { receipt_url, remark, class_uid, semester_uid };
        if (uid) {
            const { error } = await supabaseClient.from('financial_receipts').update(payload).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('fin-receipt-modal'); await loadFinancialReceipts(); }
        } else {
            const { error } = await supabaseClient.from('financial_receipts').insert([payload]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('fin-receipt-modal'); await loadFinancialReceipts(); }
        }
    } finally {
        hideLoading();
    }
});

/* =================== 7. 追蹤管理 (tracking_items & student_track_status) =================== */

// 學生姓名隨機混合符號打碼 (O, *, $, # 等)
function maskStudentName(fullName) {
    if (!fullName) return '同學';
    const name = fullName.trim();
    if (name.length <= 1) return name;
    
    const maskSymbols = ['○', '*', '$', '#', 'X'];
    const randomSymbol = () => maskSymbols[Math.floor(Math.random() * maskSymbols.length)];

    if (name.length === 2) {
        return name[0] + randomSymbol();
    }
    
    let masked = name[0];
    for (let i = 1; i < name.length - 1; i++) {
        masked += randomSymbol();
    }
    masked += name[name.length - 1];
    return masked;
}

// 載入 tracking_items 列表
async function loadTrackingItems() {
    showLoading();
    try {
        const classUid = document.getElementById('global-track-class-select')?.value;
        const listEl = document.getElementById('track-items-list');
        if (!listEl) return;

        let query = supabaseClient.from('tracking_items').select(`
            uid, title, category, class_uid,
            classes ( academic_year, name, school ( name ) )
        `).order('created_at', { ascending: false });

        if (classUid) query = query.eq('class_uid', classUid);

        const { data, error } = await query;
        listEl.innerHTML = '';

        if (error) {
            listEl.innerHTML = `<div style="text-align: center; color: #ff4d4f; padding: 20px;">載入追蹤項目失敗: ${error.message}</div>`;
            return;
        }

        if (data && data.length > 0) {
            data.forEach(item => {
                const schoolName = (item.classes && item.classes.school) ? `${item.classes.school.name} ` : '';
                const className = item.classes ? `${item.classes.academic_year} - ${schoolName}${item.classes.name}` : '未知班級';
                const isDefaultCat = item.category === '預設';

                listEl.innerHTML += `
                    <div class="custom-card-item">
                        <div class="card-info" style="flex: 1; min-width: 0; padding-right: 15px;">
                            <div class="card-title">
                                <span class="category-badge" style="background-color: ${isDefaultCat ? '#64748b' : '#00b96b'};">${item.category}</span>
                                <span>${item.title}</span>
                            </div>
                            <div class="card-sub" style="margin-top: 6px; line-height: 1.5;">
                                <div style="color: #64748b;">${className}</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0;">
                            <button class="icon-edit-btn" onclick="openEditTrackingItemModal('${item.uid}', '${encodeURIComponent(item.title || '')}', '${item.category}', '${item.class_uid}')" title="編輯">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        } else {
            listEl.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無追蹤項目，請點擊右下角 + 新增</div>`;
        }

        await loadTrackStatusItemOptions();
    } finally {
        hideLoading();
    }
}

async function populateTrackItemModalDropdowns(targetClassUid) {
    const { data: classes } = await supabaseClient.from('classes').select('*, school(name)').order('academic_year', { ascending: false });
    let defaultClassUid = targetClassUid || document.getElementById('global-track-class-select')?.value || '';

    if (!defaultClassUid && classes) {
        const def = classes.find(c => c.is_default);
        defaultClassUid = def ? def.uid : classes[0]?.uid;
    }

    const cSelect = document.getElementById('track-item-class-select');
    if (cSelect) {
        cSelect.innerHTML = '<option value="">-- 請選擇班級 --</option>';
        if (classes) classes.forEach(c => {
            const schoolName = c.school ? `${c.school.name} ` : '';
            cSelect.innerHTML += `<option value="${c.uid}">${c.academic_year} - ${schoolName}${c.name}</option>`;
        });
        cSelect.value = defaultClassUid;
    }
}

window.openAddTrackingItemModal = async function(classUid) {
    showLoading();
    try {
        await populateTrackItemModalDropdowns(classUid);
        document.getElementById('track-item-edit-uid').value = '';
        document.getElementById('track-item-name').value = '';
        document.getElementById('track-item-category').value = '預設';

        document.getElementById('track-item-modal-title').textContent = '新增追蹤項目';
        document.getElementById('save-track-item-btn').textContent = '新增';
        document.getElementById('track-item-modal-delete-btn').classList.add('hidden');
        document.getElementById('track-item-modal').classList.remove('hidden');
        resetModalScroll('track-item-modal');
    } finally {
        hideLoading();
    }
};

window.openEditTrackingItemModal = async function(uid, encodedTitle, category, classUid) {
    showLoading();
    try {
        await populateTrackItemModalDropdowns(classUid);
        document.getElementById('track-item-edit-uid').value = uid;
        document.getElementById('track-item-name').value = decodeURIComponent(encodedTitle || '');
        document.getElementById('track-item-category').value = category || '預設';

        document.getElementById('track-item-modal-title').textContent = '編輯追蹤項目';
        document.getElementById('save-track-item-btn').textContent = '更新';
        document.getElementById('track-item-modal-delete-btn').classList.remove('hidden');
        document.getElementById('track-item-modal').classList.remove('hidden');
        resetModalScroll('track-item-modal');
    } finally {
        hideLoading();
    }
};

document.getElementById('save-track-item-btn').addEventListener('click', async () => {
    const uid = document.getElementById('track-item-edit-uid').value;
    const class_uid = document.getElementById('track-item-class-select').value;
    const title = document.getElementById('track-item-name').value.trim();
    const category = document.getElementById('track-item-category').value;

    if (!class_uid) return showToast('請選擇班級！', 'error');
    if (!title) return showToast('請填寫追蹤項目名稱！', 'error');

    showLoading();
    try {
        const payload = { class_uid, title, category };
        if (uid) {
            const { error } = await supabaseClient.from('tracking_items').update(payload).eq('uid', uid);
            if (error) showToast('修改失敗: ' + error.message, 'error');
            else { showToast('修改成功！'); closeModal('track-item-modal'); await loadTrackingItems(); }
        } else {
            const { error } = await supabaseClient.from('tracking_items').insert([payload]);
            if (error) showToast('新增失敗: ' + error.message, 'error');
            else { showToast('新增成功！'); closeModal('track-item-modal'); await loadTrackingItems(); }
        }
    } finally {
        hideLoading();
    }
});

async function loadTrackStatusItemOptions() {
    const classUid = document.getElementById('global-track-class-select')?.value;
    const selectEl = document.getElementById('track-status-item-select');
    if (!selectEl) return;

    if (!classUid) {
        selectEl.innerHTML = '<option value="">-- 請先選擇班級 --</option>';
        document.getElementById('track-status-content-container').innerHTML = '';
        return;
    }

    const { data: items } = await supabaseClient.from('tracking_items').select('*').eq('class_uid', classUid).order('created_at', { ascending: false });
    
    selectEl.innerHTML = '<option value="">-- 請選擇追蹤項目 --</option>';
    if (items && items.length > 0) {
        items.forEach(i => {
            selectEl.innerHTML += `<option value="${i.uid}" data-category="${i.category}">${i.title} (${i.category})</option>`;
        });
    }
    selectEl.value = "";
    document.getElementById('track-status-content-container').innerHTML = `<div style="text-align: center; color: #888; padding: 30px;">請先選擇上方追蹤項目</div>`;
}

window.onTrackStatusItemChanged = async function() {
    await loadStudentTrackStatusView(false);
};

// 新增 isSilent 參數：當為 true 時不觸發全螢幕遮罩 showLoading()
async function loadStudentTrackStatusView(isSilent = false) {
    const itemSelect = document.getElementById('track-status-item-select');
    const container = document.getElementById('track-status-content-container');
    const controlBar = document.getElementById('track-simple-control-bar');
    const controlBarPills = document.getElementById('track-target-status-pills');
    
    if (!itemSelect || !container) return;

    const itemUid = itemSelect.value;
    
    // 如果沒有選擇項目，強制隱藏控制列並清空內容
    if (!itemUid) {
        if (controlBar) controlBar.classList.add('hidden');
        if (controlBarPills) controlBarPills.innerHTML = ``;
        container.innerHTML = `<div style="text-align: center; color: #888; padding: 30px;">請先選擇上方追蹤項目</div>`;
        return;
    }

    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    const category = selectedOption ? selectedOption.getAttribute('data-category') : '預設';

    if (controlBar && controlBarPills) {
        // 只有在「簡易版」模式 且 類別為「作業」時才顯示控制列
        if (currentTrackStatusMode === 'simple' && category === '作業') {
            controlBar.classList.remove('hidden');
            const statuses = ['缺交', '已交', '補交'];
            let pillsHtml = '';
            statuses.forEach(st => {
                const isActive = currentTrackTargetStatus === st;
                const bgColor = STATUS_COLORS[st] || '#00b96b';
                
                const styleAttr = isActive 
                    ? `background-color: ${bgColor} !important; color: white !important; font-weight: bold; box-shadow: 0 2px 6px ${bgColor}66;` 
                    : `background-color: #e2e8f0; color: #475569;`;

                pillsHtml += `<button type="button" class="sub-pill-btn ${isActive ? 'active' : ''}" onclick="setTrackTargetStatus('${st}')" style="padding: 6px 16px; font-size: 13px; border-radius: 20px; border: none; cursor: pointer; transition: all 0.2s; ${styleAttr}">${st}</button>`;
            });
            controlBarPills.innerHTML = pillsHtml;
        } else {
            controlBar.classList.add('hidden'); // 詳細版 或 非作業類別時隱藏
            controlBarPills.innerHTML = ``;
        }
    }

    if (!isSilent) showLoading();
    try {
        const classUid = document.getElementById('global-track-class-select')?.value;
        const { data: students } = await supabaseClient.from('students').select('*').eq('class_uid', classUid).order('seat_no', { ascending: true });
        const { data: statuses } = await supabaseClient.from('student_track_status').select('*').eq('item_uid', itemUid);

        const statusMap = {};
        if (statuses) {
            statuses.forEach(s => { statusMap[s.student_uid] = s; });
        }

        renderTrackStatusContent(students || [], statusMap, category);
    } finally {
        if (!isSilent) hideLoading();
    }
}

window.setTrackTargetStatus = function(st) {
    currentTrackTargetStatus = st;
    loadStudentTrackStatusView(true); // 靜默切換目標狀態
};

function renderTrackStatusContent(students = [], statusMap = {}, category = '預設') {
    const container = document.getElementById('track-status-content-container');
    if (!container) return;

    if (!students || students.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #888; padding: 30px;">該班級目前尚無學生資料</div>`;
        return;
    }

    if (currentTrackStatusMode === 'simple') {
        let maxSeat = 0;
        students.forEach(s => {
            const seat = parseInt(s.seat_no || 1);
            if (seat > maxSeat) maxSeat = seat;
        });

        const studentBySeat = {};
        students.forEach(s => {
            const seat = parseInt(s.seat_no || 0);
            studentBySeat[seat] = s;
        });

        let gridHtml = `<div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">`;
        const totalSlots = Math.ceil(maxSeat / 5) * 5;

        for (let seat = 1; seat <= totalSlots; seat++) {
            const student = studentBySeat[seat];
            if (!student) {
                gridHtml += `
                    <div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; opacity: 0.5;">
                        <div style="font-size: 12px; color: #94a3b8; font-weight: bold;">${seat}</div>
                        <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">--</div>
                    </div>
                `;
            } else {
                const sUid = student.uid;
                const record = statusMap[sUid] || {};
                const currentStatus = record.status || (category === '作業' ? '缺交' : 'false');
                const maskedName = maskStudentName(student.name || '同學');
                
                let badgeColor = STATUS_COLORS[currentStatus] || '#ff4d4f'; 
                if (currentStatus === 'true' || currentStatus === true) badgeColor = '#00b96b';

                if (category === '預設') {
                    const isChecked = currentStatus === 'true' || currentStatus === true;
                    gridHtml += `
                        <div onclick="handleSimpleCellClick('${sUid}', '${category}', '${isChecked}')" style="background: white; border: 2px solid ${isChecked ? '#00b96b' : '#e2e8f0'}; border-radius: 8px; padding: 10px; text-align: center; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${seat} 號</div>
                            <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${maskedName}</div>
                            <div><span class="type-badge" style="display:none;background: ${isChecked ? '#e6f4ff' : '#fff1f0'}; color: ${isChecked ? '#00b96b' : '#ff4d4f'};">${isChecked ? '已開' : '關閉'}</span></div>
                        </div>
                    `;
                } else {
                    gridHtml += `
                        <div onclick="handleSimpleCellClick('${sUid}', '${category}', '${currentStatus}')" style="background: white; border: 2px solid ${badgeColor}; border-radius: 8px; padding: 10px; text-align: center; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                            <div style="font-size: 11px; color: #64748b; font-weight: bold;">${seat} 號</div>
                            <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin: 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${maskedName}</div>
                            <div><span class="type-badge" style="background: ${badgeColor}20; color: ${badgeColor};">${currentStatus}</span></div>
                        </div>
                    `;
                }
            }
        }
        gridHtml += `</div>`;
        container.innerHTML = gridHtml;
    } else {
        // 詳細版：座號與姓名同一行，備註移至下一行，狀態為按鈕組 (非下拉選單)
        let listHtml = `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        students.forEach((student, idx) => {
            const seat = student.seat_no || (idx + 1);
            const sUid = student.uid;
            const record = statusMap[sUid] || {};
            const currentStatus = record.status || (category === '作業' ? '缺交' : 'false');
            const currentRemark = record.remark || '';
            const maskedName = maskStudentName(student.name || '同學');

            let statusControlHtml = '';
            if (category === '預設') {
                const isChecked = currentStatus === 'true' || currentStatus === true;
                statusControlHtml = `
                    <label class="ios-switch" style="margin-bottom:0;">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="updateStudentStatusRecord('${sUid}', this.checked ? 'true' : 'false', document.getElementById('remark-${sUid}').value)">
                        <span class="ios-slider round"></span>
                    </label>
                `;
            } else {
                const statuses = ['缺交', '已交', '補交'];
                let btnGroupHtml = `<div style="display: flex; gap: 6px;">`;
                statuses.forEach(st => {
                    const isSelected = currentStatus === st;
                    const stColor = STATUS_COLORS[st] || '#00b96b';
                    const activeStyle = isSelected 
                        ? `background-color: ${stColor}; color: white; border: 1px solid ${stColor}; font-weight: bold;` 
                        : `background-color: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;`;
                    
                    btnGroupHtml += `
                        <button type="button" onclick="updateStudentStatusRecord('${sUid}', '${st}', document.getElementById('remark-${sUid}').value)" style="padding: 4px 10px; font-size: 12px; border-radius: 6px; cursor: pointer; margin-bottom: 0; width: auto; transition: all 0.2s; ${activeStyle}">
                            ${st}
                        </button>
                    `;
                });
                btnGroupHtml += `</div>`;
                statusControlHtml = btnGroupHtml;
            }

            listHtml += `
                <div class="custom-card-item" style="margin-bottom: 0; padding: 12px 16px; flex-direction: column; align-items: stretch; gap: 10px;">
                    <!-- 第一行：座號 + 姓名同一行，右側放狀態按鈕 -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: bold; color: #64748b; font-size: 14px;">${seat}號</span>
                            <span style="font-weight: bold; color: #1e293b; font-size: 15px;">${maskedName}</span>
                        </div>
                        <div>
                            ${statusControlHtml}
                        </div>
                    </div>
                    <!-- 第二行：備註往下放 -->
                    <div>
                        <input type="text" id="remark-${sUid}" value="${currentRemark}" placeholder="輸入備註..." style="margin-bottom: 0; padding: 6px 10px; font-size: 13px; background: #f8fafc;" onblur="updateStudentStatusRecord('${sUid}', '${currentStatus}', this.value)">
                    </div>
                </div>
            `;
        });
        listHtml += `</div>`;
        container.innerHTML = listHtml;
    }
}

window.handleSimpleCellClick = async function(studentUid, category, currentStatus) {
    const itemUid = document.getElementById('track-status-item-select')?.value;
    if (!itemUid) return;

    let newStatus = currentStatus;
    if (category === '作業') {
        if (currentStatus === currentTrackTargetStatus) {
            return;
        }
        newStatus = currentTrackTargetStatus;
    } else {
        const isCurrentlyChecked = currentStatus === 'true' || currentStatus === true;
        newStatus = isCurrentlyChecked ? 'false' : 'true';
    }

    await updateStudentStatusRecord(studentUid, newStatus, null);
};

async function updateStudentStatusRecord(studentUid, newStatus, newRemark = null) {
    const itemUid = document.getElementById('track-status-item-select')?.value;
    if (!itemUid || !studentUid) return;

    try {
        const { data: existing } = await supabaseClient
            .from('student_track_status')
            .select('uid, remark')
            .eq('item_uid', itemUid)
            .eq('student_uid', studentUid)
            .single();

        const payload = { 
            status: String(newStatus), 
            updated_at: new Date().toISOString() 
        };
        
        if (newRemark !== null) {
            payload.remark = newRemark;
        }

        if (existing && existing.uid) {
            const { error } = await supabaseClient
                .from('student_track_status')
                .update(payload)
                .eq('uid', existing.uid);
            if (error) {
                showToast('更新狀態失敗: ' + error.message, 'error');
            } else {
                showToast('已更新！');
                await loadStudentTrackStatusView(true); // 帶入 true 靜默更新，完全不出現轉圈圈！
            }
        } else {
            payload.item_uid = itemUid;
            payload.student_uid = studentUid;
            const { error } = await supabaseClient
                .from('student_track_status')
                .insert([payload]);
            if (error) {
                showToast('新增狀態失敗: ' + error.message, 'error');
            } else {
                showToast('已儲存！');
                await loadStudentTrackStatusView(true); // 帶入 true 靜默更新，完全不出現轉圈圈！
            }
        }
    } catch (e) {
        console.error(e);
    }
}

/* =================== 8. 刪除與其他輔助 =================== */
const confirmDeleteModal = document.getElementById('confirm-delete-modal');

window.openConfirmDeleteModal = function(type) {
    currentDeleteType = type;
    confirmDeleteModal.classList.remove('hidden');
    resetModalScroll('confirm-delete-modal');
};

window.closeConfirmDeleteModal = function() {
    confirmDeleteModal.classList.add('hidden');
};

window.executeDelete = async function() {
    showLoading();
    try {
        if (currentDeleteType === 'school') {
            const uid = schoolEditUid.value;
            const { error } = await supabaseClient.from('school').delete().eq('uid', uid);
            if (error) showToast('刪除失敗: ' + error.message, 'error');
            else { showToast('刪除成功！'); closeModal('school-modal'); await loadSchools(); }
        } else if (currentDeleteType === 'class') {
            const uid = classEditUid.value;
            const { error } = await supabaseClient.from('classes').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('class-modal'); await loadClasses(); await loadGlobalAnnClasses(); await loadGlobalFinFilters(); await loadGlobalTrackFilters(); }
        } else if (currentDeleteType === 'semester') {
            const uid = semesterEditUid.value;
            const { error } = await supabaseClient.from('semesters').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('semester-modal'); await loadSemesters(); await loadGlobalFinFilters(); }
        } else if (currentDeleteType === 'ann-cat') {
            const uid = annCatEditUid.value;
            const { error } = await supabaseClient.from('announcement_categories').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('ann-cat-modal'); await loadAnnouncementCategories(); }
        } else if (currentDeleteType === 'ann') {
            const uid = annEditUid.value;
            const { data: annData } = await supabaseClient.from('announcements').select('attachment_url').eq('uid', uid).single();
            if (annData && annData.attachment_url) {
                try {
                    const urlObj = new URL(annData.attachment_url);
                    const pathParts = urlObj.pathname.split(`/${BUCKET_NAME}/`);
                    if (pathParts.length > 1) await supabaseClient.storage.from(BUCKET_NAME).remove([decodeURIComponent(pathParts[1])]);
                } catch (e) { console.error(e); }
            }
            const { error } = await supabaseClient.from('announcements').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('ann-modal'); await loadAnnouncements(); }
        } else if (currentDeleteType === 'fin-record') {
            const uid = document.getElementById('fin-record-edit-uid').value;
            const { error } = await supabaseClient.from('financial_records').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('fin-record-modal'); await loadFinancialRecords(); }
        } else if (currentDeleteType === 'fin-receipt') {
            const uid = document.getElementById('fin-receipt-edit-uid').value;
            const url = document.getElementById('fin-receipt-url').value;
            if (url) {
                try {
                    const urlObj = new URL(url);
                    const pathParts = urlObj.pathname.split(`/${BUCKET_NAME}/`);
                    if (pathParts.length > 1) await supabaseClient.storage.from(BUCKET_NAME).remove([decodeURIComponent(pathParts[1])]);
                } catch (e) { console.error(e); }
            }
            const { error } = await supabaseClient.from('financial_receipts').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('fin-receipt-modal'); await loadFinancialReceipts(); }
        } else if (currentDeleteType === 'track-item') {
            const uid = document.getElementById('track-item-edit-uid').value;
            const { error } = await supabaseClient.from('tracking_items').delete().eq('uid', uid);
            if (error) showToast('刪除失敗', 'error');
            else { showToast('刪除成功！'); closeModal('track-item-modal'); await loadTrackingItems(); }
        }
    } finally {
        hideLoading();
        closeConfirmDeleteModal();
    }
};

let activeTargetType = null; 
let modalDPState = { year: 2026, month: 9 }; 
let selectedDates = { start: '', end: '', 'fin-record': '' };

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
    if (modalDPState.month > 11) { modalDPState.month = 0; modalDPState.year++; }
    else if (modalDPState.month < 0) { modalDPState.month = 11; modalDPState.year--; }
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
        if (selectedDates[activeTargetType] === formattedDate) item.classList.add('selected');
        item.textContent = day;
        item.onclick = () => { setCustomDateValue(activeTargetType, formattedDate); closeModalDatePicker(); };
        gridEl.appendChild(item);
    }
}

function setCustomDateValue(type, val) {
    selectedDates[type] = val;
    let inputEl = null, displayEl = null;
    if (type === 'start' || type === 'end') {
        inputEl = document.getElementById(`ann-${type}-date`);
        displayEl = document.getElementById(`${type}-date-display`);
    } else if (type === 'fin-record') {
        inputEl = document.getElementById('fin-record-date');
        displayEl = document.getElementById('fin-record-date-display');
    }
    if (inputEl) inputEl.value = val;
    if (displayEl) {
        if (val) { displayEl.textContent = val.replace(/-/g, ' / '); displayEl.classList.remove('placeholder'); }
        else { displayEl.textContent = '年 / 月 / 日'; displayEl.classList.add('placeholder'); }
    }
}

window.openImagePreviewModal = function(url) {
    if (!url) return;
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('image-preview-modal-img');
    if (modal && img) { img.src = url; modal.classList.remove('hidden'); }
};

window.closeImagePreviewModal = function() {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('image-preview-modal-img');
    if (modal) modal.classList.add('hidden');
    if (img) img.src = '';
};

checkUser();