// Service worker: keeps a copy of the app's files on the phone so it opens without internet.
// Your data is not here: it stays in localStorage, as before.

const CACHE = "my-day-v1"; // change the name to drop all old copies at once

// Files saved right when the app is installed. The ?v=N must match index.html.
const FILES = [
  "./",
  "style.css?v=10",
  "app.js?v=10",
  "fonts/onest-latin.woff2",
  "icon.svg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// Remove copies left by older versions of this file.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // The page itself: try the network first, so a new version arrives right away;
  // without internet, open the saved copy.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // Other files (style.css?v=N, app.js?v=N, font, icons) never change under the same name,
  // so the saved copy is used first and the network only for files not saved yet.
  event.respondWith(
    caches.match(req).then((saved) => saved || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});
