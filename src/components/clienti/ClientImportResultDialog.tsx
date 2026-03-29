'use client'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'
import type { ImportResult } from '@/components/clienti/import-types'

interface ClientImportResultDialogProps {
  open: boolean
  result: ImportResult | null
  showFailedRows: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  onToggleFailedRows: () => void
}

export function ClientImportResultDialog({
  open,
  result,
  showFailedRows,
  onOpenChange,
  onClose,
  onToggleFailedRows,
}: ClientImportResultDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import finalizat!"
      footer={
        <Button type="button" onClick={onClose}>
          OK
        </Button>
      }
    >
      {result ? (
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-emerald-700">
              <span className="text-base">✅</span>
              <span>
                <strong>{result.imported}</strong> clienți importați
              </span>
            </p>
            {result.skippedNoName > 0 ? (
              <p className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                <span className="text-base">⏭️</span>
                <span>
                  <strong>{result.skippedNoName}</strong> fără nume — săriți
                </span>
              </p>
            ) : null}
            {result.skippedDuplicate > 0 ? (
              <p className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                <span className="text-base">⏭️</span>
                <span>
                  <strong>{result.skippedDuplicate}</strong> {result.skippedDuplicate === 1 ? 'duplicat' : 'duplicate'} — sărite
                </span>
              </p>
            ) : null}
            {result.failed > 0 ? (
              <p className="flex items-center gap-2 text-red-600">
                <span className="text-base">❌</span>
                <span>
                  <strong>{result.failed}</strong> erori
                </span>
              </p>
            ) : null}
          </div>
          {result.failed > 0 ? (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-[var(--agri-primary)] underline-offset-2 hover:underline"
                onClick={onToggleFailedRows}
              >
                {showFailedRows ? 'Ascunde detalii' : 'Vezi detalii erori'}
              </button>
              {showFailedRows ? (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {result.failedRows.map((row, index) => (
                    <p key={index}>
                      <strong>{row.name}</strong>: {row.error}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </AppDialog>
  )
}
