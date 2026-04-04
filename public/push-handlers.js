/**
 * Handlers Web Push pentru Zmeurel OS — încărcat prin importScripts din sw.js (Workbox rămâne neatins).
 */
self.addEventListener('push', function (event) {
  var payload = {
    title: 'Zmeurel OS',
    body: '',
    url: '/',
    notificationId: '',
    tag: 'zmeurel-default',
    actions: [],
  }

  if (event.data) {
    try {
      var parsed = event.data.json()
      Object.assign(payload, parsed)
    } catch (e) {
      try {
        var t = event.data.text()
        if (t) payload.body = t
      } catch (err) {}
    }
  }

  var options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || '/',
      notificationId: payload.notificationId || '',
    },
    actions: payload.actions || [],
    tag: payload.tag || payload.notificationId || 'zmeurel-default',
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Zmeurel OS', options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  var data = event.notification.data || {}
  var url = data.url || '/'
  var fullUrl
  try {
    fullUrl = new URL(url, self.location.origin).href
  } catch (e) {
    fullUrl = self.location.origin + '/'
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i]
        try {
          var clientOrigin = new URL(client.url).origin
          if (clientOrigin === self.location.origin) {
            if (typeof client.navigate === 'function') {
              return client.navigate(fullUrl).then(function () {
                return client.focus()
              })
            }
            return self.clients.openWindow(fullUrl)
          }
        } catch (err) {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl)
      }
    }),
  )
})
