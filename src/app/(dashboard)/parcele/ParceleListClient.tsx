'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Map as MapIcon, Plus } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, EmptyState, FilterPills, ListRow, Notice, StatusPill, kitFocus, kitText } from '@/components/kit'
import { ParcelaStepForm } from '@/components/parcele/ParcelaStepForm'
import { useParceleStare } from '@/components/parcele/useParceleStare'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useAziRo } from '@/hooks/useAziRo'
import { ETICHETA_FARA_DATA_CULES, faraDataCules } from '@/lib/analize/cules'
import { useEstimariCules } from '@/lib/analize/useEstimariCules'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { formatNumber } from '@/lib/format-ro'
import { ETICHETA_TIP_UNITATE, ORDINE_TIP_UNITATE, esteParcelaPersonala, liniaParcelei } from '@/lib/parcele/card'
import { normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'
import { cn } from '@/lib/utils'

type FiltruTip = 'toate' | UnitateTip

/**
 * Lista de parcele: un card pe parcelă (cultură + soi, plante, suprafață, kg în sezon, un singur semnal).
 * Parcelele personale: eticheta „Personal”, fără kg. Filtrul pe tip apare doar la mai multe tipuri.
 * O parcelă de vânzare fără dată de cules (nici pusă de mână, nici din anul trecut), într-un stadiu de anul acesta
 * între „Legare fruct” și „Recoltare” (pe oricare lăstar), are eticheta „fără dată de cules”; atinsă, deschide pe fișă foaia „Când începe culesul?” (`/parcele/<id>?cules=1`).
 */
export function ParceleListClient() {
  useTrackModuleView('parcele')
  const router = useRouter()
  const searchParams = useSearchParams()
  const azi = useAziRo()
  const { memberRole, accessLevel } = useDashboardAuth()
  const poateScrie = memberRole !== 'operator' || accessLevel === 'write'

  const stare = useParceleStare(azi)
  const cules = useEstimariCules(azi)
  const [filtru, setFiltru] = useState<FiltruTip>('toate')
  // „Primii pași” din Acasă: `/parcele?nou=1` deschide direct formularul de parcelă.
  const deschideNou = searchParams.get('nou') === '1'
  const [formOpen, setFormOpen] = useState(deschideNou)

  useEffect(() => {
    if (deschideNou) router.replace('/parcele')
  }, [deschideNou, router])

  // Legăturile vechi `/parcele?selected=<id>` duc în fișa parcelei.
  const selected = searchParams.get('selected')?.trim()
  useEffect(() => {
    if (selected) router.replace(`/parcele/${encodeURIComponent(selected)}`)
  }, [router, selected])

  const tipuri = useMemo(() => {
    const counts = new Map<UnitateTip, number>()
    for (const parcela of stare.parcele) {
      const tip = normalizeUnitateTip(parcela.tip_unitate)
      counts.set(tip, (counts.get(tip) ?? 0) + 1)
    }
    return ORDINE_TIP_UNITATE.filter((tip) => counts.has(tip)).map((tip) => ({ tip, count: counts.get(tip) ?? 0 }))
  }, [stare.parcele])
  const filtruEfectiv: FiltruTip = filtru !== 'toate' && !tipuri.some((item) => item.tip === filtru) ? 'toate' : filtru

  const lista = useMemo(() => {
    const filtrate = filtruEfectiv === 'toate' ? stare.parcele : stare.parcele.filter((parcela) => normalizeUnitateTip(parcela.tip_unitate) === filtruEfectiv)
    // Comercialele întâi, apoi după nume.
    return [...filtrate].sort(
      (a, b) =>
        Number(esteParcelaPersonala(a)) - Number(esteParcelaPersonala(b)) ||
        (a.nume_parcela ?? '').localeCompare(b.nume_parcela ?? '', 'ro', { numeric: true }),
    )
  }, [filtruEfectiv, stare.parcele])

  const an = azi?.slice(0, 4) ?? ''

  const addButton = poateScrie ? (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setFormOpen(true)}>
      <Plus aria-hidden />
      Parcelă
    </Button>
  ) : null

  return (
    <AppShell
      header={<ScreenHeader title="Parcele" backHref="/mai-mult" />}
      bottomBarFixed
      bottomBar={
        !stare.loading && addButton ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {addButton ? <div className="hidden md:block">{addButton}</div> : null}

        {tipuri.length > 1 ? (
          <FilterPills<FiltruTip>
            aria-label="Tipul parcelei"
            options={[
              { value: 'toate', label: 'Toate', count: stare.parcele.length },
              ...tipuri.map((item) => ({ value: item.tip, label: ETICHETA_TIP_UNITATE[item.tip], count: item.count })),
            ]}
            value={filtruEfectiv}
            onValueChange={setFiltru}
          />
        ) : null}

        {stare.error ? (
          <Notice tone="danger" title="Parcelele nu s-au încărcat">
            Verifică internetul și deschide din nou pagina.
          </Notice>
        ) : null}

        {stare.loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă parcelele">
            <div className="h-[92px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[92px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[92px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : lista.length > 0 ? (
          <ul className="space-y-2">
            {lista.map((parcela) => {
              const personala = esteParcelaPersonala(parcela)
              const semnal = stare.semnale.get(parcela.id) ?? null
              const kg = stare.kg.get(parcela.id) ?? 0
              const estimare = cules.estimari.get(parcela.id)
              // 9.2: eticheta doar când contează (stadiul din anul acesta între „Legare fruct” și „Recoltare”).
              const faraCules = cules.gata && Boolean(estimare) && faraDataCules(estimare) && stare.culesConteazaPe.has(parcela.id)
              const etichetaApasabila = faraCules && poateScrie
              return (
                <li key={parcela.id} className="relative">
                  <ListRow
                    avatar={false}
                    className={etichetaApasabila ? 'pb-[60px]' : undefined}
                    title={parcela.nume_parcela?.trim() || 'Parcelă fără nume'}
                    detail={
                      <span className="flex flex-col gap-1.5">
                        <span>{liniaParcelei(parcela)}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {personala ? (
                            <StatusPill tone="neutral">Personal</StatusPill>
                          ) : (
                            <StatusPill tone="neutral">{`${formatNumber(kg, 0)} kg în ${an}`}</StatusPill>
                          )}
                          {semnal ? <StatusPill tone={semnal.ton} wrap={semnal.tip === 'stadiu'}>{semnal.text}</StatusPill> : null}
                          {faraCules && !poateScrie ? <StatusPill tone="warning">{ETICHETA_FARA_DATA_CULES}</StatusPill> : null}
                        </span>
                      </span>
                    }
                    onClick={() => router.push(`/parcele/${parcela.id}`)}
                  />
                  {etichetaApasabila ? (
                    // Alt buton decât rândul (nu în el): ținta are 48 px, eticheta arată mică.
                    <button
                      type="button"
                      onClick={() => router.push(`/parcele/${parcela.id}?cules=1`)}
                      aria-label={`${parcela.nume_parcela?.trim() || 'Parcelă'}: fără dată de cules, pune data`}
                      className={cn('absolute bottom-1.5 left-3 flex h-touch items-center rounded-full px-1', kitFocus)}
                    >
                      <span
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 rounded-full border border-warning-border bg-warning-bg px-3 font-bold text-warning-text [&_svg]:size-4',
                          kitText.secondary,
                        )}
                      >
                        <CalendarDays aria-hidden />
                        {ETICHETA_FARA_DATA_CULES}
                      </span>
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<MapIcon />}
            title="Nicio parcelă"
            description="Adaugă parcelele fermei: recoltările, tratamentele și lucrările se notează pe ele."
          />
        )}
      </ScreenBody>

      <ParcelaStepForm open={formOpen} onOpenChange={setFormOpen} onSaved={() => undefined} />
    </AppShell>
  )
}
