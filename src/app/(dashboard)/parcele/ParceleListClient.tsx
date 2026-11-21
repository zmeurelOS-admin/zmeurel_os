'use client'

import { useEffect, useMemo, useState } from 'react'
import { Map as MapIcon, Plus } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, EmptyState, FilterPills, ListRow, Notice, StatusPill } from '@/components/kit'
import { ParcelaStepForm } from '@/components/parcele/ParcelaStepForm'
import { useParceleStare } from '@/components/parcele/useParceleStare'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useAziRo } from '@/hooks/useAziRo'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { formatNumber } from '@/lib/format-ro'
import { ETICHETA_TIP_UNITATE, ORDINE_TIP_UNITATE, esteParcelaPersonala, liniaParcelei } from '@/lib/parcele/card'
import { normalizeUnitateTip, type UnitateTip } from '@/lib/parcele/unitate'

type FiltruTip = 'toate' | UnitateTip

/**
 * Lista de parcele: un card pe parcelă (cultură + soi, plante, suprafață, kg în sezon, un singur semnal).
 * Parcelele personale: eticheta „Personal”, fără kg. Filtrul pe tip apare doar la mai multe tipuri.
 */
export function ParceleListClient() {
  useTrackModuleView('parcele')
  const router = useRouter()
  const searchParams = useSearchParams()
  const azi = useAziRo()
  const { memberRole, accessLevel } = useDashboardAuth()
  const poateScrie = memberRole !== 'operator' || accessLevel === 'write'

  const stare = useParceleStare(azi)
  const [filtru, setFiltru] = useState<FiltruTip>('toate')
  const [formOpen, setFormOpen] = useState(false)

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
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
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
              return (
                <li key={parcela.id}>
                  <ListRow
                    avatar={false}
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
                          {semnal ? <StatusPill tone={semnal.ton}>{semnal.text}</StatusPill> : null}
                        </span>
                      </span>
                    }
                    onClick={() => router.push(`/parcele/${parcela.id}`)}
                  />
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
