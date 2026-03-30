'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'
import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import StatusBadge from '@/components/ui/StatusBadge'

import {
  getParcele,
  getParcelaDeleteImpact,
  deleteParcela,
  type Parcela,
} from '@/lib/supabase/queries/parcele'

import { AddParcelaDialog } from '@/components/parcele/AddParcelaDialog'
import { EditParcelaDialog } from '@/components/parcele/EditParcelaDialog'
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog'
import { buildParcelaDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'
import { formatM2ToHa } from '@/lib/utils/area'
import { cn } from '@/lib/utils'

interface ParcelaPageClientProps {
  initialParcele: Parcela[]
}

function getUnitateBadge(tipUnitate: string | null | undefined): { label: string; className: string } {
  const value = (tipUnitate ?? 'camp').toLowerCase()
  if (value === 'solar') {
    return {
      label: 'Solar',
      className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
    }
  }
  if (value === 'livada') {
    return {
      label: 'Livada',
      className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
    }
  }
  return {
    label: 'Camp',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-green-700 dark:bg-green-900/50 dark:text-green-400',
  }
}

function parcelaEmoji(parcela: Parcela): string {
  const tipUnitate = (parcela.tip_unitate ?? '').toLowerCase()
  const cultura = (parcela.cultura ?? parcela.tip_fruct ?? '').toLowerCase()

  if (tipUnitate.includes('solar') || tipUnitate.includes('sera')) return '🏠'
  if (tipUnitate.includes('livada')) return '🌳'
  if (cultura.includes('zmeur') || cultura.includes('fruct')) return '🫐'
  return '🌱'
}

function parcelaRolLabel(rol: string | null | undefined): { label: string; variant: 'success' | 'neutral' } {
  const v = (rol ?? '').toLowerCase()
  if (v.includes('comercial')) return { label: 'Comercial', variant: 'success' }
  if (v.includes('uz') || v.includes('propriu')) return { label: 'Uz propriu', variant: 'neutral' }
  return { label: 'Uz propriu', variant: 'neutral' }
}

function parcelaSubtitle(parcela: Parcela): string {
  const cultura = (parcela.cultura || parcela.tip_fruct || null) as string | null
  const soi = (parcela.soi || parcela.soi_plantat || null) as string | null
  const culturaSoi = [cultura, soi].filter(Boolean).join(' · ')
  return [culturaSoi || null, formatM2ToHa(parcela.suprafata_m2)].filter(Boolean).join(' · ') || '-'
}

export function ParcelaPageClient({
  initialParcele,
}: ParcelaPageClientProps) {
  const queryClient = useQueryClient()
  const [selectedParcela, setSelectedParcela] = useState<Parcela | null>(null)
  const [desktopSelectedParcelaId, setDesktopSelectedParcelaId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: parcele = initialParcele, isLoading } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: () => getParcele(),
    initialData: initialParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: parcelaDeleteImpact, isLoading: isLoadingDeleteImpact } = useQuery({
    queryKey: ['parcela-delete-impact', selectedParcela?.id ?? null],
    queryFn: () => getParcelaDeleteImpact(selectedParcela!.id),
    enabled: deleteOpen && Boolean(selectedParcela?.id),
    staleTime: 10000,
    refetchOnWindowFocus: false,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteParcela(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })
      toast.success('Teren sters')
      setDeleteOpen(false)
      setSelectedParcela(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const desktopSelectedParcela =
    parcele.find((item) => item.id === desktopSelectedParcelaId) ?? parcele[0] ?? null

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--agri-bg)]">
      <CompactPageHeader
        title="Terenuri"
        subtitle="Administrare terenuri cultivate"
      />

      {/* List */}
      <div className="relative z-10 mt-4 space-y-4 px-4 py-4 sm:mt-0">
        {isLoading && (
          <p className="text-center text-sm text-[var(--agri-text-muted)]">
            Se încarcă...
          </p>
        )}

        {!isLoading && parcele.length === 0 && (
          <p className="text-center text-sm text-[var(--agri-text-muted)]">
            Nu exist? terenuri.
          </p>
        )}

        {!isLoading && parcele.length > 0 ? (
          <>
            <div className="space-y-3 lg:hidden">
              {parcele.map((p) => (
                <MobileEntityCard
                  key={p.id}
                  title={
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden>{parcelaEmoji(p)}</span>
                      <span>{p.nume_parcela || 'Teren'}</span>
                    </span>
                  }
                  value={null}
                  secondary={parcelaSubtitle(p)}
                  status={
                    <StatusBadge
                      text={parcelaRolLabel((p as { rol?: string | null }).rol).label}
                      variant={parcelaRolLabel((p as { rol?: string | null }).rol).variant}
                    />
                  }
                  onClick={() => setExpandedId((current) => (current === p.id ? null : p.id))}
                  isExpanded={expandedId === p.id}
                  className={cn(expandedId === p.id ? 'border-[var(--soft-success-border)]' : '')}
                >
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--agri-text)]">
                    <span>
                      <span className="text-[var(--agri-text-muted)]">An plantare: </span>
                      <span className="font-semibold">{p.an_plantare || '-'}</span>
                    </span>
                    <span>
                      <span className="text-[var(--agri-text-muted)]">Nr plante: </span>
                      <span className="font-semibold">{p.nr_plante || '-'}</span>
                    </span>
                    <span>
                      <span className="text-[var(--agri-text-muted)]">Suprafață: </span>
                      <span className="font-semibold">{formatM2ToHa(p.suprafata_m2)}</span>
                    </span>
                    <span>
                      <span className="text-[var(--agri-text-muted)]">Status REI: </span>
                      <span className="font-semibold">Date indisponibile</span>
                    </span>
                  </div>

                  <div className="mt-3 flex justify-center gap-2 border-t border-[var(--surface-divider)] pt-3">
                    <button
                      type="button"
                      className="min-h-9 rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-[11px] font-semibold text-[var(--button-muted-text)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedParcela(p)
                        setEditOpen(true)
                      }}
                    >
                      Editează
                    </button>
                    <button
                      type="button"
                      className="min-h-9 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-[11px] font-semibold text-[var(--status-danger-text)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedParcela(p)
                        setDeleteOpen(true)
                      }}
                    >
                      Șterge
                    </button>
                  </div>
                </MobileEntityCard>
              ))}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)] lg:gap-4">
              <div className="overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--agri-surface-muted)] text-xs uppercase tracking-wide text-[var(--agri-text-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Teren</th>
                      <th className="px-4 py-3 font-semibold">Tip unitate</th>
                      <th className="px-4 py-3 font-semibold">Suprafata</th>
                      <th className="px-4 py-3 font-semibold">Plante</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcele.map((parcela) => {
                      const isSelected = desktopSelectedParcela?.id === parcela.id
                      return (
                        <tr
                          key={parcela.id}
                          className={`cursor-pointer border-t border-[var(--surface-divider)] transition-colors ${isSelected ? 'bg-[var(--soft-success-bg)]' : 'hover:bg-[var(--agri-surface-muted)]'}`}
                          onClick={() => setDesktopSelectedParcelaId(parcela.id)}
                        >
                          <td className="px-4 py-3 font-medium text-[var(--agri-text)]">{parcela.nume_parcela || '-'}</td>
                          <td className="px-4 py-3 text-[var(--agri-text-muted)]">{parcela.tip_unitate || '-'}</td>
                          <td className="px-4 py-3 text-[var(--agri-text-muted)]">{Number(parcela.suprafata_m2 || 0).toFixed(0)} m2</td>
                          <td className="px-4 py-3 text-[var(--agri-text-muted)]">{Number(parcela.nr_plante || 0)}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-1 text-xs font-semibold text-[var(--status-success-text)]">
                              {parcela.status || 'activ'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Detalii teren</h3>
                {desktopSelectedParcela ? (
                  <div className="mt-4 space-y-3 text-sm text-[var(--agri-text-muted)]">
                    <p><span className="font-medium text-[var(--agri-text)]">Nume:</span> {desktopSelectedParcela.nume_parcela || '-'}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Tip unitate:</span> {desktopSelectedParcela.tip_unitate || '-'}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Cultura:</span> {desktopSelectedParcela.cultura || desktopSelectedParcela.tip_fruct || '-'}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Soi:</span> {desktopSelectedParcela.soi || desktopSelectedParcela.soi_plantat || '-'}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Suprafata:</span> {Number(desktopSelectedParcela.suprafata_m2 || 0).toFixed(0)} m2</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Nr. plante:</span> {Number(desktopSelectedParcela.nr_plante || 0)}</p>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        className="rounded-md bg-[var(--agri-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
                        onClick={() => {
                          setSelectedParcela(desktopSelectedParcela)
                          setEditOpen(true)
                        }}
                      >
                        Editeaza teren
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-danger-text)]"
                        onClick={() => {
                          setSelectedParcela(desktopSelectedParcela)
                          setDeleteOpen(true)
                        }}
                      >
                        Sterge teren
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--agri-text-muted)]">Selectează un teren pentru detalii.</p>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>

      {/* Floating Action Button */}
      <AddParcelaDialog
        soiuriDisponibile={[
          'Delniwa',
          'Maravilla',
          'Enrosadira',
          'Husaria',
        ]}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })
        }
      />

      <EditParcelaDialog
        parcela={selectedParcela}
        open={editOpen}
        onOpenChange={setEditOpen}
        soiuriDisponibile={[
          'Delniwa',
          'Maravilla',
          'Enrosadira',
          'Husaria',
        ]}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })
        }
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={buildParcelaDeleteLabel(selectedParcela)}
        itemType="Teren"
        description={
          parcelaDeleteImpact && (parcelaDeleteImpact.recoltariCount > 0 || parcelaDeleteImpact.activitatiCount > 0)
            ? `Terenul nu poate fi șters. Are ${[
                parcelaDeleteImpact.recoltariCount > 0 ? `${parcelaDeleteImpact.recoltariCount} recoltări` : null,
                parcelaDeleteImpact.activitatiCount > 0 ? `${parcelaDeleteImpact.activitatiCount} activități agricole` : null,
              ]
                .filter(Boolean)
                .join(' și ')} asociate.`
            : undefined
        }
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (selectedParcela) {
            if (parcelaDeleteImpact && (parcelaDeleteImpact.recoltariCount > 0 || parcelaDeleteImpact.activitatiCount > 0)) {
              toast.error('Terenul nu poate fi șters cât timp are recoltări sau activități agricole asociate.')
              return
            }
            deleteMutation.mutate(selectedParcela.id)
          }
        }}
      />
    </div>
  )
}
