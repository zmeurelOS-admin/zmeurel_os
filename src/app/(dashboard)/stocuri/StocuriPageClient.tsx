'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Archive } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import AlertCard from '@/components/ui/AlertCard'
import MiniCard from '@/components/ui/MiniCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { colors, radius } from '@/lib/design-tokens'
import { getStocuriPeLocatii, type StocFilters } from '@/lib/supabase/queries/miscari-stoc'
import { queryKeys } from '@/lib/query-keys'

interface ParcelaOption {
  id: string
  nume_parcela: string
}

interface StocuriPageClientProps {
  initialParcele: ParcelaOption[]
}

const LOW_STOCK_THRESHOLD = 20

export function StocuriPageClient({ initialParcele }: StocuriPageClientProps) {
  const [locatieId, setLocatieId] = useState<string>('all')
  const [produs, setProdus] = useState<string>('zmeura')
  const [depozit, setDepozit] = useState<'all' | 'fresh' | 'congelat' | 'procesat'>('all')
  const [calitate, setCalitate] = useState<'all' | 'cal1' | 'cal2'>('all')

  const queryFilters = useMemo<StocFilters>(
    () => ({
      locatieId: locatieId === 'all' ? undefined : locatieId,
      produs: produs === 'all' ? undefined : produs,
      depozit,
      calitate,
    }),
    [locatieId, produs, depozit, calitate]
  )

  const {
    data: stocuri = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.stocuriLocatii(queryFilters),
    queryFn: () => getStocuriPeLocatii(queryFilters),
  })

  const totalKg = useMemo(() => stocuri.reduce((sum, item) => sum + Number(item.total_kg ?? 0), 0), [stocuri])
  const activeLocations = useMemo(() => stocuri.filter((item) => Number(item.total_kg || 0) > 0).length, [stocuri])

  const lowStockRows = useMemo(
    () => stocuri.filter((row) => Number(row.total_kg || 0) > 0 && Number(row.total_kg || 0) < LOW_STOCK_THRESHOLD),
    [stocuri]
  )

  return (
    <AppShell
      header={<PageHeader title="Stocuri" subtitle="Inventar real pe locație" rightSlot={<Archive className="h-5 w-5" />} />}
      bottomBar={
        <StickyActionBar>
          <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total stoc: {totalKg.toFixed(2)} kg</p>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-5xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3">
        <div className="grid grid-cols-2 gap-3">
          <div
            style={{
              border: `1px solid ${totalKg > 0 ? colors.green : colors.coral}`,
              borderRadius: radius.xl,
            }}
          >
            <MiniCard icon="📦" value={totalKg.toFixed(1)} sub="kg disponibil" label="" />
          </div>
          <MiniCard icon="🗺️" value={String(activeLocations)} sub="locatii active" label="" />
        </div>

        {lowStockRows.length > 0 ? (
          <div className="space-y-2">
            {lowStockRows.map((row) => (
              <AlertCard
                key={`low-${row.locatie_id}`}
                icon="⚠️"
                label={`Stoc scazut la ${row.locatie_nume}: ${Number(row.total_kg || 0).toFixed(1)} kg`}
                value={`${Number(row.total_kg || 0).toFixed(1)} kg`}
                sub={`Prag recomandat: ${LOW_STOCK_THRESHOLD} kg`}
                variant="warning"
              />
            ))}
          </div>
        ) : null}

        <Card className="rounded-2xl border border-[var(--agri-border)] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Filtre stoc</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Locație</Label>
              <Select value={locatieId} onValueChange={setLocatieId}>
                <SelectTrigger className="agri-control h-11">
                  <SelectValue placeholder="Toate locatiile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate locatiile</SelectItem>
                  {initialParcele.map((parcela) => (
                    <SelectItem key={parcela.id} value={parcela.id}>
                      {parcela.nume_parcela || 'Parcela'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Produs</Label>
              <Select value={produs} onValueChange={setProdus}>
                <SelectTrigger className="agri-control h-11">
                  <SelectValue placeholder="Produs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zmeura">Zmeura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Depozit</Label>
              <Select value={depozit} onValueChange={(value) => setDepozit(value as typeof depozit)}>
                <SelectTrigger className="agri-control h-11">
                  <SelectValue placeholder="Toate depozitele" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate depozitele</SelectItem>
                  <SelectItem value="fresh">Fresh</SelectItem>
                  <SelectItem value="congelat">Congelat</SelectItem>
                  <SelectItem value="procesat">Procesat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Calitate</Label>
              <Select value={calitate} onValueChange={(value) => setCalitate(value as typeof calitate)}>
                <SelectTrigger className="agri-control h-11">
                  <SelectValue placeholder="Toate calitatile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate calitatile</SelectItem>
                  <SelectItem value="cal1">Calitatea 1</SelectItem>
                  <SelectItem value="cal2">Calitatea 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isError ? <ErrorState title="Eroare la înc?rcare stocuri" message={(error as Error).message} onRetry={() => refetch()} /> : null}
        {isLoading ? <LoadingState label="Se calculeaza stocurile..." /> : null}
        {!isLoading && !isError && stocuri.length === 0 ? <EmptyState title="Nu exist? miscari de stoc" /> : null}

        {!isLoading && !isError && stocuri.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {stocuri.map((row) => {
              const cal1 = Number(row.stoc_fresh_cal1 || 0)
              const cal2 = Number(row.stoc_fresh_cal2 || 0)
              const totalFresh = cal1 + cal2
              const cal1Percent = totalFresh > 0 ? (cal1 / totalFresh) * 100 : 0
              const cal2Percent = totalFresh > 0 ? (cal2 / totalFresh) * 100 : 0

              return (
                <Card key={`${row.locatie_id}-${row.produs}`} className="rounded-2xl border border-[var(--agri-border)] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">{row.locatie_nume}</CardTitle>
                    <p className="text-xs text-[var(--agri-text-muted)]">Stoc total: {Number(row.total_kg || 0).toFixed(2)} kg</p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>Cal I</span>
                        <span className="font-semibold">{cal1.toFixed(2)} kg</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--agri-border)]">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, cal1Percent))}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span>Cal II</span>
                        <span className="font-semibold">{cal2.toFixed(2)} kg</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--agri-border)]">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, cal2Percent))}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--agri-text-muted)]">
                      <div>Congelat: {Number(row.stoc_congelat || 0).toFixed(2)} kg</div>
                      <div>Procesat: {Number(row.stoc_procesat || 0).toFixed(2)} kg</div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
