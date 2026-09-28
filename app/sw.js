/* Flowrics Web service worker.
   ホスティング(デプロイナウ)が index.html / jizura.js に 1 日のキャッシュを指示するため、デプロイしても古いページが
   出続けることがある。同一オリジンのファイルは常にサーバーへ確認(cache: 'no-cache' = 条件付きリクエスト、未変更なら 304)
   してから返し、オフラインのときだけ前回のコピーを使う。 */
const CACHE = 'flowrics-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res && res.ok) { const c = await caches.open(CACHE); c.put(e.request, res.clone()).catch(() => {}); }
      return res;
    } catch (err) {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      throw err;
    }
  })());
});
