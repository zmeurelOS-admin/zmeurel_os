'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { NumberStepper, ToggleRow, kitText } from '@/components/kit'
import { ETICHETA_TIP_CAPCANA, TIPURI_CAPCANA, textPrag, type PraguriCapcane, type TipCapcana } from '@/lib/capcane'
import { queryKeys } from '@/lib/query-keys'
import { getPraguriCapcane, salveazaPraguriCapcane } from '@/lib/supabase/queries/capcane'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

/**
 * Setări → Notificări („Ce primești”): „Pragul la capcane”, pe tip. Pornit = alertă „Peste prag” când capturile
 * din săptămână ajung la pragul × numărul de capcane din grup. Implicit doar Drosophila (1, în coacere).
 * Doar proprietarul (scrie în `tenant_settings`).
 */
export function PraguriCapcaneSetari() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: queryKeys.capcanePraguri, queryFn: getPraguriCapcane, staleTime: 60_000 })
  const disponibil = query.data?.disponibil ?? true
  const praguri = query.data?.praguri

  const schimba = async (tip: TipCapcana, valoare: PraguriCapcane[TipCapcana]) => {
    if (!praguri) return
    const next: PraguriCapcane = { ...praguri, [tip]: valoare }
    const anterior = query.data
    queryClient.setQueryData(queryKeys.capcanePraguri, { praguri: next, disponibil: true })
    try {
      await salveazaPraguriCapcane(next)
      void queryClient.invalidateQueries({ queryKey: queryKeys.capcane })
    } catch (error) {
      queryClient.setQueryData(queryKeys.capcanePraguri, anterior)
      toast.error(error instanceof Error && error.message ? error.message : 'Pragul nu s-a salvat.')
    }
  }

  return (
    <section className="space-y-2" aria-labelledby="prag-capcane">
      <h2 id="prag-capcane" className={cn('font-bold text-fg', kitText.secondary)}>
        Pragul la capcane
      </h2>
      {!disponibil ? <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Se poate schimba după actualizarea bazei de date.</p> : null}
      {TIPURI_CAPCANA.map((tip) => {
        const prag = praguri?.[tip] ?? null
        return (
          <div key={tip} className="space-y-2">
            <ToggleRow
              title={ETICHETA_TIP_CAPCANA[tip]}
              subtitle={textPrag(prag)}
              checked={prag !== null}
              onCheckedChange={(checked) => void schimba(tip, checked ? { prag: 1, doar_in_coacere: tip === 'drosophila' } : null)}
              disabled={!praguri || !disponibil}
            />
            {prag ? (
              <div className="space-y-2 rounded-box border border-border-subtle p-3">
                <p className={cn('font-semibold text-fg', kitText.secondary)}>Capturi pe capcană, pe săptămână</p>
                <NumberStepper
                  label={`Pragul pentru ${ETICHETA_TIP_CAPCANA[tip]}`}
                  value={prag.prag}
                  onChange={(value) => {
                    if (value && value > 0) void schimba(tip, { ...prag, prag: value })
                  }}
                  min={1}
                  max={500}
                  size="compact"
                  disabled={!disponibil}
                />
                <ToggleRow
                  title="Doar în coacere"
                  subtitle="stadiul de coacere sau recoltare, ori cu 7 zile înainte de cules"
                  checked={prag.doar_in_coacere}
                  onCheckedChange={(checked) => void schimba(tip, { ...prag, doar_in_coacere: checked })}
                  disabled={!disponibil}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
