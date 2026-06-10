'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Download } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { PageHeader } from '@/components/app/PageHeader'
import { ComenziSectionPills } from '@/components/comenzi/ComenziSectionPills'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  CampaignAdminLeaderboardEntry,
  CampaignAdminMilestone,
  CampaignAdminPayload,
} from '@/lib/shop/campaign-admin-queries'

function formatLei(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)} lei`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(value))
}

function podiumLabel(rang: number): string {
  if (rang === 1) return '🥇'
  if (rang === 2) return '🥈'
  if (rang === 3) return '🥉'
  return `#${rang}`
}

function milestoneBadge(status: CampaignAdminMilestone['rewardStatus']) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">În așteptare</Badge>
    case 'validated':
      return <Badge variant="default">Validat</Badge>
    case 'cancelled':
      return <Badge variant="destructive">Anulat</Badge>
    case 'voided':
      return <Badge variant="destructive">Anulat manual</Badge>
    case 'unreached':
    default:
      return <Badge variant="secondary">Neatingat</Badge>
  }
}

function downloadLeaderboardCsv(rows: CampaignAdminLeaderboardEntry[], slug: string) {
  const headers = ['Rang', 'Nume', 'Telefon', 'Oraș', 'Caserole', 'Valoare', 'Premiu']
  const lines = [
    headers,
    ...rows.map((row) => [
      row.rang,
      row.customerName,
      row.customerPhone,
      row.city ?? '',
      row.totalQty,
      row.totalLei,
      row.finalPrize ?? '',
    ]),
  ].map((values) =>
    values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','),
  )
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `clasament-${slug}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function LeaderboardCard({ entry }: { entry: CampaignAdminLeaderboardEntry }) {
  return (
    <article className="rounded-2xl bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-[var(--text-primary)]">
            {podiumLabel(entry.rang)} {entry.customerName}
          </p>
          <a
            href={`tel:${entry.customerPhone}`}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--info-text)]"
          >
            {entry.customerPhone}
          </a>
          {entry.city ? (
            <p className="text-sm text-[var(--text-secondary)]">{entry.city}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-[var(--success-text)]">{entry.totalQty}</p>
          <p className="text-xs font-semibold text-[var(--text-tertiary)]">caserole</p>
        </div>
      </div>
      {entry.finalPrize ? (
        <div className="mt-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-sm font-bold text-[var(--status-warning-text)]">
          {entry.finalPrize}
        </div>
      ) : null}
    </article>
  )
}

export function CampaniePageClient({ initialData }: { initialData: CampaignAdminPayload }) {
  const progress = Math.min(
    100,
    Math.round((initialData.campaign.currentCount / Math.max(1, initialData.campaign.targetQty)) * 100),
  )
  const columns = useMemo<ColumnDef<CampaignAdminLeaderboardEntry>[]>(
    () => [
      {
        accessorKey: 'rang',
        header: 'Rang',
        cell: ({ row }) => (
          <span className="font-extrabold">{podiumLabel(row.original.rang)}</span>
        ),
        meta: { numeric: true },
      },
      {
        accessorKey: 'customerName',
        header: 'Nume',
        cell: ({ row }) => <span className="font-bold">{row.original.customerName}</span>,
      },
      {
        accessorKey: 'customerPhone',
        header: 'Telefon',
        cell: ({ row }) => (
          <a href={`tel:${row.original.customerPhone}`} className="font-semibold text-[var(--info-text)]">
            {row.original.customerPhone}
          </a>
        ),
      },
      {
        accessorKey: 'city',
        header: 'Oraș',
        cell: ({ row }) => row.original.city ?? '—',
      },
      {
        accessorKey: 'totalQty',
        header: 'Caserole',
        meta: { numeric: true },
      },
      {
        accessorKey: 'totalLei',
        header: 'Valoare',
        cell: ({ row }) => formatLei(row.original.totalLei),
        meta: { numeric: true },
      },
      {
        accessorKey: 'finalPrize',
        header: 'Premiu final',
        cell: ({ row }) => row.original.finalPrize ?? '—',
      },
    ],
    [],
  )

  return (
    <AppShell
      header={
        <PageHeader
          title="Campanie"
          subtitle="Clasament complet și premii de prag"
          contentVariant="workspace"
        />
      }
      bottomBar={null}
    >
      <DashboardContentShell
        variant="workspace"
        className="mt-2 flex flex-col gap-4 py-3 sm:mt-0 sm:py-3"
      >
        <ComenziSectionPills />

        <section className="rounded-2xl bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
                  {initialData.campaign.title}
                </h1>
                <Badge variant={initialData.campaign.status === 'active' ? 'default' : 'secondary'}>
                  {initialData.campaign.status === 'active' ? 'Activă' : 'Încheiată'}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
                {initialData.campaign.currentCount} / {initialData.campaign.targetQty} caserole · {progress}%
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadLeaderboardCsv(
                  initialData.leaderboard,
                  initialData.campaign.slug,
                )
              }
              disabled={initialData.leaderboard.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden />
              Exportă CSV
            </Button>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--surface-card-muted)]"
            role="progressbar"
            aria-label="Progres campanie"
            aria-valuemin={0}
            aria-valuemax={initialData.campaign.targetQty}
            aria-valuenow={initialData.campaign.currentCount}
          >
            <div
              className="h-full rounded-full bg-[var(--success-text)] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Clasament clienți</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {initialData.leaderboard.length} clienți eligibili în campanie
            </p>
          </div>
          <ResponsiveDataView
            columns={columns}
            data={initialData.leaderboard}
            getRowId={(row) => row.customerPhone}
            getMobileRowId={(row) => row.customerPhone}
            mobileContainerClassName="grid-cols-1"
            searchPlaceholder="Caută după nume, telefon sau oraș..."
            emptyMessage="Nu există încă precomenzi eligibile."
            stickyDesktopHeader
            getDesktopRowClassName={(row) => {
              if (row.rang === 1) return 'bg-[var(--status-warning-bg)]'
              if (row.rang === 2) return 'bg-[var(--status-neutral-bg)]'
              if (row.rang === 3) {
                return 'bg-[color-mix(in_srgb,var(--status-warning-bg)_55%,var(--surface-card))]'
              }
              return undefined
            }}
            renderCard={(entry) => <LeaderboardCard entry={entry} />}
          />
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Premii de prag</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Toate pragurile campaniei și starea premiilor acordate
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prag</TableHead>
                  <TableHead>Premiu</TableHead>
                  <TableHead>Câștigător</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.milestones.map((milestone) => (
                  <TableRow
                    key={milestone.id}
                    className={
                      milestone.rewardStatus === 'unreached'
                        ? 'bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]'
                        : undefined
                    }
                  >
                    <TableCell className="font-bold">{milestone.threshold}</TableCell>
                    <TableCell>{milestone.rewardLabel}</TableCell>
                    <TableCell>
                      {milestone.winnerName && milestone.winnerPhone ? (
                        <span>
                          {milestone.winnerName} ·{' '}
                          <a href={`tel:${milestone.winnerPhone}`} className="font-semibold text-[var(--info-text)]">
                            {milestone.winnerPhone}
                          </a>
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{milestoneBadge(milestone.rewardStatus)}</TableCell>
                    <TableCell>{formatDate(milestone.reachedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </DashboardContentShell>
    </AppShell>
  )
}
