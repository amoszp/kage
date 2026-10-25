const CACHE_NAME = "kage-shell-v12";
const SHELL_FILES = ["/", "/styles.css", "/app.js", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    // "reload" skips the browser's HTTP cache, which may still hold the old files.
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES.map((url) => new Request(url, { cache: "reload" }))))
  );
  self.skipWaiting();
});

// Drop shell caches from older versions so updated files are actually served.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first: the cached copy only stands in when offline, so a new
// deploy shows up on the next load instead of after a cache bump.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
