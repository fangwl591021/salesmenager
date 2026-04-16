/**
 * card.js 
 * Version: v2.1.6 (功能完整恢復版：修正 WORKER_URL 與 連線邏輯)
 */
const LIFF_ID = "2008924519-RslRiLoO"; 
const WORKER_URL = "https://salesmemager.fangwl591021.workers.dev/"; 

let cropper = null;
let currentCropMode = 'card'; 
let globalContacts = [];
let currentActiveCard = null;

// ⭐ 定義 initApp，確保 100% 被呼叫
window.initApp = async function() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        
        const profile = await liff.getProfile();
        // 使用 Worker 聚合端點，一次性取得使用者資訊與名片列表
        const res = await fetchAPI('initApp', { userId: profile.userId });
        
        globalContacts = res.contacts || [];
        renderCardList(globalContacts);

        document.getElementById('view-loading').classList.add('hidden');
        document.getElementById('view-list').classList.remove('hidden');
        document.getElementById('bottom-nav-admin').classList.remove('hidden');
        
    } catch (err) {
        document.getElementById('loading-text').innerHTML = `<span class="text-red-500">連線異常</span><br><small>${err.message}</small>`;
    }
};

window.fetchAPI = async function(action, payload = {}) {
    const response = await fetch(WORKER_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain' }, // 穿透 CORS
        body: JSON.stringify({ action, payload })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
};

// 📸 拍照裁切邏輯
window.openCropper = function(input, mode) {
    if (!input.files || !input.files[0]) return;
    currentCropMode = mode;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.getElementById('cropper-image');
        img.src = e.target.result;
        document.getElementById('section-image-cropper').classList.remove('hidden');
        if (cropper) cropper.destroy();
        cropper = new Cropper(img, { aspectRatio: NaN, viewMode: 1 });
    };
    reader.readAsDataURL(input.files[0]);
};

window.cancelCrop = function() {
    document.getElementById('section-image-cropper').classList.add('hidden');
    if (cropper) cropper.destroy();
};

window.confirmCrop = async function() {
    if (!cropper) return;
    const base64 = cropper.getCroppedCanvas({ maxWidth: 1024 }).toDataURL('image/jpeg', 0.8);
    window.cancelCrop();

    if (currentCropMode === 'card') {
        document.getElementById('view-list').classList.add('hidden');
        document.getElementById('view-process').classList.remove('hidden');
        document.getElementById('section-loading').classList.remove('hidden');
        document.getElementById('section-form').classList.add('hidden');
        
        try {
            // 同時向 Worker 請求 AI 辨識 (OCR + 命理)
            const res = await fetchAPI('recognizeCard', { base64Image: base64 });
            fillForm(res);
            document.getElementById('process-preview-image').src = base64;
            document.getElementById('section-loading').classList.add('hidden');
            document.getElementById('section-form').classList.remove('hidden');
        } catch (e) {
            window.showToast("辨識超時或失敗", true);
            resetUI();
        }
    }
};

function fillForm(data) {
    const fields = ['Name','EnglishName','Title','Department','CompanyName','Mobile','Email','Address','Slogan'];
    fields.forEach(f => {
        const el = document.getElementById(`f-${f}`);
        if (el) el.value = data[f] || '';
    });
}

function renderCardList(list) {
    const container = document.getElementById('admin-card-list-container');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 py-20">查無名片資料</p>`;
        return;
    }
    container.innerHTML = list.map(c => `
      <div onclick="openReadOnlyCard('${c.rowId}')" class="bg-white p-4 border-b border-gray-100 flex items-center gap-4 active:bg-gray-50 transition-colors">
        <img src="${c.imgUrl}" class="w-12 h-12 rounded-lg object-cover border border-gray-100" onerror="this.src='https://ui-avatars.com/api/?name=${c.Name}'">
        <div class="flex-1">
            <h3 class="font-bold text-gray-800 text-[15px]">${c.Name || '未知'}</h3>
            <p class="text-xs text-gray-400">${c.CompanyName || ''}</p>
        </div>
        <i data-lucide="chevron-right" class="text-gray-300 w-5 h-5"></i>
      </div>
    `).join('');
    lucide.createIcons({ root: container });
}

window.openReadOnlyCard = function(rowId) {
    const card = globalContacts.find(c => String(c.rowId) === String(rowId));
    if (!card) return;
    currentActiveCard = card;

    document.getElementById('ro-name').innerText = card.Name;
    document.getElementById('ro-title').innerText = card['職稱'] || '';
    document.getElementById('ro-company').innerText = card.CompanyName || '未提供公司';
    document.getElementById('ro-mobile-link').innerText = card.Mobile || '無電話';
    document.getElementById('ro-mobile-link').href = `tel:${card.Mobile}`;
    document.getElementById('ro-email-link').innerText = card['電子郵件'] || '無信箱';
    document.getElementById('ro-email-link').href = `mailto:${card['電子郵件']}`;
    document.getElementById('ro-address').innerText = card['公司地址'] || '無地址';
    document.getElementById('ro-notes').innerText = card['建檔人/備註'] || '';

    if (card.imgUrl && card.imgUrl.startsWith('http')) {
        document.getElementById('ro-image').src = card.imgUrl;
        document.getElementById('ro-image').classList.remove('hidden');
    } else {
        document.getElementById('ro-image').classList.add('hidden');
    }

    document.getElementById('readonly-card-modal').classList.remove('hidden');
};

window.closeReadOnlyCard = function() { document.getElementById('readonly-card-modal').classList.add('hidden'); };
window.resetUI = function() { document.getElementById('view-process').classList.add('hidden'); document.getElementById('view-list').classList.remove('hidden'); };

window.showToast = function(msg, isError = false) {
    const t = document.getElementById('toast'); if (!t) return;
    t.innerHTML = `<i data-lucide="${isError?'alert-circle':'check-circle-2'}" class="w-4 h-4"></i> ${msg}`;
    t.className = `fixed top-16 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-full text-sm font-bold shadow-lg z-[10000] ${isError?'bg-red-500':'bg-gray-800'} text-white opacity-100`;
    t.classList.remove('hidden'); lucide.createIcons({ root: t });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 300); }, 3000); 
};

window.onload = window.initApp;
