import { Building2, ShieldCheck } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AdminTenantsPlanTable, type AdminTenantRow } from '@/components/admin/AdminTenantsPlanTable'
import { Card, CardContent } from '@/components/ui/card'
import { BETA_MODE } from '@/lib/config/beta'
import { getEffectivePlan, normalizeSubscriptionPlan } from '@/lib/subscription/plans'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('admin_list_tenants')

  const rows = (data ?? []) as AdminTenantRow[]
  const totalTenants = rows.length
  const planCounts = rows.reduce(
    (acc, row) => {
      const tenantPlan = normalizeSubscriptionPlan(row.plan) ?? 'freemium'
      const effectivePlan = getEffectivePlan(tenantPlan)
      if (effectivePlan === 'pro') acc.pro += 1
      if (effectivePlan === 'enterprise') acc.enterprise += 1
      return acc
    },
    { pro: 0, enterprise: 0 }
  )
  const proTenants = planCounts.pro
  const enterpriseTenants = planCounts.enterprise

  return (
    <AppShell
      header={<PageHeader title="Admin" subtitle="Panou administrare" rightSlot={<ShieldCheck className="h-5 w-5" />} />}
    >
      <div className="mx-auto mt-3 w-full max-w-6xl space-y-3 py-3 sm:mt-0">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="rounded-2xl border-[var(--agri-border)]">
            <CardContent className="flex items-center gap-3 p-4">
              <Building2 className="h-5 w-5 text-[var(--agri-primary)]" />
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Total ferme</p>
                <p className="text-xl font-bold text-[var(--agri-text)]">{totalTenants}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[var(--agri-border)]">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">Plan Pro</p>
              <p className="text-xl font-bold text-[var(--agri-text)]">{proTenants}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[var(--agri-border)]">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-[var(--agri-text-muted)]">
                {BETA_MODE ? 'Plan Enterprise (Beta)' : 'Plan Enterprise'}
              </p>
              <p className="text-xl font-bold text-[var(--agri-text)]">{enterpriseTenants}</p>
            </CardContent>
          </Card>
        </section>

        {error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-800">
              Eroare la înc?rcare tenanți: {error.message}
            </CardContent>
          </Card>
        ) : (
          <AdminTenantsPlanTable initialRows={rows} />
        )}
      </div>
    </AppShell>
  )
}
