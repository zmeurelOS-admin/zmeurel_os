'use client'

import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/ui/toast'

import { track } from '@/lib/analytics/track'
import { ensureCropVarietyForCrop } from '@/lib/supabase/queries/crop-varieties'
import { ensureCropForUnitType } from '@/lib/supabase/queries/crops'
import { createParcela } from '@/lib/supabase/queries/parcele'
import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import {
  getParcelFormDefaults,
  parcelFormSchema,
  ParcelForm,
  type ParcelFormValues,
} from '@/components/parcele/ParcelForm'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

interface AddParcelDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  soiuriDisponibile: string[]
  onCreated: () => void
}

const toDecimal = (value: string) => Number(value.replace(',', '.').trim())
const generateParcelCode = () => `PAR-${Date.now().toString().slice(-6)}`

export function AddParcelDrawer({
  open,
  onOpenChange,
  soiuriDisponibile,
  onCreated,
}: AddParcelDrawerProps) {
  const form = useForm<ParcelFormValues>({
    resolver: zodResolver(parcelFormSchema),
    defaultValues: getParcelFormDefaults(),
  })

  useEffect(() => {
    if (!open) {
      form.reset(getParcelFormDefaults())
    }
  }, [open, form])

  const createMutation = useMutation({
    mutationFn: async (values: ParcelFormValues) => {
      const isSolar = values.tip_unitate === 'solar'
      const cropName = values.tip_fruct.trim()
      const crop = await ensureCropForUnitType(cropName, values.tip_unitate)
      const varietyName = values.soi_plantat.trim()
      if (varietyName) {
        await ensureCropVarietyForCrop(crop.id, varietyName)
      }

      return createParcela({
        id_parcela: generateParcelCode(),
        nume_parcela: values.nume_parcela.trim(),
        tip_unitate: values.tip_unitate,
        tip_fruct: cropName,
        suprafata_m2: toDecimal(values.suprafata_m2),
        soi_plantat: values.soi_plantat || undefined,
        an_plantare: Number(values.an_plantare),
        nr_plante: values.nr_plante ? Number(values.nr_plante) : undefined,
        cultura: isSolar ? values.cultura || cropName || null : null,
        soi: isSolar ? values.soi || values.soi_plantat || null : null,
        nr_randuri: isSolar && values.nr_randuri ? Number(values.nr_randuri) : null,
        distanta_intre_randuri:
          isSolar && values.distanta_intre_randuri ? toDecimal(values.distanta_intre_randuri) : null,
        sistem_irigare: isSolar ? values.sistem_irigare || null : null,
        data_plantarii: isSolar ? values.data_plantarii || null : null,
        status: values.status,
        observatii: values.observatii || undefined,
      })
    },
    onSuccess: (_, values) => {
      track('parcela_add', {
        suprafata: Number(values.suprafata_m2.replace(',', '.')) || 0,
        soi: values.soi_plantat || null,
        tip_unitate: values.tip_unitate,
      })
      hapticSuccess()
      toast.success('Teren adaugat')
      onOpenChange(false)
      onCreated()
    },
    onError: (error: Error) => {
      hapticError()
      toast.error(error.message)
    },
  })

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă teren"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((values) => createMutation.mutate(values))}
          saving={createMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <ParcelForm form={form} soiuriDisponibile={soiuriDisponibile} />
    </AppDrawer>
  )
}

