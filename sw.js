// Service worker: keeps a copy of the app's files on the phone so it opens without internet.
// Your data is not here: it stays in localStorage, as before.

const CACHE = "my-day-v2"; // change the name to drop all old copies at once

// Files saved right when the app is installed.
const FILES = [
  "./",
  "style.css",
  "app.js",
  "js/dates.js",
  "js/logic.js",
  "js/storage.js",
  "fonts/onest-latin.woff2",
  "icon.svg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png"
];

// One saved copy per file: "app.js?v=11" and "app.js" are the same file here.
// The page itself ("./", "index.html", "?anything") is saved as "./".
function cacheKey(req) {
  if (req.mode === "navigate") return new URL("./", self.registration.scope).href;
  const url = new URL(req.url);
  url.search = "";
  return url.href;
}

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

// Network first: ask the server for the file ("no-cache" means: check it hasn't changed,
// usually a quick "not modified" answer), so all files are always from the same version.
// Without internet, open the saved copy.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const key = cacheKey(req);

  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key).then((saved) => saved || Response.error()))
  );
});
