/**
 * card.js 
 * Version: v20260417_salesmemager (業務高手專案：LIFF ID 與 Worker URL 更新版，無刪減完整輸出)
 */
const LIFF_ID = "2008924519-RslRiLoO"; 
const WORKER_URL = "https://salesmemager.fangwl591021.workers.dev"; 
const CACHE_KEY_CONTACTS = "app_cache_card_contacts_v1";

let compressedBase64 = "";
let userProfile = null;
let cropperInstance = null;
let globalCardContacts = []; 
let filteredCards = [];
let currentPage = 1;
const PAGE_LIMIT = 10;
let currentActiveCard = null; 
let isProcessing = false;
let isAdmin = false;
let myCardOpened = false;
let currentCropTarget = '';

// 全域攔截器：即使發生未預期錯誤，也要強制解開空轉遮罩
window.addEventListener('unhandledrejection', function() {
    const spinner = document.querySelector('#view-loading .animate-spin');
    if (spinner) spinner.classList.add('hidden');
    const loadText = document.getElementById('loading-text');
    if (loadText) loadText.innerText = "系統發生未預期錯誤";
    window.switchView('list');
});

window.showToast = function(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = `<span class="material-symbols-outlined icon-filled">${isError ? 'error' : 'info'}</span> ${msg}`;
  t.className = `fixed top-14 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full text-[14px] shadow-lg transition-all font-bold flex items-center gap-2 w-max max-w-[90vw] ${isError ? 'bg-red-500 text-white border-red-600' : 'bg-slate-800 text-white border-slate-700'} opacity-100`;
  t.classList.remove('hidden');
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%, -1rem)'; setTimeout(() => t.classList.add('hidden'), 300); }, 3000); 
};

window.fetchAPI = async function(action, payload = {}, silent = false) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); 
    const response = await fetch(WORKER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }), signal: controller.signal
    });
    clearTimeout(timeoutId);
    const resText = await response.text();
    let result;
    try { result = JSON.parse(resText); } catch(e) { throw new Error(`系統連線失敗`); }
    if (!result.success) throw new Error(result.error);
    return result.data;
  } catch (err) {
    if (!silent) window.showToast(err.message, true); 
    throw err;
  }
};

window.getDirectImageUrl = function(url) { 
  if (!url) return url;
  const driveMatch = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && url.includes('drive.google.com')) return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
  return url;
};

window.getTrueAspectRatio = function(url) {
  return new Promise((resolve) => {
    if (!url) return resolve('20:13');
    const img = new Image();
    img.onload = function() { 
        let w = this.width; let h = this.height; 
        if (w === 0 || h === 0) return resolve('20:13');
        let ratio = w / h;
        if (ratio > 3) { w = 300; h = 100; }
        else if (ratio < 0.334) { w = 100; h = 300; }
        resolve(`${Math.round(w)}:${Math.round(h)}`); 
    };
    img.onerror = function() { 
        if (url.includes('line-scdn') || url.includes('linevoom')) resolve('9:16');
        else resolve('20:13'); 
    };
    img.src = url;
  });
};

function formatPhoneStr(val) {
  if (!val) return '';
  let str = String(val).trim();
  let matches = str.match(/(?:\+?\d[\d\-\s]{7,18}\d)/g);
  let targetStr = (matches && matches.length > 0) ? matches[0] : str;
  let s = targetStr.replace(/[^\d+]/g, '');
  if (s.startsWith('+886')) s = '0' + s.substring(4);
  else if (s.startsWith('886') && s.length >= 11) s = '0' + s.substring(3);
  if (/^9\d{8}$/.test(s)) s = '0' + s;
  if (s.length > 10 && s.startsWith('09')) {
      s = s.substring(0, 10);
  }
  return s;
}

function setButtonLoading(btnId, isLoading, originalText = '') {
    const btn = document.getElementById(btnId);
    if (!btn) return false;
    if (isLoading) {
        if (!btn.dataset.oriText) btn.dataset.oriText = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px] align-middle">refresh</span>';
        btn.classList.add('opacity-50', 'pointer-events-none');
        return true;
    } else {
        btn.innerHTML = originalText || btn.dataset.oriText || '送出';
        btn.classList.remove('opacity-50', 'pointer-events-none');
        return false;
    }
}

function checkAndOpenMyCard() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const targetRowId = params.get('rowId');

    if (mode !== 'mycard' || myCardOpened) return;

    let targetCard = null;
    
    if (targetRowId && globalCardContacts.length > 0) {
        targetCard = globalCardContacts.find(c => String(c.rowId) === String(targetRowId));
    } else if (globalCardContacts.length > 0) {
        targetCard = globalCardContacts.find(c => String(c['LINE ID']).trim() === userProfile.userId || String(c.userId).trim() === userProfile.userId);
    }

    if (targetCard) {
        myCardOpened = true;
        if(typeof window.openCardDetailByRowId === 'function') window.openCardDetailByRowId(targetCard.rowId);
    } else {
        window.switchView('list'); 
        window.showToast("找不到對應的名片紀錄", true);
        setTimeout(() => window.location.href = 'index.html?view=user-profile', 2000);
    }
}

function applyUserFilter(contacts) {
    if (isAdmin) return contacts;
    const targetRowId = new URLSearchParams(window.location.search).get('rowId');
    return contacts.filter(c => {
        if (targetRowId && String(c.rowId) === String(targetRowId)) return true;
        const cUid = String(c['LINE ID'] || c.userId || c['Line ID'] || c.lineId || '').trim();
        if (cUid && cUid === userProfile.userId) return true;
        return false;
    });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await liff.init({ liffId: LIFF_ID });
    
    const params = new URLSearchParams(window.location.search);
    const shareCardId = params.get('shareCardId');
    
    if (shareCardId) {
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return; }
        const loadText = document.getElementById('loading-text');
        if (loadText) loadText.innerText = '準備轉發數位名片...';
        try {
            const contacts = await window.fetchAPI('getCardContacts', {}, false);
            const card = contacts.find(c => String(c.rowId) === String(shareCardId));
            if (!card) throw new Error('找不到該名片資料');
            
            let config = null;
            if (card['自訂名片設定']) { try { config = JSON.parse(card['自訂名片設定']); } catch(e){} }
            
            const rawImg = config?.imgUrl || card['名片圖檔'];
            const currentImgUrl = typeof window.getDirectImageUrl === 'function' ? window.getDirectImageUrl(rawImg) : rawImg;
            const detectedAr = typeof window.getTrueAspectRatio === 'function' ? await window.getTrueAspectRatio(currentImgUrl) : "20:13";
            
            const flexContents = typeof window.buildFlexMessageFromCard === 'function' ? window.buildFlexMessageFromCard(card, config, detectedAr) : null;
            
            const title = config?.title || card['姓名'] || '商務名片';
            const altText = `您收到一張數位名片：${title}`;
            const shareUrl = `https://liff.line.me/${LIFF_ID}?shareCardId=${shareCardId}`;
            
            if (typeof window.triggerFlexSharing === 'function' && flexContents) {
                await window.triggerFlexSharing(flexContents, altText);
            } else {
                if(typeof window.fallbackShare === 'function') window.fallbackShare(shareUrl, altText);
            }
        } catch (e) {
            alert('名片轉發失敗: ' + e.message);
        }
        return; 
    }

    if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return; }
    
    userProfile = await liff.getProfile();
    const ADMIN_IDS = ["Uf729764dbb5b652a5a90a467320bea29", "U58eb5c1a747450140ce1335af709ae55", "U8932b891ad24da512afb9c1a6f41567b"];
    isAdmin = ADMIN_IDS.includes(userProfile.userId);

    const userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) userAvatarEl.src = userProfile.pictureUrl || '';
    
    const userProfileBadge = document.getElementById('user-profile-badge');
    if (userProfileBadge) userProfileBadge.classList.remove('hidden');
    
    if (!isAdmin && params.get('mode') !== 'mycard') {
        window.location.replace('index.html');
        return;
    }

    if (isAdmin) {
        const roleBtn = document.getElementById('role-switch-btn');
        if (roleBtn) roleBtn.classList.remove('hidden');
        const adminNav = document.getElementById('bottom-nav-admin');
        if (adminNav) adminNav.classList.remove('hidden');
    } else { 
        document.getElementById('role-switch-btn')?.remove(); 
        document.getElementById('admin-tools-container')?.remove(); 
        document.getElementById('bottom-nav-admin')?.remove(); 
    }

    if (params.get('mode') === 'mycard') {
        loadCardContacts();
        return; 
    }
    
    window.switchView('list');
    loadCardContacts();
  } catch (err) {
    window.showToast("初始化失敗", true);
    const loadText = document.getElementById('loading-text');
    if (loadText) loadText.innerText = "初始化失敗，請確認網路連線";
    const spinner = document.querySelector('#view-loading .animate-spin');
    if (spinner) spinner.classList.add('hidden');
  }
});

window.switchView = function(view) {
  ['view-loading', 'view-list', 'view-process'].forEach(v => { const el = document.getElementById(v); if (el) el.classList.add('hidden'); });
  const target = document.getElementById(`view-${view}`); if (target) target.classList.remove('hidden');
}

window.switchProcessSection = function(id) {
  ['section-loading', 'section-form'].forEach(v => { const el = document.getElementById(v); if (el) el.classList.add('hidden'); });
  const target = document.getElementById(id); if (target) target.classList.remove('hidden');
}

window.resetUI = function() {
  const cCam = document.getElementById('card-camera'); if (cCam) cCam.value = "";
  const cUp = document.getElementById('card-upload'); if (cUp) cUp.value = "";
  compressedBase64 = "";
  
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'mycard') window.location.href = 'index.html?view=user-profile';
  else window.switchView('list');
}

async function loadCardContacts() { 
    const container = document.getElementById('admin-card-list-container');
    const cachedDataString = localStorage.getItem(CACHE_KEY_CONTACTS);
    
    if (cachedDataString) {
        try {
            globalCardContacts = JSON.parse(cachedDataString);
            globalCardContacts = applyUserFilter(globalCardContacts);
            window.filterCardList(); 
            checkAndOpenMyCard();
        } catch(e) {}
    } else if (container) {
        container.innerHTML = '<div class="text-center py-10"><div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>';
    }

    try {
        const data = await window.fetchAPI('getCardContacts', {}, true);
        let newContacts = data || [];
        newContacts.forEach(c => {
            if (c['手機號碼']) c['手機號碼'] = formatPhoneStr(c['手機號碼']);
            if (c['公司電話']) c['公司電話'] = formatPhoneStr(c['公司電話']);
        });

        const newDataString = JSON.stringify(newContacts);
        if (cachedDataString !== newDataString) {
            localStorage.setItem(CACHE_KEY_CONTACTS, newDataString);
            globalCardContacts = applyUserFilter(newContacts);
            window.filterCardList(); 
            if (!myCardOpened) checkAndOpenMyCard();
        } else if (!cachedDataString) {
            globalCardContacts = applyUserFilter(newContacts);
            window.filterCardList();
            if (!myCardOpened) checkAndOpenMyCard();
        }
    } catch(e) {
        if (!cachedDataString && container) container.innerHTML = `<div class="text-center py-10 text-error font-bold">連線異常</div>`;
        const loadText = document.getElementById('loading-text');
        if (loadText) loadText.innerText = "資料讀取失敗，請重新載入";
        const spinner = document.querySelector('#view-loading .animate-spin');
        if (spinner) spinner.classList.add('hidden');
    } finally {
        const globalLoading = document.getElementById('view-loading');
        if (globalLoading && !globalLoading.classList.contains('hidden') && new URLSearchParams(window.location.search).get('mode') !== 'mycard') {
            window.switchView('list');
        }
    }
}

window.reloadCardContacts = async function() {
    if (isProcessing) return;
    isProcessing = true;
    const btn = document.getElementById('btn-refresh-cards');
    if (btn) {
        btn.classList.add('pointer-events-none', 'opacity-50');
        btn.querySelector('span')?.classList.add('animate-spin');
    }
    localStorage.removeItem(CACHE_KEY_CONTACTS); 
    try {
        await loadCardContacts();
        window.showToast("✅ 名單已更新");
    } catch(e) {
        window.showToast("更新失敗，請重試", true);
    } finally {
        isProcessing = false;
        if (btn) {
            btn.classList.remove('pointer-events-none', 'opacity-50');
            btn
