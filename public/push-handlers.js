self.addEventListener('push', function (event) {
  var payload = {
    title: 'Zmeurel OS',
    body: '',
    icon: '/icon-192.png',
    badge: '/icons/icon-72.png',
    url: '/',
    tag: undefined,
  }

  if (event.data) {
    var text = ''

    try {
      text = event.data.text()
      var parsed = JSON.parse(text)

      if (parsed && typeof parsed === 'object') {
        payload.title = parsed.title || payload.title
        payload.body = parsed.body || payload.body
        payload.icon = parsed.icon || payload.icon
        payload.badge = parsed.badge || payload.badge
        payload.url = parsed.url || payload.url
        payload.tag = parsed.tag || parsed.notificationId || payload.tag
      }
    } catch {
      if (text) {
        payload.body = text
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icons/icon-72.png',
      data: {
        url: payload.url || '/',
      },
      tag: payload.tag,
      requireInteraction: false,
    }),
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  var data = event.notification.data || {}
  var targetUrl = data.url || '/'
  var normalizedUrl = '/'

  try {
    normalizedUrl = new URL(targetUrl, self.location.origin).href
  } catch {
    normalizedUrl = self.location.origin + '/'
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i += 1) {
        var client = clientList[i]

        if (client.url === normalizedUrl && 'focus' in client) {
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(normalizedUrl)
      }

      return undefined
    }),
  )
})

self.addEventListener('notificationclose', function () {})
