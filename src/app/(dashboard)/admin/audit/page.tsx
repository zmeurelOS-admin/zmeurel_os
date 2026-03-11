import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'

interface AuditLogRow {
  id: string
  created_at: string
  actor_email: string | null
  tenant_name: string | null
  old_plan: string | null
  new_plan: string | null
  action: string
}

const PAGE_SIZE = 15

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(value ?? '1', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return parsed
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearch = (await searchParams) ?? {}
  const page = parsePage(resolvedSearch.page)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()

  const [{ data: logs, error: logsError }, { data: totalCount, error: countError }] = await Promise.all([
    supabase.rpc('admin_list_audit_logs', { p_limit: PAGE_SIZE, p_offset: offset }),
    supabase.rpc('admin_count_audit_logs'),
  ])

  const rows = (logs ?? []) as AuditLogRow[]
  const total = Number(totalCount ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AppShell
      header={<PageHeader title="Audit Planuri" subtitle="Istoric schimbari plan (superadmin only)" rightSlot={<ShieldCheck className="h-5 w-5" />} />}
    >
      <div className="mx-auto mt-4 w-full max-w-6xl space-y-4 py-4 sm:mt-0">
        {(logsError || countError) ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-800">
              Eroare la înc?rcare audit logs: {logsError?.message ?? countError?.message}
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[var(--agri-text-muted)]">
                  Total înregistrări: <strong className="text-[var(--agri-text)]">{total}</strong>
                </p>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                  Read-only
                </Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Superadmin</TableHead>
                    <TableHead>Fermă</TableHead>
                    <TableHead>Actiune</TableHead>
                    <TableHead>Plan vechi</TableHead>
                    <TableHead>Plan nou</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.created_at).toLocaleString('ro-RO')}</TableCell>
                      <TableCell>{row.actor_email ?? '-'}</TableCell>
                      <TableCell>{row.tenant_name ?? '-'}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.old_plan ?? '-'}</TableCell>
                      <TableCell className="font-semibold text-[var(--agri-text)]">{row.new_plan ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-end gap-2">
                <Button asChild variant="outline" disabled={page <= 1}>
                  <Link href={`/admin/audit?page=${Math.max(1, page - 1)}`}>Anterior</Link>
                </Button>
                <span className="text-sm text-[var(--agri-text-muted)]">
                  Pagina {page} din {totalPages}
                </span>
                <Button asChild variant="outline" disabled={page >= totalPages}>
                  <Link href={`/admin/audit?page=${Math.min(totalPages, page + 1)}`}>Urmator</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
