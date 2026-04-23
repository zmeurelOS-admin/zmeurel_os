import Link from 'next/link'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ToateAplicarilePlaceholderPage({ params }: PageProps) {
  const { id } = await params

  return (
    <AppShell header={<PageHeader title="Toate aplicările" subtitle="Vizualizarea completă este în lucru" />}>
      <div className="mx-auto w-full max-w-3xl space-y-4 py-4">
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg text-[var(--text-primary)] [font-weight:650]">În lucru</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Lista completă și filtrele pentru toate aplicările vor fi disponibile în pasul următor.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" asChild>
            <Link href={`/parcele/${id}/tratamente`}>Înapoi la dashboard-ul de tratamente</Link>
          </Button>
        </section>
      </div>
    </AppShell>
  )
}
