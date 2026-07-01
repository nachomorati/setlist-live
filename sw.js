// sw.js
const CACHE_NAME = 'setlist-live-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // <--- Fuerza al SW nuevo a activarse sin esperar a que cierres la pestaña
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // <--- Borra la caché vieja (v1) por completo
          }
        })
      );
    }).then(() => self.clients.claim()) // <--- Toma el control de las pestañas activas inmediatamente
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si hay internet, clonamos la respuesta y la guardamos actualizada
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // SI NO HAY INTERNET (Offline), recién ahí va a buscar a la caché
        return caches.match(e.request);
      })
  );
});