'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, FileSpreadsheet } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  arhiveazaPlanTratamentAction,
  getPlanDeleteInfoAction,
  dezarhiveazaPlanTratamentAction,
  listPlanuriTratamentCompletAction,
} from '@/app/(dashboard)/tratamente/planuri/actions'
import { hardDeletePlanAction } from '@/app/(dashboard)/tratamente/planuri/[planId]/actions'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { CardPlanNou, PlanCard } from '@/components/tratamente/PlanCard'
import { PlanDeleteDialog } from '@/components/tratamente/PlanDeleteDialog'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { DesktopToolbar } from '@/components/ui/desktop'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchField } from '@/components/ui/SearchField'
import type { PlanTratamentListItem } from '@/lib/supabase/queries/tratamente'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/ui/toast'

type StatusFilter = 'active' | 'archived' | 'all'

export function PlanuriTratamentPageClient() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [cultureFilter, setCultureFilter] = useState<string>('all')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)
  const [deletePlanName, setDeletePlanName] = useState('')
  const [deleteApplicariCount, setDeleteApplicariCount] = useState(0)

  useEffect(() => {
    const importedRaw = searchParams.get('imported')
    const failedRaw = searchParams.get('failed')

    if (!importedRaw && !failedRaw) return

    const imported = Number(importedRaw ?? '0')
    const failed = Number(failedRaw ?? '0')
    const failedPlans = (searchParams.get('failedPlans') ?? '')
      .split('||')
      .map((item) => item.trim())
      .filter(Boolean)

    if (imported > 0 && failed === 0) {
      toast.success(`${imported} planuri importate cu succes.`)
    } else if (imported > 0 && failed > 0) {
      toast.warning(
        `${imported}/${imported + failed} planuri importate. Erori: ${
          failedPlans.join(', ') || 'verifică fișierele respinse'
        }.`
      )
    } else if (failed > 0) {
      toast.error(
        `Importul nu a salvat niciun plan. Erori: ${
          failedPlans.join(', ') || 'verifică datele din review'
        }.`
      )
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('imported')
    nextParams.delete('failed')
    nextParams.delete('failedPlans')
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    })
  }, [pathname, router, searchParams])

  const { data: planuri = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.planuriTratament,
    queryFn: () => listPlanuriTratamentCompletAction(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const archiveMutation = useMutation({
    mutationFn: async (plan: PlanTratamentListItem) =>
      plan.arhivat
        ? dezarhiveazaPlanTratamentAction(plan.id)
        : arhiveazaPlanTratamentAction(plan.id),
    onSuccess: (_, plan) => {
      toast.success(plan.arhivat ? 'Plan dezarhivat.' : 'Plan arhivat.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.planuriTratament })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Nu am putut actualiza planul.')
    },
  })

  const deleteInfoMutation = useMutation({
    mutationFn: async (plan: PlanTratamentListItem) => {
      const result = await getPlanDeleteInfoAction(plan.id)
      return { ...result, plan }
    },
    onSuccess: ({ countAplicari, plan }) => {
      setDeletePlanId(plan.id)
      setDeletePlanName(plan.nume)
      setDeleteApplicariCount(countAplicari)
      setDeleteOpen(true)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Nu am putut verifica dacă planul poate fi șters.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (planId: string) => {
      const result = await hardDeletePlanAction(planId)
      if (!result.ok) {
        throw new Error(result.error)
      }
    },
    onSuccess: async () => {
      toast.success('Planul a fost șters.')
      setDeleteOpen(false)
      setDeletePlanId(null)
      setDeletePlanName('')
      setDeleteApplicariCount(0)
      await queryClient.invalidateQueries({ queryKey: queryKeys.planuriTratament })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Nu am putut șterge planul.')
    },
  })

  const cultureOptions = useMemo(() => {
    return ['all', ...new Set(planuri.map((plan) => plan.cultura_tip).filter(Boolean))] as string[]
  }, [planuri])

  const filteredPlanuri = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    return planuri.filter((plan) => {
      if (statusFilter === 'active' && plan.arhivat) return false
      if (statusFilter === 'archived' && !plan.arhivat) return false
      if (cultureFilter !== 'all' && plan.cultura_tip !== cultureFilter) return false

      if (!normalizedSearch) return true

      const haystack = [plan.nume, plan.cultura_tip]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      return haystack.includes(normalizedSearch)
    })
  }, [cultureFilter, planuri, search, statusFilter])

  return (
    <AppShell
      header={
        <PageHeader
          title="Planuri de tratament"
          subtitle="Strategii sezoniere pentru parcelele fermei"
          rightSlot={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link
                  href="/tratamente/planuri/import"
                  aria-label="Import din Excel"
                  title="Import din Excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">Import din Excel</span>
                </Link>
              </Button>
              <Button
                type="button"
                className="bg-[var(--agri-primary)] text-white"
                onClick={() => router.push('/tratamente/planuri/nou')}
              >
                + Plan nou
              </Button>
            </div>
          }
          expandRightSlotOnMobile
        />
      }
    >
      <div className="mx-auto mt-2 w-full max-w-7xl space-y-4 py-3 sm:mt-0">
        <div className="space-y-3 md:hidden">
          <SearchField
            placeholder="Caută după nume sau cultură"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Caută planuri"
          />

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'active', label: 'Active' },
              { id: 'archived', label: 'Arhivate' },
              { id: 'all', label: 'Toate' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                  statusFilter === option.id
                    ? 'bg-[var(--agri-primary)] text-white'
                    : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
                }`}
                onClick={() => setStatusFilter(option.id as StatusFilter)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {cultureOptions.map((cultura) => (
              <button
                key={cultura}
                type="button"
                className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                  cultureFilter === cultura
                    ? 'bg-[var(--brand-blue)] text-white'
                    : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
                }`}
                onClick={() => setCultureFilter(cultura)}
              >
                {cultura === 'all' ? 'Toate culturile' : cultura}
              </button>
            ))}
          </div>
        </div>

        {!isLoading && !isError && planuri.length > 0 ? (
          <DesktopToolbar
            className="hidden md:flex"
            trailing={
              <span className="text-xs text-[var(--text-tertiary)]">
                <span className="font-semibold text-[var(--text-primary)]">{filteredPlanuri.length}</span> în filtru
              </span>
            }
          >
            <SearchField
              containerClassName="w-full max-w-md"
              placeholder="Caută după nume sau cultură"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Caută planuri"
            />
            <div className="flex items-center gap-2">
              <select
                value={cultureFilter}
                onChange={(event) => setCultureFilter(event.target.value)}
                className="agri-control h-9 min-w-[11rem] rounded-xl px-3 text-sm"
                aria-label="Filtrează după cultură"
              >
                {cultureOptions.map((cultura) => (
                  <option key={cultura} value={cultura}>
                    {cultura === 'all' ? 'Toate culturile' : cultura}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="agri-control h-9 min-w-[10rem] rounded-xl px-3 text-sm"
                aria-label="Filtrează după stare"
              >
                <option value="active">Active</option>
                <option value="archived">Arhivate</option>
                <option value="all">Toate</option>
              </select>
            </div>
          </DesktopToolbar>
        ) : null}

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <AppCard key={index} className="rounded-[22px] p-5">
                <div className="space-y-3">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--surface-card-muted)]" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--surface-card-muted)]" />
                  <div className="h-10 animate-pulse rounded bg-[var(--surface-card-muted)]" />
                </div>
              </AppCard>
            ))}
          </div>
        ) : null}

        {isError ? (
          <AppCard className="rounded-[22px] p-5">
            <p className="text-sm text-[var(--soft-danger-text)]">
              Nu am putut încărca planurile de tratament.
            </p>
          </AppCard>
        ) : null}

        {!isLoading && !isError && filteredPlanuri.length === 0 ? (
          <>
            {planuri.length === 0 ? null : (
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" />}
                title="Nu există planuri pentru filtrele curente"
                description="Modifică filtrele sau încearcă altă căutare."
              />
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <CardPlanNou />
            </div>
          </>
        ) : null}

        {!isLoading && !isError && filteredPlanuri.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredPlanuri.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => router.push(`/tratamente/planuri/${plan.id}/editeaza`)}
                onDuplica={() => router.push(`/tratamente/planuri/nou?duplicate_from=${plan.id}`)}
                onArhiveaza={() => archiveMutation.mutate(plan)}
                onSterge={() => deleteInfoMutation.mutate(plan)}
                onClick={() => router.push(`/tratamente/planuri/${plan.id}`)}
              />
            ))}
            <CardPlanNou />
          </div>
        ) : null}
      </div>

      {deletePlanId ? (
        <PlanDeleteDialog
          countAplicari={deleteApplicariCount}
          onConfirm={() => deleteMutation.mutate(deletePlanId)}
          onOpenChange={(open) => {
            setDeleteOpen(open)
            if (!open) {
              setDeletePlanId(null)
              setDeletePlanName('')
              setDeleteApplicariCount(0)
            }
          }}
          open={deleteOpen}
          pending={deleteMutation.isPending}
          planName={deletePlanName}
        />
      ) : null}
    </AppShell>
  )
}
