// Service worker do HOLY CAMP: o sistema sempre busca dados atualizados na
// internet. Sem conexão, mostra uma página avisando. Nada de dados pessoais
// fica guardado no aparelho.
const CACHE = 'holy-camp-v2';
const OFFLINE = '/offline.html';
const ASSETS = [OFFLINE, '/app/icon-192.png', '/textura-topografica.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Arquivos da página "sem conexão" (logo e textura): rede primeiro, cópia guardada se cair.
  const path = new URL(req.url).pathname;
  if (ASSETS.includes(path)) {
    event.respondWith(fetch(req).catch(() => caches.match(path)));
  }
});
