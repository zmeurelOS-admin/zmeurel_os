'use client'

import { useEffect, useMemo, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { ActivityTypeCombobox } from '@/components/activitati-agricole/ActivityTypeCombobox'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getActivityOptionsForUnitate, withCurrentActivityOption } from '@/lib/activitati/activity-options'
import { track } from '@/lib/analytics/track'
import { getParcele } from '@/lib/supabase/queries/parcele'
import {
  type ActivitateAgricola,
  updateActivitateAgricola,
} from '@/lib/supabase/queries/activitati-agricole'
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

interface EditActivitateAgricolaDialogProps {
  activitate: ActivitateAgricola | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function EditActivitateAgricolaDialog({
  activitate,
  open,
  onOpenChange,
}: EditActivitateAgricolaDialogProps) {
  const queryClient = useQueryClient()
  const previousParcelaIdRef = useRef<string>('')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })

  useEffect(() => {
    if (!open || !activitate) return

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
  }, [open, activitate, form])

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
    mutationFn: ({ id, values }: { id: string; values: FormValues }) =>
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

  const submit = (values: FormValues) => {
    if (mutation.isPending) return
    mutation.mutate({ id: activitate.id, values })
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează activitate agricolă"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit(submit)}
          saving={mutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
        <div className="space-y-2">
          <Label htmlFor="act_edit_data">Data aplicare</Label>
          <Input id="act_edit_data" type="date" className="agri-control h-12" {...form.register('data_aplicare')} />
          {form.formState.errors.data_aplicare ? <p className="text-xs text-red-600">{form.formState.errors.data_aplicare.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="act_edit_parcela">Teren</Label>
          <select id="act_edit_parcela" className="agri-control h-12 w-full px-3 text-base" {...form.register('parcela_id')}>
            <option value="">Selectează teren</option>
            {parcele.map((parcela: { id: string; nume_parcela: string | null; tip_unitate?: string | null }) => (
              <option key={parcela.id} value={parcela.id}>
                {parcela.nume_parcela || 'Teren'} {parcela.tip_unitate ? `(${parcela.tip_unitate})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <ActivityTypeCombobox
            id="act_edit_tip"
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

        <div className="space-y-2">
          <Label htmlFor="act_edit_produs">Produs</Label>
          <Input id="act_edit_produs" className="agri-control h-12" {...form.register('produs_utilizat')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="act_edit_doza">Cantitate / doza</Label>
          <Input id="act_edit_doza" className="agri-control h-12" {...form.register('doza')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="act_edit_pauza">Timp pauză (zile)</Label>
          <Input id="act_edit_pauza" type="number" min="0" className="agri-control h-12" {...form.register('timp_pauza_zile')} />
          {form.formState.errors.timp_pauza_zile ? <p className="text-xs text-red-600">{form.formState.errors.timp_pauza_zile.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="act_edit_obs">Observații</Label>
          <Textarea id="act_edit_obs" rows={4} className="agri-control w-full px-3 py-2 text-base" {...form.register('observatii')} />
        </div>
      </form>
    </AppDialog>
  )
}
