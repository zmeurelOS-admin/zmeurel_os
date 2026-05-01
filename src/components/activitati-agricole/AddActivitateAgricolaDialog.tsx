'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'

import { AppDrawer } from '@/components/app/AppDrawer'
import {
  ActivitateAgricolaForm,
  activitateAgricolaFormSchema,
  getActivitateAgricolaFormDefaults,
  type ActivitateAgricolaFormValues,
} from '@/components/activitati-agricole/ActivitateAgricolaForm'
import { DialogInitialDataSkeleton } from '@/components/app/DialogInitialDataSkeleton'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import {
  getActivityOptionsForUnitate,
  isTipActivitateDeprecata,
  withCurrentActivityOption,
} from '@/lib/activitati/activity-options'
import { generateClientId } from '@/lib/offline/generateClientId'
import { createActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

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

  const isControlled = typeof open === 'boolean'
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  const form = useForm<ActivitateAgricolaFormValues>({
    resolver: zodResolver(activitateAgricolaFormSchema),
    defaultValues: getActivitateAgricolaFormDefaults(),
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
      form.reset(getActivitateAgricolaFormDefaults())
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

  const onSubmit = (values: ActivitateAgricolaFormValues) => {
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
        description={drawerDescription ?? 'Completezi rapid contextul și verifici rezumatul din dreapta înainte de salvare.'}
        desktopFormWide
        desktopFormCompact
        showCloseButton
        contentClassName="md:w-[min(96vw,70rem)] md:max-w-none lg:w-[min(94vw,72rem)]"
        footer={
          <DialogFormActions
            className="w-full"
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
          <ActivitateAgricolaForm
            form={form}
            parcele={parcele}
            activityOptions={activityOptions}
            selectedParcelaId={selectedParcelaId}
            selectedTip={selectedTip}
            contextParcelaLabel={contextParcela?.nume_parcela ?? contextParcelaLabel ?? null}
          />
        </form>
        )}
      </AppDrawer>
    </>
  )
}
