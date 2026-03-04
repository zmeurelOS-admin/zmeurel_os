'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  ClipboardList,
  Coins,
  MapPinned,
  Package,
  Scale,
  ShoppingBasket,
  Sprout,
  Tractor,
} from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { AlertCard } from '@/components/app/AlertCard'
import { BaseCard } from '@/components/app/BaseCard'
import { ErrorState } from '@/components/app/ErrorState'
import { FeatureGate } from '@/components/app/FeatureGate'
import { KpiCard, KpiCardSkeleton } from '@/components/app/KpiCard'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { FinanciarAziCard } from '@/components/dashboard/FinanciarAziCard'
import { ProductieAziCard } from '@/components/dashboard/ProductieAziCard'
import { RecentActivityCard, type RecentActivityItem } from '@/components/dashboard/RecentActivityCard'
import { generateSmartAlerts } from '@/lib/alerts/engine'
import { trackEvent } from '@/lib/analytics/trackEvent'
import {
  dismissAlert,
  dismissAlertsBulk,
  getAlertContext,
  getTodayDismissals,
} from '@/lib/supabase/queries/alertDismissals'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getCheltuieli } from '@/lib/supabase/queries/cheltuieli'
import { getClienti } from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { getStocGlobal } from '@/lib/supabase/queries/stoc'
import { getVanzari } from '@/lib/supabase/queries/vanzari'

const PRICE_PER_KG_ESTIMATE = 18
const LABOR_COST_PER_KG = 3

type DashboardActionItem = {
  id: string
  tone: 'danger' | 'warning' | 'info'
  text: string
  href: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(value)
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

export default function DashboardPage() {
  const [enableSecondaryQueries, setEnableSecondaryQueries] = useState(false)
  const [optimisticDismissedKeys, setOptimisticDismissedKeys] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  useEffect(() => {
    trackEvent('open_dashboard', 'dashboard')

    const timer = window.setTimeout(() => {
      setEnableSecondaryQueries(true)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [])

  const recoltariQuery = useQuery({
    queryKey: ['dashboard', 'recoltari'],
    queryFn: getRecoltari,
  })

  const parceleQuery = useQuery({
    queryKey: ['dashboard', 'parcele'],
    queryFn: getParcele,
    enabled: enableSecondaryQueries,
  })

  const activitatiQuery = useQuery({
    queryKey: ['dashboard', 'activitati'],
    queryFn: getActivitatiAgricole,
    enabled: enableSecondaryQueries,
  })

  const vanzariQuery = useQuery({
    queryKey: ['dashboard', 'vanzari'],
    queryFn: getVanzari,
    enabled: enableSecondaryQueries,
  })

  const cheltuieliQuery = useQuery({
    queryKey: ['dashboard', 'cheltuieli'],
    queryFn: getCheltuieli,
    enabled: enableSecondaryQueries,
  })

  const comenziQuery = useQuery({
    queryKey: ['dashboard', 'comenzi'],
    queryFn: getComenzi,
    enabled: enableSecondaryQueries,
  })

  const clientiQuery = useQuery({
    queryKey: ['dashboard', 'clienti'],
    queryFn: getClienti,
    enabled: enableSecondaryQueries,
  })

  const stocGlobalQuery = useQuery({
    queryKey: ['dashboard', 'stoc-global'],
    queryFn: getStocGlobal,
    enabled: enableSecondaryQueries,
  })

  const alertContextQuery = useQuery({
    queryKey: ['dashboard', 'alert-context'],
    queryFn: getAlertContext,
  })

  const isLoading = recoltariQuery.isLoading
  const hasError =
    recoltariQuery.isError ||
    parceleQuery.isError ||
    activitatiQuery.isError ||
    vanzariQuery.isError ||
    cheltuieliQuery.isError ||
    comenziQuery.isError ||
    clientiQuery.isError ||
    stocGlobalQuery.isError

  const errorMessage =
    (recoltariQuery.error as Error | null)?.message ||
    (parceleQuery.error as Error | null)?.message ||
    (activitatiQuery.error as Error | null)?.message ||
    (vanzariQuery.error as Error | null)?.message ||
    (cheltuieliQuery.error as Error | null)?.message ||
    (comenziQuery.error as Error | null)?.message ||
    (clientiQuery.error as Error | null)?.message ||
    (stocGlobalQuery.error as Error | null)?.message

  const recoltari = recoltariQuery.data ?? []
  const parcele = parceleQuery.data ?? []
  const activitati = activitatiQuery.data ?? []
  const vanzari = vanzariQuery.data ?? []
  const cheltuieli = cheltuieliQuery.data ?? []
  const comenzi = comenziQuery.data ?? []
  const clienti = clientiQuery.data ?? []
  const stocGlobal = stocGlobalQuery.data ?? { cal1: 0, cal2: 0 }
  const fallbackTenantId =
    recoltari.find((item) => item.tenant_id)?.tenant_id ??
    parcele.find((item) => item.tenant_id)?.tenant_id ??
    activitati.find((item) => item.tenant_id)?.tenant_id ??
    vanzari.find((item) => item.tenant_id)?.tenant_id ??
    cheltuieli.find((item) => item.tenant_id)?.tenant_id ??
    comenzi.find((item) => item.tenant_id)?.tenant_id ??
    clienti.find((item) => item.tenant_id)?.tenant_id ??
    null
  const activeTenantId = alertContextQuery.data?.tenantId ?? fallbackTenantId

  const dismissalsQuery = useQuery({
    queryKey: ['dashboard', 'alert-dismissals', activeTenantId],
    queryFn: () => getTodayDismissals(activeTenantId!),
    enabled: Boolean(activeTenantId),
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const recoltariAzi = recoltari.filter((r) => toDateOnly(r.data) === todayIso)
  const cal1Azi = recoltariAzi.reduce((sum, r) => sum + Number(r.kg_cal1 || 0), 0)
  const cal2Azi = recoltariAzi.reduce((sum, r) => sum + Number(r.kg_cal2 || 0), 0)
  const kgAzi = cal1Azi + cal2Azi

  const venitEstimat = kgAzi * PRICE_PER_KG_ESTIMATE
  const costMunca = kgAzi * LABOR_COST_PER_KG
  const parceleActive = parcele.filter((p) => p.status !== 'anulat').length
  const lucrariProgramate = activitati.filter((a) => {
    if (!a.data_aplicare) return false
    const date = new Date(a.data_aplicare)
    date.setHours(0, 0, 0, 0)
    return date >= today
  }).length

  const seasonStartIso = `${today.getFullYear()}-03-01`
  const seasonEndIso = todayIso

  const venitSezon = vanzari
    .filter((v) => {
      const rowDate = toDateOnly(v.data)
      return rowDate >= seasonStartIso && rowDate <= seasonEndIso
    })
    .reduce((sum, row) => sum + Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0), 0)

  const costSezon = cheltuieli
    .filter((c) => {
      const rowDate = toDateOnly(c.data)
      return rowDate >= seasonStartIso && rowDate <= seasonEndIso
    })
    .reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)

  const profitSezon = venitSezon - costSezon
  const marjaSezon = venitSezon > 0 ? (profitSezon / venitSezon) * 100 : 0
  const kgLivrateAzi = vanzari
    .filter((v) => toDateOnly(v.data) === todayIso)
    .reduce((sum, row) => sum + Number(row.cantitate_kg || 0), 0)
  const venitAzi = vanzari
    .filter((v) => toDateOnly(v.data) === todayIso)
    .reduce((sum, row) => sum + Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0), 0)
  const cheltuieliAzi = cheltuieli
    .filter((c) => toDateOnly(c.data) === todayIso)
    .reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)
  const profitAzi = venitAzi - cheltuieliAzi

  const comenziAzi = comenzi.filter((c) => c.data_livrare === todayIso && c.status !== 'livrata' && c.status !== 'anulata')
  const comenziAziCount = comenziAzi.length
  const kgDeLivratAzi = comenziAzi.reduce((sum, c) => sum + Number(c.cantitate_kg || 0), 0)
  const restanteCount = comenzi.filter((c) => {
    if (!c.data_livrare) return false
    const date = new Date(c.data_livrare)
    date.setHours(0, 0, 0, 0)
    return date < today && c.status !== 'livrata' && c.status !== 'anulata'
  }).length

  const comenziViitoareByDateMap = comenzi.reduce<Record<string, number>>((acc, c) => {
    if (!c.data_livrare) return acc
    if (c.data_livrare <= todayIso) return acc
    if (c.status === 'livrata' || c.status === 'anulata') return acc
    acc[c.data_livrare] = (acc[c.data_livrare] ?? 0) + Number(c.cantitate_kg || 0)
    return acc
  }, {})

  const comenziViitoareSummary = Object.entries(comenziViitoareByDateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 2)
    .map(([date, kg]) => `${new Date(date).toLocaleDateString('ro-RO')}: ${kg.toFixed(1)} kg`)
    .join(' | ')
  const comenziActiveCount = comenzi.filter((c) => c.status !== 'livrata' && c.status !== 'anulata').length

  const getComandaClientName = (comanda: (typeof comenzi)[number]) =>
    comanda.client_nume || comanda.client_nume_manual || 'Client'

  const restanteComenzi = comenzi
    .filter((c) => {
      if (!c.data_livrare) return false
      const date = new Date(c.data_livrare)
      date.setHours(0, 0, 0, 0)
      return date < today && c.status !== 'livrata' && c.status !== 'anulata'
    })
    .sort((a, b) => (a.data_livrare ?? '').localeCompare(b.data_livrare ?? ''))

  const comenziDePregatit = comenzi
    .filter((c) => c.data_livrare && c.data_livrare > todayIso && c.status !== 'livrata' && c.status !== 'anulata')
    .sort((a, b) => (a.data_livrare ?? '').localeCompare(b.data_livrare ?? ''))

  const tratamenteActive = activitati
    .filter((activity) => Number(activity.timp_pauza_zile ?? 0) > 0)
    .map((activity) => {
      const applyDate = new Date(activity.data_aplicare)
      applyDate.setHours(0, 0, 0, 0)
      const pauseEnd = new Date(applyDate)
      pauseEnd.setDate(pauseEnd.getDate() + Number(activity.timp_pauza_zile ?? 0))
      pauseEnd.setHours(0, 0, 0, 0)
      const remainingDays = Math.ceil((pauseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { activity, remainingDays }
    })
    .filter((item) => item.remainingDays > 0)
    .sort((a, b) => a.remainingDays - b.remainingDays)

  const actionItems: DashboardActionItem[] = [
    ...restanteComenzi.slice(0, 2).map((comanda) => ({
      id: `restanta-${comanda.id}`,
      tone: 'danger' as const,
      text: `Comanda restanta: ${getComandaClientName(comanda)}, ${Number(comanda.cantitate_kg || 0).toFixed(1)} kg ? livreaza azi`,
      href: '/comenzi',
    })),
    ...tratamenteActive.slice(0, 2).map(({ activity, remainingDays }) => ({
      id: `tratament-${activity.id}`,
      tone: 'warning' as const,
      text: `Tratament ${activity.tip_activitate ?? 'activ'} expira in ${remainingDays} zile`,
      href: '/activitati-agricole',
    })),
    ...comenziDePregatit.slice(0, 2).map((comanda) => ({
      id: `pregatit-${comanda.id}`,
      tone: 'info' as const,
      text: `Comanda de pregatit: ${getComandaClientName(comanda)}, ${Number(comanda.cantitate_kg || 0).toFixed(1)} kg ? ${new Date(comanda.data_livrare as string).toLocaleDateString('ro-RO')}`,
      href: '/comenzi',
    })),
  ]

  const alerts = generateSmartAlerts({
    today,
    recoltari,
    vanzari,
    cheltuieli,
    activitati,
    parcele: parcele.map((parcela) => ({
      id: parcela.id,
      nume_parcela: parcela.nume_parcela,
    })),
  })

  const dismissedKeys = new Set(dismissalsQuery.data ?? [])
  const filteredAlerts = alerts.filter(
    (alert) => !dismissedKeys.has(alert.alertKey) && !optimisticDismissedKeys.has(alert.alertKey)
  )
  const recentActivityItems: RecentActivityItem[] = [
    ...recoltari.slice(0, 4).map((row) => ({
      id: `recoltare-${row.id}`,
      type: 'recoltare' as const,
      description: 'Recoltare adaugata',
      timestamp: row.created_at || row.data,
    })),
    ...cheltuieli.slice(0, 4).map((row) => ({
      id: `cheltuiala-${row.id}`,
      type: 'cheltuiala' as const,
      description: 'Cheltuiala inregistrata',
      timestamp: row.created_at || row.data,
    })),
    ...comenzi.slice(0, 4).map((row) => ({
      id: `comanda-${row.id}`,
      type: 'comanda' as const,
      description: 'Comanda noua',
      timestamp: row.created_at || row.data_comanda || '',
    })),
    ...clienti.slice(0, 4).map((row) => ({
      id: `client-${row.id}`,
      type: 'client' as const,
      description: 'Client nou',
      timestamp: row.created_at || row.updated_at || '',
    })),
  ]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 6)

  const dismissAlertMutation = useMutation({
    mutationFn: (alertKey: string) => {
      const tenantId = activeTenantId
      if (!tenantId) throw new Error('Tenant context missing')
      return dismissAlert(tenantId, alertKey)
    },
    onSuccess: () => {
      toast.success('Ascuns pentru azi')
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'alert-dismissals'] })
    },
    onError: (error, alertKey) => {
      setOptimisticDismissedKeys((prev) => {
        const next = new Set(prev)
        next.delete(alertKey)
        return next
      })
      const message = (error as { message?: string } | null)?.message
      toast.error(message ? `Nu am putut ascunde alerta: ${message}` : 'Nu am putut ascunde alerta.')
    },
  })

  const dismissAllMutation = useMutation({
    mutationFn: (alertKeys: string[]) => {
      const tenantId = activeTenantId
      if (!tenantId) throw new Error('Tenant context missing')
      return dismissAlertsBulk(tenantId, alertKeys)
    },
    onSuccess: () => {
      toast.success('Alertele au fost ascunse pentru azi')
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'alert-dismissals'] })
    },
    onError: (error, alertKeys) => {
      setOptimisticDismissedKeys((prev) => {
        const next = new Set(prev)
        alertKeys.forEach((key) => next.delete(key))
        return next
      })
      const message = (error as { message?: string } | null)?.message
      toast.error(message ? `Nu am putut ascunde toate alertele: ${message}` : 'Nu am putut ascunde toate alertele.')
    },
  })

  return (
    <AppShell
      header={
        <PageHeader
          title="Dashboard"
          subtitle="Metrici cheie pentru ziua curenta"
          rightSlot={<Sprout className="h-6 w-6" />}
        />
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-4 py-4 lg:mx-auto lg:max-w-7xl lg:space-y-6 xl:max-w-screen-xl xl:space-y-8">`n        {hasError ? <ErrorState title="Eroare dashboard" message={errorMessage ?? 'Nu am putut incarca datele.'} /> : null}
        {isLoading ? <LoadingState label="Se incarca metricile..." /> : null}

        {!isLoading && !hasError ? (
          <div className="space-y-4 lg:hidden">
            <section className="rounded-xl border border-[var(--agri-border)] bg-white shadow-sm">
              <div className="grid grid-cols-2">
                {[
                  { key: 'cules', label: 'Cules azi', value: `${kgAzi.toFixed(1)} kg`, icon: Scale },
                  { key: 'livrat', label: 'Livrat azi', value: `${kgLivrateAzi.toFixed(1)} kg`, icon: Package },
                  { key: 'venit', label: 'Venit azi', value: formatCurrency(venitAzi), icon: Banknote },
                  { key: 'comenzi', label: 'Comenzi active', value: String(comenziActiveCount), icon: ClipboardList },
                ].map((item, index) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.key}
                      className={`px-4 py-3 ${index % 2 === 0 ? 'border-r border-[var(--agri-border)]' : ''} ${index < 2 ? 'border-b border-[var(--agri-border)]' : ''}`}
                    >
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      <p className={`text-xl font-bold leading-none ${item.key === 'venit' ? 'value-money-positive' : item.key === 'comenzi' ? 'text-[var(--agri-text)]' : 'value-kg'}`}>{item.value}</p>
                    </div>
                  )
                })}
              </div>
            </section>

            {actionItems.length > 0 ? (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--agri-text)]">De facut</h2>
                  <span className="rounded-full bg-[var(--agri-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--agri-text-muted)]">
                    {actionItems.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-[var(--agri-border)] bg-white shadow-sm">
                  {actionItems.map((item, index) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center gap-2 px-4 py-2 text-sm text-[var(--agri-text)] ${index > 0 ? 'border-t border-[var(--agri-border)]' : ''}`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          item.tone === 'danger'
                            ? 'bg-red-500'
                            : item.tone === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                        }`}
                      />
                      <span className="line-clamp-2">{item.text}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--agri-text)]">Profit sezon {today.getFullYear()}</h2>
              <div className="rounded-xl border border-[var(--agri-border)] bg-white shadow-sm">
                <div className="grid grid-cols-2">
                  {[
                    { key: 'venit', label: 'Venit', value: formatCurrency(venitSezon) },
                    { key: 'cost', label: 'Cost', value: formatCurrency(costSezon) },
                    { key: 'profit', label: 'Profit', value: formatCurrency(profitSezon) },
                    { key: 'marja', label: 'Marja', value: `${marjaSezon.toFixed(1)}%` },
                  ].map((item, index) => (
                    <div
                      key={item.key}
                      className={`px-4 py-3 ${index % 2 === 0 ? 'border-r border-[var(--agri-border)]' : ''} ${index < 2 ? 'border-b border-[var(--agri-border)]' : ''}`}
                    >
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className={`mt-1 text-base font-bold leading-none ${item.key === 'cost' ? 'value-money-negative' : item.key === 'marja' ? (marjaSezon < 0 ? 'value-money-negative' : 'value-money-positive') : item.key === 'profit' ? (profitSezon < 0 ? 'value-money-negative' : 'value-money-positive') : 'value-money-positive'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <div className="hidden lg:block space-y-4 lg:space-y-6 xl:space-y-8">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-6 xl:gap-5">
            {isLoading
              ? Array.from({ length: 14 }).map((_, index) => <KpiCardSkeleton key={index} />)
              : (
                <>
                  <BaseCard className="min-h-[196px] lg:min-h-[110px] sm:col-span-2">
                    <div className="grid h-full grid-cols-2 gap-3">
                      <div className="space-y-3 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-3 lg:flex lg:flex-col lg:gap-1 lg:space-y-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-muted-foreground">Cal1</p>
                          <ShoppingBasket className="h-4 w-4 text-[var(--agri-text-muted)]" />
                        </div>
                        <p className="text-base font-medium leading-none text-[var(--agri-text)] sm:text-2xl lg:text-xl lg:font-semibold">
                          <span className="value-kg">{`${Number(stocGlobal.cal1 || 0).toFixed(1)} kg`}</span>
                        </p>
                        <span
                          className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold ${
                            Number(stocGlobal.cal1 || 0) > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {Number(stocGlobal.cal1 || 0) > 0 ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                          {Number(stocGlobal.cal1 || 0) > 0 ? 'Up' : 'Stabil'}
                        </span>
                      </div>

                      <div className="space-y-3 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-3 lg:flex lg:flex-col lg:gap-1 lg:space-y-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-muted-foreground">Cal2</p>
                          <ShoppingBasket className="h-4 w-4 text-[var(--agri-text-muted)]" />
                        </div>
                        <p className="text-base font-medium leading-none text-[var(--agri-text)] sm:text-2xl lg:text-xl lg:font-semibold">
                          <span className="value-kg">{`${Number(stocGlobal.cal2 || 0).toFixed(1)} kg`}</span>
                        </p>
                        <span
                          className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold ${
                            Number(stocGlobal.cal2 || 0) > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {Number(stocGlobal.cal2 || 0) > 0 ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                          {Number(stocGlobal.cal2 || 0) > 0 ? 'Up' : 'Stabil'}
                        </span>
                      </div>
                    </div>
                  </BaseCard>
                  <BaseCard className="min-h-[196px] lg:min-h-[110px] sm:col-span-2">
                    <div className="grid h-full grid-cols-2 gap-3">
                      <div className="space-y-3 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-3 lg:flex lg:flex-col lg:gap-1 lg:space-y-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-muted-foreground">Culese azi</p>
                          <ShoppingBasket className="h-4 w-4 text-[var(--agri-text-muted)]" />
                        </div>
                        <p className="text-base font-medium leading-none text-[var(--agri-text)] sm:text-2xl lg:text-xl lg:font-semibold">
                          <span className="value-kg">{`${kgAzi.toFixed(1)} kg`}</span>
                        </p>
                        <span
                          className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold ${
                            kgAzi > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {kgAzi > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          {kgAzi > 0 ? 'Up' : 'Stabil'}
                        </span>
                      </div>

                      <div className="space-y-3 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-3 lg:flex lg:flex-col lg:gap-1 lg:space-y-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-muted-foreground">Livrate azi</p>
                          <ShoppingBasket className="h-4 w-4 text-[var(--agri-text-muted)]" />
                        </div>
                        <p className="text-base font-medium leading-none text-[var(--agri-text)] sm:text-2xl lg:text-xl lg:font-semibold">
                          <span className="value-kg">{`${kgLivrateAzi.toFixed(1)} kg`}</span>
                        </p>
                        <span
                          className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold ${
                            kgLivrateAzi > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {kgLivrateAzi > 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                          {kgLivrateAzi > 0 ? 'Down' : 'Stabil'}
                        </span>
                      </div>
                    </div>
                  </BaseCard>
                  <KpiCard
                    title="Venit estimat"
                    value={<span className="value-money-positive">{formatCurrency(venitEstimat)}</span>}
                    subtitle={`Estimare la ${PRICE_PER_KG_ESTIMATE} lei/kg`}
                    trend={venitEstimat > 0 ? 'up' : 'neutral'}
                    icon={<Coins className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Cost munca"
                    value={<span className="value-money-negative">{formatCurrency(costMunca)}</span>}
                    subtitle={`Estimare la ${LABOR_COST_PER_KG} lei/kg`}
                    trend={costMunca > 0 ? 'down' : 'neutral'}
                    icon={<Tractor className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Parcele active"
                    value={parceleActive}
                    subtitle={`${parcele.length} parcele in total`}
                    trend="neutral"
                    icon={<MapPinned className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Lucrari programate"
                    value={lucrariProgramate}
                    subtitle="Azi si zilele urmatoare"
                    trend={lucrariProgramate > 0 ? 'up' : 'neutral'}
                    icon={<CalendarClock className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Profit sezon"
                    value={<span className={profitSezon >= 0 ? 'value-money-positive' : 'value-money-negative'}>{formatCurrency(profitSezon)}</span>}
                    subtitle="Venit - cost sezon curent"
                    trend={profitSezon >= 0 ? 'up' : 'down'}
                    icon={<Coins className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Comenzi azi"
                    value={comenziAziCount}
                    subtitle="Total comenzi de livrat azi"
                    trend={comenziAziCount > 0 ? 'up' : 'neutral'}
                    icon={<ShoppingBasket className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Kg de livrat azi"
                    value={<span className="value-kg">{`${kgDeLivratAzi.toFixed(1)} kg`}</span>}
                    subtitle="Cantitate programata pentru azi"
                    trend={kgDeLivratAzi > 0 ? 'up' : 'neutral'}
                    icon={<MapPinned className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Comenzi viitoare"
                    value={Object.keys(comenziViitoareByDateMap).length}
                    subtitle={comenziViitoareSummary || 'Fara livrari viitoare'}
                    trend={Object.keys(comenziViitoareByDateMap).length > 0 ? 'up' : 'neutral'}
                    icon={<CalendarClock className="h-5 w-5" />}
                  />
                  <KpiCard
                    title="Comenzi restante"
                    value={restanteCount}
                    subtitle="Comenzi cu termen depasit"
                    trend={restanteCount > 0 ? 'down' : 'neutral'}
                    icon={<Tractor className="h-5 w-5" />}
                  />
                </>
              )}
          </section>

          {!isLoading ? (
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
              <FeatureGate feature="smart_alerts">
                <section className="agri-card space-y-3 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-[var(--agri-text)]">Smart Alerts</h3>
                    <div className="flex items-center gap-2">
                      {filteredAlerts.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const keys = filteredAlerts.map((alert) => alert.alertKey)
                            setOptimisticDismissedKeys((prev) => {
                              const next = new Set(prev)
                              keys.forEach((key) => next.add(key))
                              return next
                            })
                            dismissAllMutation.mutate(keys)
                          }}
                          className="rounded-lg border border-[var(--agri-border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--agri-text)]"
                          disabled={dismissAllMutation.isPending}
                        >
                          Ascunde toate azi
                        </button>
                      ) : null}
                      <span className="rounded-full bg-[var(--agri-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--agri-text-muted)]">
                        {filteredAlerts.length}
                      </span>
                    </div>
                  </div>

                  {filteredAlerts.length === 0 ? (
                    <p className="text-sm font-medium text-[var(--agri-text-muted)]">Nu exista alerte active.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredAlerts.map((alert) => (
                        <AlertCard
                          key={alert.id}
                          alert={alert}
                          onDismiss={(selectedAlert) => {
                            setOptimisticDismissedKeys((prev) => new Set(prev).add(selectedAlert.alertKey))
                            dismissAlertMutation.mutate(selectedAlert.alertKey)
                          }}
                          dismissing={dismissAlertMutation.isPending}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </FeatureGate>

              <RecentActivityCard items={recentActivityItems} />
            </div>
          ) : null}

          {!isLoading ? (
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
              <ProductieAziCard cal1Kg={cal1Azi} cal2Kg={cal2Azi} totalKg={kgAzi} />
              <FinanciarAziCard venit={venitAzi} cheltuieli={cheltuieliAzi} profit={profitAzi} />
            </div>
          ) : null}
        </div>

      </div>
    </AppShell>
  )
}



