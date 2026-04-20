import Link from 'next/link'

import { AppShell } from '@/components/app/AppShell'
import { ConformitateParcelaCard } from '@/components/tratamente/ConformitateParcelaCard'
import { OnboardingBanner } from '@/components/tratamente/OnboardingBanner'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import {
  countStadiiPentruParcelele,
  listProduseFitosanitare,
  listParceleCuPlanActiv,
  listPlanuriTratament,
  getAplicariAnualToateParcelele,
  getTratamenteGlobalStats,
} from '@/lib/supabase/queries/tratamente'
import { buildConformitateMetrici } from '@/lib/tratamente/conformitate'

type PageProps = {
  searchParams: Promise<{ an?: string }>
}

function resolveYear(raw: string | undefined): number {
  const currentYear = new Date().getUTCFullYear()
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 2020 || parsed > 2100) return currentYear
  return parsed
}

export default async function TratamenteConformitatePage({ searchParams }: PageProps) {
  const { an: anParam } = await searchParams
  const an = resolveYear(anParam)
  const yearOptions = Array.from({ length: 5 }, (_, index) => an - 2 + index)

  const [parceleCuAplicari, produse, stats, planuri, parceleCuPlan] = await Promise.all([
    getAplicariAnualToateParcelele(an),
    listProduseFitosanitare(),
    getTratamenteGlobalStats(an),
    listPlanuriTratament(),
    listParceleCuPlanActiv(an),
  ])
  const arePlan = planuri.length > 0
  const areParceleCuPlan = parceleCuPlan.length > 0
  const areStadii =
    areParceleCuPlan &&
    (await countStadiiPentruParcelele(
      [...new Set(parceleCuPlan.map((item) => item.parcela_id).filter(Boolean))],
      an
    )) > 0

  const rows = parceleCuAplicari.map((item) => ({
    parcela: item.parcela,
    metrici: {
      parcelaId: item.parcela.id,
      ...buildConformitateMetrici(item.aplicari, produse, an),
    },
  }))
  const totalAlerteConformitate = stats.alerteFracTotal + stats.alerteCupruTotal
  const hasNeutralStats =
    stats.aplicariAzi === 0 &&
    stats.aplicariMaine === 0 &&
    stats.aplicariAplicateSezon === 0 &&
    stats.parceleCuPlan === 0 &&
    totalAlerteConformitate === 0

  return (
    <AppShell
      header={
        <CompactPageHeader
          title="Protecție & Nutriție"
          subtitle={`Hub anual multi-parcelă · anul ${an}`}
          summary={
            <div className="flex flex-wrap items-center gap-3">
              <form method="get" className="flex items-center gap-2">
                <label htmlFor="an-conformitate" className="text-sm text-[var(--text-primary)] lg:text-[var(--text-on-accent)]">
                  An
                </label>
                <select
                  id="an-conformitate"
                  name="an"
                  defaultValue={String(an)}
                  className="min-h-10 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm text-[var(--text-primary)]"
                >
                  {yearOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">
                  Aplică
                </Button>
              </form>

              <Button type="button" className="bg-[var(--agri-primary)] text-white" asChild>
                <a href={`/tratamente/conformitate/export?an=${an}`}>Exportă raport consolidat (PDF)</a>
              </Button>
            </div>
          }
        />
      }
      bottomInset="calc(var(--app-nav-clearance) + 1rem)"
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 py-3 pb-28 md:py-4 md:pb-12">
        <OnboardingBanner arePlan={arePlan} areParceleCuPlan={areParceleCuPlan} areStadii={areStadii} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AppCard className="rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Aplicări planificate</p>
            <p className="mt-2 text-2xl text-[var(--text-primary)] [font-weight:750]">
              {stats.aplicariAzi + stats.aplicariMaine}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Azi: {stats.aplicariAzi} · Mâine: {stats.aplicariMaine}
            </p>
          </AppCard>

          <AppCard className="rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Aplicări efectuate</p>
            <p className="mt-2 text-2xl text-[var(--text-primary)] [font-weight:750]">{stats.aplicariAplicateSezon}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Înregistrate în anul selectat</p>
          </AppCard>

          <AppCard className="rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Parcele cu plan activ</p>
            <p className="mt-2 text-2xl text-[var(--text-primary)] [font-weight:750]">{stats.parceleCuPlan}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Asocieri active în sezonul curent</p>
          </AppCard>

          <AppCard className="rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Alerte conformitate</p>
            <p className="mt-2 text-2xl text-[var(--text-primary)] [font-weight:750]">{totalAlerteConformitate}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              FRAC: {stats.alerteFracTotal} · Cupru: {stats.alerteCupruTotal}
            </p>
          </AppCard>
        </section>

        {hasNeutralStats ? (
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
            Nicio aplicare programată și nicio alertă activă în datele curente.
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          <Link
            href="/tratamente/planuri"
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-card-muted)]"
          >
            <p className="text-base text-[var(--text-primary)] [font-weight:650]">Planuri</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Creează, importă și administrează planurile active pe culturi.
            </p>
          </Link>

          <Link
            href="/tratamente/produse-fitosanitare"
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-card-muted)]"
          >
            <p className="text-base text-[var(--text-primary)] [font-weight:650]">Bibliotecă produse</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Verifică produsele, FRAC/IRAC și dozele disponibile în fermă.
            </p>
          </Link>

          <a
            href={`/tratamente/conformitate/export?an=${an}`}
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-card-muted)]"
          >
            <p className="text-base text-[var(--text-primary)] [font-weight:650]">Exportă fișe ANSVSA</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Generează raportul consolidat PDF pentru întreg sezonul.
            </p>
          </a>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg text-[var(--text-primary)] [font-weight:700]">Conformitate pe parcele</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Cupru cumulat, rotație FRAC și acces rapid spre calendarul fiecărei parcele.
              </p>
            </div>

            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/tratamente">Vezi hub-ul aplicărilor</Link>
            </Button>
          </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
            Nu există parcele în tenantul curent.
          </div>
        ) : (
          rows.map((row) => (
            <ConformitateParcelaCard key={row.parcela.id} an={an} metrici={row.metrici} parcela={row.parcela} />
          ))
        )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,transparent)] px-4 py-3 backdrop-blur-sm md:static md:mx-auto md:mt-2 md:max-w-6xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <Button type="button" className="w-full bg-[var(--agri-primary)] text-white md:w-auto" asChild>
          <a href={`/tratamente/conformitate/export?an=${an}`}>Exportă raport consolidat (PDF)</a>
        </Button>
      </div>
    </AppShell>
  )
}
