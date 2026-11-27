'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Ban, Home, Map as MapIcon, Minus, MoreHorizontal, Plus, Snowflake, SlidersHorizontal, Soup } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { Button, EmptyState, ListRow, Notice, Segments, StatHero, buttonVariants, kitText } from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { AjustareStocForm } from '@/components/stocuri/AjustareStocForm'
import { PierdereStocForm } from '@/components/stocuri/PierdereStocForm'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { useSchemaFeatures } from '@/lib/schema-features'
import { formatKg, formatNumber } from '@/lib/format-ro'
import { cheieCultura, culturaPrincipala, etichetaStocCal1 } from '@/lib/parcele/culturi-ferma'
import { queryKeys } from '@/lib/query-keys'
import { inceputSezon } from '@/lib/sezon'
import { ETICHETA_MOTIV_PIERDERE, etichetaRandPierdere, sumarPierderiSezon } from '@/lib/stocuri/pierderi'
import {
  TIPURI_AJUSTARE,
  TIPURI_AJUSTARE_FARA_PIERDERI,
  ajustariPeZile,
  cal2InSezon,
  deltaKgText,
  descompunereStoc,
  esteTipAjustare,
  etichetaAjustare,
  type DescompunereStoc,
} from '@/lib/stocuri/stoc'
import { useStocFerma } from '@/lib/stocuri/useStocFerma'
import { getAjustariStoc, getAjustariStocCuCultura, type AjustareStocTip } from '@/lib/supabase/queries/ajustari-stoc'
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
  return kg === 0 ? formatKg(0) : `${semn} ${formatKg(Math.abs(kg))}`
}


/**
 * Stocuri (prompt 19, pe cultură din promptul 31): cifra mare a culturii, descompunerea ei, Cal. II informativ și
 * istoricul ajustărilor. Cultura vine din parcele: fără parcele, „Adaugă întâi o parcelă”; o cultură, o cifră cu
 * eticheta ei („Afine cal. I disponibile”); mai multe culturi (cu migrarea 20261124100000), o filă pe cultură.
 */
export function StocuriPageClient() {
  useTrackModuleView('stocuri')
  const azi = useSyncExternalStore(subscribeToDayChange, readToday, noServerDay)
  const [formOpen, setFormOpen] = useState(false)
  const [pierdereOpen, setPierdereOpen] = useState(false)
  // Pierderile cu motiv (promptul 33) există doar după migrarea 20261125100000.
  const features = useSchemaFeatures()
  const cuPierderi = features.ready && features.pierderiMotiv
  const [filaAleasa, setFilaAleasa] = useState<string | null>(null)

  const { stare, culturi, summary, summaryQuery } = useStocFerma({ peCultura: true })
  const peCultura = stare.mod === 'pe-cultura'
  const ajustariQuery = useQuery({
    queryKey: [...queryKeys.ajustariStoc, peCultura ? 'cultura' : 'unic', cuPierderi ? 'motiv' : 'fara-motiv'],
    queryFn: () => (peCultura ? getAjustariStocCuCultura({ categorie: cuPierderi }) : getAjustariStoc({ categorie: cuPierderi })),
    enabled: features.ready,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  const recoltariQuery = useQuery({ queryKey: queryKeys.recoltari, queryFn: getRecoltari, staleTime: 30_000, refetchOnWindowFocus: false })
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, refetchOnWindowFocus: false })

  // Fila aleasă: o cultură a fermei; implicit cea principală.
  const file = stare.mod === 'pe-cultura' ? stare.culturi : []
  const fila = file.find((item) => item.cheie === filaAleasa) ?? file.find((item) => item.cheie === culturaPrincipala(culturi ?? [])?.cheie) ?? file[0] ?? null
  const cheiePrincipala = culturaPrincipala(culturi ?? [])?.cheie ?? null

  const stoc: DescompunereStoc | null =
    stare.mod === 'pe-cultura'
      ? fila
        ? { disponibil: fila.disponibil, recoltat: fila.recoltat, livrat: fila.livrat, inLivrare: fila.inLivrare, ajustari: fila.ajustari }
        : null
      : stare.mod === 'unic' && summary
        ? descompunereStoc(summary)
        : null
  const eticheta = stare.mod === 'pe-cultura' ? (fila ? etichetaStocCal1(fila) : '') : stare.mod === 'unic' ? stare.eticheta : ''

  const cheieFila = peCultura ? (fila?.cheie ?? null) : null
  // Calcule mici, pe fiecare desenare (React Compiler le ține minte singur).
  const cal2 = azi && recoltariQuery.data && parceleQuery.data ? cal2InSezon(recoltariQuery.data, parceleQuery.data, azi, cheieFila) : null
  const toate = ajustariQuery.data ?? []
  // Ajustările vechi (fără cultură) sunt ale culturii principale, ca în socoteala stocului.
  const aleFilei = cheieFila
    ? toate.filter((rand) => (cheieCultura((rand as { cultura?: string | null }).cultura) ?? cheiePrincipala) === cheieFila)
    : toate
  const zile = ajustariPeZile(aleFilei)
  const pierderi = azi && recoltariQuery.data ? sumarPierderiSezon(aleFilei, inceputSezon(azi, recoltariQuery.data)) : null

  const loading = stare.mod === 'incarca' && !summaryQuery.isError
  const ajusteazaButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" disabled={!stoc} onClick={() => setFormOpen(true)}>
      <SlidersHorizontal aria-hidden />
      {cuPierderi ? 'Ajustează' : 'Ajustează stocul'}
    </Button>
  )
  // Cu migrarea pierderilor: „Pierdere” lângă „Ajustează”, pe fila culturii.
  const addButton = cuPierderi ? (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="neutral" size="touch-lg" className="w-full" disabled={!stoc} onClick={() => setPierdereOpen(true)}>
        <Ban aria-hidden />
        Pierdere
      </Button>
      {ajusteazaButton}
    </div>
  ) : (
    ajusteazaButton
  )

  return (
    <AppShell
      header={<ScreenHeader title="Stocuri" backHref="/mai-mult" />}
      bottomBarFixed
      bottomBar={
        stoc ? (
          <div className="mx-auto w-full max-w-md px-4">
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

        {stare.mod === 'fara-parcele' ? (
          <EmptyState
            icon={<MapIcon />}
            title="Adaugă întâi o parcelă"
            description="Stocul se ține pe cultura parcelelor: alegi cultura și soiul când pui parcela."
            action={
              <Link href="/parcele?nou=1" className={buttonVariants({ variant: 'primary', size: 'touch-lg' })}>
                Adaugă o parcelă
              </Link>
            }
          />
        ) : null}

        {stare.mod === 'pe-cultura' && file.length > 1 && fila ? (
          <Segments
            aria-label="Cultura"
            options={file.map((item) => ({ value: item.cheie, label: item.nume }))}
            value={fila.cheie}
            onValueChange={setFilaAleasa}
          />
        ) : null}

        {stoc ? (
          <>
            <StatHero
              label={eticheta}
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
              <RandDescompunere label="Ajustări" value={semnKg(stoc.ajustari < 0 ? '−' : '+', stoc.ajustari)} />
            </section>

            {pierderi && pierderi.totalKg > 0 ? (
              <ListRow
                avatar={false}
                title="Pierderi în sezon"
                detail={
                  pierderi.peMotiv.stricat > 0
                    ? `din care ${ETICHETA_MOTIV_PIERDERE.stricat.toLocaleLowerCase('ro-RO')} ${formatKg(pierderi.peMotiv.stricat)}`
                    : 'nu e venit, nici cheltuială'
                }
                trailing={<span className={cn('whitespace-nowrap font-extrabold tabular-nums text-fg', kitText.base)}>{formatKg(pierderi.totalKg)}</span>}
              />
            ) : null}

            <ListRow
              avatar={false}
              title="Cal. II în sezon"
              detail="informativ, nu intră în comenzi"
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
                  description={
                    cuPierderi
                      ? 'Pierderile le notezi cu „Pierdere”; congelat, procesat sau corecții, cu „Ajustează”.'
                      : 'Congelat, procesat, pierderi sau consum propriu: le notezi cu „Ajustează stocul”.'
                  }
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
                              title={etichetaRandPierdere(rand as { tip: string; categorie_pierdere?: string | null }) ?? etichetaAjustare(rand.tip)}
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

      <AjustareStocForm
        open={formOpen}
        onOpenChange={setFormOpen}
        disponibilKg={stoc?.disponibil ?? 0}
        eticheta={eticheta || 'Cal. I disponibil'}
        cultura={peCultura ? (fila?.cheie ?? null) : null}
        tipuri={cuPierderi ? TIPURI_AJUSTARE_FARA_PIERDERI : TIPURI_AJUSTARE}
      />

      {cuPierderi && azi ? (
        <PierdereStocForm
          open={pierdereOpen}
          onOpenChange={setPierdereOpen}
          disponibilKg={stoc?.disponibil ?? 0}
          eticheta={eticheta || 'Cal. I disponibil'}
          cultura={peCultura ? (fila?.cheie ?? null) : null}
          azi={azi}
        />
      ) : null}
    </AppShell>
  )
}
