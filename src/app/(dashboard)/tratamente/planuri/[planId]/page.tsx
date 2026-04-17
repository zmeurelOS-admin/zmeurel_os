import Link from 'next/link'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'

type PageProps = {
  params: Promise<{ planId: string }>
}

export default async function TratamentePlanPlaceholderPage({ params }: PageProps) {
  const { planId } = await params

  return (
    <AppShell
      header={
        <PageHeader
          title="Detaliu plan tratamente"
          subtitle={`Planul ${planId.slice(0, 8)} este în lucru`}
          expandRightSlotOnMobile
        />
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-4 py-4">
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg text-[var(--text-primary)] [font-weight:650]">În lucru</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Detaliul planului de tratamente va fi adăugat într-un pas următor al fazei 2.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/dashboard">Înapoi la dashboard</Link>
          </Button>
        </section>
      </div>
    </AppShell>
  )
}
