// ============================================================
// ATiGB Service Worker v2.0
// Offline-first: cache app shell, store survey responses in
// IndexedDB, background-sync when connection restores.
// ============================================================

const CACHE_VERSION = 'atigb-v2-20260909';
const CACHE_SHELL = `${CACHE_VERSION}-shell`;
const CACHE_DATA = `${CACHE_VERSION}-data`;

// App shell — files to cache for offline use
const SHELL_FILES = [
  '/',
  '/index.html',
  '/admin.html',
  '/config.js',
  '/assets/app.js',
  '/assets/db.js',
  '/assets/charts.js',
  '/assets/admin.js',
  '/assets/style.css',
  '/manifest.json',
  '/offline.html',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap',
  'https://esm.sh/@supabase/supabase-js@2.45.4'
];

// ============================================================
// INSTALL — cache app shell
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then(async (cache) => {
      // Cache local files first (critical)
      const localFiles = SHELL_FILES.filter(f => f.startsWith('/') || f.startsWith('.'));
      await cache.addAll(localFiles).catch(() => {});
      // Cache external resources (best-effort, don't fail install)
      const externalFiles = SHELL_FILES.filter(f => f.startsWith('http'));
      await Promise.allSettled(externalFiles.map(f => cache.add(f)));
    })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('atigb-') && k !== CACHE_SHELL && k !== CACHE_DATA)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH — network-first for API, cache-first for shell
// ============================================================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (except sync)
  if (req.method !== 'GET') return;

  // Supabase API requests — always network (don't cache)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase')) {
    event.respondWith(fetch(req));
    return;
  }

  // Cloudflare R2 images — cache-first with network fallback
  if (url.hostname.includes('r2.dev') || url.hostname.includes('cloudflare')) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_SHELL).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req)))
    );
    return;
  }

  // Navigation requests — try network, fall back to cache, then offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_SHELL).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('/offline.html')))
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok && (url.origin === self.location.origin || url.hostname.includes('esm.sh') || url.hostname.includes('fonts'))) {
          const clone = res.clone();
          caches.open(CACHE_SHELL).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// ============================================================
// BACKGROUND SYNC — send queued survey responses when online
// ============================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'atigb-sync-responses') {
    event.waitUntil(syncResponses());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'atigb-refresh-content') {
    event.waitUntil(refreshContent());
  }
});

// IndexedDB helpers for offline response queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('atigb-offline', 1);
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

async function syncResponses() {
  const db = await openDB();
  const tx = db.transaction('responses', 'readwrite');
  const store = tx.objectStore('responses');
  const all = await new Promise(resolve => {
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve([]);
  });

  for (const resp of all) {
    try {
      const res = await fetch('/api/submit-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resp.payload)
      });
      if (res.ok) {
        await new Promise(resolve => {
          const dTx = db.transaction('responses', 'readwrite');
          dTx.objectStore('responses').delete(resp.id);
          dTx.oncomplete = resolve;
        });
      }
    } catch (e) {
      // Will retry on next sync
      break;
    }
  }
}

async function refreshContent() {
  // Refresh cached content in background
  const cache = await caches.open(CACHE_SHELL);
  await Promise.allSettled([
    cache.add('/'),
    cache.add('/index.html'),
    cache.add('/assets/app.js')
  ]);
}

// ============================================================
// MESSAGE — handle messages from page (save draft, queue response)
// ============================================================
self.addEventListener('message', async (event) => {
  if (event.data.type === 'QUEUE_RESPONSE') {
    const db = await openDB();
    const tx = db.transaction('responses', 'readwrite');
    tx.objectStore('responses').add({
      payload: event.data.payload,
      created: Date.now()
    });
    await new Promise(resolve => { tx.oncomplete = resolve; tx.onerror = resolve; });
    // Register for background sync
    if ('sync' in self.registration) {
      self.registration.sync.register('atigb-sync-responses');
    }
  }

  if (event.data.type === 'SAVE_DRAFT') {
    const db = await openDB();
    const tx = db.transaction('drafts', 'readwrite');
    tx.objectStore('drafts').put({
      key: event.data.key || 'current',
      data: event.data.data,
      saved: Date.now()
    });
    await new Promise(resolve => { tx.oncomplete = resolve; tx.onerror = resolve; });
  }

  if (event.data.type === 'GET_DRAFT') {
    const db = await openDB();
    const tx = db.transaction('drafts', 'readonly');
    const req = tx.objectStore('drafts').get(event.data.key || 'current');
    req.onsuccess = () => {
      event.source.postMessage({ type: 'DRAFT_RESULT', data: req.result?.data || null });
    };
  }
});
