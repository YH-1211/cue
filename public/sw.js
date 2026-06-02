// Cue Service Worker
// バージョン更新時に CACHE_NAME を変えると古いキャッシュが自動削除される
const CACHE_NAME = "cue-v3";
// 訪問済みページ (イベント一覧/詳細/保存済みなど) のオフライン閲覧用ランタイムキャッシュ
const PAGE_CACHE = "cue-pages-v1";
const PAGE_CACHE_LIMIT = 40;
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
  const keep = [CACHE_NAME, PAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ページキャッシュが増えすぎないよう古いものから削除 (FIFO)
async function trimPageCache() {
  const cache = await caches.open(PAGE_CACHE);
  const keys = await cache.keys();
  if (keys.length > PAGE_CACHE_LIMIT) {
    await cache.delete(keys[0]);
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 同一オリジンの GET のみ扱う (POST やクロスオリジンは触らない)
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // ナビゲーション (HTML) はネット優先。
  // 成功時はページキャッシュに保存し、オフライン時は
  //   1) 同じURLのキャッシュ済みページ → 2) offline.html の順にフォールバック。
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => {
              c.put(req, copy);
              trimPageCache();
            });
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req, { ignoreSearch: false });
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response("offline");
        })
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

// =====================================================
// Web Push 受信
// =====================================================
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Cue", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Cue";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知タップ時の遷移
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // 既に開いているタブがあればそれを使う
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url).catch(() => {});
            return client.focus();
          }
        }
        // なければ新規で開く
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
