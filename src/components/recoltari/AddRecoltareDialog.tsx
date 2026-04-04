'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { buildHarvestObservatii, getParcelaCropRows, type ParcelCropRow } from '@/lib/parcele/crop-config'
import { formatUnitateDisplayName, getUnitateTipLabel } from '@/lib/parcele/unitate'
import { queryKeys } from '@/lib/query-keys'
import { resolveRecoltareParcelaId } from '@/lib/recoltari/parcela-link'
import { calculatePauseStatus, getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { createRecoltare } from '@/lib/supabase/queries/recoltari'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

function todayInputValue(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
  return local.toISOString().slice(0, 10)
}

const schema = z.object({
  data: z
    .string()
    .min(1, 'Data este obligatorie')
    .refine((value) => value <= todayInputValue(), {
      message: 'Data recoltării nu poate fi în viitor',
    }),
  parcela_id: z.string().min(1, 'Parcela este obligatorie'),
  culegator_id: z.string().min(1, 'Culegătorul este obligatoriu'),
  harvest_crop_id: z.string().optional(),
  kg_cal1: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: 'Kg Cal 1 trebuie să fie >= 0',
    }),
  kg_cal2: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: 'Kg Cal 2 trebuie să fie >= 0',
    }),
  observatii: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface AddRecoltareDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  aiPrefill?: { parcela_id: string; parcela_label: string; cantitate_kg: string; data: string; observatii: string } | null
  onSuccessfulSave?: () => void
  hideTrigger?: boolean
}

const defaultValues = (): FormData => ({
  data: todayInputValue(),
  parcela_id: '',
  culegator_id: '',
  harvest_crop_id: '',
  kg_cal1: '',
  kg_cal2: '',
  observatii: '',
})

function toNumber(value: string | undefined): number {
  if (!value || value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function formatCropOptionLabel(crop: ParcelCropRow): string {
  const parts = [crop.culture, crop.variety].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Cultură nespecificată'
}

export function AddRecoltareDialog({
  open,
  onOpenChange,
  aiPrefill = null,
  onSuccessfulSave,
  hideTrigger = false,
}: AddRecoltareDialogProps) {
  void hideTrigger

  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)
  const appliedAiPrefillRef = useRef<string>('')
  const appliedAiParcelaHintRef = useRef<string>('')

  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(),
  })

  useEffect(() => {
    if (dialogOpen) {
      hasOpenedRef.current = true
      submittedRef.current = false
      trackEvent({ eventName: 'open_create_form', moduleName: 'recoltari', status: 'started' })
    } else if (hasOpenedRef.current && !submittedRef.current) {
      trackEvent({ eventName: 'form_abandoned', moduleName: 'recoltari', status: 'abandoned' })
    }
    if (!dialogOpen) {
      form.reset(defaultValues())
      appliedAiPrefillRef.current = ''
      appliedAiParcelaHintRef.current = ''
    }
  }, [dialogOpen, form])

  const { data: parcele = [], isLoading: isLoadingParcele, refetch: refetchParcele } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  useEffect(() => {
    if (!dialogOpen || parcele.length > 0) return
    void refetchParcele()
  }, [dialogOpen, parcele.length, refetchParcele])

  const { data: culegatori = [], isLoading: isLoadingCulegatori } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
  })

  const { data: activitati = [] } = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
  })

  const isInitialDataLoading =
    dialogOpen &&
    ((isLoadingParcele && parcele.length === 0) || (isLoadingCulegatori && culegatori.length === 0))

  const mutation = useMutation({
    mutationFn: createRecoltare,
    onSuccess: (result, variables) => {
      if (!result.success) {
        hapticError()
        toast.error(result.error)
        return
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.recoltari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
      submittedRef.current = true
      trackEvent({ eventName: 'create_success', moduleName: 'recoltari', status: 'success' })
      trackEvent('create_recoltare', 'recoltari', { source: 'AddRecoltareDialog' })
      track('recoltare_add', {
        kg: Number(variables.kg_cal1 || 0) + Number(variables.kg_cal2 || 0),
        parcela_id: variables.parcela_id ?? null,
      })
      hapticSuccess()
      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success('Recoltare adăugată')
      }
      setDialogOpen(false)
      onSuccessfulSave?.()
    },
    onError: (error: unknown) => {
      const maybeError = error as { status?: number; code?: string; message?: string }
      const conflict = maybeError?.status === 409 || maybeError?.code === '23505'
      if (conflict) {
        submittedRef.current = true
        toast.info('Înregistrarea era deja sincronizată.')
        setDialogOpen(false)
        onSuccessfulSave?.()
        return
      }
      trackEvent({ eventName: 'create_failed', moduleName: 'recoltari', status: 'failed' })
      hapticError()
      toast.error(maybeError?.message || 'Eroare la salvare')
    },
  })

  const selectedParcelaId = useWatch({ control: form.control, name: 'parcela_id' }) || ''
  const selectedCulegatorId = useWatch({ control: form.control, name: 'culegator_id' }) || ''
  const selectedCropId = useWatch({ control: form.control, name: 'harvest_crop_id' }) || ''
  const formDataValue = useWatch({ control: form.control, name: 'data' }) || ''
  const formObservatii = useWatch({ control: form.control, name: 'observatii' }) || ''
  const kgCal1 = toNumber(useWatch({ control: form.control, name: 'kg_cal1' }) || '')
  const kgCal2 = toNumber(useWatch({ control: form.control, name: 'kg_cal2' }) || '')
  const totalKg = kgCal1 + kgCal2
  const selectedParcela = useMemo(
    () => parcele.find((parcela) => parcela.id === selectedParcelaId) ?? null,
    [parcele, selectedParcelaId]
  )
  const parcelCropOptions = useMemo(() => getParcelaCropRows(selectedParcela), [selectedParcela])
  const selectedCrop =
    parcelCropOptions.find((crop) => crop.id === selectedCropId) ??
    (parcelCropOptions.length === 1 ? parcelCropOptions[0] : null)
  const selectedCulegator = useMemo(
    () => culegatori.find((culegator) => culegator.id === selectedCulegatorId),
    [culegatori, selectedCulegatorId]
  )
  const tarifLeiKg = Number(selectedCulegator?.tarif_lei_kg ?? 0)
  const hasValidTarif = Number.isFinite(tarifLeiKg) && tarifLeiKg > 0
  const valoareMunca = hasValidTarif ? totalKg * tarifLeiKg : null
  const pctCal1 = totalKg > 0 ? Math.round((kgCal1 / totalKg) * 100) : 0
  const pctCal2 = totalKg > 0 ? Math.round((kgCal2 / totalKg) * 100) : 0
  const parcelaAsideLabel = selectedParcela
    ? formatUnitateDisplayName(selectedParcela.nume_parcela, selectedParcela.tip_unitate, 'Parcelă')
    : '—'
  const dataAsideLabel = formDataValue
    ? new Date(formDataValue + 'T12:00:00').toLocaleDateString('ro-RO')
    : '—'

  useEffect(() => {
    if (!selectedParcela) {
      form.setValue('harvest_crop_id', '', { shouldDirty: false, shouldValidate: false })
      return
    }

    if (parcelCropOptions.length === 1) {
      form.setValue('harvest_crop_id', parcelCropOptions[0].id, {
        shouldDirty: false,
        shouldValidate: false,
      })
      return
    }

    if (selectedCropId && parcelCropOptions.some((crop) => crop.id === selectedCropId)) return

    form.setValue('harvest_crop_id', '', { shouldDirty: false, shouldValidate: false })
  }, [form, parcelCropOptions, selectedCropId, selectedParcela])

  const activePauseWarning = (() => {
    if (!selectedParcelaId) return null

    const parcelaActivitati = activitati.filter((act) => act.parcela_id === selectedParcelaId)
    if (parcelaActivitati.length === 0) return null

    for (const activitate of parcelaActivitati) {
      const { dataRecoltarePermisa, status } = calculatePauseStatus(
        activitate.data_aplicare,
        activitate.timp_pauza_zile,
      )

      if (status === 'Pauza') {
        const parcelaName = formatUnitateDisplayName(
          selectedParcela?.nume_parcela,
          selectedParcela?.tip_unitate,
          'Parcela selectată',
        )
        const dataAplicare = new Date(activitate.data_aplicare).toLocaleDateString('ro-RO')
        const dataPermisa = new Date(dataRecoltarePermisa).toLocaleDateString('ro-RO')

        return {
          message: `Parcelă ${parcelaName} are tratament activ (${activitate.produs_utilizat || 'produs necunoscut'}, aplicat ${dataAplicare}). Recoltare permisă de la ${dataPermisa}.`,
        }
      }
    }

    return null
  })()

  useEffect(() => {
    if (!dialogOpen || !aiPrefill) return

    const signature = JSON.stringify(aiPrefill)
    if (appliedAiPrefillRef.current === signature) return
    appliedAiPrefillRef.current = signature
    appliedAiParcelaHintRef.current = aiPrefill.parcela_id ? signature : ''

    if (aiPrefill.data && /^\d{4}-\d{2}-\d{2}$/.test(aiPrefill.data)) {
      form.setValue('data', aiPrefill.data, { shouldDirty: false, shouldValidate: false })
    }

    if (aiPrefill.cantitate_kg) {
      const parsedQty = Number(aiPrefill.cantitate_kg.replace(',', '.'))
      if (Number.isFinite(parsedQty) && parsedQty > 0) {
        form.setValue('kg_cal1', String(parsedQty), { shouldDirty: false, shouldValidate: false })
        form.setValue('kg_cal2', '', { shouldDirty: false, shouldValidate: false })
      }
    }

    const resolvedParcelaId = resolveRecoltareParcelaId({
      parcelaId: aiPrefill.parcela_id,
      parcelaLabel: aiPrefill.parcela_label,
      parcele,
    })
    if (resolvedParcelaId) {
      form.setValue('parcela_id', resolvedParcelaId, { shouldDirty: false, shouldValidate: false })
    } else if (aiPrefill.parcela_id) {
      // Invalid legacy id hint should not force a wrong association.
      form.setValue('parcela_id', '', { shouldDirty: false, shouldValidate: false })
    }
    if (aiPrefill.observatii) {
      form.setValue('observatii', aiPrefill.observatii, { shouldDirty: false, shouldValidate: false })
    }
  }, [aiPrefill, dialogOpen, form, parcele])

  useEffect(() => {
    if (!dialogOpen || !aiPrefill?.parcela_label || aiPrefill.parcela_id) return

    const signature = JSON.stringify(aiPrefill)
    if (appliedAiParcelaHintRef.current === signature) return
    if (parcele.length === 0) return

    const parcelaId = resolveRecoltareParcelaId({
      parcelaLabel: aiPrefill.parcela_label,
      parcele,
    })
    if (parcelaId) {
      form.setValue('parcela_id', parcelaId, { shouldDirty: false, shouldValidate: false })
    }
    appliedAiParcelaHintRef.current = signature
  }, [aiPrefill, dialogOpen, form, parcele])

  const onSubmit = (data: FormData) => {
    if (mutation.isPending) return

    if (!hasValidTarif) {
      hapticError()
      toast.error('Culegătorul nu are tarif setat în profil')
      return
    }

    if (parcelCropOptions.length > 1 && !selectedCrop) {
      hapticError()
      toast.error('Selectează cultura recoltată din parcela aleasă.')
      return
    }

    mutation.mutate({
      data: data.data,
      parcela_id: data.parcela_id,
      culegator_id: data.culegator_id,
      kg_cal1: toNumber(data.kg_cal1),
      kg_cal2: toNumber(data.kg_cal2),
      observatii:
        buildHarvestObservatii(
          data.observatii?.trim() || undefined,
          selectedCrop
            ? {
                cropId: selectedCrop.id,
                culture: selectedCrop.culture,
                variety: selectedCrop.variety,
              }
            : null,
        ) || undefined,
    })
  }

  const handleClose = () => {
    if (mutation.isPending) return
    setDialogOpen(false)
  }

  return (
    <AppDrawer
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      title="Adaugă recoltare"
      desktopFormWide
      contentClassName="lg:max-w-[min(94vw,72rem)] xl:max-w-[min(92vw,76rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={handleClose}
          onSave={form.handleSubmit(onSubmit)}
          saving={mutation.isPending}
          disabled={isInitialDataLoading}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      {isInitialDataLoading ? <DialogInitialDataSkeleton /> : (
      <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_min(272px,32%)] md:items-start md:gap-6 lg:gap-8">
          <div className="min-w-0 space-y-4 md:space-y-6">
            <FormDialogSection label="Context">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recoltare_parcela">Parcelă</Label>
                  <Select
                    value={selectedParcelaId || '__none'}
                    onValueChange={(value) =>
                      form.setValue('parcela_id', value === '__none' ? '' : value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id="recoltare_parcela" className="agri-control h-12 md:h-11">
                      <SelectValue placeholder="Selectează parcelă" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Selectează parcelă</SelectItem>
                      {parcele.map((parcela) => (
                        <SelectItem key={parcela.id} value={parcela.id}>
                          {parcela.nume_parcela || 'Parcela'} ({getUnitateTipLabel(parcela.tip_unitate)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.parcela_id ? (
                    <p className="text-xs text-red-600">{form.formState.errors.parcela_id.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recoltare_data">Data</Label>
                  <Input
                    id="recoltare_data"
                    type="date"
                    className="agri-control h-12 md:h-11"
                    {...form.register('data')}
                  />
                  {form.formState.errors.data ? (
                    <p className="text-xs text-red-600">{form.formState.errors.data.message}</p>
                  ) : null}
                </div>
              </div>
              {activePauseWarning ? (
                <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-sm text-[var(--status-warning-text)]">
                  {activePauseWarning.message}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="recoltare_culegator">Culegător</Label>
                <Select
                  value={selectedCulegatorId || '__none'}
                  onValueChange={(value) =>
                    form.setValue('culegator_id', value === '__none' ? '' : value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="recoltare_culegator" className="agri-control h-12 md:h-11">
                    <SelectValue placeholder="Selectează culegător" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Selectează culegător</SelectItem>
                    {culegatori.map((culegator) => (
                      <SelectItem key={culegator.id} value={culegator.id}>
                        {culegator.nume_prenume || 'Culegător'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.culegator_id ? (
                  <p className="text-xs text-red-600">{form.formState.errors.culegator_id.message}</p>
                ) : null}
              </div>
            </FormDialogSection>

            <FormDialogSection label="Recoltare">
              {selectedParcela ? (
                <Card className="rounded-2xl border border-[var(--surface-divider)] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Produs detectat din parcelă</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {parcelCropOptions.length > 1 ? (
                      <div className="space-y-2">
                        <Label htmlFor="recoltare_harvest_crop">Cultură recoltată</Label>
                        <Select
                          value={selectedCropId || '__none'}
                          onValueChange={(value) =>
                            form.setValue('harvest_crop_id', value === '__none' ? '' : value, {
                              shouldDirty: true,
                              shouldValidate: false,
                            })
                          }
                        >
                          <SelectTrigger id="recoltare_harvest_crop" className="agri-control h-11 md:h-10">
                            <SelectValue placeholder="Selectează cultura recoltată" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Selectează cultura recoltată</SelectItem>
                            {parcelCropOptions.map((crop) => (
                              <SelectItem key={crop.id} value={crop.id}>
                                {formatCropOptionLabel(crop)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    <p>
                      Produs:{' '}
                      <span className="font-semibold">{selectedCrop?.culture || 'Nespecificat'}</span>
                    </p>
                    <p>
                      Soi: <span className="font-semibold">{selectedCrop?.variety || 'Nespecificat'}</span>
                    </p>
                    <p className="text-xs text-[var(--agri-text-muted)]">
                      Stocul pentru această recoltare va folosi automat produsul și soiul alese din unitatea
                      selectată.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recoltare_kg_cal1">Kg Calitatea 1</Label>
                  <Input
                    id="recoltare_kg_cal1"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="agri-control h-12 md:h-11"
                    {...form.register('kg_cal1')}
                  />
                  {form.formState.errors.kg_cal1 ? (
                    <p className="text-xs text-red-600">{form.formState.errors.kg_cal1.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recoltare_kg_cal2">Kg Calitatea 2</Label>
                  <Input
                    id="recoltare_kg_cal2"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="agri-control h-12 md:h-11"
                    {...form.register('kg_cal2')}
                  />
                  {form.formState.errors.kg_cal2 ? (
                    <p className="text-xs text-red-600">{form.formState.errors.kg_cal2.message}</p>
                  ) : null}
                </div>
              </div>
            </FormDialogSection>

            <div className="md:hidden">
              <Card className="rounded-2xl border border-[var(--surface-divider)] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rezumat plată</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    Total kg: <span className="font-semibold">{totalKg.toFixed(2)} kg</span>
                  </p>
                  {selectedCulegator ? (
                    <>
                      <p>
                        Tarif:{' '}
                        <span className="font-semibold">
                          {hasValidTarif ? `${tarifLeiKg.toFixed(2)} lei/kg` : '—'}
                        </span>{' '}
                        <span className="text-xs text-[var(--agri-text-muted)]">(din profil culegător)</span>
                      </p>
                      <p>
                        De plată:{' '}
                        <span className="font-semibold">
                          {valoareMunca !== null ? `${valoareMunca.toFixed(2)} lei` : '—'}
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[var(--agri-text-muted)]">
                        Selectează culegătorul ca să calculez plata
                      </p>
                      <p>
                        De plată: <span className="font-semibold">—</span>
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <FormDialogSection label="Observații">
              <Textarea
                id="recoltare_observatii"
                rows={3}
                placeholder="Detalii suplimentare"
                className="agri-control min-h-[5rem] w-full px-3 py-2 text-base md:min-h-[6rem]"
                {...form.register('observatii')}
              />
            </FormDialogSection>
          </div>

          <aside className="hidden md:block md:sticky md:top-2 md:self-start">
            <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 shadow-[var(--shadow-soft)]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                  Rezumat live
                </p>
                <p className="mt-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
                  {parcelaAsideLabel}
                </p>
              </div>
              <dl className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data recoltării</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{dataAsideLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Culegător</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">
                    {selectedCulegator?.nume_prenume?.trim() || '—'}
                  </dd>
                </div>
                <div className="border-t border-[var(--divider)] pt-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cultură / soi</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">
                    {selectedCrop
                      ? `${selectedCrop.culture || '—'} · ${selectedCrop.variety || '—'}`
                      : '—'}
                  </dd>
                </div>
                <div className="border-t border-[var(--divider)] pt-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Total recoltat</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                    {totalKg.toFixed(2)} kg
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text-tertiary)]">Cal I</span>
                    <p className="font-medium tabular-nums text-[var(--text-primary)]">
                      {kgCal1.toFixed(2)} kg
                      {totalKg > 0 ? ` (${pctCal1}%)` : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Cal II</span>
                    <p className="font-medium tabular-nums text-[var(--text-primary)]">
                      {kgCal2.toFixed(2)} kg
                      {totalKg > 0 ? ` (${pctCal2}%)` : ''}
                    </p>
                  </div>
                </div>
                <div className="border-t border-[var(--divider)] pt-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tarif (profil)</dt>
                  <dd className="mt-0.5 tabular-nums text-[var(--text-primary)]">
                    {hasValidTarif ? `${tarifLeiKg.toFixed(2)} lei/kg` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">De plată (estim.)</dt>
                  <dd className="mt-1 text-base font-semibold tabular-nums text-[var(--text-primary)]">
                    {valoareMunca !== null ? `${valoareMunca.toFixed(2)} lei` : '—'}
                  </dd>
                </div>
              </dl>
              {String(formObservatii).trim() ? (
                <div className="border-t border-[var(--divider)] pt-3">
                  <p className="text-xs font-medium text-[var(--text-tertiary)]">Observații</p>
                  <p className="mt-1 max-h-24 overflow-y-auto text-xs leading-relaxed text-[var(--text-secondary)]">
                    {String(formObservatii).trim().length > 200
                      ? `${String(formObservatii).trim().slice(0, 200)}…`
                      : String(formObservatii).trim()}
                  </p>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </form>
      )}
    </AppDrawer>
  )
}
