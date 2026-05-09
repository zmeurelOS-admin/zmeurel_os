import Link from 'next/link'
import { endOfYear, startOfYear } from 'date-fns'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AplicareListItem } from '@/components/tratamente/AplicareListItem'
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

  const aplicate = aplicari
    .filter((aplicare) => aplicare.status === 'aplicata' || aplicare.status === 'aplicata_partial')
    .sort((a, b) => getAplicareTimestamp(b) - getAplicareTimestamp(a))
  const planificate = aplicari
    .filter((aplicare) => aplicare.status !== 'aplicata' && aplicare.status !== 'aplicata_partial')
    .sort((a, b) => getAplicareTimestamp(a) - getAplicareTimestamp(b))
  const isEmpty = aplicate.length === 0 && planificate.length === 0

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
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base text-[var(--text-primary)] [font-weight:650]">Aplicate</h2>
                <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                  {aplicate.length}
                </span>
              </div>
              {aplicate.length > 0 ? (
                <div className="space-y-3">
                  {aplicate.map((aplicare) => (
                    <AplicareListItem key={aplicare.id} aplicare={aplicare} parcelaId={parcelaId} />
                  ))}
                </div>
              ) : (
                <AppCard className="rounded-2xl border-dashed bg-[var(--surface-card-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Nu există aplicări efectuate în acest sezon.
                  </p>
                </AppCard>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base text-[var(--text-primary)] [font-weight:650]">Planificate</h2>
                <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                  {planificate.length}
                </span>
              </div>
              {planificate.length > 0 ? (
                <div className="space-y-3">
                  {planificate.map((aplicare) => (
                    <AplicareListItem key={aplicare.id} aplicare={aplicare} parcelaId={parcelaId} />
                  ))}
                </div>
              ) : (
                <AppCard className="rounded-2xl border-dashed bg-[var(--surface-card-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Nu există aplicări planificate în acest sezon.
                  </p>
                </AppCard>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
