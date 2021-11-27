self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('fox-store').then((cache) => cache.addAll([
      '/fox/',
      '/fox/index.html',
      '/fox/index.js',
      '/fox/style.css',
      '/fox/images/fox1.jpg',
      '/fox/images/fox2.jpg',
      '/fox/images/fox3.jpg',
      '/fox/images/fox4.jpg',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  console.log(e.request.url);
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});
