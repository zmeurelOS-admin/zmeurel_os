import Link from 'next/link'
import { endOfYear, startOfYear } from 'date-fns'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AplicareListaClient } from '@/components/tratamente/AplicareListaClient'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { listAplicariParcela } from '@/lib/supabase/queries/tratamente'
import { getCurrentSezon } from '@/lib/utils/sezon'

type PageProps = {
  params: Promise<{ id: string }>
}

function getAplicareTimestamp(value: {
  data_aplicata: string | null
  data_planificata: string | null
  created_at: string
}): number {
  return new Date(value.data_aplicata ?? value.data_planificata ?? value.created_at).getTime()
}

export default async function ToateAplicarilePage({ params }: PageProps) {
  const { id: parcelaId } = await params
  const an = getCurrentSezon()
  const referintaSezon = new Date(Date.UTC(an, 0, 1))
  const from = startOfYear(referintaSezon)
  const to = endOfYear(referintaSezon)
  const aplicari = await listAplicariParcela(parcelaId, { from, to })

  const aplicariSortate = [...aplicari].sort(
    (a, b) => getAplicareTimestamp(b) - getAplicareTimestamp(a)
  )
  const isEmpty = aplicariSortate.length === 0

  return (
    <AppShell
      header={
        <PageHeader
          title="Toate aplicările"
          subtitle={`Istoric și planificări pentru sezonul ${an}`}
          summary={
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/parcele/${parcelaId}/tratamente`}>Înapoi la dashboard-ul de tratamente</Link>
            </Button>
          }
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-5 px-3 py-4 md:px-4">
        {isEmpty ? (
          <AppCard className="rounded-2xl border-dashed bg-[var(--surface-card-muted)] p-5">
            <p className="text-sm text-[var(--text-secondary)]">
              Nu există aplicări înregistrate pentru acest sezon.
            </p>
          </AppCard>
        ) : (
          <AplicareListaClient aplicari={aplicariSortate} parcelaId={parcelaId} />
        )}
      </div>
    </AppShell>
  )
}
