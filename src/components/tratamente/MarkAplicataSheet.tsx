'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'

import { AppDialog } from '@/components/app/AppDialog'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button } from '@/components/ui/button'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
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
import { InterventieAplicareFormSummary } from '@/components/tratamente/InterventieAplicareFormSummary'
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
import { loadHubMeteoParcelaAction } from '@/app/(dashboard)/tratamente/actions'
import { autoSaveProdusInBiblioteca } from '@/lib/tratamente/auto-save-produs-biblioteca'
import { toast } from '@/lib/ui/toast'

const formSchema = z.object({
  data_aplicata: z.string().trim().min(1, 'Data aplicării este obligatorie.'),
  manual_data: z.string().optional(),
  manual_parcela_id: z.string().uuid().optional(),
  manual_status: z.enum(['planificata', 'aplicata']).optional(),
  tip_interventie: z.string().optional(),
  scop: z.string().optional(),
  manual_tip_select: z.string().optional(),
  manual_tip_custom: z.string().optional(),
  manual_scop_select: z.string().optional(),
  manual_scop_custom: z.string().optional(),
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
  cantitate_text?: string
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
const CANTITATE_PLACEHOLDER = 'ex: 60 ml la 15 l apă, sau 200 ml/ha'

const TIP_INTERVENTIE_OPTIONS = [
  { value: 'foliar', label: 'Foliar' },
  { value: 'fertirigare', label: 'Fertirigare' },
  { value: 'aplicare_sol', label: 'Aplicare pe sol' },
  { value: 'tratament_radacini', label: 'Tratament rădăcini (drenching)' },
  { value: 'badijonare', label: 'Badijonare tulpină' },
  { value: 'alt_tip', label: 'Alt tip' },
] as const

const SCOP_OPTIONS = [
  { value: 'fertilizare_baza', label: 'Fertilizare de bază' },
  { value: 'stimulare_inflorire', label: 'Stimulare înflorire' },
  { value: 'stimulare_fructificare', label: 'Stimulare fructificare' },
  { value: 'protectie_fungica', label: 'Protecție fungică' },
  { value: 'protectie_insecticida', label: 'Protecție insecticidă' },
  { value: 'corectare_carente', label: 'Corectare carențe' },
  { value: 'biostimulare', label: 'Biostimulare' },
  { value: 'dezinfectie_sol', label: 'Dezinfecție sol' },
  { value: 'alt_scop', label: 'Alt scop' },
] as const

const PRODUCT_TYPE_OPTIONS = [
  { value: 'ingrasamant', label: 'Îngrășământ / fertilizant' },
  { value: 'fitosanitar', label: 'Produs fitosanitar' },
  { value: 'biostimulator', label: 'Biostimulator' },
  { value: 'amendament', label: 'Amendament sol' },
  { value: 'alt_produs', label: 'Alt produs' },
] as const

function mapProductTypeToSnapshot(value: string): string | null {
  if (value === 'fitosanitar') return 'fungicid'
  if (value === 'ingrasamant') return 'ingrasamant'
  if (value === 'biostimulator') return 'bioregulator'
  if (value === 'amendament') return 'altul'
  if (value === 'alt_produs') return 'altul'
  return null
}

function mapSnapshotToProductType(value: string | null | undefined): string | null {
  if (!value) return null
  if (value === 'fungicid' || value === 'insecticid' || value === 'erbicid' || value === 'acaricid') {
    return 'fitosanitar'
  }
  if (value === 'ingrasamant' || value === 'foliar') return 'ingrasamant'
  if (value === 'bioregulator') return 'biostimulator'
  if (value === 'altul') return 'alt_produs'
  return null
}

function mapInterventieSelectToDb(value: string, custom: string | undefined): string {
  if (value === 'alt_tip') return (custom ?? '').trim()
  return TIP_INTERVENTIE_OPTIONS.find((option) => option.value === value)?.label ?? ''
}

function mapScopSelectToDb(value: string, custom: string | undefined): string {
  if (value === 'alt_scop') return (custom ?? '').trim()
  return SCOP_OPTIONS.find((option) => option.value === value)?.label ?? ''
}

function mergeCantitateIntoObservatii(observatii: string, cantitateText: string): string {
  const cantitate = cantitateText.trim()
  const observatiiTrimmed = observatii.trim()
  if (!cantitate) return observatiiTrimmed
  if (!observatiiTrimmed) return `Cantitate: ${cantitate}`
  return `Cantitate: ${cantitate}\n${observatiiTrimmed}`
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
    manual_tip_select: '',
    manual_tip_custom: '',
    manual_scop_select: '',
    manual_scop_custom: '',
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
    cantitate_text: '',
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
    cantitate_text: '',
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
    cantitate_text: '',
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

export function withProductOrder(produse: MarkAplicataProdusDraft[]) {
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

export function validateProducts(produse: MarkAplicataProdusDraft[]): string | null {
  if (produse.length === 0) return 'Aplicarea trebuie să aibă cel puțin un produs.'
  const invalid = produse.find((produs) => !produs.produs_id && !produs.produs_nume_manual.trim())
  if (invalid) return 'Fiecare produs trebuie selectat din bibliotecă sau completat manual.'
  const missingType = produse.find((produs) => !produs.tip_snapshot?.trim())
  if (missingType) return 'Selectează tipul pentru fiecare produs.'
  const missingCantitate = produse.find((produs) => !(produs.cantitate_text ?? '').trim())
  if (missingCantitate) return 'Completează cantitatea aplicată pentru fiecare produs.'
  return null
}

export function buildMarkAplicataDiferentePlan(
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
    const plannedCantitate = normalizeSummaryText(plannedProduct.observatii)
    const currentCantitate = normalizeSummaryText(actual.cantitate_text)
    if (plannedCantitate !== currentCantitate) {
      summary.push(`Cantitate diferită la produs #${index + 1}`)
    }
  })

  const observatii = manualText?.trim() || null
  if (summary.length === 0 && !observatii) return null
  return { automat: summary, observatii }
}

function normalizeSummaryText(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function formatDateTimeSummary(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  if (!text) return '—'

  const [datePart, timePart] = text.split('T')
  const [year, month, day] = datePart?.split('-') ?? []
  if (!year || !month || !day) return text

  if (timePart) {
    return `${day}.${month}.${year} · ${timePart.slice(0, 5)}`
  }

  return `${day}.${month}.${year}`
}

function formatProductDoseSummary(produs: MarkAplicataProdusDraft): string | null {
  return normalizeSummaryText(produs.cantitate_text ?? null)
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
  const { tenantId } = useDashboardAuth()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [isMeteoPending, startMeteoTransition] = useTransition()
  const [meteoError, setMeteoError] = useState<string | null>(null)
  const [resolvedMeteoSnapshot, setResolvedMeteoSnapshot] = useState<MeteoSnapshot | null>(meteoSnapshot)
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
        resolvedMeteoSnapshot,
        defaultManualData,
        defaultManualParcelaId,
        defaultManualStatus,
      ),
    [cohortLaAplicareBlocata, defaultCantitateMl, defaultCohortLaAplicare, defaultManualData, defaultManualParcelaId, defaultManualStatus, defaultOperator, defaultStadiu, resolvedMeteoSnapshot, stadiiValide],
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  const selectedCohort = useWatch({ control: form.control, name: 'cohort_la_aplicare' }) ?? null
  const selectedStadiu = useWatch({ control: form.control, name: 'stadiu_la_aplicare' }) ?? ''
  const selectedManualStatus = useWatch({ control: form.control, name: 'manual_status' }) ?? defaultManualStatus
  const selectedManualParcelaId = useWatch({ control: form.control, name: 'manual_parcela_id' }) ?? defaultManualParcelaId ?? ''
  const selectedTipInterventie = useWatch({ control: form.control, name: 'manual_tip_select' }) ?? ''
  const selectedScopInterventie = useWatch({ control: form.control, name: 'manual_scop_select' }) ?? ''
  const summaryValues = useWatch({ control: form.control })
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
      setMeteoError(null)
      setResolvedMeteoSnapshot(meteoSnapshot)
      form.reset(
        buildDefaultValues(
          defaultCantitateMl,
          cohortLaAplicareBlocata ?? defaultCohortLaAplicare,
          defaultOperator,
          defaultStadiu,
          stadiiValide,
          resolvedMeteoSnapshot,
          defaultManualData,
          defaultManualParcelaId,
          defaultManualStatus,
        )
      )
      setProduseDraft(buildInitialProduse(produseEfective, produsePlanificate))
      queueMicrotask(() => setEditMeteo(false))
    }
  }, [cohortLaAplicareBlocata, defaultCantitateMl, defaultCohortLaAplicare, defaultManualData, defaultManualParcelaId, defaultManualStatus, defaultOperator, defaultStadiu, form, meteoSnapshot, open, produseEfective, produsePlanificate, resolvedMeteoSnapshot, stadiiValide])

  useEffect(() => {
    if (!open || mode !== 'manual') return
    const parcelaId = selectedManualParcelaId || defaultManualParcelaId || ''
    if (!parcelaId) {
      setMeteoError('Meteo indisponibil — parcelă nespecificată.')
      setResolvedMeteoSnapshot(null)
      return
    }

    startMeteoTransition(async () => {
      try {
        const meteoZi = await loadHubMeteoParcelaAction(parcelaId)
        if (!meteoZi?.snapshot_curent) {
          setMeteoError('Meteo indisponibil')
          setResolvedMeteoSnapshot(null)
          return
        }
        setMeteoError(null)
        setResolvedMeteoSnapshot(meteoZi.snapshot_curent)
      } catch {
        setMeteoError('Meteo indisponibil')
        setResolvedMeteoSnapshot(null)
      }
    })
  }, [defaultManualParcelaId, mode, open, selectedManualParcelaId])

  const save = form.handleSubmit(async (values) => {
    const productError = validateProducts(produseDraft)
    if (productError) {
      form.setError('observatii', { type: 'manual', message: productError })
      toast.error(productError)
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
      if (values.manual_status === 'aplicata' && !values.stadiu_la_aplicare?.trim()) {
        form.setError('stadiu_la_aplicare', { type: 'manual', message: 'Completează stadiul real la aplicare.' })
        return
      }
      const tipInterventie = mapInterventieSelectToDb(values.manual_tip_select ?? '', values.manual_tip_custom)
      const scopInterventie = mapScopSelectToDb(values.manual_scop_select ?? '', values.manual_scop_custom)
      if (!tipInterventie) {
        toast.error('Selectează tipul intervenției.')
        return
      }
      if (!scopInterventie) {
        toast.error('Selectează scopul intervenției.')
        return
      }

      try {
        await onSubmit({
          ...values,
          data_aplicata: values.manual_status === 'aplicata' ? values.manual_data : '',
          manual_parcela_id: values.manual_parcela_id,
          manual_status: values.manual_status,
          manual_data: values.manual_data,
          tip_interventie: tipInterventie,
          scop: scopInterventie,
          cohort_la_aplicare: undefined,
          meteoSnapshot: editMeteo
            ? {
                timestamp: new Date().toISOString(),
                temperatura_c: toOptionalNumber(values.meteo_temperatura_c),
                umiditate_pct: toOptionalNumber(values.meteo_umiditate_pct),
                vant_kmh: toOptionalNumber(values.meteo_vant_kmh),
                precipitatii_mm_24h: toOptionalNumber(values.meteo_precipitatii_mm_24h),
                descriere: values.meteo_descriere?.trim() || null,
              }
            : resolvedMeteoSnapshot,
          produse: withProductOrder(produseDraft).map((produs) => ({
            ...produs,
            doza_l_per_ha: null,
            doza_ml_per_hl: null,
            cantitate_totala: null,
            unitate_cantitate: null,
            observatii: mergeCantitateIntoObservatii(produs.observatii, produs.cantitate_text ?? ''),
            cantitate_text: (produs.cantitate_text ?? '').trim(),
          })),
          diferenteFataDePlan: null,
        })
        if (tenantId) {
          void autoSaveProdusInBiblioteca(
            withProductOrder(produseDraft).map((produs) => ({
              produs_id: produs.produs_id,
              produs_nume_manual: produs.produs_nume_manual,
              substanta_activa_snapshot: produs.substanta_activa_snapshot,
              tip_snapshot: produs.tip_snapshot,
              frac_irac_snapshot: produs.frac_irac_snapshot,
              phi_zile_snapshot: produs.phi_zile_snapshot,
            })),
            tenantId
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nu am putut salva intervenția.'
        toast.error(message)
      }
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
      : resolvedMeteoSnapshot

    try {
      await onSubmit({
        ...values,
        meteoSnapshot: nextSnapshot,
        produse: withProductOrder(produseDraft).map((produs) => ({
          ...produs,
          doza_l_per_ha: null,
          doza_ml_per_hl: null,
          cantitate_totala: null,
          unitate_cantitate: null,
          observatii: mergeCantitateIntoObservatii(produs.observatii, produs.cantitate_text ?? ''),
          cantitate_text: (produs.cantitate_text ?? '').trim(),
        })),
        diferenteFataDePlan: buildMarkAplicataDiferentePlan(produseDraft, produsePlanificate, values.diferente_fata_de_plan_text),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu am putut salva aplicarea.'
      toast.error(message)
    }
  }, (errors) => {
    const firstError = Object.values(errors)[0]
    const message = firstError?.message?.toString() ?? 'Formularul are erori. Verifică câmpurile obligatorii.'
    toast.error(message)
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

  const selectedManualParcelaLabel = useMemo(() => {
    const selectedOption = manualParcele.find((option) => option.value === selectedManualParcelaId)
    return selectedOption?.label ?? defaultManualParcelaLabel ?? null
  }, [defaultManualParcelaLabel, manualParcele, selectedManualParcelaId])

  const selectedStadiuLabel = useMemo(() => {
    const option = stadiiOptions.find((item) => item.value === selectedStadiu)
    return option?.label ?? normalizeSummaryText(selectedStadiu)
  }, [selectedStadiu, stadiiOptions])

  const plannedProductsSummary = useMemo(() => {
    if (produsePlanificate.length === 0) return 'Nu există produse planificate disponibile.'
    return produsePlanificate
      .map((produs) => produs.produs?.nume_comercial ?? produs.produs_nume_manual ?? produs.produs_nume_snapshot ?? 'Produs')
      .join(' · ')
  }, [produsePlanificate])

  const summaryProducts = useMemo(
    () =>
      produseDraft.map((produs) => ({
        id: produs.id,
        name: productName(produs, produseFitosanitare),
        doseLabel: formatProductDoseSummary(produs),
      })),
    [produseDraft, produseFitosanitare]
  )

  const summaryMeteo = useMemo(() => {
    const values = editMeteo
      ? {
          temperatura: normalizeSummaryText(summaryValues.meteo_temperatura_c),
          umiditate: normalizeSummaryText(summaryValues.meteo_umiditate_pct),
          vant: normalizeSummaryText(summaryValues.meteo_vant_kmh),
          precipitatii: normalizeSummaryText(summaryValues.meteo_precipitatii_mm_24h),
          descriere: normalizeSummaryText(summaryValues.meteo_descriere),
        }
      : {
          temperatura:
            typeof resolvedMeteoSnapshot?.temperatura_c === 'number' ? String(resolvedMeteoSnapshot.temperatura_c) : null,
          umiditate:
            typeof resolvedMeteoSnapshot?.umiditate_pct === 'number' ? String(resolvedMeteoSnapshot.umiditate_pct) : null,
          vant: typeof resolvedMeteoSnapshot?.vant_kmh === 'number' ? String(resolvedMeteoSnapshot.vant_kmh) : null,
          precipitatii:
            typeof resolvedMeteoSnapshot?.precipitatii_mm_24h === 'number'
              ? String(resolvedMeteoSnapshot.precipitatii_mm_24h)
              : null,
          descriere: normalizeSummaryText(resolvedMeteoSnapshot?.descriere ?? null),
        }

    if (
      !values.temperatura &&
      !values.umiditate &&
      !values.vant &&
      !values.precipitatii &&
      !values.descriere
    ) {
      return null
    }

    return values
  }, [
    editMeteo,
    resolvedMeteoSnapshot,
    summaryValues.meteo_descriere,
    summaryValues.meteo_precipitatii_mm_24h,
    summaryValues.meteo_temperatura_c,
    summaryValues.meteo_umiditate_pct,
    summaryValues.meteo_vant_kmh,
  ])

  const desktopDifferences = useMemo(
    () =>
      mode === 'din_plan'
        ? buildMarkAplicataDiferentePlan(produseDraft, produsePlanificate, summaryValues.diferente_fata_de_plan_text)
        : null,
    [mode, produseDraft, produsePlanificate, summaryValues.diferente_fata_de_plan_text]
  )

  const cohortField = isRubusMixt ? (
    <div className="space-y-2">
      <Label>{mode === 'manual' ? 'Cohortă pentru intervenție' : 'Aplicare pentru cohorta'}</Label>
      <Select
        value={selectedCohort || undefined}
        onValueChange={(value) => form.setValue('cohort_la_aplicare', value as Cohorta)}
        disabled={Boolean(cohortLaAplicareBlocata)}
      >
        <SelectTrigger className="agri-control h-11 w-full md:h-10">
          <SelectValue placeholder="Selectează cohorta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="floricane">{getCohortaLabel('floricane')}</SelectItem>
          <SelectItem value="primocane">{getCohortaLabel('primocane')}</SelectItem>
        </SelectContent>
      </Select>
      {form.formState.errors.cohort_la_aplicare ? (
        <p className="text-xs text-[var(--status-danger-text)]">
          {form.formState.errors.cohort_la_aplicare.message}
        </p>
      ) : null}
    </div>
  ) : null

  const planDateField = mode === 'din_plan' ? (
    <div className="space-y-2">
      <Label htmlFor="aplicata-data">Data aplicată</Label>
      <Input id="aplicata-data" type="datetime-local" className="agri-control h-11 md:h-10" {...form.register('data_aplicata')} />
    </div>
  ) : null

  const cantitateField = (
    <div className="space-y-2">
      <Label htmlFor="aplicata-cantitate">Cantitate totală (ml)</Label>
      <Input id="aplicata-cantitate" inputMode="decimal" className="agri-control h-11 md:h-10" {...form.register('cantitate_totala_ml')} />
    </div>
  )

  const operatorField = (
    <div className="space-y-2">
      <Label htmlFor="aplicata-operator">Operator</Label>
      <Input id="aplicata-operator" className="agri-control h-11 md:h-10" {...form.register('operator')} />
    </div>
  )

  const stadiuField = (
    <div className="space-y-2">
      <Label>Stadiu la aplicare</Label>
      <Select
        value={selectedStadiu || undefined}
        onValueChange={(value) => form.setValue('stadiu_la_aplicare', value, { shouldValidate: true })}
      >
        <SelectTrigger className="agri-control h-11 w-full md:h-10">
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
  )

  const observatiiField = (
    <div className="space-y-2">
      <Label htmlFor="aplicata-observatii">Observații</Label>
      <Textarea id="aplicata-observatii" rows={4} className="agri-control min-h-[4.5rem] md:min-h-[5.5rem]" {...form.register('observatii')} />
      {form.formState.errors.observatii ? (
        <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.observatii.message}</p>
      ) : null}
    </div>
  )

  const plannedProductsBlock = mode === 'din_plan' ? (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Produse planificate</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{plannedProductsSummary}</p>
        </div>
      </div>
    </div>
  ) : null

  const productsBlock = (
    <div className="space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0">
        <div className="min-w-0">
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
          className="shrink-0"
          onClick={() => setProduseDraft((current) => [...current, createEmptyProdusDraft(current.length + 1)])}
        >
          <Plus className="h-4 w-4" />
          Adaugă produs
        </Button>
      </div>

      <div className="space-y-2">
        {produseDraft.map((produsDraft, index) => {
          const selectedProduct =
            produseFitosanitare.find((produs) => produs.id === produsDraft.produs_id) ?? null
          const availableProducts =
            selectedProduct && !produseFitosanitare.some((produs) => produs.id === selectedProduct.id)
              ? [selectedProduct, ...produseFitosanitare]
              : produseFitosanitare

          return (
            <div
              key={produsDraft.id}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-2 min-w-0 overflow-x-hidden"
            >
              <div className="mb-2.5 flex items-start justify-between gap-2.5 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Produs #{index + 1}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {productName(produsDraft, produseFitosanitare)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Mută sus produsul ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => setProduseDraft((current) => moveProduct(current, produsDraft.id, 'up'))}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Mută jos produsul ${index + 1}`}
                    disabled={index === produseDraft.length - 1}
                    onClick={() => setProduseDraft((current) => moveProduct(current, produsDraft.id, 'down'))}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Șterge produsul ${index + 1}`}
                    onClick={() =>
                      setProduseDraft((current) =>
                        withProductOrder(current.filter((produs) => produs.id !== produsDraft.id))
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4 text-[var(--status-danger-text)]" />
                  </Button>
                </div>
              </div>

                <div className="grid gap-2 md:grid-cols-2 md:gap-x-3 min-w-0">
                <div className="space-y-2">
                  <Label htmlFor={`aplicata-produs-${produsDraft.id}`}>Produs din bibliotecă</Label>
                  <ProdusFitosanitarPicker
                    produse={availableProducts}
                    value={produsDraft.produs_id ?? null}
                    popoverCollisionPadding={24}
                    popoverContentClassName="max-h-[min(48vh,20rem)]"
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

                <div className="space-y-2 md:col-span-2">
                  <Label>Tip produs</Label>
                  <Select
                    value={mapSnapshotToProductType(produsDraft.tip_snapshot) ?? undefined}
                    onValueChange={(value) =>
                      updateProduct(produsDraft.id, (current) => {
                        const mapped = mapProductTypeToSnapshot(value)
                        const isFitosanitar = value === 'fitosanitar'
                        return {
                          ...current,
                          tip_snapshot: mapped,
                          substanta_activa_snapshot: isFitosanitar ? current.substanta_activa_snapshot : '',
                          frac_irac_snapshot: isFitosanitar ? current.frac_irac_snapshot : '',
                          phi_zile_snapshot: isFitosanitar ? current.phi_zile_snapshot : null,
                        }
                      })
                    }
                  >
                    <SelectTrigger className="agri-control h-11 w-full md:h-10">
                      <SelectValue placeholder="Selectează tipul produsului" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[calc(100vw-2rem)]">
                      {PRODUCT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(mapSnapshotToProductType(produsDraft.tip_snapshot) === 'fitosanitar') ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor={`aplicata-substanta-${produsDraft.id}`}>Substanță activă</Label>
                      <Input
                        id={`aplicata-substanta-${produsDraft.id}`}
                        value={produsDraft.substanta_activa_snapshot}
                        onChange={(event) =>
                          updateProduct(produsDraft.id, (current) => ({
                            ...current,
                            substanta_activa_snapshot: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`aplicata-frac-${produsDraft.id}`}>FRAC/IRAC</Label>
                        <Input
                          id={`aplicata-frac-${produsDraft.id}`}
                          value={produsDraft.frac_irac_snapshot}
                          onChange={(event) =>
                            updateProduct(produsDraft.id, (current) => ({
                              ...current,
                              frac_irac_snapshot: event.target.value,
                            }))
                          }
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
                          onChange={(event) =>
                            updateProduct(produsDraft.id, (current) => ({
                              ...current,
                              phi_zile_snapshot: toOptionalNumber(event.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor={`aplicata-cantitate-${produsDraft.id}`}>Cantitate aplicată</Label>
                  <Input
                    id={`aplicata-cantitate-${produsDraft.id}`}
                    value={produsDraft.cantitate_text}
                    placeholder={CANTITATE_PLACEHOLDER}
                    onChange={(event) =>
                      updateProduct(produsDraft.id, (current) => ({
                        ...current,
                        cantitate_text: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`aplicata-produs-observatii-${produsDraft.id}`}>Observații produs</Label>
                  <Textarea
                    id={`aplicata-produs-observatii-${produsDraft.id}`}
                    rows={2}
                    value={produsDraft.observatii}
                    onChange={(event) =>
                      updateProduct(produsDraft.id, (current) => ({
                        ...current,
                        observatii: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const differencesField = mode === 'din_plan' ? (
    <div className="space-y-2">
      <Label htmlFor="aplicata-diferente">Diferențe față de plan</Label>
      <Textarea
        id="aplicata-diferente"
        rows={3}
        placeholder="Ex: produs înlocuit, doză ajustată, produs omis."
        {...form.register('diferente_fata_de_plan_text')}
      />
    </div>
  ) : null

  const meteoBlock = (
    <div className="rounded-2xl bg-[var(--surface-card-muted)] p-3 min-w-0">
      <div className="flex flex-col items-start justify-between gap-2.5 sm:flex-row sm:items-center min-w-0">
        <div className="min-w-0">
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
        <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-sm text-[var(--text-secondary)]">
          {isMeteoPending ? (
            <p className="col-span-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Se încarcă meteo...
            </p>
          ) : (
            <>
              <p>{`Temp: ${resolvedMeteoSnapshot?.temperatura_c ?? 'Meteo indisponibil'}${typeof resolvedMeteoSnapshot?.temperatura_c === 'number' ? '°C' : ''}`}</p>
              <p>{`Umiditate: ${resolvedMeteoSnapshot?.umiditate_pct ?? 'Meteo indisponibil'}${typeof resolvedMeteoSnapshot?.umiditate_pct === 'number' ? '%' : ''}`}</p>
              <p>{`Vânt: ${resolvedMeteoSnapshot?.vant_kmh ?? 'Meteo indisponibil'}${typeof resolvedMeteoSnapshot?.vant_kmh === 'number' ? ' km/h' : ''}`}</p>
              <p>{`Ploaie 24h: ${resolvedMeteoSnapshot?.precipitatii_mm_24h ?? 'Meteo indisponibil'}${typeof resolvedMeteoSnapshot?.precipitatii_mm_24h === 'number' ? ' mm' : ''}`}</p>
              <p className="col-span-2">{meteoError ?? resolvedMeteoSnapshot?.descriere ?? 'Meteo indisponibil'}</p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="meteo-descriere">Descriere</Label>
            <Input id="meteo-descriere" {...form.register('meteo_descriere')} />
          </div>
        </div>
      )}
    </div>
  )

  const mobileContent = (
    <form className="space-y-3.5 min-w-0" onSubmit={save}>
      {mode === 'manual' ? (
        <div className="space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3.5 min-w-0">
          <div className="flex items-center justify-between gap-2.5 min-w-0">
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Intervenție manuală</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)] break-words">
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
                <SelectTrigger className="agri-control h-11 w-full md:h-10">
                  <SelectValue placeholder="Selectează parcela" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
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

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-status">Status</Label>
              <Select
                value={selectedManualStatus}
                onValueChange={(value) =>
                  form.setValue('manual_status', value as 'planificata' | 'aplicata', { shouldValidate: true })
                }
              >
                <SelectTrigger className="agri-control h-11 w-full md:h-10">
                  <SelectValue placeholder="Selectează statusul" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  <SelectItem value="planificata">Planificată</SelectItem>
                  <SelectItem value="aplicata">Aplicată</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.manual_status ? (
                <p className="text-xs text-[var(--status-danger-text)]">
                  {form.formState.errors.manual_status.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-data">
                {selectedManualStatus === 'aplicata' ? 'Data aplicării' : 'Data planificării'}
              </Label>
              <Input id="manual-data" type="datetime-local" className="agri-control h-11 md:h-10" {...form.register('manual_data')} />
              {form.formState.errors.manual_data ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.manual_data.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-tip-interventie">Tip intervenție</Label>
              <Select
                value={selectedTipInterventie || undefined}
                onValueChange={(value) => form.setValue('manual_tip_select', value, { shouldValidate: true })}
              >
                <SelectTrigger className="agri-control h-11 w-full md:h-10">
                  <SelectValue placeholder="Selectează tipul" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {TIP_INTERVENTIE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTipInterventie === 'alt_tip' ? (
                <Input
                  id="manual-tip-interventie"
                  className="agri-control h-11 md:h-10"
                  placeholder="Specifică tipul"
                  {...form.register('manual_tip_custom')}
                />
              ) : null}
              {form.formState.errors.tip_interventie ? (
                <p className="text-xs text-[var(--status-danger-text)]">
                  {form.formState.errors.tip_interventie.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-scop">Scop</Label>
              <Select
                value={selectedScopInterventie || undefined}
                onValueChange={(value) => form.setValue('manual_scop_select', value, { shouldValidate: true })}
              >
                <SelectTrigger className="agri-control h-11 w-full md:h-10">
                  <SelectValue placeholder="Selectează scopul" />
                </SelectTrigger>
                <SelectContent>
                  {SCOP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedScopInterventie === 'alt_scop' ? (
                <Input
                  id="manual-scop"
                  className="agri-control h-11 md:h-10"
                  placeholder="Specifică scopul"
                  {...form.register('manual_scop_custom')}
                />
              ) : null}
              {form.formState.errors.scop ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.scop.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'din_plan' ? cohortField : null}
      {planDateField}
      {cantitateField}
      {operatorField}
      {stadiuField}
      {observatiiField}
      {plannedProductsBlock}
      {productsBlock}
      {differencesField}
      {meteoBlock}
    </form>
  )

  const desktopContent = (
    <form className="space-y-4" onSubmit={save}>
      <DesktopFormGrid
        className="md:grid-cols-[minmax(0,1fr)_18rem] md:gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-5"
        aside={
          <InterventieAplicareFormSummary
            title={mode === 'manual' ? 'Rezumat intervenție' : 'Rezumat aplicare'}
            contextLabel={mode === 'manual' ? selectedManualParcelaLabel ?? 'Intervenție manuală' : 'Aplicare din plan'}
            statusLabel={mode === 'manual' ? (selectedManualStatus === 'aplicata' ? 'Aplicată' : 'Planificată') : null}
            dateCaption={mode === 'manual' ? 'Data intervenției' : 'Data aplicării'}
            dateLabel={formatDateTimeSummary(mode === 'manual' ? summaryValues.manual_data : summaryValues.data_aplicata)}
            cohortLabel={selectedCohort ? getCohortaLabel(selectedCohort) : null}
            tipInterventie={mode === 'manual' ? normalizeSummaryText(mapInterventieSelectToDb(summaryValues.manual_tip_select ?? '', summaryValues.manual_tip_custom)) : null}
            scop={mode === 'manual' ? normalizeSummaryText(mapScopSelectToDb(summaryValues.manual_scop_select ?? '', summaryValues.manual_scop_custom)) : null}
            operator={normalizeSummaryText(summaryValues.operator)}
            stadiuLabel={selectedStadiuLabel}
            cantitateLabel={
              normalizeSummaryText(summaryValues.cantitate_totala_ml)
                ? `${String(summaryValues.cantitate_totala_ml).trim()} ml`
                : null
            }
            plannedProductsLabel={mode === 'din_plan' ? plannedProductsSummary : null}
            products={summaryProducts}
            meteo={summaryMeteo}
            differences={desktopDifferences}
            className="md:rounded-[22px] md:p-4 lg:p-5"
          />
        }
      >
        {mode === 'manual' ? (
          <FormDialogSection>
            <DesktopFormPanel>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--text-primary)] [font-weight:650]">Intervenție manuală</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {selectedManualParcelaLabel
                      ? `Parcela curentă: ${selectedManualParcelaLabel}`
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
                    <SelectTrigger className="agri-control h-11 w-full md:h-10">
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
                    <p className="text-xs text-[var(--status-danger-text)]">
                      {form.formState.errors.manual_parcela_id.message}
                    </p>
                  ) : null}
                </div>
              ) : selectedManualParcelaLabel ? (
                <div className="rounded-2xl bg-[var(--surface-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  {selectedManualParcelaLabel}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-status">Status</Label>
                  <Select
                    value={selectedManualStatus}
                    onValueChange={(value) =>
                      form.setValue('manual_status', value as 'planificata' | 'aplicata', {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="agri-control h-11 w-full md:h-10">
                      <SelectValue placeholder="Selectează statusul" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planificata">Planificată</SelectItem>
                      <SelectItem value="aplicata">Aplicată</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.manual_status ? (
                    <p className="text-xs text-[var(--status-danger-text)]">
                      {form.formState.errors.manual_status.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-data">
                    {selectedManualStatus === 'aplicata' ? 'Data aplicării' : 'Data planificării'}
                  </Label>
                  <Input id="manual-data" type="datetime-local" className="agri-control h-11 md:h-10" {...form.register('manual_data')} />
                  {form.formState.errors.manual_data ? (
                    <p className="text-xs text-[var(--status-danger-text)]">
                      {form.formState.errors.manual_data.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-tip-interventie">Tip intervenție</Label>
                  <Select
                    value={selectedTipInterventie || undefined}
                    onValueChange={(value) => form.setValue('manual_tip_select', value, { shouldValidate: true })}
                  >
                    <SelectTrigger className="agri-control h-11 w-full md:h-10">
                      <SelectValue placeholder="Selectează tipul" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIP_INTERVENTIE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTipInterventie === 'alt_tip' ? (
                    <Input
                      id="manual-tip-interventie"
                      className="agri-control h-11 md:h-10"
                      placeholder="Specifică tipul"
                      {...form.register('manual_tip_custom')}
                    />
                  ) : null}
                  {form.formState.errors.tip_interventie ? (
                    <p className="text-xs text-[var(--status-danger-text)]">
                      {form.formState.errors.tip_interventie.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-scop">Scop</Label>
                  <Select
                    value={selectedScopInterventie || undefined}
                    onValueChange={(value) => form.setValue('manual_scop_select', value, { shouldValidate: true })}
                  >
                    <SelectTrigger className="agri-control h-11 w-full md:h-10">
                      <SelectValue placeholder="Selectează scopul" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedScopInterventie === 'alt_scop' ? (
                    <Input
                      id="manual-scop"
                      className="agri-control h-11 md:h-10"
                      placeholder="Specifică scopul"
                      {...form.register('manual_scop_custom')}
                    />
                  ) : null}
                  {form.formState.errors.scop ? (
                    <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.scop.message}</p>
                  ) : null}
                </div>
              </div>
            </DesktopFormPanel>
          </FormDialogSection>
        ) : (
          <FormDialogSection>
            <DesktopFormPanel>
              <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
                {planDateField}
                {cohortField}
                {cantitateField}
                {operatorField}
                {stadiuField}
              </div>
            </DesktopFormPanel>
          </FormDialogSection>
        )}

        <FormDialogSection>
          <DesktopFormPanel>
            {plannedProductsBlock}
            {productsBlock}
          </DesktopFormPanel>
        </FormDialogSection>

        <FormDialogSection>
          <DesktopFormPanel>
            {mode === 'manual' ? (
              <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
                {cantitateField}
                {operatorField}
                {stadiuField}
              </div>
            ) : null}
            {mode === 'manual' ? observatiiField : null}
            {mode === 'din_plan' ? observatiiField : null}
            {differencesField}
            {meteoBlock}
          </DesktopFormPanel>
        </FormDialogSection>
      </DesktopFormGrid>
    </form>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] max-h-[100dvh] rounded-none flex flex-col">
          <SheetHeader>
            <SheetTitle>{mode === 'manual' ? 'Adaugă intervenție manuală' : 'Marchează ca aplicat'}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">{mobileContent}</div>
          <SheetFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
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
      description={
        mode === 'manual'
          ? 'Completează contextul, produsele și observațiile fără să schimbi fluxul de salvare.'
          : 'Confirmă aplicarea reală, produsele efective și diferențele față de plan.'
      }
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={pending}
          saveLabel={mode === 'manual' ? 'Salvează intervenția' : 'Marchează aplicarea'}
        />
      }
      desktopFormWide
      showCloseButton
      contentClassName="md:w-[min(96vw,84rem)] md:max-w-none"
    >
      {desktopContent}
    </AppDialog>
  )
}
