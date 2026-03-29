'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { ActivityTypeCombobox } from '@/components/activitati-agricole/ActivityTypeCombobox'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { getActivityOptionsForUnitate, withCurrentActivityOption } from '@/lib/activitati/activity-options'
import { generateClientId } from '@/lib/offline/generateClientId'
import { createActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

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

export function AddActivitateAgricolaDialog({
  open,
  onOpenChange,
  hideTrigger = false,
  defaultTipActivitate,
  defaultParcelaId,
  aiPrefill = null,
}: AddActivitateAgricolaDialogProps) {
  void hideTrigger

  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const previousParcelaIdRef = useRef<string>('')
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)
  const appliedAiPrefillRef = useRef<string>('')

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

  const selectedParcelaId = form.watch('parcela_id') || ''
  const selectedTip = form.watch('tip_activitate') || ''
  const selectedParcela = useMemo(
    () => parcele.find((parcela) => parcela.id === selectedParcelaId),
    [parcele, selectedParcelaId]
  )
  const availableOptions = useMemo(
    () => getActivityOptionsForUnitate(selectedParcela?.tip_unitate),
    [selectedParcela?.tip_unitate]
  )
  const activityOptions = useMemo(
    () => withCurrentActivityOption(availableOptions, selectedTip),
    [availableOptions, selectedTip]
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
      form.setValue('tip_activitate', aiPrefill.tip, { shouldDirty: false, shouldValidate: false })
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
      form.setValue('tip_activitate', defaultTipActivitate, { shouldDirty: false, shouldValidate: false })
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
        title="Adaugă activitate agricolă"
        contentClassName="md:max-w-2xl"
        footer={
          <DialogFormActions
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
          <div className="grid gap-4 md:grid-cols-2">
            {/* Row 1: Data + Teren */}
            <div className="space-y-2">
              <Label htmlFor="act_data">Data aplicare</Label>
              <Input id="act_data" type="date" className="agri-control h-12" {...form.register('data_aplicare')} />
              {form.formState.errors.data_aplicare ? <p className="text-xs text-red-600">{form.formState.errors.data_aplicare.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="act_parcela">Teren</Label>
              <select id="act_parcela" className="agri-control h-12 w-full px-3 text-base" {...form.register('parcela_id')}>
                <option value="">Selectează teren</option>
                {parcele.map((parcela: { id: string; nume_parcela: string | null; tip_unitate?: string | null }) => (
                  <option key={parcela.id} value={parcela.id}>
                    {parcela.nume_parcela || 'Teren'} {parcela.tip_unitate ? `(${parcela.tip_unitate})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Tip operațiune: full-width */}
            <div className="space-y-2 md:col-span-2">
              <ActivityTypeCombobox
                id="act_tip"
                label="Tip operațiune"
                options={activityOptions}
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

            {/* Row 2: Produs + Doză */}
            <div className="space-y-2">
              <Label htmlFor="act_produs">Produs</Label>
              <Input id="act_produs" className="agri-control h-12" placeholder="Ex: produs foliar" {...form.register('produs_utilizat')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="act_doza">Cantitate / doză</Label>
              <Input id="act_doza" className="agri-control h-12" placeholder="Ex: 2 l/ha" {...form.register('doza')} />
            </div>

            {/* Timp pauză: single column */}
            <div className="space-y-2">
              <Label htmlFor="act_pauza">Timp pauză (zile)</Label>
              <Input id="act_pauza" type="number" min="0" className="agri-control h-12" {...form.register('timp_pauza_zile')} />
              {form.formState.errors.timp_pauza_zile ? <p className="text-xs text-red-600">{form.formState.errors.timp_pauza_zile.message}</p> : null}
            </div>

            {/* Observații: full-width */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="act_obs">Observații</Label>
              <Textarea id="act_obs" rows={3} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii')} />
            </div>
          </div>
        </form>
        )}
      </AppDrawer>
    </>
  )
}
