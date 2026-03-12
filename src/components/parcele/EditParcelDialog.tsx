'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'

import { track } from '@/lib/analytics/track'
import { ensureCropVarietyForCrop } from '@/lib/supabase/queries/crop-varieties'
import { ensureCropForUnitType } from '@/lib/supabase/queries/crops'
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
  nume_parcela: parcela.nume_parcela ?? '',
  tip_unitate: (parcela.tip_unitate as 'camp' | 'solar' | 'livada') ?? 'camp',
  tip_fruct: parcela.tip_fruct ?? '',
  suprafata_m2: String(parcela.suprafata_m2 ?? ''),
  soi_plantat: parcela.soi_plantat ?? '',
  cultura: parcela.cultura ?? parcela.tip_fruct ?? '',
  soi: parcela.soi ?? parcela.soi_plantat ?? '',
  nr_randuri: parcela.nr_randuri ? String(parcela.nr_randuri) : '',
  an_plantare: String(parcela.an_plantare ?? ''),
  nr_plante: parcela.nr_plante ? String(parcela.nr_plante) : '',
  distanta_intre_randuri: parcela.distanta_intre_randuri ? String(parcela.distanta_intre_randuri) : '',
  sistem_irigare: parcela.sistem_irigare ?? '',
  data_plantarii: (parcela.data_plantarii ?? '').slice(0, 10),
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
      if (!parcela) throw new Error('Teren lipsa')
      const isSolar = values.tip_unitate === 'solar'
      const cropName = values.tip_fruct.trim()
      const crop = await ensureCropForUnitType(cropName, values.tip_unitate)
      const varietyName = values.soi_plantat.trim()
      if (varietyName) {
        await ensureCropVarietyForCrop(crop.id, varietyName)
      }

      return updateParcela(parcela.id, {
        nume_parcela: values.nume_parcela.trim(),
        tip_unitate: values.tip_unitate,
        tip_fruct: cropName || null,
        suprafata_m2: toDecimal(values.suprafata_m2),
        soi_plantat: values.soi_plantat || null,
        an_plantare: Number(values.an_plantare),
        nr_plante: values.nr_plante ? Number(values.nr_plante) : null,
        cultura: isSolar ? values.cultura || cropName || null : null,
        soi: isSolar ? values.soi || values.soi_plantat || null : null,
        nr_randuri: isSolar && values.nr_randuri ? Number(values.nr_randuri) : null,
        distanta_intre_randuri:
          isSolar && values.distanta_intre_randuri ? toDecimal(values.distanta_intre_randuri) : null,
        sistem_irigare: isSolar ? values.sistem_irigare || null : null,
        data_plantarii: isSolar ? values.data_plantarii || null : null,
        status: values.status,
        observatii: values.observatii || null,
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
