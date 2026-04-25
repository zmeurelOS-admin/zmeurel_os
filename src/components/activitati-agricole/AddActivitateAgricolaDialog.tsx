'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Droplets, FlaskConical, Leaf, Scissors, SprayCan, Sprout, TreePine, Warehouse } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { ActivityTypeCombobox } from '@/components/activitati-agricole/ActivityTypeCombobox'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import {
  type ActivityOption,
  getActivityOptionsForUnitate,
  isTipActivitateDeprecata,
  withCurrentActivityOption,
} from '@/lib/activitati/activity-options'
import { generateClientId } from '@/lib/offline/generateClientId'
import { createActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

const schema = z.object({
  data_aplicare: z.string().min(1, 'Data este obligatorie'),
  parcela_id: z.string().optional(),
  tip_activitate: z.string().min(1, 'Tipul activității este obligatoriu'),
  produs_utilizat: z.string().optional(),
  doza: z.string().optional(),
  timp_pauza_zile: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: 'Timpul de pauză trebuie să fie un număr valid',
    }),
  observatii: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface AddActivitateAgricolaDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  defaultTipActivitate?: string
  defaultParcelaId?: string
  contextParcelaLabel?: string
  aiPrefill?: {
    tip: string
    parcela_id: string
    parcela_label: string
    produs: string
    doza: string
    data: string
    observatii: string
  } | null
}

const defaults = (): FormValues => ({
  data_aplicare: new Date().toISOString().split('T')[0],
  parcela_id: '',
  tip_activitate: '',
  produs_utilizat: '',
  doza: '',
  timp_pauza_zile: '0',
  observatii: '',
})

function normalizeForExactMatch(value: string): string {
  return value.trim().toLowerCase()
}

function resolveParcelaIdFromHint(
  hint: string,
  parcele: Array<{
    id: string
    nume_parcela?: string | null
    soi_plantat?: string | null
    soi?: string | null
    cultura?: string | null
    tip_fruct?: string | null
  }>
): string | null {
  const normalizedHint = normalizeForExactMatch(hint)
  if (!normalizedHint) return null
  const exactIds = Array.from(
    new Set(
      parcele
        .filter((parcela) => normalizeForExactMatch(parcela.nume_parcela ?? '') === normalizedHint)
        .map((parcela) => parcela.id)
    )
  )
  if (exactIds.length === 1) return exactIds[0]
  return null
}

function normalizeUnitType(value: string | null | undefined): 'solar' | 'livada' | 'camp' | 'other' {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!normalized) return 'other'
  if (normalized.includes('solar') || normalized.includes('sera')) return 'solar'
  if (normalized.includes('livada') || normalized.includes('livad')) return 'livada'
  if (normalized.includes('camp') || normalized.includes('cultura')) return 'camp'
  return 'other'
}

function getUnitIcon(tipUnitate: string | null | undefined) {
  const unitType = normalizeUnitType(tipUnitate)
  if (unitType === 'solar') {
    return <Warehouse className="h-3.5 w-3.5 text-[var(--status-info-text)]" aria-hidden />
  }
  if (unitType === 'livada') {
    return <TreePine className="h-3.5 w-3.5 text-[var(--status-success-text)]" aria-hidden />
  }
  if (unitType === 'camp') {
    return <Sprout className="h-3.5 w-3.5 text-[var(--status-warning-text)]" aria-hidden />
  }
  return <Sprout className="h-3.5 w-3.5 text-[var(--agri-text-muted)]" aria-hidden />
}

function getActivityIcon(option: ActivityOption) {
  const source = normalizeForExactMatch(`${option.label} ${option.value}`)
  if (source.includes('irig')) {
    return <Droplets className="h-3.5 w-3.5 text-[var(--status-info-text)]" aria-hidden />
  }
  if (source.includes('recolt') || source.includes('cules')) {
    return <Sprout className="h-3.5 w-3.5 text-[var(--status-success-text)]" aria-hidden />
  }
  if (source.includes('tai') || source.includes('prun')) {
    return <Scissors className="h-3.5 w-3.5 text-[var(--status-warning-text)]" aria-hidden />
  }
  if (source.includes('mulc')) {
    return <Leaf className="h-3.5 w-3.5 text-[var(--status-success-text)]" aria-hidden />
  }
  if (source.includes('fert') || source.includes('ingras') || source.includes('nutrit')) {
    return <FlaskConical className="h-3.5 w-3.5 text-[var(--status-info-text)]" aria-hidden />
  }
  if (
    source.includes('trat') ||
    source.includes('strop') ||
    source.includes('fitosan') ||
    source.includes('erbicid') ||
    source.includes('fungicid') ||
    source.includes('insecticid')
  ) {
    return <SprayCan className="h-3.5 w-3.5 text-[var(--status-warning-text)]" aria-hidden />
  }
  return <Leaf className="h-3.5 w-3.5 text-[var(--agri-text-muted)]" aria-hidden />
}

export function AddActivitateAgricolaDialog({
  open,
  onOpenChange,
  hideTrigger = false,
  defaultTipActivitate,
  defaultParcelaId,
  contextParcelaLabel,
  aiPrefill = null,
}: AddActivitateAgricolaDialogProps) {
  void hideTrigger

  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const previousParcelaIdRef = useRef<string>('')
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)
  const appliedAiPrefillRef = useRef<string>('')
  const [terrainMenuOpen, setTerrainMenuOpen] = useState(false)

  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })

  useEffect(() => {
    if (dialogOpen) {
      hasOpenedRef.current = true
      submittedRef.current = false
      trackEvent({ eventName: 'open_create_form', moduleName: 'activitati', status: 'started' })
    } else if (hasOpenedRef.current && !submittedRef.current) {
      trackEvent({ eventName: 'form_abandoned', moduleName: 'activitati', status: 'abandoned' })
    }
    if (!dialogOpen) {
      appliedAiPrefillRef.current = ''
      form.reset(defaults())
    }
  }, [dialogOpen, form])

  const { data: parcele = [], isLoading: isLoadingParcele } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const isInitialDataLoading = dialogOpen && isLoadingParcele && parcele.length === 0

  const selectedParcelaId = useWatch({ control: form.control, name: 'parcela_id' }) || ''
  const selectedTip = useWatch({ control: form.control, name: 'tip_activitate' }) || ''
  const selectedParcela = useMemo(
    () => parcele.find((parcela) => parcela.id === selectedParcelaId),
    [parcele, selectedParcelaId]
  )
  const contextParcela = useMemo(() => {
    if (selectedParcelaId) return selectedParcela
    if (!defaultParcelaId) return null
    return parcele.find((parcela) => parcela.id === defaultParcelaId) ?? null
  }, [defaultParcelaId, parcele, selectedParcela, selectedParcelaId])
  const drawerDescription = contextParcela?.nume_parcela
    ? `Parcela selectată: ${contextParcela.nume_parcela}`
    : contextParcelaLabel?.trim()
      ? `Parcela selectată: ${contextParcelaLabel.trim()}`
      : undefined
  const availableOptions = useMemo(
    () => getActivityOptionsForUnitate(selectedParcela?.tip_unitate),
    [selectedParcela?.tip_unitate]
  )
  const activityOptions = useMemo(
    () => withCurrentActivityOption(availableOptions, selectedTip),
    [availableOptions, selectedTip]
  )
  const selectedTerrain = useMemo(
    () => parcele.find((parcela) => parcela.id === selectedParcelaId) ?? null,
    [parcele, selectedParcelaId]
  )

  useEffect(() => {
    const previousParcelaId = previousParcelaIdRef.current
    if (!selectedParcelaId) {
      previousParcelaIdRef.current = selectedParcelaId
      return
    }
    if (!previousParcelaId || previousParcelaId === selectedParcelaId) {
      previousParcelaIdRef.current = selectedParcelaId
      return
    }

    const currentTip = form.getValues('tip_activitate')
    if (currentTip && !availableOptions.some((option) => option.value === currentTip)) {
      form.setValue('tip_activitate', '', { shouldDirty: true, shouldValidate: true })
    }

    previousParcelaIdRef.current = selectedParcelaId
  }, [availableOptions, form, selectedParcelaId])

  useEffect(() => {
    if (!dialogOpen || !aiPrefill) return
    const signature = JSON.stringify(aiPrefill)
    if (appliedAiPrefillRef.current === signature) return
    appliedAiPrefillRef.current = signature

    if (aiPrefill.tip) {
      form.setValue('tip_activitate', isTipActivitateDeprecata(aiPrefill.tip) ? '' : aiPrefill.tip, {
        shouldDirty: false,
        shouldValidate: false,
      })
    }
    if (aiPrefill.produs) {
      form.setValue('produs_utilizat', aiPrefill.produs, { shouldDirty: false, shouldValidate: false })
    }
    if (aiPrefill.doza) {
      form.setValue('doza', aiPrefill.doza, { shouldDirty: false, shouldValidate: false })
    }
    if (aiPrefill.data && /^\d{4}-\d{2}-\d{2}$/.test(aiPrefill.data)) {
      form.setValue('data_aplicare', aiPrefill.data, { shouldDirty: false, shouldValidate: false })
    }
    if (aiPrefill.observatii) {
      form.setValue('observatii', aiPrefill.observatii, { shouldDirty: false, shouldValidate: false })
    }
    if (aiPrefill.parcela_id) {
      form.setValue('parcela_id', aiPrefill.parcela_id, { shouldDirty: false, shouldValidate: false })
    } else if (aiPrefill.parcela_label && parcele.length > 0) {
      const parcelaId = resolveParcelaIdFromHint(aiPrefill.parcela_label, parcele)
      if (parcelaId) {
        form.setValue('parcela_id', parcelaId, { shouldDirty: false, shouldValidate: false })
      }
    }
  }, [aiPrefill, dialogOpen, form, parcele])

  useEffect(() => {
    if (!dialogOpen || aiPrefill) return
    if (defaultTipActivitate) {
      form.setValue(
        'tip_activitate',
        isTipActivitateDeprecata(defaultTipActivitate) ? '' : defaultTipActivitate,
        { shouldDirty: false, shouldValidate: false }
      )
    }
    if (defaultParcelaId) {
      form.setValue('parcela_id', defaultParcelaId, { shouldDirty: false, shouldValidate: false })
    }
  }, [aiPrefill, defaultParcelaId, defaultTipActivitate, dialogOpen, form])

  const mutation = useMutation({
    mutationFn: createActivitateAgricola,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      submittedRef.current = true
      trackEvent({ eventName: 'create_success', moduleName: 'activitati', status: 'success' })
      trackEvent('create_activitate', 'activitati', { source: 'AddActivitateAgricolaDialog' })
      track('activitate_add', {
        tip: variables.tip_activitate,
        produs: variables.produs_utilizat ?? null,
      })
      hapticSuccess()
      toast.success('Activitate salvată')
      setDialogOpen(false)
    },
    onError: (error: unknown) => {
      const maybeError = error as { status?: number; code?: string; message?: string }
      const conflict = maybeError?.status === 409 || maybeError?.code === '23505'
      if (conflict) {
        submittedRef.current = true
        toast.info('Înregistrarea era deja sincronizată.')
        setDialogOpen(false)
        return
      }
      trackEvent({ eventName: 'create_failed', moduleName: 'activitati', status: 'failed' })
      hapticError()
      toast.error(maybeError?.message || 'Eroare la salvare')
    },
  })

  const onSubmit = (values: FormValues) => {
    if (mutation.isPending) return

    mutation.mutate({
      client_sync_id: generateClientId(),
      data_aplicare: values.data_aplicare,
      parcela_id: values.parcela_id || undefined,
      tip_activitate: values.tip_activitate,
      produs_utilizat: values.produs_utilizat?.trim() || undefined,
      doza: values.doza?.trim() || undefined,
      timp_pauza_zile: Number(values.timp_pauza_zile || 0),
      observatii: values.observatii?.trim() || undefined,
    })
  }

  return (
    <>
      <AppDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Adaugă activitate"
        description={drawerDescription}
        desktopFormWide
        desktopFormCompact
        contentClassName="md:w-[min(84vw,44rem)] md:max-w-2xl lg:w-[min(80vw,46rem)] xl:w-[min(76vw,47rem)]"
        footer={
          <DialogFormActions
            className="w-full md:w-auto md:justify-end [&_.agri-cta]:md:min-h-10"
            onCancel={() => setDialogOpen(false)}
            onSave={form.handleSubmit(onSubmit)}
            saving={mutation.isPending}
            disabled={isInitialDataLoading}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        {isInitialDataLoading ? <DialogInitialDataSkeleton compact /> : (
        <form className="space-y-0" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mx-auto max-w-2xl space-y-3.5 md:space-y-4">
            <section className="space-y-2.5 md:space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Context</p>
              <div className="grid gap-3 md:grid-cols-2 md:gap-x-5 md:gap-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="act_data">Data aplicare</Label>
                  <Input id="act_data" type="date" className="agri-control h-11 md:h-10" {...form.register('data_aplicare')} />
                  {form.formState.errors.data_aplicare ? <p className="text-xs text-red-600">{form.formState.errors.data_aplicare.message}</p> : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="act_parcela">Teren</Label>
                  <select
                    id="act_parcela"
                    className="agri-control h-11 w-full px-3 text-base md:hidden"
                    {...form.register('parcela_id')}
                  >
                    <option value="">Selectează teren</option>
                    {parcele.map((parcela: { id: string; nume_parcela: string | null; tip_unitate?: string | null }) => (
                      <option key={parcela.id} value={parcela.id}>
                        {parcela.nume_parcela || 'Teren'} {parcela.tip_unitate ? `(${parcela.tip_unitate})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="hidden md:block">
                    <Popover open={terrainMenuOpen} onOpenChange={setTerrainMenuOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="agri-control flex h-10 w-full items-center justify-between rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 text-left text-sm text-[var(--agri-text)] shadow-sm"
                        >
                          <span
                            className={cn(
                              'flex min-w-0 items-center gap-2',
                              selectedTerrain ? 'text-[var(--agri-text)]' : 'text-[var(--agri-text-muted)]'
                            )}
                          >
                            {selectedTerrain ? (
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]">
                                {getUnitIcon(selectedTerrain.tip_unitate)}
                              </span>
                            ) : null}
                            <span className="truncate">
                              {selectedTerrain
                                ? `${selectedTerrain.nume_parcela || 'Teren'}${selectedTerrain.tip_unitate ? ` (${selectedTerrain.tip_unitate})` : ''}`
                                : 'Selectează teren'}
                            </span>
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        sideOffset={6}
                        className="w-[var(--radix-popover-trigger-width)] rounded-xl border border-[var(--agri-border)] p-1 shadow-[var(--agri-shadow)]"
                      >
                        <div className="max-h-72 overflow-y-auto">
                          <button
                            type="button"
                            onClick={() => {
                              form.setValue('parcela_id', '', { shouldDirty: true, shouldValidate: true })
                              setTerrainMenuOpen(false)
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[var(--agri-text)] transition-colors hover:bg-[var(--agri-surface-muted)]"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]">
                                <Sprout className="h-3.5 w-3.5 text-[var(--agri-text-muted)]" aria-hidden />
                              </span>
                              <span className="truncate">Selectează teren</span>
                            </span>
                            {selectedParcelaId ? null : <Check className="h-4 w-4 text-[var(--agri-primary)]" aria-hidden />}
                          </button>
                          {parcele.map((parcela) => {
                            const isSelected = parcela.id === selectedParcelaId
                            return (
                              <button
                                key={parcela.id}
                                type="button"
                                onClick={() => {
                                  form.setValue('parcela_id', parcela.id, { shouldDirty: true, shouldValidate: true })
                                  setTerrainMenuOpen(false)
                                }}
                                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[var(--agri-text)] transition-colors hover:bg-[var(--agri-surface-muted)]"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]">
                                    {getUnitIcon(parcela.tip_unitate)}
                                  </span>
                                  <span className="truncate">
                                    {parcela.nume_parcela || 'Teren'} {parcela.tip_unitate ? `(${parcela.tip_unitate})` : ''}
                                  </span>
                                </span>
                                {isSelected ? <Check className="h-4 w-4 text-[var(--agri-primary)]" aria-hidden /> : null}
                              </button>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {contextParcela?.nume_parcela ? (
                    <p className="text-xs text-[var(--agri-text-muted)]">
                      Parcela selectată: {contextParcela.nume_parcela}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <ActivityTypeCombobox
                    id="act_tip"
                    label="Tip operațiune"
                    options={activityOptions}
                    showSearchThreshold={12}
                    triggerClassName="h-11 text-[15px] md:h-10"
                    listClassName="max-h-72"
                    getOptionLeadingIcon={getActivityIcon}
                    value={selectedTip}
                    onChange={(nextValue) =>
                      form.setValue('tip_activitate', nextValue, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    error={form.formState.errors.tip_activitate?.message}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-2 md:space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Observații</p>
              <div className="space-y-1.5">
                <Label htmlFor="act_obs">Note</Label>
                <Textarea
                  id="act_obs"
                  rows={3}
                  className="agri-control w-full px-3 py-2 text-base md:min-h-[7rem]"
                  placeholder="Ex: produs, doză, combinații, alte detalii utile"
                  {...form.register('observatii')}
                />
              </div>
            </section>
          </div>
        </form>
        )}
      </AppDrawer>
    </>
  )
}
