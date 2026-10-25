// 取得網址列的 ?uid= 參數
const urlParams = new URLSearchParams(window.location.search);
const CLASS_UID = urlParams.get('uid');

let currentFinSub = 'rec';
let activeExpandedAnnUid = null; // 記錄目前展開的公告 UID（互斥用）

function switchTab(type) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('ann-section').classList.toggle('active', type === 'announcement');
    document.getElementById('fin-section').classList.toggle('active', type === 'financial');
    event.target.classList.add('active');
    if (type === 'announcement') loadAnnouncements();
    else loadFinancialData();
}

function switchFinSub(sub) {
    currentFinSub = sub;
    document.getElementById('pill-rec').classList.toggle('active', sub === 'rec');
    document.getElementById('pill-rcp').classList.toggle('active', sub === 'rcp');
    document.getElementById('fin-rec-view').classList.toggle('hidden', sub !== 'rec');
    document.getElementById('fin-rcp-view').classList.toggle('hidden', sub !== 'rcp');
    loadFinancialData();
}

// 初始化檢查：若沒有 uid 則顯示 404 畫面，並使用雙保險方式抓取學校與班級名稱
async function initPage() {
    if (!CLASS_UID) {
        document.getElementById('error-404-card').classList.remove('hidden');
        return;
    }

    // 1. 先抓班級資料
    const { data: classData, error: classError } = await supabaseClient
        .from('classes')
        .select('*')
        .eq('uid', CLASS_UID)
        .single();
    
    if (classError || !classData) {
        document.getElementById('error-404-card').classList.remove('hidden');
        return;
    }

    let schoolName = '';
    
    // 2. 透過 school_uid 獨立查詢學校名稱
    const schoolId = classData.school_uid || classData.schoolUid || classData.SchoolUid || classData.school_id;

    if (schoolId) {
        const { data: schoolData } = await supabaseClient
            .from('school')
            .select('name')
            .eq('uid', schoolId)
            .single();
        
        if (schoolData && schoolData.name) {
            schoolName = schoolData.name.trim();
        } else {
            // 如果小寫 school 找不到，嘗試大寫 School
            const { data: schoolDataUpper } = await supabaseClient
                .from('School')
                .select('name')
                .eq('uid', schoolId)
                .single();
            if (schoolDataUpper && schoolDataUpper.name) {
                schoolName = schoolDataUpper.name.trim();
            }
        }
    }

    const className = classData.name ? classData.name.trim() : '';
    
    let displayTitle = '';
    let headerText = '';

    if (!schoolName || !className) {
        displayTitle = '班級公告與財務專區';
        headerText = '班級資訊專區';
    } else {
        displayTitle = `${schoolName}${className}`;
        headerText = `${schoolName}${className}`;
    }

    document.title = displayTitle;
    document.getElementById('main-content-card').classList.remove('hidden');
    document.getElementById('class-title-header').textContent = headerText;

    await initSemesters();
    await loadAnnouncements();
}

function getNowUTC8() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
}

function isWithinDisplayRange(startDate, startTime, endDate, endTime) {
    const nowUTC8 = getNowUTC8();

    if (startDate && startDate !== 'null') {
        const startStr = `${startDate} ${startTime && startTime !== 'null' ? startTime : '00:00'}`;
        const startDateTime = new Date(startStr.replace(/-/g, '/'));
        if (nowUTC8 < startDateTime) return false;
    }

    if (endDate && endDate !== 'null') {
        const endStr = `${endDate} ${endTime && endTime !== 'null' ? endTime : '23:59'}`;
        const endDateTime = new Date(endStr.replace(/-/g, '/'));
        if (nowUTC8 > endDateTime) return false;
    }

    return true;
}

// 切換公告展開/收合（手風琴互斥機制）
window.toggleAnnExpand = function(uid, hasContent) {
    if (!hasContent) return; // 如果沒有內容與圖片，點擊不作動

    const contentEl = document.getElementById(`ann-content-${uid}`);
    const iconEl = document.getElementById(`ann-icon-${uid}`);
    
    if (!contentEl) return;

    if (activeExpandedAnnUid === uid) {
        contentEl.classList.add('hidden');
        if (iconEl) iconEl.className = 'fa-solid fa-chevron-down';
        activeExpandedAnnUid = null;
    } else {
        if (activeExpandedAnnUid) {
            const prevContent = document.getElementById(`ann-content-${activeExpandedAnnUid}`);
            const prevIcon = document.getElementById(`ann-icon-${activeExpandedAnnUid}`);
            if (prevContent) prevContent.classList.add('hidden');
            if (prevIcon) prevIcon.className = 'fa-solid fa-chevron-down';
        }

        contentEl.classList.remove('hidden');
        if (iconEl) iconEl.className = 'fa-solid fa-chevron-up';
        activeExpandedAnnUid = uid;
    }
};

// 載入公告列表
async function loadAnnouncements() {
    const listEl = document.getElementById('parent-ann-list');
    listEl.innerHTML = '<div style="text-align:center; color:#888; padding:20px;">資料載入中...</div>';
    
    const { data } = await supabaseClient
        .from('announcements')
        .select(`uid, name, note, attachment_url, is_pinned, start_date, start_time, end_date, end_time, announcement_categories ( name, color )`)
        .eq('class_uid', CLASS_UID)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    listEl.innerHTML = '';
    if (data && data.length > 0) {
        const filteredData = data.filter(item => {
            return isWithinDisplayRange(item.start_date, item.start_time, item.end_date, item.end_time);
        });

        if (filteredData.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無符合顯示區間的公告資料</div>`;
            return;
        }

        filteredData.forEach(item => {
            const catName = item.announcement_categories ? item.announcement_categories.name : '一般';
            const catColor = item.announcement_categories ? item.announcement_categories.color : '#64748b';
            const pinBadge = item.is_pinned ? `<span class="pin-tag">置頂</span>` : '';
            
            // 檢查是否有實際內容或圖片附件
            const hasNote = item.note && item.note.trim() !== '' && item.note !== '<p><br></p>';
            const hasAttachment = item.attachment_url && item.attachment_url.trim() !== '';
            const hasContent = hasNote || hasAttachment;

            let imgHtml = hasAttachment ? `
                <div style="flex-shrink: 0; cursor: pointer; margin-bottom: 12px;" onclick="openImagePreviewModal('${item.attachment_url}')">
                    <img src="${item.attachment_url}" alt="公告圖片" style="max-height: 150px; border-radius: 8px; border: 1px solid #cbd5e1; display: block;">
                </div>
            ` : '';

            const isExpanded = activeExpandedAnnUid === item.uid;
            const contentHiddenClass = isExpanded ? '' : 'hidden';
            const chevronIconClass = isExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';

            // 若無內容，右側就不顯示展開按鈕與提示
            const rightActionHtml = hasContent ? `
                <div style="display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 14px; font-weight: 500; cursor: pointer;" onclick="toggleAnnExpand('${item.uid}', true)">
                    <span>詳細內容</span>
                    <i id="ann-icon-${item.uid}" class="${chevronIconClass}"></i>
                </div>
            ` : '';

            const cardCursorStyle = hasContent ? 'cursor: pointer;' : '';
            const clickEventAttr = hasContent ? `onclick="toggleAnnExpand('${item.uid}', true)"` : '';

            listEl.innerHTML += `
                <div class="custom-card-item" style="flex-direction: column; align-items: stretch;">
                    <!-- 上方標籤列與右側展開按鈕 -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${pinBadge}
                            <span class="category-badge" style="background-color: ${catColor};">${catName}</span>
                        </div>
                        ${rightActionHtml}
                    </div>

                    <!-- 下方標題列 -->
                    <div style="margin-top: 6px; ${cardCursorStyle}" ${clickEventAttr}>
                        <div class="card-title" style="font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 0;">${item.name}</div>
                    </div>

                    <!-- 詳細內容區塊（僅在有內容時渲染） -->
                    ${hasContent ? `
                        <div id="ann-content-${item.uid}" class="${contentHiddenClass}" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9;">
                            ${imgHtml}
                            <div class="card-sub" style="color: #333; line-height: 1.6;">${item.note || ''}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
    } else {
        listEl.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無公告資料</div>`;
    }
}

async function initSemesters() {
    const semSelect = document.getElementById('semester-select');
    const { data } = await supabaseClient.from('semesters').select('*').order('sort_order', { ascending: true });
    semSelect.innerHTML = '<option value="">-- 全部學期 --</option>';
    if (data) {
        data.forEach(s => {
            semSelect.innerHTML += `<option value="${s.uid}">${s.name}</option>`;
            if (s.is_default) semSelect.value = s.uid;
        });
    }
}

async function loadFinancialData() {
    const semUid = document.getElementById('semester-select').value;
    
    let query = supabaseClient.from('financial_records').select(`
        uid, name, remark, date, amount, type,
        classes ( academic_year, name ),
        semesters ( name )
    `).eq('class_uid', CLASS_UID).order('created_at', { ascending: false });
    
    if (semUid) query = query.eq('semester_uid', semUid);
    const { data: records } = await query;

    const { data: allRecords } = await supabaseClient.from('financial_records').select('amount, type').eq('class_uid', CLASS_UID);
    let totalInc = 0, totalExp = 0, curInc = 0, curExp = 0;
    if (allRecords) {
        allRecords.forEach(r => {
            const amt = Number(r.amount) || 0;
            if (Number(r.type) === 1) totalInc += amt; else totalExp += amt;
        });
    }
    
    const recListEl = document.getElementById('parent-fin-rec-list');
    recListEl.innerHTML = '';
    if (records && records.length > 0) {
        records.forEach(item => {
            const isInc = Number(item.type) === 1;
            const amt = Number(item.amount) || 0;
            if (isInc) curInc += amt; else curExp += amt;
            const badge = isInc ? `<span class="type-badge inc">收入</span>` : `<span class="type-badge exp">支出</span>`;
            const semesterName = item.semesters ? item.semesters.name : '未知學期';

            recListEl.innerHTML += `
                <div class="custom-card-item">
                    <div class="card-info" style="flex:1;">
                        <div class="card-title">${badge} <span>${item.name}</span></div>
                        <div class="card-sub" style="margin-top: 4px; line-height: 1.5;">
                            <div style="color: #64748b;">學期: ${semesterName}</div>
                            <div style="color: #475569; font-size: 12px;"><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>發生日期: ${item.date || ''}</div>
                            ${item.remark ? `<div style="color: #64748b; font-size: 12px; margin-top: 2px;">備註: ${item.remark}</div>` : ''}
                        </div>
                    </div>
                    <div style="color: ${isInc ? '#00b96b' : '#ff4d4f'}; font-weight: bold; font-size: 16px;">
                        ${isInc ? '+' : '-'}$${amt.toLocaleString()}
                    </div>
                </div>
            `;
        });
    } else {
        recListEl.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無收支明細</div>`;
    }

    const balance = curInc - curExp;
    const totalBalance = totalInc - totalExp;
    document.getElementById('fin-summary').innerHTML = `
        <div class="summary-item"><span class="summary-label">收入:</span><span class="inc">+$${curInc.toLocaleString()}</span></div>
        <div class="summary-item"><span class="summary-label">支出:</span><span class="exp">-$${curExp.toLocaleString()}</span></div>
        <div class="summary-item"><span class="summary-label">結餘:</span><span class="balance" style="color: ${balance >= 0 ? '#00b96b' : '#ff4d4f'}">$${balance.toLocaleString()}</span></div>
        <div class="summary-item"><span class="summary-label">總餘:</span><span class="total-balance" style="color: ${totalBalance >= 0 ? '#00b96b' : '#ff4d4f'}">$${totalBalance.toLocaleString()}</span></div>
    `;

    let rcpQuery = supabaseClient.from('financial_receipts').select(`
        uid, receipt_url, remark,
        semesters ( name )
    `).eq('class_uid', CLASS_UID).order('created_at', { ascending: false });
    
    if (semUid) rcpQuery = rcpQuery.eq('semester_uid', semUid);
    const { data: receipts } = await rcpQuery;

    const rcpListEl = document.getElementById('parent-fin-rcp-list');
    rcpListEl.innerHTML = '';
    if (receipts && receipts.length > 0) {
        receipts.forEach(item => {
            const semesterName = item.semesters ? item.semesters.name : '未知學期';

            rcpListEl.innerHTML += `
                <div class="custom-card-item">
                    <div style="display: flex; gap: 14px; align-items: center; width: 100%;">
                        <div style="flex-shrink: 0; cursor: pointer;" onclick="openImagePreviewModal('${item.receipt_url}')">
                            <img src="${item.receipt_url}" alt="發票憑證" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;">
                        </div>
                        <div class="card-info" style="flex: 1; min-width: 0;">
                            <div class="card-sub" style="margin-top: 4px; line-height: 1.4;">
                                <div>學期: ${semesterName}</div>
                                ${item.remark ? `<div style="color: #1e293b; font-weight: 500;">備註: ${item.remark}</div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        rcpListEl.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">目前尚無憑證收據</div>`;
    }
}

function openImagePreviewModal(url) {
    if (!url) return;
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('image-preview-modal-img');
    if (modal && img) {
        img.src = url;
        modal.classList.remove('hidden');
    }
}

function closeImagePreviewModal() {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('image-preview-modal-img');
    if (modal) modal.classList.add('hidden');
    if (img) img.src = '';
}

initPage();