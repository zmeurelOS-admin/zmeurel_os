'use client'

import { useState, useTransition } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AppCard } from '@/components/ui/app-card'
import { Progress } from '@/components/ui/progress'
import type { ParseResult } from '@/app/(dashboard)/tratamente/planuri/import/actions'
import { UploadDropzone } from './UploadDropzone'

const ACCEPTED_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_FILE_SIZE = 2 * 1024 * 1024

type UploadStepProps = {
  onParsed: (result: ParseResult) => void
}

function validateClientFile(file: File): string | null {
  const hasXlsxExtension = file.name.trim().toLowerCase().endsWith('.xlsx')
  if (!hasXlsxExtension) {
    return 'Fișierul trebuie să fie în format .xlsx.'
  }

  if (file.type && file.type !== ACCEPTED_MIME) {
    return 'Fișierul trebuie să fie un document Excel .xlsx valid.'
  }

  if (file.size > MAX_FILE_SIZE) {
    return 'Fișierul depășește limita de 2 MB.'
  }

  return null
}

export function UploadStep({ onParsed }: UploadStepProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState(0)
  const [isPending, startTransition] = useTransition()

  function handleFileSelected(file: File) {
    const validationError = validateClientFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      setProgressValue(0)
      return
    }

    setErrorMessage(null)
    setProgressValue(20)

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set('file', file)
        setProgressValue(70)

        const response = await fetch('/api/tratamente/import/parse', {
          method: 'POST',
          credentials: 'same-origin',
          body: formData,
        })

        const payload = (await response.json().catch(() => null)) as
          | ParseResult
          | { error?: { message?: string } }
          | null

        if (!response.ok) {
          throw new Error(
            payload &&
              typeof payload === 'object' &&
              'error' in payload &&
              payload.error?.message
              ? payload.error.message
              : 'Nu am putut interpreta fișierul Excel.'
          )
        }

        if (!payload || !('planuri' in payload)) {
          throw new Error('Răspuns invalid de la server.')
        }

        if (payload.planuri.length === 0) {
          throw new Error(
            payload.global_errors[0] ??
              'Fișierul nu conține foi de plan importabile.'
          )
        }

        setProgressValue(100)
        onParsed(payload)
      } catch (error) {
        setProgressValue(0)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Nu am putut interpreta fișierul Excel.'
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-lg [font-weight:700] text-[var(--text-primary)]">
            1. Încarcă fișierul Excel
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Descarcă template-ul, completează unul sau mai multe planuri și
            apoi încarcă fișierul pentru review.
          </p>
        </div>

        <UploadDropzone disabled={isPending} onFileSelected={handleFileSelected} />

        {isPending ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Se analizează fișierul și se detectează produsele...
            </div>
            <Progress value={progressValue} />
          </div>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fișierul nu a putut fi procesat</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </AppCard>

      <AppCard className="space-y-3 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
          Ce urmează după upload
        </h3>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>Detectăm fiecare plan pe baza numelui foii Excel.</li>
          <li>Validăm cultura, stadiile, dozele și liniile incomplete.</li>
          <li>Îți arătăm sugestii pentru produse necunoscute sau aproximative.</li>
        </ul>
      </AppCard>
    </div>
  )
}
