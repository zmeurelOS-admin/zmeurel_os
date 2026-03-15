'use client'

import { useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { AppDrawer } from '@/components/app/AppDrawer'
import {
  getParcelFormDefaults,
  parcelFormSchema,
  ParcelForm,
  type ParcelFormValues,
} from '@/components/parcele/ParcelForm'
import { buildParcelaObservatii, stripHiddenAgricultureMetadata, type ParcelCropRow } from '@/lib/parcele/crop-config'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { ensureCropVarietyForCrop } from '@/lib/supabase/queries/crop-varieties'
import { ensureCropForUnitType } from '@/lib/supabase/queries/crops'
import { createParcela } from '@/lib/supabase/queries/parcele'
import { isCatalogFallbackEligible } from '@/lib/ui/error-messages'
import { toast } from '@/lib/ui/toast'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

interface AddParcelDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  soiuriDisponibile: string[]
  onCreated: () => void
}

const toDecimal = (value: string) => Number(value.replace(',', '.').trim())
const generateParcelCode = () => `PAR-${Date.now().toString().slice(-6)}`

function getNormalizedCropRows(values: ParcelFormValues): ParcelCropRow[] {
  const baseRows = values.crop_rows
    .map((row, index) => {
      const culture = row.culture.trim()
      const variety = row.variety.trim()
      const rawPlantCount = row.plantCount.trim()
      const plantCount = rawPlantCount ? Number(rawPlantCount) : null

      if (!culture && !variety && !rawPlantCount) return null

      return {
        id: row.id || `crop-${index + 1}`,
        culture,
        variety,
        plantCount: Number.isFinite(plantCount) ? plantCount : null,
      }
    })
    .filter((row): row is ParcelCropRow => Boolean(row))

  if (baseRows.length > 0) return baseRows

  const fallbackCulture = values.cultura.trim() || values.tip_fruct.trim()
  const fallbackVariety = values.soi.trim() || values.soi_plantat.trim()
  const fallbackPlantCount = values.nr_plante.trim() ? Number(values.nr_plante.trim()) : null

  if (!fallbackCulture && !fallbackVariety && fallbackPlantCount === null) return []

  return [
    {
      id: 'crop-1',
      culture: fallbackCulture,
      variety: fallbackVariety,
      plantCount: Number.isFinite(fallbackPlantCount) ? fallbackPlantCount : null,
    },
  ]
}

export function AddParcelDrawer({
  open,
  onOpenChange,
  soiuriDisponibile,
  onCreated,
}: AddParcelDrawerProps) {
  const submittedRef = useRef(false)
  const hasOpenedRef = useRef(false)

  const form = useForm<ParcelFormValues>({
    resolver: zodResolver(parcelFormSchema),
    defaultValues: getParcelFormDefaults(),
  })

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true
      submittedRef.current = false
      trackEvent({ eventName: 'open_create_form', moduleName: 'parcele', status: 'started' })
    } else if (hasOpenedRef.current && !submittedRef.current) {
      trackEvent({ eventName: 'form_abandoned', moduleName: 'parcele', status: 'abandoned' })
    }
    if (!open) {
      form.reset(getParcelFormDefaults())
    }
  }, [open, form])

  const createMutation = useMutation({
    mutationFn: async (values: ParcelFormValues) => {
      const isSolar = values.tip_unitate === 'solar'
      const cropRows = isSolar ? getNormalizedCropRows(values) : []
      const primaryCrop = cropRows[0]
      const cropName = (isSolar ? primaryCrop?.culture : values.tip_fruct).trim()
      let catalogFallbackUsed = false
      let cropId: string | null = null

      try {
        const crop = await ensureCropForUnitType(cropName, values.tip_unitate)
        cropId = crop.id
      } catch (error) {
        if (!isCatalogFallbackEligible(error)) throw error
        catalogFallbackUsed = true
      }

      const varietyName = (isSolar ? primaryCrop?.variety : values.soi_plantat).trim()
      if (varietyName && cropId) {
        try {
          await ensureCropVarietyForCrop(cropId, varietyName)
        } catch (error) {
          if (!isCatalogFallbackEligible(error)) throw error
          catalogFallbackUsed = true
        }
      }

      const totalPlants =
        isSolar && cropRows.length > 0
          ? cropRows.reduce((sum, row) => sum + (row.plantCount ?? 0), 0)
          : values.nr_plante
            ? Number(values.nr_plante)
            : undefined

      const parcela = await createParcela({
        id_parcela: generateParcelCode(),
        nume_parcela: values.nume_parcela.trim(),
        tip_unitate: values.tip_unitate,
        tip_fruct: cropName,
        suprafata_m2: toDecimal(values.suprafata_m2),
        soi_plantat: varietyName || undefined,
        an_plantare: Number(values.an_plantare),
        nr_plante: totalPlants && totalPlants > 0 ? totalPlants : undefined,
        cultura: isSolar ? primaryCrop?.culture || values.cultura || cropName || null : null,
        soi: isSolar ? primaryCrop?.variety || values.soi || varietyName || null : null,
        nr_randuri: isSolar && values.nr_randuri ? Number(values.nr_randuri) : null,
        distanta_intre_randuri:
          isSolar && values.distanta_intre_randuri ? toDecimal(values.distanta_intre_randuri) : null,
        sistem_irigare: isSolar ? values.sistem_irigare || null : null,
        data_plantarii: isSolar ? values.data_plantarii || null : null,
        status: values.status,
        stadiu: values.stadiu || undefined,
        observatii: isSolar
          ? buildParcelaObservatii(values.observatii, cropRows) || undefined
          : stripHiddenAgricultureMetadata(values.observatii) || undefined,
      })

      return { parcela, catalogFallbackUsed }
    },
    onSuccess: ({ catalogFallbackUsed }, values) => {
      submittedRef.current = true
      trackEvent({ eventName: 'create_success', moduleName: 'parcele', status: 'success' })
      track('parcela_add', {
        suprafata: Number(values.suprafata_m2.replace(',', '.')) || 0,
        soi: values.soi_plantat || null,
        tip_unitate: values.tip_unitate,
      })
      hapticSuccess()
      toast.success(
        catalogFallbackUsed
          ? 'Teren adăugat. Cultura a fost salvată manual.'
          : 'Teren adăugat'
      )
      onOpenChange(false)
      onCreated()
    },
    onError: (error: Error) => {
      trackEvent({ eventName: 'create_failed', moduleName: 'parcele', status: 'failed' })
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
