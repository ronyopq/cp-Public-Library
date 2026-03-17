const CACHE_VERSION = 'plms-v1'
const APP_SHELL = ['/', '/offline.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) {
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const cloned = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, cloned))
          }
          return response
        })
        .catch(async () => {
          if (request.mode === 'navigate') {
            const offline = await caches.match('/offline.html')
            return offline ?? new Response('Offline', { status: 503 })
          }
          throw new Error('Network unavailable')
        })

      return cached ?? networkFetch
    }),
  )
})
