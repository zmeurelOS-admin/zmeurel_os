'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChartNoAxesColumn } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog'
import { AddInvestitieDialog } from '@/components/investitii/AddInvestitieDialog'
import { EditInvestitieDialog } from '@/components/investitii/EditInvestitieDialog'
import { InvestitieCard } from '@/components/investitii/InvestitieCard'
import MiniCard from '@/components/ui/MiniCard'
import { SearchField } from '@/components/ui/SearchField'
import { useAddAction } from '@/contexts/AddActionContext'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { deleteInvestitie, getInvestitii, type Investitie } from '@/lib/supabase/queries/investitii'
import { buildInvestitieDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'

interface Parcela {
  id: string
  nume_parcela: string
}

interface InvestitiiPageClientProps {
  initialInvestitii: Investitie[]
  parcele: Parcela[]
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function categoryEmoji(category: string | null | undefined): string {
  const value = normalizeText(category)
  if (value.includes('echip') || value.includes('utilaj')) return '🔧'
  if (value.includes('infra') || value.includes('solar') || value.includes('tunel') || value.includes('depoz')) return '🏗️'
  if (value.includes('saditor') || value.includes('butas')) return '🌿'
  return '📦'
}

export function InvestitiiPageClient({ initialInvestitii, parcele }: InvestitiiPageClientProps) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingInvestitie, setEditingInvestitie] = useState<Investitie | null>(null)
  const [deletingInvestitie, setDeletingInvestitie] = useState<Investitie | null>(null)

  const {
    data: investitii = initialInvestitii,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.investitii,
    queryFn: getInvestitii,
    initialData: initialInvestitii,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInvestitie,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.investitii })
      toast.success('Investitie stearsa')
      setDeletingInvestitie(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => {
      map[p.id] = p.nume_parcela || 'Parcela'
    })
    return map
  }, [parcele])

  const searchedInvestitii = useMemo(() => {
    const term = normalizeText(searchTerm)
    if (!term) return investitii
    return investitii.filter((inv) =>
      [inv.categorie, inv.furnizor, inv.descriere].filter(Boolean).some((value) => normalizeText(value).includes(term))
    )
  }, [investitii, searchTerm])

  const filteredInvestitii = useMemo(() => {
    if (!selectedCategory) return searchedInvestitii
    return searchedInvestitii.filter((inv) => (inv.categorie || 'Altele') === selectedCategory)
  }, [searchedInvestitii, selectedCategory])

  const yearNow = new Date().getFullYear()
  const stats = useMemo(() => {
    const totalInvestit = investitii.reduce((sum, inv) => sum + Number(inv.suma_lei || 0), 0)
    const totalAnulAsta = investitii.reduce((sum, inv) => {
      const year = inv.data ? new Date(inv.data).getFullYear() : 0
      return year === yearNow ? sum + Number(inv.suma_lei || 0) : sum
    }, 0)
    return {
      totalInvestit,
      totalAnulAsta,
      count: investitii.length,
    }
  }, [investitii, yearNow])

  const categoryRows = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const inv of investitii) {
      const key = inv.categorie || 'Altele'
      grouped.set(key, (grouped.get(key) ?? 0) + Number(inv.suma_lei || 0))
    }
    const total = investitii.reduce((sum, inv) => sum + Number(inv.suma_lei || 0), 0)
    return Array.from(grouped.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [investitii])

  const maxCategoryAmount = useMemo(
    () => categoryRows.reduce((max, row) => (row.amount > max ? row.amount : max), 0),
    [categoryRows]
  )

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga investitie')
    return unregister
  }, [registerAddAction])

  return (
    <AppShell
      header={<PageHeader title="Investitii" subtitle="Evidența investițiilor" rightSlot={<ChartNoAxesColumn className="h-5 w-5" />} />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total investit: {stats.totalInvestit.toFixed(2)} lei</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-3 w-full max-w-7xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 sm:space-y-4 sm:py-4">
        <div className="grid grid-cols-2 gap-3">
          <MiniCard icon="🏗️" value={`${stats.totalInvestit.toFixed(0)} RON`} sub={`${stats.count} investitii`} label="Total" />
          <MiniCard icon="📅" value={`${stats.totalAnulAsta.toFixed(0)} RON`} sub={`RON ${yearNow}`} label="" />
        </div>

        <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <SectionTitle className="flex-1" title="Investiții pe categorii" />
            {selectedCategory ? (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{ border: 'none', background: 'transparent', color: colors.coral, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                ✕ Reset
              </button>
            ) : null}
          </div>

          {categoryRows.length === 0 ? (
            <p style={{ fontSize: 11, color: colors.gray }}>Nu exist? investitii pe categorii.</p>
          ) : (
            <div style={{ display: 'grid', gap: spacing.xs }}>
              {categoryRows.map((row) => {
                const selected = selectedCategory === row.name
                const progress = maxCategoryAmount > 0 ? Math.max(6, (row.amount / maxCategoryAmount) * 100) : 0
                return (
                  <button
                    key={row.name}
                    type="button"
                    onClick={() => setSelectedCategory((current) => (current === row.name ? null : row.name))}
                    style={{
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      background: selected ? colors.primary : colors.white,
                      color: selected ? colors.white : colors.dark,
                      borderRadius: radius.md,
                      padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{categoryEmoji(row.name)}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{row.name}</div>
                        <div style={{ marginTop: 3, height: 5, borderRadius: radius.full, background: selected ? 'rgba(255,255,255,0.35)' : colors.grayLight, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', borderRadius: radius.full, background: selected ? colors.white : colors.primary }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{row.amount.toFixed(0)} RON</div>
                        <div style={{ fontSize: 10, opacity: selected ? 0.9 : 0.8 }}>{row.percent.toFixed(0)}%</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <SearchField placeholder="Caută investitie..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Caută investiții" />

        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}
        {isLoading ? <LoadingState label="Se încarcă investitiile..." /> : null}
        {!isLoading && !isError && filteredInvestitii.length === 0 ? <EmptyState title="Nu exist? investitii" /> : null}

        {!isLoading && !isError && filteredInvestitii.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {filteredInvestitii.map((investitie) => (
              <InvestitieCard
                key={investitie.id}
                investitie={investitie}
                parcelaNume={investitie.parcela_id ? parcelaMap[investitie.parcela_id] : undefined}
                onEdit={setEditingInvestitie}
                onDelete={setDeletingInvestitie}
              />
            ))}
          </div>
        ) : null}
      </div>

      <AddInvestitieDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />

      <EditInvestitieDialog
        investitie={editingInvestitie}
        open={!!editingInvestitie}
        onOpenChange={(open) => {
          if (!open) setEditingInvestitie(null)
        }}
      />

      <DeleteConfirmDialog
        open={!!deletingInvestitie}
        onOpenChange={(open) => {
          if (!open) setDeletingInvestitie(null)
        }}
        onConfirm={() => {
          if (deletingInvestitie) deleteMutation.mutate(deletingInvestitie.id)
        }}
        itemName={buildInvestitieDeleteLabel(deletingInvestitie, deletingInvestitie?.parcela_id ? parcelaMap[deletingInvestitie.parcela_id] : '')}
        itemType="investitie"
        description={`Stergi investitia ${deletingInvestitie?.categorie || 'necunoscuta'} din ${deletingInvestitie?.data ? new Date(deletingInvestitie.data).toLocaleDateString('ro-RO') : 'data necunoscuta'} - ${Number(deletingInvestitie?.suma_lei ?? 0).toFixed(2)} lei?`}
      />
    </AppShell>
  )
}
