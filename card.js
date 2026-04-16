/**
 * card.js 
 * Version: v2.1.3 (連線異常修復版：修正 WORKER_URL 拼字與 Content-Type)
 */
const LIFF_ID = "2008924519-RslRiLoO"; 
// ⭐ 修正拼字：使用正確的 salesmemager
const WORKER_URL = "https://salesmemager.fangwl591021.workers.dev/"; 
const CACHE_KEY_CONTACTS = "app_cache_card_contacts_v3";

let compressedBase64 = "";
let userProfile = null;
let globalContacts = [];

window.showToast = function(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  const iconName = isError ? 'alert-circle' : 'info';
  t.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i> ${msg}`;
  t.className = `fixed top-14 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full text-[14px] shadow-lg transition-all font-bold flex items-center gap-2 w-max max-w-[90vw] ${isError ? 'bg-red-500 text-white border-red-600' : 'bg-gray-800 text-white border-gray-700'} opacity-100 z-[10000]`;
  t.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: t });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%, -1rem)'; setTimeout(() => t.classList.add('hidden'), 300); }, 3000); 
};

window.fetchAPI = async function(action, payload = {}, silent = false) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); 
    
    // ⭐ 強制使用 text/plain 繞過 CORS 預檢
    const response = await fetch(WORKER_URL, {
      method: 'POST', 
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, payload }), 
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const resText = await response.text();
    let result;
    try { result = JSON.parse(resText); } catch(e) { throw new Error("伺服器回傳格式錯誤"); }

    if (!result.success) throw new Error(result.error || "未知錯誤");
    return result.data;
  } catch (err) {
    console.error("API Error:", err);
    if (!silent) window.showToast(err.message, true);
    throw err;
  }
};

// 初始化頁面
window.onload = async () => {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        userProfile = await liff.getProfile();
        
        const initData = await fetchAPI('initApp', { userId: userProfile.userId, reqContacts: true });
        globalContacts = initData.contacts || [];
        
        renderCardList(globalContacts);
        
        document.getElementById('view-loading').classList.add('hidden');
        document.getElementById('view-list').classList.remove('hidden');
        document.getElementById('bottom-nav-admin').classList.remove('hidden');
        
    } catch (err) {
        document.getElementById('view-loading').innerHTML = `<p class="text-red-500 font-bold">連線異常</p><p class="text-xs text-gray-400 mt-2">${err.message}</p>`;
    }
};

function renderCardList(list) {
    const container = document.getElementById('admin-card-list-container');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 py-10 font-bold">目前無名片資料</p>`;
        return;
    }
    container.innerHTML = list.map(c => `
      <div class="bg-white p-4 border-b border-gray-100 flex items-center gap-4">
        <div class="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
            <img src="${c.imgUrl || ''}" class="w-full h-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=${c.Name}&background=random'">
        </div>
        <div class="flex-1">
            <h3 class="font-bold text-gray-800">${c.Name || '未知'}</h3>
            <p class="text-xs text-gray-500">${c.CompanyName || ''}</p>
        </div>
        <i data-lucide="chevron-right" class="text-gray-300 w-5 h-5"></i>
      </div>
    `).join('');
    lucide.createIcons({ root: container });
}
