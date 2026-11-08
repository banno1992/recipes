// Offline cache. tools/build.py rewrites VERSION and IMAGES on every build.
const VERSION = 'v20261108-210519';
const IMAGES = ["vault/i/db11e547868e4cf10d4d.bin", "vault/i/cdd2bf1d85d7f3467a9f.bin", "vault/i/0c1acfdcc7ae50394f20.bin", "vault/i/78d896b24093ba5d8211.bin", "vault/i/41a50994813561df3697.bin", "vault/i/97c406450a7465427bf9.bin", "vault/i/6a58f4daa33ff5623265.bin"];
const CACHE = 'recipes-' + VERSION;
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.json', 'vault/meta.json', 'vault/recipes.bin',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.concat(IMAGES))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('recipes-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  // Recipe data: network first so new recipes show up, cache when offline.
  const dataFile = ['/vault/meta.json', '/vault/recipes.bin'].find(p => url.pathname.endsWith(p));
  if (dataFile) {
    const key = dataFile.slice(1);
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key)));
    return;
  }
  // Everything else: cache first.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : undefined)));
});
