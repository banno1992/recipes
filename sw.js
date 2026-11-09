// Offline cache. tools/build.py rewrites VERSION and IMAGES on every build.
const VERSION = 'v20261109-064456';
const IMAGES = ["vault/i/af574f1a8142f7e878cc.bin", "vault/i/2006092d21a6995a45b1.bin", "vault/i/2e4d41c603f7738a66c9.bin", "vault/i/eb083146ba5b96dc15e1.bin", "vault/i/db11e547868e4cf10d4d.bin", "vault/i/cdd2bf1d85d7f3467a9f.bin", "vault/i/0c1acfdcc7ae50394f20.bin", "vault/i/78d896b24093ba5d8211.bin", "vault/i/41a50994813561df3697.bin", "vault/i/33fb9f9c27ea7c1cc397.bin", "vault/i/97c406450a7465427bf9.bin", "vault/i/8b462b71107dcd41c65d.bin", "vault/i/6a58f4daa33ff5623265.bin", "vault/i/ad05a325ca9523fe8106.bin", "vault/i/60da878db5331d72f481.bin", "vault/i/936ec81c11b31f255025.bin", "vault/i/ff587bbe57978c47ad48.bin", "vault/i/1aac35a06844fa8a1f2b.bin", "vault/i/4e8888b489401130c9ea.bin", "vault/i/67bffacaa3b210b3f6cd.bin", "vault/i/592110fc670c2dfa8abc.bin", "vault/i/1ff312568db70f6027d9.bin", "vault/i/e85e979e71c0fbcc7ac0.bin", "vault/i/daf4c50cb9595608286c.bin", "vault/i/c1b8694eb78703de8afb.bin", "vault/i/20e4b7738931487901ce.bin", "vault/i/17387d231afd06559cd3.bin", "vault/i/738317e2fe25acac45c4.bin", "vault/i/431e9c2680db0e4a7b45.bin", "vault/i/0d08ad2f90afbb9bf027.bin", "vault/i/28746a3c5ca69da1a56d.bin", "vault/i/6babfacb083729d95794.bin", "vault/i/d332dc840bd711912105.bin", "vault/i/5caeab6dd2f7aeab3e37.bin", "vault/i/c8a096f5da95538c1caa.bin", "vault/i/2d8e04bf5e4935856058.bin", "vault/i/addd30f028d6c1bfa736.bin", "vault/i/fa4432d5aad1b72a7576.bin", "vault/i/81542f5b44d675c2c458.bin", "vault/i/0f2fb6b743c9220dee5d.bin", "vault/i/9c406bcab3519e154d50.bin", "vault/i/9e387963732263222c19.bin", "vault/i/9f94471197f231854604.bin", "vault/i/b4d120ebd5c7930d2d0a.bin", "vault/i/cb35fb39cc406dac6b18.bin", "vault/i/bcdc47baad5ac01ec663.bin", "vault/i/b0da314d43dadc577bb7.bin", "vault/i/c2f89254eb3210f8db45.bin", "vault/i/cfc20399dc1657e66078.bin", "vault/i/6dc185ffea5b93af59fa.bin", "vault/i/a2a6f33bcd63f69b2946.bin", "vault/i/feac6db6515528769189.bin", "vault/i/389fd649270fed201d9c.bin", "vault/i/70694d4597665cc1f3d7.bin", "vault/i/0cdab234e52aa76d7162.bin", "vault/i/790db91504313b72c06f.bin", "vault/i/d2d94a953a45287cfac9.bin", "vault/i/ce9156998b71383b260f.bin", "vault/i/8a2a98c49248b0187647.bin", "vault/i/ac249cec37be8bacb0a9.bin", "vault/i/e1fbfb48362896196923.bin", "vault/i/7caddff6f2f56c8d3476.bin", "vault/i/60d87a613b683b7185c3.bin", "vault/i/4906afafa865e5495024.bin", "vault/i/eeea6f8068430d4f5861.bin", "vault/i/3da6a8c49f8c9ae9fa3d.bin", "vault/i/427cab4c45bb682c006a.bin", "vault/i/71f6595a1b10c988ccee.bin", "vault/i/26f1fb08eddda1a53eb1.bin", "vault/i/e51b39eda79c9ca776a1.bin", "vault/i/b690ad54338f9911a1ca.bin", "vault/i/ebe9cdcc480e217f1dc8.bin", "vault/i/5b20b88a47e51049f268.bin", "vault/i/e45d41351f140c016b83.bin", "vault/i/5f9bb9416dae9fb0e843.bin", "vault/i/5cf085394611c3ef0b9c.bin", "vault/i/1cd4f7f50f5dac24e18d.bin", "vault/i/a5830ff48955c8e3290d.bin", "vault/i/ffe02f31509211a42d30.bin", "vault/i/07eb4df439cdbb814696.bin", "vault/i/d7d5fae9a1ae05d01acc.bin", "vault/i/cc0959927ea66d02bc2d.bin", "vault/i/7e3ddfbdd5d1c5125dc0.bin", "vault/i/a27ef84ab51e5cd5b443.bin", "vault/i/fb361c37f1733eb064cd.bin", "vault/i/61574cf3609791c7a618.bin", "vault/i/cbfd76f5a9d1fa615b8a.bin", "vault/i/f66aae18c9a71a6a14b5.bin", "vault/i/92463b666a0083a602b8.bin", "vault/i/fe39b6e9ad2d92a030a5.bin", "vault/i/7f4922dc338b24eb2950.bin", "vault/i/1464caf6c9ebc5317aba.bin", "vault/i/c90620053bd686e7b3b5.bin", "vault/i/0f055870c4ad01faf91a.bin", "vault/i/3d8e53deb2c1b43568be.bin", "vault/i/c6299b0f48d00edb4d91.bin", "vault/i/30f5d940b3cc08f0fb0f.bin", "vault/i/0a1ffad18555105617d9.bin", "vault/i/0ba11fb9e731d54520d6.bin", "vault/i/8e97b8d97e8e4529fcf7.bin", "vault/i/7cf3811fa19305f6cee3.bin", "vault/i/e1106799afae2017da94.bin"];
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
