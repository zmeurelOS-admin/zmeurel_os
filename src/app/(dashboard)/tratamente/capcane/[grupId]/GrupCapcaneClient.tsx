'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bug, Droplets } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { GraficCapcane } from '@/components/capcane/GraficCapcane'
import { IconitaTip } from '@/components/capcane/IconitaTip'
import { VerificaStepForm } from '@/components/capcane/VerificaStepForm'
import { BottomSheet, Button, EmptyState, ListRow, Notice, StatusPill, SummaryList, SummaryRow, kitText } from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import {
  ETICHETA_TIP_CAPCANA,
  capturiLaPrag,
  capturiText,
  dataSchimbAtractant,
  dataVerificareUrmatoare,
  pestePrag,
  textPrag,
  titluGrup,
  totaluriPeSaptamana,
  type VerificareCapcana,
} from '@/lib/capcane'
import { useCapcane } from '@/lib/capcane/useCapcane'
import { accessLevelForModule } from '@/lib/farm-members/access'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { queryKeys } from '@/lib/query-keys'
import { linkPozaCapcana, scoateCapcanele } from '@/lib/supabase/queries/capcane'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { usePauzeActive } from '@/lib/tratamente/hooks'
import { construiesteJurnal, textProduse } from '@/lib/tratamente/jurnal'
import { ETICHETA_TIP } from '@/lib/tratamente/model'
import { aziRo, ZiCuDataRo, ziCuDataRo, ziRelativaRo } from '@/lib/tratamente/zile'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

function subscribeToDayChange(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(timer)
}
const readToday = () => aziRo()
const noServerDay = () => null

/** Cele mai noi atâtea săptămâni pe grafic. */
const SAPTAMANI_PE_GRAFIC = 10

/**
 * Fișa grupului: totalurile pe săptămână ca bare, cu linia punctată a pragului și tratamentele parcelei ca semne,
 * lista verificărilor, „Scoate capcanele” și „Fă un tratament pe …”.
 */
export function GrupCapcaneClient({ grupId }: { grupId: string }) {
  useTrackModuleView('capcane')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { memberRole, memberAccess } = useDashboardAuth()
  const poateScrie = memberRole !== 'operator' || accessLevelForModule(memberAccess, 'tratamente') === 'write'
  const azi = useSyncExternalStore(subscribeToDayChange, readToday, noServerDay)

  const capcane = useCapcane(azi)
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000 })
  const { aplicari, activitati } = usePauzeActive(azi)
  const [verificaOpen, setVerificaOpen] = useState(false)
  const [scoateOpen, setScoateOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const grup = capcane.grupuri.find((item) => item.id === grupId) ?? null
  const numeParcele = useMemo(() => new Map((parceleQuery.data ?? []).map((p) => [p.id, p.nume_parcela?.trim() || 'Parcelă'])), [parceleQuery.data])
  const parcela = grup ? numeParcele.get(grup.parcela_id) ?? 'Parcelă' : 'Parcelă'
  const verificari = useMemo(() => (grup ? capcane.verificariPeGrup.get(grup.id) ?? [] : []), [capcane.verificariPeGrup, grup])
  const prag = grup ? capcane.praguri[grup.tip] : null

  const saptamani = useMemo(() => (azi && verificari.length > 0 ? totaluriPeSaptamana(verificari, { pana: azi }).slice(-SAPTAMANI_PE_GRAFIC) : []), [azi, verificari])
  const pestePragPeSaptamana = saptamani.map((s) =>
    grup ? pestePrag({ capturi: s.capturi, nrBucati: grup.nr_bucati, prag, inCoacere: capcane.inCoacere(grup.parcela_id, s.ultimaZi ?? s.start) }) : false,
  )

  const tratamente = useMemo(() => {
    if (!grup || saptamani.length === 0) return []
    const de = saptamani[0].start
    return construiesteJurnal({ aplicari, activitati })
      .facute.filter((rand) => rand.zi && rand.zi >= de && rand.parcelaIds.includes(grup.parcela_id))
      .map((rand) => ({ zi: rand.zi as string, titlu: ETICHETA_TIP[rand.tip], text: textProduse(rand.produse, false) || '—' }))
  }, [activitati, aplicari, grup, saptamani])

  const verificariPeZi = useMemo(() => {
    const map = new Map<string, VerificareCapcana[]>()
    for (const v of verificari) {
      const lista = map.get(v.data) ?? []
      lista.push(v)
      map.set(v.data, lista)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [verificari])

  const pozaQuery = useQuery({ queryKey: ['tratamente', 'capcane', 'poza', grup?.foto_url ?? ''], queryFn: () => linkPozaCapcana(grup?.foto_url), enabled: Boolean(grup?.foto_url), staleTime: 30 * 60_000 })

  const scoate = async () => {
    if (!grup || busy) return
    setBusy(true)
    try {
      await scoateCapcanele(grup.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.capcane })
      setScoateOpen(false)
      toast.success('Capcanele au fost scoase. Rămân în istoric și în registru.')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nu s-a salvat.')
    } finally {
      setBusy(false)
    }
  }

  const ultimaPeste = pestePragPeSaptamana.at(-1) && saptamani.at(-1)?.capturi !== null
  const activ = grup?.status === 'activa'

  return (
    <AppShell
      header={<ScreenHeader title={grup ? `${parcela} · capturi` : 'Capcane'} backHref="/tratamente?tab=capcane" />}
      bottomBarFixed
      bottomBar={
        grup && poateScrie ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">
              <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => router.push(`/tratamente?parcela=${encodeURIComponent(grup.parcela_id)}`)}>
                <Droplets aria-hidden />
                <span className="truncate">Fă un tratament pe {parcela}</span>
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {capcane.indisponibil ? (
          <Notice tone="info" title="Capcanele vor merge după actualizarea bazei de date" />
        ) : capcane.loading || !azi ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă">
            <div className="h-[150px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : !grup ? (
          <EmptyState icon={<Bug />} title="Grupul nu mai există" description="Poate a fost șters. Întoarce-te la capcane." />
        ) : (
          <>
            <ListRow
              avatar={false}
              leading={<IconitaTip tip={grup.tip} ton={ultimaPeste ? 'warning' : activ ? 'primary' : 'neutral'} />}
              title={titluGrup(parcela, grup.tip, grup.nr_bucati)}
              detail={
                activ
                  ? `Verifici la ${grup.interval_verificare_zile} zile · următoarea: ${ziRelativaRo(dataVerificareUrmatoare(grup), azi).toLocaleLowerCase('ro-RO')}`
                  : `Scoase · montate ${ziCuDataRo(grup.data_montare)}`
              }
              trailing={ultimaPeste && activ ? <StatusPill tone="warning">peste prag</StatusPill> : undefined}
            />

            <h2 className={cn('px-1 pt-1 font-bold text-fg', kitText.secondary)}>{ETICHETA_TIP_CAPCANA[grup.tip].replace(' (atractant)', '')} · total pe săptămână</h2>
            {saptamani.length > 0 ? (
              <>
                <GraficCapcane
                  saptamani={saptamani}
                  pestePrag={pestePragPeSaptamana}
                  pragCapturi={prag ? capturiLaPrag(prag, grup.nr_bucati) : null}
                  tratamente={tratamente}
                />
                <p className={cn('px-1 text-fg-muted', kitText.helper)}>
                  {prag ? `Linia punctată = pragul tău (${textPrag(prag)}).` : 'Fără prag pentru acest tip. Îl pui din Notificări › Ce primești.'} 💧 = tratament pe parcelă.
                </p>
              </>
            ) : (
              <Notice tone="info" title="Nicio verificare încă">
                {activ ? `Prima verificare: ${ziRelativaRo(dataVerificareUrmatoare(grup), azi).toLocaleLowerCase('ro-RO')}.` : 'Grupul a fost scos fără verificări.'}
              </Notice>
            )}

            {tratamente.length > 0 ? (
              <section className="space-y-2" aria-labelledby="tratamente-parcela">
                <h2 id="tratamente-parcela" className={cn('px-1 pt-1 font-bold text-fg', kitText.secondary)}>
                  Tratamente pe {parcela}
                </h2>
                <ul className="space-y-2">
                  {tratamente
                    .slice()
                    .reverse()
                    .map((t, i) => (
                      <li key={`${t.zi}-${i}`}>
                        <ListRow
                          avatar={false}
                          leading={
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-text [&_svg]:size-5" aria-hidden>
                              <Droplets />
                            </span>
                          }
                          title={`${t.titlu} · ${ziCuDataRo(t.zi)}`}
                          detail={t.text}
                        />
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            <section className="space-y-2" aria-labelledby="verificari-grup">
              <h2 id="verificari-grup" className={cn('px-1 pt-1 font-bold text-fg', kitText.secondary)}>
                Verificările
              </h2>
              {verificariPeZi.length > 0 ? (
                <SummaryList>
                  {verificariPeZi.map(([zi, lista]) => {
                    const total = lista.reduce((s, v) => s + v.capturi, 0)
                    const pe = lista
                      .slice()
                      .sort((a, b) => (a.capcana_nr ?? 0) - (b.capcana_nr ?? 0))
                      .map((v) => v.capturi)
                      .join(', ')
                    const atractant = lista.some((v) => v.atractant_schimbat)
                    const note = lista.map((v) => v.observatii).filter(Boolean)
                    return (
                      <SummaryRow
                        key={zi}
                        label={ZiCuDataRo(zi)}
                        value={`${capturiText(total)}${lista.length > 1 ? ` (${pe})` : ''}${atractant ? ' · atractant schimbat' : ''}${note.length > 0 ? ` · ${note.join('; ')}` : ''}`}
                      />
                    )
                  })}
                </SummaryList>
              ) : (
                <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Încă nicio verificare.</p>
              )}
            </section>

            <SummaryList>
              <SummaryRow label="Montate" value={ZiCuDataRo(grup.data_montare)} />
              {activ && dataSchimbAtractant(grup) ? <SummaryRow label="Atractantul" value={`se schimbă ${ziRelativaRo(dataSchimbAtractant(grup) as string, azi).toLocaleLowerCase('ro-RO')}`} /> : null}
              <SummaryRow label="Pragul" value={textPrag(prag)} />
            </SummaryList>

            {pozaQuery.data ? (
              // eslint-disable-next-line @next/next/no-img-element -- link semnat din bucketul privat
              <img src={pozaQuery.data} alt={`Capcanele de pe ${parcela}`} className="max-h-64 w-full rounded-box border border-border object-cover" />
            ) : null}

            {activ && poateScrie ? (
              <div className="flex flex-col gap-2.5 pt-1">
                <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setVerificaOpen(true)}>
                  Verifică acum
                </Button>
                <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => setScoateOpen(true)}>
                  Scoate capcanele
                </Button>
              </div>
            ) : null}
          </>
        )}
      </ScreenBody>

      <BottomSheet
        open={scoateOpen}
        onOpenChange={setScoateOpen}
        title="Scoți capcanele?"
        footer={
          <div className="flex flex-col gap-2.5">
            <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={busy} onClick={() => void scoate()}>
              Da, le-am scos
            </Button>
            <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => setScoateOpen(false)}>
              Nu, rămân
            </Button>
          </div>
        }
      >
        <p className={cn('text-fg-muted', kitText.base)}>Nu mai primești mementoul pentru ele. Verificările rămân în istoric și în registrul de tratamente.</p>
      </BottomSheet>

      {azi && grup ? (
        <VerificaStepForm
          open={verificaOpen}
          onOpenChange={setVerificaOpen}
          todayIso={azi}
          grupuri={[grup]}
          verificari={capcane.verificari}
          numeParcele={numeParcele}
          praguri={capcane.praguri}
          inCoacere={capcane.inCoacere}
          onTratament={(parcelaId) => router.push(`/tratamente?parcela=${encodeURIComponent(parcelaId)}`)}
        />
      ) : null}
    </AppShell>
  )
}
