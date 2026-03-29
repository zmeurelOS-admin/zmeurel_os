'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'

import { track } from '@/lib/analytics/track'
import { updateParcela, type Parcela } from '@/lib/supabase/queries/parcele'
import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import {
  getParcelFormDefaults,
  parcelFormSchema,
  ParcelForm,
  type ParcelFormValues,
} from '@/components/parcele/ParcelForm'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

interface EditParcelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcela: Parcela | null
  soiuriDisponibile: string[]
  onSaved: () => void
}

const toFormValues = (parcela: Parcela): ParcelFormValues => ({
  ...getParcelFormDefaults(),
  nume_parcela: parcela.nume_parcela ?? '',
  tip_unitate: (parcela.tip_unitate as 'camp' | 'solar' | 'livada' | 'cultura_mare') ?? 'camp',
  suprafata_m2: String(parcela.suprafata_m2 ?? ''),
  status: parcela.status ?? 'Activ',
  observatii: parcela.observatii ?? '',
})

const toDecimal = (value: string) => Number(value.replace(',', '.').trim())

export function EditParcelDialog({
  open,
  onOpenChange,
  parcela,
  soiuriDisponibile,
  onSaved,
}: EditParcelDialogProps) {
  const form = useForm<ParcelFormValues>({
    resolver: zodResolver(parcelFormSchema),
    defaultValues: getParcelFormDefaults(),
  })

  useEffect(() => {
    if (open && parcela) {
      form.reset(toFormValues(parcela))
    }
  }, [open, parcela, form])

  const updateMutation = useMutation({
    mutationFn: async (values: ParcelFormValues) => {
      if (!parcela) throw new Error('Teren lipsă')

      return updateParcela(parcela.id, {
        nume_parcela: values.nume_parcela.trim(),
        tip_unitate: values.tip_unitate,
        suprafata_m2: toDecimal(values.suprafata_m2),
        status: values.status,
        observatii: values.observatii?.trim() || null,
      })
    },
    onSuccess: () => {
      if (parcela?.id) {
        track('parcela_edit', { id: parcela.id, tip_unitate: form.getValues('tip_unitate') })
      }
      hapticSuccess()
      toast.success('Teren actualizat')
      onOpenChange(false)
      onSaved()
    },
    onError: (error: Error) => {
      hapticError()
      toast.error(error.message)
    },
  })

  if (!parcela) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează teren"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((values) => updateMutation.mutate(values))}
          saving={updateMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <ParcelForm form={form} soiuriDisponibile={soiuriDisponibile} />
    </AppDialog>
  )
}
