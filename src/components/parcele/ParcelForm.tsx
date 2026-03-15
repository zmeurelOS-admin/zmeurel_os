'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Controller, type UseFormReturn, useFieldArray } from 'react-hook-form'
import { z } from 'zod'

import { NumericField } from '@/components/app/NumericField'
import { Input } from '@/components/ui/input'
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
import { queryKeys } from '@/lib/query-keys'
import { getCropVarietiesForCrop } from '@/lib/supabase/queries/crop-varieties'
import { getCropsForUnitType } from '@/lib/supabase/queries/crops'
import { formatM2ToHa } from '@/lib/utils/area'

export interface ParcelFormValues {
  nume_parcela: string
  tip_unitate: 'camp' | 'solar' | 'livada'
  tip_fruct: string
  suprafata_m2: string
  soi_plantat: string
  cultura: string
  soi: string
  crop_rows: Array<{
    id: string
    culture: string
    variety: string
    plantCount: string
  }>
  nr_randuri: string
  an_plantare: string
  nr_plante: string
  distanta_intre_randuri: string
  sistem_irigare: string
  data_plantarii: string
  status: string
  stadiu: string
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
    .min(1, 'Suprafața este obligatorie')
    .refine((value) => Number.isFinite(toDecimal(value)) && toDecimal(value) > 0, {
      message: 'Suprafața trebuie să fie un număr valid',
    }),
  soi_plantat: z.string(),
  cultura: z.string(),
  soi: z.string(),
  crop_rows: z.array(
    z.object({
      id: z.string(),
      culture: z.string(),
      variety: z.string(),
      plantCount: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
        message: 'Numărul de plante trebuie să fie un număr întreg',
      }),
    }),
  ),
  nr_randuri: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
    message: 'Numărul de rânduri trebuie să fie un număr întreg',
  }),
  an_plantare: z
    .string()
    .trim()
    .min(1, 'Anul plantării este obligatoriu')
    .refine((value) => Number.isInteger(Number(value)), {
      message: 'Anul plantării trebuie să fie un număr întreg',
    }),
  nr_plante: z.string().trim().refine((value) => !value || Number.isInteger(Number(value)), {
    message: 'Numărul de plante trebuie să fie un număr întreg',
  }),
  distanta_intre_randuri: z
    .string()
    .trim()
    .refine((value) => !value || (Number.isFinite(toDecimal(value)) && toDecimal(value) > 0), {
      message: 'Distanța între rânduri trebuie să fie un număr valid',
    }),
  sistem_irigare: z.string(),
  data_plantarii: z.string().trim().refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: 'Data plantării nu este validă',
  }),
  status: z.string().trim().min(1, 'Statusul este obligatoriu'),
  stadiu: z.string(),
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
  crop_rows: [{ id: 'crop-1', culture: '', variety: '', plantCount: '' }],
  nr_randuri: '',
  an_plantare: String(new Date().getFullYear()),
  nr_plante: '',
  distanta_intre_randuri: '',
  sistem_irigare: '',
  data_plantarii: '',
  status: 'Activ',
  stadiu: 'crestere',
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
  const { fields: cropFields, append: appendCropRow, remove: removeCropRow, replace: replaceCropRows } = useFieldArray({
    control: form.control,
    name: 'crop_rows',
  })

  const tipUnitate = form.watch('tip_unitate')
  const tipFruct = form.watch('tip_fruct')
  const soiPlantat = form.watch('soi_plantat')
  const suprafataValue = form.watch('suprafata_m2')
  const isSolar = tipUnitate === 'solar'
  const cropRows = form.watch('crop_rows')

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
      (cropsQuery.data ?? []).find(
        (crop) => normalizeCropKey(crop.name) === normalizeCropKey(selectedCropOption)
      )?.id ?? null
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
    if (cropsQuery.isError && !tipFruct) {
      setCustomCropMode(true)
    }
  }, [cropsQuery.isError, tipFruct])

  useEffect(() => {
    if (varietiesQuery.isError && !soiPlantat) {
      setCustomVarietyMode(true)
    }
  }, [soiPlantat, varietiesQuery.isError])

  useEffect(() => {
    if (normalizedCrop !== tipFruct) {
      form.setValue('tip_fruct', normalizedCrop, { shouldDirty: false, shouldValidate: true })
    }

    if (!normalizedCrop) {
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
    form.setValue('crop_rows', [{ id: 'crop-1', culture: '', variety: '', plantCount: '' }], {
      shouldDirty: false,
      shouldValidate: false,
    })
    form.setValue('nr_randuri', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('distanta_intre_randuri', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('sistem_irigare', '', { shouldDirty: false, shouldValidate: false })
    form.setValue('data_plantarii', '', { shouldDirty: false, shouldValidate: false })
  }, [form, tipUnitate])

  useEffect(() => {
    if (!isSolar) return

    if (!cropRows || cropRows.length === 0) {
      replaceCropRows([{ id: 'crop-1', culture: tipFruct || '', variety: soiPlantat || '', plantCount: form.getValues('nr_plante') || '' }])
      return
    }

    const normalizedRows = cropRows
      .map((row, index) => ({
        id: row.id || `crop-${index + 1}`,
        culture: row.culture.trim(),
        variety: row.variety.trim(),
        plantCount: row.plantCount.trim(),
      }))
      .filter((row) => row.culture || row.variety || row.plantCount)

    const primary = normalizedRows[0]
    const totalPlants = normalizedRows.reduce((sum, row) => sum + (Number(row.plantCount || 0) || 0), 0)

    form.setValue('cultura', primary?.culture || tipFruct || '', { shouldDirty: false, shouldValidate: false })
    form.setValue('soi', primary?.variety || soiPlantat || '', { shouldDirty: false, shouldValidate: false })
    form.setValue('nr_plante', totalPlants > 0 ? String(totalPlants) : '', { shouldDirty: false, shouldValidate: false })

    if (primary?.culture && primary.culture !== tipFruct) {
      form.setValue('tip_fruct', primary.culture, { shouldDirty: false, shouldValidate: true })
    }

    if (primary?.variety && primary.variety !== soiPlantat) {
      form.setValue('soi_plantat', primary.variety, { shouldDirty: false, shouldValidate: true })
    }
  }, [cropRows, form, isSolar, replaceCropRows, soiPlantat, tipFruct])

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
            <SelectValue placeholder="Alege tipul unității" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="camp">Câmp</SelectItem>
            <SelectItem value="solar">Solar</SelectItem>
            <SelectItem value="livada">Livadă</SelectItem>
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
            <SelectValue placeholder="Alege tipul culturii" />
          </SelectTrigger>
          <SelectContent>
            {cropOptions.map((crop) => (
              <SelectItem key={crop} value={crop}>
                {crop}
              </SelectItem>
            ))}
            {!cropsQuery.isLoading && cropOptions.length === 0 ? (
              <SelectItem value="__no_crops__" disabled>
                Nu există culturi pentru tipul selectat
              </SelectItem>
            ) : null}
            <SelectItem value={OTHER_CROP_VALUE}>Altă cultură</SelectItem>
          </SelectContent>
        </Select>
        {cropsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Se încarcă culturile...</p>
        ) : null}
        {cropsQuery.isError ? (
          <p className="text-xs text-amber-700">
            Nu am putut încărca lista de culturi. Poți introduce cultura manual.
          </p>
        ) : null}
        {form.formState.errors.tip_fruct ? (
          <p className="text-xs text-red-600">{form.formState.errors.tip_fruct.message}</p>
        ) : null}
      </div>

      {customCropMode ? (
        <div className="space-y-2">
          <Label htmlFor="custom_tip_fruct">Introdu cultura</Label>
          <input
            id="custom_tip_fruct"
            className="agri-control h-12 w-full px-3 text-base"
            placeholder="Ex: Zmeură"
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
            placeholder="Ex: Glen Ample"
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
                  placeholder={
                    selectedCropOption ? 'Alege soiul' : 'Selectează mai întâi tipul culturii'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {!varietiesQuery.isLoading && availableVarieties.length === 0 ? (
                  <SelectItem value="__no_varieties__" disabled>
                    Nu există soiuri predefinite
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
            {varietiesQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Se încarcă soiurile...</p>
            ) : null}
            {varietiesQuery.isError ? (
              <p className="text-xs text-amber-700">
                Nu am putut încărca lista de soiuri. Poți introduce soiul manual.
              </p>
            ) : null}

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
        label="Suprafață (m²)"
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

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[var(--agri-text)]">Culturi în solar</p>
              <p className="text-xs text-muted-foreground">Adaugă una sau mai multe culturi pentru același solar.</p>
            </div>

            <div className="space-y-3">
              {cropFields.map((field, index) => (
                <div key={field.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="space-y-2 md:col-span-4">
                      <Label>Cultură</Label>
                      <Input
                        className="agri-control h-11"
                        placeholder="Ex: Roșii"
                        {...form.register(`crop_rows.${index}.culture`)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-4">
                      <Label>Soi</Label>
                      <Input
                        className="agri-control h-11"
                        placeholder="Ex: Inimă de bou"
                        {...form.register(`crop_rows.${index}.variety`)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <Label>Nr. plante</Label>
                      <Controller
                        control={form.control}
                        name={`crop_rows.${index}.plantCount`}
                        render={({ field }) => (
                          <Input
                            className="agri-control h-11"
                            inputMode="numeric"
                            placeholder="0"
                            {...field}
                          />
                        )}
                      />
                    </div>

                    <div className="flex items-end md:col-span-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (cropFields.length > 1) {
                            removeCropRow(index)
                          } else {
                            form.setValue(`crop_rows.${index}.culture`, '', { shouldDirty: true })
                            form.setValue(`crop_rows.${index}.variety`, '', { shouldDirty: true })
                            form.setValue(`crop_rows.${index}.plantCount`, '', { shouldDirty: true })
                          }
                        }}
                        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700"
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                appendCropRow({
                  id: `crop-${Date.now()}`,
                  culture: '',
                  variety: '',
                  plantCount: '',
                })
              }
              className="inline-flex h-9 items-center rounded-xl border border-[var(--agri-border)] px-3 text-xs font-semibold text-[var(--agri-text)]"
            >
              + Adaugă cultură
            </button>
          </div>

          <NumericField
            id="nr_randuri"
            label="Număr rânduri"
            placeholder="0"
            {...form.register('nr_randuri')}
            error={form.formState.errors.nr_randuri?.message}
          />

          <NumericField
            id="nr_plante"
            label="Număr plante"
            placeholder="0"
            {...form.register('nr_plante')}
            error={form.formState.errors.nr_plante?.message}
          />

          <div className="space-y-2">
            <Label htmlFor="distanta_intre_randuri">Distanța între rânduri (m)</Label>
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
            <Label htmlFor="data_plantarii">Data plantării</Label>
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
          label="Număr plante"
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
            <SelectValue placeholder="Alege statusul" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Activ">Activ</SelectItem>
            <SelectItem value="Inactiv">Inactiv</SelectItem>
            <SelectItem value="In Pregatire">În pregătire</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Stadiu de creștere</Label>
        <Select
          value={form.watch('stadiu')}
          onValueChange={(value) => form.setValue('stadiu', value, { shouldDirty: true })}
        >
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Alege stadiul" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plantare">🌱 Plantare</SelectItem>
            <SelectItem value="crestere">🌿 Creștere</SelectItem>
            <SelectItem value="inflorire">🌸 Înflorire</SelectItem>
            <SelectItem value="cules">🫐 Cules</SelectItem>
            <SelectItem value="repaus">❄️ Repaus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observatii">Observații</Label>
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
