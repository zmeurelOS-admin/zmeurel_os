'use client'

import { type UseFormReturn } from 'react-hook-form'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
import { formatM2ToHa, parseLocalizedNumber } from '@/lib/utils/area'
import {
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
} from '@/components/ui/form-dialog-layout'
import { ParcelFormSummary } from '@/components/parcele/ParcelFormSummary'
import { ParcelUsageFields, applyScopDefaults } from '@/components/parcele/ParcelUsageFields'
import { getUnitateTipLabel } from '@/lib/parcele/unitate'
import { toast } from '@/lib/ui/toast'
import {
  PARCELA_SCOPURI,
  SCOP_LABELS,
  STATUS_OPERATIONAL_LABELS,
  STATUS_OPERATIONAL_VALUES,
  type ParcelaScop,
  type StatusOperational,
} from '@/lib/parcele/dashboard-relevance'
import { z } from 'zod'

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

const selectTriggerClass = 'agri-control h-12 w-full px-3 text-base'

export function ParcelForm({ form, soiuriDisponibile: _soiuriDisponibile }: ParcelFormProps) {
  void _soiuriDisponibile

  const tipUnitate = form.watch('tip_unitate')
  const suprafataValue = form.watch('suprafata_m2')
  const parcelName = form.watch('nume_parcela').trim() || 'Teren nou'
  const scopeValue = form.watch('rol')
  const statusOperational = form.watch('status_operational')
  const statusValue = form.watch('status').trim() || '—'
  const latitudine = form.watch('latitudine').trim()
  const longitudine = form.watch('longitudine').trim()
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoStatus, setGeoStatus] = useState<{ state: 'idle' | 'denied' | 'error' | 'success' | 'unsupported'; message?: string }>({
    state: 'idle',
  })
  const validArea = suprafataValue.trim() ? parseLocalizedNumber(suprafataValue) : 0
  const areaLabel =
    suprafataValue.trim() && validArea > 0
      ? `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(validArea)} m² · ${formatM2ToHa(suprafataValue)}`
      : '—'
  const locationLabel =
    latitudine && longitudine ? `${latitudine}, ${longitudine}` : latitudine || longitudine || 'Coordonate necompletate'

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
          // Permission denied: gentle UX — don't block saving
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
      className="md:grid-cols-[minmax(0,1fr)_20rem] md:gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_22rem]"
      aside={
        <ParcelFormSummary
          parcelName={parcelName}
          typeLabel={getUnitateTipLabel(tipUnitate)}
          purposeLabel={SCOP_LABELS[scopeValue]}
          statusLabel={statusValue}
          areaLabel={areaLabel}
          locationLabel={locationLabel}
          className="md:rounded-[24px] md:p-5 lg:p-6"
        />
      }
    >
      <FormDialogSection label="Detalii teren">
        <DesktopFormPanel>
          <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
            <div className="space-y-2">
              <Label htmlFor="nume_parcela">Nume teren *</Label>
              <Input
                id="nume_parcela"
                className="agri-control h-12 w-full px-3 text-base md:h-11"
                placeholder="Teren Nord"
                {...form.register('nume_parcela')}
              />
              {form.formState.errors.nume_parcela ? (
                <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.nume_parcela.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
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
                  {PARCELA_SCOPURI.map((key) => (
                    <SelectItem key={key} value={key}>
                      {SCOP_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tip *</Label>
              <Select
                value={tipUnitate}
                onValueChange={(value: 'camp' | 'solar' | 'livada' | 'cultura_mare') =>
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
                  <SelectItem value="cultura_mare">Cultură mare</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
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
                  {STATUS_OPERATIONAL_VALUES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {STATUS_OPERATIONAL_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="soi_plantat">Soi / cultură</Label>
              <Input
                id="soi_plantat"
                className="agri-control h-12 w-full px-3 text-base md:h-11"
                placeholder="Ex: Delniwa, Solar roșii"
                {...form.register('soi_plantat')}
              />
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
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
              <Label htmlFor="suprafata_m2">Suprafață (m²) *</Label>
              <Input
                id="suprafata_m2"
                inputMode="decimal"
                className="agri-control h-12 w-full px-3 text-base md:h-11"
                placeholder="1200"
                {...form.register('suprafata_m2')}
              />
              {form.formState.errors.suprafata_m2 ? (
                <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.suprafata_m2.message}</p>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)]">≈ {formatM2ToHa(suprafataValue)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="observatii">Observații</Label>
              <Textarea
                id="observatii"
                rows={5}
                placeholder="Detalii suplimentare"
                className="agri-control min-h-[5rem] w-full px-3 py-2 text-base md:min-h-[6.5rem]"
                {...form.register('observatii')}
              />
            </div>
          </div>
        </DesktopFormPanel>
      </FormDialogSection>

      <FormDialogSection label="Locație">
        <DesktopFormPanel>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
            <div className="space-y-2">
              <Label htmlFor="latitudine">Latitudine</Label>
              <Input
                id="latitudine"
                inputMode="decimal"
                placeholder="47.6514"
                className="agri-control h-12 w-full px-3 text-base md:h-11"
                {...form.register('latitudine')}
              />
              {form.formState.errors.latitudine ? (
                <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.latitudine.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitudine">Longitudine</Label>
              <Input
                id="longitudine"
                inputMode="decimal"
                placeholder="26.2553"
                className="agri-control h-12 w-full px-3 text-base md:h-11"
                {...form.register('longitudine')}
              />
              {form.formState.errors.longitudine ? (
                <p className="text-xs text-[var(--danger-text)]">{form.formState.errors.longitudine.message}</p>
              ) : null}
            </div>

            <div
              className="md:col-span-2"
              title={geoStatus.state === 'denied' ? 'Permite accesul la locație' : undefined}
            >
              <Button
                type="button"
                variant="outline"
                className="agri-cta min-h-11 w-full rounded-xl text-sm md:w-auto"
                onClick={handleUseCurrentLocation}
                disabled={geoStatus.state === 'denied' || geoLoading}
              >
                {geoLoading ? 'Se detectează...' : 'Folosește locația curentă'}
              </Button>
            </div>
          </div>
          {geoStatus.state === 'denied' ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              Locația nu e disponibilă. Poți adăuga coordonatele manual mai târziu.
            </p>
          ) : geoStatus.state === 'unsupported' ? (
            <p className="text-xs text-[var(--text-tertiary)]">Poți adăuga manual coordonatele.</p>
          ) : geoStatus.state === 'error' ? (
            <p className="text-xs text-[var(--text-tertiary)]">{geoStatus.message}</p>
          ) : null}
        </DesktopFormPanel>
      </FormDialogSection>

      <FormDialogSection label="Vizibilitate și raportare">
        <DesktopFormPanel>
          <ParcelUsageFields
            scop={scopeValue}
            apareInDashboard={form.watch('apare_in_dashboard')}
            contribuieLaProductie={form.watch('contribuie_la_productie')}
            disableCommercialToggles
            onApareChange={(v) => form.setValue('apare_in_dashboard', v, { shouldDirty: true })}
            onContribuieChange={(v) => form.setValue('contribuie_la_productie', v, { shouldDirty: true })}
          />
        </DesktopFormPanel>
      </FormDialogSection>
    </DesktopFormGrid>
  )
}
