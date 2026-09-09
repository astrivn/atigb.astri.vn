// ============================================================
// ATiGB PWA Helper v2.0
// Registers service worker, manages offline state, handles
// IndexedDB draft saving and response queueing.
// ============================================================

const SW_PATH = '/sw.js';
const DB_NAME = 'atigb-offline';
const DB_VERSION = 1;

// ---------- Service Worker Registration ----------
export async function initPWA() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker not supported');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/',
      updateViaCache: 'none'
    });

    // Check for updates
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (nw) {
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available — notify user
            showUpdateToast();
          }
        });
      }
    });

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    console.log('[PWA] Service Worker registered');
  } catch (e) {
    console.warn('[PWA] SW registration failed:', e);
  }

  // Online/offline indicators
  window.addEventListener('online', () => {
    document.body.classList.remove('is-offline');
    showToast('Đã kết nối lại — đang đồng bộ...', false);
    // Trigger background sync if supported
    if ('sync' in reg) {
      navigator.serviceWorker.ready.then(r => r.sync.register('atigb-sync-responses'));
    }
  });

  window.addEventListener('offline', () => {
    document.body.classList.add('is-offline');
    showToast('Đang ngoại tuyến — khảo sát vẫn hoạt động', false);
  });

  // Set initial state
  if (!navigator.onLine) {
    document.body.classList.add('is-offline');
  }
}

// ---------- IndexedDB Helpers ----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('responses')) {
        db.createObjectStore('responses', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- Draft Save/Restore ----------
export async function saveDraft(key, data) {
  const db = await openDB();
  const tx = db.transaction('drafts', 'readwrite');
  tx.objectStore('drafts').put({ key, data, saved: Date.now() });
  return new Promise(resolve => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getDraft(key) {
  const db = await openDB();
  const tx = db.transaction('drafts', 'readonly');
  return new Promise(resolve => {
    const req = tx.objectStore('drafts').get(key);
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => resolve(null);
  });
}

export async function clearDraft(key) {
  const db = await openDB();
  const tx = db.transaction('drafts', 'readwrite');
  tx.objectStore('drafts').delete(key);
  return new Promise(resolve => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

// ---------- Offline Response Queue ----------
export async function queueResponse(payload) {
  const db = await openDB();
  const tx = db.transaction('responses', 'readwrite');
  tx.objectStore('responses').add({ payload, created: Date.now() });
  await new Promise(resolve => {
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });

  // Try background sync
  if ('serviceWorker' in navigator && 'sync' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('atigb-sync-responses');
    } catch (e) {
      // Fallback: try immediate send
      console.warn('[PWA] Background sync not available, trying direct send');
    }
  }
}

export async function getQueuedCount() {
  const db = await openDB();
  const tx = db.transaction('responses', 'readonly');
  return new Promise(resolve => {
    const req = tx.objectStore('responses').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

// ---------- SW Message Handler ----------
function handleSWMessage(event) {
  if (event.data.type === 'DRAFT_RESULT') {
    // Handle draft result from SW
    window.dispatchEvent(new CustomEvent('atigb:draft-result', { detail: event.data }));
  }
}

// ---------- UI Helpers ----------
function showToast(msg, isErr = false) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle('err', isErr);
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 4000);
}

function showUpdateToast() {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.innerHTML = 'Phiên bản mới sẵn sàng. <a href="#" onclick="location.reload();return false;" style="color:var(--lime-bright);font-weight:600">Tải lại</a>';
  t.classList.remove('err');
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 8000);
}

// ---------- Auto-save Manager ----------
export class AutoSave {
  constructor(key, intervalMs = 30000) {
    this.key = key;
    this.interval = intervalMs;
    this.timer = null;
    this.lastSave = 0;
  }

  start(collectFn) {
    this.collectFn = collectFn;
    this.timer = setInterval(async () => {
      const data = collectFn();
      if (data && Object.keys(data).length > 0) {
        await saveDraft(this.key, data);
        this.lastSave = Date.now();
        // Dispatch event for UI update
        window.dispatchEvent(new CustomEvent('atigb:autosaved', { detail: { time: this.lastSave } }));
      }
    }, this.interval);
  }

  async saveNow() {
    if (this.collectFn) {
      const data = this.collectFn();
      if (data) {
        await saveDraft(this.key, data);
        this.lastSave = Date.now();
        window.dispatchEvent(new CustomEvent('atigb:autosaved', { detail: { time: this.lastSave } }));
      }
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}
