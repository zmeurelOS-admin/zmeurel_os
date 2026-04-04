import Link from 'next/link'
import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { SentryTechHealth } from '@/lib/monitoring/sentry-tech-health'

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: 'ok' | 'warn' | 'muted' | 'bad'
}) {
  const cls =
    tone === 'ok'
      ? 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]'
      : tone === 'warn'
        ? 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]'
        : tone === 'bad'
          ? 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]'
          : 'border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral-text)]'
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--agri-border)]/60 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <p className="min-w-[180px] text-sm font-medium text-[var(--agri-text)]">{label}</p>
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

export function AdminAnalyticsSentrySection({ health }: { health: SentryTechHealth }) {
  const errorMonitoring: 'ok' | 'warn' | 'bad' = !health.dsnConfigured
    ? 'bad'
    : health.reportingEnabledThisNodeEnv
      ? 'ok'
      : 'warn'

  const tracing: 'ok' | 'muted' =
    health.reportingEnabledThisNodeEnv && health.tracesSampleRate > 0 ? 'ok' : 'muted'

  const replay: 'ok' | 'muted' = health.reportingEnabledThisNodeEnv ? 'ok' : 'muted'

  return (
    <section className="space-y-4">
      <div className="border-b border-[var(--agri-border)] pb-3">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--agri-text)]">Tech Health / Sentry</h2>
        <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">
          Rezumat din configurația din repo și variabilele de mediu ale acestui deployment — nu înlocuiește consola
          Sentry. Pentru triaj și regresii, deschide proiectul în Sentry.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/80 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={
                errorMonitoring === 'ok'
                  ? 'Error monitoring: activ (prod)'
                  : errorMonitoring === 'warn'
                    ? 'Error monitoring: DSN setat, raportare oprită în development'
                    : 'Error monitoring: lipsă DSN'
              }
              tone={errorMonitoring === 'ok' ? 'ok' : errorMonitoring === 'warn' ? 'warn' : 'bad'}
            />
            <StatusPill
              label={
                tracing === 'ok'
                  ? `Tracing: eșantion ${Math.round(health.tracesSampleRate * 100)}%`
                  : 'Tracing: inactiv (fără DSN sau mod development)'
              }
              tone={tracing === 'ok' ? 'ok' : 'muted'}
            />
            <StatusPill
              label={
                replay === 'ok'
                  ? `Replay client: ${Math.round(health.replaySessionSampleRate * 100)}% sesiune, 100% la eroare`
                  : 'Replay: nu se trimite fără raportare activă'
              }
              tone={replay === 'ok' ? 'ok' : 'muted'}
            />
          </div>
          {health.optionalDashboardUrl ? (
            <Button asChild size="sm" variant="outline" className="h-9 shrink-0 gap-2">
              <Link href={health.optionalDashboardUrl} target="_blank" rel="noopener noreferrer">
                Deschide Sentry
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Opțional: setează{' '}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_SENTRY_DASHBOARD_URL</code> pentru un link direct
              (ex. Issues).
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-2 shadow-sm">
        <Row label="SDK">
          <span>
            {health.sdkPackage} <span className="text-muted-foreground">({health.sdkVersionRange})</span>
          </span>
        </Row>
        <Row label="DSN public">
          {health.dsnConfigured ? (
            <span>setat (valoarea nu este afișată)</span>
          ) : (
            <span className="text-[var(--warning-text)]">lipsește — configurează NEXT_PUBLIC_SENTRY_DSN</span>
          )}
        </Row>
        <Row label="Mediu raportat">
          <span>{health.environment}</span>
        </Row>
        <Row label="Raportare în acest runtime">
          {health.reportingEnabledThisNodeEnv ? (
            <span>activă (NODE_ENV ≠ development și DSN prezent)</span>
          ) : (
            <span>dezactivată în development sau fără DSN — vezi getServerSentryOptions în sentry-options.ts</span>
          )}
        </Row>
        <Row label="Performance / traces">
          <span>
            tracesSampleRate: {health.tracesSampleRate} — profiling explicit în cod:{' '}
            {health.profilingExplicitlyConfigured ? 'da' : 'nu (implicit SDK)'}
          </span>
        </Row>
        <Row label="Session Replay">
          <span>
            Doar pe client ({health.canonicalHookPaths.client}): sesiune {health.replaySessionSampleRate}, la eroare{' '}
            {health.replayOnErrorSampleRate}.
          </span>
        </Row>
        <Row label="Next.js + bundler">
          <span>
            withSentryConfig în next.config.js; annotare componente React:{' '}
            {health.reactComponentAnnotation ? 'activă' : '—'}
          </span>
        </Row>
        <Row label="Hooks Next / Sentry">
          <span>
            Server + Edge: {health.canonicalHookPaths.serverEdge} → sentry.server.config.ts / sentry.edge.config.ts (rădăcină
            proiect). Client: {health.canonicalHookPaths.client} (prioritate înaintea unui eventual fișier din
            rădăcină, conform @sentry/nextjs).
          </span>
        </Row>
        <Row label="Runtimes">
          <span>
            Server Node: {health.runtimesInstrumented.nodeServer ? 'da' : '—'}, Edge:{' '}
            {health.runtimesInstrumented.edge ? 'da' : '—'}, Client: {health.runtimesInstrumented.client ? 'da' : '—'}
          </span>
        </Row>
        <Row label="User / tenant context">
          <span>{health.userContextClient.detail}</span>
        </Row>
        <Row label="Release (env runtime)">
          {health.releaseResolvedFromEnv ? (
            <span className="space-y-1">
              <code className="block break-all rounded bg-muted px-1.5 py-0.5 text-xs">
                {health.releaseResolvedFromEnv}
              </code>
              <span className="block text-xs text-muted-foreground">{health.releaseNote}</span>
            </span>
          ) : (
            <span className="space-y-1 text-muted-foreground">
              <span className="block">
                Nicio valoare din SENTRY_RELEASE / VERCEL_GIT_COMMIT_SHA / NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA în
                procesul curent — Sentry.init nu primește `release` din această sursă.
              </span>
              <span className="block text-xs">{health.releaseNote}</span>
            </span>
          )}
        </Row>
        <Row label="Source maps">
          <span>{health.sourceMapsNote}</span>
        </Row>
      </div>

      <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)]">
        <p className="font-semibold">Limitări (cinstit)</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
          {health.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
