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
import { parseParcelCropValues, serializeParcelLegacyCropLabel } from '@/lib/parcele/parcel-form-options'
import { parseParcelaScop, coerceStatusOperationalFromDb } from '@/lib/parcele/dashboard-relevance'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

interface EditParcelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcela: Parcela | null
  soiuriDisponibile: string[]
  onSaved: () => void
}

const toFormValues = (parcela: Parcela): ParcelFormValues => {
  const cropValues = parseParcelCropValues({
    cultura: parcela.cultura,
    soi: parcela.soi,
    soi_plantat: parcela.soi_plantat,
    tip_fruct: parcela.tip_fruct,
  })

  return {
    ...getParcelFormDefaults(),
    nume_parcela: parcela.nume_parcela ?? '',
    tip_unitate: (parcela.tip_unitate as 'camp' | 'solar' | 'livada' | 'cultura_mare') ?? 'camp',
    tip_fruct: cropValues.cultura,
    soi_plantat: cropValues.soi_plantat,
    cultura: cropValues.cultura,
    soi: cropValues.soi,
    suprafata_m2: String(parcela.suprafata_m2 ?? ''),
    latitudine: parcela.latitudine == null ? '' : String(parcela.latitudine),
    longitudine: parcela.longitudine == null ? '' : String(parcela.longitudine),
    // If legacy rows have null rol, prefer 'comercial' as sensible default for edits.
    rol: parseParcelaScop(parcela.rol) ?? 'comercial',
    apare_in_dashboard: parcela.apare_in_dashboard ?? true,
    contribuie_la_productie: parcela.contribuie_la_productie ?? true,
    status_operational: coerceStatusOperationalFromDb(parcela.status_operational),
    status: parcela.status ?? 'Activ',
    observatii: parcela.observatii ?? '',
  }
}

const toDecimal = (value: string) => Number(value.replace(',', '.').trim())
const toFloatOrNull = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

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
        latitudine: toFloatOrNull(values.latitudine),
        longitudine: toFloatOrNull(values.longitudine),
        tip_fruct: values.cultura.trim() || null,
        cultura: values.cultura.trim() || null,
        soi: values.soi.trim() || null,
        soi_plantat: serializeParcelLegacyCropLabel(values.cultura, values.soi) || null,
        rol: values.rol,
        apare_in_dashboard: values.apare_in_dashboard,
        contribuie_la_productie: values.contribuie_la_productie,
        status_operational: values.status_operational,
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
      title="🌱 Editează teren"
      description="Actualizezi detaliile terenului și vezi imediat rezumatul fără să schimbi fluxul de salvare."
      desktopFormWide
      showCloseButton
      contentClassName="md:w-[min(96vw,94rem)] md:max-w-none"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((values) => updateMutation.mutate(values))}
          saving={updateMutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}>
        <ParcelForm form={form} soiuriDisponibile={soiuriDisponibile} />
      </form>
    </AppDialog>
  )
}
