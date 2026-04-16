'use client'

import { useState } from 'react'

import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { toast } from '@/lib/ui/toast'

export function PushNotificationsSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    hasVapidKey,
    subscribeError,
    clearSubscribeError,
  } = usePushSubscription()
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  if (!hasVapidKey) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        Notificările push nu sunt configurate pe server (VAPID). Contactează administratorul.
      </p>
    )
  }

  if (!isSupported) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        Browserul nu suportă notificări push sau nu există Service Worker (ex.: modul dezvoltare).
      </p>
    )
  }

  const pendingServerSync = permission === 'granted' && !isSubscribed

  const statusLabel = pendingServerSync
    ? 'Permisiune acordată. Apasă pentru a finaliza activarea.'
    : permission === 'denied'
      ? 'Blocat în browser — activează din setările site-ului.'
      : isSubscribed
        ? 'Activ pe acest dispozitiv'
        : 'Nu este activat'

  const toggle = async () => {
    clearSubscribeError()
    setBusy(true)
    try {
      if (isSubscribed) {
        const ok = await unsubscribe()
        if (ok) toast.success('Notificările push au fost dezactivate.')
        else toast.error('Nu am putut dezabona.')
      } else {
        const ok = await subscribe()
        if (ok) {
          toast.success('Notificări push activate.')
        } else {
          toast.error('Nu am putut activa. Verifică mesajul de mai jos sau permisiunile.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const disableActivate = busy || permission === 'denied'

  const sendTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      let message = 'Notificarea de test a fost trimisă.'
      try {
        const data = (await res.json()) as { error?: { message?: string } }
        if (data?.error?.message) {
          message = data.error.message
        }
      } catch {
        // răspunsul poate fi gol; păstrăm mesajul implicit
      }

      if (!res.ok) {
        toast.error(message)
        return
      }

      toast.success(message)
    } catch (error) {
      console.error('[push] test notification failed', error)
      toast.error('Nu am putut trimite notificarea de test.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-secondary)]">{statusLabel}</p>
      {subscribeError ? (
        <p className="text-xs font-medium text-[#b42318]" role="alert">
          {subscribeError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disableActivate}
          onClick={() => void toggle()}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)] disabled:opacity-50"
        >
          {isSubscribed ? 'Dezactivează notificările push' : 'Activează notificările push'}
        </button>
        {isSubscribed ? (
          <button
            type="button"
            disabled={testing || busy}
            onClick={() => void sendTest()}
            className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-95 disabled:opacity-50"
          >
            {testing ? 'Se trimite testul...' : 'Trimite notificare test'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
