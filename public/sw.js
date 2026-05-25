// Cue Service Worker
// バージョン更新時に CACHE_NAME を変えると古いキャッシュが自動削除される
const CACHE_NAME = "cue-v1";
const OFFLINE_URL = "/offline.html";

// プリキャッシュ: オフライン用ページとアイコン
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 同一オリジンの GET のみ扱う (POST やクロスオリジンは触らない)
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // ナビゲーション (HTML) はネット優先 → 失敗時オフラインページ
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || new Response("offline"))
      )
    );
    return;
  }

  // 静的アセット (画像/フォント/css/js) はキャッシュ優先 → ネット
  const dest = req.destination;
  if (["image", "style", "script", "font"].includes(dest)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req)
            .then((res) => {
              // 成功したらキャッシュに入れる (chrome-extension などは除外)
              if (res.ok && res.type === "basic") {
                const copy = res.clone();
                caches.open(CACHE_NAME).then((c) => c.put(req, copy));
              }
              return res;
            })
            .catch(() => cached)
      )
    );
  }
});
