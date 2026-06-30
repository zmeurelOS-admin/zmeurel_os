'use client'

import { Button } from '@/components/ui/button'
import type { ImportPreview, ImportProgress } from '@/components/clienti/import-types'

interface ClientImportPreviewPanelProps {
  importPreview: ImportPreview
  importingCsv: boolean
  importProgress: ImportProgress | null
  onConfirmImport: () => void
  onCancel: () => void
}

export function ClientImportPreviewPanel({
  importPreview,
  importingCsv,
  importProgress,
  onConfirmImport,
  onCancel,
}: ClientImportPreviewPanelProps) {
  return (
    <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--status-success-text)]">
          {importPreview.totalParsed} contacte găsite
          {importPreview.skippedNoName > 0
            ? `, ${importPreview.rows.length} cu nume valid, ${importPreview.skippedNoName} fără nume (vor fi sărite)`
            : `, ${importPreview.rows.length} cu nume valid`}
        </p>
        {!importPreview.hasPhoneColumn ? (
          <p className="text-xs font-medium text-amber-700">⚠️ Nu s-a detectat coloana de telefon</p>
        ) : null}
        {importPreview.formulaFixCount > 0 ? (
          <p className="text-xs font-medium text-[var(--status-info-text)]">
            ℹ️ {importPreview.formulaFixCount} {importPreview.formulaFixCount === 1 ? 'contact are' : 'contacte au'} nume
            din formulă Excel — s-a folosit coloana &quot;First Name&quot;
          </p>
        ) : null}
      </div>

      {importPreview.mappingSummary.length > 0 ? (
        <div className="space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--status-success-text)]">Coloane detectate</p>
          {importPreview.mappingSummary.map((line) => (
            <p key={line} className="text-xs text-[var(--status-success-text)]">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {importPreview.unmappedColumns.length > 0 ? (
        <div className="space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Coloane nerecunoscute (ignorate)</p>
          <p className="text-xs text-[var(--text-tertiary)]">{importPreview.unmappedColumns.join(', ')}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--status-success-text)]">Primele rânduri</p>
        {importPreview.rows.slice(0, 5).map((row, i) => (
          <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--status-success-text)]">
            <span className="font-semibold">{row.nume_client}</span>
            {row.telefon ? <span className="text-[var(--status-success-text)]">{row.telefon}</span> : null}
            {row.email ? <span className="text-[var(--status-success-text)]">{row.email}</span> : null}
            {row.adresa ? <span className="text-[var(--status-success-text)]">{row.adresa}</span> : null}
          </div>
        ))}
        {importPreview.rows.length > 5 ? (
          <p className="text-xs text-[var(--status-success-text)]">...și încă {importPreview.rows.length - 5} contacte</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-[var(--cta-recoltare-bg)] text-white hover:opacity-90"
          onClick={onConfirmImport}
          disabled={importingCsv || !importPreview.rows.length}
        >
          {importProgress
            ? importProgress.phase === 'ids'
              ? `Pregătire ${importProgress.done}/${importProgress.total}...`
              : `Import ${importProgress.done}/${importProgress.total}...`
            : importingCsv
              ? 'Se importă...'
              : `Importă ${importPreview.rows.length} contacte`}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={importingCsv}>
          Anulează
        </Button>
      </div>
    </div>
  )
}
