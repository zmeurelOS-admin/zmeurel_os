'use client'

import { useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { NumericField } from '@/components/app/NumericField'
import { CulturaFormSummary } from '@/components/parcele/CulturaFormSummary'
import {
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
} from '@/components/ui/form-dialog-layout'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
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
import { trackEvent } from '@/lib/analytics/trackEvent'
import {
  CUSTOM_CULTURA_OPTION,
  getCulturaFieldConfig,
  getCulturiOptions,
  getSoiPlaceholder,
  getTipPlantaPlaceholder,
  getTipPlantaSelectValue,
} from '@/lib/parcele/culturi'
import { createCultura } from '@/lib/supabase/queries/culturi'
import { toast } from '@/lib/ui/toast'

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
  interval_tratament_zile: z
    .string()
    .trim()
    .refine((v) => !v || Number.isInteger(Number(v)) && Number(v) > 0, {
      message: 'Intervalul trebuie să fie un număr întreg pozitiv',
    }),
  observatii: z.string(),
})

type FormValues = z.infer<typeof schema>

interface AddCulturaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelaId: string
  tipUnitate?: string | null
  /** Nume parcelă pentru rezumat (opțional). */
  parcelaLabel?: string
  onCreated: () => void
}

function formatSummaryDate(iso: string): string {
  const t = iso.trim()
  if (!t) return '—'
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ro-RO')
}

function truncateSummaryObs(text: string, max = 120): string {
  const t = text.trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function dashOrTrimmed(value: string): string {
  const t = value.trim()
  return t ? t : '—'
}

const defaultValues: FormValues = {
  tip_planta: '',
  soi: '',
  suprafata_ocupata: '',
  nr_plante: '',
  nr_randuri: '',
  distanta_intre_randuri: '',
  sistem_irigare: '',
  data_plantarii: '',
  interval_tratament_zile: '14',
  observatii: '',
}

export function AddCulturaDialog({
  open,
  onOpenChange,
  parcelaId,
  tipUnitate,
  parcelaLabel,
  onCreated,
}: AddCulturaDialogProps) {
  const submittedRef = useRef(false)
  const [isCustomTipPlanta, setIsCustomTipPlanta] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const watched = useWatch({ control: form.control })
  const tipPlanta = (watched ?? defaultValues).tip_planta
  const tipPlantaOptions = useMemo(() => getCulturiOptions(tipUnitate), [tipUnitate])
  const tipPlantaSelectValue =
    isCustomTipPlanta ? CUSTOM_CULTURA_OPTION : getTipPlantaSelectValue(tipPlanta, tipUnitate)
  const fieldConfig = useMemo(() => getCulturaFieldConfig(tipUnitate), [tipUnitate])

  const culturaSummary = useMemo(() => {
    const v = (watched ?? defaultValues) as FormValues
    const tipTrim = v.tip_planta.trim()
    const tipPlantaDisplay = tipTrim ? tipTrim : 'Neselectat'
    const soiDisplay = v.soi.trim() ? v.soi.trim() : 'Nespecificat'
    const obsShort = truncateSummaryObs(v.observatii)
    const observatiiDisplay = obsShort || '—'

    return {
      tipPlantaDisplay,
      soiDisplay,
      suprafataDisplay: dashOrTrimmed(v.suprafata_ocupata),
      plantCountDisplay: dashOrTrimmed(v.nr_plante),
      rowCountDisplay: dashOrTrimmed(v.nr_randuri),
      rowSpacingDisplay: dashOrTrimmed(v.distanta_intre_randuri),
      dataPlantariiDisplay: formatSummaryDate(v.data_plantarii),
      intervalTratamentDisplay: dashOrTrimmed(v.interval_tratament_zile),
      observatiiDisplay,
    }
  }, [watched])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createCultura({
        solar_id: parcelaId,
        tip_planta: values.tip_planta,
        soi: values.soi || undefined,
        suprafata_ocupata: values.suprafata_ocupata ? toDecimal(values.suprafata_ocupata) : undefined,
        nr_plante: values.nr_plante ? Number(values.nr_plante) : undefined,
        nr_randuri: values.nr_randuri ? Number(values.nr_randuri) : undefined,
        distanta_intre_randuri: values.distanta_intre_randuri
          ? toDecimal(values.distanta_intre_randuri)
          : undefined,
        sistem_irigare: values.sistem_irigare || undefined,
        data_plantarii: values.data_plantarii || undefined,
        interval_tratament_zile: values.interval_tratament_zile ? Number(values.interval_tratament_zile) : undefined,
        observatii: values.observatii || undefined,
      }),
    onSuccess: () => {
      submittedRef.current = true
      trackEvent({ eventName: 'form_completed', moduleName: 'culturi', status: 'success', metadata: { entity: 'cultura', source: 'AddCulturaDialog' } })
      trackEvent({ eventName: 'entity_created', moduleName: 'culturi', status: 'success', metadata: { entity: 'cultura', source: 'AddCulturaDialog' } })
      toast.success('Cultură adăugată')
      onOpenChange(false)
      form.reset(defaultValues)
      setIsCustomTipPlanta(false)
      onCreated()
    },
    onError: (error: Error) => {
      trackEvent({ eventName: 'form_failed', moduleName: 'culturi', status: 'failed', metadata: { entity: 'cultura', source: 'AddCulturaDialog', error_message: error.message } })
      toast.error(error.message)
    },
  })

  return (
    <AppDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next && !submittedRef.current) {
          trackEvent({ eventName: 'form_abandoned', moduleName: 'culturi', status: 'abandoned' })
        }
        if (!next) {
          submittedRef.current = false
          form.reset(defaultValues)
          setIsCustomTipPlanta(false)
        }
        onOpenChange(next)
      }}
      title="Adaugă cultură"
      description="Definește cultura, soiul și parametrii tehnici ai terenului."
      desktopFormWide
      showCloseButton
      contentClassName="md:w-[min(96vw,94rem)] md:max-w-none"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit((values) => mutation.mutate(values))}
          saving={mutation.isPending}
          cancelLabel="Anulează"
          saveLabel="Adaugă"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <DesktopFormGrid
          className="md:grid-cols-[minmax(0,1fr)_17.5rem] md:gap-3.5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-4 xl:grid-cols-[minmax(0,1fr)_18.5rem]"
          aside={
            <CulturaFormSummary
              parcelaLabel={parcelaLabel}
              tipPlantaDisplay={culturaSummary.tipPlantaDisplay}
              soiDisplay={culturaSummary.soiDisplay}
              suprafataDisplay={culturaSummary.suprafataDisplay}
              plantCountFieldTitle={fieldConfig.plantCountLabel}
              plantCountDisplay={culturaSummary.plantCountDisplay}
              rowCountFieldTitle={fieldConfig.rowCountLabel}
              rowCountDisplay={culturaSummary.rowCountDisplay}
              rowSpacingFieldTitle={fieldConfig.rowSpacingLabel}
              rowSpacingDisplay={culturaSummary.rowSpacingDisplay}
              showRowCount={fieldConfig.showRowCount}
              showRowSpacing={fieldConfig.showRowSpacing}
              dataPlantariiDisplay={culturaSummary.dataPlantariiDisplay}
              intervalTratamentDisplay={culturaSummary.intervalTratamentDisplay}
              observatiiDisplay={culturaSummary.observatiiDisplay}
              className="md:rounded-[22px] md:p-4 lg:p-[1.125rem]"
            />
          }
        >
          <FormDialogSection label="Detalii cultură">
            <DesktopFormPanel>
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-4">
          {/* Row 1: Tip plantă + Soi */}
          <div className="space-y-2">
            <Label>Tip plantă *</Label>
            <Select
              value={tipPlantaSelectValue || undefined}
              onValueChange={(value) => {
                if (value === CUSTOM_CULTURA_OPTION) {
                  setIsCustomTipPlanta(true)
                  form.setValue(
                    'tip_planta',
                    tipPlanta && !tipPlantaOptions.includes(tipPlanta) ? tipPlanta : '',
                    { shouldDirty: true, shouldValidate: true }
                  )
                  return
                }

                setIsCustomTipPlanta(false)
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
                id="tip_planta"
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
            <Label htmlFor="soi">Soi / varietate</Label>
            <Input
              id="soi"
              className="agri-control h-12"
              placeholder={tipPlanta ? getSoiPlaceholder(tipPlanta) : 'Ex: Delniwa, Cherry'}
              {...form.register('soi')}
            />
          </div>

          {/* Row 2: Suprafață + Nr plante */}
          <NumericField
            id="suprafata_ocupata"
            label="Suprafață ocupată (mp)"
            placeholder="Ex: 200"
            {...form.register('suprafata_ocupata')}
            error={form.formState.errors.suprafata_ocupata?.message}
          />

          <NumericField
            id="nr_plante"
            label={fieldConfig.plantCountLabel}
            placeholder="Ex: 300"
            {...form.register('nr_plante')}
            error={form.formState.errors.nr_plante?.message}
          />

          {/* Row 3: Nr rânduri + Distanța (conditional) */}
          {fieldConfig.showRowCount ? (
            <NumericField
              id="nr_randuri"
              label={fieldConfig.rowCountLabel}
              placeholder="Ex: 8"
              {...form.register('nr_randuri')}
              error={form.formState.errors.nr_randuri?.message}
            />
          ) : null}

          {fieldConfig.showRowSpacing ? (
            <div className="space-y-2">
              <Label htmlFor="distanta_intre_randuri">{fieldConfig.rowSpacingLabel}</Label>
              <Input
                id="distanta_intre_randuri"
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

          {/* Data plantării: single column */}
          <div className="space-y-2">
            <Label htmlFor="data_plantarii">Data plantării</Label>
            <Input
              id="data_plantarii"
              type="date"
              className="agri-control h-12"
              {...form.register('data_plantarii')}
            />
            {form.formState.errors.data_plantarii ? (
              <p className="text-xs text-red-600">{form.formState.errors.data_plantarii.message}</p>
            ) : null}
          </div>

          {/* Interval tratament: full-width */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="interval_tratament_zile">Interval tratament recomandat (zile)</Label>
            <Input
              id="interval_tratament_zile"
              type="number"
              min="1"
              placeholder="14"
              className="agri-control h-12 w-full px-3 text-base"
              {...form.register('interval_tratament_zile')}
            />
            {form.formState.errors.interval_tratament_zile ? (
              <p className="text-xs text-red-600">{form.formState.errors.interval_tratament_zile.message}</p>
            ) : null}
          </div>

          {/* Observații: full-width */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="observatii_cultura">Observații</Label>
            <Textarea
              id="observatii_cultura"
              rows={3}
              className="agri-control w-full px-3 py-2 text-base"
              placeholder="Detalii suplimentare"
              {...form.register('observatii')}
            />
          </div>
              </div>
            </DesktopFormPanel>
          </FormDialogSection>
        </DesktopFormGrid>
      </form>
    </AppDrawer>
  )
}
