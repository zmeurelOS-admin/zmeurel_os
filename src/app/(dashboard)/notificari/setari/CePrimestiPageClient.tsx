'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { AppShell } from '@/components/app/AppShell'
import { Notice, ToggleRow, kitText } from '@/components/kit'
import { PushToggle } from '@/components/setari/PushToggle'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import {
  NOTIFICARI_CHEI,
  NOTIFICARI_METEO_FARA_LOC,
  NOTIFICARI_PREFERINTE_IMPLICITE,
  NOTIFICARI_TEXTE,
  isCheiePornita,
  type NotificareCheie,
  type NotificariPreferinte,
} from '@/lib/notifications/preferinte'
import {
  PREFERINTE_INDISPONIBILE,
  preferinteNotificariQueryKey,
  savePreferinteNotificari,
  usePreferinteNotificari,
  type PreferinteNotificariStare,
} from '@/lib/notifications/preferinte-client'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

export function CePrimestiPageClient({
  localitate,
  locSalvat = false,
}: {
  localitate: string | null
  /** Ferma are locul salvat (Setări › Ferma)? Fără el nu pleacă alertele meteo. */
  locSalvat?: boolean
}) {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = usePreferinteNotificari()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const stare: PreferinteNotificariStare = data ?? { ...NOTIFICARI_PREFERINTE_IMPLICITE, disponibil: !isError }
  const unavailable = data?.disponibil === false

  const update = async (next: NotificariPreferinte) => {
    setError(null)
    if (unavailable) {
      // Tabelul lipsește încă: nu schimbăm nimic și spunem de ce.
      toast.error(PREFERINTE_INDISPONIBILE)
      return
    }
    const previous = queryClient.getQueryData<PreferinteNotificariStare>(preferinteNotificariQueryKey)
    queryClient.setQueryData<PreferinteNotificariStare>(preferinteNotificariQueryKey, { ...next, disponibil: true })
    setSaving(true)
    try {
      await savePreferinteNotificari(next)
    } catch (cause) {
      queryClient.setQueryData(preferinteNotificariQueryKey, previous)
      setError(cause instanceof Error && cause.message ? cause.message : 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  const toggleKey = (cheie: NotificareCheie) => (checked: boolean) =>
    void update({ ...stare, tipuri: { ...stare.tipuri, [cheie]: checked } })

  const loc = localitate ?? 'locul fermei'

  return (
    <AppShell header={<ScreenHeader title="Ce primești" backHref="/notificari" />}>
      <ScreenBody className="space-y-4">
        <PushToggle />

        <section className="space-y-2" aria-labelledby="ce-te-anuntam">
          <h2 id="ce-te-anuntam" className={cn('font-bold text-fg', kitText.secondary)}>
            Ce te anunțăm
          </h2>

          {unavailable ? <Notice tone="info" title="Încă nu se pot salva">{PREFERINTE_INDISPONIBILE}</Notice> : null}
          {error ? <Notice tone="danger" title={error} /> : null}

          <div className="space-y-2" aria-busy={isLoading || saving}>
            {NOTIFICARI_CHEI.map((cheie) => (
              <ToggleRow
                key={cheie}
                title={NOTIFICARI_TEXTE[cheie].titlu}
                subtitle={
                  cheie === 'meteo' && !locSalvat
                    ? NOTIFICARI_METEO_FARA_LOC
                    : NOTIFICARI_TEXTE[cheie].detaliu.replace('{loc}', loc)
                }
                checked={isCheiePornita(stare, cheie)}
                onCheckedChange={toggleKey(cheie)}
                disabled={isLoading}
              />
            ))}
          </div>
        </section>

        <ToggleRow
          title="Liniște noaptea"
          subtitle="Fără sunet între 22:00 și 6:00. Gerul te anunță oricum."
          checked={stare.linisteNoaptea}
          onCheckedChange={(checked) => void update({ ...stare, linisteNoaptea: checked })}
          disabled={isLoading}
        />

        <p className={cn('text-fg-muted', kitText.secondary)}>
          Ce oprești aici nu mai sună pe telefon. Rămâne în lista de notificări.
        </p>
      </ScreenBody>
    </AppShell>
  )
}
