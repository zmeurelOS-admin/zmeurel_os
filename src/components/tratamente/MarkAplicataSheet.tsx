'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { MeteoSnapshot } from '@/lib/tratamente/meteo'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import {
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'

const formSchema = z.object({
  data_aplicata: z.string().trim().min(1, 'Data aplicării este obligatorie.'),
  cantitate_totala_ml: z.string().optional(),
  operator: z.string().optional(),
  stadiu_la_aplicare: z.string().optional(),
  cohort_la_aplicare: z.enum(['floricane', 'primocane']).optional(),
  observatii: z.string().optional(),
  meteo_temperatura_c: z.string().optional(),
  meteo_umiditate_pct: z.string().optional(),
  meteo_vant_kmh: z.string().optional(),
  meteo_precipitatii_mm_24h: z.string().optional(),
  meteo_descriere: z.string().optional(),
})

export type MarkAplicataFormValues = z.infer<typeof formSchema> & {
  meteoSnapshot?: MeteoSnapshot | null
}

interface MarkAplicataSheetProps {
  cohortLaAplicareBlocata?: Cohorta | null
  defaultCantitateMl: number | null
  defaultCohortLaAplicare?: Cohorta | null
  defaultOperator: string
  defaultStadiu: string | null
  configurareSezon?: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  isRubusMixt?: boolean
  meteoSnapshot: MeteoSnapshot | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: MarkAplicataFormValues) => Promise<void> | void
  open: boolean
  pending?: boolean
}

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function buildDefaultValues(
  defaultCantitateMl: number | null,
  defaultCohortLaAplicare: Cohorta | null | undefined,
  defaultOperator: string,
  defaultStadiu: string | null,
  stadiiValide: readonly string[],
  meteoSnapshot: MeteoSnapshot | null,
): z.infer<typeof formSchema> {
  const normalizedStadiu = defaultStadiu ? normalizeStadiu(defaultStadiu) : null
  return {
    data_aplicata: toLocalDateTimeInputValue(new Date()),
    cantitate_totala_ml: formatNumber(defaultCantitateMl),
    operator: defaultOperator,
    stadiu_la_aplicare:
      normalizedStadiu && stadiiValide.includes(normalizedStadiu) ? normalizedStadiu : '',
    cohort_la_aplicare: defaultCohortLaAplicare ?? undefined,
    observatii: '',
    meteo_temperatura_c: formatNumber(meteoSnapshot?.temperatura_c),
    meteo_umiditate_pct: formatNumber(meteoSnapshot?.umiditate_pct),
    meteo_vant_kmh: formatNumber(meteoSnapshot?.vant_kmh),
    meteo_precipitatii_mm_24h: formatNumber(meteoSnapshot?.precipitatii_mm_24h),
    meteo_descriere: meteoSnapshot?.descriere ?? '',
  }
}

function toOptionalNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function MarkAplicataSheet({
  cohortLaAplicareBlocata = null,
  defaultCantitateMl,
  defaultCohortLaAplicare = null,
  defaultOperator,
  defaultStadiu,
  configurareSezon,
  grupBiologic,
  isRubusMixt = false,
  meteoSnapshot,
  onOpenChange,
  onSubmit,
  open,
  pending = false,
}: MarkAplicataSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [editMeteo, setEditMeteo] = useState(false)
  const stadiiValide = useMemo(() => listStadiiPentruGrup(grupBiologic), [grupBiologic])
  const defaultValues = useMemo(
    () =>
      buildDefaultValues(
        defaultCantitateMl,
        cohortLaAplicareBlocata ?? defaultCohortLaAplicare,
        defaultOperator,
        defaultStadiu,
        stadiiValide,
        meteoSnapshot
      ),
    [cohortLaAplicareBlocata, defaultCantitateMl, defaultCohortLaAplicare, defaultOperator, defaultStadiu, meteoSnapshot, stadiiValide],
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  const selectedCohort = useWatch({ control: form.control, name: 'cohort_la_aplicare' }) ?? null
  const selectedStadiu = useWatch({ control: form.control, name: 'stadiu_la_aplicare' }) ?? ''
  const stadiiOptions = useMemo(
    () =>
      stadiiValide.map((value) => ({
        value,
        label: getLabelStadiuContextual(value, configurareSezon ?? null, {
          grupBiologic,
          cohort: selectedCohort,
        }),
      })),
    [configurareSezon, grupBiologic, selectedCohort, stadiiValide]
  )

  useEffect(() => {
    if (open) {
      form.reset(
        buildDefaultValues(
          defaultCantitateMl,
          cohortLaAplicareBlocata ?? defaultCohortLaAplicare,
          defaultOperator,
          defaultStadiu,
          stadiiValide,
          meteoSnapshot
        )
      )
      queueMicrotask(() => setEditMeteo(false))
    }
  }, [cohortLaAplicareBlocata, defaultCantitateMl, defaultCohortLaAplicare, defaultOperator, defaultStadiu, form, meteoSnapshot, open, stadiiValide])

  const save = form.handleSubmit(async (values) => {
    if (isRubusMixt && !cohortLaAplicareBlocata && !values.cohort_la_aplicare) {
      form.setError('cohort_la_aplicare', { type: 'manual', message: 'Selectează cohorta pentru aplicare.' })
      return
    }

    const nextSnapshot = editMeteo
      ? {
          timestamp: new Date().toISOString(),
          temperatura_c: toOptionalNumber(values.meteo_temperatura_c),
          umiditate_pct: toOptionalNumber(values.meteo_umiditate_pct),
          vant_kmh: toOptionalNumber(values.meteo_vant_kmh),
          precipitatii_mm_24h: toOptionalNumber(values.meteo_precipitatii_mm_24h),
          descriere: values.meteo_descriere?.trim() || null,
        }
      : meteoSnapshot

    await onSubmit({
      ...values,
      meteoSnapshot: nextSnapshot,
    })
  })

  const content = (
    <form className="space-y-4" onSubmit={save}>
      {isRubusMixt ? (
        <div className="space-y-2">
          <Label>Aplicare pentru cohorta</Label>
          <Select
            value={selectedCohort || undefined}
            onValueChange={(value) => form.setValue('cohort_la_aplicare', value as Cohorta)}
            disabled={Boolean(cohortLaAplicareBlocata)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selectează cohorta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="floricane">{getCohortaLabel('floricane')}</SelectItem>
              <SelectItem value="primocane">{getCohortaLabel('primocane')}</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.cohort_la_aplicare ? (
            <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.cohort_la_aplicare.message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="aplicata-data">Data aplicată</Label>
        <Input id="aplicata-data" type="datetime-local" {...form.register('data_aplicata')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aplicata-cantitate">Cantitate totală (ml)</Label>
        <Input id="aplicata-cantitate" inputMode="decimal" {...form.register('cantitate_totala_ml')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="aplicata-operator">Operator</Label>
        <Input id="aplicata-operator" {...form.register('operator')} />
      </div>

      <div className="space-y-2">
        <Label>Stadiu la aplicare</Label>
        <Select
          value={selectedStadiu || undefined}
          onValueChange={(value) => form.setValue('stadiu_la_aplicare', value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selectează stadiul" />
          </SelectTrigger>
          <SelectContent>
            {stadiiOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="aplicata-observatii">Observații</Label>
        <Textarea id="aplicata-observatii" rows={4} {...form.register('observatii')} />
      </div>

      <div className="rounded-2xl bg-[var(--surface-card-muted)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Snapshot meteo</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Se preia automat înainte de salvare.</p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-[var(--agri-primary)] transition-colors hover:text-[color:color-mix(in_srgb,var(--agri-primary)_82%,black)]"
            onClick={() => setEditMeteo((current) => !current)}
          >
            {editMeteo ? 'Ascunde editarea' : 'Editează manual'}
          </button>
        </div>

        {!editMeteo ? (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[var(--text-secondary)]">
            <p>{`Temp: ${meteoSnapshot?.temperatura_c ?? '—'}°C`}</p>
            <p>{`Umiditate: ${meteoSnapshot?.umiditate_pct ?? '—'}%`}</p>
            <p>{`Vânt: ${meteoSnapshot?.vant_kmh ?? '—'} km/h`}</p>
            <p>{`Ploaie 24h: ${meteoSnapshot?.precipitatii_mm_24h ?? '—'} mm`}</p>
            <p className="col-span-2">{meteoSnapshot?.descriere ?? 'Fără descriere meteo disponibilă.'}</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meteo-temp">Temperatură (°C)</Label>
              <Input id="meteo-temp" inputMode="decimal" {...form.register('meteo_temperatura_c')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meteo-umiditate">Umiditate (%)</Label>
              <Input id="meteo-umiditate" inputMode="decimal" {...form.register('meteo_umiditate_pct')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meteo-vant">Vânt (km/h)</Label>
              <Input id="meteo-vant" inputMode="decimal" {...form.register('meteo_vant_kmh')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meteo-precip">Precipitații 24h (mm)</Label>
              <Input id="meteo-precip" inputMode="decimal" {...form.register('meteo_precipitatii_mm_24h')} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="meteo-descriere">Descriere</Label>
              <Input id="meteo-descriere" {...form.register('meteo_descriere')} />
            </div>
          </div>
        )}
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] max-h-[100dvh] rounded-none">
          <SheetHeader>
            <SheetTitle>Marchează ca aplicat</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{content}</div>
          <SheetFooter>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-4 text-sm font-semibold text-[var(--button-muted-text)]"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Anulează
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              onClick={save}
              disabled={pending}
            >
              {pending ? 'Se salvează...' : 'Marchează aplicarea'}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Marchează ca aplicat"
      footer={<DialogFormActions onCancel={() => onOpenChange(false)} onSave={save} saving={pending} saveLabel="Marchează aplicarea" />}
      desktopFormWide
    >
      {content}
    </AppDialog>
  )
}
