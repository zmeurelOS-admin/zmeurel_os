'use client'

import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import {
  AlertCircle,
  Bug,
  Calendar,
  Camera,
  Check,
  MapPin,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { montaCapcanaAction } from '@/app/(dashboard)/tratamente/capcane/actions'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { withPlaceholderOption } from '@/lib/ui/app-select-utils'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { deleteCapcanaPhoto, uploadCapcanaPhoto, validateCapcanaPhoto, type UploadedCapcanaPhoto } from '@/lib/tratamente/capcane-photo-upload'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { TIPURI_CAPCANA, TIP_CAPCANA_LABEL_RO, type TipCapcana } from '@/types/tratamente-metode'

export type MarkCapcanaSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelaId?: string
  parcele: Array<{ id: string; nume_parcela: string; suprafata_ha: number | null }>
  fenofazaCurenta?: string | null
  onSuccess?: () => void
}

const DROSOPHILA_FENOFaze = new Set(['legare_fruct', 'fruct_verde', 'parga', 'maturitate'])

const TIP_CAPCANA_META: Record<
  TipCapcana,
  { subtitle: string; recommendedSubtitle?: string; tone?: 'dim' | 'default' }
> = {
  drosophila_otet: {
    subtitle: 'Monitorizare Drosophila suzukii',
    recommendedSubtitle: 'Recomandat la apropiere de coacere',
  },
  lipicioasa_galbena: {
    subtitle: 'Monitorizare afide și muscă albă',
  },
  lipicioasa_albastra: {
    subtitle: 'Monitorizare trips',
  },
  feromonala: {
    subtitle: 'Specific viță',
    tone: 'dim',
  },
  altul: {
    subtitle: 'Alt tip de monitorizare',
  },
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function parseDateOnly(value: string): Date {
  return parseISO(`${value}T00:00:00`)
}

function getDefaultParcelaId(
  parcelaId: string | undefined,
  parcele: MarkCapcanaSheetProps['parcele']
): string {
  if (parcelaId) return parcelaId
  if (parcele.length === 1) return parcele[0]?.id ?? ''
  return ''
}

function getRecommendedVerificationDate(
  dataMontare: string,
  tipCapcana: TipCapcana
): string {
  const baseDate = parseDateOnly(dataMontare)
  const days =
    tipCapcana === 'drosophila_otet'
      ? 4
      : tipCapcana === 'feromonala'
        ? 14
        : 7

  return toIsoDate(addDays(baseDate, days))
}

function getDensityTone(density: number): {
  label: string
  className: string
  iconClassName: string
} {
  if (density < 5) {
    return {
      label: 'Subdens — recomandat mai multe',
      className:
        'border-[color:color-mix(in_srgb,var(--status-warning-text)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--status-warning-text)_8%,white)] text-[var(--status-warning-text)]',
      iconClassName: 'text-[var(--status-warning-text)]',
    }
  }

  if (density > 20) {
    return {
      label: 'Densitate ridicată — OK pentru risc mare',
      className:
        'border-[color:color-mix(in_srgb,var(--status-info-text,var(--brand-blue))_22%,transparent)] bg-[color:color-mix(in_srgb,var(--status-info-text,var(--brand-blue))_8%,white)] text-[var(--status-info-text,var(--brand-blue))]',
      iconClassName: 'text-[var(--status-info-text,var(--brand-blue))]',
    }
  }

  return {
    label: 'OK',
    className:
      'border-[color:color-mix(in_srgb,var(--status-success-text)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--status-success-text)_8%,white)] text-[var(--status-success-text)]',
    iconClassName: 'text-[var(--status-success-text)]',
  }
}

export function MarkCapcanaSheet({
  open,
  onOpenChange,
  parcelaId,
  parcele,
  fenofazaCurenta,
  onSuccess,
}: MarkCapcanaSheetProps) {
  const { tenantId } = useDashboardAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const shouldKeepUploadedPhotoRef = useRef(false)
  const [selectedParcelaId, setSelectedParcelaId] = useState(() => getDefaultParcelaId(parcelaId, parcele))
  const [tipCapcana, setTipCapcana] = useState<TipCapcana>('drosophila_otet')
  const [nrBucati, setNrBucati] = useState(4)
  const [dataMontare, setDataMontare] = useState(() => toIsoDate(new Date()))
  const [dataUrmatoareaVerificare, setDataUrmatoareaVerificare] = useState(() =>
    getRecommendedVerificationDate(toIsoDate(new Date()), 'drosophila_otet')
  )
  const [nextVerificationTouched, setNextVerificationTouched] = useState(false)
  const [observatii, setObservatii] = useState('')
  const [photo, setPhoto] = useState<UploadedCapcanaPhoto | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const shouldRecommendDrosophila = DROSOPHILA_FENOFaze.has(fenofazaCurenta ?? '')
  const selectedParcela = useMemo(
    () => parcele.find((parcela) => parcela.id === selectedParcelaId) ?? null,
    [parcele, selectedParcelaId]
  )
  const parcelaAppSelectOptions = useMemo(
    () =>
      withPlaceholderOption(
        parcele.map((parcela) => ({
          value: parcela.id,
          label: parcela.nume_parcela,
          emoji: '📍',
        })),
        { value: '', label: 'Alege parcela' }
      ),
    [parcele]
  )

  useEffect(() => {
    if (!open) return

    const initialDate = toIsoDate(new Date())
    setSelectedParcelaId(getDefaultParcelaId(parcelaId, parcele))
    setTipCapcana('drosophila_otet')
    setNrBucati(4)
    setDataMontare(initialDate)
    setDataUrmatoareaVerificare(getRecommendedVerificationDate(initialDate, 'drosophila_otet'))
    setNextVerificationTouched(false)
    setObservatii('')
    setPhoto(null)
    setSubmitting(false)
    setUploadingPhoto(false)
    setValidationError(null)
    shouldKeepUploadedPhotoRef.current = false
  }, [open, parcelaId, parcele])

  useEffect(() => {
    if (!open || nextVerificationTouched) return
    setDataUrmatoareaVerificare(getRecommendedVerificationDate(dataMontare, tipCapcana))
  }, [dataMontare, nextVerificationTouched, open, tipCapcana])

  const densitySummary = useMemo(() => {
    if (!selectedParcela?.suprafata_ha || selectedParcela.suprafata_ha <= 0) {
      return null
    }

    const density = nrBucati / selectedParcela.suprafata_ha
    return {
      density,
      tone: getDensityTone(density),
      suprafataLabel: selectedParcela.suprafata_ha.toFixed(1).replace(/\.0$/, ''),
    }
  }, [nrBucati, selectedParcela])

  const verificareSummary = useMemo(() => {
    const date = parseDateOnly(dataUrmatoareaVerificare)
    const days = differenceInCalendarDays(date, parseDateOnly(dataMontare))
    return `În ${days} zile · ${format(date, 'd MMMM yyyy', { locale: ro })}`
  }, [dataMontare, dataUrmatoareaVerificare])

  const cleanupPhoto = async (target: UploadedCapcanaPhoto | null) => {
    if (!target) return
    try {
      await deleteCapcanaPhoto(target.path)
    } catch {
      // best effort; nu blocăm închiderea sheet-ului
    }
  }

  const handleSheetOpenChange = (nextOpen: boolean) => {
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
        entityId: crypto.randomUUID(),
        file,
      })

      setPhoto(uploaded)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nu am putut urca fotografia capcanei.')
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    if (!photo) return
    const current = photo
    setPhoto(null)
    await cleanupPhoto(current)
  }

  const handleSubmit = async () => {
    if (!selectedParcelaId) {
      setValidationError('Alege parcela pe care ai montat capcanele.')
      return
    }

    if (!tipCapcana) {
      setValidationError('Alege tipul capcanei.')
      return
    }

    if (!Number.isFinite(nrBucati) || nrBucati <= 0) {
      setValidationError('Numărul de capcane trebuie să fie mai mare decât 0.')
      return
    }

    setValidationError(null)
    setSubmitting(true)

    try {
      const result = await montaCapcanaAction({
        parcelaId: selectedParcelaId,
        tipCapcana,
        nrBucati,
        dataMontare,
        dataUrmatoareaVerificare,
        observatii: observatii.trim() || undefined,
        fotoUrl: photo?.signedUrl,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      shouldKeepUploadedPhotoRef.current = true
      toast.success('Capcane montate')
      onSuccess?.()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-[28px] px-0 pb-6 sm:max-w-none">
        <SheetHeader className="border-b border-[var(--border-default)] px-4 pb-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-left text-xl text-[var(--text-primary)] [font-weight:750]">
                Pus capcane
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-[var(--text-secondary)]">
                Monitorizare dăunători
              </SheetDescription>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleSheetOpenChange(false)}>
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Închide</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto px-4 pt-4">
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Când</Label>
            <div className="rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <Calendar className="h-4 w-4 text-[var(--agri-primary)]" aria-hidden />
                <span className="font-semibold">Azi · {format(parseDateOnly(dataMontare), 'd MMMM yyyy', { locale: ro })}</span>
              </div>
              <AppDatePicker
                id="data-montare-capcana"
                placeholder="Selectează data"
                value={dataMontare}
                triggerClassName="mt-3 h-11"
                onChange={setDataMontare}
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="parcela-capcana" className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Parcelă
            </Label>
            <div className="rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <MapPin className="h-4 w-4 text-[var(--agri-primary)]" aria-hidden />
                <span className="font-semibold">{selectedParcela?.nume_parcela ?? 'Selectează parcela'}</span>
              </div>
              {selectedParcela?.suprafata_ha ? (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {selectedParcela.suprafata_ha.toFixed(1).replace(/\.0$/, '')} ha
                </p>
              ) : null}
              <AppSelect
                id="parcela-capcana"
                value={selectedParcelaId}
                options={parcelaAppSelectOptions}
                showSearchThreshold={8}
                triggerClassName="mt-3 h-[var(--agri-field-h)] rounded-[var(--agri-radius)] text-sm"
                onChange={setSelectedParcelaId}
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Tip capcană</Label>
            <div className="space-y-3">
              {TIPURI_CAPCANA.map((tip) => {
                const meta = TIP_CAPCANA_META[tip]
                const isRecommended = tip === 'drosophila_otet' && shouldRecommendDrosophila
                const checked = tipCapcana === tip

                return (
                  <label
                    key={tip}
                    className={cn(
                      'block cursor-pointer rounded-[20px] border p-4 transition active:scale-[0.985]',
                      checked
                        ? 'border-[color:color-mix(in_srgb,var(--agri-primary)_38%,white)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,white)] shadow-[0_12px_30px_rgba(13,155,92,0.08)]'
                        : 'border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]',
                      meta.tone === 'dim' ? 'opacity-60' : ''
                    )}
                  >
                    <input
                      type="radio"
                      name="tip-capcana"
                      className="sr-only"
                      aria-label={TIP_CAPCANA_LABEL_RO[tip]}
                      checked={checked}
                      onChange={() => setTipCapcana(tip)}
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
                          <p className="text-sm text-[var(--text-primary)] [font-weight:700]">
                            {TIP_CAPCANA_LABEL_RO[tip]}
                          </p>
                          {isRecommended ? (
                            <span className="rounded-full border border-[color:color-mix(in_srgb,var(--agri-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] px-2 py-0.5 text-[11px] font-semibold text-[var(--agri-primary)]">
                              Recomandat
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {isRecommended ? meta.recommendedSubtitle ?? meta.subtitle : meta.subtitle}
                        </p>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="nr-capcane" className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Câte capcane
            </Label>
            <div className="rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setNrBucati((value) => Math.max(1, value - 1))}
                  aria-label="Scade numărul de capcane"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </Button>
                <Input
                  id="nr-capcane"
                  type="number"
                  min={0}
                  max={100}
                  value={String(nrBucati)}
                  onChange={(event) => setNrBucati(Number(event.target.value))}
                  className="text-center text-lg [font-weight:700]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setNrBucati((value) => Math.min(100, value + 1))}
                  aria-label="Crește numărul de capcane"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
                <span className="text-sm text-[var(--text-secondary)]">buc</span>
              </div>

              {densitySummary ? (
                <div className={cn('mt-3 rounded-2xl border px-3 py-2 text-sm', densitySummary.tone.className)}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={cn('mt-0.5 h-4 w-4 shrink-0', densitySummary.tone.iconClassName)} aria-hidden />
                    <div>
                      <p>Densitate recomandată: 10/ha.</p>
                      <p>
                        Ai {nrBucati} buc pe {densitySummary.suprafataLabel} ha ={' '}
                        {densitySummary.density.toFixed(1)}/ha.
                      </p>
                      <p className="font-semibold">{densitySummary.tone.label}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Densitate recomandată: 10/ha pentru zmeur.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="urmatoarea-verificare" className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Următoarea verificare
            </Label>
            <div className="rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <Bug className="h-4 w-4 text-[var(--agri-primary)]" aria-hidden />
                <span className="font-semibold">{verificareSummary}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Memento push notification</p>
              <AppDatePicker
                id="urmatoarea-verificare"
                placeholder="Selectează data"
                value={dataUrmatoareaVerificare}
                triggerClassName="mt-3 h-11"
                onChange={(nextValue) => {
                  setNextVerificationTouched(true)
                  setDataUrmatoareaVerificare(nextValue)
                }}
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Foto montaj (opțional)</Label>
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
                    alt="Foto capcană încărcată"
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Fotografie încărcată</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleRemovePhoto}>
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
            <Label htmlFor="nota-capcana" className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Notă (opțional)
            </Label>
            <Textarea
              id="nota-capcana"
              value={observatii}
              onChange={(event) => setObservatii(event.target.value)}
              placeholder="Ex. la marginea sudică, lângă rândul 3"
            />
          </section>

          {validationError ? (
            <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--status-danger-text)_18%,transparent)] bg-[color:color-mix(in_srgb,var(--status-danger-text)_7%,white)] px-3 py-2 text-sm text-[var(--status-danger-text)]">
              {validationError}
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full bg-[var(--agri-primary)] text-white hover:bg-[var(--agri-primary)]/90"
            disabled={submitting || uploadingPhoto}
            onClick={handleSubmit}
          >
            Salvează montarea
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
