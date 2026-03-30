'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog'
import { AddInvestitieDialog } from '@/components/investitii/AddInvestitieDialog'
import { EditInvestitieDialog } from '@/components/investitii/EditInvestitieDialog'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { SearchField } from '@/components/ui/SearchField'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAddAction } from '@/contexts/AddActionContext'
import { deleteInvestitie, getInvestitii, type Investitie } from '@/lib/supabase/queries/investitii'
import { buildInvestitieDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

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
  const v = normalizeText(category)
  if (v.includes('saditor') || v.includes('butas')) return '🌿'
  if (v.includes('irigat') || v.includes('fertigare') || v.includes('picurare')) return '💧'
  if (v.includes('sustinere') || v.includes('protectie') || v.includes('solar') || v.includes('tunel') || v.includes('spalier')) return '🏗️'
  if (v.includes('constructi') || v.includes('amenajari') || v.includes('gard') || v.includes('drum')) return '🏠'
  if (v.includes('utilaj') || v.includes('echip') || v.includes('tractor')) return '🔧'
  if (v.includes('depozit') || v.includes('racire') || v.includes('frig')) return '🧊'
  if (v.includes('infrastruct') || v.includes('utilitat') || v.includes('foraj') || v.includes('bransamant')) return '⚡'
  if (v.includes('automat') || v.includes('soft') || v.includes('sensor') || v.includes('it ') || v.startsWith('it')) return '💻'
  if (v.includes('infra')) return '🏗️'
  return '📦'
}

// ─── Inline card component ────────────────────────────────────────────────────

function InvestitieCardNew({
  investitie,
  onEdit,
  onDelete,
}: {
  investitie: Investitie
  onEdit: () => void
  onDelete: () => void
}) {
  const title = investitie.descriere || investitie.categorie || 'Investiție'
  const subtitle = investitie.furnizor || undefined
  const suma = Number(investitie.suma_lei || 0)
  const mainValue = `${suma.toFixed(0)} lei`
  const dataLabel = investitie.data ? new Date(investitie.data).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) : undefined

  return (
    <MobileEntityCard
      title={title}
      value={mainValue}
      secondary={subtitle}
      status={
        dataLabel ? (
          <StatusBadge
            text={dataLabel}
            variant="neutral"
          />
        ) : null
      }
      onClick={() => {
        // Deschide direct dialogul de editare la click
        onEdit()
      }}
    />
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function InvestitiiPageClient({ initialInvestitii, parcele }: InvestitiiPageClientProps) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const openFormFromQuery = searchParams.get('openForm') === '1'
  const prefillSuma = searchParams.get('suma') ?? undefined
  const prefillData = searchParams.get('data') ?? undefined
  const prefillCategorie = searchParams.get('categorie') ?? undefined
  const prefillDescriere = searchParams.get('descriere') ?? undefined
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
      toast.success('Investiție ștearsă')
      setDeletingInvestitie(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => { map[p.id] = p.nume_parcela || 'Parcela' })
    return map
  }, [parcele])

  const yearNow = new Date().getFullYear()
  const stats = useMemo(() => {
    const totalInvestit = investitii.reduce((sum, inv) => sum + Number(inv.suma_lei || 0), 0)
    const totalAnulAsta = investitii.reduce((sum, inv) => {
      const year = inv.data ? new Date(inv.data).getFullYear() : 0
      return year === yearNow ? sum + Number(inv.suma_lei || 0) : sum
    }, 0)
    return { totalInvestit, totalAnulAsta, count: investitii.length }
  }, [investitii, yearNow])

  const filteredInvestitii = useMemo(() => {
    const term = normalizeText(searchTerm)
    if (!term) return investitii
    return investitii.filter((inv) =>
      [inv.categorie, inv.furnizor, inv.descriere].filter(Boolean).some((value) => normalizeText(value).includes(term))
    )
  }, [investitii, searchTerm])

  useEffect(() => {
    if (!openFormFromQuery) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddOpen(true)
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('openForm')
    nextParams.delete('suma')
    nextParams.delete('data')
    nextParams.delete('categorie')
    nextParams.delete('descriere')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [openFormFromQuery, pathname, router, searchParams])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adaugă investiție')
    return unregister
  }, [registerAddAction])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      header={<PageHeader title="Investiții" subtitle="Evidența investițiilor" rightSlot={<span style={{ fontSize: 22 }}>🏗️</span>} />}
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3">

        {/* Scoreboard compact */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center',
          padding: '10px 14px', background: '#1b3a2a', borderRadius: 14,
        }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{stats.totalInvestit.toFixed(0)} RON total investit</span>
          {stats.totalAnulAsta > 0 && (
            <>
              <span style={{ color: '#ffffff33' }}>·</span>
              <span style={{ color: '#a3c9b8', fontSize: 13 }}>{stats.totalAnulAsta.toFixed(0)} RON în {yearNow}</span>
            </>
          )}
        </div>

        {/* Search */}
        <SearchField
          placeholder="Caută investiție..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Caută investiții"
        />

        {/* Error */}
        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListSkeletonCard key={i} className="min-h-[72px]" />
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && !isError && filteredInvestitii.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--agri-text)', marginBottom: 6 }}>Nicio investiție adăugată</p>
            <p style={{ fontSize: 13, color: 'var(--text-hint)' }}>Adaugă prima investiție pentru a o urmări</p>
          </div>
        ) : null}

        {/* Cards */}
        {!isLoading && !isError && filteredInvestitii.length > 0 ? (
          <div>
            {filteredInvestitii.map((investitie) => (
              <InvestitieCardNew
                key={investitie.id}
                investitie={investitie}
                onEdit={() => setEditingInvestitie(investitie)}
                onDelete={() => setDeletingInvestitie(investitie)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <AddInvestitieDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        hideTrigger
        initialValues={{
          suma_lei: prefillSuma,
          data: prefillData,
          categorie: prefillCategorie,
          descriere: prefillDescriere,
        }}
      />

      <EditInvestitieDialog
        investitie={editingInvestitie}
        open={!!editingInvestitie}
        onOpenChange={(open) => { if (!open) setEditingInvestitie(null) }}
      />

      <DeleteConfirmDialog
        open={!!deletingInvestitie}
        onOpenChange={(open) => { if (!open) setDeletingInvestitie(null) }}
        onConfirm={() => {
          if (deletingInvestitie) deleteMutation.mutate(deletingInvestitie.id)
        }}
        itemName={buildInvestitieDeleteLabel(deletingInvestitie, deletingInvestitie?.parcela_id ? parcelaMap[deletingInvestitie.parcela_id] : '')}
        itemType="investitie"
        description={`Ștergi investiția ${deletingInvestitie?.categorie || 'necunoscută'} din ${deletingInvestitie?.data ? new Date(deletingInvestitie.data).toLocaleDateString('ro-RO') : 'data necunoscută'} - ${Number(deletingInvestitie?.suma_lei ?? 0).toFixed(2)} lei?`}
      />
    </AppShell>
  )
}
