import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { KpiCard } from '@/components/app/KpiCard'
import { PageHeader } from '@/components/app/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'

type MetricsRow = {
  date: string
  total_tenants: number
  total_parcele: number
  total_recoltari: number
  total_vanzari: number
  total_kg_cal1: number
  total_kg_cal2: number
  total_revenue_lei: number
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO').format(value)
}

function formatLei(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(value)
}

export async function AnalyticsDashboard() {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)
  const { error: refreshError } = await supabase.rpc('refresh_tenant_metrics_daily', { p_date: today })

  const { data, error } = await supabase
    .from('tenant_metrics_daily')
    .select('date,total_tenants,total_parcele,total_recoltari,total_vanzari,total_kg_cal1,total_kg_cal2,total_revenue_lei')
    .order('date', { ascending: false })
    .limit(30)

  const rows = (data ?? []) as MetricsRow[]
  const latest = rows[0]

  if (refreshError || error) {
    return (
      <AppShell header={<PageHeader title="Admin Analytics" subtitle="Statistici agregate globale" />}>
        <div className="mx-auto w-full max-w-6xl py-4">
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-800">
              Eroare la încărcare metrici: {refreshError?.message ?? error?.message}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  if (!latest) {
    return (
      <AppShell header={<PageHeader title="Admin Analytics" subtitle="Statistici agregate globale" />}>
        <div className="mx-auto w-full max-w-6xl py-4">
          <EmptyState
            title="Nu există date agregate"
            description="Rulează jobul refresh_tenant_metrics_daily pentru a genera primul snapshot zilnic."
          />
        </div>
      </AppShell>
    )
  }

  const totalKgHarvested = Number(latest.total_kg_cal1 || 0) + Number(latest.total_kg_cal2 || 0)

  return (
    <AppShell header={<PageHeader title="Admin Analytics" subtitle="Statistici agregate anonimizate pe toate fermele" />}>
      <div className="mx-auto w-full max-w-6xl space-y-4 py-4">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard title="Tenanți activi (zi curentă)" value={formatNumber(latest.total_tenants)} />
          <KpiCard title="Total terenuri" value={formatNumber(latest.total_parcele)} />
          <KpiCard title="Înregistrări recoltări" value={formatNumber(latest.total_recoltari)} />
          <KpiCard title="Kg recoltate" value={formatNumber(totalKgHarvested)} />
          <KpiCard title="Venit agregat" value={formatLei(Number(latest.total_revenue_lei || 0))} />
        </section>

        <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
          <CardHeader>
            <CardTitle>Evoluție 30 zile</CardTitle>
            <CardDescription>Doar date agregate. Nu sunt expuse date identificabile pe tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Tenanți activi</TableHead>
                  <TableHead className="text-right">Recoltări</TableHead>
                  <TableHead className="text-right">Vânzări</TableHead>
                  <TableHead className="text-right">Kg Cal1</TableHead>
                  <TableHead className="text-right">Kg Cal2</TableHead>
                  <TableHead className="text-right">Venit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.total_tenants)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.total_recoltari)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.total_vanzari)}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(row.total_kg_cal1 || 0))}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(row.total_kg_cal2 || 0))}</TableCell>
                    <TableCell className="text-right">{formatLei(Number(row.total_revenue_lei || 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
