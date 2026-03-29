'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getPauseRemainingDays, getPauseUrgency } from '@/lib/pause-helpers'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { deleteActivitateAgricola, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { queryKeys } from '@/lib/query-keys'

const EditActivitateAgricolaDialog = dynamic(
  () => import('@/components/activitati-agricole/EditActivitateAgricolaDialog').then((mod) => mod.EditActivitateAgricolaDialog),
  { ssr: false }
)

interface ActivityDetailSheetProps {
  activitate: ActivitateAgricola | null
  parcelaName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO')
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs font-semibold text-[var(--agri-text-muted)]">{label}</span>
      <p className="mt-0.5 text-sm text-[var(--agri-text)]">{value || '-'}</p>
    </div>
  )
}

export function ActivityDetailSheet({
  activitate,
  parcelaName,
  open,
  onOpenChange,
  onDeleted,
}: ActivityDetailSheetProps) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deleteActivitateAgricola,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      trackEvent({
        eventName: 'entity_deleted',
        moduleName: 'activitati',
        status: 'success',
        metadata: { entity: 'activitate', id: deletedId, source: 'ActivityDetailSheet' },
      })
      toast.success('Activitate ștearsă')
      setDeleteConfirmOpen(false)
      onOpenChange(false)
      onDeleted?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Eroare la ștergere')
    },
  })

  if (!activitate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const remainingDays = getPauseRemainingDays(activitate, today)
  const urgency = getPauseUrgency(activitate, today)
  const hasActivePause = urgency !== 'none'

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom">
          {/* Active pause banner */}
          {hasActivePause ? (
            <div
              className={`mx-4 mt-4 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                urgency === 'urgent'
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}
            >
              ⏳ Pauză activă — {remainingDays} zile rămase
            </div>
          ) : null}

          <SheetHeader>
            <SheetTitle>
              {activitate.tip_activitate || 'Activitate agricolă'}
            </SheetTitle>
            {parcelaName ? (
              <p className="text-sm text-[var(--agri-text-muted)]">Teren: {parcelaName}</p>
            ) : null}
          </SheetHeader>

          <div className="grid gap-3 px-4 pb-2">
            <DetailRow label="Tip activitate" value={activitate.tip_activitate} />
            <DetailRow label="Subtip / Produs" value={[activitate.tip_activitate, activitate.produs_utilizat].filter(Boolean).join(' · ')} />
            <DetailRow label="Doză" value={activitate.doza} />
            <DetailRow label="Operator" value={activitate.operator} />
            <DetailRow label="Observații" value={activitate.observatii} />
            <DetailRow
              label="Timp pauză"
              value={activitate.timp_pauza_zile ? `${activitate.timp_pauza_zile} zile` : '0 zile'}
            />
            <DetailRow label="Data aplicare" value={formatDate(activitate.data_aplicare)} />
            {activitate.id_activitate ? (
              <DetailRow label="ID activitate" value={activitate.id_activitate} />
            ) : null}
          </div>

          <SheetFooter className="mt-2">
            <Button
              variant="outline"
              className="flex-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteMutation.isPending}
            >
              🗑️ Șterge
            </Button>
            <Button
              className="flex-1 bg-amber-500 text-white hover:bg-amber-600"
              onClick={() => {
                setEditOpen(true)
              }}
            >
              ✏️ Editează
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit dialog */}
      {editOpen ? (
        <EditActivitateAgricolaDialog
          activitate={activitate}
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next)
            if (!next) {
              queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
            }
          }}
        />
      ) : null}

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="w-[95%] max-w-md overflow-hidden p-0 sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="px-6 pt-6">Ștergi activitatea?</AlertDialogTitle>
            <AlertDialogDescription className="px-6 pb-2">
              Activitatea &quot;{activitate.tip_activitate || 'Activitate'}&quot; din{' '}
              {formatDate(activitate.data_aplicare)} va fi ștearsă definitiv. Această acțiune este ireversibilă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 border-t px-6 py-4">
            <AlertDialogCancel className="w-full sm:w-auto">Nu, renunț</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.mutate(activitate.id)
                }}
              >
                {deleteMutation.isPending ? 'Se șterge...' : 'Șterge'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
