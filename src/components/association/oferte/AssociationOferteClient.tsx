'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { AppDrawer } from '@/components/app/AppDrawer'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  DesktopInspectorPanel,
  DesktopInspectorSection,
  DesktopSplitPane,
  DesktopToolbar,
} from '@/components/ui/desktop'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { AssociationOfferWorkspaceRow } from '@/lib/association/queries'
import { queryKeys } from '@/lib/query-keys'
import { CATEGORII_PRODUSE, type CategorieProdus } from '@/lib/supabase/queries/produse'
import { toast } from '@/lib/ui/toast'

const CATEGORIE_LABELS: Record<CategorieProdus, string> = {
  fruct: 'Fruct',
  leguma: 'Legumă',
  procesat: 'Procesat',
  altele: 'Altele',
}

function relRo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'acum'
  if (m < 60) return `acum ${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `acum ${h} h`
  const days = Math.floor(h / 24)
  return `acum ${days} zile`
}

function formatLei(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Number(n).toFixed(2)} RON`
}

async function fetchOffers(): Promise<AssociationOfferWorkspaceRow[]> {
  const res = await fetch('/api/association/offers', { credentials: 'same-origin' })
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: { offers: AssociationOfferWorkspaceRow[] } }
    | null
  if (!res.ok || !json?.ok || !json.data?.offers) {
    throw new Error('fetch')
  }
  return json.data.offers
}

type TabId = 'trimisa' | 'aprobata' | 'respinsa' | 'toate'

export type AssociationOferteClientProps = {
  initialOffers: AssociationOfferWorkspaceRow[]
}

export function AssociationOferteClient({ initialOffers }: AssociationOferteClientProps) {
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [tab, setTab] = useState<TabId>('trimisa')
  const [search, setSearch] = useState('')
  const [desktopSelectedId, setDesktopSelectedId] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState<AssociationOfferWorkspaceRow | null>(null)

  const [approveOpen, setApproveOpen] = useState<AssociationOfferWorkspaceRow | null>(null)
  const [finalPrice, setFinalPrice] = useState('')
  const [approveBusy, setApproveBusy] = useState(false)

  const [rejectOpen, setRejectOpen] = useState<AssociationOfferWorkspaceRow | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)

  const { data: offers = initialOffers } = useQuery({
    queryKey: queryKeys.associationOffersWorkspace,
    queryFn: fetchOffers,
    initialData: initialOffers,
    staleTime: 20_000,
  })

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.associationOffersWorkspace })
    await queryClient.invalidateQueries({ queryKey: queryKeys.associationOffersPendingCount })
  }, [queryClient])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return offers.filter((o) => {
      if (tab === 'trimisa' && o.status !== 'trimisa') return false
      if (tab === 'aprobata' && o.status !== 'aprobata') return false
      if (tab === 'respinsa' && o.status !== 'respinsa') return false
      if (!q) return true
      const n = o.produse?.nume?.toLowerCase() ?? ''
      const f = o.tenants?.nume_ferma?.toLowerCase() ?? ''
      return n.includes(q) || f.includes(q)
    })
  }, [offers, tab, search])

  const pendingCount = useMemo(() => offers.filter((o) => o.status === 'trimisa').length, [offers])

  const resolvedDesktopId = useMemo(() => {
    if (!isDesktop || filtered.length === 0) return null
    if (desktopSelectedId && filtered.some((o) => o.id === desktopSelectedId)) {
      return desktopSelectedId
    }
    return filtered[0]?.id ?? null
  }, [isDesktop, filtered, desktopSelectedId])

  const desktopSelected = useMemo(
    () => (resolvedDesktopId ? offers.find((o) => o.id === resolvedDesktopId) ?? null : null),
    [offers, resolvedDesktopId],
  )

  const openApprove = useCallback((o: AssociationOfferWorkspaceRow) => {
    const def =
      o.suggested_price != null
        ? String(o.suggested_price)
        : o.produse?.pret_unitar != null
          ? String(o.produse.pret_unitar)
          : ''
    setFinalPrice(def)
    setApproveOpen(o)
  }, [])

  const columns = useMemo<ColumnDef<AssociationOfferWorkspaceRow>[]>(
    () => [
      {
        id: 'produs',
        header: 'Produs',
        cell: ({ row }) => (
          <span className="font-medium text-[var(--text-primary)]">{row.original.produse?.nume ?? '—'}</span>
        ),
        meta: { searchValue: (row: AssociationOfferWorkspaceRow) => row.produse?.nume ?? '' },
      },
      {
        id: 'ferma',
        header: 'Fermă',
        cell: ({ row }) => row.original.tenants?.nume_ferma ?? '—',
        meta: { searchValue: (row: AssociationOfferWorkspaceRow) => row.tenants?.nume_ferma ?? '' },
      },
      {
        id: 'pret',
        header: 'Preț sugerat',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatLei(row.original.suggested_price ?? row.original.produse?.pret_unitar)}</span>
        ),
        meta: { numeric: true },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          const label =
            s === 'trimisa' ? 'În așteptare' : s === 'aprobata' ? 'Aprobată' : s === 'respinsa' ? 'Respinsă' : s
          return <span className="text-sm font-semibold">{label}</span>
        },
      },
      {
        id: 'data',
        header: 'Trimisă',
        cell: ({ row }) => <span className="text-xs text-[var(--text-secondary)]">{relRo(row.original.created_at)}</span>,
      },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === 'trimisa' ? (
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" className="h-8 bg-[var(--status-success-text)] text-white" onClick={(e) => {
                e.stopPropagation()
                openApprove(row.original)
              }}>
                Aprobă
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8"
                onClick={(e) => {
                  e.stopPropagation()
                  setRejectOpen(row.original)
                }}
              >
                Respinge
              </Button>
            </div>
          ) : (
            <span className="text-[var(--text-tertiary)]"> </span>
          ),
        meta: { searchable: false, headerClassName: 'w-[1%]', cellClassName: 'text-right' },
      },
    ],
    [openApprove],
  )

  const submitApprove = useCallback(async () => {
    if (!approveOpen) return
    setApproveBusy(true)
    try {
      const fp = finalPrice.trim().replace(',', '.')
      const finalPriceNum = fp === '' ? null : Number(fp)
      const body: Record<string, unknown> = {
        offerId: approveOpen.id,
        action: 'aproba',
      }
      if (finalPriceNum != null && Number.isFinite(finalPriceNum) && finalPriceNum >= 0) {
        body.finalPrice = finalPriceNum
      }
      const res = await fetch('/api/association/offers', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const m = json && typeof json === 'object' && json.error?.message
        toast.error(typeof m === 'string' ? m : 'Nu am putut aproba.')
        return
      }
      toast.success('Ofertă aprobată. Produsul este listat în magazin.')
      setApproveOpen(null)
      setFinalPrice('')
      await refresh()
    } finally {
      setApproveBusy(false)
    }
  }, [approveOpen, finalPrice, refresh])

  const submitReject = useCallback(async () => {
    if (!rejectOpen) return
    setRejectBusy(true)
    try {
      const res = await fetch('/api/association/offers', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: rejectOpen.id,
          action: 'respinge',
          reviewNote: rejectNote.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok) {
        const m = json && typeof json === 'object' && json.error?.message
        toast.error(typeof m === 'string' ? m : 'Nu am putut respinge.')
        return
      }
      toast.success('Ofertă respinsă.')
      setRejectOpen(null)
      setRejectNote('')
      setMobileDetail(null)
      await refresh()
    } finally {
      setRejectBusy(false)
    }
  }, [rejectOpen, rejectNote, refresh])

  const offerCard = (o: AssociationOfferWorkspaceRow) => {
    const farm = o.tenants?.nume_ferma ?? '—'
    const prod = o.produse?.nume ?? '—'
    const catRaw = o.produse?.categorie
    const cat =
      catRaw && (CATEGORII_PRODUSE as readonly string[]).includes(catRaw)
        ? CATEGORIE_LABELS[catRaw as CategorieProdus]
        : catRaw ?? '—'
    const tone =
      o.status === 'trimisa' ? 'warning' : o.status === 'aprobata' ? 'success' : 'danger'
    const statusLabel =
      o.status === 'trimisa'
        ? 'În așteptare'
        : o.status === 'aprobata'
          ? 'Aprobată'
          : o.status === 'respinsa'
            ? 'Respinsă'
            : o.status

    return (
      <MobileEntityCard
        key={o.id}
        title={prod}
        subtitle={farm}
        mainValue={formatLei(o.suggested_price ?? o.produse?.pret_unitar)}
        meta={`${cat} · ${relRo(o.created_at)}`}
        statusLabel={statusLabel}
        statusTone={tone}
        showChevron
        interactive
        onClick={() => (isDesktop ? setDesktopSelectedId(o.id) : setMobileDetail(o))}
        ariaLabel={`Ofertă ${prod}`}
      />
    )
  }

  return (
    <AppShell
      header={
        <PageHeader title="Oferte" subtitle="Propuneri de la fermieri pentru magazinul asociației" />
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-10 pt-1">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <TabsList className="flex w-full flex-wrap gap-1">
            <TabsTrigger value="trimisa" className="gap-1.5">
              În așteptare
              {pendingCount > 0 ? (
                <span className="rounded-full bg-[var(--agri-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="aprobata">Aprobate</TabsTrigger>
            <TabsTrigger value="respinsa">Respinse</TabsTrigger>
            <TabsTrigger value="toate">Toate</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            <DesktopToolbar
              className="hidden md:flex"
              trailing={
                <span className="text-sm text-[var(--text-secondary)]">
                  <span className="font-semibold tabular-nums">{filtered.length}</span> în filtru
                </span>
              }
            >
              <SearchField
                placeholder="Caută după produs sau fermă..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Caută oferte"
              />
            </DesktopToolbar>
            <div className="md:hidden">
              <SearchField
                placeholder="Caută după produs sau fermă..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Caută oferte"
              />
            </div>

            <DesktopSplitPane
              master={
                <ResponsiveDataView
                  columns={columns}
                  data={filtered}
                  getRowId={(row) => row.id}
                  mobileContainerClassName="grid-cols-1"
                  emptyMessage="Nicio ofertă pentru filtrele curente."
                  desktopContainerClassName="md:min-w-0"
                  skipDesktopDataFilter
                  hideDesktopSearchRow
                  onDesktopRowClick={(row) => setDesktopSelectedId(row.id)}
                  isDesktopRowSelected={(row) => resolvedDesktopId === row.id}
                  renderCard={offerCard}
                />
              }
              detail={
                <DesktopInspectorPanel
                  title="Detalii ofertă"
                  description={desktopSelected ? relRo(desktopSelected.created_at) : undefined}
                  footer={
                    desktopSelected && desktopSelected.status === 'trimisa' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="agri-cta bg-[var(--status-success-text)] hover:opacity-95"
                          onClick={() => openApprove(desktopSelected)}
                        >
                          Aprobă
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => setRejectOpen(desktopSelected)}>
                          Respinge
                        </Button>
                      </div>
                    ) : null
                  }
                >
                  {desktopSelected ? (
                    <>
                      <DesktopInspectorSection label="Produs">
                        <p className="font-semibold text-[var(--text-primary)]">
                          {desktopSelected.produse?.nume ?? '—'}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {desktopSelected.produse?.categorie &&
                          (CATEGORII_PRODUSE as readonly string[]).includes(desktopSelected.produse.categorie)
                            ? CATEGORIE_LABELS[desktopSelected.produse.categorie as CategorieProdus]
                            : desktopSelected.produse?.categorie ?? '—'}{' '}
                          · Preț fermă: {formatLei(desktopSelected.produse?.pret_unitar)}
                        </p>
                      </DesktopInspectorSection>
                      <DesktopInspectorSection label="Fermă">
                        <p className="font-medium">{desktopSelected.tenants?.nume_ferma ?? '—'}</p>
                      </DesktopInspectorSection>
                      <DesktopInspectorSection label="Preț sugerat">
                        <p className="font-semibold tabular-nums">{formatLei(desktopSelected.suggested_price)}</p>
                      </DesktopInspectorSection>
                      {desktopSelected.message ? (
                        <DesktopInspectorSection label="Mesaj fermier">
                          <p className="whitespace-pre-wrap text-sm">{desktopSelected.message}</p>
                        </DesktopInspectorSection>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-tertiary)]">Selectează o ofertă din listă.</p>
                  )}
                </DesktopInspectorPanel>
              }
            />
          </TabsContent>
        </Tabs>
      </div>

      <AppDrawer
        open={mobileDetail !== null}
        onOpenChange={(o) => {
          if (!o) setMobileDetail(null)
        }}
        title={mobileDetail?.produse?.nume ?? 'Ofertă'}
        description={
          mobileDetail ? `${mobileDetail.tenants?.nume_ferma ?? ''} · ${relRo(mobileDetail.created_at)}` : undefined
        }
      >
        {mobileDetail ? (
          <div className="space-y-4 px-1 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Preț sugerat</p>
              <p className="text-lg font-bold tabular-nums">{formatLei(mobileDetail.suggested_price)}</p>
            </div>
            {mobileDetail.message ? (
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Mesaj</p>
                <p className="whitespace-pre-wrap text-sm">{mobileDetail.message}</p>
              </div>
            ) : null}
            {mobileDetail.status === 'trimisa' ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className="agri-cta w-full bg-[var(--status-success-text)]"
                  onClick={() => {
                    openApprove(mobileDetail)
                    setMobileDetail(null)
                  }}
                >
                  Aprobă
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    setRejectOpen(mobileDetail)
                    setMobileDetail(null)
                  }}
                >
                  Respinge
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </AppDrawer>

      <Dialog open={approveOpen !== null} onOpenChange={(o) => !o && setApproveOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobi oferta?</DialogTitle>
            <DialogDescription>
              Produsul va fi listat automat în magazinul asociației cu prețul ales mai jos (dacă e setat).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="final_price">Preț final în magazin (RON, opțional)</Label>
            <Input
              id="final_price"
              inputMode="decimal"
              value={finalPrice}
              onChange={(e) => setFinalPrice(e.target.value)}
              placeholder="Lasă gol pentru preț sugerat / preț fermă"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveOpen(null)}>
              Anulează
            </Button>
            <Button type="button" className="agri-cta" disabled={approveBusy} onClick={() => void submitApprove()}>
              Confirmă aprobarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rejectOpen !== null} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Respinge oferta</AlertDialogTitle>
            <AlertDialogDescription>
              Poți adăuga un motiv scurt pentru fermier (opțional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Motiv (opțional)"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--status-danger-text)] text-white hover:opacity-95"
              onClick={(e) => {
                e.preventDefault()
                void submitReject()
              }}
              disabled={rejectBusy}
            >
              Respinge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
