'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import dynamic from 'next/dynamic'
import { Droplets, Leaf, ListChecks, Plus, SprayCan, Thermometer } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import * as z from 'zod'

import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { getConditiiMediuLabel, getConditiiMediuLabelLower } from '@/lib/parcele/culturi'
import { queryKeys } from '@/lib/query-keys'
import { getParcelaById } from '@/lib/supabase/queries/parcele'
import {
  createParcelaStadiuCanonic,
  getConfigurareSezonParcela,
  getStadiiCanoniceParcela,
} from '@/lib/supabase/queries/parcela-stadii'
import { getCulturiForSolar } from '@/lib/supabase/queries/culturi'
import {
  createSolarClimateLog,
  getCultureStageLogs,
  getSolarClimateLogs,
} from '@/lib/supabase/queries/solar-tracking'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  getOrdine,
  getOrdineInGrup,
  listAllStadiiCanonice,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'

const AddCulturaDialog = dynamic(
  () => import('@/components/parcele/AddCulturaDialog').then((mod) => mod.AddCulturaDialog),
  { ssr: false }
)

const climateSchema = z.object({
  temperatura: z
    .string()
    .trim()
    .min(1, 'Temperatura este obligatorie')
    .refine((value) => Number.isFinite(Number(value.replace(',', '.'))), {
      message: 'Temperatura trebuie să fie un număr valid.',
    }),
  umiditate: z
    .string()
    .trim()
    .min(1, 'Umiditatea este obligatorie')
    .refine((value) => {
      const parsed = Number(value.replace(',', '.'))
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    }, {
      message: 'Umiditatea trebuie să fie între 0 și 100.',
    }),
  observatii: z.string().optional(),
})

const stageSchema = z.object({
  stadiu: z.string().min(1, 'Stadiul este obligatoriu'),
  cohort: z.enum(['floricane', 'primocane']).optional(),
  data: z.string().min(1, 'Data este obligatorie'),
  observatii: z.string().optional(),
})

type ClimateFormValues = z.infer<typeof climateSchema>
type StageFormValues = z.infer<typeof stageSchema>

function toDateLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ro-RO')
}

function toCompactDateTimeLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toFullDateTimeLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateOnlyKey(value: string | null | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function formatLegacyEtapaLabel(value: string | null | undefined): string {
  const normalized = (value ?? '').trim()
  if (!normalized) return 'Etapa nedefinita'
  const withSpaces = normalized.replaceAll('_', ' ')
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

function getStadiuLabel(
  value: string | null | undefined,
  grupBiologic?: GrupBiologic | null,
  cohort?: string | null
): string {
  if (!value) return 'Stadiu nedefinit'
  const cod = normalizeStadiu(value)
  return cod ? getLabelPentruGrup(cod, grupBiologic, { cohort }) : value
}

function getStadiuOrder(cod: StadiuCod, grupBiologic: GrupBiologic | null): number {
  if (grupBiologic) {
    const indexInGroup = getOrdineInGrup(cod, grupBiologic)
    if (indexInGroup >= 0) {
      return indexInGroup
    }
  }
  return getOrdine(cod) + 100
}

function getCurrentCanonicalStage<T extends { stadiu: string; data_observata: string; created_at: string }>(
  entries: T[],
  grupBiologic: GrupBiologic | null
): T | null {
  if (entries.length === 0) return null

  return [...entries].sort((a, b) => {
    const codA = normalizeStadiu(a.stadiu)
    const codB = normalizeStadiu(b.stadiu)
    const orderA = codA ? getStadiuOrder(codA, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderB = codB ? getStadiuOrder(codB, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderDiff = orderB - orderA
    if (orderDiff !== 0) return orderDiff

    const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
  }
  return 'A apărut o eroare neașteptată.'
}

function daysSincePlanting(plantingDate: string | null | undefined): number | null {
  if (!plantingDate) return null
  const start = new Date(plantingDate)
  if (Number.isNaN(start.getTime())) return null

  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export default function ParcelaDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const parcelaId = Array.isArray(params.id) ? params.id[0] : params.id
  const [climateOpen, setClimateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const [addCulturaOpen, setAddCulturaOpen] = useState(false)
  const currentSezon = getCurrentSezon()

  const climateForm = useForm<ClimateFormValues>({
    resolver: zodResolver(climateSchema),
    defaultValues: {
      temperatura: '',
      umiditate: '',
      observatii: '',
    },
  })

  const stageForm = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      stadiu: 'repaus_vegetativ',
      cohort: undefined,
      data: new Date().toISOString().slice(0, 10),
      observatii: '',
    },
  })

  const parcelaQuery = useQuery({
    queryKey: queryKeys.parcela(parcelaId),
    queryFn: () => getParcelaById(parcelaId),
    enabled: Boolean(parcelaId),
  })

  const climateQuery = useQuery({
    queryKey: queryKeys.parcelaSolarClimate(parcelaId),
    queryFn: () => getSolarClimateLogs(parcelaId, 20),
    enabled: Boolean(parcelaId),
  })

  const canonicalStageQuery = useQuery({
    queryKey: queryKeys.parcelaCultureStages(parcelaId),
    queryFn: () => getStadiiCanoniceParcela(parcelaId, currentSezon, 50),
    enabled: Boolean(parcelaId),
  })

  const legacyStageQuery = useQuery({
    queryKey: queryKeys.parcelaCultureStagesLegacy(parcelaId),
    queryFn: () => getCultureStageLogs(parcelaId, 30),
    enabled: Boolean(parcelaId),
  })

  const seasonConfigQuery = useQuery({
    queryKey: queryKeys.parcelaSeasonConfig(parcelaId, currentSezon),
    queryFn: () => getConfigurareSezonParcela(parcelaId, currentSezon),
    enabled: Boolean(parcelaId),
  })

  const culturiQuery = useQuery({
    queryKey: queryKeys.culturi(parcelaId),
    queryFn: () => getCulturiForSolar(parcelaId),
    enabled: Boolean(parcelaId),
    staleTime: 30000,
    refetchOnMount: true,
  })

  const createClimateMutation = useMutation({
    mutationFn: createSolarClimateLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parcelaSolarClimate(parcelaId) })
      toast.success(
        isSolar ? 'Date actualizate — recomandările sunt mai precise' : 'Condițiile de mediu au fost salvate.'
      )
      setClimateOpen(false)
      climateForm.reset({ temperatura: '', umiditate: '', observatii: '' })
    },
    onError: (error: unknown) => {
      toast.error(toErrorMessage(error))
    },
  })

  const createStageMutation = useMutation({
    mutationFn: createParcelaStadiuCanonic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
      toast.success('Stadiul fenologic a fost salvat.')
      setStageOpen(false)
      stageForm.reset({
        stadiu: canonicFirstStadiu,
        cohort: undefined,
        data: new Date().toISOString().slice(0, 10),
        observatii: '',
      })
    },
    onError: (error: unknown) => {
      toast.error(toErrorMessage(error))
    },
  })

  const parcela = parcelaQuery.data
  const isSolar = (parcela?.tip_unitate ?? 'camp') === 'solar'
  const conditiiLabel = getConditiiMediuLabel(parcela?.tip_unitate)
  const conditiiLabelLower = getConditiiMediuLabelLower(parcela?.tip_unitate)
  const latestClimate = climateQuery.data?.[0] ?? null
  const now = new Date()
  const todayDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const hasClimateToday = toDateOnlyKey(latestClimate?.created_at) === todayDateKey
  const sincePlanting = daysSincePlanting(parcela?.data_plantarii)
  const selectedStageCohort = useWatch({ control: stageForm.control, name: 'cohort' }) ?? undefined
  const cropCod = useMemo(
    () => normalizeCropCod(parcela?.cultura) ?? normalizeCropCod(parcela?.tip_fruct),
    [parcela?.cultura, parcela?.tip_fruct]
  )
  const grupBiologic = useMemo(() => getGrupBiologicForCropCod(cropCod), [cropCod])
  const stageOptions = useMemo(() => {
    const values = grupBiologic ? listStadiiPentruGrup(grupBiologic) : listAllStadiiCanonice()
    return values.map((cod) => ({
      value: cod,
      label: getLabelPentruGrup(cod, grupBiologic, { cohort: selectedStageCohort }),
    }))
  }, [grupBiologic, selectedStageCohort])
  const canonicFirstStadiu = stageOptions[0]?.value ?? 'repaus_vegetativ'
  const hasCanonicalCohorts = useMemo(
    () => (canonicalStageQuery.data ?? []).some((entry) => entry.cohort === 'floricane' || entry.cohort === 'primocane'),
    [canonicalStageQuery.data]
  )
  const isRubusMixt =
    grupBiologic === 'rubus' &&
    (
      seasonConfigQuery.data?.sistem_conducere === 'mixt_floricane_primocane' ||
      hasCanonicalCohorts
    )
  const showCohort = grupBiologic === 'rubus' && isRubusMixt
  const currentCanonicalStage = useMemo(
    () => getCurrentCanonicalStage(canonicalStageQuery.data ?? [], grupBiologic),
    [canonicalStageQuery.data, grupBiologic]
  )
  const currentLegacyStage = legacyStageQuery.data?.[0] ?? null
  const latestStageByCulturaId = useMemo(() => {
    const map = new Map<string, string>()
    for (const stage of legacyStageQuery.data ?? []) {
      if (!stage.cultura_id || map.has(stage.cultura_id)) continue
      map.set(stage.cultura_id, formatLegacyEtapaLabel(stage.etapa))
    }
    return map
  }, [legacyStageQuery.data])

  const sectionClasses = useMemo(
    () => ({
      base: 'rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4 shadow-sm',
      title: 'mb-3 text-sm font-semibold text-[var(--agri-text)]',
      label: 'text-xs text-[var(--agri-text-muted)]',
      value: 'text-sm font-medium text-[var(--agri-text)]',
    }),
    []
  )

  useEffect(() => {
    if (!stageOpen) return
    stageForm.reset({
      stadiu: canonicFirstStadiu,
      cohort: undefined,
      data: new Date().toISOString().slice(0, 10),
      observatii: '',
    })
  }, [canonicFirstStadiu, stageForm, stageOpen])

  const onClimateSubmit = (values: ClimateFormValues) => {
    createClimateMutation.mutate({
      unitate_id: parcelaId,
      temperatura: Number(values.temperatura.replace(',', '.')),
      umiditate: Number(values.umiditate.replace(',', '.')),
      observatii: values.observatii?.trim() || undefined,
    })
  }

  const onStageSubmit = (values: StageFormValues) => {
    const cohort = showCohort ? values.cohort : undefined
    if (showCohort && !cohort) {
      stageForm.setError('cohort', { message: 'Selectează cohorta.' })
      return
    }

    createStageMutation.mutate({
      parcela_id: parcelaId,
      an: currentSezon,
      stadiu: values.stadiu,
      cohort: cohort ?? null,
      data_observata: values.data,
      observatii: values.observatii?.trim() || undefined,
    })
  }

  if (parcelaQuery.isLoading) {
    return (
      <AppShell header={<PageHeader title="Detaliu teren" subtitle="Se încarcă..." rightSlot={<Leaf className="h-5 w-5" />} />}>
        <div className="mt-4">
          <LoadingState label="Se încarcă detaliile terenului..." />
        </div>
      </AppShell>
    )
  }

  if (parcelaQuery.isError) {
    return (
      <AppShell header={<PageHeader title="Detaliu teren" subtitle="Eroare" rightSlot={<Leaf className="h-5 w-5" />} />}>
        <div className="mt-4">
          <ErrorState
            title="Nu am putut încărca terenul."
            message={toErrorMessage(parcelaQuery.error)}
            onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.parcela(parcelaId) })}
          />
        </div>
      </AppShell>
    )
  }

  if (!parcela) {
    return (
      <AppShell header={<PageHeader title="Detaliu teren" subtitle="Teren lipsă" rightSlot={<Leaf className="h-5 w-5" />} />}>
        <div className="mx-auto mt-3 w-full max-w-3xl px-0 py-3 sm:px-3">
          <div className={sectionClasses.base}>
            <p className={sectionClasses.value}>Terenul nu a fost găsit.</p>
            <button
              type="button"
              onClick={() => router.push('/parcele')}
              className="mt-3 inline-flex h-10 items-center rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white"
            >
              Înapoi la terenuri
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title={parcela.nume_parcela || 'Detaliu teren'}
          subtitle={isSolar ? 'Detaliu unitate · solar' : 'Detaliu unitate'}
          rightSlot={<Leaf className="h-5 w-5" />}
        />
      }
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 px-0 py-3 sm:px-3">
        <div className={sectionClasses.base}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className={sectionClasses.title}>Date unitate</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/parcele')}
                className="inline-flex h-9 items-center rounded-xl border border-[var(--agri-border)] px-3 text-xs font-semibold text-[var(--agri-text)]"
              >
                Înapoi
              </button>
              <button
                type="button"
                onClick={() => router.push(`/parcele/${parcelaId}/tratamente`)}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-[var(--agri-primary)] px-3 text-xs font-semibold text-white"
              >
                <SprayCan className="h-3.5 w-3.5" aria-hidden />
                Tratamente
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['Unitate', parcela.nume_parcela || '-'],
              ['Tip unitate', parcela.tip_unitate || 'câmp'],
              ['Cultură', parcela.cultura || parcela.tip_fruct || '-'],
              ['Soi', parcela.soi || parcela.soi_plantat || '-'],
              ['Suprafață', `${Number(parcela.suprafata_m2 || 0).toFixed(0)} mp`],
              ['Număr rânduri', parcela.nr_randuri ?? '-'],
              ['Număr plante', parcela.nr_plante ?? '-'],
              ['Sistem irigare', parcela.sistem_irigare || '-'],
              ['Data plantării', toDateLabel(parcela.data_plantarii)],
              ['Zile de la plantare', sincePlanting !== null ? String(sincePlanting) : '-'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-1">
                <p className={sectionClasses.label}>{label}</p>
                <p className={`${sectionClasses.value} break-words`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {isSolar ? (
          <div className={sectionClasses.base}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className={sectionClasses.title}>Culturi în solar</h2>
              <button
                type="button"
                onClick={() => setAddCulturaOpen(true)}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-[var(--agri-primary)] px-3 text-xs font-semibold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Adaugă cultură
              </button>
            </div>

            {culturiQuery.isLoading ? (
              <p className={sectionClasses.label}>Se încarcă culturile...</p>
            ) : null}
            {!culturiQuery.isLoading && (culturiQuery.data?.length ?? 0) === 0 ? (
              <p className={sectionClasses.label}>Nu există culturi înregistrate pentru acest solar.</p>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(culturiQuery.data ?? []).map((cultura) => (
                <div key={cultura.id} className="w-full rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={sectionClasses.value}>{cultura.tip_planta}</p>
                      {cultura.soi ? (
                        <p className={`${sectionClasses.label} mt-0.5`}>Soi: {cultura.soi}</p>
                      ) : null}
                      {cultura.nr_plante ? (
                        <p className={`${sectionClasses.label} mt-0.5`}>Nr. plante: {cultura.nr_plante}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--agri-text)]">
                        {latestStageByCulturaId.get(cultura.id) ?? 'Plantare'}
                      </span>
                      <p className="mt-1 text-[10px] text-[var(--agri-text-muted)]">
                        {cultura.activa ? 'Activă' : 'Desființată'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <>
            <div className={sectionClasses.base}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className={sectionClasses.title}>{conditiiLabel} și observații</h2>
              <div className="flex items-center gap-2">
                {(climateQuery.data?.length ?? 0) > 1 ? (
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="inline-flex h-9 items-center rounded-xl border border-[var(--agri-border)] px-3 text-xs font-semibold text-[var(--agri-text)]"
                  >
                    Istoric microclimat
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setClimateOpen(true)}
                  className="inline-flex h-9 items-center rounded-xl bg-[var(--agri-primary)] px-3 text-xs font-semibold text-white"
                >
                  {`Adaugă ${conditiiLabelLower}`}
                </button>
              </div>
              </div>
              {isSolar && !hasClimateToday ? (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--agri-border)]/70 bg-[var(--agri-surface-muted)]/45 px-3 py-2">
                  <p className="text-[12px] leading-5 text-[var(--agri-text-muted)]">Nu ai introdus date din solar azi</p>
                  <button
                    type="button"
                    onClick={() => setClimateOpen(true)}
                    className="shrink-0 text-[12px] font-semibold text-[var(--agri-primary)]"
                  >
                    Adaugă temperatură și umiditate
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-rose-600" />
                    <p className={sectionClasses.label}>Temperatură</p>
                  </div>
                  <p className={sectionClasses.value}>
                    {latestClimate ? `${Number(latestClimate.temperatura).toFixed(1)}°C` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-sky-600" />
                    <p className={sectionClasses.label}>Umiditate</p>
                  </div>
                  <p className={sectionClasses.value}>
                    {latestClimate ? `${Number(latestClimate.umiditate).toFixed(0)}%` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3">
                  <p className={sectionClasses.label}>Ultima actualizare</p>
                  <p className={sectionClasses.value}>{toCompactDateTimeLabel(latestClimate?.created_at)}</p>
                </div>
              </div>
            </div>

            <div className={sectionClasses.base}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className={sectionClasses.title}>Etape de cultură</h2>
                <button
                  type="button"
                  onClick={() => setStageOpen(true)}
                  className="inline-flex h-9 items-center rounded-xl bg-[var(--agri-primary)] px-3 text-xs font-semibold text-white"
                >
                  Actualizează stadiu
                </button>
              </div>

              <div className="mb-3 rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3">
                <p className={sectionClasses.label}>Stadiu curent</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className={sectionClasses.value}>
                    {currentCanonicalStage
                      ? getStadiuLabel(currentCanonicalStage.stadiu, grupBiologic, currentCanonicalStage.cohort)
                      : currentLegacyStage
                        ? formatLegacyEtapaLabel(currentLegacyStage.etapa)
                        : 'Fără stadiu înregistrat'}
                  </p>
                  {currentCanonicalStage?.cohort && showCohort ? (
                    <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--agri-text)]">
                      {currentCanonicalStage.cohort === 'floricane' ? 'Floricane' : 'Primocane'}
                    </span>
                  ) : null}
                  {!currentCanonicalStage && currentLegacyStage ? (
                    <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--agri-text-muted)]">
                      Istoric vechi
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[var(--agri-text-muted)]">
                  {currentCanonicalStage
                    ? `Observat la ${toDateLabel(currentCanonicalStage.data_observata)}`
                    : currentLegacyStage
                      ? `Preluat din istoricul existent la ${toDateLabel(currentLegacyStage.data)}`
                      : 'Înregistrează primul stadiu pentru anul curent.'}
                </p>
              </div>

              {(canonicalStageQuery.data?.length ?? 0) === 0 && (legacyStageQuery.data?.length ?? 0) === 0 ? (
                <p className={sectionClasses.label}>Nu există încă stadii înregistrate.</p>
              ) : null}
              <div className="space-y-2">
                {(canonicalStageQuery.data ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-emerald-700" />
                        <p className={sectionClasses.value}>{getStadiuLabel(entry.stadiu, grupBiologic, entry.cohort)}</p>
                        {entry.cohort && showCohort ? (
                          <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--agri-text)]">
                            {entry.cohort === 'floricane' ? 'Floricane' : 'Primocane'}
                          </span>
                        ) : null}
                      </div>
                      <p className={sectionClasses.label}>{toDateLabel(entry.data_observata)}</p>
                    </div>
                    {entry.observatii ? (
                      <p className="mt-2 text-xs text-[var(--agri-text-muted)]">{entry.observatii}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              {(canonicalStageQuery.data?.length ?? 0) > 0 && (legacyStageQuery.data?.length ?? 0) > 0 ? (
                <p className="mt-3 text-xs text-[var(--agri-text-muted)]">
                  Există și {(legacyStageQuery.data ?? []).length} înregistrări istorice din versiunea veche.
                </p>
              ) : null}
              {(canonicalStageQuery.data?.length ?? 0) === 0 && (legacyStageQuery.data?.length ?? 0) > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[var(--agri-text-muted)]">Istoric existent (versiune veche)</p>
                  {(legacyStageQuery.data ?? []).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3 opacity-85">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ListChecks className="h-4 w-4 text-[var(--agri-text-muted)]" />
                          <p className={sectionClasses.value}>{formatLegacyEtapaLabel(entry.etapa)}</p>
                          <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--agri-text-muted)]">
                            Istoric vechi
                          </span>
                        </div>
                        <p className={sectionClasses.label}>{toDateLabel(entry.data)}</p>
                      </div>
                      {entry.observatii ? (
                        <p className="mt-2 text-xs text-[var(--agri-text-muted)]">{entry.observatii}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
      </div>

      <AppDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title={`Istoric ${conditiiLabelLower}`}
      >
        <div className="space-y-2">
          {climateQuery.isLoading ? (
            <p className="text-xs text-[var(--agri-text-muted)]">{`Se încarcă istoricul de ${conditiiLabelLower}...`}</p>
          ) : null}
          {!climateQuery.isLoading && (climateQuery.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-[var(--agri-text-muted)]">{`Nu există încă înregistrări de ${conditiiLabelLower}.`}</p>
          ) : null}
          {(climateQuery.data ?? []).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-[var(--surface-divider)] bg-[var(--agri-surface)] p-3">
              <p className="text-sm font-medium text-[var(--agri-text)]">{toFullDateTimeLabel(entry.created_at)}</p>
              <p className="mt-1 text-xs text-[var(--agri-text-muted)]">
                {Number(entry.temperatura).toFixed(1)}°C · {Number(entry.umiditate).toFixed(0)}%
              </p>
              {entry.observatii ? (
                <p className="mt-2 text-xs text-[var(--agri-text-muted)]">{entry.observatii}</p>
              ) : null}
            </div>
          ))}
        </div>
      </AppDialog>

      <AppDialog
        open={climateOpen}
        onOpenChange={setClimateOpen}
        title={`Adaugă ${conditiiLabelLower}`}
        footer={
          <DialogFormActions
            onCancel={() => setClimateOpen(false)}
            onSave={climateForm.handleSubmit(onClimateSubmit)}
            saving={createClimateMutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        <form className="space-y-4" onSubmit={climateForm.handleSubmit(onClimateSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="climat_temperatura">Temperatură (°C)</Label>
            <Input id="climat_temperatura" aria-label="Temperatură în grade Celsius" className="agri-control h-12" inputMode="decimal" {...climateForm.register('temperatura')} />
            {climateForm.formState.errors.temperatura ? (
              <p className="text-xs text-red-600">{climateForm.formState.errors.temperatura.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="climat_umiditate">Umiditate (%)</Label>
            <Input id="climat_umiditate" aria-label="Umiditate în procente" className="agri-control h-12" inputMode="decimal" {...climateForm.register('umiditate')} />
            {climateForm.formState.errors.umiditate ? (
              <p className="text-xs text-red-600">{climateForm.formState.errors.umiditate.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="climat_observatii">Observații de teren</Label>
            <Textarea id="climat_observatii" aria-label="Observații de teren" rows={3} className="agri-control w-full px-3 py-2 text-base" {...climateForm.register('observatii')} />
          </div>
        </form>
      </AppDialog>

      <AppDialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        title="Actualizează stadiu fenologic"
        footer={
          <DialogFormActions
            onCancel={() => setStageOpen(false)}
            onSave={stageForm.handleSubmit(onStageSubmit)}
            saving={createStageMutation.isPending}
            cancelLabel="Anulează"
            saveLabel="Salvează"
          />
        }
      >
        <form className="space-y-4" onSubmit={stageForm.handleSubmit(onStageSubmit)}>
          {showCohort ? (
            <div className="space-y-2">
              <Label htmlFor="cohort_select">Coortă</Label>
              <select
                id="cohort_select"
                aria-label="Coorta stadiului"
                className="agri-control h-12 w-full px-3 text-base"
                value={selectedStageCohort ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  stageForm.setValue('cohort', value ? (value as Cohorta) : undefined, { shouldValidate: true })
                }}
              >
                <option value="">Selectează cohorta</option>
                <option value="floricane">Floricane</option>
                <option value="primocane">Primocane</option>
              </select>
              {stageForm.formState.errors.cohort ? (
                <p className="text-xs text-red-600">{stageForm.formState.errors.cohort.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="stadiu_select">Stadiu</Label>
            <select id="stadiu_select" aria-label="Stadiu fenologic" className="agri-control h-12 w-full px-3 text-base" {...stageForm.register('stadiu')}>
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {stageForm.formState.errors.stadiu ? (
              <p className="text-xs text-red-600">{stageForm.formState.errors.stadiu.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stadiu_data">Data</Label>
            <Input id="stadiu_data" aria-label="Data observării stadiului" type="date" className="agri-control h-12" {...stageForm.register('data')} />
            {stageForm.formState.errors.data ? (
              <p className="text-xs text-red-600">{stageForm.formState.errors.data.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stadiu_observatii">Observații</Label>
            <Textarea id="stadiu_observatii" aria-label="Observații pentru stadiu" rows={3} className="agri-control w-full px-3 py-2 text-base" {...stageForm.register('observatii')} />
          </div>
        </form>
      </AppDialog>

      <AddCulturaDialog
        open={addCulturaOpen}
        onOpenChange={setAddCulturaOpen}
        parcelaId={parcelaId}
        tipUnitate={parcela?.tip_unitate}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.culturi(parcelaId) })
        }}
      />
    </AppShell>
  )
}
