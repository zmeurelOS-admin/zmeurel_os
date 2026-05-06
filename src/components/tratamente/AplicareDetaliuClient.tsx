'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  anuleazaAction,
  markAplicataAction,
  reprogrameazaAction,
  salveazaCiornaAction,
} from '@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions'
import { AplicareHero } from '@/components/tratamente/AplicareHero'
import { AnuleazaDialog } from '@/components/tratamente/AnuleazaDialog'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import { MeteoSnapshotCard } from '@/components/tratamente/MeteoSnapshotCard'
import { MeteoWindowBar } from '@/components/tratamente/MeteoWindowBar'
import { ReprogrameazaSheet, type ReprogrameazaFormValues } from '@/components/tratamente/ReprogrameazaSheet'
import { VerificariAutomate, type VerificareAutomataState } from '@/components/tratamente/VerificariAutomate'
import { AplicareSourceBadge } from '@/components/tratamente/AplicareSourceBadge'
import { ProdusFitosanitarPicker } from '@/components/tratamente/ProdusFitosanitarPicker'
import { AppCard } from '@/components/ui/app-card'
import {
  formatDifferencesSummary,
  getAplicareContextLabel,
  getAplicareInterventieLabel,
  getAplicareProduseSummary,
} from '@/components/tratamente/aplicare-ui'
import type {
  AplicareProdusInput,
  AplicareProdusV2,
  AplicareTratamentDetaliu,
  InterventieProdusV2,
  ProdusFitosanitar,
} from '@/lib/supabase/queries/tratamente'
import { isRubusMixt, type ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import type { MeteoSnapshot, MeteoZi } from '@/lib/tratamente/meteo'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'

interface AplicareDetaliuClientProps {
  aplicare: AplicareTratamentDetaliu
  currentOperator: string
  defaultCantitateMl: number | null
  meteoDateLabel: string
  meteoZi: MeteoZi | null
  parcelaId: string
  produseFitosanitare: ProdusFitosanitar[]
  configurareSezon?: ConfigurareSezon | null
  grupBiologic?: GrupBiologic | null
  stadiuImplicit: string | null
  verificari: {
    phi: VerificareAutomataState
    sezon: VerificareAutomataState
    stoc: VerificareAutomataState
  }
}

function isMeteoSnapshot(value: unknown): value is MeteoSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.timestamp === 'string'
}

function normalizeCohorta(value: string | null | undefined) {
  return value === 'floricane' || value === 'primocane' ? value : null
}

function getStadiuAplicareLabel(aplicare: AplicareTratamentDetaliu): string {
  const value = aplicare.stadiu_la_aplicare ?? aplicare.linie?.stadiu_trigger ?? null
  if (!value?.trim()) return '—'
  return value.replaceAll('_', ' ')
}

function getPlanLink(aplicare: AplicareTratamentDetaliu): string | null {
  const planId = aplicare.linie?.plan_id
  return planId ? `/tratamente/planuri/${planId}` : null
}

function getProductLabel(produs: NonNullable<AplicareTratamentDetaliu['produse_aplicare']>[number]): string {
  return (
    produs.produs?.nume_comercial ??
    produs.produs_nume_snapshot ??
    produs.produs_nume_manual ??
    'Produs nespecificat'
  )
}

function getVisualProduse(
  aplicare: AplicareTratamentDetaliu
): NonNullable<AplicareTratamentDetaliu['produse_aplicare']> {
  const produse = aplicare.produse_aplicare ?? []
  if (produse.length > 0) return produse

  return [
    {
      id: `legacy-${aplicare.id}`,
      tenant_id: aplicare.tenant_id,
      aplicare_id: aplicare.id,
      plan_linie_produs_id: null,
      ordine: 1,
      produs_id: aplicare.produs_id,
      produs_nume_manual: aplicare.produs_nume_manual ?? '',
      produs_nume_snapshot: aplicare.produs?.nume_comercial ?? aplicare.produs_nume_manual ?? '',
      substanta_activa_snapshot: aplicare.produs?.substanta_activa ?? '',
      tip_snapshot: aplicare.produs?.tip ?? '',
      frac_irac_snapshot: aplicare.produs?.frac_irac ?? '',
      phi_zile_snapshot: aplicare.produs?.phi_zile ?? null,
      doza_ml_per_hl: aplicare.doza_ml_per_hl ?? null,
      doza_l_per_ha: aplicare.doza_l_per_ha ?? null,
      cantitate_totala: aplicare.cantitate_totala_ml ?? null,
      unitate_cantitate: aplicare.cantitate_totala_ml == null ? null : 'ml',
      stoc_mutatie_id: aplicare.stoc_mutatie_id,
      observatii: aplicare.observatii ?? '',
      created_at: aplicare.created_at,
      updated_at: aplicare.updated_at,
      produs: aplicare.produs,
      plan_linie_produs: null,
    },
  ]
}

type CantitateUnitate = NonNullable<AplicareProdusInput['unitate_cantitate']>

interface AplicareProdusForm {
  localId: string
  dbId: string | null
  plan_linie_produs_id: string | null
  ordine: number
  produs_id: string | null
  produs_nume_manual: string
  produs_nume_snapshot: string | null
  substanta_activa_snapshot: string
  tip_snapshot: string | null
  frac_irac_snapshot: string
  phi_zile_snapshot: number | null
  doza_ml_per_hl: string
  doza_l_per_ha: string
  cantitate_totala: string
  observatii: string
  fromPlan: boolean
}

function formatNumberInput(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function toNumberOrNull(value: string): number | null {
  const text = value.trim().replace(',', '.')
  if (!text) return null
  const match = text.match(/^\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function inferQuantityUnit(value: string): CantitateUnitate | null {
  const text = value.trim().toLowerCase()
  if (!text) return null
  if (/\bml\b/.test(text)) return 'ml'
  if (/\bl\b/.test(text)) return 'l'
  if (/\bkg\b/.test(text)) return 'kg'
  if (/\bg\b/.test(text)) return 'g'
  if (/\bbuc\b/.test(text)) return 'buc'
  return toNumberOrNull(text) == null ? null : 'altul'
}

function productKey(product: {
  produs_id?: string | null
  produs_nume_snapshot?: string | null
  produs_nume_manual?: string | null
  produs?: { nume_comercial?: string | null } | null
}): string {
  const id = product.produs_id?.trim()
  if (id) return `id:${id}`
  const name = (
    product.produs_nume_snapshot ??
    product.produs_nume_manual ??
    product.produs?.nume_comercial ??
    ''
  ).trim().toLowerCase()
  return name ? `name:${name}` : ''
}

function createEmptyFormProduct(ordine: number): AplicareProdusForm {
  return {
    localId: crypto.randomUUID(),
    dbId: null,
    plan_linie_produs_id: null,
    ordine,
    produs_id: null,
    produs_nume_manual: '',
    produs_nume_snapshot: null,
    substanta_activa_snapshot: '',
    tip_snapshot: '',
    frac_irac_snapshot: '',
    phi_zile_snapshot: null,
    doza_ml_per_hl: '',
    doza_l_per_ha: '',
    cantitate_totala: '',
    observatii: '',
    fromPlan: false,
  }
}

function fromAplicareProdusForm(produs: AplicareProdusV2, index: number): AplicareProdusForm {
  return {
    localId: produs.id || crypto.randomUUID(),
    dbId: produs.id || null,
    plan_linie_produs_id: produs.plan_linie_produs_id ?? null,
    ordine: produs.ordine ?? index + 1,
    produs_id: produs.produs_id ?? null,
    produs_nume_manual: produs.produs_nume_manual ?? '',
    produs_nume_snapshot: produs.produs_nume_snapshot ?? produs.produs?.nume_comercial ?? null,
    substanta_activa_snapshot: produs.substanta_activa_snapshot ?? produs.produs?.substanta_activa ?? '',
    tip_snapshot: produs.tip_snapshot ?? produs.produs?.tip ?? '',
    frac_irac_snapshot: produs.frac_irac_snapshot ?? produs.produs?.frac_irac ?? '',
    phi_zile_snapshot: produs.phi_zile_snapshot ?? produs.produs?.phi_zile ?? null,
    doza_ml_per_hl: formatNumberInput(produs.doza_ml_per_hl),
    doza_l_per_ha: formatNumberInput(produs.doza_l_per_ha),
    cantitate_totala:
      typeof produs.cantitate_totala === 'number'
        ? `${produs.cantitate_totala}${produs.unitate_cantitate ? ` ${produs.unitate_cantitate}` : ''}`
        : '',
    observatii: produs.observatii ?? '',
    fromPlan: false,
  }
}

function fromPlanProdusForm(produs: InterventieProdusV2, index: number): AplicareProdusForm {
  return {
    localId: `plan-${produs.id || index + 1}`,
    dbId: null,
    plan_linie_produs_id: produs.id ?? null,
    ordine: produs.ordine ?? index + 1,
    produs_id: produs.produs_id ?? null,
    produs_nume_manual: produs.produs_nume_manual ?? '',
    produs_nume_snapshot: produs.produs_nume_snapshot ?? produs.produs?.nume_comercial ?? null,
    substanta_activa_snapshot: produs.substanta_activa_snapshot ?? produs.produs?.substanta_activa ?? '',
    tip_snapshot: produs.tip_snapshot ?? produs.produs?.tip ?? '',
    frac_irac_snapshot: produs.frac_irac_snapshot ?? produs.produs?.frac_irac ?? '',
    phi_zile_snapshot: produs.phi_zile_snapshot ?? produs.produs?.phi_zile ?? null,
    doza_ml_per_hl: formatNumberInput(produs.doza_ml_per_hl),
    doza_l_per_ha: formatNumberInput(produs.doza_l_per_ha),
    cantitate_totala: '',
    observatii: produs.observatii ?? '',
    fromPlan: true,
  }
}

function buildInitialFormProducts(aplicare: AplicareTratamentDetaliu): AplicareProdusForm[] {
  if (aplicare.produse_aplicare?.length) {
    return aplicare.produse_aplicare.map(fromAplicareProdusForm)
  }

  if (aplicare.linie?.produse?.length) {
    return aplicare.linie.produse.map(fromPlanProdusForm)
  }

  return getVisualProduse(aplicare).map(fromAplicareProdusForm)
}

function applyCatalogProduct(draft: AplicareProdusForm, product: ProdusFitosanitar | null): AplicareProdusForm {
  if (!product) {
    const fallbackName = draft.produs_nume_snapshot || draft.produs_nume_manual
    return {
      ...draft,
      produs_id: null,
      produs_nume_manual: fallbackName,
      produs_nume_snapshot: fallbackName || null,
    }
  }

  return {
    ...draft,
    fromPlan: false,
    produs_id: product.id,
    produs_nume_manual: '',
    produs_nume_snapshot: product.nume_comercial,
    substanta_activa_snapshot: product.substanta_activa ?? '',
    tip_snapshot: product.tip ?? '',
    frac_irac_snapshot: product.frac_irac ?? '',
    phi_zile_snapshot: product.phi_zile ?? null,
  }
}

function toAplicareProdusInput(produs: AplicareProdusForm, index: number): AplicareProdusInput {
  return {
    id: produs.dbId,
    plan_linie_produs_id: produs.plan_linie_produs_id,
    ordine: index + 1,
    produs_id: produs.produs_id,
    produs_nume_manual: produs.produs_id ? null : produs.produs_nume_manual.trim() || null,
    produs_nume_snapshot: produs.produs_nume_snapshot ?? (produs.produs_nume_manual.trim() || null),
    substanta_activa_snapshot: produs.substanta_activa_snapshot.trim() || null,
    tip_snapshot: produs.tip_snapshot,
    frac_irac_snapshot: produs.frac_irac_snapshot.trim() || null,
    phi_zile_snapshot: produs.phi_zile_snapshot,
    doza_ml_per_hl: toNumberOrNull(produs.doza_ml_per_hl),
    doza_l_per_ha: toNumberOrNull(produs.doza_l_per_ha),
    cantitate_totala: toNumberOrNull(produs.cantitate_totala),
    unitate_cantitate: inferQuantityUnit(produs.cantitate_totala),
    observatii: produs.observatii.trim() || null,
  }
}

function toAplicareProdusV2(produs: AplicareProdusForm, aplicare: AplicareTratamentDetaliu, index: number): AplicareProdusV2 {
  return {
    id: produs.dbId ?? produs.localId,
    tenant_id: aplicare.tenant_id,
    aplicare_id: aplicare.id,
    plan_linie_produs_id: produs.plan_linie_produs_id,
    ordine: index + 1,
    produs_id: produs.produs_id,
    produs_nume_manual: produs.produs_id ? null : produs.produs_nume_manual,
    produs_nume_snapshot: produs.produs_nume_snapshot ?? produs.produs_nume_manual,
    substanta_activa_snapshot: produs.substanta_activa_snapshot,
    tip_snapshot: produs.tip_snapshot,
    frac_irac_snapshot: produs.frac_irac_snapshot,
    phi_zile_snapshot: produs.phi_zile_snapshot,
    doza_ml_per_hl: toNumberOrNull(produs.doza_ml_per_hl),
    doza_l_per_ha: toNumberOrNull(produs.doza_l_per_ha),
    cantitate_totala: toNumberOrNull(produs.cantitate_totala),
    unitate_cantitate: inferQuantityUnit(produs.cantitate_totala),
    stoc_mutatie_id: null,
    observatii: produs.observatii,
    created_at: aplicare.created_at,
    updated_at: aplicare.updated_at,
    produs: null,
    plan_linie_produs: null,
  }
}

function calculeazaDiferente(
  produseFormular: AplicareProdusForm[],
  produseOriginale: InterventieProdusV2[] | undefined
): Record<string, unknown> | null {
  const originale = produseOriginale ?? []
  if (originale.length === 0) return null

  const originaleByKey = new Map(originale.map((produs) => [productKey(produs), produs]))
  const formularByKey = new Map(produseFormular.map((produs) => [productKey(produs), produs]))
  const produseAdaugate: Array<Record<string, unknown>> = []
  const produseEliminate: Array<Record<string, unknown>> = []
  const produseModificate: Array<Record<string, unknown>> = []

  produseFormular.forEach((produs) => {
    const key = productKey(produs)
    const original = key ? originaleByKey.get(key) : null
    if (!original) {
      produseAdaugate.push({
        produs_id: produs.produs_id,
        produs_nume_manual: produs.produs_nume_manual || produs.produs_nume_snapshot,
      })
      return
    }

    const comparisons = [
      ['doza_ml_per_hl', original.doza_ml_per_hl ?? null, toNumberOrNull(produs.doza_ml_per_hl)],
      ['doza_l_per_ha', original.doza_l_per_ha ?? null, toNumberOrNull(produs.doza_l_per_ha)],
      ['observatii', original.observatii ?? null, produs.observatii.trim() || null],
    ] as const

    comparisons.forEach(([camp, valoarePlan, valoareEfectiva]) => {
      if (valoarePlan !== valoareEfectiva) {
        produseModificate.push({
          plan_linie_produs_id: original.id,
          camp,
          valoare_plan: valoarePlan,
          valoare_efectiva: valoareEfectiva,
        })
      }
    })
  })

  originale.forEach((produs) => {
    const key = productKey(produs)
    if (key && !formularByKey.has(key)) {
      produseEliminate.push({ plan_linie_produs_id: produs.id })
    }
  })

  if (produseAdaugate.length === 0 && produseEliminate.length === 0 && produseModificate.length === 0) {
    return null
  }

  return {
    produse_adaugate: produseAdaugate,
    produse_eliminate: produseEliminate,
    produse_modificate: produseModificate,
  }
}

export function AplicareDetaliuClient({
  aplicare,
  currentOperator,
  defaultCantitateMl,
  meteoDateLabel,
  meteoZi,
  parcelaId,
  produseFitosanitare,
  configurareSezon,
  grupBiologic,
  stadiuImplicit,
  verificari,
}: AplicareDetaliuClientProps) {
  const router = useRouter()
  const [markOpen, setMarkOpen] = useState(false)
  const [reprogrameazaOpen, setReprogrameazaOpen] = useState(false)
  const [anulareOpen, setAnulareOpen] = useState(false)
  const [motivAnulare, setMotivAnulare] = useState('')
  const [produseFormular, setProduseFormular] = useState<AplicareProdusForm[]>(() => buildInitialFormProducts(aplicare))
  const [operatorLocal, setOperatorLocal] = useState(aplicare.operator ?? currentOperator ?? '')
  const [observatiiLocale, setObservatiiLocale] = useState(aplicare.observatii ?? '')
  const [dataAplicariiLocale, setDataAplicariiLocale] = useState(new Date().toISOString().slice(0, 10))
  const [isPending, startTransition] = useTransition()

  const snapshotSalvat = isMeteoSnapshot(aplicare.meteo_snapshot) ? aplicare.meteo_snapshot : null
  const isPlanificata = aplicare.status === 'planificata'
  const isEditable = aplicare.status === 'planificata' || aplicare.status === 'ciorna'
  const rubusMixt = isRubusMixt(configurareSezon)
  const cohortBlocata = normalizeCohorta(aplicare.linie?.cohort_trigger)
  const cohortImplicita = normalizeCohorta(aplicare.cohort_la_aplicare) ?? cohortBlocata ?? null
  const productsSummary = getAplicareProduseSummary(aplicare)
  const contextLabel = getAplicareContextLabel(aplicare)
  const differenceItems = formatDifferencesSummary(aplicare.diferente_fata_de_plan ?? null)
  const planHref = getPlanLink(aplicare)
  const visualProduse = getVisualProduse(aplicare)
  const diferenteFormular = useMemo(
    () => calculeazaDiferente(produseFormular, aplicare.linie?.produse ?? []),
    [aplicare.linie?.produse, produseFormular]
  )
  const produsePentruMarcare = useMemo(
    () => produseFormular.map((produs, index) => toAplicareProdusV2(produs, aplicare, index)),
    [aplicare, produseFormular]
  )

  const updateProdusFormular = (localId: string, updater: (produs: AplicareProdusForm) => AplicareProdusForm) => {
    setProduseFormular((current) =>
      current.map((produs, index) =>
        produs.localId === localId ? { ...updater(produs), ordine: index + 1 } : { ...produs, ordine: index + 1 }
      )
    )
  }

  const handleAdaugaProdus = (product: ProdusFitosanitar | null) => {
    if (!product) return
    setProduseFormular((current) => [
      ...current,
      applyCatalogProduct(createEmptyFormProduct(current.length + 1), product),
    ])
  }

  const handleStergeProdus = (localId: string) => {
    setProduseFormular((current) =>
      current
        .filter((produs) => produs.localId !== localId)
        .map((produs, index) => ({ ...produs, ordine: index + 1 }))
    )
  }

  const handleSalveazaCiorna = () => {
    startTransition(async () => {
      const produse = produseFormular.map(toAplicareProdusInput)
      const result = await salveazaCiornaAction(aplicare.id, {
        operator: operatorLocal,
        observatii: observatiiLocale,
        produse,
        diferente_fata_de_plan: diferenteFormular,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Ciornă salvată.')
      router.refresh()
    })
  }

  const handleMarkAplicata = async (values: MarkAplicataFormValues) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('aplicareId', aplicare.id)
      formData.set('data_aplicata', values.data_aplicata)
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('operator', values.operator ?? '')
      formData.set('stadiu_la_aplicare', values.stadiu_la_aplicare ?? '')
      if (values.cohort_la_aplicare) {
        formData.set('cohort_la_aplicare', values.cohort_la_aplicare)
      }
      formData.set('observatii', values.observatii ?? '')
      if (values.meteoSnapshot) {
        formData.set('meteo_snapshot', JSON.stringify(values.meteoSnapshot))
      }
      formData.set('produse', JSON.stringify(values.produse))
      if (values.diferenteFataDePlan) {
        formData.set('diferente_fata_de_plan', JSON.stringify(values.diferenteFataDePlan))
      }

      const result = await markAplicataAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost marcată ca efectuată.')
      setMarkOpen(false)
      router.refresh()
    })
  }

  const handleReprogrameaza = async (values: ReprogrameazaFormValues) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', parcelaId)
      formData.set('aplicareId', aplicare.id)
      formData.set('data_planificata', values.data_planificata)
      formData.set('motiv', values.motiv ?? '')

      const result = await reprogrameazaAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost reprogramată.')
      setReprogrameazaOpen(false)
      router.refresh()
    })
  }

  const handleAnuleaza = async () => {
    startTransition(async () => {
      const result = await anuleazaAction(aplicare.id, motivAnulare)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost anulată.')
      setAnulareOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-4 py-3 pb-32 md:py-4 md:pb-10">
        <AplicareHero aplicare={aplicare} configurareSezon={configurareSezon} />

        <AppCard className="rounded-2xl bg-[var(--surface-card)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">Context operațional</p>
              <p className="mt-1 text-base text-[var(--text-primary)] [font-weight:700]">{contextLabel}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {aplicare.parcela?.nume_parcela ?? 'Parcelă'}
                {aplicare.data_planificata ? ` · Programată ${aplicare.data_planificata}` : ''}
                {aplicare.data_aplicata ? ` · Aplicată ${aplicare.data_aplicata}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AplicareSourceBadge source={aplicare.sursa ?? (aplicare.plan_linie_id ? 'din_plan' : 'manuala')} />
              {planHref ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={planHref}>Vezi planul</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface-card-muted)] p-3">
              <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">Intervenție</p>
              <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">{getAplicareInterventieLabel(aplicare)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {getStadiuAplicareLabel(aplicare)}
                {cohortImplicita ? ` · ${cohortImplicita === 'floricane' ? 'Floricane' : 'Primocane'}` : ''}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-card-muted)] p-3">
              <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">Produse efective</p>
              <p className="mt-2 text-sm text-[var(--text-primary)] [font-weight:650]">
                {productsSummary.count > 1 ? `${productsSummary.count} produse` : '1 produs'}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {productsSummary.title}
                {productsSummary.detail ? ` · ${productsSummary.detail}` : ''}
              </p>
            </div>
          </div>
        </AppCard>

        {aplicare.status === 'aplicata' ? (
          <MeteoSnapshotCard snapshot={snapshotSalvat} />
        ) : isPlanificata && meteoZi ? (
          <MeteoWindowBar dateLabel={meteoDateLabel} ferestre={meteoZi.ferestre_24h} />
        ) : isPlanificata ? (
          <AppCard className="rounded-2xl">
            <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Ferestre meteo</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Meteo indisponibil acum. Poți continua și fără snapshot automat.
            </p>
          </AppCard>
        ) : null}

        <VerificariAutomate phi={verificari.phi} sezon={verificari.sezon} stoc={verificari.stoc} />

        <AppCard className="rounded-2xl bg-[var(--surface-card)]">
          <h3 className="text-base text-[var(--text-primary)] [font-weight:700]">Produse efective</h3>
          {isEditable ? (
            <div className="mt-3 space-y-3">
              {produseFormular.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Nu există produse în formular.</p>
              ) : (
                produseFormular.map((produs, index) => {
                  const selectedLabel =
                    (produs.produs_nume_snapshot || produs.produs_nume_manual || '').trim() || null
                  const meta = [
                    produs.substanta_activa_snapshot || null,
                    produs.tip_snapshot || null,
                    produs.fromPlan ? 'din plan' : null,
                    produs.observatii || null,
                  ].filter(Boolean)

                  return (
                    <div key={produs.localId} className="rounded-xl bg-[var(--surface-card-muted)] p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.03em] text-[var(--text-secondary)]">
                            Produs #{index + 1}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-primary)] [font-weight:700]">
                            {selectedLabel ?? 'Produs nespecificat'}
                          </p>
                          {meta.length > 0 ? (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{meta.join(' · ')}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <ProdusFitosanitarPicker
                            produse={produseFitosanitare}
                            value={produs.produs_id}
                            selectedLabel={selectedLabel}
                            placeholder="Schimbă"
                            onChange={(product) =>
                              updateProdusFormular(produs.localId, (current) => applyCatalogProduct(current, product))
                            }
                          />
                          {produseFormular.length >= 2 ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={`Șterge produsul ${index + 1}`}
                              className="h-11 w-11 text-[var(--status-danger-text)]"
                              onClick={() => handleStergeProdus(produs.localId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`doza-ml-${produs.localId}`}>Doză ml/hl</Label>
                          <Input
                            id={`doza-ml-${produs.localId}`}
                            inputMode="decimal"
                            value={produs.doza_ml_per_hl}
                            onChange={(event) =>
                              updateProdusFormular(produs.localId, (current) => ({
                                ...current,
                                doza_ml_per_hl: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`doza-ha-${produs.localId}`}>Doză l/ha</Label>
                          <Input
                            id={`doza-ha-${produs.localId}`}
                            inputMode="decimal"
                            value={produs.doza_l_per_ha}
                            onChange={(event) =>
                              updateProdusFormular(produs.localId, (current) => ({
                                ...current,
                                doza_l_per_ha: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`cantitate-${produs.localId}`}>Cantitate totală</Label>
                          <Input
                            id={`cantitate-${produs.localId}`}
                            placeholder="Ex: 750g"
                            value={produs.cantitate_totala}
                            onChange={(event) =>
                              updateProdusFormular(produs.localId, (current) => ({
                                ...current,
                                cantitate_totala: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`observatii-produs-${produs.localId}`}>Observații produs</Label>
                          <Input
                            id={`observatii-produs-${produs.localId}`}
                            value={produs.observatii}
                            onChange={(event) =>
                              updateProdusFormular(produs.localId, (current) => ({
                                ...current,
                                observatii: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              <div className="rounded-xl border border-dashed border-[var(--border-muted)] p-3">
                <Label className="text-sm text-[var(--text-primary)] [font-weight:650]">Adaugă produs</Label>
                <div className="mt-2">
                  <ProdusFitosanitarPicker
                    produse={produseFitosanitare}
                    value={null}
                    placeholder="+ Adaugă produs"
                    onChange={handleAdaugaProdus}
                  />
                </div>
              </div>

              {diferenteFormular ? (
                <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  Modificările față de plan sunt înregistrate separat — planul rămâne neatins.
                </div>
              ) : null}
            </div>
          ) : visualProduse.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Nu există produse salvate pentru această aplicare.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {visualProduse.map((produs) => {
                const name = getProductLabel(produs)
                const dosage =
                  typeof produs.doza_ml_per_hl === 'number'
                    ? `${produs.doza_ml_per_hl} ml/hl`
                    : typeof produs.doza_l_per_ha === 'number'
                      ? `${produs.doza_l_per_ha} l/ha`
                      : null
                const meta = [
                  produs.substanta_activa_snapshot ?? produs.produs?.substanta_activa ?? null,
                  produs.tip_snapshot ?? produs.produs?.tip ?? null,
                  produs.frac_irac_snapshot ? `FRAC ${produs.frac_irac_snapshot}` : null,
                  typeof produs.phi_zile_snapshot === 'number' ? `PHI ${produs.phi_zile_snapshot} zile` : null,
                ].filter(Boolean)

                return (
                  <div
                    key={produs.id}
                    className="rounded-xl bg-[var(--surface-card-muted)] p-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text-primary)] [font-weight:650]">{name}</p>
                        {meta.length > 0 ? (
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">{meta.join(' · ')}</p>
                        ) : null}
                      </div>
                      {dosage ? (
                        <p className="text-sm text-[var(--text-primary)] [font-weight:650]">{dosage}</p>
                      ) : null}
                    </div>
                    {produs.observatii ? (
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">{produs.observatii}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </AppCard>

        {isEditable ? (
          <AppCard className="rounded-2xl bg-[var(--surface-card)]">
            <h3 className="text-base text-[var(--text-primary)] [font-weight:700]">Detalii aplicare</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="data-aplicarii">Data aplicării</Label>
                <Input
                  id="data-aplicarii"
                  type="date"
                  value={dataAplicariiLocale}
                  onChange={(event) => setDataAplicariiLocale(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="operator-aplicare">Operator</Label>
                <Input
                  id="operator-aplicare"
                  value={operatorLocal}
                  onChange={(event) => setOperatorLocal(event.target.value)}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="observatii-aplicare">Observații generale</Label>
                <Textarea
                  id="observatii-aplicare"
                  value={observatiiLocale}
                  onChange={(event) => setObservatiiLocale(event.target.value)}
                />
              </div>
            </div>
          </AppCard>
        ) : null}

        {differenceItems.length > 0 ? (
          <AppCard className="rounded-2xl bg-[var(--surface-card)]">
            <h3 className="text-base text-[var(--text-primary)] [font-weight:700]">Diferențe față de plan</h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
              {differenceItems.map((item, index) => (
                <li key={`${item}-${index}`} className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </AppCard>
        ) : null}

        {aplicare.observatii ? (
          <AppCard className="rounded-2xl bg-[var(--surface-card)]">
            <h3 className="text-base text-[var(--text-primary)] [font-weight:700]">Observații</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{aplicare.observatii}</p>
          </AppCard>
        ) : null}
      </div>

      {!isEditable ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:static md:mx-auto md:mt-2 md:max-w-5xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <Button type="button" variant="outline" className="w-full md:w-auto" asChild>
            <Link href={`/parcele/${parcelaId}/tratamente`}>Înapoi la listă</Link>
          </Button>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:static md:mx-auto md:mt-2 md:max-w-5xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <Button type="button" variant="outline" className="w-full md:w-auto" disabled={isPending} onClick={handleSalveazaCiorna}>
              Salvează ca ciornă
            </Button>
            <Button type="button" className="w-full bg-[var(--agri-primary)] text-white md:w-auto" onClick={() => setMarkOpen(true)}>
              Marchează ca aplicat ✓
            </Button>
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => setReprogrameazaOpen(true)}>
              Reprogramează
            </Button>
            <Button type="button" variant="ghost" className="w-full text-[var(--status-danger-text)] md:w-auto" onClick={() => setAnulareOpen(true)}>
              Anulează
            </Button>
          </div>
        </div>
      )}

      <MarkAplicataSheet
        cohortLaAplicareBlocata={cohortBlocata}
        defaultCantitateMl={defaultCantitateMl}
        defaultCohortLaAplicare={cohortImplicita}
        defaultOperator={currentOperator}
        defaultStadiu={stadiuImplicit}
        configurareSezon={configurareSezon}
        grupBiologic={grupBiologic}
        isRubusMixt={rubusMixt}
        meteoSnapshot={meteoZi?.snapshot_curent ?? null}
        onOpenChange={setMarkOpen}
        onSubmit={handleMarkAplicata}
        open={markOpen}
        pending={isPending}
        produseEfective={isEditable ? produsePentruMarcare : aplicare.produse_aplicare ?? []}
        produseFitosanitare={produseFitosanitare}
        produsePlanificate={aplicare.linie?.produse ?? []}
      />

      <ReprogrameazaSheet
        defaultDate={aplicare.data_planificata ?? new Date().toISOString().slice(0, 10)}
        onOpenChange={setReprogrameazaOpen}
        onSubmit={handleReprogrameaza}
        open={reprogrameazaOpen}
        pending={isPending}
      />

      <AnuleazaDialog
        motiv={motivAnulare}
        onConfirm={handleAnuleaza}
        onMotivChange={setMotivAnulare}
        onOpenChange={setAnulareOpen}
        open={anulareOpen}
        pending={isPending}
      />
    </>
  )
}
