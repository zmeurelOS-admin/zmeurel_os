'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function subscriptionToJson(sub: PushSubscription) {
  const j = sub.toJSON?.() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined
  if (j?.endpoint && j.keys?.p256dh && j.keys?.auth) {
    return { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }
  }
  const key = sub.getKey('p256dh')
  const auth = sub.getKey('auth')
  if (!key || !auth) {
    throw new Error('Chei subscription lipsă.')
  }
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
      auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
    },
  }
}

async function parseSubscribeError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } }
    const msg = data?.error?.message
    if (typeof msg === 'string' && msg.trim()) return msg
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`
}

async function postPushSubscribe(subscription: ReturnType<typeof subscriptionToJson>): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription }),
  })
  if (!res.ok) {
    const message = await parseSubscribeError(res)
    console.error('[push] POST /api/push/subscribe failed', res.status, message)
    return { ok: false, message }
  }
  return { ok: true }
}

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribeError, setSubscribeError] = useState<string | null>(null)

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? ''

  const isSupported = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'serviceWorker' in navigator && 'PushManager' in window && Boolean(vapidPublic)
  }, [vapidPublic])

  useEffect(() => {
    if (typeof window === 'undefined') return
    queueMicrotask(() => {
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidPublic) return

    let cancelled = false
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!cancelled) setIsSubscribed(Boolean(sub))
      } catch (e) {
        console.error('[push] getSubscription', e)
        if (!cancelled) setIsSubscribed(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [vapidPublic])

  const clearSubscribeError = useCallback(() => {
    setSubscribeError(null)
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setSubscribeError(null)
    if (!isSupported || !vapidPublic) {
      const msg = !vapidPublic ? 'Lipsește cheia VAPID publică (NEXT_PUBLIC_VAPID_PUBLIC_KEY).' : 'Browserul nu suportă push.'
      setSubscribeError(msg)
      console.error('[push] subscribe blocked:', msg)
      return false
    }
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setSubscribeError('Permisiune refuzată pentru notificări.')
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        const payload = subscriptionToJson(existing)
        const posted = await postPushSubscribe(payload)
        if (!posted.ok) {
          setSubscribeError(posted.message)
          setIsSubscribed(false)
          return false
        }
        setIsSubscribed(true)
        return true
      }

      let sub: PushSubscription
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
        })
      } catch (e) {
        console.error('[push] pushManager.subscribe', e)
        setSubscribeError(e instanceof Error ? e.message : 'Eroare la subscribe în browser.')
        return false
      }

      const posted = await postPushSubscribe(subscriptionToJson(sub))
      if (!posted.ok) {
        setSubscribeError(posted.message)
        await sub.unsubscribe().catch(() => {})
        setIsSubscribed(false)
        return false
      }

      setIsSubscribed(true)
      return true
    } catch (e) {
      console.error('[push] subscribe', e)
      setSubscribeError(e instanceof Error ? e.message : 'Eroare necunoscută.')
      return false
    }
  }, [isSupported, vapidPublic])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        const res = await fetch('/api/push/unsubscribe', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        })
        if (!res.ok) {
          console.error('[push] POST /api/push/unsubscribe', res.status)
        }
        await sub.unsubscribe()
      }
      setIsSubscribed(false)
      setSubscribeError(null)
      return true
    } catch (e) {
      console.error('[push] unsubscribe', e)
      return false
    }
  }, [])

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    hasVapidKey: Boolean(vapidPublic),
    subscribeError,
    clearSubscribeError,
  }
}
