self.addEventListener('push', function (event) {
  var payload = {
    title: 'Caietul Fermei',
    body: '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-monocrom-96.png',
    url: '/',
    tag: undefined,
    actions: [],
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
        // Butoanele (Android: cel mult două). Fiecare are `url` (deschide aplicația) sau `post` (rută API, cu cookie).
        if (Array.isArray(parsed.actions)) {
          payload.actions = parsed.actions
            .filter(function (item) {
              return item && typeof item.action === 'string' && typeof item.title === 'string'
            })
            .slice(0, 2)
        }
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
      icon: payload.icon ?? '/icons/icon-192.png',
      badge: payload.badge || '/icons/badge-monocrom-96.png',
      data: {
        url: payload.url || '/',
        actions: payload.actions,
      },
      actions: payload.actions.map(function (item) {
        return { action: item.action, title: item.title }
      }),
      tag: payload.tag,
      requireInteraction: false,
    }),
  )
})

function relativePath(value) {
  return typeof value === 'string' && value.charAt(0) === '/' && value.charAt(1) !== '/' ? value : null
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  var data = event.notification.data || {}
  var targetUrl = data.url || '/'
  var normalizedUrl = '/'

  // Un buton din notificare: `post` cheamă ruta cu cookie-ul sesiunii (fără token în URL); dacă nu merge
  // (fără sesiune, fără internet), deschide aplicația pe pagina notificării, unde sunt toate opțiunile.
  if (event.action) {
    var actions = Array.isArray(data.actions) ? data.actions : []
    var chosen = null
    for (var a = 0; a < actions.length; a += 1) {
      if (actions[a] && actions[a].action === event.action) chosen = actions[a]
    }
    var postPath = chosen ? relativePath(chosen.post) : null
    if (postPath) {
      event.waitUntil(
        fetch(postPath, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
          .then(function (response) {
            if (!response.ok && self.clients.openWindow) return self.clients.openWindow(targetUrl)
            return undefined
          })
          .catch(function () {
            if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
            return undefined
          }),
      )
      return
    }
    var actionUrl = chosen ? relativePath(chosen.url) : null
    if (actionUrl) targetUrl = actionUrl
  }

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
