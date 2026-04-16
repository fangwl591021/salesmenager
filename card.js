/**
 * card.js
 * Version: v2.2.0 (全邏輯還原版 - 解決 saveToCloud)
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

window.initApp = async function() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        const res = await fetchAPI('initApp', { userId: profile.userId });
        globalContacts = res.contacts || [];
        renderCardList(globalContacts);
        document.getElementById('view-loading').classList.add('hidden');
        document.getElementById('view-list').classList.remove('hidden');
        lucide.createIcons();
    } catch (e) { document.getElementById('loading-text').innerText = "系統連線異常"; }
};

window.openCropper = (input) => {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('cropper-img').src = e.target.result;
        document.getElementById('section-cropper').classList.remove('hidden');
        if (cropper) cropper.destroy();
        cropper = new Cropper(document.getElementById('cropper-img'), { viewMode: 1 });
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
        document.getElementById('f-Slogan').value = res.Slogan || '';
        document.getElementById('f-Name').dataset.tags = JSON.stringify({ Personality: res.Personality, Hobbies: res.Hobbies });
        document.getElementById('process-preview').src = base64;
        document.getElementById('section-loading').classList.add('hidden');
        document.getElementById('section-form').classList.remove('hidden');
    } catch (e) { showToast("AI 辨識異常", true); resetUI(); }
};

window.saveToCloud = async () => {
    if(isProcessing) return;
    const btn = document.getElementById('btn-save-cloud');
    const oriText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 mr-2"></i> 同步中...';
    lucide.createIcons({ root: btn });
    btn.classList.add('pointer-events-none', 'opacity-50');
    isProcessing = true;
    try {
        const upload = await fetchAPI('uploadImage', { base64Image: currentBase64 });
        const tags = JSON.parse(document.getElementById('f-Name').dataset.tags || '{}');
        const p = { userId: liff.getDecodedIDToken().sub, Name: document.getElementById('f-Name').value, CompanyName: document.getElementById('f-CompanyName').value, Title: document.getElementById('f-Title').value, Mobile: document.getElementById('f-Mobile').value, Email: document.getElementById('f-Email').value, Slogan: document.getElementById('f-Slogan').value, Notes: document.getElementById('f-Notes').value, imgUrl: upload.url, ...tags };
        await fetchAPI('saveCard', p);
        showToast("✅ 已同步至雲端");
        setTimeout(() => location.reload(), 1200);
    } catch (e) { showToast("存檔失敗", true); btn.innerHTML = oriText; btn.classList.remove('pointer-events-none', 'opacity-50'); } finally { isProcessing = false; }
};

function renderCardList(list) {
    const container = document.getElementById('card-list-container');
    container.innerHTML = list.map(c => `
      <div onclick="openCard('${c.rowId}')" class="bg-white p-4 border-b border-slate-100 flex items-center gap-4 active:bg-slate-50 transition-all">
        <img src="${c.imgUrl}" class="w-12 h-12 rounded-lg object-cover border" onerror="this.src='https://ui-avatars.com/api/?name=${c.Name}'">
        <div class="flex-1"><h3 class="font-bold text-slate-800 text-[15px]">${c.Name || '未知'}</h3><p class="text-[11px] text-slate-400">${c.CompanyName || ''}</p></div>
        <i data-lucide="chevron-right" class="text-slate-300 w-4 h-4"></i>
      </div>`).join('');
    lucide.createIcons({ root: container });
}

window.openCard = (rowId) => {
    const c = globalContacts.find(i => String(i.rowId) === String(rowId));
    if (!c) return;
    document.getElementById('ro-name').innerText = c.Name;
    document.getElementById('ro-company').innerText = c.CompanyName;
    document.getElementById('ro-mobile').innerText = c.Mobile;
    document.getElementById('ro-mobile').href = `tel:${c.Mobile}`;
    document.getElementById('ro-img').src = c.imgUrl || '';
    document.getElementById('readonly-modal').classList.remove('hidden');
    lucide.createIcons({ root: document.getElementById('readonly-modal') });
};

window.showToast = (msg, isError = false) => {
    const t = document.getElementById('toast'); if(!t) return;
    t.innerHTML = `<i data-lucide="${isError?'alert-circle':'check-circle-2'}" class="w-4 h-4"></i> ${msg}`;
    t.className = `fixed top-16 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-full text-sm font-bold shadow-lg z-[10000] ${isError?'bg-red-500':'bg-slate-800'} text-white opacity-100`;
    t.classList.remove('hidden'); lucide.createIcons({ root: t });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.classList.add('hidden'), 300); }, 3000); 
};

window.resetUI = () => { document.getElementById('view-process').classList.add('hidden'); document.getElementById('view-list').classList.remove('hidden'); };
window.cancelCrop = () => document.getElementById('section-cropper').classList.add('hidden');
window.onload = window.initApp;
