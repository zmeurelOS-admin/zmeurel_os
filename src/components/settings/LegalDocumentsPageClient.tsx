'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, UploadCloud } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LEGAL_PRIVACY_HREF,
  LEGAL_TERMS_HREF,
  LEGAL_TYPE_LABELS,
  LEGAL_TYPE_OPTIONS,
  type FarmerLegalDocsRow,
  type LegalDocsStatus,
  type LegalDocsFormValues,
  isCertificateLegalType,
  legalDocsFormSchema,
} from '@/lib/legal-docs/shared'
import { formatPhoneDisplay } from '@/lib/utils/phone'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

type Props = {
  farmName: string | null
  initialDocument: FarmerLegalDocsRow | null
  initialSignedPhotoUrl: string | null
  initialStatus: LegalDocsStatus
}

function buildInitialFormState(document: FarmerLegalDocsRow | null): LegalDocsFormValues {
  return {
    full_name: document?.full_name ?? '',
    legal_type: document?.legal_type ?? 'certificat_producator',
    certificate_series: document?.certificate_series ?? '',
    certificate_number: document?.certificate_number ?? '',
    certificate_expiry: document?.certificate_expiry ?? '',
    locality: document?.locality ?? '',
    phone: document?.phone ?? '',
    certificate_photo_url: document?.certificate_photo_url ?? '',
    cui: document?.cui ?? '',
    accepted: Boolean(document?.legal_accepted_at),
  }
}

function statusTone(status: LegalDocsStatus) {
  if (status.complete) {
    return {
      wrapper: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
      title: 'Documente complete',
    }
  }

  return {
    wrapper: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    icon: <AlertTriangle className="h-5 w-5" aria-hidden />,
    title: 'Documente incomplete',
  }
}

export function LegalDocumentsPageClient({
  farmName,
  initialDocument,
  initialSignedPhotoUrl,
  initialStatus,
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [documentState, setDocumentState] = useState<FarmerLegalDocsRow | null>(initialDocument)
  const [status, setStatus] = useState<LegalDocsStatus>(initialStatus)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(initialSignedPhotoUrl)
  const [values, setValues] = useState<LegalDocsFormValues>(() => buildInitialFormState(initialDocument))
  const [uploading, setUploading] = useState(false)
  const [submitting, startSubmitTransition] = useTransition()
  const [errors, setErrors] = useState<Partial<Record<keyof LegalDocsFormValues, string>>>({})

  const isCertificate = isCertificateLegalType(values.legal_type)
  const acceptedAtLabel = documentState?.legal_accepted_at
    ? new Date(documentState.legal_accepted_at).toLocaleString('ro-RO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  const tone = useMemo(() => statusTone(status), [status])
  const isPdfPreview = photoPreviewUrl?.toLowerCase().includes('.pdf') || values.certificate_photo_url.toLowerCase().endsWith('.pdf')

  function updateField<K extends keyof LegalDocsFormValues>(field: K, nextValue: LegalDocsFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: nextValue }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/legal-docs/upload', {
        method: 'POST',
        body: formData,
      })

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { path: string; signedUrl: string | null }; error?: { message?: string } }
        | null

      if (!res.ok || !json?.ok || !json.data?.path) {
        throw new Error(json?.error?.message ?? 'Nu am putut încărca documentul.')
      }

      updateField('certificate_photo_url', json.data.path)
      setPhotoPreviewUrl(json.data.signedUrl ?? null)
      toast.success('Documentul a fost încărcat.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut încărca documentul.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    startSubmitTransition(async () => {
      setErrors({})

      const parsed = legalDocsFormSchema.safeParse(values)
      if (!parsed.success) {
        const nextErrors: Partial<Record<keyof LegalDocsFormValues, string>> = {}
        for (const issue of parsed.error.issues) {
          const field = issue.path[0]
          if (typeof field === 'string' && !(field in nextErrors)) {
            nextErrors[field as keyof LegalDocsFormValues] = issue.message
          }
        }
        setErrors(nextErrors)
        toast.error(parsed.error.issues[0]?.message ?? 'Completează câmpurile obligatorii.')
        return
      }

      const res = await fetch('/api/legal-docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean
            data?: {
              document: FarmerLegalDocsRow
              status: LegalDocsStatus & { summary: string }
            }
            error?: { message?: string }
          }
        | null

      if (!res.ok || !json?.ok || !json.data?.document) {
        const message = json?.error?.message ?? 'Nu am putut salva documentele legale.'
        toast.error(message)
        return
      }

      setDocumentState(json.data.document)
      setStatus(json.data.status)
      toast.success('Documentele legale au fost completate cu succes.')
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Documente legale"
          subtitle="Completează talonul legal al fermei pentru publicarea produselor în platformă."
          rightSlot={
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Înapoi la setări
              </Link>
            </Button>
          }
          expandRightSlotOnMobile
          stackMobileRightSlotBelowTitle
        />
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 px-0 py-3 md:py-4">
        <AppCard className="space-y-3">
          <div className={cn('rounded-2xl border p-4', tone.wrapper)}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{tone.icon}</div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">{tone.title}</p>
                <p className="text-sm">
                  {status.complete
                    ? 'Datele legale sunt complete și pot fi folosite public în vitrina Zmeurel OS.'
                    : status.missingFields.length > 0
                      ? `Lipsește: ${status.missingFields.join(', ')}.`
                      : 'Mai sunt date obligatorii de completat.'}
                </p>
                {status.isExpiringSoon && status.expiryDate ? (
                  <p className="text-sm font-medium">
                    Certificatul tău expiră pe{' '}
                    {new Date(`${status.expiryDate}T00:00:00`).toLocaleDateString('ro-RO', { dateStyle: 'long' })}.
                    Reînnoiește-l și actualizează data în platformă.
                  </p>
                ) : null}
                {status.isExpired && status.expiryDate ? (
                  <p className="text-sm font-medium">
                    Certificatul a expirat pe{' '}
                    {new Date(`${status.expiryDate}T00:00:00`).toLocaleDateString('ro-RO', { dateStyle: 'long' })}.
                    Actualizează documentul pentru a continua să vinzi.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 text-sm text-[var(--text-secondary)] md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Fermă</p>
              <p className="mt-1 font-medium text-[var(--text-primary)]">{farmName ?? 'Ferma curentă'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Telefon afișat</p>
              <p className="mt-1 font-medium text-[var(--text-primary)]">
                {values.phone.trim() ? formatPhoneDisplay(values.phone) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Ultima confirmare</p>
              <p className="mt-1 font-medium text-[var(--text-primary)]">{acceptedAtLabel ?? 'Nesemnată încă'}</p>
            </div>
          </div>
        </AppCard>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <AppCard className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="legal-full-name">Nume și prenume</Label>
                <Input
                  id="legal-full-name"
                  value={values.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  placeholder="Ex: Maria Popescu"
                />
                {errors.full_name ? <p className="text-xs text-[var(--status-danger-text)]">{errors.full_name}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal-type">Formă juridică</Label>
                <select
                  id="legal-type"
                  value={values.legal_type}
                  onChange={(e) => updateField('legal_type', e.target.value as LegalDocsFormValues['legal_type'])}
                  className="agri-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {LEGAL_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal-locality">Localitatea de origine a produselor</Label>
                <Input
                  id="legal-locality"
                  value={values.locality}
                  onChange={(e) => updateField('locality', e.target.value)}
                  placeholder="Ex: Rădăuți"
                />
                {errors.locality ? <p className="text-xs text-[var(--status-danger-text)]">{errors.locality}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal-phone">Telefon de contact</Label>
                <Input
                  id="legal-phone"
                  value={values.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  inputMode="tel"
                  placeholder="07xx xxx xxx"
                />
                {errors.phone ? <p className="text-xs text-[var(--status-danger-text)]">{errors.phone}</p> : null}
              </div>
            </div>

            <div
              className={cn(
                'overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] transition-all duration-200',
                isCertificate ? 'max-h-[420px] opacity-100' : 'max-h-[160px] opacity-100',
              )}
            >
              {isCertificate ? (
                <div className="grid gap-4 p-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="legal-series">Seria certificatului</Label>
                    <Input
                      id="legal-series"
                      value={values.certificate_series ?? ''}
                      onChange={(e) => updateField('certificate_series', e.target.value)}
                      placeholder="Ex: SV"
                    />
                    {errors.certificate_series ? (
                      <p className="text-xs text-[var(--status-danger-text)]">{errors.certificate_series}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legal-number">Numărul certificatului</Label>
                    <Input
                      id="legal-number"
                      value={values.certificate_number ?? ''}
                      onChange={(e) => updateField('certificate_number', e.target.value)}
                      placeholder="Ex: 12345"
                    />
                    {errors.certificate_number ? (
                      <p className="text-xs text-[var(--status-danger-text)]">{errors.certificate_number}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="legal-expiry">Data expirării vizei</Label>
                    <Input
                      id="legal-expiry"
                      type="date"
                      value={values.certificate_expiry ?? ''}
                      onChange={(e) => updateField('certificate_expiry', e.target.value)}
                    />
                    {errors.certificate_expiry ? (
                      <p className="text-xs text-[var(--status-danger-text)]">{errors.certificate_expiry}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="space-y-2">
                    <Label htmlFor="legal-cui">CUI / CIF</Label>
                    <Input
                      id="legal-cui"
                      value={values.cui ?? ''}
                      onChange={(e) => updateField('cui', e.target.value)}
                      placeholder="Ex: RO12345678"
                    />
                    {errors.cui ? <p className="text-xs text-[var(--status-danger-text)]">{errors.cui}</p> : null}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Foto certificat / document</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Încarcă JPG, PNG, WEBP sau PDF în bucket-ul privat al fermei.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:w-auto"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="h-4 w-4" aria-hidden />
                  {uploading ? 'Se încarcă...' : 'Încarcă document'}
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    void handleUpload(file)
                  }
                }}
              />

              {values.certificate_photo_url ? (
                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <FileText className="h-4 w-4" aria-hidden />
                    Document încărcat
                  </div>
                  <p className="mt-1 break-all text-xs text-[var(--text-secondary)]">{values.certificate_photo_url}</p>
                  {photoPreviewUrl ? (
                    <div className="mt-3">
                      {isPdfPreview ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                          <a href={photoPreviewUrl} target="_blank" rel="noopener noreferrer">
                            Deschide documentul
                          </a>
                        </Button>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoPreviewUrl}
                          alt="Previzualizare document legal"
                          className="max-h-72 w-auto rounded-xl border border-[var(--border-default)] object-contain"
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {errors.certificate_photo_url ? (
                <p className="text-xs text-[var(--status-danger-text)]">{errors.certificate_photo_url}</p>
              ) : null}
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4">
              <input
                type="checkbox"
                checked={values.accepted}
                onChange={(e) => updateField('accepted', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--border-default)]"
              />
              <span className="text-sm leading-relaxed text-[var(--text-secondary)]">
                Confirm că datele de identificare de mai sus sunt corecte și accept ca acestea să fie afișate public pe
                platforma Zmeurel OS, conform legislației în vigoare. Am citit și accept{' '}
                <Link href={LEGAL_TERMS_HREF} className="font-semibold text-[var(--brand-blue)] underline-offset-2 hover:underline">
                  Termenii și Condițiile
                </Link>{' '}
                și{' '}
                <Link
                  href={LEGAL_PRIVACY_HREF}
                  className="font-semibold text-[var(--brand-blue)] underline-offset-2 hover:underline"
                >
                  Politica de Confidențialitate
                </Link>
                .
              </span>
            </label>
            {errors.accepted ? <p className="text-xs text-[var(--status-danger-text)]">{errors.accepted}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                După salvare, datele se pot edita oricând din această pagină.
              </p>
              <Button type="button" className="w-full sm:w-auto" disabled={submitting || uploading} onClick={() => void handleSubmit()}>
                {submitting ? 'Se salvează...' : 'Salvează și continuă'}
              </Button>
            </div>
          </AppCard>

          <AppCard className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Rezumat public</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Așa va arăta baza legală a profilului tău în marketplace.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Nume afișat</p>
                <p className="mt-1 font-medium text-[var(--text-primary)]">{values.full_name.trim() || 'Nume lipsă'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Formă juridică</p>
                <p className="mt-1 font-medium text-[var(--text-primary)]">{LEGAL_TYPE_LABELS[values.legal_type]}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Localitate</p>
                <p className="mt-1 font-medium text-[var(--text-primary)]">{values.locality.trim() || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Telefon</p>
                <p className="mt-1 font-medium text-[var(--text-primary)]">
                  {values.phone.trim() ? formatPhoneDisplay(values.phone) : '—'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 text-sm text-[var(--text-secondary)]">
              {status.complete ? (
                <p>Produsele tale pot fi activate și listate în marketplace-ul Zmeurel OS.</p>
              ) : (
                <p>Produsele active și listarea în asociație rămân blocate până completezi toate câmpurile obligatorii.</p>
              )}
            </div>
          </AppCard>
        </div>
      </div>
    </AppShell>
  )
}
