// Service Worker para Magistrado Celular - PWA Offline Support
// Gerado manualmente pois expo-pwa não é compatível com SDK 58

const CACHE_NAME = 'magistrado-v1';
const STATIC_CACHE = 'magistrado-static-v1';
const DYNAMIC_CACHE = 'magistrado-dynamic-v1';

// Assets para cache estático (cache-first)
const STATIC_ASSETS = [
  '/magistrado/',
  '/magistrado/index.html',
  '/magistrado/manifest.json',
  '/magistrado/icon-192.png',
  '/magistrado/icon-512.png',
];

// Instalação - cache assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { credentials: 'same-origin' })));
    }).catch((err) => {
      console.error('[SW] Failed to cache static assets:', err);
    })
  );
  self.skipWaiting();
});

// Ativação - limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia: Cache First para assets estáticos, Network First para navegação
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-HTTP/HTTPS
  if (!url.protocol.startsWith('http')) return;

  // Ignorar requests de API/sync (sempre rede)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/sync')) {
    return;
  }

  // HTML/Navigation - Network First com fallback para cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets estáticos (JS, CSS, imagens, fonts) - Cache First
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font' ||
      request.destination === 'manifest') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Demais - Network First
  event.respondWith(networkFirst(request));
});

// Cache First: tenta cache, cai na rede, atualiza cache
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    // Atualiza em background
    fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.error('[SW] Cache first failed:', err);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network First: tenta rede, cai no cache
async function networkFirst(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    // Fallback para index.html (SPA)
    if (request.mode === 'navigate') {
      const indexCache = await caches.open(STATIC_CACHE);
      const index = await indexCache.match('/magistrado/index.html');
      if (index) return index;
    }
    
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Mensagens do cliente (ex: skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
