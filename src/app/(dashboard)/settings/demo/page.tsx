'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Flower2, Home } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, Notice, kitText } from '@/components/kit'
import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { ActionRow, PanelCard, RowGroup, ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { prepareClientBeforeServerSignOut } from '@/lib/auth/server-sign-out-form'
import {
  clearDemoSeedAttempted,
  disableDemoMode,
  enableDemoMode,
  enableFarmSetupMode,
  markDemoSeedAttempted,
} from '@/lib/demo/onboarding-storage'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

// Doar tipurile al căror seed umple modulele refăcute (promptul 31): livada și cultura mare nu au tratamente,
// stadii, analize, capcane sau plan.
type DemoSeedType = 'berries' | 'solar'

const SCENARII: Array<{ id: DemoSeedType; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'berries', label: 'Fructe de pădure', hint: 'zmeură, mure, afine', icon: <Flower2 /> },
  { id: 'solar', label: 'Solarii', hint: 'roșii, castraveți, ardei', icon: <Home /> },
]

/** Setări › Mod demo: doar în conturile demo. Aceleași acțiuni ca secțiunea „Mod demo” de dinainte. */
export default function SettingsDemoPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { email } = useDashboardAuth()
  const { unsubscribe: unsubscribePush } = usePushSubscription()
  const isDemo = Boolean(email?.endsWith('@demo.zmeurel.local'))

  const [open, setOpen] = useState<'reload' | 'exit' | null>(null)
  const [busy, setBusy] = useState<DemoSeedType | 'exit' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resetCaches = async () => {
    await queryClient.cancelQueries()
    queryClient.clear()
  }

  const reload = async (demoType: DemoSeedType) => {
    setBusy(demoType)
    setError(null)
    try {
      const response = await fetch('/api/demo/reload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_type: demoType }),
      })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } | string }
      if (!response.ok || payload.ok === false) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Nu am putut reîncărca exemplele.')
      }
      enableDemoMode()
      markDemoSeedAttempted()
      await resetCaches()
      setOpen(null)
      toast.success('Exemplele au fost reîncărcate.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nu am putut reîncărca exemplele.')
    } finally {
      setBusy(null)
    }
  }

  const exitDemo = async () => {
    setBusy('exit')
    setError(null)
    try {
      const response = await fetch('/api/demo/reset', { method: 'POST' })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } | string }
      if (!response.ok || payload.ok === false) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message
        throw new Error(message || 'Nu am putut ieși din modul demo.')
      }
      disableDemoMode()
      clearDemoSeedAttempted()
      enableFarmSetupMode()
      await resetCaches()
      toast.success('Ai ieșit din modul demo.')
      router.push('/dashboard')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nu am putut ieși din modul demo.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AppShell header={<ScreenHeader title="Mod demo" backHref="/settings" />}>
      <ScreenBody className="space-y-4">
        {!isDemo ? (
          <Notice tone="info" title="Contul tău nu e un cont demo." />
        ) : (
          <>
            <p className={cn('text-fg-muted', kitText.secondary)}>Datele de aici sunt exemple. Le poți reîncărca oricând.</p>
            {error ? <Notice tone="danger" title={error} /> : null}

            <form
              action="/api/auth/leave-demo"
              method="POST"
              onSubmit={async (event) => {
                event.preventDefault()
                const form = event.currentTarget
                await prepareClientBeforeServerSignOut(queryClient, { unsubscribePush })
                form.submit()
              }}
            >
              <Button type="submit" variant="primary" size="touch-lg" className="w-full" data-testid="settings-create-farm-cta">
                Creează-ți ferma
              </Button>
            </form>

            <RowGroup>
              <ActionRow
                label="Reîncarcă exemplele"
                sub="Alegi tipul de fermă"
                expanded={open === 'reload'}
                disabled={busy !== null}
                onClick={() => setOpen((current) => (current === 'reload' ? null : 'reload'))}
              />
              <ActionRow
                label="Ieși din demo"
                sub="Exemplele se șterg și pornești configurarea"
                expanded={open === 'exit'}
                disabled={busy !== null}
                onClick={() => setOpen((current) => (current === 'exit' ? null : 'exit'))}
              />
            </RowGroup>

            {open === 'reload' ? (
              <PanelCard>
                <p className={cn('font-bold text-fg', kitText.base)}>Ce fel de fermă?</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SCENARII.map((scenariu) => (
                    <Button
                      key={scenariu.id}
                      type="button"
                      variant="neutral"
                      size="touch-lg"
                      className="h-auto min-h-touch-lg justify-start py-2 text-left"
                      disabled={busy !== null}
                      loading={busy === scenariu.id}
                      onClick={() => void reload(scenariu.id)}
                    >
                      <span aria-hidden className="text-primary">
                        {scenariu.icon}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span>{scenariu.label}</span>
                        <span className={cn('font-normal text-fg-muted', kitText.secondary)}>{scenariu.hint}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              </PanelCard>
            ) : null}

            {open === 'exit' ? (
              <PanelCard>
                <p className={cn('font-bold text-fg', kitText.base)}>Ieși din modul demo?</p>
                <p className={cn('text-fg-muted', kitText.secondary)}>
                  Exemplele se șterg, iar configurarea fermei pornește de la început. Afectează doar ferma demo de acum.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="neutral" size="touch" onClick={() => setOpen(null)} disabled={busy !== null}>
                    Renunț
                  </Button>
                  <Button type="button" variant="primary" size="touch" loading={busy === 'exit'} onClick={() => void exitDemo()}>
                    Ieși din demo
                  </Button>
                </div>
              </PanelCard>
            ) : null}
          </>
        )}
      </ScreenBody>
    </AppShell>
  )
}
