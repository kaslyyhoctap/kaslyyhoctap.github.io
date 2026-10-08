/**
 * public/sw.js — offline-first Service Worker, kiểu FB/TikTok:
 * xem trước → cache ngầm → mất mạng vẫn dùng được.
 *
 * - install: precache app shell (/, CSS/JS chính).
 * - Navigations: network-first (luôn lấy bản mới khi có mạng),
 *   rơi về cache khi mất mạng. Response mới tự lưu đè (revalidate ngầm).
 * - /api/questions: cache-first + revalidate nền (stale-while-revalidate),
 *   vì bank ít đổi, đọc offline phải nhanh.
 * - Còn lại (images/fonts): cache-first thuần.
 *
 * Không cache POST/PUT/DELETE hay /api/auth/*, /api/ai/* (luôn cần mạng).
 */
const SHELL_CACHE = 'ontap12-shell-v1';
const API_CACHE = 'ontap12-api-v1';
const ASSET_CACHE = 'ontap12-asset-v1';

const PRECACHE = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => ![SHELL_CACHE, API_CACHE, ASSET_CACHE].includes(k),
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiQuestions(url) {
  return url.pathname === '/api/questions';
}

function isNavigation(request) {
  return request.mode === 'navigate';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API cần mạng thật (auth/AI/submit/progress/admin) — không cache.
  if (
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/ai') ||
    url.pathname.startsWith('/api/admin') ||
    url.pathname.startsWith('/api/exam') ||
    url.pathname.startsWith('/api/progress')
  ) {
    return;
  }

  // Bank: stale-while-revalidate — trả cache ngay, update nền khi có mạng.
  if (isApiQuestions(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchAndPut = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        // Có cache → trả ngay + update nền; chưa có → chờ mạng.
        if (cached) {
          event.waitUntil(fetchAndPut);
          return cached;
        }
        const fresh = await fetchAndPut;
        return fresh || Response.error();
      }),
    );
    return;
  }

  // Navigations: network-first, fallback cache.
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  // Static assets (JS/CSS/images/fonts): cache-first.
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(ASSET_CACHE)
                .then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
