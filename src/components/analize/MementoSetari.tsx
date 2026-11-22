'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { FilterPills, ToggleRow, kitText } from '@/components/kit'
import { ZILE_MEMENTO_POSIBILE } from '@/lib/analize/memento'
import { setariAnalize, type NotificariPreferinte } from '@/lib/notifications/preferinte'
import { queryKeys } from '@/lib/query-keys'
import { getStareMemento, setNuFacAnalizeAnulAcesta } from '@/lib/supabase/queries/analize'
import { aziRo } from '@/lib/tratamente/zile'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

/**
 * Setări → Notificări („Ce primești”): „Analiza dinainte de cules” (comutator), „Cu câte zile înainte”
 * (21 / 14 / 7 / 3 / 1, mai multe deodată), „Zilnic din ziua culesului” și „Anul acesta nu fac analize”.
 * Primele trei stau în preferințele de notificări; ultimul în starea mementoului pe sezon. Doar proprietarul.
 */
export function MementoSetari({
  preferinte,
  disabled,
  onChange,
}: {
  preferinte: NotificariPreferinte
  disabled: boolean
  onChange: (next: NotificariPreferinte) => void
}) {
  const queryClient = useQueryClient()
  const an = Number(aziRo().slice(0, 4))
  const stareQuery = useQuery({ queryKey: queryKeys.mementoAnalize(an), queryFn: () => getStareMemento(an), staleTime: 60_000 })
  const setari = setariAnalize(preferinte)

  const schimba = (patch: Partial<{ pornit: boolean; zile: number[]; zilnic: boolean }>) => {
    const next = { ...setari, ...patch }
    onChange({ ...preferinte, tipuri: { ...preferinte.tipuri, analize: next.pornit }, analize: { zile: next.zile, zilnic: next.zilnic } })
  }

  const nuAnulAcesta = async (dezactivat: boolean) => {
    try {
      await setNuFacAnalizeAnulAcesta(dezactivat)
      await queryClient.invalidateQueries({ queryKey: queryKeys.mementoAnalize(an) })
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nu s-a salvat.')
    }
  }

  return (
    <section className="space-y-2" aria-labelledby="analize-setari">
      <h2 id="analize-setari" className={cn('font-bold text-fg', kitText.secondary)}>
        Analiza la fructe
      </h2>
      <ToggleRow title="Analiza dinainte de cules" subtitle="pe telefon, la 8:00" checked={setari.pornit} onCheckedChange={(checked) => schimba({ pornit: checked })} disabled={disabled} />
      {setari.pornit ? (
        <>
          <p id="analize-zile" className={cn('px-1 pt-1 font-semibold text-fg', kitText.secondary)}>
            Cu câte zile înainte
          </p>
          <FilterPills
            multiple
            wrap
            aria-label="Cu câte zile înainte de cules"
            options={ZILE_MEMENTO_POSIBILE.map((n) => ({ value: String(n), label: String(n) }))}
            value={setari.zile.map(String)}
            onValueChange={(values) => schimba({ zile: values.map(Number).sort((a, b) => b - a) })}
          />
          <ToggleRow title="Zilnic din ziua culesului" subtitle="până trimiți la analize" checked={setari.zilnic} onCheckedChange={(checked) => schimba({ zilnic: checked })} disabled={disabled} />
        </>
      ) : null}
      <ToggleRow
        title="Anul acesta nu fac analize"
        subtitle={`oprește doar sezonul ${an}`}
        checked={stareQuery.data?.dezactivat ?? false}
        onCheckedChange={(checked) => void nuAnulAcesta(checked)}
        disabled={disabled || !stareQuery.isSuccess}
      />
      <p className={cn('px-1 text-fg-muted', kitText.helper)}>Liniștea de noapte (22–6) rămâne valabilă și aici.</p>
    </section>
  )
}
