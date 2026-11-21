'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ban, Home, Minus, MoreHorizontal, Plus, Snowflake, SlidersHorizontal, Soup } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { Button, EmptyState, ListRow, Notice, StatHero, kitText } from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { AjustareStocForm } from '@/components/stocuri/AjustareStocForm'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { formatKg, formatNumber } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { ajustariPeZile, cal2InSezon, deltaKgText, descompunereStoc, esteTipAjustare, etichetaAjustare } from '@/lib/stocuri/stoc'
import { getAjustariStoc, type AjustareStocTip } from '@/lib/supabase/queries/ajustari-stoc'
import { getSellableCal1StockSummary } from '@/lib/supabase/queries/miscari-stoc'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { aziRo, ziRelativaRo } from '@/lib/tratamente/zile'
import { cn } from '@/lib/utils'

function subscribeToDayChange(onChange: () => void) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(onChange, 60_000)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
const readToday = () => aziRo()
const noServerDay = () => null

const ICON_TIP: Record<AjustareStocTip, React.ReactNode> = {
  congelat: <Snowflake aria-hidden />,
  procesat: <Soup aria-hidden />,
  pierdere: <Ban aria-hidden />,
  consum_propriu: <Home aria-hidden />,
  corectie_plus: <Plus aria-hidden />,
  corectie_minus: <Minus aria-hidden />,
  altul: <MoreHorizontal aria-hidden />,
}

function TipBadge({ tip }: { tip: string }) {
  const cunoscut = esteTipAjustare(tip)
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        tip === 'pierdere' ? 'bg-danger-bg text-danger-text' : tip === 'corectie_plus' ? 'bg-primary-soft text-primary' : 'bg-neutral-bg text-neutral-text',
      )}
    >
      {cunoscut ? ICON_TIP[tip] : <MoreHorizontal aria-hidden />}
    </span>
  )
}

function RandDescompunere({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
  return (
    <div className={cn('flex min-h-[52px] items-center justify-between gap-3 px-4 py-2', !first && 'border-t border-border')}>
      <span className={cn('text-fg-muted', kitText.secondary)}>{label}</span>
      <span className={cn('whitespace-nowrap font-extrabold tabular-nums text-fg', kitText.base)}>{value}</span>
    </div>
  )
}

/** „− 1.590 kg” / „+ 4 kg”, cu semnul cerut (descompunerea se citește ca o socoteală). */
function semnKg(semn: '+' | '−', kg: number): string {
  return `${semn} ${formatKg(Math.abs(kg))}`
}

export function StocuriPageClient() {
  useTrackModuleView('stocuri')
  const azi = useSyncExternalStore(subscribeToDayChange, readToday, noServerDay)
  const [formOpen, setFormOpen] = useState(false)

  const summaryQuery = useQuery({ queryKey: queryKeys.stocGlobalCal1, queryFn: getSellableCal1StockSummary })
  const ajustariQuery = useQuery({ queryKey: queryKeys.ajustariStoc, queryFn: getAjustariStoc, staleTime: 30_000, refetchOnWindowFocus: false })
  const recoltariQuery = useQuery({ queryKey: queryKeys.recoltari, queryFn: getRecoltari, staleTime: 30_000, refetchOnWindowFocus: false })
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, refetchOnWindowFocus: false })

  const stoc = summaryQuery.data ? descompunereStoc(summaryQuery.data) : null
  const cal2 = useMemo(
    () => (azi && recoltariQuery.data && parceleQuery.data ? cal2InSezon(recoltariQuery.data, parceleQuery.data, azi) : null),
    [azi, recoltariQuery.data, parceleQuery.data],
  )
  const zile = useMemo(() => ajustariPeZile(ajustariQuery.data ?? []), [ajustariQuery.data])

  const loading = summaryQuery.isLoading
  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" disabled={!stoc} onClick={() => setFormOpen(true)}>
      <SlidersHorizontal aria-hidden />
      Ajustează stocul
    </Button>
  )

  return (
    <AppShell
      header={<ScreenHeader title="Stocuri" backHref="/mai-mult" />}
      bottomBarFixed
      bottomBar={
        stoc ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {summaryQuery.isError ? (
          <Notice
            tone="danger"
            title="Stocul nu s-a încărcat"
            action={
              <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => void summaryQuery.refetch()}>
                Încearcă din nou
              </Button>
            }
          >
            Verifică internetul și încearcă din nou.
          </Notice>
        ) : null}

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Se încarcă stocul">
            <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
            <div className="h-52 animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : null}

        {stoc ? (
          <>
            <StatHero
              label="Zmeură cal. I disponibilă"
              value={formatNumber(stoc.disponibil)}
              unit="kg"
              footer={
                <p className={cn('font-semibold opacity-85', kitText.secondary)}>
                  {stoc.disponibil > 0
                    ? 'poți pune în livrare acum'
                    : stoc.disponibil < 0
                      ? 'comenzile depășesc ce ai recoltat'
                      : 'nimic de pus în livrare acum'}
                </p>
              }
            />

            {/* Pe desktop bara de jos nu există: butonul stă în pagină. */}
            <div className="hidden md:block">{addButton}</div>

            <section aria-label="Din ce se compune" className="overflow-hidden rounded-box border border-border bg-surface">
              <RandDescompunere first label="Recoltat cal. I" value={formatKg(stoc.recoltat)} />
              <RandDescompunere label="Livrat" value={semnKg('−', stoc.livrat)} />
              <RandDescompunere label="În livrare" value={semnKg('−', stoc.inLivrare)} />
              <RandDescompunere label="Ajustări" value={stoc.ajustari === 0 ? formatKg(0) : semnKg(stoc.ajustari < 0 ? '−' : '+', stoc.ajustari)} />
            </section>

            <ListRow
              avatar={false}
              title="Cal. II"
              detail="în sezon · informativ, nu intră în comenzi"
              trailing={<span className={cn('whitespace-nowrap font-extrabold tabular-nums text-fg', kitText.base)}>{cal2 === null ? '…' : formatKg(cal2)}</span>}
            />

            <section aria-labelledby="stoc-ajustari" className="space-y-2">
              <h2 id="stoc-ajustari" className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>
                Ajustări
              </h2>
              {ajustariQuery.isError ? (
                <Notice tone="danger" title="Istoricul ajustărilor nu s-a încărcat" />
              ) : ajustariQuery.isLoading ? (
                <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" aria-busy="true" />
              ) : zile.length === 0 ? (
                <EmptyState
                  icon={<SlidersHorizontal />}
                  title="Nicio ajustare"
                  description="Congelat, procesat, pierderi sau consum propriu: le notezi cu „Ajustează stocul”."
                />
              ) : (
                <ul className="space-y-2">
                  {zile.map((grupa) => (
                    <li key={grupa.zi} className="space-y-2">
                      <h3 className={cn('px-1 pt-1 font-bold text-fg-subtle', kitText.helper)}>{azi ? ziRelativaRo(grupa.zi, azi) : grupa.zi}</h3>
                      <ul className="space-y-2">
                        {grupa.randuri.map((rand) => (
                          <li key={rand.id}>
                            <ListRow
                              avatar={false}
                              leading={<TipBadge tip={rand.tip} />}
                              title={etichetaAjustare(rand.tip)}
                              detail={rand.motiv?.trim() || undefined}
                              trailing={
                                <span
                                  className={cn(
                                    'whitespace-nowrap font-extrabold tabular-nums',
                                    kitText.base,
                                    Number(rand.delta_kg) < 0 ? 'text-fg' : 'text-primary',
                                  )}
                                >
                                  {deltaKgText(Number(rand.delta_kg))}
                                </span>
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </ScreenBody>

      <AjustareStocForm open={formOpen} onOpenChange={setFormOpen} disponibilKg={stoc?.disponibil ?? 0} />
    </AppShell>
  )
}
