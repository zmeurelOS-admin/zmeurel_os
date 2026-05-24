'use client'

import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { AlertCircle, Camera, Check, Minus, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { verificaCapcanaAction } from '@/app/(dashboard)/tratamente/capcane/actions'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { deleteCapcanaPhoto, uploadCapcanaPhoto, validateCapcanaPhoto, type UploadedCapcanaPhoto } from '@/lib/tratamente/capcane-photo-upload'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { TIP_CAPCANA_LABEL_RO, type TipCapcana } from '@/types/tratamente-metode'

export type VerificaCapcanaSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  capcanaMontata: {
    id: string
    tipCapcana: TipCapcana
    nrBucati: number
    parcelaNume: string
    dataMontare: string
    nrCapturatiAnterior?: number
  }
  onSuccess?: () => void
}

const PRAGURI_ALERTA: Record<TipCapcana, number> = {
  drosophila_otet: 10,
  lipicioasa_galbena: 50,
  lipicioasa_albastra: 30,
  feromonala: 20,
  altul: 100,
}

const ACTIUNI: Array<{
  value: 'inlocuit' | 'curatat' | 'scos' | 'doar_observat'
  label: string
  hint?: string
}> = [
  { value: 'inlocuit', label: 'Înlocuit', hint: 'Recomandat' },
  { value: 'curatat', label: 'Curățat' },
  { value: 'scos', label: 'Scos definitiv' },
  { value: 'doar_observat', label: 'Doar observat' },
]

function parseDateOnly(value: string): Date {
  return parseISO(`${value}T00:00:00`)
}

export function VerificaCapcanaSheet({
  open,
  onOpenChange,
  capcanaMontata,
  onSuccess,
}: VerificaCapcanaSheetProps) {
  const { tenantId } = useDashboardAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const shouldKeepUploadedPhotoRef = useRef(false)
  const [nrCapturati, setNrCapturati] = useState(capcanaMontata.nrCapturatiAnterior ?? 0)
  const [actiune, setActiune] = useState<(typeof ACTIUNI)[number]['value']>('inlocuit')
  const [observatii, setObservatii] = useState('')
  const [photo, setPhoto] = useState<UploadedCapcanaPhoto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!open) return
    setNrCapturati(capcanaMontata.nrCapturatiAnterior ?? 0)
    setActiune('inlocuit')
    setObservatii('')
    setPhoto(null)
    setSubmitting(false)
    setUploadingPhoto(false)
    shouldKeepUploadedPhotoRef.current = false
  }, [capcanaMontata.id, capcanaMontata.nrCapturatiAnterior, open])

  const pragDepasit = nrCapturati > PRAGURI_ALERTA[capcanaMontata.tipCapcana]
  const zileDeLaMontare = useMemo(
    () => differenceInCalendarDays(new Date(), parseDateOnly(capcanaMontata.dataMontare)),
    [capcanaMontata.dataMontare]
  )

  const cleanupPhoto = async (target: UploadedCapcanaPhoto | null) => {
    if (!target) return
    try {
      await deleteCapcanaPhoto(target.path)
    } catch {
      // best effort
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !shouldKeepUploadedPhotoRef.current) {
      void cleanupPhoto(photo)
    }
    onOpenChange(nextOpen)
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!tenantId) {
      toast.error('Contextul fermei lipsește. Reîncarcă pagina și încearcă din nou.')
      event.target.value = ''
      return
    }

    const validationMessage = validateCapcanaPhoto(file)
    if (validationMessage) {
      toast.error(validationMessage)
      event.target.value = ''
      return
    }

    setUploadingPhoto(true)
    try {
      if (photo) {
        await cleanupPhoto(photo)
      }

      const uploaded = await uploadCapcanaPhoto({
        tenantId,
        entityId: capcanaMontata.id,
        file,
      })

      setPhoto(uploaded)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut urca fotografia verificării.')
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const result = await verificaCapcanaAction({
        capcanaMontataId: capcanaMontata.id,
        nrCapturati,
        actiune,
        pragDepasit,
        observatii: observatii.trim() || undefined,
        fotoUrl: photo?.signedUrl,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      shouldKeepUploadedPhotoRef.current = true
      toast.success('Verificare salvată')
      onSuccess?.()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[92dvh] rounded-t-[28px] px-0 pb-6 sm:max-w-none">
        <SheetHeader className="border-b border-[var(--border-default)] px-4 pb-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-left text-xl text-[var(--text-primary)] [font-weight:750]">
                Verifică capcane
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-[var(--text-secondary)]">
                {TIP_CAPCANA_LABEL_RO[capcanaMontata.tipCapcana]} · {capcanaMontata.parcelaNume}
              </SheetDescription>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleOpenChange(false)}>
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Închide</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto px-4 pt-4">
          <section className="rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Sumar capcană</p>
            <dl className="mt-3 space-y-2 text-sm text-[var(--text-primary)]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Tip</dt>
                <dd className="font-semibold">{TIP_CAPCANA_LABEL_RO[capcanaMontata.tipCapcana]}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Nr bucăți</dt>
                <dd className="font-semibold">{capcanaMontata.nrBucati}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Parcelă</dt>
                <dd className="font-semibold">{capcanaMontata.parcelaNume}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Montate</dt>
                <dd className="font-semibold">
                  {format(parseDateOnly(capcanaMontata.dataMontare), 'd MMMM yyyy', { locale: ro })} (acum {Math.max(zileDeLaMontare, 0)} zile)
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-2">
            <Label htmlFor="nr-capturati" className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Nr capturați total
            </Label>
            <div className="rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setNrCapturati((value) => Math.max(0, value - 1))}
                  aria-label="Scade numărul de capturați"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </Button>
                <Input
                  id="nr-capturati"
                  type="number"
                  min={0}
                  value={String(nrCapturati)}
                  onChange={(event) => setNrCapturati(Math.max(0, Number(event.target.value)))}
                  className="text-center text-lg [font-weight:700]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setNrCapturati((value) => value + 1)}
                  aria-label="Crește numărul de capturați"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              {pragDepasit ? (
                <div className="mt-3 rounded-2xl border border-[color:color-mix(in_srgb,var(--status-warning-text)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--status-warning-text)_8%,white)] px-3 py-2 text-sm text-[var(--status-warning-text)]">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <div>
                      <p className="font-semibold">Prag depășit (&gt;{PRAGURI_ALERTA[capcanaMontata.tipCapcana]} {TIP_CAPCANA_LABEL_RO[capcanaMontata.tipCapcana]})</p>
                      <p>Recomandat tratament</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Acțiune</Label>
            <div className="space-y-3">
              {ACTIUNI.map((option) => {
                const checked = actiune === option.value
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'block cursor-pointer rounded-[20px] border p-4 transition active:scale-[0.985]',
                      checked
                        ? 'border-[color:color-mix(in_srgb,var(--agri-primary)_38%,white)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,white)] shadow-[0_12px_30px_rgba(13,155,92,0.08)]'
                        : 'border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]'
                    )}
                  >
                    <input
                      type="radio"
                      name="actiune-capcana"
                      className="sr-only"
                      aria-label={option.label}
                      checked={checked}
                      onChange={() => setActiune(option.value)}
                    />
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          checked
                            ? 'border-[var(--agri-primary)] bg-[var(--agri-primary)] text-white'
                            : 'border-[var(--border-default)] bg-white text-transparent'
                        )}
                        aria-hidden
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-[var(--text-primary)] [font-weight:700]">{option.label}</p>
                          {option.hint ? (
                            <span className="text-xs text-[var(--text-secondary)]">{option.hint}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
            {capcanaMontata.tipCapcana === 'feromonala' && actiune === 'scos' ? (
              <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                Confirmă că ai consumat sezonul feromonal.
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Foto (opțional)</Label>
            <div className="rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="sr-only"
                onChange={handlePhotoChange}
              />
              {photo ? (
                <div className="flex items-start gap-3">
                  <img
                    src={photo.signedUrl}
                    alt="Foto verificare capcană încărcată"
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Fotografie încărcată</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const current = photo
                        setPhoto(null)
                        await cleanupPhoto(current)
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Șterge foto
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" aria-hidden />
                  {uploadingPhoto ? 'Se încarcă fotografia…' : 'Adaugă foto'}
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="nota-verificare-capcana" className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Notă (opțional)
            </Label>
            <Textarea
              id="nota-verificare-capcana"
              value={observatii}
              onChange={(event) => setObservatii(event.target.value)}
              placeholder="Ex. capcana din rândul 2 a fost înlocuită complet"
            />
          </section>

          <Button
            type="button"
            className="w-full bg-[var(--agri-primary)] text-white hover:bg-[var(--agri-primary)]/90"
            disabled={submitting || uploadingPhoto}
            onClick={handleSubmit}
          >
            Salvează verificarea
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
