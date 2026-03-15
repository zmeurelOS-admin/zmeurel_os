'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'
import { CompactPageHeader } from '@/components/layout/CompactPageHeader'

import {
  getParcele,
  getParcelaDeleteImpact,
  deleteParcela,
  type Parcela,
} from '@/lib/supabase/queries/parcele'

import { AddParcelaDialog } from '@/components/parcele/AddParcelaDialog'
import { EditParcelaDialog } from '@/components/parcele/EditParcelaDialog'
import { DeleteConfirmDialog } from '@/components/parcele/DeleteConfirmDialog'
import { ParcelaCard } from '@/components/parcele/ParcelaCard'
import { buildParcelaDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'

interface ParcelaPageClientProps {
  initialParcele: Parcela[]
}

export function ParcelaPageClient({
  initialParcele,
}: ParcelaPageClientProps) {
  const queryClient = useQueryClient()
  const [selectedParcela, setSelectedParcela] = useState<Parcela | null>(null)
  const [desktopSelectedParcelaId, setDesktopSelectedParcelaId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-gray-50">
      <CompactPageHeader
        title="Terenuri"
        subtitle="Administrare terenuri cultivate"
      />

      {/* List */}
      <div className="relative z-10 mt-4 space-y-4 px-4 py-4 sm:mt-0">
        {isLoading && (
          <p className="text-center text-sm text-gray-600">
            Se încarcă...
          </p>
        )}

        {!isLoading && parcele.length === 0 && (
          <p className="text-center text-sm text-gray-600">
            Nu exist? terenuri.
          </p>
        )}

        {!isLoading && parcele.length > 0 ? (
          <>
            <div className="space-y-4 lg:hidden">
              {parcele.map((p) => (
                <ParcelaCard
                  key={p.id}
                  parcela={p}
                  onEdit={() => {
                    setSelectedParcela(p)
                    setEditOpen(true)
                  }}
                  onDelete={() => {
                    setSelectedParcela(p)
                    setDeleteOpen(true)
                  }}
                />
              ))}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)] lg:gap-4">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
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
                          className={`cursor-pointer border-t border-gray-100 transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                          onClick={() => setDesktopSelectedParcelaId(parcela.id)}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{parcela.nume_parcela || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{parcela.tip_unitate || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{Number(parcela.suprafata_m2 || 0).toFixed(0)} m2</td>
                          <td className="px-4 py-3 text-gray-700">{Number(parcela.nr_plante || 0)}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                              {parcela.status || 'activ'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Detalii teren</h3>
                {desktopSelectedParcela ? (
                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Nume:</span> {desktopSelectedParcela.nume_parcela || '-'}</p>
                    <p><span className="font-medium text-gray-900">Tip unitate:</span> {desktopSelectedParcela.tip_unitate || '-'}</p>
                    <p><span className="font-medium text-gray-900">Cultura:</span> {desktopSelectedParcela.cultura || desktopSelectedParcela.tip_fruct || '-'}</p>
                    <p><span className="font-medium text-gray-900">Soi:</span> {desktopSelectedParcela.soi || desktopSelectedParcela.soi_plantat || '-'}</p>
                    <p><span className="font-medium text-gray-900">Suprafata:</span> {Number(desktopSelectedParcela.suprafata_m2 || 0).toFixed(0)} m2</p>
                    <p><span className="font-medium text-gray-900">Nr. plante:</span> {Number(desktopSelectedParcela.nr_plante || 0)}</p>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        className="rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                        onClick={() => {
                          setSelectedParcela(desktopSelectedParcela)
                          setEditOpen(true)
                        }}
                      >
                        Editeaza teren
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
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
                  <p className="mt-4 text-sm text-gray-600">Selectează un teren pentru detalii.</p>
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
          isLoadingDeleteImpact
            ? 'Se verifică dependențele acestui teren...'
            : parcelaDeleteImpact && (parcelaDeleteImpact.recoltariCount > 0 || parcelaDeleteImpact.activitatiCount > 0)
              ? `Terenul nu poate fi șters. Are ${[
                  parcelaDeleteImpact.recoltariCount > 0 ? `${parcelaDeleteImpact.recoltariCount} recoltări` : null,
                  parcelaDeleteImpact.activitatiCount > 0 ? `${parcelaDeleteImpact.activitatiCount} activități agricole` : null,
                ]
                  .filter(Boolean)
                  .join(' și ')} asociate.`
              : `Ștergi terenul ${buildParcelaDeleteLabel(selectedParcela)}?`
        }
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (selectedParcela) {
            if (isLoadingDeleteImpact) return
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
