/**
 * card.js 
 * Version: v2.1.4 (修正：補完相機裁切觸發邏輯與網址校正)
 */
const LIFF_ID = "2008924519-RslRiLoO"; 
const WORKER_URL = "https://salesmemager.fangwl591021.workers.dev/"; 
const CACHE_KEY_CONTACTS = "app_cache_card_contacts_v3";

let cropper = null;
let currentCropMode = 'card'; // 'card' or 'ecard' or 'v2logo'
let globalContacts = [];

window.showToast = function(msg, isError = false) {
  const t = document.getElementById('toast'); if (!t) return;
  t.innerHTML = `<i data-lucide="${isError?'alert-circle':'check-circle-2'}" class="w-4 h-4"></i> ${msg}`;
  t.className = `fixed top-16 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-full text-[14px] shadow-lg font-bold flex items-center gap-2 ${isError?'bg-red-500':'bg-gray-800'} text-white opacity-100 z-[10000]`;
  t.classList.remove('hidden'); lucide.createIcons({ root: t });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 300); }, 3000); 
};

window.fetchAPI = async function(action, payload = {}, silent = false) {
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST', 
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, payload })
    });
    const resText = await response.text();
    const result = JSON.parse(resText);
    if (!result.success) throw new Error(result.error || "連線異常");
    return result.data;
  } catch (err) {
    if (!silent) window.showToast(err.message, true);
    throw err;
  }
};

// 📸 拍照或上傳後觸發：開啟裁切器
window.openCropper = function(input, mode) {
    if (!input.files || !input.files[0]) return;
    currentCropMode = mode;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const cropperImg = document.getElementById('cropper-image');
        cropperImg.src = e.target.result;
        document.getElementById('section-image-cropper').classList.remove('hidden');
        if (cropper) cropper.destroy();
        cropperImg.style.opacity = '1';
        cropper = new Cropper(cropperImg, {
            aspectRatio: mode === 'v2logo' ? 1 : NaN,
            viewMode: 1,
            autoCropArea: 1
        });
    };
    reader.readAsDataURL(file);
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
        // 辨識流程
        document.getElementById('view-list').classList.add('hidden');
        document.getElementById('view-process').classList.remove('hidden');
        document.getElementById('section-loading').classList.remove('hidden');
        document.getElementById('section-form').classList.add('hidden');
        
        try {
            const res = await window.fetchAPI('recognizeCard', { base64Image: base64 });
            fillForm(res);
            document.getElementById('process-preview-image').src = base64;
            document.getElementById('section-loading').classList.add('hidden');
            document.getElementById('section-form').classList.remove('hidden');
        } catch (e) {
            window.showToast("辨識失敗", true);
            resetUI();
        }
    } else {
        // 更新電子名片預覽 (V1/V2)
        if (typeof window.updateECardPreview === 'function') {
            window.updateECardPreview(base64, currentCropMode);
        }
    }
};

function fillForm(data) {
    const fields = ['Name', 'EnglishName', 'Title', 'Department', 'CompanyName', 'TaxID', 'Mobile', 'Tel', 'Ext', 'Fax', 'Address', 'Email', 'Website', 'SocialMedia', 'Slogan'];
    fields.forEach(f => {
        const el = document.getElementById(`f-${f}`);
        if (el) el.value = data[f] || '';
    });
}

function resetUI() {
    document.getElementById('view-process').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
}

window.onload = async () => {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        const initData = await fetchAPI('initApp', { userId: profile.userId, reqContacts: true });
        globalContacts = initData.contacts || [];
        renderCardList(globalContacts);
        document.getElementById('view-loading').classList.add('hidden');
        document.getElementById('view-list').classList.remove('hidden');
        document.getElementById('bottom-nav-admin').classList.remove('hidden');
    } catch (e) {
        document.getElementById('view-loading').innerHTML = `<p class="text-red-500 font-bold">系統初始化異常</p>`;
    }
};

function renderCardList(list) {
    const container = document.getElementById('admin-card-list-container');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 py-20 font-bold">目前無名片資料</p>`;
        return;
    }
    container.innerHTML = list.map(c => `
      <div class="bg-white p-4 border-b border-gray-100 flex items-center gap-4 active:bg-gray-50 transition-colors">
        <div class="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
            <img src="${c.imgUrl || ''}" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${c.Name}&background=random'">
        </div>
        <div class="flex-1">
            <h3 class="font-bold text-gray-800 text-[15px]">${c.Name || '未知'}</h3>
            <p class="text-xs text-gray-400">${c.CompanyName || '未提供公司名'}</p>
        </div>
        <i data-lucide="chevron-right" class="text-gray-300 w-5 h-5"></i>
      </div>
    `).join('');
    lucide.createIcons({ root: container });
}
