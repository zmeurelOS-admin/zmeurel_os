'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DIALOG_DETAIL_FOOTER_CLASS } from '@/lib/ui/modal-overlay-classes'
import { getPauseRemainingDays, getPauseUrgency } from '@/lib/pause-helpers'
import { hapticSuccess } from '@/lib/utils/haptic'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { toast } from '@/lib/ui/toast'
import { deleteActivitateAgricola, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'
import { X } from 'lucide-react'

const EditActivitateAgricolaDialog = dynamic(
  () => import('@/components/activitati-agricole/EditActivitateAgricolaDialog').then((mod) => mod.EditActivitateAgricolaDialog),
  { ssr: false }
)

interface ActivityDetailDialogProps {
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

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-[var(--agri-text-muted)]">{label}</p>
      <p className="text-sm font-medium text-[var(--agri-text)]">{value ?? '-'}</p>
    </div>
  )
}

export function ActivityDetailDialog({ activitate, parcelaName, open, onOpenChange, onDeleted }: ActivityDetailDialogProps) {
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
        metadata: { entity: 'activitate', id: deletedId, source: 'ActivityDetailDialog' },
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

  const parsed = useMemo(() => {
    if (!activitate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const remainingDays = getPauseRemainingDays(activitate, today)
    const urgency = getPauseUrgency(activitate, today)
    return { remainingDays, urgency }
  }, [activitate])

  if (!activitate) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          showCloseButton={false}
          className="max-h-[88dvh] w-[min(96vw,720px)] overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogHeader className="sticky top-0 z-10 border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] bg-[var(--agri-surface)] px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 pr-8">
                <DialogTitle className="text-left text-lg font-semibold tracking-[-0.02em] text-[var(--agri-text)] [font-weight:650]">
                  {activitate.tip_activitate || 'Activitate agricolă'}
                </DialogTitle>
                {parcelaName ? <p className="text-sm text-[var(--agri-text-muted)]">Teren: {parcelaName}</p> : null}
              </div>

              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Închide dialog">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(88dvh-84px)] overflow-y-auto p-6">
            {parsed && parsed.urgency !== 'none' ? (
              <div
                className={`mb-5 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  parsed.urgency === 'urgent'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}
              >
                ⏳ Pauză activă — {parsed.remainingDays} zile rămase
              </div>
            ) : null}

            <div className="grid gap-3">
              <DetailRow label="Tip activitate" value={activitate.tip_activitate} />
              <DetailRow
                label="Subtip / Produs"
                value={[activitate.tip_activitate, activitate.produs_utilizat].filter(Boolean).join(' · ')}
              />
              <DetailRow label="Doză" value={activitate.doza} />
              <DetailRow label="Operator" value={activitate.operator} />
              <DetailRow label="Observații" value={activitate.observatii} />
              <DetailRow label="Timp pauză" value={activitate.timp_pauza_zile ? `${activitate.timp_pauza_zile} zile` : '0 zile'} />
              <DetailRow label="Data aplicare" value={formatDate(activitate.data_aplicare)} />
              {activitate.id_activitate ? <DetailRow label="ID activitate" value={activitate.id_activitate} /> : null}
            </div>
          </div>

          <div className={DIALOG_DETAIL_FOOTER_CLASS}>
            <Button
              type="button"
              variant="outline"
              className="agri-cta border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteMutation.isPending}
            >
              🗑️ Șterge
            </Button>

            <Button
              type="button"
              variant="outline"
              className="agri-cta bg-amber-500 text-white hover:bg-amber-600 border-amber-600 dark:border-amber-500"
              onClick={() => setEditOpen(true)}
            >
              ✏️ Editează
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editOpen ? (
        <EditActivitateAgricolaDialog
          activitate={activitate}
          open={editOpen}
          onOpenChange={(next) => {
            setEditOpen(next)
            if (!next) {
              queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
              hapticSuccess()
            }
          }}
        />
      ) : null}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi activitatea?</AlertDialogTitle>
            <AlertDialogDescription>
              Activitatea &quot;{activitate.tip_activitate || 'Activitate'}&quot; din {formatDate(activitate.data_aplicare)} va fi ștearsă definitiv.
              Această acțiune este ireversibilă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nu, renunț</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(activitate.id)}
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

