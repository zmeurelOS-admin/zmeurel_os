'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { NumericField } from '@/components/app/NumericField'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CUSTOM_CULTURA_OPTION,
  getCulturaFieldConfig,
  getCulturiOptions,
  getTipPlantaPlaceholder,
  getTipPlantaSelectValue,
} from '@/lib/parcele/culturi'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { queryKeys } from '@/lib/query-keys'
import { updateCultura, type Cultura } from '@/lib/supabase/queries/culturi'
import {
  getConfigurareSezonParcela,
  getStadiiCanoniceParcela,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  getOrdine,
  getOrdineInGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'

const toDecimal = (value: string) => Number(value.replace(',', '.').trim())

const schema = z.object({
  tip_planta: z.string().trim().min(1, 'Tipul plantei este obligatoriu'),
  soi: z.string(),
  suprafata_ocupata: z
    .string()
    .trim()
    .refine((v) => !v || (Number.isFinite(toDecimal(v)) && toDecimal(v) > 0), {
      message: 'Suprafața trebuie să fie un număr pozitiv',
    }),
  nr_plante: z
    .string()
    .trim()
    .refine((v) => !v || Number.isInteger(Number(v)), {
      message: 'Numărul de plante trebuie să fie întreg',
    }),
  nr_randuri: z
    .string()
    .trim()
    .refine((v) => !v || Number.isInteger(Number(v)), {
      message: 'Numărul de rânduri trebuie să fie întreg',
    }),
  distanta_intre_randuri: z
    .string()
    .trim()
    .refine((v) => !v || (Number.isFinite(toDecimal(v)) && toDecimal(v) > 0), {
      message: 'Distanța trebuie să fie un număr pozitiv',
    }),
  sistem_irigare: z.string(),
  data_plantarii: z.string().refine((v) => !v || !Number.isNaN(Date.parse(v)), {
    message: 'Data plantării nu este validă',
  }),
  observatii: z.string(),
})

type FormValues = z.infer<typeof schema>

interface EditCulturaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cultura: Cultura | null
  tipUnitate?: string | null
  onSaved: () => void
}

function toFormValues(cultura: Cultura): FormValues {
  return {
    tip_planta: cultura.tip_planta ?? '',
    soi: cultura.soi ?? '',
    suprafata_ocupata: cultura.suprafata_ocupata != null ? String(cultura.suprafata_ocupata) : '',
    nr_plante: cultura.nr_plante != null ? String(cultura.nr_plante) : '',
    nr_randuri: cultura.nr_randuri != null ? String(cultura.nr_randuri) : '',
    distanta_intre_randuri:
      cultura.distanta_intre_randuri != null ? String(cultura.distanta_intre_randuri) : '',
    sistem_irigare: cultura.sistem_irigare ?? '',
    data_plantarii: (cultura.data_plantarii ?? '').slice(0, 10),
    observatii: cultura.observatii ?? '',
  }
}

function formatStageLabel(
  value: string | null | undefined,
  grupBiologic?: GrupBiologic | null,
  cohort?: ParcelaStadiuCanonic['cohort'] | null
): string {
  if (!value?.trim()) return 'Stadiu nedefinit'
  const cod = normalizeStadiu(value)
  if (cod) return getLabelPentruGrup(cod, grupBiologic, { cohort })
  const normalized = value.replaceAll('_', ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getStadiuOrder(cod: StadiuCod, grupBiologic: GrupBiologic | null): number {
  if (grupBiologic) {
    const indexInGroup = getOrdineInGrup(cod, grupBiologic)
    if (indexInGroup >= 0) return indexInGroup
  }
  return getOrdine(cod) + 100
}

function getCurrentCanonicalStage(
  stages: ParcelaStadiuCanonic[],
  grupBiologic: GrupBiologic | null
): ParcelaStadiuCanonic | null {
  if (stages.length === 0) return null

  return [...stages].sort((a, b) => {
    const codA = normalizeStadiu(a.stadiu)
    const codB = normalizeStadiu(b.stadiu)
    const orderA = codA ? getStadiuOrder(codA, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderB = codB ? getStadiuOrder(codB, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderDiff = orderB - orderA
    if (orderDiff !== 0) return orderDiff

    const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

export function EditCulturaDialog({
  open,
  onOpenChange,
  cultura,
  tipUnitate,
  onSaved,
}: EditCulturaDialogProps) {
  const [customTipPlantaOverride, setCustomTipPlantaOverride] = useState<{
    culturaId: string | null
    enabled: boolean
  }>({
    culturaId: null,
    enabled: false,
  })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tip_planta: '',
      soi: '',
      suprafata_ocupata: '',
      nr_plante: '',
      nr_randuri: '',
      distanta_intre_randuri: '',
      sistem_irigare: '',
      data_plantarii: '',
      observatii: '',
    },
  })
  const tipPlanta = useWatch({ control: form.control, name: 'tip_planta' })
  const tipPlantaOptions = getCulturiOptions(tipUnitate)
  const currentCulturaId = cultura?.id ?? null
  const currentSezon = getCurrentSezon()
  const parcelaId = cultura?.solar_id ?? null
  const cropCod = useMemo(() => normalizeCropCod(tipPlanta) ?? normalizeCropCod(cultura?.tip_planta), [cultura?.tip_planta, tipPlanta])
  const grupBiologic = useMemo(() => getGrupBiologicForCropCod(cropCod), [cropCod])
  const forceCustomTipPlantaInput =
    customTipPlantaOverride.enabled && customTipPlantaOverride.culturaId === currentCulturaId
  const resolvedTipPlantaSelectValue = getTipPlantaSelectValue(tipPlanta, tipUnitate)
  const tipPlantaSelectValue =
    forceCustomTipPlantaInput || resolvedTipPlantaSelectValue === CUSTOM_CULTURA_OPTION
      ? CUSTOM_CULTURA_OPTION
      : resolvedTipPlantaSelectValue
  const fieldConfig = getCulturaFieldConfig(tipUnitate)
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
  const currentCanonicalStage = useMemo(
    () => getCurrentCanonicalStage(canonicalStages, grupBiologic),
    [canonicalStages, grupBiologic]
  )
  const isRubusMixt =
    grupBiologic === 'rubus' &&
    (
      seasonConfig?.sistem_conducere === 'mixt_floricane_primocane' ||
      canonicalStages.some((stage) => stage.cohort === 'floricane' || stage.cohort === 'primocane')
    )

  useEffect(() => {
    if (open && cultura) {
      form.reset(toFormValues(cultura))
    }
  }, [open, cultura, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!cultura) throw new Error('Cultură lipsă')
      return updateCultura(cultura.id, {
        tip_planta: values.tip_planta,
        soi: values.soi || null,
        suprafata_ocupata: values.suprafata_ocupata ? toDecimal(values.suprafata_ocupata) : null,
        nr_plante: values.nr_plante ? Number(values.nr_plante) : null,
        nr_randuri: values.nr_randuri ? Number(values.nr_randuri) : null,
        distanta_intre_randuri: values.distanta_intre_randuri
          ? toDecimal(values.distanta_intre_randuri)
          : null,
        sistem_irigare: values.sistem_irigare || null,
        data_plantarii: values.data_plantarii || null,
        observatii: values.observatii || null,
      })
    },
    onSuccess: () => {
      toast.success('Cultură actualizată')
      setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
      onOpenChange(false)
      onSaved()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  if (!cultura) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
        }
        onOpenChange(nextOpen)
      }}
      title="Editează cultură"
      footer={
        <DialogFormActions
          onCancel={() => {
            setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
            onOpenChange(false)
          }}
          onSave={form.handleSubmit((values) => mutation.mutate(values))}
          saving={mutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form
        className="space-y-4 pb-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="space-y-2">
          <Label>Tip plantă *</Label>
          <Select
            value={tipPlantaSelectValue || undefined}
            onValueChange={(value) => {
              if (value === CUSTOM_CULTURA_OPTION) {
                setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: true })
                form.setValue(
                  'tip_planta',
                  tipPlanta && !tipPlantaOptions.includes(tipPlanta) ? tipPlanta : '',
                  { shouldDirty: true, shouldValidate: true }
                )
                return
              }

              setCustomTipPlantaOverride({ culturaId: currentCulturaId, enabled: false })
              form.setValue('tip_planta', value, { shouldDirty: true, shouldValidate: true })
            }}
          >
            <SelectTrigger className="agri-control h-12 w-full px-3 text-base">
              <SelectValue placeholder="Alege tipul de plantă" />
            </SelectTrigger>
            <SelectContent>
              {tipPlantaOptions.map((option) => (
                <SelectItem
                  key={option}
                  value={option === 'Altele' ? CUSTOM_CULTURA_OPTION : option}
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tipPlantaSelectValue === CUSTOM_CULTURA_OPTION ? (
            <Input
              id="edit_tip_planta"
              className="agri-control h-12"
              placeholder={getTipPlantaPlaceholder(tipUnitate)}
              {...form.register('tip_planta')}
            />
          ) : null}
          {form.formState.errors.tip_planta ? (
            <p className="text-xs text-red-600">{form.formState.errors.tip_planta.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_soi">Soi</Label>
          <Input
            id="edit_soi"
            className="agri-control h-12"
            placeholder="Ex: Siriana F1"
            {...form.register('soi')}
          />
        </div>

        <NumericField
          id="edit_suprafata_ocupata"
          label="Suprafață ocupată (mp)"
          placeholder="Ex: 200"
          {...form.register('suprafata_ocupata')}
          error={form.formState.errors.suprafata_ocupata?.message}
        />

        <NumericField
          id="edit_nr_plante"
          label={fieldConfig.plantCountLabel}
          placeholder="Ex: 300"
          {...form.register('nr_plante')}
          error={form.formState.errors.nr_plante?.message}
        />

        {fieldConfig.showRowCount ? (
          <NumericField
            id="edit_nr_randuri"
            label={fieldConfig.rowCountLabel}
            placeholder="Ex: 8"
            {...form.register('nr_randuri')}
            error={form.formState.errors.nr_randuri?.message}
          />
        ) : null}

        {fieldConfig.showRowSpacing ? (
          <div className="space-y-2">
            <Label htmlFor="edit_distanta">{fieldConfig.rowSpacingLabel}</Label>
            <Input
              id="edit_distanta"
              className="agri-control h-12"
              inputMode="decimal"
              placeholder="Ex: 0.8"
              {...form.register('distanta_intre_randuri')}
            />
            {form.formState.errors.distanta_intre_randuri ? (
              <p className="text-xs text-red-600">
                {form.formState.errors.distanta_intre_randuri.message}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="edit_sistem_irigare">Sistem irigare</Label>
          <Input
            id="edit_sistem_irigare"
            className="agri-control h-12"
            placeholder="Ex: Picurare"
            {...form.register('sistem_irigare')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_data_plantarii">Data plantării</Label>
          <Input
            id="edit_data_plantarii"
            type="date"
            className="agri-control h-12"
            {...form.register('data_plantarii')}
          />
          {form.formState.errors.data_plantarii ? (
            <p className="text-xs text-red-600">{form.formState.errors.data_plantarii.message}</p>
          ) : null}
        </div>

        <div className="space-y-2 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 py-2">
          <Label>Stadiu curent</Label>
          <p className="text-sm font-semibold text-[var(--agri-text)]">
            {currentCanonicalStage
              ? formatStageLabel(currentCanonicalStage.stadiu, grupBiologic, currentCanonicalStage.cohort)
              : cultura.stadiu
                ? formatStageLabel(cultura.stadiu, grupBiologic)
                : 'Fără stadiu înregistrat'}
            {isRubusMixt && currentCanonicalStage?.cohort ? (
              <span className="ml-1 text-xs font-medium text-[var(--agri-text-muted)]">
                · {currentCanonicalStage.cohort === 'floricane' ? 'Floricane' : 'Primocane'}
              </span>
            ) : null}
          </p>
          {!currentCanonicalStage && cultura.stadiu ? (
            <p className="text-xs text-[var(--agri-text-muted)]">Informație veche, păstrată pentru istoric.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit_observatii_cultura">Observații</Label>
          <Textarea
            id="edit_observatii_cultura"
            rows={3}
            className="agri-control w-full px-3 py-2 text-base"
            {...form.register('observatii')}
          />
        </div>
      </form>
    </AppDialog>
  )
}
