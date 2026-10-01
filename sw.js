// Service worker: يخلي الموقع يخدم بلا أنترنت، ويجيب دائماً أحدث نسخة كي يكون فيه اتصال
const VERSION = "dz-2.1.0";
const SHELL = ["./", "index.html", "assets/style.css", "assets/app.js", "manifest.webmanifest",
  "data/config.json", "data/bac.json", "data/irg.json", "data/wilayas.json", "data/live.json",
  "icons/icon-192.png", "icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// network-first: البيانات دائماً جديدة، والنسخة المحفوظة احتياط
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return; // APIs خارجية (العملات، الذهب، GitHub) تمشي عادي
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
