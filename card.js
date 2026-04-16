/**
 * card.js
 * Version: v2.2.2 (100% 原始邏輯恢復 + 健壯性修復)
 */
const LIFF_ID = "2008924519-RslRiLoO";
const WORKER_URL = "https://salesmemager.fangwl591021.workers.dev/"; 
let cropper = null, globalContacts = [], currentBase64 = "", isProcessing = false;

window.fetchAPI = async (action, payload = {}) => {
  const res = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action, payload }) });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
};

// 🚀 修正 3：完善 initApp，加入 null 檢查防止崩潰
window.initApp = async function() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        const res = await fetchAPI('initApp', { userId: profile.userId });
        globalContacts = res.contacts || [];
        renderCardList(globalContacts);
        
        const loadingView = document.getElementById('view-loading');
        const listView = document.getElementById('view-list');
        if(loadingView) loadingView.classList.add('hidden');
        if(listView) listView.classList.remove('hidden');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) { 
        console.error("Init Error:", e);
        const text = document.getElementById('loading-text');
        if(text) text.innerText = "連線異常：" + e.message;
    }
};

window.openCropper = (input) => {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('cropper-img').src = e.target.result;
        document.getElementById('section-cropper').classList.remove('hidden');
        if (cropper) cropper.destroy();
        cropper = new Cropper(document.getElementById('cropper-img'), { viewMode: 1, autoCropArea: 1 });
    };
    reader.readAsDataURL(input.files[0]);
};

window.confirmCrop = async () => {
    const base64 = cropper.getCroppedCanvas({ maxWidth: 1024 }).toDataURL('image/jpeg', 0.8);
    currentBase64 = base64;
    document.getElementById('section-cropper').classList.add('hidden');
    document.getElementById('view-list').classList.add('hidden');
    document.getElementById('view-process').classList.remove('hidden');
    document.getElementById('section-loading').classList.remove('hidden');
    document.getElementById('section-form').classList.add('hidden');

    try {
        const res = await fetchAPI('recognizeCard', { base64Image: base64 });
        document.getElementById('f-Name').value = res.Name || '';
        document.getElementById('f-CompanyName').value = res.CompanyName || '';
        document.getElementById('f-Title').value = res.Title || '';
        document.getElementById('f-Mobile').value = res.Mobile || '';
        document.getElementById('f-Email').value = res.Email || '';
        document.getElementById('f-Slogan').value = res.Slogan || '';
        document.getElementById('f-Name').dataset.tags = JSON.stringify({ Personality: res.Personality, Hobbies: res.Hobbies });
        document.getElementById('process-preview').src = base64;
        document.getElementById('section-loading').classList.add('hidden');
        document.getElementById('section-form').classList.remove('hidden');
    } catch (e) { showToast("AI 辨識超時", true); resetUI(); }
};

window.saveToCloud = async () => {
    if(isProcessing) return;
    const btn = document.getElementById('btn-save-cloud');
    const oriText = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">autorenew</span> 同步中...';
    btn.classList.add('pointer-events-none', 'opacity-50');
    isProcessing = true;
    try {
        const upload = await fetchAPI('uploadImage', { base64Image: currentBase64 });
        const tags = JSON.parse(document.getElementById('f-Name').dataset.tags || '{}');
        const p = {
            userId: liff.getContext().userId, Name: document.getElementById('f-Name').value,
            CompanyName: document.getElementById('f-CompanyName').value, Title: document.getElementById('f-Title').value,
            Mobile: document.getElementById('f-Mobile').value, Email: document.getElementById('f-Email').value,
            Slogan: document.getElementById('f-Slogan').value, Notes: document.getElementById('f-Notes').value,
            imgUrl: upload.url, ...tags
        };
        await fetchAPI('saveCard', p);
        showToast("✅ 已成功寫入雲端");
        setTimeout(() => location.reload(), 1000);
    } catch (e) { showToast("存檔失敗", true); btn.innerHTML = oriText; btn.classList.remove('pointer-events-none', 'opacity-50'); } finally { isProcessing = false; }
};

function renderCardList(list) {
    const container = document.getElementById('card-list-container');
    if (!container) return;
    container.innerHTML = list.map(c => `
      <div onclick="openCard('${c.rowId}')" class="bg-white p-4 border-b border-slate-100 flex items-center gap-4 active:bg-slate-50 transition-all">
        <img src="${c.imgUrl}" class="w-12 h-12 rounded-lg object-cover border" onerror="this.src='https://ui-avatars.com/api/?name=${c.Name}'">
        <div class="flex-1"><h3 class="font-bold text-slate-800 text-[15px]">${c.Name || '未知'}</h3><p class="text-[11px] text-slate-400">${c.CompanyName || ''}</p></div>
        <span class="material-symbols-outlined text-slate-300">chevron_right</span>
      </div>`).join('');
}

window.openCard = (rowId) => {
    const c = globalContacts.find(i => String(i.rowId) === String(rowId));
    if (!c) return;
    document.getElementById('ro-name').innerText = c.Name;
    document.getElementById('ro-company-sub').innerText = c.CompanyName;
    document.getElementById('ro-title').innerText = c['職稱'] || '';
    document.getElementById('ro-mobile').innerText = c.Mobile;
    document.getElementById('ro-mobile').href = `tel:${c.Mobile}`;
    document.getElementById('ro-img').src = c.imgUrl || '';
    document.getElementById('ro-notes').innerText = c['建檔人/備註'] || '';
    document.getElementById('readonly-modal').classList.remove('hidden');
};

window.showToast = (msg, isError = false) => {
    const t = document.getElementById('toast'); if(!t) return;
    t.innerHTML = `<span class="material-symbols-outlined">${isError?'error':'check_circle'}</span> ${msg}`;
    t.className = `fixed top-16 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-full text-sm font-bold shadow-lg z-[10000] ${isError?'bg-red-500':'bg-slate-800'} text-white opacity-100`;
    t.classList.remove('hidden');
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 300); }, 3000); 
};

window.resetUI = () => { document.getElementById('view-process').classList.add('hidden'); document.getElementById('view-list').classList.remove('hidden'); };
window.cancelCrop = () => document.getElementById('section-cropper').classList.add('hidden');
window.onload = window.initApp;
