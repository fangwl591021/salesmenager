/**
 * card.js
 * Version: v2.1.5 (穩定性修復版)
 * 解決 initApp 未定義與相機連線異常問題
 */
const LIFF_ID = "2008924519-RslRiLoO"; 
const WORKER_URL = "https://salesmemager.fangwl591021.workers.dev/"; 

let cropper = null;
let currentCropMode = 'card'; 
let globalContacts = [];

// 定義 initApp 函式，確保 HTML 呼叫時存在
window.initApp = async function() {
    try {
        const loadingView = document.getElementById('view-loading');
        const listView = document.getElementById('view-list');
        
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        
        const profile = await liff.getProfile();
        const res = await fetchAPI('initApp', { userId: profile.userId });
        
        globalContacts = res.contacts || [];
        renderCardList(globalContacts);

        if(loadingView) loadingView.classList.add('hidden');
        if(listView) listView.classList.remove('hidden');
        
        // 渲染導覽列狀態
        const nav = document.getElementById('bottom-nav-admin');
        if(nav) nav.classList.remove('hidden');
        
    } catch (err) {
        console.error(err);
        const loadingText = document.getElementById('loading-text');
        if(loadingText) loadingText.innerHTML = `<span class="text-red-500">系統初始化異常</span><br><small>${err.message}</small>`;
        window.showToast(err.message, true);
    }
};

window.fetchAPI = async function(action, payload = {}) {
    const response = await fetch(WORKER_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, payload })
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
};

// 修正相機拍照後的「繼續」邏輯
window.openCropper = function(input, mode) {
    if (!input.files || !input.files[0]) return;
    currentCropMode = mode;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.getElementById('cropper-image');
        img.src = e.target.result;
        document.getElementById('section-image-cropper').classList.remove('hidden');
        if (cropper) cropper.destroy();
        img.style.opacity = '1';
        cropper = new Cropper(img, { aspectRatio: mode==='v2logo'?1:NaN, viewMode:1 });
    };
    reader.readAsDataURL(input.files[0]);
};

window.confirmCrop = async function() {
    if (!cropper) return;
    const base64 = cropper.getCroppedCanvas({ maxWidth: 1024 }).toDataURL('image/jpeg', 0.8);
    document.getElementById('section-image-cropper').classList.add('hidden');
    
    if (currentCropMode === 'card') {
        document.getElementById('view-list').classList.add('hidden');
        document.getElementById('view-process').classList.remove('hidden');
        document.getElementById('section-loading').classList.remove('hidden');
        document.getElementById('section-form').classList.add('hidden');
        
        try {
            // 同時執行辨識與填表
            const res = await fetchAPI('recognizeCard', { base64Image: base64 });
            const fields = ['Name','EnglishName','Title','Department','CompanyName','TaxID','Mobile','Tel','Ext','Fax','Address','Email','Website','SocialMedia','Slogan'];
            fields.forEach(f => {
                const el = document.getElementById(`f-${f}`);
                if (el) el.value = res[f] || '';
            });
            document.getElementById('process-preview-image').src = base64;
            document.getElementById('section-loading').classList.add('hidden');
            document.getElementById('section-form').classList.remove('hidden');
        } catch (e) {
            window.showToast("辨識失敗：" + e.message, true);
            window.resetUI();
        }
    }
};

window.resetUI = function() {
    document.getElementById('view-process').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
};

function renderCardList(list) {
    const container = document.getElementById('admin-card-list-container');
    if (!container) return;
    container.innerHTML = list.map(c => `
      <div class="bg-white p-4 border-b border-gray-100 flex items-center gap-4 active:bg-gray-50 transition-colors">
        <div class="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200">
            <img src="${c.imgUrl}" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${c.Name}'">
        </div>
        <div class="flex-1">
            <h3 class="font-bold text-gray-800">${c.Name || '未知'}</h3>
            <p class="text-xs text-gray-400">${c.CompanyName || ''}</p>
        </div>
        <i data-lucide="chevron-right" class="text-gray-300 w-5 h-5"></i>
      </div>
    `).join('');
    lucide.createIcons({ root: container });
}

window.showToast = function(msg, isError = false) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerHTML = `<i data-lucide="${isError?'alert-circle':'check-circle-2'}" class="w-4 h-4"></i> ${msg}`;
    t.className = `fixed top-14 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full text-[14px] shadow-lg transition-all font-bold flex items-center gap-2 ${isError?'bg-red-500':'bg-gray-800'} text-white opacity-100 z-[10000]`;
    t.classList.remove('hidden');
    lucide.createIcons({ root: t });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 300); }, 3000); 
};

// 啟動初始化
window.onload = window.initApp;
