'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { AppSelect } from '@/components/ui/app-select'
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
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import type {
  AplicareProdusV2,
  InterventieProdusV2,
  ProdusFitosanitar,
} from '@/lib/supabase/queries/tratamente'
import type { MeteoSnapshot } from '@/lib/tratamente/meteo'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import {
  getLabelRo,
  listStadiiPentruGrup,
  normalizeStadiu,
  PROFILURI_STADII_PER_GRUP,
  type StadiuCod,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'
import { saveProdusFitosanitarInLibraryAction } from '@/app/(dashboard)/tratamente/produse-fitosanitare/actions'
import { loadHubMeteoParcelaAction } from '@/app/(dashboard)/tratamente/actions'
import type { AplicareEditData } from '@/app/(dashboard)/tratamente/actions'
import {
  deleteAplicareAction,
  markAplicataAction,
} from '@/app/(dashboard)/parcele/[id]/tratamente/aplicari-actions'
import { autoSaveProdusInBiblioteca } from '@/lib/tratamente/auto-save-produs-biblioteca'
import { getSupabase } from '@/lib/supabase/client'
import { getCurrentSezon } from '@/lib/utils/sezon'
import { DIALOG_HISTORY_MARKER, stripDialogHistoryMarker } from '@/lib/ui/dialog-history'
import {
  buildStadiuAppSelectOptions,
  COHORTA_APP_SELECT_OPTIONS,
  formatStadiuOptionLabel,
  PRODUCT_TYPE_APP_SELECT_OPTIONS,
  SCOP_INTERVENTIE_APP_SELECT_OPTIONS,
  TIP_INTERVENTIE_APP_SELECT_OPTIONS,
} from '@/lib/ui/app-select-maps'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/supabase'
import {
  getUnitateDefaultPentruMetoda,
  getUnitatiPentruMetoda,
  METODA_APLICARE_LABEL_RO,
  METODE_CU_PHI,
  METODE_FARA_PRODUS,
  type MetodaAplicare,
} from '@/types/tratamente-metode'

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
  metoda_aplicare?: MetodaAplicare | null
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
  mode?: 'din_plan' | 'manual' | 'edit'
  aplicareExistenta?: AplicareEditData | null
  cohortLaAplicareBlocata?: Cohorta | null
  defaultCantitateMl: number | null
  defaultCohortLaAplicare?: Cohorta | null
  defaultMetoda?: MetodaAplicare | null
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

type ParcelaStadiuRow = Tables<'stadii_fenologice_parcela'>
type ParcelaPlanRow = Tables<'parcele_planuri'>
type PlanTratamentRow = Tables<'planuri_tratament'>
type PlanLinieRow = Tables<'planuri_tratament_linii'>
type PlanLinieProdusRow = Tables<'planuri_tratament_linie_produse'>

interface RecomandareInterventie {
  linieId: string
  titlu: string
  produse: Array<{
    nume: string
    dozaSugerataMlPerHl: number | null
    dozaSugerataLPerHa: number | null
    cantitateText: string | null
  }>
  stadiuTrigger: string
  sursa?: 'plan' | 'platforma'
}

interface RecomandareInterventieDraft extends RecomandareInterventie {
  draftProduse: MarkAplicataProdusDraft[]
}

const EMPTY_APLICARE_PRODUSE: AplicareProdusV2[] = []
const EMPTY_PLAN_PRODUSE: InterventieProdusV2[] = []
const EMPTY_PRODUSE_FITOSANITARE: ProdusFitosanitar[] = []
const CANTITATE_PLACEHOLDER = 'ex: 60 ml la 15 l apă, sau 200 ml/ha'

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

function mapInterventieSelectToDb(value: string, _custom: string | undefined): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === 'alt_tip') return 'altul'

  if (normalized === 'foliar' || normalized === 'fertirigare' || normalized === 'aplicare_sol') {
    return 'nutritie'
  }
  if (normalized === 'tratament_radacini' || normalized === 'badijonare') {
    return 'protectie'
  }

  if (normalized.includes('biostimul')) return 'biostimulare'
  if (normalized.includes('erbicid')) return 'erbicidare'
  if (normalized.includes('igien') || normalized.includes('sanitar')) return 'igiena'
  if (normalized.includes('monitor')) return 'monitorizare'
  if (
    normalized.includes('fert') ||
    normalized.includes('foliar') ||
    normalized.includes('nutrit') ||
    normalized.includes('radacin')
  ) {
    return 'nutritie'
  }
  if (
    normalized.includes('fungicid') ||
    normalized.includes('insecticid') ||
    normalized.includes('acaricid') ||
    normalized.includes('protect')
  ) {
    return 'protectie'
  }

  return 'altul'
}

function mapScopSelectToDb(value: string, custom: string | undefined): string {
  if (value === 'alt_scop') return (custom ?? '').trim()
  return SCOP_INTERVENTIE_APP_SELECT_OPTIONS.find((option) => option.value === value)?.label ?? ''
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

function toLocalDateTimeInputValueFromIso(value: string | null | undefined): string {
  if (!value) return toLocalDateTimeInputValue(new Date())
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return toLocalDateTimeInputValue(parsed)
  return value.slice(0, 16)
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
    cantitate_text: produs.cantitate_text ?? '',
    observatii: produs.observatii ?? '',
  }
}

function fromAplicareEditProdus(
  produs: AplicareEditData['produse'][number],
  index: number
): MarkAplicataProdusDraft {
  return {
    id: `edit-${produs.produsId ?? index + 1}-${index + 1}`,
    plan_linie_produs_id: null,
    ordine: index + 1,
    produs_id: produs.produsId,
    produs_nume_manual: produs.produsId ? '' : produs.produsNume,
    produs_nume_snapshot: produs.produsNume,
    substanta_activa_snapshot: '',
    tip_snapshot: 'altul',
    frac_irac_snapshot: '',
    phi_zile_snapshot: null,
    doza_ml_per_hl: produs.dozaMlHl ?? null,
    doza_l_per_ha: produs.dozaLHa ?? null,
    cantitate_text: produs.cantitateText,
    observatii: '',
  }
}

function buildEditProduse(aplicare: AplicareEditData | null | undefined): MarkAplicataProdusDraft[] {
  if (!aplicare?.produse.length) return [createEmptyProdusDraft(1)]
  return aplicare.produse.map(fromAplicareEditProdus)
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

function matchesLegacyMetoda(
  tipInterventie: string | null | undefined,
  metodaAplicare: MetodaAplicare
): boolean {
  if (tipInterventie === null || tipInterventie === undefined) return false
  if (metodaAplicare === 'foliar') {
    return (
      tipInterventie === 'protectie' ||
      tipInterventie === 'biostimulare' ||
      tipInterventie === 'altul'
    )
  }
  if (metodaAplicare === 'fertirigare' || metodaAplicare === 'fertilizare_baza') {
    return tipInterventie === 'nutritie'
  }
  if (metodaAplicare === 'capcana_pus' || metodaAplicare === 'capcana_verificat') {
    return tipInterventie === 'monitorizare'
  }
  return false
}

function formatCantitateSugerata(
  produs: Pick<PlanLinieProdusRow, 'cantitate_text' | 'doza_ml_per_hl' | 'doza_l_per_ha'>,
  metodaAplicare: MetodaAplicare
): string {
  if (produs.cantitate_text?.trim()) return produs.cantitate_text.trim()
  if (metodaAplicare === 'foliar' && typeof produs.doza_ml_per_hl === 'number') {
    return `${produs.doza_ml_per_hl} ml/hl`
  }
  if (typeof produs.doza_l_per_ha === 'number') {
    return `${produs.doza_l_per_ha} L/ha`
  }
  return ''
}

function buildDraftFromRecomandare(
  produs: PlanLinieProdusRow,
  metodaAplicare: MetodaAplicare,
  ordine: number
): MarkAplicataProdusDraft {
  return {
    id: `recomandare-${produs.id}-${ordine}`,
    plan_linie_produs_id: produs.id,
    ordine,
    produs_id: produs.produs_id ?? null,
    produs_nume_manual: produs.produs_nume_manual ?? '',
    produs_nume_snapshot: produs.produs_nume_snapshot ?? null,
    substanta_activa_snapshot: produs.substanta_activa_snapshot ?? '',
    tip_snapshot: produs.tip_snapshot ?? 'altul',
    frac_irac_snapshot: produs.frac_irac_snapshot ?? '',
    phi_zile_snapshot: produs.phi_zile_snapshot ?? null,
    doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
    doza_l_per_ha: produs.doza_l_per_ha ?? null,
    cantitate_text: formatCantitateSugerata(produs, metodaAplicare),
    observatii: produs.observatii ?? '',
  }
}

type RegulaRecomandarePlatformaClient = {
  id: string
  cod: string
  cultura_tip: string
  fenofaza: string
  metoda_aplicare: MetodaAplicare
  cohort: Cohorta | null
  luni_active: number[] | null
  titlu: string
  descriere: string | null
  produs_sugerat_nume: string | null
  produs_sugerat_doza_text: string | null
  tip_interventie: string | null
  prioritate: number
  activ: boolean
  sursa: string | null
}

type ReguliRecomandarePlatformaClientResult = {
  data: RegulaRecomandarePlatformaClient[] | null
  error: unknown | null
}

interface ReguliRecomandarePlatformaClientQuery
  extends PromiseLike<ReguliRecomandarePlatformaClientResult> {
  select(columns: string): ReguliRecomandarePlatformaClientQuery
  eq(column: string, value: unknown): ReguliRecomandarePlatformaClientQuery
  order(column: string, options?: { ascending?: boolean }): ReguliRecomandarePlatformaClientQuery
  limit(count: number): ReguliRecomandarePlatformaClientQuery
}

function normalizeFallbackText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function resolveParcelaCulturaTipClient(parcela: {
  cultura: string | null
  tip_fruct: string | null
} | null): string | null {
  if (!parcela) return null
  return normalizeCropCod(parcela.cultura) ?? normalizeCropCod(parcela.tip_fruct) ?? normalizeFallbackText(parcela.cultura)?.toLowerCase() ?? normalizeFallbackText(parcela.tip_fruct)?.toLowerCase() ?? null
}

function normalizeRecommendationProductKey(value: string | null | undefined): string | null {
  return normalizeFallbackText(value)?.toLowerCase() ?? null
}

function regulaMatchesClientContext(
  regula: RegulaRecomandarePlatformaClient,
  cohort: Cohorta | null | undefined,
  lunaCurenta: number
): boolean {
  if (!regula.activ) return false
  if (regula.cohort && regula.cohort !== (cohort ?? null)) return false
  if (Array.isArray(regula.luni_active) && regula.luni_active.length > 0) {
    return regula.luni_active.includes(lunaCurenta)
  }

  return true
}

function buildDraftFromRegulaPlatforma(
  regula: RegulaRecomandarePlatformaClient,
  metodaAplicare: MetodaAplicare,
  ordine: number
): MarkAplicataProdusDraft {
  const produsNume = normalizeFallbackText(regula.produs_sugerat_nume) ?? regula.titlu
  return {
    id: `regula-${regula.id}-${ordine}`,
    plan_linie_produs_id: null,
    ordine,
    produs_id: null,
    produs_nume_manual: produsNume,
    produs_nume_snapshot: produsNume,
    substanta_activa_snapshot: '',
    tip_snapshot: 'altul',
    frac_irac_snapshot: '',
    phi_zile_snapshot: null,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    cantitate_text: regula.produs_sugerat_doza_text ?? '',
    observatii: regula.descriere ?? '',
  }
}

async function completeazaRecomandariClientCuReguli(params: {
  parcelaId: string
  tenantId: string
  metodaAplicare: MetodaAplicare
  stadiu: StadiuCod
  cohort?: Cohorta | null
  recomandariPlan: RecomandareInterventieDraft[]
}): Promise<RecomandareInterventieDraft[]> {
  if (params.recomandariPlan.length >= 3) {
    return params.recomandariPlan.slice(0, 5)
  }

  const supabase = getSupabase()
  const { data: parcela, error: parcelaError } = await supabase
    .from('parcele')
    .select('cultura,tip_fruct')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.parcelaId)
    .maybeSingle()

  if (parcelaError) throw parcelaError

  const culturaTip = resolveParcelaCulturaTipClient(parcela)
  if (!culturaTip) return params.recomandariPlan

  const query = supabase.from(
    'reguli_recomandare_platforma' as never
  ) as unknown as ReguliRecomandarePlatformaClientQuery

  const { data: reguli, error: reguliError } = await query
    .select('*')
    .eq('activ', true)
    .eq('cultura_tip', culturaTip)
    .eq('fenofaza', params.stadiu)
    .eq('metoda_aplicare', params.metodaAplicare)
    .order('prioritate', { ascending: false })
    .limit(20)

  if (reguliError) throw reguliError

  const produseDejaSugerate = new Set(
    params.recomandariPlan
      .map((recomandare) => normalizeRecommendationProductKey(recomandare.produse[0]?.nume))
      .filter((value): value is string => Boolean(value))
  )
  const lunaCurenta = new Date().getMonth() + 1
  const fallback = (reguli ?? [])
    .filter((regula) => regulaMatchesClientContext(regula, params.cohort, lunaCurenta))
    .sort((first, second) => second.prioritate - first.prioritate)
    .map((regula, index) => {
      const produsNume = normalizeFallbackText(regula.produs_sugerat_nume) ?? regula.titlu
      return {
        linieId: `regula_${regula.id}`,
        titlu: regula.titlu,
        stadiuTrigger: regula.fenofaza,
        sursa: 'platforma' as const,
        produse: [
          {
            nume: produsNume,
            dozaSugerataMlPerHl: null,
            dozaSugerataLPerHa: null,
            cantitateText: regula.produs_sugerat_doza_text,
          },
        ],
        draftProduse: [buildDraftFromRegulaPlatforma(regula, params.metodaAplicare, index + 1)],
      }
    })
    .filter((recomandare) => {
      const productKey = normalizeRecommendationProductKey(recomandare.produse[0]?.nume)
      if (!productKey) return true
      if (produseDejaSugerate.has(productKey)) return false
      produseDejaSugerate.add(productKey)
      return true
    })

  return [...params.recomandariPlan, ...fallback].slice(0, 5)
}

async function loadStadiuCurentParcelaClient(params: {
  parcelaId: string
  tenantId: string
  an: number
}): Promise<ParcelaStadiuRow | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('stadii_fenologice_parcela')
    .select('id,tenant_id,parcela_id,an,stadiu,cohort,data_observata,sursa,observatii,created_at,updated_at,created_by')
    .eq('tenant_id', params.tenantId)
    .eq('parcela_id', params.parcelaId)
    .eq('an', params.an)
    .order('data_observata', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] ?? null
}

async function loadRecomandariParcelaClient(params: {
  parcelaId: string
  tenantId: string
  an: number
  metodaAplicare: MetodaAplicare
  stadiu: StadiuCod
  cohort?: Cohorta | null
}): Promise<RecomandareInterventieDraft[]> {
  const supabase = getSupabase()
  const { data: planParcela, error: planParcelaError } = await supabase
    .from('parcele_planuri')
    .select('id,tenant_id,parcela_id,plan_id,an,activ,created_at,updated_at')
    .eq('tenant_id', params.tenantId)
    .eq('parcela_id', params.parcelaId)
    .eq('an', params.an)
    .eq('activ', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (planParcelaError) throw planParcelaError
  if (!planParcela?.plan_id) {
    return completeazaRecomandariClientCuReguli({
      ...params,
      recomandariPlan: [],
    })
  }

  const { data: plan, error: planError } = await supabase
    .from('planuri_tratament')
    .select('id,tenant_id,nume,descriere,cultura_tip,activ,arhivat,created_at,created_by,updated_at,updated_by')
    .eq('tenant_id', params.tenantId)
    .eq('id', planParcela.plan_id)
    .maybeSingle()

  if (planError) throw planError
  if (!plan?.activ || plan.arhivat) {
    return completeazaRecomandariClientCuReguli({
      ...params,
      recomandariPlan: [],
    })
  }

  const { data: linii, error: liniiError } = await supabase
    .from('planuri_tratament_linii')
    .select(
      'id,tenant_id,plan_id,ordine,stadiu_trigger,tip_interventie,scop,metoda_aplicare,cohort_trigger,regula_repetare,interval_repetare_zile,numar_repetari_max,observatii,motiv_adaugare,doza_ml_per_hl,doza_l_per_ha,fereastra_start_offset_zile,fereastra_end_offset_zile,created_at,updated_at,produs_id,produs_nume_manual,sursa_linie'
    )
    .eq('tenant_id', params.tenantId)
    .eq('plan_id', plan.id)
    .order('ordine', { ascending: true })

  if (liniiError) throw liniiError
  if (!linii?.length) {
    return completeazaRecomandariClientCuReguli({
      ...params,
      recomandariPlan: [],
    })
  }

  const liniiFiltrate = linii.filter((linie) => {
    if (normalizeStadiu(linie.stadiu_trigger) !== params.stadiu) return false
    if (linie.cohort_trigger && params.cohort && linie.cohort_trigger !== params.cohort) return false
    if (linie.metoda_aplicare === params.metodaAplicare) return true
    if (linie.metoda_aplicare !== null) return false
    return matchesLegacyMetoda(linie.tip_interventie, params.metodaAplicare)
  })

  if (!liniiFiltrate.length) {
    return completeazaRecomandariClientCuReguli({
      ...params,
      recomandariPlan: [],
    })
  }

  const { data: produse, error: produseError } = await supabase
    .from('planuri_tratament_linie_produse')
    .select(
      'id,tenant_id,plan_linie_id,ordine,produs_id,produs_nume_manual,produs_nume_snapshot,substanta_activa_snapshot,tip_snapshot,frac_irac_snapshot,phi_zile_snapshot,doza_ml_per_hl,doza_l_per_ha,cantitate_text,observatii,created_at,updated_at'
    )
    .eq('tenant_id', params.tenantId)
    .in(
      'plan_linie_id',
      liniiFiltrate.map((linie) => linie.id)
    )
    .order('ordine', { ascending: true })

  if (produseError) throw produseError

  const recomandariPlan = liniiFiltrate
    .sort((first, second) => first.ordine - second.ordine)
    .slice(0, 5)
    .map((linie) => {
      const produseLinie = (produse ?? []).filter((produs) => produs.plan_linie_id === linie.id)
      return {
        linieId: linie.id,
        titlu: linie.scop?.trim() || 'Intervenție',
        stadiuTrigger: linie.stadiu_trigger,
        sursa: 'plan' as const,
        produse: produseLinie.map((produs) => ({
          nume:
            produs.produs_nume_snapshot ||
            produs.produs_nume_manual ||
            'Produs recomandat',
          dozaSugerataMlPerHl: produs.doza_ml_per_hl ?? null,
          dozaSugerataLPerHa: produs.doza_l_per_ha ?? null,
          cantitateText: produs.cantitate_text ?? null,
        })),
        draftProduse: produseLinie.map((produs, index) =>
          buildDraftFromRecomandare(produs, params.metodaAplicare, index + 1)
        ),
      }
    })

  return completeazaRecomandariClientCuReguli({
    ...params,
    recomandariPlan,
  })
}

export function MarkAplicataSheet({
  mode = 'din_plan',
  aplicareExistenta = null,
  cohortLaAplicareBlocata = null,
  defaultCantitateMl,
  defaultCohortLaAplicare = null,
  defaultMetoda = null,
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
  // Sheet-ul mobil (Radix DialogPrimitive) nu are integrarea de history
  // din `src/components/ui/dialog.tsx`, deci pe Android "back" ar naviga
  // la ruta anterioară. Gestionăm local o intrare în history ca să închidem
  // sheet-ul prin `onOpenChange(false)` fără navigare.
  const addedHistoryEntryRef = useRef(false)
  const closingFromBackRef = useRef(false)
  const [isMeteoPending, startMeteoTransition] = useTransition()
  const [meteoError, setMeteoError] = useState<string | null>(null)
  const [resolvedMeteoSnapshot, setResolvedMeteoSnapshot] = useState<MeteoSnapshot | null>(meteoSnapshot)
  const [editMeteo, setEditMeteo] = useState(false)
  const [produseDraft, setProduseDraft] = useState<MarkAplicataProdusDraft[]>(() =>
    buildInitialProduse(produseEfective, produsePlanificate)
  )
  const [openProductId, setOpenProductId] = useState<string | null>(() => {
    const initial = buildInitialProduse(produseEfective, produsePlanificate)
    return initial[0]?.id ?? null
  })
  // Sprint 4: defaultMetoda support
  const [metodaAplicare, setMetodaAplicare] = useState<MetodaAplicare | null>(defaultMetoda ?? null)
  // Sprint 4: defaultMetoda support
  const [cantitateUnit, setCantitateUnit] = useState<string>(
    getUnitateDefaultPentruMetoda(defaultMetoda ?? null)
  )
  // Sprint 4: defaultMetoda support
  const [stadiuDetectat, setStadiuDetectat] = useState<StadiuCod | null>(
    normalizeStadiu(defaultStadiu ?? '')
  )
  // Sprint 4: defaultMetoda support
  const [stadiuOverride, setStadiuOverride] = useState<StadiuCod | null>(null)
  // Sprint 4: defaultMetoda support
  const [stadiuContextLoading, startStadiuContextTransition] = useTransition()
  // Sprint 4: defaultMetoda support
  const [recomandariDraft, setRecomandariDraft] = useState<RecomandareInterventieDraft[]>([])
  // Sprint 4: defaultMetoda support
  const [recomandariLoading, setRecomandariLoading] = useState(false)
  // Stabilizare deps `useEffect`-ului de reset:
  // 1. `defaultManualData` are default param `new Date()` recomputed la fiecare render
  //    când părintele nu îl pasează, deci nu poate sta direct în deps.
  // 2. `produseEfective` / `produsePlanificate` vin din TanStack Query și pot primi
  //    pointeri noi la același conținut — îi citim din ref-uri în efectul de reset.
  const stableDefaultManualData = useRef(defaultManualData).current
  const produseEfectiveRef = useRef(produseEfective)
  const produsePlanificateRef = useRef(produsePlanificate)
  useEffect(() => {
    produseEfectiveRef.current = produseEfective
  }, [produseEfective])
  useEffect(() => {
    produsePlanificateRef.current = produsePlanificate
  }, [produsePlanificate])

  useEffect(() => {
    if (typeof window === 'undefined' || !isMobile || !open || addedHistoryEntryRef.current) return

    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        [DIALOG_HISTORY_MARKER]: true,
      },
      ''
    )
    addedHistoryEntryRef.current = true

    const handlePopState = () => {
      if (!addedHistoryEntryRef.current) return
      closingFromBackRef.current = true
      addedHistoryEntryRef.current = false
      onOpenChange(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isMobile, onOpenChange, open])

  useEffect(() => {
    if (typeof window === 'undefined' || !isMobile || open) return

    if (closingFromBackRef.current) {
      closingFromBackRef.current = false
      return
    }

    if (addedHistoryEntryRef.current) {
      addedHistoryEntryRef.current = false
      stripDialogHistoryMarker()
    }
  }, [isMobile, open])
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
  const watchedDataAplicata = useWatch({ control: form.control, name: 'data_aplicata' }) ?? ''
  const watchedManualData = useWatch({ control: form.control, name: 'manual_data' }) ?? ''
  const summaryValues = useWatch({ control: form.control })
  const sezonCurent = useMemo(() => getCurrentSezon(), [])
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
  // Sprint 4: defaultMetoda support
  const unitatiPentruMetoda = useMemo(
    () => getUnitatiPentruMetoda(metodaAplicare),
    [metodaAplicare]
  )
  // Sprint 4: defaultMetoda support
  const unitateDefaultPentruMetoda = useMemo(
    () => getUnitateDefaultPentruMetoda(metodaAplicare),
    [metodaAplicare]
  )
  // Sprint 4: defaultMetoda support
  const stadiuChipCurent = stadiuOverride ?? stadiuDetectat
  // Sprint 4: defaultMetoda support
  const shouldShowStadiuChip =
    mode === 'manual' && metodaAplicare !== null && Boolean(grupBiologic)
  // Sprint 4: defaultMetoda support
  const shouldShowRecomandari =
    mode === 'manual' &&
    metodaAplicare !== null &&
    !METODE_FARA_PRODUS.includes(metodaAplicare) &&
    Boolean(stadiuChipCurent)
  // Sprint 4: defaultMetoda support
  const shouldShowCantitateApa = metodaAplicare === null || metodaAplicare === 'foliar'
  // Sprint 4: defaultMetoda support
  const shouldShowPhiWarning =
    metodaAplicare === null || METODE_CU_PHI.includes(metodaAplicare)

  useEffect(() => {
    if (open) {
      setMeteoError(null)
      setResolvedMeteoSnapshot(meteoSnapshot)
      const baseValues = buildDefaultValues(
        defaultCantitateMl,
        cohortLaAplicareBlocata ?? defaultCohortLaAplicare,
        defaultOperator,
        defaultStadiu,
        stadiiValide,
        meteoSnapshot,
        stableDefaultManualData,
        defaultManualParcelaId,
        defaultManualStatus,
      )
      const editMetoda = aplicareExistenta?.metodaAplicare ?? null
      form.reset(
        mode === 'edit' && aplicareExistenta
          ? {
              ...baseValues,
              data_aplicata: toLocalDateTimeInputValueFromIso(aplicareExistenta.dataAplicata),
              operator: aplicareExistenta.operator ?? '',
              stadiu_la_aplicare: normalizeStadiu(aplicareExistenta.stadiuLaAplicare ?? '') ?? '',
              observatii: aplicareExistenta.observatii ?? '',
            }
          : baseValues
      )
      const nextProduse =
        mode === 'edit'
          ? buildEditProduse(aplicareExistenta)
          : buildInitialProduse(
              produseEfectiveRef.current,
              produsePlanificateRef.current
            )
      setProduseDraft(nextProduse)
      setOpenProductId(nextProduse[0]?.id ?? null)
      // Sprint 4: defaultMetoda support
      setMetodaAplicare(mode === 'edit' ? editMetoda : defaultMetoda ?? null)
      // Sprint 4: defaultMetoda support
      setCantitateUnit(getUnitateDefaultPentruMetoda(mode === 'edit' ? editMetoda : defaultMetoda ?? null))
      // Sprint 4: defaultMetoda support
      setStadiuDetectat(normalizeStadiu(mode === 'edit' ? aplicareExistenta?.stadiuLaAplicare ?? '' : defaultStadiu ?? ''))
      // Sprint 4: defaultMetoda support
      setStadiuOverride(null)
      // Sprint 4: defaultMetoda support
      setRecomandariDraft([])
      setRecomandariLoading(false)
      queueMicrotask(() => setEditMeteo(false))
    }
  }, [
    aplicareExistenta,
    cohortLaAplicareBlocata,
    defaultCantitateMl,
    defaultCohortLaAplicare,
    defaultMetoda,
    defaultManualParcelaId,
    defaultManualStatus,
    defaultOperator,
    defaultStadiu,
    form,
    meteoSnapshot,
    mode,
    open,
    stableDefaultManualData,
    stadiiValide,
  ])

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

  useEffect(() => {
    // Sprint 4: defaultMetoda support
    setCantitateUnit(unitateDefaultPentruMetoda)
  }, [unitateDefaultPentruMetoda])

  useEffect(() => {
    // Sprint 4: defaultMetoda support
    if (mode !== 'manual') return
    const nextStadiu = stadiuOverride ?? stadiuDetectat
    form.setValue('stadiu_la_aplicare', nextStadiu ?? '', { shouldValidate: false })
  }, [form, mode, stadiuDetectat, stadiuOverride])

  useEffect(() => {
    // Sprint 4: defaultMetoda support
    if (!open || mode !== 'manual' || metodaAplicare === null) return
    const parcelaId = selectedManualParcelaId || defaultManualParcelaId || ''
    if (!tenantId || !parcelaId) {
      setStadiuDetectat(null)
      return
    }

    let cancelled = false
    startStadiuContextTransition(async () => {
      try {
        const stadiuCurent = await loadStadiuCurentParcelaClient({
          parcelaId,
          tenantId,
          an: sezonCurent,
        })
        if (cancelled) return
        setStadiuDetectat(normalizeStadiu(stadiuCurent?.stadiu ?? ''))
      } catch {
        if (cancelled) return
        setStadiuDetectat(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    defaultManualParcelaId,
    metodaAplicare,
    mode,
    open,
    selectedManualParcelaId,
    sezonCurent,
    tenantId,
  ])

  useEffect(() => {
    // Sprint 4: defaultMetoda support
    if (!open || !shouldShowRecomandari || !tenantId || !stadiuChipCurent) {
      setRecomandariDraft([])
      setRecomandariLoading(false)
      return
    }

    const parcelaId = selectedManualParcelaId || defaultManualParcelaId || ''
    if (!parcelaId || metodaAplicare === null) {
      setRecomandariDraft([])
      setRecomandariLoading(false)
      return
    }

    let cancelled = false
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setRecomandariLoading(true)
      }
    }, 200)

    void loadRecomandariParcelaClient({
      parcelaId,
      tenantId,
      an: sezonCurent,
      metodaAplicare,
      stadiu: stadiuChipCurent,
      cohort: selectedCohort,
    })
      .then((nextRecomandari) => {
        if (cancelled) return
        setRecomandariDraft(nextRecomandari)
      })
      .catch(() => {
        if (cancelled) return
        setRecomandariDraft([])
      })
      .finally(() => {
        window.clearTimeout(loadingTimer)
        if (!cancelled) {
          setRecomandariLoading(false)
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(loadingTimer)
    }
  }, [
    defaultManualParcelaId,
    metodaAplicare,
    open,
    selectedCohort,
    selectedManualParcelaId,
    sezonCurent,
    shouldShowRecomandari,
    stadiuChipCurent,
    tenantId,
  ])

  const save = form.handleSubmit(async (values) => {
    const productError = validateProducts(produseDraft)
    if (productError) {
      form.setError('observatii', { type: 'manual', message: productError })
      toast.error(productError)
      return
    }

    if (mode === 'edit') {
      if (!aplicareExistenta) {
        toast.error('Aplicarea nu este încărcată.')
        return
      }

      const formData = new FormData()
      formData.set('parcelaId', aplicareExistenta.parcelaId)
      formData.set('aplicareId', aplicareExistenta.id)
      formData.set('data_aplicata', values.data_aplicata)
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('operator', values.operator ?? '')
      formData.set('stadiu_la_aplicare', stadiuOverride ?? stadiuDetectat ?? values.stadiu_la_aplicare ?? '')
      if (values.cohort_la_aplicare) {
        formData.set('cohort_la_aplicare', values.cohort_la_aplicare)
      }
      formData.set('observatii', values.observatii ?? '')
      if (resolvedMeteoSnapshot) {
        formData.set('meteo_snapshot', JSON.stringify(resolvedMeteoSnapshot))
      }
      formData.set(
        'produse',
        JSON.stringify(
          withProductOrder(produseDraft).map((produs) => ({
            ...produs,
            doza_l_per_ha: produs.doza_l_per_ha,
            doza_ml_per_hl: produs.doza_ml_per_hl,
            cantitate_totala: null,
            unitate_cantitate: metodaAplicare ? cantitateUnit : null,
            observatii: mergeCantitateIntoObservatii(produs.observatii, produs.cantitate_text ?? ''),
            cantitate_text: (produs.cantitate_text ?? '').trim(),
          }))
        )
      )

      const result = await markAplicataAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost actualizată.')
      onOpenChange(false)
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
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
          metoda_aplicare: metodaAplicare,
          tip_interventie: tipInterventie,
          scop: scopInterventie,
          cohort_la_aplicare: undefined,
          stadiu_la_aplicare: stadiuOverride ?? stadiuDetectat ?? values.stadiu_la_aplicare,
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
            unitate_cantitate: metodaAplicare ? cantitateUnit : null,
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
        metoda_aplicare: metodaAplicare,
        stadiu_la_aplicare: stadiuOverride ?? stadiuDetectat ?? values.stadiu_la_aplicare,
        meteoSnapshot: nextSnapshot,
        produse: withProductOrder(produseDraft).map((produs) => ({
          ...produs,
          doza_l_per_ha: null,
          doza_ml_per_hl: null,
          cantitate_totala: null,
          unitate_cantitate: metodaAplicare ? cantitateUnit : null,
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

  const handleDeleteEditAplicare = async () => {
    if (!aplicareExistenta) return
    if (typeof window !== 'undefined' && !window.confirm('Ștergi definitiv această aplicare?')) return

    const result = await deleteAplicareAction(aplicareExistenta.id, aplicareExistenta.parcelaId)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success('Aplicarea a fost ștearsă.')
    onOpenChange(false)
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  const updateProduct = (produsId: string, update: (produs: MarkAplicataProdusDraft) => MarkAplicataProdusDraft) => {
    setProduseDraft((current) =>
      withProductOrder(current.map((produs) => (produs.id === produsId ? update(produs) : produs)))
    )
  }

  const addRecomandareToProduse = (recomandare: RecomandareInterventieDraft) => {
    // Sprint 4: defaultMetoda support
    const firstDraftId = recomandare.draftProduse[0]?.id
    setProduseDraft((current) => {
      const baseCount = current.length
      const draftProduse = recomandare.draftProduse.map((produs, index) => ({
        ...produs,
        id: `${produs.id}-${baseCount + index + 1}`,
        ordine: baseCount + index + 1,
      }))
      return withProductOrder([...current, ...draftProduse])
    })
    setOpenProductId((current) => current ?? (firstDraftId ? `${firstDraftId}-${produseDraft.length + 1}` : null))
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
  const stadiuAppSelectOptions = useMemo(
    () => buildStadiuAppSelectOptions(stadiiOptions, 'Selectează stadiul'),
    [stadiiOptions]
  )
  const cohortAppSelectOptions = useMemo(
    () => COHORTA_APP_SELECT_OPTIONS.filter((option) => option.value !== ''),
    []
  )
  const unitateAppSelectOptions = useMemo(
    () =>
      unitatiPentruMetoda.map((unit) => ({
        value: unit.value,
        label: unit.label,
      })),
    [unitatiPentruMetoda]
  )
  const manualParcelaAppSelectOptions = useMemo(
    () => manualParcele.map((option) => ({ ...option, emoji: '📍' })),
    [manualParcele]
  )
  const manualStatusAppSelectOptions = useMemo(
    () => [
      { value: 'planificata', label: 'Planificată', emoji: '📅' },
      { value: 'aplicata', label: 'Aplicată', emoji: '✅' },
    ],
    []
  )

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
      <AppSelect
        id="aplicata-cohorta"
        label={mode === 'manual' ? 'Cohortă pentru intervenție' : 'Aplicare pentru cohorta'}
        placeholder="Selectează cohorta"
        value={selectedCohort ?? ''}
        options={cohortAppSelectOptions}
        disabled={Boolean(cohortLaAplicareBlocata)}
        triggerClassName="h-11 md:h-10"
        onChange={(value) => form.setValue('cohort_la_aplicare', value as Cohorta)}
      />
      {form.formState.errors.cohort_la_aplicare ? (
        <p className="text-xs text-[var(--status-danger-text)]">
          {form.formState.errors.cohort_la_aplicare.message}
        </p>
      ) : null}
    </div>
  ) : null

  const planDateField = mode === 'din_plan' ? (
    <AppDatePicker
      id="aplicata-data"
      label="Data aplicată"
      mode="datetime"
      placeholder="Selectează data și ora"
      value={watchedDataAplicata}
      triggerClassName="h-11 md:h-10"
      onChange={(nextValue) =>
        form.setValue('data_aplicata', nextValue, { shouldDirty: true, shouldValidate: true })
      }
      error={form.formState.errors.data_aplicata?.message}
    />
  ) : null

  const unitateField = metodaAplicare ? (
    <AppSelect
      id="aplicata-unitate-doza"
      label="Unitate doză"
      value={cantitateUnit}
      options={unitateAppSelectOptions}
      triggerClassName="h-11 md:h-10"
      onChange={setCantitateUnit}
    />
  ) : null

  const cantitateField =
    metodaAplicare === null ? (
      <div className="space-y-2">
        <Label htmlFor="aplicata-cantitate">Cantitate totală</Label>
        <div className="flex min-w-0 gap-2">
          <Input
            id="aplicata-cantitate"
            type="text"
            inputMode="decimal"
            placeholder="ex: 2, 500, 1.5"
            className="agri-control h-11 min-w-0 flex-1 md:h-10"
            {...form.register('cantitate_totala_ml')}
          />
          <AppSelect
            id="aplicata-unitate-cantitate"
            value={cantitateUnit}
            options={unitateAppSelectOptions}
            triggerClassName="h-11 w-32 shrink-0 md:h-10"
            onChange={setCantitateUnit}
          />
        </div>
      </div>
    ) : shouldShowCantitateApa ? (
      <div className="space-y-2">
        <Label htmlFor="aplicata-cantitate">Cantitate apă</Label>
        <Input
          id="aplicata-cantitate"
          type="text"
          inputMode="decimal"
          placeholder="ex: 300"
          className="agri-control h-11 min-w-0 flex-1 md:h-10"
          {...form.register('cantitate_totala_ml')}
        />
        <p className="text-xs text-[var(--text-secondary)]">
          Opțional. Dacă completezi, calculăm automat doza/ha pentru fișa ANSVSA.
        </p>
      </div>
    ) : null

  const operatorField = (
    <div className="space-y-2">
      <Label htmlFor="aplicata-operator">Operator</Label>
      <Input id="aplicata-operator" className="agri-control h-11 md:h-10" {...form.register('operator')} />
    </div>
  )

  const stadiuField = (
    <AppSelect
      id="aplicata-stadiu"
      label="Stadiu la aplicare"
      placeholder="Selectează stadiul"
      value={selectedStadiu}
      options={stadiuAppSelectOptions}
      showSearchThreshold={12}
      getOptionDisplayLabel={formatStadiuOptionLabel}
      triggerClassName="h-11 md:h-10"
      onChange={(value) => {
        setStadiuOverride(normalizeStadiu(value))
        form.setValue('stadiu_la_aplicare', value, { shouldValidate: true })
      }}
    />
  )

  const manualStadiuChip = shouldShowStadiuChip ? (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition hover:opacity-90"
            style={{
              background: 'var(--agri-primary-light)',
              color: 'var(--agri-primary-dark)',
            }}
          >
            {stadiuContextLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles size={9} />}
            {stadiuChipCurent ? getLabelRo(stadiuChipCurent) : <span className="italic">Fără stadiu</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              Override fenofază
            </p>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {(grupBiologic ? PROFILURI_STADII_PER_GRUP[grupBiologic] : stadiiValide).map((stadiu) => (
                <button
                  key={stadiu}
                  type="button"
                  onClick={() => {
                    setStadiuOverride(stadiu)
                    form.setValue('stadiu_la_aplicare', stadiu, { shouldValidate: true })
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition',
                    stadiuChipCurent === stadiu
                      ? 'border-[var(--agri-primary)] bg-[var(--agri-primary-light)] text-[var(--agri-primary-dark)]'
                      : 'border-[var(--border-default)] bg-white text-[var(--text-primary)]'
                  )}
                >
                  <span>{getLabelRo(stadiu)}</span>
                  {stadiuChipCurent === stadiu ? <Sparkles size={12} /> : null}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ) : null

  const recomandariBlock =
    shouldShowRecomandari && recomandariDraft.length > 0 ? (
      <div
        className="rounded-2xl border p-3.5"
        style={{
          background: 'var(--agri-primary-light)',
          borderColor: 'color-mix(in srgb, var(--agri-primary) 30%, transparent)',
        }}
      >
        <div className="mb-2.5 flex items-start gap-2">
          <Sparkles size={14} className="mt-0.5 text-[var(--agri-primary-dark)]" />
          <div>
            <div className="text-xs font-bold leading-tight text-[var(--agri-primary-dark)]">
              Recomandate pentru {stadiuChipCurent ? getLabelRo(stadiuChipCurent) : 'fără stadiu'} —{' '}
              {metodaAplicare ? METODA_APLICARE_LABEL_RO[metodaAplicare] : 'Intervenție'}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {recomandariDraft.some((recomandare) => recomandare.sursa === 'platforma')
                ? 'Planul activ are prioritate; sugestiile platformă completează lista'
                : 'Din planul activ al parcelei'}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          {recomandariDraft.slice(0, 5).map((recomandare) => (
            <button
              key={recomandare.linieId}
              type="button"
              onClick={() => addRecomandareToProduse(recomandare)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-stone-200/60 bg-white px-2.5 py-2 text-left"
            >
              <Plus size={14} className="text-[var(--agri-primary)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight">
                    {recomandare.produse[0]?.nume}
                  </div>
                  {recomandare.sursa === 'platforma' && (
                    <div
                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: 'var(--status-warning-bg)',
                        color: 'var(--status-warning-text)',
                      }}
                    >
                      Sugestie platformă
                    </div>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-stone-500">
                  {recomandare.titlu} · {recomandare.produse[0]?.cantitateText ?? 'fără doză'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    ) : recomandariLoading && shouldShowRecomandari ? (
      <div
        className="space-y-2 rounded-2xl border p-3.5"
        style={{
          background: 'var(--agri-primary-light)',
          borderColor: 'color-mix(in srgb, var(--agri-primary) 20%, transparent)',
        }}
      >
        <div className="h-3 w-40 animate-pulse rounded bg-white/80" />
        <div className="h-10 animate-pulse rounded-xl bg-white/80" />
        <div className="h-10 animate-pulse rounded-xl bg-white/70" />
      </div>
    ) : null

  const phiWarningBlock = shouldShowPhiWarning ? (
    <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2.5 text-[var(--status-warning-text)]">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">Atenție PHI</p>
          <p className="text-xs">
            Pentru intervențiile cu PHI, verifică pauza până la recoltare înainte de salvare.
          </p>
        </div>
      </div>
    </div>
  ) : null

  const metodaBadge = metodaAplicare ? (
    <div
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: 'var(--agri-primary-light)',
        color: 'var(--agri-primary-dark)',
      }}
    >
      {METODA_APLICARE_LABEL_RO[metodaAplicare]}
    </div>
  ) : null

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
          onClick={() => {
            const next = createEmptyProdusDraft(produseDraft.length + 1)
            setProduseDraft((current) => [...current, next])
            setOpenProductId(next.id)
          }}
        >
          <Plus className="h-4 w-4" />
          Adaugă produs
        </Button>
      </div>

      <div className="space-y-2">
        {produseDraft.map((produsDraft, index) => {
          const isOpen = openProductId === produsDraft.id
          const selectedProduct =
            produseFitosanitare.find((produs) => produs.id === produsDraft.produs_id) ?? null
          const availableProducts =
            selectedProduct && !produseFitosanitare.some((produs) => produs.id === selectedProduct.id)
              ? [selectedProduct, ...produseFitosanitare]
              : produseFitosanitare
          const headerName = productName(produsDraft, produseFitosanitare)
          const hasName = headerName !== 'Produs fără nume'
          const productTypeKey = mapSnapshotToProductType(produsDraft.tip_snapshot)
          const productTypeLabel = productTypeKey
            ? PRODUCT_TYPE_APP_SELECT_OPTIONS.find((option) => option.value === productTypeKey)?.label ?? null
            : null
          const cantitateText = (produsDraft.cantitate_text ?? '').trim()
          const cantitatePreview =
            cantitateText.length > 20 ? `${cantitateText.slice(0, 20)}…` : cantitateText
          const isFitosanitar = productTypeKey === 'fitosanitar'

          return (
            <div
              key={produsDraft.id}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] min-w-0 overflow-hidden"
            >
              <div className="flex items-stretch gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenProductId((current) => (current === produsDraft.id ? null : produsDraft.id))
                  }
                  aria-expanded={isOpen}
                  aria-controls={`aplicata-produs-body-${produsDraft.id}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left sm:px-2.5 sm:py-2"
                >
                  <span className="inline-flex shrink-0 items-center rounded-md border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums">
                    #{index + 1}
                  </span>
                  <span className="min-w-0 flex-1 flex flex-col gap-0.5 text-left md:flex-row md:items-center md:gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 md:flex-1 md:min-w-0">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          hasName
                            ? 'text-[var(--text-primary)] [font-weight:550]'
                            : 'italic text-[var(--text-secondary)]'
                        )}
                        title={headerName}
                      >
                        {headerName}
                      </span>
                      {productTypeLabel ? (
                        <span className="inline-flex max-w-[38%] shrink-0 items-center truncate rounded-md bg-[var(--surface-card-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] sm:max-w-[45%]">
                          {productTypeLabel}
                        </span>
                      ) : null}
                    </span>
                    {cantitatePreview ? (
                      <span className="min-w-0 truncate pl-0.5 text-[11px] text-[var(--text-secondary)] tabular-nums md:hidden">
                        {cantitatePreview}
                      </span>
                    ) : null}
                    {cantitatePreview ? (
                      <span className="hidden max-w-[12rem] shrink-0 truncate text-[11px] text-[var(--text-secondary)] tabular-nums md:inline-block">
                        {cantitatePreview}
                      </span>
                    ) : null}
                  </span>
                  <span className="inline-flex size-11 shrink-0 items-center justify-center self-center text-[var(--text-secondary)]">
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform duration-150',
                        isOpen && 'rotate-180'
                      )}
                      aria-hidden
                    />
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 h-11 w-11 rounded-none"
                  aria-label={`Șterge produsul ${index + 1}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setProduseDraft((current) =>
                      withProductOrder(current.filter((produs) => produs.id !== produsDraft.id))
                    )
                    setOpenProductId((current) => (current === produsDraft.id ? null : current))
                  }}
                >
                  <Trash2 className="h-4 w-4 text-[var(--status-danger-text)]" />
                </Button>
              </div>

              {isOpen ? (
                <div
                  id={`aplicata-produs-body-${produsDraft.id}`}
                  className="border-t border-[var(--border-default)] p-2.5 min-w-0 space-y-2"
                >
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 shrink-0 rounded-xl"
                      aria-label={`Mută sus produsul ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => setProduseDraft((current) => moveProduct(current, produsDraft.id, 'up'))}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11 shrink-0 rounded-xl"
                      aria-label={`Mută jos produsul ${index + 1}`}
                      disabled={index === produseDraft.length - 1}
                      onClick={() => setProduseDraft((current) => moveProduct(current, produsDraft.id, 'down'))}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-2 md:space-y-0 min-w-0">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`aplicata-produs-${produsDraft.id}`} className="md:text-[11px]">
                        Produs din bibliotecă
                      </Label>
                      <div className={cn(produsDraft.produs_id ? 'md:hidden' : '')}>
                        <ProdusFitosanitarPicker
                          produse={availableProducts}
                          value={produsDraft.produs_id ?? null}
                          inlineMode={isMobile && mode === 'manual'}
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
                      {produsDraft.produs_id ? (
                        <div className="hidden md:flex md:items-center md:gap-2 md:px-3 md:py-1.5 md:border md:border-[#3D7A5F] md:rounded-lg md:bg-[#f0f8f4]">
                          <div className="min-w-0 flex-1 flex flex-col">
                            <span className="truncate text-[13px] font-medium text-[#0f6e56]">
                              {(produsDraft.produs_nume_snapshot || selectedProduct?.nume_comercial || '').trim() || 'Produs din bibliotecă'}
                            </span>
                            {(() => {
                              const subtitleParts = [
                                produsDraft.substanta_activa_snapshot?.trim() || null,
                                productTypeLabel,
                              ].filter(Boolean) as string[]
                              return subtitleParts.length > 0 ? (
                                <span className="truncate text-[11px] text-[#3D7A5F] opacity-70">
                                  {subtitleParts.join(' · ')}
                                </span>
                              ) : null
                            })()}
                          </div>
                          <button
                            type="button"
                            aria-label="Elimină produsul selectat"
                            className="shrink-0 cursor-pointer text-[#3D7A5F] bg-transparent border-none p-1"
                            onClick={() =>
                              updateProduct(produsDraft.id, (current) => {
                                const fallbackName = current.produs_nume_snapshot || current.produs_nume_manual || ''
                                return {
                                  ...current,
                                  produs_id: null,
                                  produs_nume_manual: fallbackName,
                                  produs_nume_snapshot: fallbackName || null,
                                }
                              })
                            }
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`aplicata-manual-${produsDraft.id}`} className="md:text-[11px]">
                        Nume manual
                      </Label>
                      <Input
                        id={`aplicata-manual-${produsDraft.id}`}
                        className="text-[16px] md:py-1.5 md:text-[13px]"
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
                      <Label className="md:text-[11px]">Tip produs</Label>
                      <AppSelect
                        id={`aplicata-tip-produs-${produsDraft.id}`}
                        placeholder="Selectează tipul produsului"
                        value={mapSnapshotToProductType(produsDraft.tip_snapshot) ?? ''}
                        options={PRODUCT_TYPE_APP_SELECT_OPTIONS}
                        menuClassName="max-w-[calc(100vw-2rem)]"
                        triggerClassName="h-11 md:h-10 md:py-1.5 md:text-[13px]"
                        onChange={(value) =>
                          updateProduct(produsDraft.id, (current) => {
                            const mapped = mapProductTypeToSnapshot(value)
                            const isFitosanitarSelected = value === 'fitosanitar'
                            return {
                              ...current,
                              tip_snapshot: mapped,
                              substanta_activa_snapshot: isFitosanitarSelected ? current.substanta_activa_snapshot : '',
                              frac_irac_snapshot: isFitosanitarSelected ? current.frac_irac_snapshot : '',
                              phi_zile_snapshot: isFitosanitarSelected ? current.phi_zile_snapshot : null,
                            }
                          })
                        }
                      />
                    </div>
                    <div className="hidden md:block" aria-hidden />

                    {isFitosanitar ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`aplicata-substanta-${produsDraft.id}`} className="md:text-[11px]">
                            Substanță activă
                          </Label>
                          <Input
                            id={`aplicata-substanta-${produsDraft.id}`}
                          className="text-[16px] md:py-1.5 md:text-[13px]"
                            value={produsDraft.substanta_activa_snapshot}
                            onChange={(event) =>
                              updateProduct(produsDraft.id, (current) => ({
                                ...current,
                                substanta_activa_snapshot: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:contents">
                          <div className="space-y-2">
                            <Label htmlFor={`aplicata-frac-${produsDraft.id}`} className="md:text-[11px]">
                              FRAC/IRAC
                            </Label>
                            <Input
                              id={`aplicata-frac-${produsDraft.id}`}
                              className="text-[16px] md:py-1.5 md:text-[13px]"
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
                            <Label htmlFor={`aplicata-phi-${produsDraft.id}`} className="md:text-[11px]">
                              PHI zile
                            </Label>
                            <Input
                              id={`aplicata-phi-${produsDraft.id}`}
                              type="number"
                              min="0"
                              step="1"
                              className="text-[16px] md:py-1.5 md:text-[13px]"
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

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`aplicata-cantitate-${produsDraft.id}`} className="md:text-[11px]">
                        Cantitate aplicată
                      </Label>
                      <Input
                        id={`aplicata-cantitate-${produsDraft.id}`}
                        className="text-[16px] md:py-1.5 md:text-[13px]"
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
                      <Label htmlFor={`aplicata-produs-observatii-${produsDraft.id}`} className="md:text-[11px]">
                        Observații produs
                      </Label>
                      <Textarea
                        id={`aplicata-produs-observatii-${produsDraft.id}`}
                        rows={2}
                        className="text-[16px] md:h-[52px] md:py-1.5 md:text-[13px]"
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
              ) : null}
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
              <AppSelect
                id="manual-parcela"
                placeholder="Selectează parcela"
                value={selectedManualParcelaId}
                options={manualParcelaAppSelectOptions}
                showSearchThreshold={8}
                menuClassName="max-w-[calc(100vw-2rem)]"
                triggerClassName="h-11 md:h-10"
                onChange={(value) => form.setValue('manual_parcela_id', value, { shouldValidate: true })}
              />
              {form.formState.errors.manual_parcela_id ? (
                <p className="text-xs text-[var(--status-danger-text)]">{form.formState.errors.manual_parcela_id.message}</p>
              ) : null}
            </div>
          ) : defaultManualParcelaLabel ? (
            <div className="rounded-2xl bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              {defaultManualParcelaLabel}
            </div>
          ) : null}

          {manualStadiuChip}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-status">Status</Label>
              <AppSelect
                id="manual-status"
                placeholder="Selectează statusul"
                value={selectedManualStatus}
                options={manualStatusAppSelectOptions}
                menuClassName="max-w-[calc(100vw-2rem)]"
                triggerClassName="h-11 md:h-10"
                onChange={(value) =>
                  form.setValue('manual_status', value as 'planificata' | 'aplicata', { shouldValidate: true })
                }
              />
              {form.formState.errors.manual_status ? (
                <p className="text-xs text-[var(--status-danger-text)]">
                  {form.formState.errors.manual_status.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <AppDatePicker
                id="manual-data"
                label={selectedManualStatus === 'aplicata' ? 'Data aplicării' : 'Data planificării'}
                mode="datetime"
                placeholder="Selectează data și ora"
                value={watchedManualData}
                triggerClassName="h-11 md:h-10"
                onChange={(nextValue) =>
                  form.setValue('manual_data', nextValue, { shouldDirty: true, shouldValidate: true })
                }
                error={form.formState.errors.manual_data?.message}
              />
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-tip-interventie">Tip intervenție</Label>
              <AppSelect
                id="manual-tip-interventie"
                placeholder="Selectează tipul"
                value={selectedTipInterventie}
                options={TIP_INTERVENTIE_APP_SELECT_OPTIONS}
                menuClassName="max-w-[calc(100vw-2rem)]"
                triggerClassName="h-11 md:h-10"
                onChange={(value) => form.setValue('manual_tip_select', value, { shouldValidate: true })}
              />
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
              <AppSelect
                id="manual-scop"
                placeholder="Selectează scopul"
                value={selectedScopInterventie}
                options={SCOP_INTERVENTIE_APP_SELECT_OPTIONS}
                triggerClassName="h-11 md:h-10"
                onChange={(value) => form.setValue('manual_scop_select', value, { shouldValidate: true })}
              />
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
      {unitateField}
      {cantitateField}
      {operatorField}
      {stadiuField}
      {observatiiField}
      {plannedProductsBlock}
      {recomandariBlock}
      {productsBlock}
      {differencesField}
      {phiWarningBlock}
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
                ? `${String(summaryValues.cantitate_totala_ml).trim()} ${cantitateUnit}`
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
                  <AppSelect
                    id="manual-parcela-desktop"
                    label="Parcela"
                    placeholder="Selectează parcela"
                    value={selectedManualParcelaId}
                    options={manualParcelaAppSelectOptions}
                    showSearchThreshold={8}
                    triggerClassName="h-11 md:h-10"
                    onChange={(value) => form.setValue('manual_parcela_id', value, { shouldValidate: true })}
                  />
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

              {manualStadiuChip}

              <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
                <div className="space-y-2">
                  <AppSelect
                    id="manual-status-desktop"
                    label="Status"
                    placeholder="Selectează statusul"
                    value={selectedManualStatus}
                    options={manualStatusAppSelectOptions}
                    triggerClassName="h-11 md:h-10"
                    onChange={(value) =>
                      form.setValue('manual_status', value as 'planificata' | 'aplicata', {
                        shouldValidate: true,
                      })
                    }
                  />
                  {form.formState.errors.manual_status ? (
                    <p className="text-xs text-[var(--status-danger-text)]">
                      {form.formState.errors.manual_status.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <AppDatePicker
                    id="manual-data-desktop"
                    label={selectedManualStatus === 'aplicata' ? 'Data aplicării' : 'Data planificării'}
                    mode="datetime"
                    placeholder="Selectează data și ora"
                    value={watchedManualData}
                    triggerClassName="h-11 md:h-10"
                    onChange={(nextValue) =>
                      form.setValue('manual_data', nextValue, { shouldDirty: true, shouldValidate: true })
                    }
                    error={form.formState.errors.manual_data?.message}
                  />
                </div>
                <div className="space-y-2">
                  <AppSelect
                    id="manual-tip-interventie-desktop"
                    label="Tip intervenție"
                    placeholder="Selectează tipul"
                    value={selectedTipInterventie}
                    options={TIP_INTERVENTIE_APP_SELECT_OPTIONS}
                    triggerClassName="h-11 md:h-10"
                    onChange={(value) => form.setValue('manual_tip_select', value, { shouldValidate: true })}
                  />
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
                  <AppSelect
                    id="manual-scop-desktop"
                    label="Scop"
                    placeholder="Selectează scopul"
                    value={selectedScopInterventie}
                    options={SCOP_INTERVENTIE_APP_SELECT_OPTIONS}
                    triggerClassName="h-11 md:h-10"
                    onChange={(value) => form.setValue('manual_scop_select', value, { shouldValidate: true })}
                  />
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
                {unitateField}
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
            {recomandariBlock}
            {productsBlock}
          </DesktopFormPanel>
        </FormDialogSection>

        <FormDialogSection>
          <DesktopFormPanel>
            {mode === 'manual' ? (
              <div className="grid gap-3 md:grid-cols-2 md:gap-x-4">
                {unitateField}
                {cantitateField}
                {operatorField}
                {stadiuField}
              </div>
            ) : null}
            {mode === 'manual' ? observatiiField : null}
            {mode === 'din_plan' || mode === 'edit' ? observatiiField : null}
            {differencesField}
            {phiWarningBlock}
            {meteoBlock}
            {mode === 'edit' ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                onClick={handleDeleteEditAplicare}
              >
                Șterge aplicarea
              </Button>
            ) : null}
          </DesktopFormPanel>
        </FormDialogSection>
      </DesktopFormGrid>
    </form>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[100dvh] rounded-none flex flex-col overflow-hidden">
          <SheetHeader>
            <SheetTitle>
              {mode === 'edit' ? 'Editează aplicare' : mode === 'manual' ? 'Adaugă intervenție manuală' : 'Marchează ca aplicat'}
            </SheetTitle>
            {metodaBadge}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">{mobileContent}</div>
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
                : mode === 'edit'
                  ? 'Salvează modificările'
                  : mode === 'manual'
                  ? 'Salvează intervenția'
                  : 'Marchează aplicarea'}
            </button>
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={handleDeleteEditAplicare}
                className="w-full rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--status-danger-text)] transition active:scale-[0.985]"
              >
                Șterge aplicarea
              </button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'edit' ? 'Editează aplicare' : mode === 'manual' ? 'Adaugă intervenție manuală' : 'Marchează ca aplicat'}
      description={
        mode === 'edit'
          ? 'Actualizează aplicarea existentă fără să creezi un rând nou.'
          : mode === 'manual'
          ? 'Completează contextul, produsele și observațiile fără să schimbi fluxul de salvare.'
          : 'Confirmă aplicarea reală, produsele efective și diferențele față de plan.'
      }
      footer={
        <DialogFormActions
          onCancel={() => onOpenChange(false)}
          onSave={save}
          saving={pending}
          saveLabel={mode === 'edit' ? 'Salvează modificările' : mode === 'manual' ? 'Salvează intervenția' : 'Marchează aplicarea'}
        />
      }
      desktopFormWide
      showCloseButton
      contentClassName="md:w-[min(96vw,84rem)] md:max-w-none"
    >
      {metodaBadge ? <div className="mb-3">{metodaBadge}</div> : null}
      {desktopContent}
    </AppDialog>
  )
}
