'use client'

import { useRef } from 'react'
import { FileText, UploadCloud } from 'lucide-react'

import { BigInput, BottomSheet, Button, CalendarPanel, Notice, Tile, TileGroup, kitText } from '@/components/kit'
import { ATESTAT_LABEL } from '@/lib/acte/atestat'
import { esteCertificat, type CampActe, type RandActe } from '@/lib/acte/stare'
import { LEGAL_TYPE_OPTIONS, type LegalDocsFormValues } from '@/lib/legal-docs/shared'
import { cn } from '@/lib/utils'

export const TITLU_RAND: Record<RandActe, string> = {
  ferma: 'Ferma',
  certificat: ATESTAT_LABEL,
  contact: 'Contact afișat',
  poza: 'Poza atestatului',
  confirmare: 'Confirmarea',
}

export interface ActeFoaieProps {
  rand: RandActe | null
  onClose: () => void
  values: LegalDocsFormValues
  /** Fără act salvat, nicio formă juridică nu apare aleasă până nu o atingi. */
  formaAleasa: boolean
  errors: Partial<Record<CampActe, string>>
  onChange: <K extends keyof LegalDocsFormValues>(field: K, value: LegalDocsFormValues[K]) => void
  /** Poza: încărcarea, la fel ca înainte (`/api/legal-docs/upload`). */
  uploading: boolean
  onUpload: (file: File) => void
  photoPreviewUrl: string | null
}

/** Foaia unui rând din Actele fermei, cu câmpurile lui. Ce scrii rămâne în ciornă până la „Salvează actele”. */
export function ActeFoaie({ rand, onClose, values, formaAleasa, errors, onChange, uploading, onUpload, photoPreviewUrl }: ActeFoaieProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const certificat = formaAleasa && esteCertificat(values.legal_type)
  const titlu = rand === 'poza' && formaAleasa && !esteCertificat(values.legal_type) ? 'Poza documentului' : rand ? TITLU_RAND[rand] : 'Actele fermei'
  const pdf = (photoPreviewUrl ?? values.certificate_photo_url).toLowerCase().includes('.pdf')

  let body = null
  if (rand === 'ferma') {
    body = (
      <div className="space-y-4">
        <div className="space-y-2">
          <p id="acte-forma" className={cn('font-semibold text-fg', kitText.secondary)}>
            Formă juridică
          </p>
          <TileGroup
            type="single"
            columns={2}
            value={formaAleasa ? values.legal_type : null}
            onValueChange={(value) => {
              if (value) onChange('legal_type', value as LegalDocsFormValues['legal_type'])
            }}
            aria-labelledby="acte-forma"
          >
            {LEGAL_TYPE_OPTIONS.map((option) => (
              <Tile key={option.value} size="sm" value={option.value} title={option.label} />
            ))}
          </TileGroup>
          {errors.legal_type ? (
            <p className={cn('font-semibold text-danger-text', kitText.helper)} role="alert">
              {errors.legal_type}
            </p>
          ) : null}
        </div>
        {formaAleasa && !certificat ? (
          <BigInput
            label="CUI / CIF"
            value={values.cui ?? ''}
            onChange={(event) => onChange('cui', event.target.value)}
            autoComplete="off"
            placeholder="ex. RO12345678"
            error={errors.cui}
          />
        ) : null}
        <BigInput
          label="Localitatea de origine a produselor"
          value={values.locality}
          onChange={(event) => onChange('locality', event.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          placeholder="ex. Rădăuți"
          error={errors.locality}
        />
      </div>
    )
  } else if (rand === 'certificat') {
    body = (
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <BigInput
            label="Numărul"
            value={values.certificate_number ?? ''}
            onChange={(event) => onChange('certificate_number', event.target.value)}
            autoComplete="off"
            placeholder="ex. 12345"
            error={errors.certificate_number}
          />
          <BigInput
            label="Seria"
            value={values.certificate_series ?? ''}
            onChange={(event) => onChange('certificate_series', event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ex. SV"
            error={errors.certificate_series}
          />
        </div>
        <div className="space-y-2">
          <p className={cn('font-semibold text-fg', kitText.secondary)}>Valabil până la</p>
          <CalendarPanel
            value={values.certificate_expiry?.trim() || null}
            onChange={(iso) => onChange('certificate_expiry', iso)}
            shortcuts={false}
          />
          {errors.certificate_expiry ? (
            <p className={cn('font-semibold text-danger-text', kitText.helper)} role="alert">
              {errors.certificate_expiry}
            </p>
          ) : null}
        </div>
      </div>
    )
  } else if (rand === 'contact') {
    body = (
      <div className="space-y-4">
        <BigInput
          label="Nume și prenume"
          value={values.full_name}
          onChange={(event) => onChange('full_name', event.target.value)}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="ex. Maria Popescu"
          error={errors.full_name}
        />
        <BigInput
          label="Telefon de contact"
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(event) => onChange('phone', event.target.value)}
          autoComplete="tel"
          placeholder="07xx xxx xxx"
          error={errors.phone}
          hint="Apare la magazin și la asociație, lângă produsele tale."
        />
      </div>
    )
  } else if (rand === 'poza') {
    body = (
      <div className="space-y-3">
        <p className={cn('text-fg-muted', kitText.secondary)}>JPG, PNG, WEBP sau PDF, cel mult 5 MB. Se păstrează privat, în spațiul fermei.</p>
        {values.certificate_photo_url ? (
          <div className="space-y-2 rounded-box border border-border bg-surface-muted p-3">
            <p className={cn('flex items-center gap-2 font-semibold text-fg', kitText.secondary)}>
              <FileText className="size-5" aria-hidden />
              Document încărcat
            </p>
            {photoPreviewUrl ? (
              pdf ? (
                <Button asChild variant="neutral" size="touch" className="w-full">
                  <a href={photoPreviewUrl} target="_blank" rel="noopener noreferrer">
                    Deschide documentul
                  </a>
                </Button>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreviewUrl} alt="Poza documentului" className="max-h-72 w-auto rounded-control border border-border object-contain" />
              )
            ) : null}
          </div>
        ) : (
          <Notice tone="warning" title="Nicio poză încă" />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.target.value = ''
          }}
        />
        <Button type="button" variant="neutral" size="touch-lg" className="w-full" loading={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? null : <UploadCloud aria-hidden />}
          {uploading ? 'Se încarcă…' : values.certificate_photo_url ? 'Încarcă altă poză' : 'Încarcă poza'}
        </Button>
        {errors.certificate_photo_url ? (
          <p className={cn('font-semibold text-danger-text', kitText.helper)} role="alert">
            {errors.certificate_photo_url}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <BottomSheet
      open={rand !== null && rand !== 'confirmare'}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={titlu}
      footer={
        <Button type="button" variant="primary" size="touch-lg" className="w-full" disabled={uploading} onClick={onClose}>
          Gata
        </Button>
      }
    >
      {body}
    </BottomSheet>
  )
}
