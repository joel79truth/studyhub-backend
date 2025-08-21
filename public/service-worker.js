const CACHE_NAME = "studyhub-cache-v1";
const urlsToCache = [
  '/index.html',
  '/upload.html',
  '/request.html',
  '/developer.html',
  '/admin.html',
  '/support.html',
  '/style.css',
  '/script.js',
  '/offline.html',
  '/manifest.json',
  '/images/luanar-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
    ))
  );
});

// Fetch - improved navigation handling
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html').then(response => {
          return response || caches.match('/offline.html');
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
