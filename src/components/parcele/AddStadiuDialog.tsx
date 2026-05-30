'use client'

import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AppSelect } from '@/components/ui/app-select'
import { Textarea } from '@/components/ui/textarea'
import { ParcelaStadiuCurentDisplay } from '@/components/parcele/ParcelaStadiuCurentDisplay'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { queryKeys } from '@/lib/query-keys'
import type { Cultura } from '@/lib/supabase/queries/culturi'
import {
  createParcelaStadiuCanonic,
  getConfigurareSezonParcela,
  getStadiiCanoniceParcela,
} from '@/lib/supabase/queries/parcela-stadii'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import { isParcelaRubusMixtFenologie } from '@/lib/tratamente/fenofaza-curenta-parcela'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  listAllStadiiCanonice,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'
import { getStadiuOptions } from '@/components/tratamente/plan-wizard/helpers'
import { COHORTA_APP_SELECT_OPTIONS, formatStadiuOptionLabel } from '@/lib/ui/app-select-maps'
import { getCurrentSezon } from '@/lib/utils/sezon'

const schema = z.object({
  stadiu: z.string().min(1, 'Stadiul este obligatoriu'),
  cohort: z.enum(['floricane', 'primocane']).optional(),
  data: z.string().min(1, 'Data este obligatorie'),
  observatii: z.string(),
})

type FormValues = z.infer<typeof schema>

interface AddStadiuDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cultura: Cultura | null
  parcelaId: string | null
  onUpdated: () => void
}

function formatStageLabel(
  value: string | null | undefined,
  grupBiologic?: GrupBiologic | null,
  cohort?: string | null
): string {
  if (!value?.trim()) return 'Stadiu nedefinit'
  const cod = normalizeStadiu(value)
  if (cod) return getLabelPentruGrup(cod, grupBiologic, { cohort })
  const normalized = value.replaceAll('_', ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function AddStadiuDialog({
  open,
  onOpenChange,
  cultura,
  parcelaId,
  onUpdated,
}: AddStadiuDialogProps) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const currentSezon = getCurrentSezon()
  const cropCod = useMemo(() => normalizeCropCod(cultura?.tip_planta), [cultura?.tip_planta])
  const grupBiologic = useMemo(() => getGrupBiologicForCropCod(cropCod), [cropCod])
  const stageValues = useMemo(
    () => (grupBiologic ? listStadiiPentruGrup(grupBiologic) : listAllStadiiCanonice()),
    [grupBiologic]
  )
  const defaultStadiu = stageValues[0] ?? 'repaus_vegetativ'

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { stadiu: defaultStadiu, cohort: undefined, data: today, observatii: '' },
  })

  const { data: canonicalStages = [] } = useQuery({
    queryKey: queryKeys.parcelaCultureStages(parcelaId ?? ''),
    queryFn: () => getStadiiCanoniceParcela(parcelaId!, currentSezon, 50),
    enabled: open && Boolean(parcelaId),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: seasonConfig = null } = useQuery({
    queryKey: queryKeys.parcelaSeasonConfig(parcelaId ?? '', currentSezon),
    queryFn: () => getConfigurareSezonParcela(parcelaId!, currentSezon),
    enabled: open && Boolean(parcelaId),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const isRubusMixt = isParcelaRubusMixtFenologie(grupBiologic, seasonConfig, canonicalStages)
  const legacyStageLabel = cultura?.stadiu ? formatStageLabel(cultura.stadiu, grupBiologic) : null

  useEffect(() => {
    if (open) {
      form.reset({ stadiu: defaultStadiu, cohort: undefined, data: today, observatii: '' })
    }
  }, [defaultStadiu, open, form, today])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!cultura) throw new Error('Cultură nedefinită')
      if (!parcelaId) throw new Error('Solar nedefinit')
      if (isRubusMixt && !values.cohort) throw new Error('Selectează cohorta')

      await createParcelaStadiuCanonic({
        parcela_id: parcelaId,
        an: currentSezon,
        stadiu: values.stadiu,
        cohort: isRubusMixt ? values.cohort ?? null : null,
        data_observata: values.data,
        observatii: values.observatii || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Stadiu actualizat')
      if (parcelaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
      }
      onOpenChange(false)
      onUpdated()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const stadiuValue = useWatch({ control: form.control, name: 'stadiu' }) || ''
  const cohortValue = useWatch({ control: form.control, name: 'cohort' }) || undefined
  const watchedData = useWatch({ control: form.control, name: 'data' }) || ''
  const stageOptions = useMemo(() => {
    const emojiByCod = Object.fromEntries(
      getStadiuOptions(grupBiologic).map((option) => [option.value, option.emoji])
    )
    return stageValues.map((cod) => ({
      value: cod,
      label: getLabelPentruGrup(cod, grupBiologic, { cohort: cohortValue }),
      emoji: emojiByCod[cod],
    }))
  }, [cohortValue, grupBiologic, stageValues])
  const cohortSelectOptions = useMemo(
    () => COHORTA_APP_SELECT_OPTIONS.filter((option) => option.value !== ''),
    []
  )

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ stadiu: defaultStadiu, cohort: undefined, data: today, observatii: '' })
        onOpenChange(next)
      }}
      title="Adaugă stadiu cultură"
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((v) => mutation.mutate(v))}
          saving={mutation.isPending}
          saveLabel="Salvează"
          cancelLabel="Anulează"
        />
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        {cultura ? (
          <div
            style={{
              background: 'rgba(61,122,95,0.07)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
            color: '#3D7A5F',
            }}
          >
            <div>{[cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ')}</div>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 500, color: 'var(--agri-text-muted)' }}>
              Stadiu curent:{' '}
              <ParcelaStadiuCurentDisplay
                canonicalStages={canonicalStages}
                grupBiologic={grupBiologic}
                seasonConfig={seasonConfig}
                variant="text"
                fallbackLabel={legacyStageLabel ? `Stadiu vechi: ${legacyStageLabel}` : null}
                emptyLabel="Fără stadiu înregistrat"
              />
            </div>
          </div>
        ) : null}

        <AppSelect
          id="add-stadiu-cod"
          label="Stadiu *"
          placeholder="Alege stadiul"
          value={stadiuValue}
          options={stageOptions}
          showSearchThreshold={12}
          getOptionDisplayLabel={formatStadiuOptionLabel}
          triggerClassName="h-12 text-base"
          onChange={(value) => form.setValue('stadiu', value, { shouldValidate: true })}
          error={form.formState.errors.stadiu?.message}
        />

        {isRubusMixt ? (
          <AppSelect
            id="add-stadiu-cohort"
            label="Cohortă *"
            placeholder="Alege cohorta"
            value={cohortValue ?? ''}
            options={cohortSelectOptions}
            triggerClassName="h-12 text-base"
            onChange={(value) => form.setValue('cohort', value as Cohorta, { shouldValidate: true })}
            error={form.formState.errors.cohort?.message}
          />
        ) : null}

        <AppDatePicker
          id="data_stadiu"
          label="Data *"
          placeholder="Selectează data"
          value={watchedData}
          triggerClassName="h-12"
          onChange={(nextValue) =>
            form.setValue('data', nextValue, { shouldDirty: true, shouldValidate: true })
          }
          error={form.formState.errors.data?.message}
        />

        <div className="space-y-2">
          <Label htmlFor="observatii_stadiu">Observații (opțional)</Label>
          <Textarea
            id="observatii_stadiu"
            rows={2}
            className="agri-control w-full px-3 py-2 text-base"
            placeholder="Ex: Primele flori apărute, Atac de afide..."
            {...form.register('observatii')}
          />
        </div>
      </form>
    </AppDialog>
  )
}
