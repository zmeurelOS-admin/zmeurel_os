'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'

import { NumericField } from '@/components/app/NumericField'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { UnitateTip } from '@/lib/parcele/unitate'
import { getCropsForUnitType } from '@/lib/supabase/queries/crops'
import { getCropVarietiesForCrop } from '@/lib/supabase/queries/crop-varieties'
import { formatM2ToHa } from '@/lib/utils/area'
import { queryKeys } from '@/lib/query-keys'

export interface ParcelFormValues {
  nume_parcela: string
  tip_unitate: 'camp' | 'solar' | 'livada'
  tip_fruct: string
  suprafata_m2: string
  soi_plantat: string
  cultura: string
  soi: string
  nr_randuri: string
  an_plantare: string
  nr_plante: string
  distanta_intre_randuri: string
  sistem_irigare: string
  data_plantarii: string
  status: string
  observatii: string
}

const toDecimal = (value: string) => Number(value.replace(',', '.').trim())

export const parcelFormSchema = z.object({
  nume_parcela: z.string().trim().min(1, 'Numele terenului este obligatoriu'),
  tip_unitate: z.enum(['camp', 'solar', 'livada']),
  tip_fruct: z.string().trim().min(1, 'Tipul culturii este obligatoriu'),
  suprafata_m2: z
    .string()
    .trim()
    .min(1, 'Suprafata este obligatorie')
    .refine((value) => Number.isFinite(toDecimal(value)) && toDecimal(value) > 0, {
      message: 'Suprafata trebuie sa fie un numar valid',
    }),
  soi_plantat: z.string(),
  cultura: z.string(),
  soi: z.string(),
  nr_randuri: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
    message: 'Numarul de randuri trebuie sa fie un numar intreg',
  }),
  an_plantare: z
    .string()
    .trim()
    .min(1, 'Anul plantarii este obligatoriu')
    .refine((value) => Number.isInteger(Number(value)), {
      message: 'Anul plantarii trebuie sa fie un numar intreg',
    }),
  nr_plante: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
    message: 'Numarul de plante trebuie sa fie un numar intreg',
  }),
  distanta_intre_randuri: z
    .string()
    .trim()
    .refine((value) => !value || (Number.isFinite(toDecimal(value)) && toDecimal(value) > 0), {
      message: 'Distanta intre randuri trebuie sa fie un numar valid',
    }),
  sistem_irigare: z.string(),
  data_plantarii: z.string().trim().refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: 'Data plantarii nu este valida',
  }),
  status: z.string().trim().min(1, 'Statusul este obligatoriu'),
  observatii: z.string(),
})

export const getParcelFormDefaults = (): ParcelFormValues => ({
  nume_parcela: '',
  tip_unitate: 'camp',
  tip_fruct: '',
  suprafata_m2: '',
  soi_plantat: '',
  cultura: '',
  soi: '',
  nr_randuri: '',
  an_plantare: String(new Date().getFullYear()),
  nr_plante: '',
  distanta_intre_randuri: '',
  sistem_irigare: '',
  data_plantarii: '',
  status: 'Activ',
  observatii: '',
})

interface ParcelFormProps {
  form: UseFormReturn<ParcelFormValues>
  soiuriDisponibile: string[]
}

const selectTriggerClass = 'agri-control h-12 w-full px-3 text-base'

const OTHER_CROP_VALUE = '__other_crop__'
const OTHER_VARIETY_VALUE = '__other_variety__'

function normalizeCropKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
}

function normalizeCropValue(value: string): string {
  const raw = value.trim()
  if (!raw) return ''

  const key = normalizeCropKey(raw)
  if (key === 'zmeura' || key === 'zmeure') return 'Zmeură'
  if (key === 'capsuni' || key === 'capsuna' || key === 'capsune') return 'Căpșuni'
  if (key === 'mure' || key === 'mura') return 'Mure'
  if (key === 'afine' || key === 'afina') return 'Afine'
  if (key === 'aronia') return 'Aronia'
  if (key === 'catina') return 'Cătină'

  return raw
}

function dedupeCrops(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cropName = normalizeCropValue(value)
    if (!cropName) continue
    const key = normalizeCropKey(cropName)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cropName)
  }

  return result
}

function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export function ParcelForm({ form, soiuriDisponibile: _soiuriDisponibile }: ParcelFormProps) {
  void _soiuriDisponibile
  const [customCropMode, setCustomCropMode] = useState(false)
  const [customVarietyMode, setCustomVarietyMode] = useState(false)

  const tipUnitate = form.watch('tip_unitate')
  const tipFruct = form.watch('tip_fruct')
  const soiPlantat = form.watch('soi_plantat')
  const suprafataValue = form.watch('suprafata_m2')
  const isSolar = tipUnitate === 'solar'

  const cropsQuery = useQuery({
    queryKey: queryKeys.crops(tipUnitate),
    queryFn: () => getCropsForUnitType(tipUnitate as UnitateTip),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const cropOptions = useMemo(
    () => dedupeCrops((cropsQuery.data ?? []).map((crop) => crop.name)),
    [cropsQuery.data]
  )
  const normalizedCrop = useMemo(() => normalizeCropValue(tipFruct), [tipFruct])
  const selectedCropOption = useMemo(() => {
    if (!normalizedCrop) return null
    const key = normalizeCropKey(normalizedCrop)
    return cropOptions.find((option) => normalizeCropKey(option) === key) ?? null
  }, [cropOptions, normalizedCrop])
  const selectedCropId = useMemo(() => {
    if (!selectedCropOption) return null
    return (
      (cropsQuery.data ?? []).find((crop) => normalizeCropKey(crop.name) === normalizeCropKey(selectedCropOption))
        ?.id ?? null
    )
  }, [cropsQuery.data, selectedCropOption])

  const varietiesQuery = useQuery({
    queryKey: queryKeys.cropVarieties(selectedCropId),
    queryFn: () => getCropVarietiesForCrop(selectedCropId ?? ''),
    enabled: Boolean(selectedCropId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const availableVarieties = useMemo(
    () => dedupeValues((varietiesQuery.data ?? []).map((variety) => variety.name)),
    [varietiesQuery.data]
  )

  useEffect(() => {
    if (normalizedCrop !== tipFruct) {
      form.setValue('tip_fruct', normalizedCrop, { shouldDirty: false, shouldValidate: true })
    }

    if (!normalizedCrop) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomCropMode(false)
      return
    }

    if (selectedCropOption && selectedCropOption !== tipFruct) {
      form.setValue('tip_fruct', selectedCropOption, { shouldDirty: false, shouldValidate: true })
    }

    setCustomCropMode(!selectedCropOption)
  }, [form, normalizedCrop, selectedCropOption, tipFruct])

  useEffect(() => {
    if (customCropMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomVarietyMode(true)
      return
    }

    if (!selectedCropOption) {
      setCustomVarietyMode(false)
      return
    }

    if (varietiesQuery.isLoading) {
      setCustomVarietyMode(false)
      return
    }

    if (availableVarieties.length === 0) {
      setCustomVarietyMode(true)
      return
    }

    if (!soiPlantat) {
      setCustomVarietyMode(false)
      return
    }

    setCustomVarietyMode(!availableVarieties.includes(soiPlantat))
  }, [availableVarieties, customCropMode, selectedCropOption, soiPlantat, varietiesQuery.isLoading])

  useEffect(() => {
    if (tipUnitate === 'solar') return
    form.setValue('cultura', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('soi', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('nr_randuri', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('distanta_intre_randuri', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('sistem_irigare', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('data_plantarii', '', { shouldDirty: false, shouldValidate: false })
  }, [form, tipUnitate])

  const cropSelectValue = customCropMode ? OTHER_CROP_VALUE : selectedCropOption ?? ''

  const handleCropChange = (value: string) => {
    if (value === OTHER_CROP_VALUE) {
      setCustomCropMode(true)
      setCustomVarietyMode(true)
      form.setValue('tip_fruct', '', { shouldDirty: true, shouldValidate: true })
      form.setValue('soi_plantat', '', { shouldDirty: true, shouldValidate: true })
      return
    }

    setCustomCropMode(false)
    setCustomVarietyMode(false)
    form.setValue('tip_fruct', value, { shouldDirty: true, shouldValidate: true })
    form.setValue('soi_plantat', '', { shouldDirty: true, shouldValidate: true })
  }

  const handleVarietyChange = (value: string) => {
    if (value === OTHER_VARIETY_VALUE) {
      setCustomVarietyMode(true)
      if (!soiPlantat || availableVarieties.includes(soiPlantat)) {
        form.setValue('soi_plantat', '', { shouldDirty: true, shouldValidate: true })
      }
      return
    }

    setCustomVarietyMode(false)
    form.setValue('soi_plantat', value, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tip unitate</Label>
        <Select
          value={tipUnitate}
          onValueChange={(value: 'camp' | 'solar' | 'livada') =>
            form.setValue('tip_unitate', value, { shouldDirty: true, shouldValidate: true })
          }
        >
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Alege tip unitate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="camp">Camp</SelectItem>
            <SelectItem value="solar">Solar</SelectItem>
            <SelectItem value="livada">Livada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nume_parcela">Nume teren</Label>
        <input
          id="nume_parcela"
          className="agri-control h-12 w-full px-3 text-base"
          placeholder="Teren Nord"
          {...form.register('nume_parcela')}
        />
        {form.formState.errors.nume_parcela ? (
          <p className="text-xs text-red-600">{form.formState.errors.nume_parcela.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Tip cultură</Label>
        <Select value={cropSelectValue} onValueChange={handleCropChange}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Alege tip cultură" />
          </SelectTrigger>
          <SelectContent>
            {cropOptions.map((crop) => (
              <SelectItem key={crop} value={crop}>
                {crop}
              </SelectItem>
            ))}
            {!cropsQuery.isLoading && cropOptions.length === 0 ? (
              <SelectItem value="__no_crops__" disabled>
                Nu exist? culturi pentru tipul selectat
              </SelectItem>
            ) : null}
            <SelectItem value={OTHER_CROP_VALUE}>Alta cultura</SelectItem>
          </SelectContent>
        </Select>
        {cropsQuery.isLoading ? <p className="text-xs text-muted-foreground">Se încarcă culturile...</p> : null}
        {form.formState.errors.tip_fruct ? (
          <p className="text-xs text-red-600">{form.formState.errors.tip_fruct.message}</p>
        ) : null}
      </div>

      {customCropMode ? (
        <div className="space-y-2">
          <Label htmlFor="custom_tip_fruct">Introduce cultura</Label>
          <input
            id="custom_tip_fruct"
            className="agri-control h-12 w-full px-3 text-base"
            placeholder="Introduce cultura"
            value={tipFruct}
            onChange={(event) =>
              form.setValue('tip_fruct', event.target.value, { shouldDirty: true, shouldValidate: true })
            }
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Soi plantat</Label>
        {customCropMode ? (
          <input
            id="soi_plantat_custom_crop"
            className="agri-control h-12 w-full px-3 text-base"
            placeholder="Ex: Jonkheer van Tets"
            value={soiPlantat}
            onChange={(event) =>
              form.setValue('soi_plantat', event.target.value, { shouldDirty: true, shouldValidate: true })
            }
          />
        ) : (
          <>
            <Select
              value={customVarietyMode ? OTHER_VARIETY_VALUE : soiPlantat || ''}
              onValueChange={handleVarietyChange}
              disabled={!selectedCropOption}
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue
                  placeholder={selectedCropOption ? 'Alege soi' : 'Selectează mai întâi tipul culturii'}
                />
              </SelectTrigger>
              <SelectContent>
                {!varietiesQuery.isLoading && availableVarieties.length === 0 ? (
                  <SelectItem value="__no_varieties__" disabled>
                    Nu exist? soiuri predefinite
                  </SelectItem>
                ) : null}
                {availableVarieties.map((soi) => (
                  <SelectItem key={soi} value={soi}>
                    {soi}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_VARIETY_VALUE}>Alt soi</SelectItem>
              </SelectContent>
            </Select>
            {varietiesQuery.isLoading ? <p className="text-xs text-muted-foreground">Se încarcă soiurile...</p> : null}

            {customVarietyMode ? (
              <div className="space-y-2">
                <Label htmlFor="soi_plantat_custom">Numele soiului</Label>
                <input
                  id="soi_plantat_custom"
                  className="agri-control h-12 w-full px-3 text-base"
                  placeholder="Scrie numele soiului"
                  value={soiPlantat}
                  onChange={(event) =>
                    form.setValue('soi_plantat', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <NumericField
        id="suprafata_m2"
        label="Suprafață (m2)"
        placeholder="1200"
        {...form.register('suprafata_m2')}
        error={form.formState.errors.suprafata_m2?.message}
      />
      <p className="text-xs text-muted-foreground">≈ {formatM2ToHa(suprafataValue)}</p>

      <NumericField
        id="an_plantare"
        label="An plantare"
        placeholder={String(new Date().getFullYear())}
        {...form.register('an_plantare')}
        error={form.formState.errors.an_plantare?.message}
      />

      {isSolar ? (
        <div className="space-y-4 rounded-2xl border border-[var(--agri-border,#e5e7eb)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date solar</p>

          <div className="space-y-2">
            <Label htmlFor="cultura">Cultura</Label>
            <input
              id="cultura"
              className="agri-control h-12 w-full px-3 text-base"
              placeholder="Ex: Rosii"
              {...form.register('cultura')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="soi">Soi</Label>
            <input
              id="soi"
              className="agri-control h-12 w-full px-3 text-base"
              placeholder="Ex: Prekos F1"
              {...form.register('soi')}
            />
          </div>

          <NumericField
            id="nr_randuri"
            label="Numar randuri"
            placeholder="0"
            {...form.register('nr_randuri')}
            error={form.formState.errors.nr_randuri?.message}
          />

          <NumericField
            id="nr_plante"
            label="Numar plante"
            placeholder="0"
            {...form.register('nr_plante')}
            error={form.formState.errors.nr_plante?.message}
          />

          <div className="space-y-2">
            <Label htmlFor="distanta_intre_randuri">Distanta intre randuri (m)</Label>
            <input
              id="distanta_intre_randuri"
              className="agri-control h-12 w-full px-3 text-base"
              placeholder="Ex: 0.8"
              inputMode="decimal"
              {...form.register('distanta_intre_randuri')}
            />
            {form.formState.errors.distanta_intre_randuri ? (
              <p className="text-xs text-red-600">{form.formState.errors.distanta_intre_randuri.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sistem_irigare">Sistem irigare</Label>
            <input
              id="sistem_irigare"
              className="agri-control h-12 w-full px-3 text-base"
              placeholder="Ex: Picurare"
              {...form.register('sistem_irigare')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_plantarii">Data plantarii</Label>
            <input
              id="data_plantarii"
              type="date"
              className="agri-control h-12 w-full px-3 text-base"
              {...form.register('data_plantarii')}
            />
            {form.formState.errors.data_plantarii ? (
              <p className="text-xs text-red-600">{form.formState.errors.data_plantarii.message}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <NumericField
          id="nr_plante"
          label="Numar plante"
          placeholder="0"
          {...form.register('nr_plante')}
          error={form.formState.errors.nr_plante?.message}
        />
      )}

      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={form.watch('status')}
          onValueChange={(value) => form.setValue('status', value, { shouldDirty: true })}
        >
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Alege status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Activ">Activ</SelectItem>
            <SelectItem value="Inactiv">Inactiv</SelectItem>
            <SelectItem value="In Pregatire">In Pregatire</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observatii">Observatii</Label>
        <Textarea
          id="observatii"
          rows={4}
          placeholder="Detalii suplimentare"
          className="agri-control w-full px-3 py-2 text-base"
          {...form.register('observatii')}
        />
      </div>
    </div>
  )
}
