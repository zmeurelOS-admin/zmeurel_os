'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState as BaseLoadingState } from '@/components/app/LoadingState'
import { DashboardSkeleton } from '@/components/app/ModuleSkeletons'
import { PageHeader } from '@/components/app/PageHeader'
import { WelcomeCard } from '@/components/dashboard/WelcomeCard'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import AlertCard from '@/components/ui/AlertCard'
import MiniCard from '@/components/ui/MiniCard'
import Sparkline from '@/components/ui/Sparkline'
import StatusBadge from '@/components/ui/StatusBadge'
import TrendBadge from '@/components/ui/TrendBadge'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getCheltuieli } from '@/lib/supabase/queries/cheltuieli'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { getCultureStageLogsForUnitati, getSolarClimateLogsForUnitati } from '@/lib/supabase/queries/solar-tracking'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'
import { queryKeys } from '@/lib/query-keys'

const DAY_MS = 24 * 60 * 60 * 1000

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getIsoDay(offset = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (offset !== 0) date.setTime(date.getTime() + offset * DAY_MS)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatNumber(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(fractionDigits, 1),
  }).format(value)
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(Math.round(value))
}

function formatDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate || '-'
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short' }).format(parsed)
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function toTrend(current: number, previous: number): { value: number; positive: boolean } | undefined {
  if (previous <= 0) return undefined
  const delta = ((current - previous) / previous) * 100
  return { value: Math.round(Math.abs(delta)), positive: delta >= 0 }
}

function isActiveParcela(status: string | null): boolean {
  const normalized = String(status ?? '').trim().toLowerCase()
  return !['anulat', 'inactiv', 'inactiva'].includes(normalized)
}

function isSolarTip(tipUnitate: string | null | undefined): boolean {
  return String(tipUnitate ?? '').trim().toLowerCase() === 'solar'
}

type FeedItem = {
  key: string
  icon: string
  iconBg: string
  text: string
  timestamp: string
  href: string
}

type SolarPlanItem = {
  key: string
  label: string
  value: string
  sub: string
  variant: 'success' | 'warning' | 'danger'
  href: string
}

function LoadingState({ label }: { label?: string }) {
  if (label?.toLowerCase().includes('dashboard')) {
    return <DashboardSkeleton />
  }

  return <BaseLoadingState label={label} />
}

type GuideKey = 'recoltari' | 'comenzi' | 'financiar' | 'activitati'
const GUIDE_LS_KEYS: Record<GuideKey, string> = {
  recoltari: 'dismissed_guide_recoltari',
  comenzi: 'dismissed_guide_comenzi',
  financiar: 'dismissed_guide_financiar',
  activitati: 'dismissed_guide_activitati',
}

function GuideCard({
  emoji,
  title,
  text,
  actionLabel,
  onDismiss,
  onAction,
}: {
  emoji: string
  title: string
  text: string
  actionLabel?: string
  onDismiss: () => void
  onAction?: () => void
}) {
  return (
    <div
      style={{
        position: 'relative',
        border: '1.5px dashed rgba(0,0,0,0.13)',
        borderRadius: radius.xl,
        background: 'rgba(248,250,248,0.7)',
        padding: spacing.lg,
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Ascunde"
        style={{
          position: 'absolute', top: 8, right: 8,
          border: 'none', background: 'rgba(0,0,0,0.06)',
          borderRadius: radius.full, width: 22, height: 22,
          fontWeight: 700, color: colors.gray,
          cursor: 'pointer', fontSize: 14, lineHeight: '22px',
        }}
      >×</button>
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ marginTop: spacing.sm, fontSize: 13, fontWeight: 700, color: colors.dark }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: colors.gray, lineHeight: 1.5 }}>{text}</div>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: spacing.sm,
            border: `1px solid ${colors.primary}`,
            borderRadius: radius.lg,
            background: 'transparent',
            color: colors.primary,
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    trackEvent('open_dashboard', 'dashboard')
  }, [])

  useEffect(() => {
    ;['/parcele', '/activitati-agricole', '/recoltari', '/vanzari', '/comenzi'].forEach((href) => {
      router.prefetch(href)
    })
  }, [router])

  const recoltariQuery = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    placeholderData: (previousData) => previousData,
  })

  const parceleQuery = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    placeholderData: (previousData) => previousData,
  })

  const activitatiQuery = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    placeholderData: (previousData) => previousData,
  })

  const vanzariQuery = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
    placeholderData: (previousData) => previousData,
  })

  const cheltuieliQuery = useQuery({
    queryKey: queryKeys.cheltuieli,
    queryFn: getCheltuieli,
    placeholderData: (previousData) => previousData,
  })

  const comenziQuery = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
    placeholderData: (previousData) => previousData,
  })

  const clientiQuery = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const solarParcelaIdsForQuery = useMemo(
    () => (parceleQuery.data ?? []).filter((parcela) => isSolarTip(parcela.tip_unitate)).map((parcela) => parcela.id),
    [parceleQuery.data],
  )

  const solarClimateQuery = useQuery({
    queryKey: queryKeys.solarClimate(solarParcelaIdsForQuery.join(',')),
    queryFn: () => getSolarClimateLogsForUnitati(solarParcelaIdsForQuery, 240),
    enabled: solarParcelaIdsForQuery.length > 0,
    placeholderData: (previousData) => previousData,
  })

  const solarStagesQuery = useQuery({
    queryKey: queryKeys.solarStages(solarParcelaIdsForQuery.join(',')),
    queryFn: () => getCultureStageLogsForUnitati(solarParcelaIdsForQuery, 240),
    enabled: solarParcelaIdsForQuery.length > 0,
    placeholderData: (previousData) => previousData,
  })

  const profileQuery = useQuery({
    queryKey: queryKeys.currentUserProfile,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data } = await supabase.from('profiles').select('hide_onboarding').eq('id', user.id).maybeSingle()
      return data?.hide_onboarding ?? false
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const hideOnboarding = profileQuery.data === true

  const dismissOnboardingMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ hide_onboarding: true }).eq('id', user.id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUserProfile })
    },
    onError: () => {
      toast.error('Nu am putut salva preferința.')
    },
  })

  const coreQueries = [
    recoltariQuery,
    parceleQuery,
    activitatiQuery,
    vanzariQuery,
    cheltuieliQuery,
    comenziQuery,
    clientiQuery,
  ]

  const hasResolvedCoreData = coreQueries.some((query) => query.data !== undefined)
  const isLoading = !hasResolvedCoreData && coreQueries.some((query) => query.isLoading)
  const hasError = coreQueries.some((query) => query.isError)
  const coreSettled = coreQueries.every((query) => !query.isLoading)
  const showDashboardSkeleton = isLoading && !hasError

  const errorMessage =
    (recoltariQuery.error as Error | null)?.message ||
    (parceleQuery.error as Error | null)?.message ||
    (activitatiQuery.error as Error | null)?.message ||
    (vanzariQuery.error as Error | null)?.message ||
    (cheltuieliQuery.error as Error | null)?.message ||
    (comenziQuery.error as Error | null)?.message ||
    (clientiQuery.error as Error | null)?.message

  const recoltari = recoltariQuery.data ?? []
  const parcele = parceleQuery.data ?? []
  const activitati = activitatiQuery.data ?? []
  const vanzari = vanzariQuery.data ?? []
  const cheltuieli = cheltuieliQuery.data ?? []
  const comenzi = comenziQuery.data ?? []
  const clienti = clientiQuery.data ?? []
  const solarClimateLogs = solarClimateQuery.data ?? []
  const solarStageLogs = solarStagesQuery.data ?? []
  const shouldRedirectToStart = false

  const todayIso = getIsoDay(0)
  const yesterdayIso = getIsoDay(-1)
  const recentPlantingThresholdIso = getIsoDay(-14)
  const weekDays = Array.from({ length: 7 }, (_, i) => getIsoDay(i - 6))
  const prevWeekDays = Array.from({ length: 7 }, (_, i) => getIsoDay(i - 13))
  const nowMs = useMemo(() => new Date(`${todayIso}T12:00:00`).getTime(), [todayIso])

  const activeParcele = useMemo(() => parcele.filter((p) => isActiveParcela(p.status ?? null)), [parcele])
  const solarParcele = useMemo(() => activeParcele.filter((parcela) => isSolarTip(parcela.tip_unitate)), [activeParcele])
  const solarParcelaIdSet = useMemo(() => new Set(solarParcele.map((parcela) => parcela.id)), [solarParcele])
  const parcelaById = useMemo(
    () =>
      new Map(
        activeParcele.map((p) => [
          p.id,
          {
            name: formatUnitateDisplayName(p.nume_parcela, p.tip_unitate),
            soi: p.soi_plantat || p.tip_fruct || '-',
          },
        ]),
      ),
    [activeParcele],
  )

  const recoltariAzi = useMemo(() => recoltari.filter((r) => toDateOnly(r.data) === todayIso), [recoltari, todayIso])
  const recoltariIeri = useMemo(() => recoltari.filter((r) => toDateOnly(r.data) === yesterdayIso), [recoltari, yesterdayIso])
  const totalKgAzi = recoltariAzi.reduce((sum, r) => sum + asNumber(r.kg_cal1) + asNumber(r.kg_cal2), 0)
  const totalKgIeri = recoltariIeri.reduce((sum, r) => sum + asNumber(r.kg_cal1) + asNumber(r.kg_cal2), 0)
  const recoltareTrend = toTrend(totalKgAzi, totalKgIeri)

  const comenziActive = useMemo(
    () => comenzi.filter((c) => c.status !== 'livrata' && c.status !== 'anulata'),
    [comenzi],
  )
  const comenziAzi = comenziActive.filter((c) => toDateOnly(c.data_livrare) === todayIso)
  const comenziViitoare = comenziActive.filter((c) => {
    const date = toDateOnly(c.data_livrare)
    return !!date && date > todayIso
  })
  const comenziRestante = comenziActive.filter((c) => {
    const date = toDateOnly(c.data_livrare)
    return !!date && date < todayIso
  })

  const kgComenziAzi = comenziAzi.reduce((sum, c) => sum + asNumber(c.cantitate_kg), 0)
  const kgComenziViitoare = comenziViitoare.reduce((sum, c) => sum + asNumber(c.cantitate_kg), 0)
  const kgComenziActive = comenziActive.reduce((sum, c) => sum + asNumber(c.cantitate_kg), 0)

  const activitatiAziCount = activitati.filter((a) => toDateOnly(a.data_aplicare) === todayIso).length

  const harvestedTodayIds = useMemo(() => new Set(recoltariAzi.map((r) => r.parcela_id).filter(Boolean)), [recoltariAzi])
  const unrecoltateParcele = useMemo(
    () => activeParcele.filter((p) => !harvestedTodayIds.has(p.id) && p.stadiu === 'cules'),
    [activeParcele, harvestedTodayIds],
  )

  const dismissKey = `dashboard-unrecoltate-${todayIso}`
  const [dismissed, setDismissed] = useState<string[]>([])

  const planDismissKey = `solar-plan-dismissed-${todayIso}`
  const [dismissedPlanItems, setDismissedPlanItems] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissKey)
      if (!raw) {
        setDismissed([])
        return
      }
      const parsed = JSON.parse(raw)
      setDismissed(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [])
    } catch {
      setDismissed([])
    }
  }, [dismissKey])

  const visibleUnrecoltata = unrecoltateParcele.find((p) => !dismissed.includes(p.id))

  const dismissUnrecoltata = (id: string) => {
    const next = Array.from(new Set([...dismissed, id]))
    setDismissed(next)
    try {
      localStorage.setItem(dismissKey, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(planDismissKey)
      if (!raw) { setDismissedPlanItems([]); return }
      const parsed = JSON.parse(raw) as unknown
      setDismissedPlanItems(Array.isArray(parsed) ? (parsed as unknown[]).filter((x): x is string => typeof x === 'string') : [])
    } catch {
      setDismissedPlanItems([])
    }
  }, [planDismissKey])

  const dismissPlanItem = (key: string) => {
    const next = Array.from(new Set([...dismissedPlanItems, key]))
    setDismissedPlanItems(next)
    try { localStorage.setItem(planDismissKey, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const [dismissedGuides, setDismissedGuides] = useState<Record<GuideKey, boolean>>({
    recoltari: false, comenzi: false, financiar: false, activitati: false,
  })

  useEffect(() => {
    const loaded = {} as Record<GuideKey, boolean>
    for (const key of Object.keys(GUIDE_LS_KEYS) as GuideKey[]) {
      try { loaded[key] = localStorage.getItem(GUIDE_LS_KEYS[key]) === 'true' } catch { loaded[key] = false }
    }
    setDismissedGuides(loaded)
  }, [])

  const dismissGuide = (key: GuideKey) => {
    setDismissedGuides((prev) => ({ ...prev, [key]: true }))
    try { localStorage.setItem(GUIDE_LS_KEYS[key], 'true') } catch { /* ignore */ }
  }

  const activePauseByParcela = useMemo(() => {
    const byParcela = new Map<string, { exp: string; produs: string; data: string }>()

    for (const activity of activitati) {
      const tip = String(activity.tip_activitate ?? '').toLowerCase()
      if (!tip.includes('tratament')) continue
      if (!activity.parcela_id) continue
      const pauseDays = asNumber(activity.timp_pauza_zile)
      if (pauseDays <= 0) continue

      const dateOnly = toDateOnly(activity.data_aplicare)
      const expDate = new Date(`${dateOnly}T12:00:00`)
      expDate.setDate(expDate.getDate() + pauseDays)
      const expIso = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`
      if (expIso <= todayIso) continue

      if (!byParcela.has(activity.parcela_id)) {
        byParcela.set(activity.parcela_id, {
          exp: expIso,
          produs: activity.produs_utilizat || 'produs',
          data: dateOnly,
        })
      }
    }

    return byParcela
  }, [activitati, todayIso])

  const pauseAlert = useMemo(() => {
    const first = Array.from(activePauseByParcela.entries())[0]
    if (!first) return undefined
    const [parcelaId, info] = first
    return {
      parcelaName: parcelaById.get(parcelaId)?.name || 'Parcela',
      exp: info.exp,
      produs: info.produs,
      data: info.data,
    }
  }, [activePauseByParcela, parcelaById])

  const recoltarePerParcelaAzi = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of recoltariAzi) {
      if (!row.parcela_id) continue
      const value = asNumber(row.kg_cal1) + asNumber(row.kg_cal2)
      map.set(row.parcela_id, asNumber(map.get(row.parcela_id)) + value)
    }
    return map
  }, [recoltariAzi])

  const seasonStartIso = `${new Date().getFullYear()}-03-01`

  const solarPlantTotal = solarParcele.reduce((sum, parcela) => sum + asNumber(parcela.nr_plante), 0)
  const solarHarvestAziKg = recoltariAzi
    .filter((row) => !!row.parcela_id && solarParcelaIdSet.has(row.parcela_id))
    .reduce((sum, row) => sum + asNumber(row.kg_cal1) + asNumber(row.kg_cal2), 0)
  const solarHarvestSezonKg = recoltari
    .filter((row) => {
      const day = toDateOnly(row.data)
      return !!row.parcela_id && solarParcelaIdSet.has(row.parcela_id) && day >= seasonStartIso && day <= todayIso
    })
    .reduce((sum, row) => sum + asNumber(row.kg_cal1) + asNumber(row.kg_cal2), 0)

  const recentClimateSamples = useMemo(() => {
    const recent = solarClimateLogs.filter((entry) => {
      const ts = new Date(entry.created_at).getTime()
      return Number.isFinite(ts) && nowMs - ts <= 2 * DAY_MS
    })
    if (recent.length > 0) return recent
    return solarClimateLogs.slice(0, 12)
  }, [nowMs, solarClimateLogs])

  const solarAvgTemp = useMemo(() => {
    if (recentClimateSamples.length === 0) return null
    const total = recentClimateSamples.reduce((sum, entry) => sum + asNumber(entry.temperatura), 0)
    return total / recentClimateSamples.length
  }, [recentClimateSamples])

  const solarAvgHumidity = useMemo(() => {
    if (recentClimateSamples.length === 0) return null
    const total = recentClimateSamples.reduce((sum, entry) => sum + asNumber(entry.umiditate), 0)
    return total / recentClimateSamples.length
  }, [recentClimateSamples])

  const venitSezon = vanzari
    .filter((v) => {
      const date = toDateOnly(v.data)
      return date >= seasonStartIso && date <= todayIso
    })
    .reduce((sum, v) => sum + asNumber(v.cantitate_kg) * asNumber(v.pret_lei_kg), 0)

  const costSezon = cheltuieli
    .filter((c) => {
      const date = toDateOnly(c.data)
      return date >= seasonStartIso && date <= todayIso
    })
    .reduce((sum, c) => sum + asNumber(c.suma_lei), 0)

  const profitSezon = venitSezon - costSezon

  const venitByDay = new Map<string, number>()
  for (const row of vanzari) {
    const date = toDateOnly(row.data)
    venitByDay.set(date, asNumber(venitByDay.get(date)) + asNumber(row.cantitate_kg) * asNumber(row.pret_lei_kg))
  }

  const costByDay = new Map<string, number>()
  for (const row of cheltuieli) {
    const date = toDateOnly(row.data)
    costByDay.set(date, asNumber(costByDay.get(date)) + asNumber(row.suma_lei))
  }

  const venitSeries = weekDays.map((day) => asNumber(venitByDay.get(day)))
  const costSeries = weekDays.map((day) => asNumber(costByDay.get(day)))
  const profitSeries = weekDays.map((_, index) => venitSeries[index] - costSeries[index])
  const hasSparkline = (arr: number[]) => arr.length > 1 && arr.some((v) => v !== 0)

  const venitTrend = toTrend(
    venitSeries.reduce((sum, v) => sum + v, 0),
    prevWeekDays.reduce((sum, day) => sum + asNumber(venitByDay.get(day)), 0),
  )
  const costTrend = toTrend(
    costSeries.reduce((sum, v) => sum + v, 0),
    prevWeekDays.reduce((sum, day) => sum + asNumber(costByDay.get(day)), 0),
  )
  const profitTrend = toTrend(
    profitSeries.reduce((sum, v) => sum + v, 0),
    prevWeekDays.reduce((sum, day) => sum + asNumber(venitByDay.get(day)) - asNumber(costByDay.get(day)), 0),
  )

  const orderName = (row: (typeof comenzi)[number]) => {
    const joined = String(row.client_nume ?? '').trim()
    const manual = String(row.client_nume_manual ?? '').trim()
    return joined || manual || 'Client'
  }

  const linkedOrderBySaleId = useMemo(() => {
    const map = new Map<string, (typeof comenzi)[number]>()
    for (const row of comenzi) {
      if (row.linked_vanzare_id) map.set(row.linked_vanzare_id, row)
    }
    return map
  }, [comenzi])

  const latestSolarClimateByParcela = useMemo(() => {
    const byParcela = new Map<string, (typeof solarClimateLogs)[number]>()
    for (const entry of solarClimateLogs) {
      const current = byParcela.get(entry.unitate_id)
      if (!current) {
        byParcela.set(entry.unitate_id, entry)
        continue
      }
      const currentTs = new Date(current.created_at).getTime()
      const nextTs = new Date(entry.created_at).getTime()
      if (Number.isFinite(nextTs) && nextTs > currentTs) {
        byParcela.set(entry.unitate_id, entry)
      }
    }
    return byParcela
  }, [solarClimateLogs])

  const stageCountByParcela = useMemo(() => {
    const byParcela = new Map<string, number>()
    for (const entry of solarStageLogs) {
      byParcela.set(entry.unitate_id, asNumber(byParcela.get(entry.unitate_id)) + 1)
    }
    return byParcela
  }, [solarStageLogs])

  const latestSolarActivityByParcela = useMemo(() => {
    const byParcela = new Map<string, (typeof activitati)[number]>()
    for (const activity of activitati) {
      if (!activity.parcela_id || !solarParcelaIdSet.has(activity.parcela_id)) continue
      const current = byParcela.get(activity.parcela_id)
      if (!current) {
        byParcela.set(activity.parcela_id, activity)
        continue
      }
      const currentTs = new Date(current.data_aplicare).getTime()
      const nextTs = new Date(activity.data_aplicare).getTime()
      if (Number.isFinite(nextTs) && nextTs > currentTs) {
        byParcela.set(activity.parcela_id, activity)
      }
    }
    return byParcela
  }, [activitati, solarParcelaIdSet])

  const solarPlanItems = useMemo<SolarPlanItem[]>(() => {
    if (solarParcele.length === 0) return []

    const items: SolarPlanItem[] = []

    for (const parcela of solarParcele) {
      const parcelaName = formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate, 'Solar')
      const latestClimate = latestSolarClimateByParcela.get(parcela.id)
      const latestActivity = latestSolarActivityByParcela.get(parcela.id)
      const stageCount = asNumber(stageCountByParcela.get(parcela.id))

      if (!latestClimate) {
        items.push({
          key: `climate-missing-${parcela.id}`,
          label: 'Climat neactualizat',
          value: `${parcelaName}: adaugă prima măsurătoare`,
          sub: 'Regula: fiecare solar trebuie să aibă minimum o măsurătoare de climat.',
          variant: 'warning',
          href: `/parcele/${parcela.id}`,
        })
      } else {
        const climateAgeDays = Math.floor((nowMs - new Date(latestClimate.created_at).getTime()) / DAY_MS)
        if (climateAgeDays >= 2) {
          items.push({
            key: `climate-stale-${parcela.id}`,
            label: 'Climat neactualizat',
            value: `${parcelaName}: fără update de ${climateAgeDays} zile`,
            sub: 'Regula: daca ultimul climat este mai vechi de 2 zile, cere verificare.',
            variant: 'warning',
            href: `/parcele/${parcela.id}`,
          })
        }

        const latestTemp = asNumber(latestClimate.temperatura)
        if (latestTemp >= 32) {
          items.push({
            key: `temp-high-${parcela.id}`,
            label: 'Temperatura ridicata',
            value: `${parcelaName}: ${formatNumber(latestTemp, 1)}°C`,
            sub: 'Regula: peste 32°C se recomandă aerisire și verificare irigare.',
            variant: 'danger',
            href: `/parcele/${parcela.id}`,
          })
        }
      }

      const plantingDay = toDateOnly(parcela.data_plantarii)
      if (plantingDay && plantingDay >= recentPlantingThresholdIso && stageCount === 0) {
        items.push({
          key: `stages-missing-${parcela.id}`,
          label: 'Etape cultura lipsa',
          value: `${parcelaName}: plantat recent, fără etape`,
          sub: 'Regula: daca data plantarii e in ultimele 14 zile, trebuie macar o etapa notata.',
          variant: 'warning',
          href: `/parcele/${parcela.id}`,
        })
      }

      if (!latestActivity) {
        items.push({
          key: `activity-missing-${parcela.id}`,
          label: 'Activități lipsă',
          value: `${parcelaName}: fără activități înregistrate`,
          sub: 'Regula: pentru solarii păstrăm cel puțin o activitate recentă în jurnal.',
          variant: 'warning',
          href: '/activitati-agricole',
        })
      } else {
        const activityAgeDays = Math.floor((nowMs - new Date(latestActivity.data_aplicare).getTime()) / DAY_MS)
        if (activityAgeDays >= 4) {
          items.push({
            key: `activity-stale-${parcela.id}`,
            label: 'Activitate veche',
            value: `${parcelaName}: ultima activitate acum ${activityAgeDays} zile`,
            sub: 'Regula: daca ultima activitate depaseste 4 zile, verificam planul zilnic.',
            variant: 'warning',
            href: '/activitati-agricole',
          })
        }
      }
    }

    if (items.length === 0) {
      items.push({
        key: 'solar-ok',
        label: 'Plan in grafic',
        value: 'Nu există priorități urgente în solarii',
        sub: 'Regulile simple de climat, etape și activitățile sunt acoperite azi.',
        variant: 'success',
        href: '/parcele',
      })
    }

    return items.slice(0, 6)
  }, [
    activitati,
    latestSolarActivityByParcela,
    latestSolarClimateByParcela,
    nowMs,
    recentPlantingThresholdIso,
    solarParcele,
    stageCountByParcela,
  ])

  const hasSolarWarnings = solarPlanItems.some((item) => item.variant !== 'success')

  const recentActivity = useMemo<FeedItem[]>(() => {
    const feed: FeedItem[] = []

    for (const row of recoltari) {
      const kg = asNumber(row.kg_cal1) + asNumber(row.kg_cal2)
      const parcelaName = parcelaById.get(row.parcela_id ?? '')?.name || 'Parcela'
      feed.push({
        key: `rec-${row.id}`,
        icon: '🫐',
        iconBg: colors.blueLight,
        text: `Recoltat ${formatNumber(kg)} kg — ${parcelaName}`,
        timestamp: row.created_at || `${toDateOnly(row.data)}T00:00:00`,
        href: '/recoltari',
      })
    }

    for (const row of vanzari) {
      const linked = linkedOrderBySaleId.get(row.id)
      feed.push({
        key: `van-${row.id}`,
        icon: '💰',
        iconBg: colors.greenLight,
        text: `Vândut ${formatNumber(asNumber(row.cantitate_kg))} kg → ${linked ? orderName(linked) : 'Client'}`,
        timestamp: row.created_at || `${toDateOnly(row.data)}T00:00:00`,
        href: '/vanzari',
      })
    }

    for (const row of activitati) {
      const parcelaName = parcelaById.get(row.parcela_id ?? '')?.name || 'Parcela'
      feed.push({
        key: `act-${row.id}`,
        icon: '✂️',
        iconBg: colors.yellowLight,
        text: `${row.tip_activitate || 'Activitate'} — ${parcelaName}`,
        timestamp: row.created_at || `${toDateOnly(row.data_aplicare)}T00:00:00`,
        href: '/activitati-agricole',
      })
    }

    for (const row of comenzi.filter((c) => c.status === 'livrata')) {
      feed.push({
        key: `com-${row.id}`,
        icon: '📦',
        iconBg: colors.coralLight,
        text: `Livrat ${formatNumber(asNumber(row.cantitate_kg))} kg → ${orderName(row)}`,
        timestamp: row.updated_at || row.created_at || `${toDateOnly(row.data_livrare || row.data_comanda)}T00:00:00`,
        href: '/comenzi?add=1',
      })
    }

    return feed
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
  }, [activitati, comenzi, linkedOrderBySaleId, parcelaById, recoltari, vanzari])

  const showWelcomeCard = coreSettled && parcele.length === 0 && !hideOnboarding
  const emptyState = coreSettled && activeParcele.length === 0

  const hasAnyRecoltari = recoltari.length > 0
  const hasAnyComenzi = comenzi.length > 0
  const hasAnyActivitati = activitati.length > 0
  const hasAnyFinanciar = vanzari.length > 0 || cheltuieli.length > 0
  const hasAnyTopStats = hasAnyRecoltari || hasAnyComenzi || hasAnyActivitati
  const hasAlerts = Boolean(visibleUnrecoltata) || comenziRestante.length > 0 || Boolean(pauseAlert)
  const todayPlanSummary = `${formatCountLabel(activitatiAziCount, 'activitate', 'activități')} • ${formatCountLabel(comenziAzi.length, 'livrare', 'livrări')}`

  return (
    <AppShell
      header={
        <PageHeader
          title="Dashboard"
          subtitle="Planul de azi"
          summary={
            <div className="lg:hidden">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                  borderRadius: radius.xl,
                  border: `1px solid rgba(15, 23, 42, 0.06)`,
                  background: 'rgba(255,255,255,0.96)',
                  boxShadow: shadows.card,
                  padding: 14,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark, lineHeight: 1.2 }}>Plan azi</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(16,32,21,0.72)', lineHeight: 1.3 }}>
                    {todayPlanSummary}
                  </div>
                </div>
              </div>
            </div>
          }
        />
      }
    >
      <div className="mx-auto mt-3 w-full max-w-[980px] sm:mt-0 lg:max-w-[1360px]" style={{ paddingTop: spacing.lg, paddingBottom: spacing.md }}>
        {hasError ? <ErrorState title="Eroare dashboard" message={errorMessage ?? 'Nu am putut încărca datele.'} /> : null}
        {isLoading ? <LoadingState label="Se încarcă dashboard..." /> : null}

        {!showDashboardSkeleton && shouldRedirectToStart ? (
          <LoadingState label="Se pregătește onboarding..." />
        ) : null}

        {!showDashboardSkeleton && !shouldRedirectToStart ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {showWelcomeCard ? (
              <WelcomeCard
                onAddTerrain={() => router.push('/parcele')}
                onDismiss={() => dismissOnboardingMutation.mutate()}
              />
            ) : null}

            {emptyState ? null : (
              <>
                {hasAnyTopStats ? (
                  <section data-tutorial="dashboard-stats">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      {hasAnyRecoltari ? (
                        <MiniCard
                          icon="🫐"
                          label="Recoltat azi"
                          value={`${formatNumber(totalKgAzi)} kg`}
                          sub={`${recoltariAzi.length} recoltări`}
                          trend={recoltareTrend}
                          onClick={() => router.push('/recoltari')}
                        />
                      ) : null}
                      {hasAnyComenzi ? (
                        <MiniCard
                          icon="📦"
                          label="De livrat"
                          value={`${comenziActive.length}`}
                          sub={`${formatNumber(kgComenziActive)} kg`}
                          onClick={() => router.push('/comenzi')}
                        />
                      ) : null}
                      {hasAnyActivitati ? (
                        <MiniCard
                          icon="✂️"
                          label="Activități"
                          value={`${activitatiAziCount}`}
                          sub="azi"
                          className="col-span-2 sm:col-span-1"
                          onClick={() => router.push('/activitati-agricole')}
                        />
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {solarParcele.length > 0 ? (
                  <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    <SectionTitle
                      title="Solarii"
                      rightSlot={
                        <StatusBadge
                          text={`${solarParcele.length} ${solarParcele.length === 1 ? 'activă' : 'active'}`}
                          variant="success"
                        />
                      }
                    />

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <MiniCard
                        icon="🌿"
                        label="Număr solarii"
                        value={`${solarParcele.length}`}
                        sub="unități de tip solar"
                        onClick={() => router.push('/parcele')}
                      />
                      <MiniCard
                        icon="🪴"
                        label="Plante totale"
                        value={`${formatNumber(solarPlantTotal, 0)}`}
                        sub="plante în solarii"
                        onClick={() => router.push('/parcele')}
                      />
                      <MiniCard
                        icon="🧺"
                        label="Recoltat azi"
                        value={`${formatNumber(solarHarvestAziKg)} kg`}
                        sub="din solarii"
                        onClick={() => router.push('/recoltari')}
                      />
                      <MiniCard
                        icon="📈"
                        label="Sezon solarii"
                        value={`${formatNumber(solarHarvestSezonKg)} kg`}
                        sub={`de la ${formatDateLabel(seasonStartIso)}`}
                        onClick={() => router.push('/recoltari')}
                      />
                      <MiniCard
                        icon="🌡️"
                        label="Temp. medie recentă"
                        value={solarAvgTemp === null ? '-' : `${formatNumber(solarAvgTemp, 1)}°C`}
                        sub={
                          solarClimateQuery.isLoading
                            ? 'se încarcă climatul...'
                            : recentClimateSamples.length > 0
                              ? `${recentClimateSamples.length} înregistrări`
                              : 'fără date climat'
                        }
                        onClick={() => router.push('/parcele')}
                      />
                      <MiniCard
                        icon="💧"
                        label="Umiditate medie"
                        value={solarAvgHumidity === null ? '-' : `${formatNumber(solarAvgHumidity, 0)}%`}
                        sub={
                          solarClimateQuery.isLoading
                            ? 'se încarcă climatul...'
                            : recentClimateSamples.length > 0
                              ? 'fereastră recentă'
                              : 'fără date climat'
                        }
                        onClick={() => router.push('/parcele')}
                      />
                    </div>
                  </section>
                ) : null}

                {solarParcele.length > 0 ? (
                  <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <SectionTitle className="flex-1" title="Planul zilei în solarii" />
                      <StatusBadge text={hasSolarWarnings ? 'priorități' : 'ok'} variant={hasSolarWarnings ? 'warning' : 'success'} />
                    </div>

                    {solarStagesQuery.isError || solarClimateQuery.isError ? (
                      <AlertCard
                        icon="⚠️"
                        label="Date parțiale"
                        value="Nu am putut încărca toate datele pentru solarii"
                        sub="Planul zilei folosește doar datele disponibile momentan."
                        variant="warning"
                        onClick={() => router.push('/parcele')}
                      />
                    ) : null}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                      {solarPlanItems.filter((item) => !dismissedPlanItems.includes(item.key)).map((item) => (
                        <div key={item.key} style={{ position: 'relative' }}>
                          {item.variant !== 'success' ? (
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); dismissPlanItem(item.key) }}
                              aria-label="Ascunde alerta"
                              style={{
                                position: 'absolute', top: 6, right: 6,
                                border: 'none', background: 'rgba(255,255,255,0.85)',
                                borderRadius: radius.full, width: 22, height: 22,
                                fontWeight: 700, color: colors.gray,
                                cursor: 'pointer', zIndex: 2, fontSize: 14, lineHeight: '22px',
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                          <AlertCard
                            icon={item.variant === 'danger' ? '🔥' : item.variant === 'warning' ? '⚠️' : '✅'}
                            label={item.label}
                            value={item.value}
                            sub={item.sub}
                            variant={item.variant}
                            onClick={() => router.push(item.href)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {hasAlerts ? (
                  <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <SectionTitle className="flex-1" title="Alerte" />
                      <StatusBadge text="active" variant="warning" />
                    </div>

                    {visibleUnrecoltata ? (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            dismissUnrecoltata(visibleUnrecoltata.id)
                          }}
                          aria-label="Dismiss"
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            border: 'none',
                            background: colors.white,
                            borderRadius: radius.full,
                            width: 22,
                            height: 22,
                            fontWeight: 700,
                            color: colors.coral,
                            cursor: 'pointer',
                            zIndex: 2,
                          }}
                        >
                          ×
                        </button>
                        <AlertCard
                          icon="⚠️"
                          label="Terenuri nerecoltate"
                          value={`${formatUnitateDisplayName(visibleUnrecoltata.nume_parcela, visibleUnrecoltata.tip_unitate, 'Parcela')} — nerecoltat azi`}
                          sub={`${unrecoltateParcele.length} terenuri active fără recoltare azi`}
                          variant="danger"
                          onClick={() => router.push('/recoltari')}
                        />
                      </div>
                    ) : null}

                    {comenziRestante.length > 0 ? (
                      <AlertCard
                        icon="⚠️"
                        label="Comenzi restante"
                        value={`${comenziRestante.length} comenzi restante`}
                        sub="Au depășit data de livrare"
                        variant="warning"
                        onClick={() => router.push('/comenzi')}
                      />
                    ) : null}

                    {pauseAlert ? (
                      <AlertCard
                        icon="⚠️"
                        label="Timp pauză activ"
                        value={`${pauseAlert.parcelaName} — pauză până ${formatDateLabel(pauseAlert.exp)}`}
                        sub={`${pauseAlert.produs} aplicat pe ${formatDateLabel(pauseAlert.data)}`}
                        variant="warning"
                        onClick={() => router.push('/activitati-agricole')}
                      />
                    ) : null}
                  </section>
                ) : null}

                <div className="lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] lg:gap-4">
                {!hasAnyRecoltari && !dismissedGuides.recoltari ? (
                  <GuideCard
                    emoji="🫐"
                    title="Înregistrează prima recoltare"
                    text="Adaugă zilnic cantitățile recoltate pe fiecare teren. Vei vedea evoluția producției și statistici în timp real."
                    actionLabel="Mergi la Recoltare →"
                    onDismiss={() => dismissGuide('recoltari')}
                    onAction={() => router.push('/recoltari')}
                  />
                ) : null}

                {hasAnyRecoltari ? (
                <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionTitle className="flex-1" title="Recoltare azi pe terenuri" />
                    <button
                      type="button"
                      onClick={() => router.push('/recoltari')}
                      style={{ border: 'none', background: 'transparent', color: colors.primary, fontSize: 12, fontWeight: 700 }}
                    >
                      Vezi tot →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {activeParcele.map((parcela) => {
                      const kg = asNumber(recoltarePerParcelaAzi.get(parcela.id))
                      const harvested = kg > 0
                      return (
                        <button
                          key={parcela.id}
                          type="button"
                          onClick={() => router.push(`/recoltari?parcela=${parcela.id}`)}
                          style={{
                            textAlign: 'left',
                            borderRadius: radius.lg,
                            border: `1px solid ${harvested ? colors.green : colors.grayLight}`,
                            background: harvested ? colors.greenLight : colors.grayLight,
                            boxShadow: shadows.card,
                            padding: spacing.md,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>
                            {formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate)}
                          </div>
                          <div style={{ fontSize: 10, color: colors.gray, marginTop: 2 }}>{parcela.soi_plantat || '-'}</div>
                          <div style={{ marginTop: spacing.sm, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: 20, fontWeight: 700, color: harvested ? colors.green : colors.dark }}>
                              {formatNumber(kg)}
                            </span>
                            <span style={{ fontSize: 10, color: colors.gray }}>kg</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
                ) : null}

                {!hasAnyFinanciar && !dismissedGuides.financiar ? (
                  <GuideCard
                    emoji="💰"
                    title="Urmărește veniturile și cheltuielile"
                    text="Adaugă vânzări și cheltuieli pentru a vedea profitul fermei, evoluția financiară și rapoarte pe sezoane."
                    actionLabel="Mergi la Vânzări →"
                    onDismiss={() => dismissGuide('financiar')}
                    onAction={() => router.push('/vanzari')}
                  />
                ) : null}

                {hasAnyFinanciar ? (
                <section data-tutorial="dashboard-comenzi" style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionTitle className="flex-1" title="Financiar sezon" />
                    <button
                      type="button"
                      onClick={() => router.push('/rapoarte')}
                      style={{ border: 'none', background: 'transparent', color: colors.primary, fontSize: 12, fontWeight: 700 }}
                    >
                      Rapoarte →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      { key: 'venit', label: 'Venit', value: venitSezon, series: venitSeries, color: colors.green, trend: venitTrend },
                      { key: 'cost', label: 'Cheltuieli', value: costSezon, series: costSeries, color: colors.coral, trend: costTrend },
                      { key: 'profit', label: 'Profit', value: profitSezon, series: profitSeries, color: colors.primary, trend: profitTrend },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={item.key === 'profit' ? 'col-span-2 sm:col-span-1' : undefined}
                        onClick={() => router.push('/rapoarte')}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: colors.white,
                          border: `1px solid ${colors.grayLight}`,
                          borderRadius: radius.xl,
                          boxShadow: shadows.card,
                          padding: 14,
                          minHeight: 98,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: colors.gray }}>{item.label}</span>
                          {item.trend ? <TrendBadge value={item.trend.value} positive={item.trend.positive} /> : null}
                        </div>
                        <div style={{ marginTop: spacing.xs, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 16,
                              lineHeight: 1.1,
                              fontWeight: 700,
                              color: item.key === 'profit' ? (item.value >= 0 ? colors.green : colors.coral) : colors.dark,
                            }}
                          >
                            {formatMoney(item.value)}
                          </span>
                          <span style={{ fontSize: 9, color: colors.gray }}>RON</span>
                        </div>
                        {hasSparkline(item.series) ? (
                          <div style={{ marginTop: spacing.sm }}>
                            <Sparkline data={item.series} color={item.color} width={64} height={22} />
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
                ) : null}

                {!hasAnyComenzi && !dismissedGuides.comenzi ? (
                  <GuideCard
                    emoji="📦"
                    title="Gestionează comenzile clienților"
                    text="Înregistrează comenzile și urmărește livrările. Vei vedea ce ai de livrat azi, mâine și în zilele următoare."
                    actionLabel="Mergi la Comenzi →"
                    onDismiss={() => dismissGuide('comenzi')}
                    onAction={() => router.push('/comenzi')}
                  />
                ) : null}

                {hasAnyComenzi ? (
                <section style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionTitle className="flex-1" title="Comenzi de livrat" />
                    <button
                      type="button"
                      onClick={() => router.push('/comenzi')}
                      style={{ border: 'none', background: 'transparent', color: colors.primary, fontSize: 12, fontWeight: 700 }}
                    >
                      Toate →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => router.push('/comenzi?filter=azi')}
                      style={{
                        textAlign: 'left',
                        border: `1px solid ${comenziAzi.length > 0 ? colors.coral : colors.gray}`,
                        borderLeft: `4px solid ${comenziAzi.length > 0 ? colors.coral : colors.gray}`,
                        background: comenziAzi.length > 0 ? colors.coralLight : colors.grayLight,
                        borderRadius: radius.xl,
                        boxShadow: shadows.card,
                        padding: spacing.lg,
                        minHeight: 110,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: comenziAzi.length > 0 ? colors.coral : colors.gray }}>AZI</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: colors.dark, lineHeight: 1 }}>{comenziAzi.length}</div>
                      <div style={{ fontSize: 12, color: colors.gray }}>{formatNumber(kgComenziAzi)} kg</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/comenzi?filter=viitoare')}
                      style={{
                        textAlign: 'left',
                        border: `1px solid ${colors.yellow}`,
                        borderLeft: `4px solid ${colors.yellow}`,
                        background: colors.yellowLight,
                        borderRadius: radius.xl,
                        boxShadow: shadows.card,
                        padding: spacing.lg,
                        minHeight: 110,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: colors.dark }}>VIITOARE</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: colors.dark, lineHeight: 1 }}>{comenziViitoare.length}</div>
                      <div style={{ fontSize: 12, color: colors.gray }}>{formatNumber(kgComenziViitoare)} kg</div>
                    </button>
                  </div>
                </section>
                ) : null}

                {!hasAnyActivitati && !dismissedGuides.activitati ? (
                  <GuideCard
                    emoji="✂️"
                    title="Planifică activitățile agricole"
                    text="Înregistrează tăierile, tratamentele, fertilizările și alte lucrări. Vei putea urmări istoricul și timpii de pauză."
                    actionLabel="Mergi la Activități →"
                    onDismiss={() => dismissGuide('activitati')}
                    onAction={() => router.push('/activitati-agricole')}
                  />
                ) : null}

                {recentActivity.length > 0 ? (
                  <section className="lg:self-start" style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    <SectionTitle title="Activitate recentă" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                      {recentActivity.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => router.push(item.href)}
                          style={{
                            width: '100%',
                            border: `1px solid ${colors.grayLight}`,
                            background: colors.white,
                            borderRadius: radius.lg,
                            boxShadow: shadows.card,
                            padding: spacing.sm,
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.sm,
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: radius.md,
                              background: item.iconBg,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            {item.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: colors.dark,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.text}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 10, color: colors.gray }}>{formatTimestamp(item.timestamp)}</div>
                          </div>
                          <div style={{ fontSize: 20, color: colors.gray, lineHeight: 1 }}>›</div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
