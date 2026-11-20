'use client'

import { useState } from 'react'

import { Button, Notice, ToggleRow } from '@/components/kit'
import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { toast } from '@/lib/ui/toast'

/** Textul de sub „Notificări pe telefon” (folosit și în rândul din Setări). */
export function pushStatusLabel(state: {
  hasVapidKey: boolean
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission
}): string {
  if (!state.hasVapidKey) return 'Nu sunt pornite pe server încă.'
  if (!state.isSupported) return 'Telefonul sau browserul acesta nu le primește.'
  if (state.permission === 'denied') return 'Blocate din browser. Le pornești din setările site-ului.'
  if (state.isSubscribed) return 'Pornite pe acest telefon'
  if (state.permission === 'granted') return 'Permisiunea e dată. Atinge ca să termini pornirea.'
  return 'Oprite. Le vezi doar în aplicație.'
}

/**
 * Comutatorul principal din „Ce primești”: abonare / dezabonare la push pe acest dispozitiv.
 * Aceeași logică ca vechiul `PushNotificationsSettings` (usePushSubscription + /api/push/test).
 */
export function PushToggle() {
  const push = usePushSubscription()
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  const blocked = !push.hasVapidKey || !push.isSupported || push.permission === 'denied'

  const toggle = async () => {
    push.clearSubscribeError()
    setBusy(true)
    try {
      if (push.isSubscribed) {
        const ok = await push.unsubscribe()
        if (ok) toast.success('Notificările pe telefon sunt oprite.')
        else toast.error('Nu am putut opri notificările. Încearcă din nou.')
      } else {
        const ok = await push.subscribe()
        if (ok) toast.success('Notificările pe telefon sunt pornite.')
      }
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!response.ok) {
        toast.error(json?.error?.message ?? 'Nu am putut trimite notificarea de probă.')
        return
      }
      toast.success(json?.error?.message ?? 'Notificarea de probă a plecat.')
    } catch {
      toast.error('Nu am putut trimite notificarea de probă.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-2">
      <ToggleRow
        title="Notificări pe telefon"
        subtitle={pushStatusLabel(push)}
        checked={push.isSubscribed}
        onCheckedChange={() => void toggle()}
        disabled={busy || (blocked && !push.isSubscribed)}
      />
      {push.subscribeError ? <Notice tone="danger" title="Nu s-au pornit">{push.subscribeError}</Notice> : null}
      {push.isSubscribed ? (
        <Button type="button" variant="quiet" size="touch" className="w-full" loading={testing} onClick={() => void sendTest()}>
          Trimite o notificare de probă
        </Button>
      ) : null}
    </div>
  )
}
