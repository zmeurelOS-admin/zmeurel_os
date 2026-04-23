'use client'

import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'
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
import { AplicareSourceBadge } from '@/components/tratamente/AplicareSourceBadge'
import { ProdusFitosanitarPicker } from '@/components/tratamente/ProdusFitosanitarPicker'
import { queryKeys } from '@/lib/query-keys'
import type {
  AplicareProdusV2,
  InterventieProdusV2,
  ProdusFitosanitar,
} from '@/lib/supabase/queries/tratamente'
import type { MeteoSnapshot } from '@/lib/tratamente/meteo'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import {
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'
import { saveProdusFitosanitarInLibraryAction } from '@/app/(dashboard)/tratamente/produse-fitosanitare/actions'

const formSchema = z.object({
  data_aplicata: z.string().trim().min(1, 'Data aplicării este obligatorie.'),
  manual_data: z.string().optional(),
  manual_parcela_id: z.string().uuid().optional(),
  manual_status: z.enum(['planificata', 'aplicata']).optional(),
  tip_interventie: z.string().optional(),
  scop: z.string().optional(),
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
  diferente_fata_de_plan_text: z.string().optional(),
})

export type MarkAplicataFormValues = z.infer<typeof formSchema> & {
  meteoSnapshot?: MeteoSnapshot | null
  produse: MarkAplicataProdusDraft[]
  diferenteFataDePlan?: {
    automat?: string[]
    observatii?: string | null
  } | null
}

export interface MarkAplicataProdusDraft {
  id: string
  plan_linie_produs_id: string | null
  ordine: number
  produs_id: string | null
  produs_nume_manual: string
  produs_nume_snapshot: string | null
  substanta_activa_snapshot: string
  tip_snapshot: ProdusFitosanitar['tip'] | string | null
  frac_irac_snapshot: string
  phi_zile_snapshot: number | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  observatii: string
}

interface MarkAplicataSheetProps {
  mode?: 'din_plan' | 'manual'
  cohortLaAplicareBlocata?: Cohorta | null
  defaultCantitateMl: number | null
  defaultCohortLaAplicare?: Cohorta | null
  defaultOperator: string
  defaultStadiu: string | null
  defaultManualData?: string
  defaultManualParcelaId?: string | null
  defaultManualParcelaLabel?: string | null
  defaultManualStatus?: 'planificata' | 'aplicata'
  configurareSezon?: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  isRubusMixt?: boolean
  meteoSnapshot: MeteoSnapshot | null
  manualParcele?: Array<{ value: string; label: string }>
  onOpenChange: (open: boolean) => void
  onSubmit: (values: MarkAplicataFormValues) => Promise<void> | void
  open: boolean
  pending?: boolean
  produseEfective?: AplicareProdusV2[]
  produseFitosanitare?: ProdusFitosanitar[]
  produsePlanificate?: InterventieProdusV2[]
}

const EMPTY_APLICARE_PRODUSE: AplicareProdusV2[] = []
const EMPTY_PLAN_PRODUSE: InterventieProdusV2[] = []
const EMPTY_PRODUSE_FITOSANITARE: ProdusFitosanitar[] = []

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
  defaultManualData: string,
  defaultManualParcelaId: string | null,
  defaultManualStatus: 'planificata' | 'aplicata',
): z.infer<typeof formSchema> {
  const normalizedStadiu = defaultStadiu ? normalizeStadiu(defaultStadiu) : null
  return {
    data_aplicata: toLocalDateTimeInputValue(new Date()),
    manual_data: defaultManualData,
    manual_parcela_id: defaultManualParcelaId ?? undefined,
    manual_status: defaultManualStatus,
    tip_interventie: '',
    scop: '',
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
    diferente_fata_de_plan_text: '',
  }
}

function toOptionalNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function createEmptyProdusDraft(nextOrdine: number): MarkAplicataProdusDraft {
  return {
    id: crypto.randomUUID(),
    plan_linie_produs_id: null,
    ordine: nextOrdine,
    produs_id: null,
    produs_nume_manual: '',
    produs_nume_snapshot: null,
    substanta_activa_snapshot: '',
    tip_snapshot: '',
    frac_irac_snapshot: '',
    phi_zile_snapshot: null,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    observatii: '',
  }
}

function fromAplicareProdus(produs: AplicareProdusV2, index: number): MarkAplicataProdusDraft {
  return {
    id: produs.id || `efectiv-${index + 1}`,
    plan_linie_produs_id: produs.plan_linie_produs_id ?? null,
    ordine: produs.ordine ?? index + 1,
    produs_id: produs.produs_id ?? null,
    produs_nume_manual: produs.produs_nume_manual ?? '',
    produs_nume_snapshot: produs.produs_nume_snapshot ?? produs.produs?.nume_comercial ?? null,
    substanta_activa_snapshot: produs.substanta_activa_snapshot ?? produs.produs?.substanta_activa ?? '',
    tip_snapshot: produs.tip_snapshot ?? produs.produs?.tip ?? '',
    frac_irac_snapshot: produs.frac_irac_snapshot ?? produs.produs?.frac_irac ?? '',
    phi_zile_snapshot: produs.phi_zile_snapshot ?? produs.produs?.phi_zile ?? null,
    doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
    doza_l_per_ha: produs.doza_l_per_ha ?? null,
    observatii: produs.observatii ?? '',
  }
}

function fromPlanProdus(produs: InterventieProdusV2, index: number): MarkAplicataProdusDraft {
  return {
    id: `plan-${produs.id || index + 1}`,
    plan_linie_produs_id: produs.id ?? null,
    ordine: produs.ordine ?? index + 1,
    produs_id: produs.produs_id ?? null,
    produs_nume_manual: produs.produs_nume_manual ?? '',
    produs_nume_snapshot: produs.produs_nume_snapshot ?? produs.produs?.nume_comercial ?? null,
    substanta_activa_snapshot: produs.substanta_activa_snapshot ?? produs.produs?.substanta_activa ?? '',
    tip_snapshot: produs.tip_snapshot ?? produs.produs?.tip ?? '',
    frac_irac_snapshot: produs.frac_irac_snapshot ?? produs.produs?.frac_irac ?? '',
    phi_zile_snapshot: produs.phi_zile_snapshot ?? produs.produs?.phi_zile ?? null,
    doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
    doza_l_per_ha: produs.doza_l_per_ha ?? null,
    observatii: produs.observatii ?? '',
  }
}

function buildInitialProduse(
  produseEfective: AplicareProdusV2[] | undefined,
  produsePlanificate: InterventieProdusV2[] | undefined
): MarkAplicataProdusDraft[] {
  const source = produseEfective?.length
    ? produseEfective.map(fromAplicareProdus)
    : produsePlanificate?.length
      ? produsePlanificate.map(fromPlanProdus)
      : [createEmptyProdusDraft(1)]

  return source.map((produs, index) => ({ ...produs, ordine: index + 1 }))
}

function withProductOrder(produse: MarkAplicataProdusDraft[]) {
  return produse.map((produs, index) => ({ ...produs, ordine: index + 1 }))
}

function moveProduct(
  produse: MarkAplicataProdusDraft[],
  produsId: string,
  direction: 'up' | 'down'
) {
  const currentIndex = produse.findIndex((produs) => produs.id === produsId)
  if (currentIndex === -1) return produse

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (nextIndex < 0 || nextIndex >= produse.length) return produse

  const clone = [...produse]
  const [item] = clone.splice(currentIndex, 1)
  clone.splice(nextIndex, 0, item)
  return withProductOrder(clone)
}

function updateProductFromCatalog(
  draft: MarkAplicataProdusDraft,
  product: ProdusFitosanitar | null
): MarkAplicataProdusDraft {
  if (!product) {
    return {
      ...draft,
      produs_id: null,
      produs_nume_snapshot: null,
    }
  }

  return {
    ...draft,
    produs_id: product.id,
    produs_nume_manual: '',
    produs_nume_snapshot: product.nume_comercial,
    substanta_activa_snapshot: product.substanta_activa ?? '',
    tip_snapshot: product.tip ?? '',
    frac_irac_snapshot: product.frac_irac ?? '',
    phi_zile_snapshot: product.phi_zile ?? null,
  }
}

function productName(produs: MarkAplicataProdusDraft, produseFitosanitare: ProdusFitosanitar[]) {
  const catalog = produseFitosanitare.find((item) => item.id === produs.produs_id)
  return catalog?.nume_comercial || produs.produs_nume_manual.trim() || produs.produs_nume_snapshot || 'Produs fără nume'
}

function validateProducts(produse: MarkAplicataProdusDraft[]): string | null {
  if (produse.length === 0) return 'Aplicarea trebuie să aibă cel puțin un produs.'
  const invalid = produse.find((produs) => !produs.produs_id && !produs.produs_nume_manual.trim())
  if (invalid) return 'Fiecare produs trebuie selectat din bibliotecă sau completat manual.'
  return null
}

function sameNumber(first: number | null, second: number | null) {
  return (first ?? null) === (second ?? null)
}

function buildDiffSummary(
  produseActuale: MarkAplicataProdusDraft[],
  produsePlanificate: InterventieProdusV2[] | undefined,
  manualText: string | undefined
) {
  const summary: string[] = []
  const planned = produsePlanificate ?? []
  if (planned.length > 0 && planned.length !== produseActuale.length) {
    summary.push(`Număr produse: plan ${planned.length}, aplicat ${produseActuale.length}`)
  }

  produseActuale.forEach((actual, index) => {
    const plannedProduct = planned[index]
    if (!plannedProduct) {
      summary.push(`Produs #${index + 1} adăugat la aplicare`)
      return
    }

    if ((actual.produs_id ?? null) !== (plannedProduct.produs_id ?? null)) {
      summary.push(`Produs #${index + 1} diferă de plan`)
    }
    if (!sameNumber(actual.doza_ml_per_hl, plannedProduct.doza_ml_per_hl ?? null)) {
      summary.push(`Doză ml/hl diferită la produs #${index + 1}`)
    }
    if (!sameNumber(actual.doza_l_per_ha, plannedProduct.doza_l_per_ha ?? null)) {
      summary.push(`Doză l/ha diferită la produs #${index + 1}`)
    }
  })

  const observatii = manualText?.trim() || null
  if (summary.length === 0 && !observatii) return null
  return { automat: summary, observatii }
}

export function MarkAplicataSheet({
  mode = 'din_plan',
  cohortLaAplicareBlocata = null,
  defaultCantitateMl,
  defaultCohortLaAplicare = null,
  defaultOperator,
  defaultStadiu,
  defaultManualData = toLocalDateTimeInputValue(new Date()),
  defaultManualParcelaId = null,
  defaultManualParcelaLabel = null,
  defaultManualStatus = 'aplicata',
  configurareSezon,
  grupBiologic,
  isRubusMixt = false,
  meteoSnapshot,
  manualParcele = [],
  onOpenChange,
  onSubmit,
  open,
  pending = false,
  produseEfective = EMPTY_APLICARE_PRODUSE,
  produseFitosanitare = EMPTY_PRODUSE_FITOSANITARE,
  produsePlanificate = EMPTY_PLAN_PRODUSE,
}: MarkAplicataSheetProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [editMeteo, setEditMeteo] = useState(false)
  const [produseDraft, setProduseDraft] = useState<MarkAplicataProdusDraft[]>(() =>
    buildInitialProduse(produseEfective, produsePlanificate)
  )
  const queryClient = useQueryClient()
  const stadiiValide = useMemo(() => listStadiiPentruGrup(grupBiologic), [grupBiologic])
  const defaultValues = useMemo(
    () =>
      buildDefaultValues(
        defaultCantitateMl,
        cohortLaAplicareBlocata ?? defaultCohortLaAplicare,
        defaultOperator,
        defaultStadiu,
        stadiiValide,
        meteoSnapshot,
        defaultManualData,
        defaultManualParcelaId,
        defaultManualStatus,
      ),
    [cohortLaAplicareBlocata, defaultCantitateMl, defaultCohortLaAplicare, defaultManualData, defaultManualParcelaId, defaultManualStatus, defaultOperator, defaultStadiu, meteoSnapshot, stadiiValide],
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  const selectedCohort = useWatch({ control: form.control, name: 'cohort_la_aplicare' }) ?? null
  const selectedStadiu = useWatch({ control: form.control, name: 'stadiu_la_aplicare' }) ?? ''
  const selectedManualStatus = useWatch({ control: form.control, name: 'manual_status' }) ?? defaultManualStatus
  const selectedManualParcelaId = useWatch({ control: form.control, name: 'manual_parcela_id' }) ?? defaultManualParcelaId ?? ''
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
          meteoSnapshot,
          defaultManualData,
          defaultManualParcelaId,
          defaultManualStatus,
        )
      )
      setProduseDraft(buildInitialProduse(produseEfective, produsePlanificate))
      queueMicrotask(() => setEditMeteo(false))
    }
  }, [cohortLaAplicareBlocata, defaultCantitateMl, defaultCohortLaAplicare, defaultManualData, defaultManualParcelaId, defaultManualStatus, defaultOperator, defaultStadiu, form, meteoSnapshot, open, produseEfective, produsePlanificate, stadiiValide])

  const save = form.handleSubmit(async (values) => {
    const productError = validateProducts(produseDraft)
    if (productError) {
      form.setError('observatii', { type: 'manual', message: productError })
      return
    }

    if (mode === 'manual') {
      if (!values.manual_parcela_id) {
        form.setError('manual_parcela_id', { type: 'manual', message: 'Selectează parcela pentru intervenția manuală.' })
        return
      }
      if (!values.manual_status) {
        form.setError('manual_status', { type: 'manual', message: 'Selectează statusul intervenției.' })
        return
      }
      if (!values.manual_data?.trim()) {
        form.setError('manual_data', { type: 'manual', message: 'Data intervenției este obligatorie.' })
        return
      }
      if (!values.tip_interventie?.trim()) {
        form.setError('tip_interventie', { type: 'manual', message: 'Tipul intervenției este obligatoriu.' })
        return
      }
      if (!values.scop?.trim()) {
        form.setError('scop', { type: 'manual', message: 'Scopul intervenției este obligatoriu.' })
        return
      }
      if (values.manual_status === 'aplicata' && !values.stadiu_la_aplicare?.trim()) {
        form.setError('stadiu_la_aplicare', { type: 'manual', message: 'Completează stadiul real la aplicare.' })
        return
      }
      if (isRubusMixt && !cohortLaAplicareBlocata && !values.cohort_la_aplicare) {
        form.setError('cohort_la_aplicare', { type: 'manual', message: 'Selectează cohorta pentru intervenție.' })
        return
      }

      await onSubmit({
        ...values,
        data_aplicata: values.manual_status === 'aplicata' ? values.manual_data : '',
        manual_parcela_id: values.manual_parcela_id,
        manual_status: values.manual_status,
        manual_data: values.manual_data,
        tip_interventie: values.tip_interventie?.trim(),
        scop: values.scop?.trim(),
        meteoSnapshot: editMeteo
          ? {
              timestamp: new Date().toISOString(),
              temperatura_c: toOptionalNumber(values.meteo_temperatura_c),
              umiditate_pct: toOptionalNumber(values.meteo_umiditate_pct),
              vant_kmh: toOptionalNumber(values.meteo_vant_kmh),
              precipitatii_mm_24h: toOptionalNumber(values.meteo_precipitatii_mm_24h),
              descriere: values.meteo_descriere?.trim() || null,
            }
          : meteoSnapshot,
        produse: withProductOrder(produseDraft),
        diferenteFataDePlan: null,
      })
      return
    }

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
      produse: withProductOrder(produseDraft),
      diferenteFataDePlan: buildDiffSummary(produseDraft, produsePlanificate, values.diferente_fata_de_plan_text),
    })
  })

  const updateProduct = (produsId: string, update: (produs: MarkAplicataProdusDraft) => MarkAplicataProdusDraft) => {
    setProduseDraft((current) =>
      withProductOrder(current.map((produs) => (produs.id === produsId ? update(produs) : produs)))
    )
  }

  const saveProductToLibrary = useMutation({
    mutationFn: saveProdusFitosanitarInLibraryAction,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.produseFitosanitare })
    },
  })

  const content = (
    <form className="space-y-4" onSubmit={save}>
      {mode === 'manual' ? (
        <div className="space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Intervenție manuală</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {defaultManualParcelaLabel
                  ? `Parcela curentă: ${defaultManualParcelaLabel}`
                  : 'Alege parcela și completează intervenția în afara planului.'}
              </p>
            </div>
            <AplicareSourceBadge source="manuala" />
          </div>

          {manualParcele.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="manual-parcela">Parcela</Label>
              <Select
                value={selectedManualParcelaId || undefined}
                onValueChange={(value) => form.setValue('manual_parcela_id', value, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selectează parcela" />
                </SelectTrigger>
                <SelectContent>
                  {manualParcele.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.manual_parcela_id ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.manual_parcela_id.message}</p>
              ) : null}
            </div>
          ) : defaultManualParcelaLabel ? (
            <div className="rounded-2xl bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              {defaultManualParcelaLabel}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-status">Status</Label>
              <Select
                value={selectedManualStatus}
                onValueChange={(value) => form.setValue('manual_status', value as 'planificata' | 'aplicata', { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selectează statusul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planificata">Planificată</SelectItem>
                  <SelectItem value="aplicata">Aplicată</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.manual_status ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.manual_status.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-data">
                {selectedManualStatus === 'aplicata' ? 'Data aplicării' : 'Data planificării'}
              </Label>
              <Input id="manual-data" type="datetime-local" {...form.register('manual_data')} />
              {form.formState.errors.manual_data ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.manual_data.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-tip-interventie">Tip intervenție</Label>
              <Input id="manual-tip-interventie" {...form.register('tip_interventie')} />
              {form.formState.errors.tip_interventie ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.tip_interventie.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-scop">Scop</Label>
              <Input id="manual-scop" {...form.register('scop')} />
              {form.formState.errors.scop ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.scop.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isRubusMixt ? (
        <div className="space-y-2">
          <Label>{mode === 'manual' ? 'Cohortă pentru intervenție' : 'Aplicare pentru cohorta'}</Label>
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

      {mode === 'din_plan' ? (
        <div className="space-y-2">
          <Label htmlFor="aplicata-data">Data aplicată</Label>
          <Input id="aplicata-data" type="datetime-local" {...form.register('data_aplicata')} />
        </div>
      ) : null}

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
          onValueChange={(value) => form.setValue('stadiu_la_aplicare', value, { shouldValidate: true })}
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
        {form.formState.errors.observatii ? (
          <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.observatii.message}</p>
        ) : null}
      </div>

      {mode === 'din_plan' ? (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Produse planificate</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {produsePlanificate.length > 0
                  ? produsePlanificate.map((produs) => produs.produs?.nume_comercial ?? produs.produs_nume_manual ?? produs.produs_nume_snapshot ?? 'Produs').join(' · ')
                  : 'Nu există produse planificate disponibile.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
              {mode === 'manual' ? 'Produse intervenție' : 'Produse aplicate efectiv'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {mode === 'manual'
                ? 'Adaugă unul sau mai multe produse pentru intervenția manuală.'
                : 'Pornește din plan, dar poți ajusta compoziția reală.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setProduseDraft((current) => [...current, createEmptyProdusDraft(current.length + 1)])}
          >
            <Plus className="h-4 w-4" />
            Adaugă produs
          </Button>
        </div>

        <div className="space-y-3">
          {produseDraft.map((produsDraft, index) => {
            const selectedProduct = produseFitosanitare.find((produs) => produs.id === produsDraft.produs_id) ?? null
            const availableProducts =
              selectedProduct && !produseFitosanitare.some((produs) => produs.id === selectedProduct.id)
                ? [selectedProduct, ...produseFitosanitare]
                : produseFitosanitare

            return (
              <div key={produsDraft.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Produs #{index + 1}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{productName(produsDraft, produseFitosanitare)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută sus produsul ${index + 1}`} disabled={index === 0} onClick={() => setProduseDraft((current) => moveProduct(current, produsDraft.id, 'up'))}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Mută jos produsul ${index + 1}`} disabled={index === produseDraft.length - 1} onClick={() => setProduseDraft((current) => moveProduct(current, produsDraft.id, 'down'))}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Șterge produsul ${index + 1}`} onClick={() => setProduseDraft((current) => withProductOrder(current.filter((produs) => produs.id !== produsDraft.id)))}>
                      <Trash2 className="h-4 w-4 text-[var(--status-danger-text)]" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`aplicata-produs-${produsDraft.id}`}>Produs din bibliotecă</Label>
                    <ProdusFitosanitarPicker
                      produse={availableProducts}
                      value={produsDraft.produs_id ?? null}
                      selectedLabel={
                        (produsDraft.produs_nume_snapshot || produsDraft.produs_nume_manual || '').trim() || null
                      }
                      onChange={(product) =>
                        updateProduct(produsDraft.id, (current) => {
                          if (!product) {
                            const fallbackName = current.produs_nume_snapshot || current.produs_nume_manual || ''
                            return {
                              ...current,
                              produs_id: null,
                              produs_nume_manual: fallbackName,
                              produs_nume_snapshot: fallbackName || null,
                            }
                          }

                          return updateProductFromCatalog(current, product)
                        })
                      }
                      onCreateProduct={saveProductToLibrary.mutateAsync}
                      placeholder="Adaugă manual"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`aplicata-manual-${produsDraft.id}`}>Nume manual</Label>
                      <Input
                        id={`aplicata-manual-${produsDraft.id}`}
                        value={produsDraft.produs_nume_manual}
                        disabled={Boolean(produsDraft.produs_id)}
                        onChange={(event) =>
                          updateProduct(produsDraft.id, (current) => ({
                            ...current,
                          produs_id: null,
                          produs_nume_manual: event.target.value,
                          produs_nume_snapshot: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`aplicata-substanta-${produsDraft.id}`}>Substanță activă</Label>
                    <Input
                      id={`aplicata-substanta-${produsDraft.id}`}
                      value={produsDraft.substanta_activa_snapshot}
                      onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, substanta_activa_snapshot: event.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`aplicata-frac-${produsDraft.id}`}>FRAC/IRAC</Label>
                      <Input
                        id={`aplicata-frac-${produsDraft.id}`}
                        value={produsDraft.frac_irac_snapshot}
                        onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, frac_irac_snapshot: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`aplicata-phi-${produsDraft.id}`}>PHI zile</Label>
                      <Input
                        id={`aplicata-phi-${produsDraft.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={produsDraft.phi_zile_snapshot ?? ''}
                        onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, phi_zile_snapshot: toOptionalNumber(event.target.value) }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                    <div className="space-y-2">
                      <Label htmlFor={`aplicata-doza-ml-${produsDraft.id}`}>Doză ml/hl</Label>
                      <Input
                        id={`aplicata-doza-ml-${produsDraft.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={produsDraft.doza_ml_per_hl ?? ''}
                        onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, doza_ml_per_hl: toOptionalNumber(event.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`aplicata-doza-l-${produsDraft.id}`}>Doză l/ha</Label>
                      <Input
                        id={`aplicata-doza-l-${produsDraft.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={produsDraft.doza_l_per_ha ?? ''}
                        onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, doza_l_per_ha: toOptionalNumber(event.target.value) }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`aplicata-produs-observatii-${produsDraft.id}`}>Observații produs</Label>
                    <Textarea
                      id={`aplicata-produs-observatii-${produsDraft.id}`}
                      rows={2}
                      value={produsDraft.observatii}
                      onChange={(event) => updateProduct(produsDraft.id, (current) => ({ ...current, observatii: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {mode === 'din_plan' ? (
        <div className="space-y-2">
          <Label htmlFor="aplicata-diferente">Diferențe față de plan</Label>
          <Textarea
            id="aplicata-diferente"
            rows={3}
            placeholder="Ex: produs înlocuit, doză ajustată, produs omis."
            {...form.register('diferente_fata_de_plan_text')}
          />
        </div>
      ) : null}

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
            <SheetTitle>{mode === 'manual' ? 'Adaugă intervenție manuală' : 'Marchează ca aplicat'}</SheetTitle>
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
              {pending
                ? 'Se salvează...'
                : mode === 'manual'
                  ? 'Salvează intervenția'
                  : 'Marchează aplicarea'}
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
      title={mode === 'manual' ? 'Adaugă intervenție manuală' : 'Marchează ca aplicat'}
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={pending}
          saveLabel={mode === 'manual' ? 'Salvează intervenția' : 'Marchează aplicarea'}
        />
      }
      desktopFormWide
    >
      {content}
    </AppDialog>
  )
}
