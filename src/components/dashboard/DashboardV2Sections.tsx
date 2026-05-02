import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
  Package,
  Sprout,
  Store,
  Tractor,
  TrendingDown,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

import { Sparkline } from '@/components/dashboard/Sparkline'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { DashboardTreatmentSuggestion } from '@/lib/dashboard/treatment-suggestions'
import { cn } from '@/lib/utils'

type SectionTone = 'neutral' | 'info' | 'warning' | 'critical' | 'success'

export type DashboardAttentionItem = {
  id: string
  label: string
  detail?: string
  tone: SectionTone
  badge?: string
  href?: string
}

export type DashboardRecommendationItem = {
  id: string
  text: string
  tone: SectionTone
}

export type DashboardQuickActionItem = {
  id: string
  label: string
  hint: string
  href: string
  icon?: LucideIcon
}

export type DashboardSeasonStatItem = {
  id: string
  label: string
  value: string
  meta?: string
  tone?: 'neutral' | 'positive' | 'negative'
  trendLabel?: string
}

export type DashboardTodayStatItem = {
  id: string
  label: string
  value: string
  meta?: string
}

export type DashboardFeedItem = {
  id: string
  title: string
  meta?: string
  value?: string
  tone?: SectionTone
}

type DashboardFeedSection = {
  id: string
  title: string
  href?: string
  emptyLabel: string
  items: DashboardFeedItem[]
}

function itemToneClass(tone: SectionTone) {
  if (tone === 'critical') return 'text-[var(--status-danger-text)]'
  if (tone === 'warning') return 'text-[var(--status-warning-text)]'
  if (tone === 'success') return 'text-[var(--success-text)]'
  if (tone === 'info') return 'text-[var(--info-text)]'
  return 'text-[var(--text-primary)]'
}

function treatmentStatusMeta(status: DashboardTreatmentSuggestion['status']) {
  if (status === 'blocked') {
    return {
      label: 'Blocat',
      className: 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
    }
  }
  if (status === 'weather_wait') {
    return {
      label: 'Așteaptă meteo',
      className: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    }
  }
  if (status === 'overdue') {
    return {
      label: 'Întârziat',
      className: 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
    }
  }
  if (status === 'today') {
    return {
      label: 'Azi',
      className: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
    }
  }
  return {
    label: 'În curând',
    className: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
  }
}

function warningLabel(warning: DashboardTreatmentSuggestion['warnings'][number]) {
  if (warning === 'phi') return 'PHI activ'
  if (warning === 'pauza') return 'Pauză activă'
  if (warning === 'meteo') return 'Meteo neconfirmat'
  return 'Fenofază lipsă'
}

function formatTreatmentDate(value: string | null): string | null {
  if (!value) return null
  try {
    return format(parseISO(value), 'd MMM', { locale: ro })
  } catch {
    return value
  }
}

export function DashboardSectionCard({
  eyebrow,
  title,
  description,
  rightSlot,
  className,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  rightSlot?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <AppCard
      className={cn(
        'dashboard-v2-card px-[18px] py-[18px] sm:px-5 sm:py-5',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-[1.02rem] leading-tight tracking-[-0.03em] text-[var(--text-primary)] [font-weight:750]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-[44ch] text-[13px] leading-[1.5] text-[var(--text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
      {children}
    </AppCard>
  )
}

export function DashboardAttentionCard({
  items,
}: {
  items: DashboardAttentionItem[]
}) {
  return (
    <DashboardSectionCard
      eyebrow="La ce să fii atent azi"
      title="La ce să fii atent azi"
      description="Lucrurile care cer atenție azi."
    >
      {items.length === 0 ? (
        <div className="flex items-start gap-3 py-1">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
          <p className="text-[12px] leading-5 text-[var(--text-secondary)]">Nu ai urgențe vizibile în datele curente.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {items.map((item) => {
            const content = (
              <>
                <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', itemToneClass(item.tone))} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{item.label}</p>
                  {item.detail ? (
                    <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{item.detail}</p>
                  ) : null}
                </div>
                {item.badge ? (
                  <span className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                    {item.badge}
                  </span>
                ) : null}
              </>
            )

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 py-1"
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 py-1"
              >
                {content}
              </div>
            )
          })}
        </div>
      )}
    </DashboardSectionCard>
  )
}

export function DashboardRecommendationsCard({
  items,
  helperText,
  boostText,
}: {
  items: DashboardRecommendationItem[]
  helperText?: string
  boostText?: string
}) {
  return (
    <DashboardSectionCard
      eyebrow="Recomandări"
      title="Recomandări pentru azi"
      description="Sugestii scurte și practice, bazate pe datele de azi."
    >
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2.5"
          >
            <span aria-hidden="true" className={cn('pt-0.5 text-base leading-none', itemToneClass(item.tone))}>
              •
            </span>
            <p className="min-w-0 text-[14px] leading-[1.55] text-[var(--text-primary)]">{item.text}</p>
          </li>
        ))}
      </ul>
      {helperText ? (
        <p className="mt-3 text-[12px] leading-5 text-[var(--text-secondary)]">{helperText}</p>
      ) : null}
      {boostText ? (
        <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">{boostText}</p>
      ) : null}
    </DashboardSectionCard>
  )
}

function TreatmentSuggestionBlock({
  suggestion,
  primary = false,
  secondary = false,
}: {
  suggestion: DashboardTreatmentSuggestion
  primary?: boolean
  secondary?: boolean
}) {
  const status = treatmentStatusMeta(suggestion.status)
  const detailHref = suggestion.aplicareId
    ? `/parcele/${suggestion.parcelaId}/tratamente/aplicare/${suggestion.aplicareId}`
    : '/tratamente'
  const dateLabel = formatTreatmentDate(suggestion.recommendedDate)

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--divider)] bg-[var(--surface-card-muted)] p-4',
        primary ? '' : 'px-3.5 py-3',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className={cn('inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold', status.className)}>
          {status.label}
        </span>
        {secondary ? (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            A doua sugestie
          </span>
        ) : null}
        <span className="min-w-0 max-w-full break-words text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          {suggestion.parcelaLabel}
        </span>
      </div>

      <h3 className="mt-3 text-[15px] leading-5 text-[var(--text-primary)] [font-weight:700]">
        {suggestion.interventieLabel ?? suggestion.produsLabel}
      </h3>
      <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{suggestion.produsLabel}</p>
      {dateLabel ? (
        <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
          {suggestion.status === 'soon' ? 'Recomandat până la' : 'Data recomandată'}: {dateLabel}
        </p>
      ) : null}
      <p className="mt-2 text-[13px] leading-[1.55] text-[var(--text-primary)]">{suggestion.reason}</p>

      {suggestion.firstSafeWindowLabel ? (
        <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
          Fereastră meteo: {suggestion.firstSafeWindowLabel}
        </p>
      ) : null}

      {suggestion.warnings.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.warnings.map((warning) => (
            <span
              key={`${suggestion.parcelaId}:${warning}`}
              className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
            >
              {warningLabel(warning)}
            </span>
          ))}
        </div>
      ) : null}

      {primary ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestion.aplicareId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={detailHref}>Vezi aplicarea</Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href="/tratamente">Deschide hub Tratamente</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function DashboardNextTreatmentCard({
  primary,
  secondary,
  loading = false,
}: {
  primary: DashboardTreatmentSuggestion | null
  secondary: DashboardTreatmentSuggestion | null
  loading?: boolean
}) {
  return (
    <DashboardSectionCard
      eyebrow="Sugestie operațională"
      title="Următorul tratament recomandat"
      description="Semnal rapid din Protecție & Nutriție. Este o sugestie operațională, nu o prescripție fitosanitară."
    >
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 rounded-2xl bg-[var(--surface-card-muted)]" />
          <div className="h-20 rounded-2xl bg-[var(--surface-card-muted)]" />
        </div>
      ) : primary ? (
        <div className="space-y-3">
          <TreatmentSuggestionBlock suggestion={primary} primary />
          {secondary ? <TreatmentSuggestionBlock suggestion={secondary} secondary /> : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--divider)] bg-[var(--surface-card-muted)] p-4">
          <p className="text-[13px] leading-5 text-[var(--text-primary)] [font-weight:650]">
            Nu există un tratament recomandat în datele curente.
          </p>
          <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">
            Completează fenofaza, planurile și aplicările programate — altfel nu avem suficiente date pentru o sugestie.
          </p>
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <Link href="/tratamente">Deschide hub Tratamente</Link>
            </Button>
          </div>
        </div>
      )}
    </DashboardSectionCard>
  )
}

export function DashboardQuickActionsCard({
  primaryActions,
  contextualActions,
}: {
  primaryActions: DashboardQuickActionItem[]
  contextualActions: DashboardQuickActionItem[]
}) {
  return (
    <DashboardSectionCard
      eyebrow="Acțiuni rapide"
      title="Intră direct în fluxurile folosite des"
      description="Scurtături stabile pentru teren, livrări și operațiuni zilnice."
    >
      <div className="grid grid-cols-2 gap-3">
        {primaryActions.map((action) => {
          const Icon = action.icon ?? Package
          return (
            <Link
              key={action.id}
              href={action.href}
              className="flex min-h-[52px] items-center gap-2.5 px-1 py-1.5"
            >
              <Icon className="h-4 w-4 shrink-0 text-[var(--text-primary)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{action.label}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{action.hint}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
            </Link>
          )
        })}
      </div>

      {contextualActions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
          {contextualActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="inline-flex min-h-[32px] items-center text-[12px] font-semibold text-[var(--text-secondary)]"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </DashboardSectionCard>
  )
}

export function DashboardSeasonOverviewCard({
  items,
}: {
  items: DashboardSeasonStatItem[]
}) {
  return (
    <DashboardSectionCard
      eyebrow="Sezonul curent"
      title="Sezonul curent"
      description="Indicatori cheie pentru ritmul comercial al fermei."
    >
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-[13px] text-[var(--text-secondary)]">{item.label}</p>
              {item.meta ? (
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.meta}</p>
              ) : null}
              {item.trendLabel ? (
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.trendLabel}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-right text-[1.05rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </DashboardSectionCard>
  )
}

export function DashboardTodayCard({
  stats,
  focusItems,
}: {
  stats: DashboardTodayStatItem[]
  focusItems: DashboardAttentionItem[]
}) {
  return (
    <DashboardSectionCard
      eyebrow="Azi"
      title="Ce ai de făcut azi"
      description="O vedere rapidă cu volumele și următoarele puncte de lucru."
    >
      <div className="space-y-3">
        {stats.map((stat) => (
          <div
            key={stat.id}
            className="flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-[13px] text-[var(--text-secondary)]">{stat.label}</p>
              {stat.meta ? (
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{stat.meta}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-right text-[1.05rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-[var(--divider)] pt-4">
        {focusItems.length === 0 ? (
          <div className="py-1 text-[12px] leading-5 text-[var(--text-secondary)]">
            Nu există task-uri urgente suplimentare în datele curente.
          </div>
        ) : (
          focusItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 py-1"
            >
              <div className="min-w-0">
                <p className="text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{item.label}</p>
                {item.detail ? (
                    <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{item.detail}</p>
                ) : null}
              </div>
              {item.badge ? (
                <span className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  {item.badge}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </DashboardSectionCard>
  )
}

export function DashboardFarmPulseCard({
  sections,
  footnote,
}: {
  sections: DashboardFeedSection[]
  footnote?: string
}) {
  return (
    <DashboardSectionCard
      eyebrow="În fermă"
      title="Operațional și recent"
      description="Comenzi, recoltă și stoc într-o zonă compactă, ușor de scanat."
    >
      <div className="space-y-0">
        {sections.map((section, idx) => (
          <div
            key={section.id}
            className={cn(idx > 0 && 'mt-4 border-t border-[var(--divider)] pt-4')}
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h3 className="text-[14px] leading-tight text-[var(--text-primary)] [font-weight:650]">{section.title}</h3>
              {section.href ? (
                <Link
                  href={section.href}
                  className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Vezi toate
                </Link>
              ) : null}
            </div>

            {section.items.length === 0 ? (
              <p className="text-[12px] leading-5 text-[var(--text-secondary)]">{section.emptyLabel}</p>
            ) : (
              <div className="space-y-2.5">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 py-0.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] leading-5 text-[var(--text-primary)] [font-weight:650]">{item.title}</p>
                      {item.meta ? (
                        <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.meta}</p>
                      ) : null}
                    </div>
                    {item.value ? (
                      <span
                        className={cn(
                          'shrink-0 text-right text-[13px] font-semibold tabular-nums',
                          item.tone ? itemToneClass(item.tone) : 'text-[var(--text-primary)]'
                        )}
                      >
                        {item.value}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {footnote ? (
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {footnote}
        </p>
      ) : null}
    </DashboardSectionCard>
  )
}

export function DashboardComenziSnapshotCard({
  activeCount,
  kgInCursLabel,
  previewClient,
  previewMeta,
}: {
  activeCount: number
  kgInCursLabel: string
  previewClient?: string
  previewMeta?: string
}) {
  return (
    <DashboardSectionCard
      eyebrow="Livrări"
      title="Comenzi"
      description="Status comenzi și volum în curs."
      rightSlot={
        <Link
          href="/comenzi"
          className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Deschide
        </Link>
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-[var(--text-secondary)]">Active</span>
        <span className="text-[1.25rem] font-semibold tabular-nums text-[var(--text-primary)]">{activeCount}</span>
      </div>
      <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{kgInCursLabel}</p>
      {previewClient ? (
        <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5">
          <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{previewClient}</p>
          {previewMeta ? (
            <p className="mt-0.5 text-[11px] leading-5 text-[var(--text-secondary)]">{previewMeta}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-[var(--text-secondary)]">Nu există comenzi recente în datele curente.</p>
      )}
    </DashboardSectionCard>
  )
}

export function DashboardCommercialSnapshotCard({
  mode,
  href,
}: {
  mode: 'farmer' | 'association'
  href: string
}) {
  const Icon = mode === 'association' ? Users : Store
  const title = mode === 'association' ? 'Hub asociație' : 'Magazinul meu'
  const description =
    mode === 'association'
      ? 'Vitrina publică Gustă din Bucovina — mai mulți fermieri.'
      : 'Pagina publică cu produsele tale active.'

  return (
    <DashboardSectionCard
      eyebrow="Comercial"
      title={title}
      description={description}
      rightSlot={
        <Link
          href={href}
          className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Deschide
        </Link>
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card-muted)] text-[var(--text-primary)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <p className="min-w-0 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {mode === 'association'
            ? 'Gestionezi prezența în catalogul asociației și comenzile din vitrină.'
            : 'Distribuie linkul către clienți; comenzile intră în modulul Comenzi.'}
        </p>
      </div>
    </DashboardSectionCard>
  )
}

type UnifiedKpiItem = {
  id: string
  label: string
  value: string
  meta: string
  tone?: 'neutral' | 'positive' | 'negative'
  trendLabel?: string
}

export function DashboardUnifiedFinancialCard({
  kpiItems,
  empty,
  total,
  previous,
  periodLabel,
  trendLabel,
  series,
}: {
  kpiItems: UnifiedKpiItem[]
  empty: boolean
  total: string
  previous: string
  periodLabel: string
  trendLabel: string | null
  series: number[]
}) {
  return (
    <DashboardSectionCard
      eyebrow="Finanțe"
      title="Venituri și sezon"
      description="Indicatori operaționali și evoluția veniturilor recente."
    >
      {empty ? (
        <p className="text-[13px] text-[var(--text-secondary)]">Nu există suficiente date financiare pentru acest rezumat.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpiItems.map((item) => (
              <div key={item.id} className="space-y-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] leading-5 text-[var(--text-secondary)]">{item.label}</span>
                  <span
                    className={cn(
                      'shrink-0 text-[1.02rem] font-semibold tabular-nums',
                      item.tone === 'positive'
                        ? 'text-[var(--success-text)]'
                        : item.tone === 'negative'
                          ? 'text-[var(--danger-text)]'
                          : 'text-[var(--text-primary)]',
                    )}
                  >
                    {item.value}
                  </span>
                </div>
                {item.meta ? <div className="text-[11px] leading-5 text-[var(--text-secondary)]">{item.meta}</div> : null}
                {item.trendLabel ? (
                  <div className="text-[11px] font-medium text-[var(--info-text)]">{item.trendLabel}</div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--divider)] pt-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  {periodLabel}
                </div>
                <div className="text-[1.35rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text-primary)] [font-weight:750]">
                  {total}
                </div>
                <div className="text-[12px] leading-5 text-[var(--text-secondary)]">Perioada comparată: {previous}</div>
                {trendLabel ? (
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--info-text)]">
                    {trendLabel.startsWith('-') ? (
                      <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{trendLabel}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[var(--divider)] pt-4 lg:border-0 lg:pt-0">
                <div>
                  <div className="text-[14px] leading-tight text-[var(--text-primary)] [font-weight:650]">Trend venituri</div>
                  <div className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">Ultimele 8 săptămâni</div>
                </div>
                <Sparkline values={series} className="h-10 w-28" height={32} strokeClassName="stroke-[var(--info-text)]" />
              </div>
            </div>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline">
                <Link href="/rapoarte">Deschide rapoarte</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardSectionCard>
  )
}

export const DASHBOARD_PRIMARY_QUICK_ACTIONS: DashboardQuickActionItem[] = [
  {
    id: 'orders',
    label: 'Comenzi',
    hint: 'Livrări și statusuri active',
    href: '/comenzi',
    icon: Package,
  },
  {
    id: 'harvests',
    label: 'Recoltări',
    hint: 'Intrări rapide din teren',
    href: '/recoltari',
    icon: Tractor,
  },
  {
    id: 'activities',
    label: 'Activități',
    hint: 'Lucrări și tratamente',
    href: '/activitati-agricole',
    icon: Sprout,
  },
  {
    id: 'stocks',
    label: 'Stocuri',
    hint: 'Verifică marfa disponibilă',
    href: '/stocuri',
    icon: Warehouse,
  },
]
