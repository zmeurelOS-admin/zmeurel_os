'use client'

import { useState } from 'react'
import { type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'

import { ParcelFormSummary } from '@/components/parcele/ParcelFormSummary'
import { applyScopDefaults, ParcelUsageToggleCard } from '@/components/parcele/ParcelUsageFields'
import { NumericField } from '@/components/app/NumericField'
import { Button } from '@/components/ui/button'
import {
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
} from '@/components/ui/form-dialog-layout'
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
import {
  formatEmojiOptionLabel,
  getCultureSelectValue,
  getCulturiOptionsForTip,
  getOptionDisplayLabel,
  getParcelScopOptions,
  getParcelStatusOperationalOptions,
  getParcelStatusOptions,
  getParcelUnitateOptions,
  getSoiOptionsForCultura,
  getSoiSelectValue,
  isKnownCultureForTip,
  isKnownVarietyForCulture,
  MANUAL_CULTURE_OPTION_VALUE,
  MANUAL_VARIETY_OPTION_VALUE,
  serializeParcelLegacyCropLabel,
  SOLAR_CULTURA_MESSAGE,
} from '@/lib/parcele/parcel-form-options'
import {
  PARCELA_SCOPURI,
  STATUS_OPERATIONAL_VALUES,
  type ParcelaScop,
  type StatusOperational,
} from '@/lib/parcele/dashboard-relevance'
import { toast } from '@/lib/ui/toast'
import { formatM2ToHa, parseLocalizedNumber } from '@/lib/utils/area'

export interface ParcelFormValues {
  nume_parcela: string
  tip_unitate: 'camp' | 'solar' | 'livada' | 'cultura_mare'
  tip_fruct: string
  suprafata_m2: string
  latitudine: string
  longitudine: string
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
  rol: ParcelaScop
  apare_in_dashboard: boolean
  contribuie_la_productie: boolean
  status_operational: StatusOperational
  status: string
  observatii: string
}

const toDecimal = (value: string) => parseLocalizedNumber(value)

export const parcelFormSchema = z.object({
  nume_parcela: z.string().trim().min(1, 'Numele terenului este obligatoriu'),
  tip_unitate: z.enum(['camp', 'solar', 'livada', 'cultura_mare']),
  tip_fruct: z.string(),
  suprafata_m2: z
    .string()
    .trim()
    .min(1, 'Suprafața este obligatorie')
    .refine((value) => Number.isFinite(toDecimal(value)) && toDecimal(value) > 0, {
      message: 'Suprafața trebuie să fie un număr valid',
    }),
  latitudine: z
    .string()
    .trim()
    .refine((value) => !value || Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Latitudinea trebuie să fie un număr valid',
    }),
  longitudine: z
    .string()
    .trim()
    .refine((value) => !value || Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Longitudinea trebuie să fie un număr valid',
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
  an_plantare: z.string(),
  nr_plante: z
    .string()
    .trim()
    .refine(
      (value) => !value || (Number.isInteger(Number(value)) && Number(value) > 0),
      { message: 'Numărul de plante trebuie să fie un număr întreg pozitiv' },
    ),
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
  rol: z.enum(PARCELA_SCOPURI),
  apare_in_dashboard: z.boolean(),
  contribuie_la_productie: z.boolean(),
  status_operational: z.enum(STATUS_OPERATIONAL_VALUES),
  status: z.string().trim().min(1, 'Statusul este obligatoriu'),
  observatii: z.string(),
})

export const getParcelFormDefaults = (): ParcelFormValues => ({
  nume_parcela: '',
  tip_unitate: 'camp',
  tip_fruct: '',
  suprafata_m2: '',
  latitudine: '',
  longitudine: '',
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
  rol: 'comercial',
  apare_in_dashboard: true,
  contribuie_la_productie: true,
  status_operational: 'activ',
  status: 'Activ',
  observatii: '',
})

interface ParcelFormProps {
  form: UseFormReturn<ParcelFormValues>
  soiuriDisponibile: string[]
}

const selectTriggerClass = 'agri-control h-11 w-full px-3 text-base md:h-10'

export function ParcelForm({ form, soiuriDisponibile: _soiuriDisponibile }: ParcelFormProps) {
  void _soiuriDisponibile

  const tipUnitate = form.watch('tip_unitate')
  const culturaValue = form.watch('cultura').trim()
  const soiValue = form.watch('soi').trim()
  const suprafataValue = form.watch('suprafata_m2')
  const parcelName = form.watch('nume_parcela').trim() || 'Teren nou'
  const scopeValue = form.watch('rol')
  const statusOperational = form.watch('status_operational')
  const statusValue = form.watch('status').trim() || '—'
  const latitudine = form.watch('latitudine').trim()
  const longitudine = form.watch('longitudine').trim()
  const [geoLoading, setGeoLoading] = useState(false)
  const [manualCultureSelected, setManualCultureSelected] = useState(false)
  const [manualSoiSelected, setManualSoiSelected] = useState(false)
  const [geoStatus, setGeoStatus] = useState<{
    state: 'idle' | 'denied' | 'error' | 'success' | 'unsupported'
    message?: string
  }>({
    state: 'idle',
  })

  const nrPlanteValue = form.watch('nr_plante').trim()
  const validArea = suprafataValue.trim() ? parseLocalizedNumber(suprafataValue) : 0
  const areaLabel =
    suprafataValue.trim() && validArea > 0
      ? `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(validArea)} m² · ${formatM2ToHa(suprafataValue)}`
      : '—'
  const isCamp = tipUnitate === 'camp'
  const campPlantCountSummary =
    isCamp &&
    nrPlanteValue &&
    Number.isInteger(Number(nrPlanteValue)) &&
    Number(nrPlanteValue) > 0
      ? `${new Intl.NumberFormat('ro-RO').format(Number(nrPlanteValue))} plante`
      : isCamp
        ? '—'
        : null
  const locationLabel =
    latitudine && longitudine ? `${latitudine}, ${longitudine}` : latitudine || longitudine || 'Coordonate necompletate'
  const isSolar = tipUnitate === 'solar'
  const unitateOptions = getParcelUnitateOptions()
  const scopeOptions = getParcelScopOptions()
  const statusOperationalOptions = getParcelStatusOperationalOptions()
  const statusOptions = getParcelStatusOptions()
  const culturaOptions = getCulturiOptionsForTip(tipUnitate, culturaValue)
  const soiOptions = getSoiOptionsForCultura(culturaValue, soiValue)
  const hasKnownCulture = isKnownCultureForTip(tipUnitate, culturaValue)
  const hasKnownVariety = isKnownVarietyForCulture(culturaValue, soiValue)
  const isManualCulture = !isSolar && (manualCultureSelected || (Boolean(culturaValue) && !hasKnownCulture))
  const cultureSelectValue = isManualCulture
    ? MANUAL_CULTURE_OPTION_VALUE
    : getCultureSelectValue(tipUnitate, culturaValue)
  const usesManualSoi = !isSolar && !isManualCulture && (manualSoiSelected || (Boolean(soiValue) && !hasKnownVariety))
  const soiSelectValue = !isSolar && !isManualCulture
    ? usesManualSoi
      ? MANUAL_VARIETY_OPTION_VALUE
      : getSoiSelectValue(culturaValue, soiValue)
    : MANUAL_VARIETY_OPTION_VALUE
  const cultureLabel = isSolar ? 'Se adaugă ulterior' : getOptionDisplayLabel(culturaOptions, culturaValue, '🌿')
  const varietyLabel = isSolar ? '—' : getOptionDisplayLabel(soiOptions, soiValue, '🌿')
  const typeLabel = getOptionDisplayLabel(unitateOptions, tipUnitate, '🌿')
  const togglesOff = scopeValue !== 'comercial'

  const syncCultureFields = ({
    cultura,
    soi,
    shouldDirty,
  }: {
    cultura: string
    soi: string
    shouldDirty: boolean
  }) => {
    const nextLegacy = serializeParcelLegacyCropLabel(cultura, soi)
    form.setValue('cultura', cultura, { shouldDirty, shouldValidate: false })
    form.setValue('tip_fruct', cultura, { shouldDirty, shouldValidate: false })
    form.setValue('soi', soi, { shouldDirty, shouldValidate: false })
    form.setValue('soi_plantat', nextLegacy, { shouldDirty, shouldValidate: false })
  }

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus({
        state: 'unsupported',
        message: 'Poți adăuga manual coordonatele.',
      })
      toast.error('Browserul nu suportă geolocalizare')
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        form.setValue('latitudine', String(lat), { shouldDirty: true, shouldValidate: true })
        form.setValue('longitudine', String(lng), { shouldDirty: true, shouldValidate: true })
        setGeoLoading(false)
        setGeoStatus({ state: 'success', message: 'Locația curentă a fost completată' })
        toast.success('Locație detectată')
      },
      (error) => {
        setGeoLoading(false)

        if (error.code === 1) {
          setGeoStatus({
            state: 'denied',
            message: 'Locația nu e disponibilă. Poți adăuga coordonatele manual mai târziu.',
          })
          toast.error('Permite accesul la locație din setările browserului')
          return
        }
        setGeoStatus({ state: 'error', message: 'Nu s-a putut determina locația. Încearcă din nou.' })
        toast.error(error.code === 3 ? 'Timeout. Încearcă din nou.' : 'Locația nu e disponibilă. Adaugă manual coordonatele.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  return (
    <DesktopFormGrid
      className="md:grid-cols-[minmax(0,1fr)_17.5rem] md:gap-3.5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_18.5rem]"
      aside={
        <ParcelFormSummary
          parcelName={parcelName}
          typeLabel={typeLabel}
          cultureLabel={cultureLabel}
          varietyLabel={varietyLabel}
          statusLabel={statusValue}
          areaLabel={areaLabel}
          locationLabel={locationLabel}
          solarCultureMessage={isSolar ? SOLAR_CULTURA_MESSAGE : null}
          campPlantCountLabel={campPlantCountSummary}
          className="md:rounded-[22px] md:p-4 lg:p-[1.125rem]"
        />
      }
    >
      <FormDialogSection>
        <DesktopFormPanel>
          <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-x-3 md:gap-y-0">
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="nume_parcela">Nume teren *</Label>
                <Input
                  id="nume_parcela"
                  className="agri-control h-11 w-full px-3 text-base md:h-10"
                  placeholder="Teren Nord"
                  {...form.register('nume_parcela')}
                />
                {form.formState.errors.nume_parcela ? (
                  <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.nume_parcela.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label>Tip *</Label>
                <Select
                  value={tipUnitate}
                  onValueChange={(value: 'camp' | 'solar' | 'livada' | 'cultura_mare') => {
                    form.setValue('tip_unitate', value, { shouldDirty: true, shouldValidate: true })

                    if (value !== 'camp') {
                      form.setValue('nr_plante', '', { shouldDirty: true, shouldValidate: true })
                    }

                    if (value === 'solar') {
                      setManualCultureSelected(false)
                      setManualSoiSelected(false)
                      syncCultureFields({ cultura: '', soi: '', shouldDirty: true })
                      return
                    }

                    if (!culturaValue) {
                      setManualCultureSelected(false)
                      setManualSoiSelected(false)
                      return
                    }

                    if (!isKnownCultureForTip(value, culturaValue)) {
                      setManualCultureSelected(true)
                      setManualSoiSelected(true)
                      return
                    }

                    setManualCultureSelected(false)
                    setManualSoiSelected(Boolean(soiValue) && !isKnownVarietyForCulture(culturaValue, soiValue))
                  }}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Alege tipul unității" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitateOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {formatEmojiOptionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isSolar ? (
                <div className="space-y-1.5">
                  <Label>Cultură</Label>
                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5 text-sm text-[var(--text-secondary)]">
                    {SOLAR_CULTURA_MESSAGE}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="parcela_cultura">Cultură</Label>
                  <Select
                    value={cultureSelectValue}
                    onValueChange={(value) => {
                      if (value === '__none') {
                        setManualCultureSelected(false)
                        setManualSoiSelected(false)
                        syncCultureFields({ cultura: '', soi: '', shouldDirty: true })
                        return
                      }

                      if (value === MANUAL_CULTURE_OPTION_VALUE) {
                        setManualCultureSelected(true)
                        setManualSoiSelected(true)
                        syncCultureFields({ cultura: '', soi: '', shouldDirty: true })
                        return
                      }

                      setManualCultureSelected(false)
                      setManualSoiSelected(false)
                      syncCultureFields({ cultura: value, soi: '', shouldDirty: true })
                    }}
                  >
                    <SelectTrigger id="parcela_cultura" className={selectTriggerClass}>
                      <SelectValue placeholder="Selectează cultura" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Alege cultura</SelectItem>
                      {culturaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {formatEmojiOptionLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isManualCulture ? (
                    <Input
                      className="agri-control h-10 w-full px-3 text-sm"
                      placeholder="Completează cultura manual"
                      value={culturaValue}
                      onChange={(event) =>
                        syncCultureFields({
                          cultura: event.target.value,
                          soi: soiValue,
                          shouldDirty: true,
                        })
                      }
                    />
                  ) : null}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Status *</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) => form.setValue('status', value, { shouldDirty: true })}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Alege statusul" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {formatEmojiOptionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ParcelUsageToggleCard
                label="Afișează în dashboard"
                description="Arată pe pagina principală"
                checked={form.watch('apare_in_dashboard')}
                disabled={togglesOff}
                onCheckedChange={(value) => form.setValue('apare_in_dashboard', value, { shouldDirty: true })}
              />
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label>Scop</Label>
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)]"
                    title="Alege cum este folosit terenul în fermă."
                  >
                    ?
                  </span>
                </div>
                <Select
                  value={scopeValue}
                  onValueChange={(value) => {
                    const next = value as ParcelaScop
                    form.setValue('rol', next, { shouldDirty: true, shouldValidate: true })
                    const defs = applyScopDefaults(next)
                    form.setValue('apare_in_dashboard', defs.apare_in_dashboard, { shouldDirty: true })
                    form.setValue('contribuie_la_productie', defs.contribuie_la_productie, { shouldDirty: true })
                  }}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {formatEmojiOptionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Situație operațională</Label>
                <Select
                  value={statusOperational}
                  onValueChange={(value) =>
                    form.setValue('status_operational', value as StatusOperational, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOperationalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {formatEmojiOptionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isSolar ? (
                <div className="space-y-1.5">
                  <Label htmlFor="parcela_soi">Soi</Label>
                  {isManualCulture ? (
                    <Input
                      id="parcela_soi"
                      className="agri-control h-10 w-full px-3 text-sm"
                      placeholder="Completează soiul manual"
                      value={soiValue}
                      onChange={(event) =>
                        syncCultureFields({
                          cultura: culturaValue,
                          soi: event.target.value,
                          shouldDirty: true,
                        })
                      }
                    />
                  ) : culturaValue ? (
                    <>
                      <Select
                        value={soiSelectValue}
                        onValueChange={(value) => {
                          if (value === '__none') {
                            setManualSoiSelected(false)
                            syncCultureFields({
                              cultura: culturaValue,
                              soi: '',
                              shouldDirty: true,
                            })
                            return
                          }

                          if (value === MANUAL_VARIETY_OPTION_VALUE) {
                            setManualSoiSelected(true)
                            syncCultureFields({
                              cultura: culturaValue,
                              soi: '',
                              shouldDirty: true,
                            })
                            return
                          }

                          setManualSoiSelected(false)
                          syncCultureFields({
                            cultura: culturaValue,
                            soi: value,
                            shouldDirty: true,
                          })
                        }}
                      >
                        <SelectTrigger id="parcela_soi" className={selectTriggerClass}>
                          <SelectValue placeholder="Selectează soiul" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Alege soiul</SelectItem>
                          {soiOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {formatEmojiOptionLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {soiSelectValue === MANUAL_VARIETY_OPTION_VALUE ? (
                        <Input
                          className="agri-control h-10 w-full px-3 text-sm"
                          placeholder="Completează soiul manual"
                          value={soiValue}
                          onChange={(event) =>
                            syncCultureFields({
                              cultura: culturaValue,
                              soi: event.target.value,
                              shouldDirty: true,
                            })
                          }
                        />
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5 text-sm text-[var(--text-secondary)]">
                      Alege mai întâi cultura ca să vezi soiurile potrivite.
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="suprafata_m2">Suprafață (m²) *</Label>
                <Input
                  id="suprafata_m2"
                  inputMode="decimal"
                  className="agri-control h-11 w-full px-3 text-base md:h-10"
                  placeholder="1200"
                  {...form.register('suprafata_m2')}
                />
                {form.formState.errors.suprafata_m2 ? (
                  <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.suprafata_m2.message}</p>
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">≈ {formatM2ToHa(suprafataValue)}</p>
                )}
              </div>

              {isCamp ? (
                <NumericField
                  id="parcela_nr_plante"
                  label="Număr plante"
                  placeholder="Ex: 1500"
                  {...form.register('nr_plante')}
                  error={form.formState.errors.nr_plante?.message}
                />
              ) : null}

              <ParcelUsageToggleCard
                label="Contribuie la producție și vânzări"
                description="Include în rapoarte comerciale"
                checked={form.watch('contribuie_la_productie')}
                disabled={togglesOff}
                onCheckedChange={(value) => form.setValue('contribuie_la_productie', value, { shouldDirty: true })}
              />

              {togglesOff ? (
                <p className="text-xs text-[var(--text-tertiary)]">
                  Pentru scopuri necomerciale, opțiunile comerciale rămân dezactivate.
                </p>
              ) : null}
            </div>

            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="latitudine">Latitudine</Label>
                <Input
                  id="latitudine"
                  inputMode="decimal"
                  placeholder="47.6514"
                  className="agri-control h-11 w-full px-3 text-base md:h-10"
                  {...form.register('latitudine')}
                />
                {form.formState.errors.latitudine ? (
                  <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.latitudine.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="longitudine">Longitudine</Label>
                <Input
                  id="longitudine"
                  inputMode="decimal"
                  placeholder="26.2553"
                  className="agri-control h-11 w-full px-3 text-base md:h-10"
                  {...form.register('longitudine')}
                />
                {form.formState.errors.longitudine ? (
                  <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.longitudine.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5" title={geoStatus.state === 'denied' ? 'Permite accesul la locație' : undefined}>
                <Label>Locație automată</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="agri-cta min-h-10 w-full rounded-xl text-sm"
                  onClick={handleUseCurrentLocation}
                  disabled={geoStatus.state === 'denied' || geoLoading}
                >
                  {geoLoading ? 'Se detectează...' : 'Folosește locația curentă'}
                </Button>
                {geoStatus.state === 'denied' ? (
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Locația nu e disponibilă. Poți adăuga coordonatele manual mai târziu.
                  </p>
                ) : geoStatus.state === 'unsupported' ? (
                  <p className="text-xs text-[var(--text-tertiary)]">Poți adăuga manual coordonatele.</p>
                ) : geoStatus.state === 'error' ? (
                  <p className="text-xs text-[var(--text-tertiary)]">{geoStatus.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="observatii">Observații</Label>
                <Textarea
                  id="observatii"
                  rows={3}
                  placeholder="Detalii suplimentare"
                  className="agri-control min-h-[4rem] w-full px-3 py-2 text-base md:min-h-[4.5rem]"
                  {...form.register('observatii')}
                />
              </div>
            </div>
          </div>
        </DesktopFormPanel>
      </FormDialogSection>
    </DesktopFormGrid>
  )
}
