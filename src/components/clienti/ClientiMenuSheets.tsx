'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileUp } from 'lucide-react'

import { BigTextarea, BottomSheet, Button, Notice, ProgressBar, kitText } from '@/components/kit'
import {
  DEFAULT_WA_MESSAGE,
  downloadImportTemplate,
  importClients,
  parseClientFile,
  saveWhatsappMessage,
  type ImportPreview,
  type ImportProgress,
  type ImportResult,
} from '@/lib/clienti/import'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

// ─── Importă din fișier ────────────────────────────────────────────────────────

export interface ImportClientiSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Importul din Excel sau CSV: alegi fișierul, vezi ce s-a înțeles din el, apoi confirmi. */
export function ImportClientiSheet({ open, onOpenChange }: ImportClientiSheetProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  // La fiecare deschidere pornim de la alegerea fișierului.
  const [wasOpen, setWasOpen] = useState(false)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setPreview(null)
      setProgress(null)
      setResult(null)
      setError(null)
      setReading(false)
    }
  }

  const importing = progress !== null

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || reading || importing) return
    setReading(true)
    setError(null)
    try {
      setPreview(await parseClientFile(file))
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Nu am putut citi fișierul.')
    } finally {
      setReading(false)
    }
  }

  const confirm = async () => {
    if (!preview || importing) return
    setError(null)
    setProgress({ done: 0, total: preview.rows.length, phase: 'ids' })
    try {
      const outcome = await importClients(preview, setProgress)
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      setResult(outcome)
      setPreview(null)
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Clienții nu s-au salvat.')
    } finally {
      setProgress(null)
    }
  }

  let content: React.ReactNode
  if (result) {
    content = (
      <div className="space-y-4">
        <Notice tone={result.failed > 0 ? 'warning' : 'success'} title={`${result.imported} clienți importați`}>
          {[
            result.skippedDuplicate > 0 ? `${result.skippedDuplicate} existau deja` : null,
            result.skippedNoName > 0 ? `${result.skippedNoName} fără nume, săriți` : null,
            result.failed > 0 ? `${result.failed} nu s-au putut salva` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Toate rândurile au fost salvate.'}
        </Notice>
        {result.failedRows.length > 0 ? (
          <ul className={cn('space-y-1 text-fg', kitText.secondary)}>
            {result.failedRows.slice(0, 10).map((row, index) => (
              <li key={`${row.name}-${index}`}>
                <span className="font-semibold">{row.name}</span>: {row.error}
              </li>
            ))}
          </ul>
        ) : null}
        <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => onOpenChange(false)}>
          Gata
        </Button>
      </div>
    )
  } else if (preview) {
    content = (
      <div className="space-y-4">
        {error ? <Notice tone="danger" title={error} /> : null}
        <Notice tone="info" title={`${preview.rows.length} clienți găsiți în fișier`}>
          {[
            preview.skippedNoName > 0 ? `${preview.skippedNoName} rânduri fără nume vor fi sărite` : null,
            preview.hasPhoneColumn ? null : 'Nu am găsit o coloană de telefon',
          ]
            .filter(Boolean)
            .join(' · ') || 'Cei care există deja (același nume și telefon) sunt săriți.'}
        </Notice>

        <div className="space-y-1">
          <p className={cn('font-bold text-fg', kitText.secondary)}>Coloane recunoscute</p>
          <ul className={cn('space-y-0.5 text-fg-muted', kitText.secondary)}>
            {preview.mappingSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {preview.unmappedColumns.length > 0 ? (
            <p className={cn('text-fg-muted', kitText.helper)}>Ignorate: {preview.unmappedColumns.join(', ')}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <p className={cn('font-bold text-fg', kitText.secondary)}>Primele rânduri</p>
          <ul className="space-y-1.5">
            {preview.rows.slice(0, 4).map((row, index) => (
              <li key={`${row.nume_client}-${index}`} className={cn('rounded-control bg-surface-muted px-3 py-2 text-fg', kitText.secondary)}>
                <span className="font-semibold">{row.nume_client}</span>
                {[row.telefon, row.adresa].filter(Boolean).length > 0 ? ` · ${[row.telefon, row.adresa].filter(Boolean).join(' · ')}` : ''}
              </li>
            ))}
          </ul>
        </div>

        {progress ? (
          <ProgressBar
            label={progress.phase === 'ids' ? 'Verific dublurile' : 'Salvez clienții'}
            valueLabel={`${progress.done} din ${progress.total}`}
            value={progress.done}
            max={Math.max(progress.total, 1)}
          />
        ) : null}

        <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={importing} onClick={() => void confirm()}>
          {importing ? 'Se importă…' : `Importă ${preview.rows.length} clienți`}
        </Button>
        <Button type="button" variant="neutral" size="touch" className="w-full" disabled={importing} onClick={() => setPreview(null)}>
          Alege alt fișier
        </Button>
      </div>
    )
  } else {
    content = (
      <div className="space-y-4">
        {error ? <Notice tone="danger" title={error} /> : null}
        <p className={cn('text-fg', kitText.base)}>
          Excel (.xlsx) sau CSV, cu o coloană pentru nume. Telefonul, adresa, emailul și observațiile sunt opționale.
          Merge și exportul din Google Contacts.
        </p>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => void handleFile(event)} />
        <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={reading} onClick={() => inputRef.current?.click()}>
          <FileUp aria-hidden />
          Alege fișierul
        </Button>
        <Button
          type="button"
          variant="neutral"
          size="touch"
          className="w-full"
          onClick={() => {
            void downloadImportTemplate().catch(() => toast.error('Modelul nu s-a putut descărca.'))
          }}
        >
          <Download aria-hidden />
          Descarcă un fișier model
        </Button>
      </div>
    )
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        // Cât se importă, foaia nu se închide: rândurile ar rămâne pe jumătate, fără raport.
        if (!next && importing) return
        onOpenChange(next)
      }}
      title="Importă din fișier"
    >
      {content}
    </BottomSheet>
  )
}

// ─── Mesajul WhatsApp implicit ─────────────────────────────────────────────────

export interface WhatsappMessageSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
  onSaved: (message: string) => void
}

/** Mesajul trimis ca anunț patiseriilor și magazinelor (din fișa clientului). */
export function WhatsappMessageSheet({ open, onOpenChange, message, onSaved }: WhatsappMessageSheetProps) {
  const [draft, setDraft] = useState(message)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [wasOpen, setWasOpen] = useState(false)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setDraft(message)
      setError(null)
      setSaving(false)
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveWhatsappMessage(draft)
      onSaved(saved)
      toast.success('Mesaj salvat.')
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Mesajul nu s-a salvat.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mesajul WhatsApp implicit"
      description="Anunțul pe care îl trimiți patiseriilor și magazinelor, din fișa clientului."
    >
      <div className="space-y-4">
        {error ? <Notice tone="danger" title={error} /> : null}
        <BigTextarea
          label="Mesaj"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          maxLength={600}
          placeholder={DEFAULT_WA_MESSAGE}
        />
        <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={saving} onClick={() => void save()}>
          Salvează mesajul
        </Button>
        <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => setDraft(DEFAULT_WA_MESSAGE)}>
          Pune mesajul de bază
        </Button>
      </div>
    </BottomSheet>
  )
}
