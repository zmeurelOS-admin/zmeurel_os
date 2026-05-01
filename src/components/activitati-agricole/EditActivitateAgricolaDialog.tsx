'use client'

import { useEffect, useMemo, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import {
  ActivitateAgricolaForm,
  activitateAgricolaFormSchema,
  getActivitateAgricolaFormDefaults,
  type ActivitateAgricolaFormValues,
} from '@/components/activitati-agricole/ActivitateAgricolaForm'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { getActivityOptionsForUnitate, withCurrentActivityOption } from '@/lib/activitati/activity-options'
import { track } from '@/lib/analytics/track'
import { getParcele } from '@/lib/supabase/queries/parcele'
import {
  type ActivitateAgricola,
  updateActivitateAgricola,
} from '@/lib/supabase/queries/activitati-agricole'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

interface EditActivitateAgricolaDialogProps {
  activitate: ActivitateAgricola | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditActivitateAgricolaDialog({
  activitate,
  open,
  onOpenChange,
}: EditActivitateAgricolaDialogProps) {
  const queryClient = useQueryClient()
  const previousParcelaIdRef = useRef<string>('')

  const form = useForm<ActivitateAgricolaFormValues>({
    resolver: zodResolver(activitateAgricolaFormSchema),
    defaultValues: getActivitateAgricolaFormDefaults(),
  })

  useEffect(() => {
    if (!open || !activitate) return
    if (activitate.tip_deprecat) {
      toast.info('Această activitate este arhivată. Înregistrează-o în Protecție & Nutriție.')
      onOpenChange(false)
      return
    }

    form.reset({
      data_aplicare: activitate.data_aplicare
        ? new Date(activitate.data_aplicare).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      parcela_id: activitate.parcela_id ?? '',
      tip_activitate: activitate.tip_activitate ?? '',
      produs_utilizat: activitate.produs_utilizat ?? '',
      doza: activitate.doza ?? '',
      timp_pauza_zile:
        typeof activitate.timp_pauza_zile === 'number' ? String(activitate.timp_pauza_zile) : '0',
      observatii: activitate.observatii ?? '',
    })
  }, [open, activitate, form, onOpenChange])

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
  })

  const selectedParcelaId = useWatch({ control: form.control, name: 'parcela_id' }) || ''
  const selectedTip = useWatch({ control: form.control, name: 'tip_activitate' }) || ''
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

  const mutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ActivitateAgricolaFormValues }) =>
      updateActivitateAgricola(id, {
        data_aplicare: values.data_aplicare,
        parcela_id: values.parcela_id || undefined,
        tip_activitate: values.tip_activitate,
        produs_utilizat: values.produs_utilizat?.trim() || undefined,
        doza: values.doza?.trim() || undefined,
        timp_pauza_zile: Number(values.timp_pauza_zile || 0),
        observatii: values.observatii?.trim() || undefined,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      track('activitate_edit', { id: variables.id })
      hapticSuccess()
      toast.success('Activitate actualizată')
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const maybeError = error as { message?: string }
      hapticError()
      toast.error(maybeError?.message || 'Eroare la actualizare')
    },
  })

  if (!activitate) return null

  const submit = (values: ActivitateAgricolaFormValues) => {
    if (mutation.isPending) return
    mutation.mutate({ id: activitate.id, values })
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează activitate agricolă"
      description="Actualizezi rapid contextul activității și verifici rezumatul live înainte de salvare."
      desktopFormWide
      desktopFormCompact
      showCloseButton
      contentClassName="md:w-[min(96vw,70rem)] md:max-w-none lg:w-[min(94vw,72rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit(submit)}
          saving={mutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit(submit)}>
        <ActivitateAgricolaForm
          form={form}
          parcele={parcele}
          activityOptions={activityOptions}
          selectedParcelaId={selectedParcelaId}
          selectedTip={selectedTip}
        />
      </form>
    </AppDialog>
  )
}
