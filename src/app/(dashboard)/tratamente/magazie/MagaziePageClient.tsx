'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Package, Plus } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, EmptyState, FilterPills, Notice, StatTile, kitText } from '@/components/kit'
import { AmCumparatStepForm } from '@/components/magazie/AmCumparatStepForm'
import { AmNumaratStepForm } from '@/components/magazie/AmNumaratStepForm'
import { MagazieIndisponibila, RandMagazie } from '@/components/magazie/RandMagazie'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { accessLevelForModule } from '@/lib/farm-members/access'
import { formatNumber } from '@/lib/format-ro'
import { potrivesteFiltruMagazie, rezumatMagazie, type FiltruMagazie } from '@/lib/magazie/stoc'
import { queryKeys } from '@/lib/query-keys'
import { getMagazieStoc, MagazieIndisponibilaError } from '@/lib/supabase/queries/magazie'
import { getProduseFitosanitare } from '@/lib/supabase/queries/tratamente'
import { aziRo } from '@/lib/tratamente/zile'
import { cn } from '@/lib/utils'

/** Magazia (`/tratamente/magazie`): stocul produselor de tratament, „+ Am cumpărat” și „Am numărat”. */
export function MagaziePageClient() {
  useTrackModuleView('magazie')
  const router = useRouter()
  const { memberRole, memberAccess } = useDashboardAuth()
  const esteProprietar = memberRole !== 'operator'
  const poateScrie = esteProprietar || accessLevelForModule(memberAccess, 'tratamente') === 'write'
  const [filtru, setFiltru] = useState<FiltruMagazie>('toate')
  const [cumparatOpen, setCumparatOpen] = useState(false)
  const [numaratOpen, setNumaratOpen] = useState(false)
  const [azi] = useState(() => aziRo())

  const stocQuery = useQuery({ queryKey: queryKeys.magazieStoc, queryFn: getMagazieStoc, staleTime: 30_000, retry: (n, error) => !(error instanceof MagazieIndisponibilaError) && n < 1 })
  const catalogQuery = useQuery({ queryKey: queryKeys.produseFitosanitare, queryFn: getProduseFitosanitare, staleTime: 5 * 60_000 })
  const indisponibila = stocQuery.error instanceof MagazieIndisponibilaError
  const stoc = useMemo(() => stocQuery.data ?? [], [stocQuery.data])
  const lista = stoc.filter((rand) => potrivesteFiltruMagazie(rand, filtru))
  const rezumat = rezumatMagazie(stoc)
  const valoare = stoc.reduce((sum, rand) => sum + (rand.valoare ?? 0), 0)
  const areValoare = esteProprietar && stoc.some((rand) => rand.valoare !== null)

  const butoane = (
    <div className="grid grid-cols-2 gap-2.5">
      <Button type="button" variant="primary" size="touch-lg" className="min-w-0 whitespace-normal px-3 leading-tight has-[>svg]:px-3" onClick={() => setCumparatOpen(true)}>
        <Plus aria-hidden />
        Am cumpărat
      </Button>
      <Button type="button" variant="neutral" size="touch-lg" className="min-w-0 whitespace-normal px-3 leading-tight has-[>svg]:px-3" onClick={() => setNumaratOpen(true)}>
        <ClipboardCheck aria-hidden />
        Am numărat
      </Button>
    </div>
  )

  return (
    <AppShell
      header={<ScreenHeader title="Magazia" backHref="/tratamente" />}
      bottomBarFixed
      bottomBar={
        poateScrie && !indisponibila && !stocQuery.isLoading ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box bg-surface shadow-2">{butoane}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {indisponibila ? (
          <MagazieIndisponibila />
        ) : stocQuery.isError ? (
          <Notice tone="danger" title="Magazia nu s-a încărcat">
            Verifică internetul și deschide din nou pagina.
          </Notice>
        ) : null}

        {!indisponibila ? (
          <>
            {esteProprietar ? (
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="Produse" value={stocQuery.isLoading ? '…' : formatNumber(rezumat.produse)} />
                <StatTile label="Valoare în magazie" value={stocQuery.isLoading ? '…' : areValoare ? formatNumber(valoare, 0) : '—'} unit={areValoare ? 'lei' : undefined} />
              </div>
            ) : (
              <p className={cn('text-fg-muted', kitText.secondary)}>{stocQuery.isLoading ? 'Se încarcă…' : rezumat.text}</p>
            )}

            {/* Pe desktop bara de jos nu există: butoanele stau în pagină. */}
            {poateScrie ? <div className="hidden md:block">{butoane}</div> : null}

            <FilterPills
              aria-label="Filtrează produsele"
              options={[
                { value: 'toate', label: 'Toate' },
                { value: 'pe_terminate', label: rezumat.peTerminate > 0 ? `Pe terminate · ${rezumat.peTerminate}` : 'Pe terminate' },
                { value: 'fertilizanti', label: 'Fertilizanți' },
                { value: 'protectie', label: 'Protecție' },
              ]}
              value={filtru}
              onValueChange={setFiltru}
            />

            {stocQuery.isLoading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Se încarcă magazia">
                <div className="h-[92px] animate-pulse rounded-box bg-surface-muted" />
                <div className="h-[92px] animate-pulse rounded-box bg-surface-muted" />
              </div>
            ) : lista.length > 0 ? (
              <ul className="space-y-2">
                {lista.map((rand) => (
                  <li key={rand.produs_id}>
                    <RandMagazie rand={rand} onClick={() => router.push(`/tratamente/magazie/${rand.produs_id}`)} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Package />}
                title={stoc.length === 0 ? 'Magazia e goală' : 'Nimic aici'}
                description={
                  stoc.length === 0
                    ? 'Notează ce ai cumpărat sau numără ce ai în magazie. Apoi fiecare tratament făcut scade singur.'
                    : 'Niciun produs pentru filtrul ales.'
                }
              />
            )}

            {stoc.length > 0 ? (
              <p className={cn('px-1 text-fg-muted', kitText.helper)}>„Ajunge pentru” se calculează din cât a cerut ultima aplicare a produsului. Tratamentele planificate nu scad.</p>
            ) : null}
          </>
        ) : null}
      </ScreenBody>

      <AmCumparatStepForm open={cumparatOpen} onOpenChange={setCumparatOpen} todayIso={azi} catalog={catalogQuery.data ?? []} stoc={stoc} esteProprietar={esteProprietar} />
      <AmNumaratStepForm open={numaratOpen} onOpenChange={setNumaratOpen} todayIso={azi} catalog={catalogQuery.data ?? []} stoc={stoc} />
    </AppShell>
  )
}
