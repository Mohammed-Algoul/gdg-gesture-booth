/*
 * Offline support. Network-first for same-origin requests (so updates show up
 * immediately when online), falling back to the cache when the venue loses
 * internet. Cross-origin requests are never touched (and are blocked by CSP).
 */
const CACHE = 'gdg-booth-v1';
const PRECACHE = [
  './',
  'index.html',
  'src/styles.css',
  'src/main.js',
  'src/gesture.js',
  'src/config.js',
  'src/settings.js',
  'src/camera.js',
  'src/detector.js',
  'src/frame.js',
  'src/gallery.js',
  'src/zip.js',
  'src/sound.js',
  'assets/icon.svg',
  'vendor/mediapipe/tasks-vision/vision_bundle.mjs',
  'vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm',
  'models/hand_landmarker.task',
  // Optional custom assets — fine if missing.
  'assets/frame.png',
  'assets/gdg-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())),
  );
});
