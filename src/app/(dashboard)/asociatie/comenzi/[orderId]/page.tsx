import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  ASSOCIATION_ORDER_STATUS_LABELS,
  ASSOCIATION_ORDER_STATUS_VARIANTS,
  type AssociationOrderStatus,
} from '@/lib/association/order-status'
import { requireAssociationAccess } from '@/lib/association/auth'
import { getAssociationOrders } from '@/lib/association/queries'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('ro-RO')
}

function formatLei(value: number): string {
  return `${Number(value || 0).toFixed(2)} lei`
}

function shortOrderId(id: string, shortId: string | null): string {
  return shortId?.trim() || id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

type PageProps = {
  params: Promise<{ orderId: string }>
}

export default async function AssociationOrderDetailPage({ params }: PageProps) {
  await requireAssociationAccess()
  const { orderId } = await params
  const orders = await getAssociationOrders()
  const order = orders.find((item) => item.id === orderId)

  if (!order) {
    notFound()
  }

  const status = order.status as AssociationOrderStatus

  return (
    <AppShell header={<PageHeader title={`Comanda #${shortOrderId(order.id, order.numar_comanda_scurt)}`} subtitle={order.clientName ?? 'Detalii comandă'} />}>
      <div className="mx-auto w-full max-w-3xl space-y-4 py-3">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/asociatie/comenzi">Înapoi la comenzi</Link>
        </Button>

        <section className="rounded-2xl bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{order.clientName ?? 'Client necunoscut'}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(order.data_comanda)}</p>
            </div>
            <StatusBadge
              text={ASSOCIATION_ORDER_STATUS_LABELS[status] ?? order.status}
              variant={ASSOCIATION_ORDER_STATUS_VARIANTS[status] ?? 'neutral'}
            />
          </div>

          <dl className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
            <div className="flex items-center justify-between gap-3">
              <dt>Telefon</dt>
              <dd>{order.telefon ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Livrare</dt>
              <dd>{order.localitate ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Total</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{formatLei(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Produse</h2>
          <div className="mt-3 space-y-3">
            {order.lines.map((line) => (
              <div key={line.id} className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {line.productName} · {line.qtyKg.toFixed(2)} kg
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {line.farmName ?? 'Fermă'} · {line.unitPriceLei.toFixed(2)} lei/kg
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{formatLei(line.lineTotalLei)}</p>
              </div>
            ))}
          </div>
        </section>

        {order.note_interne?.trim() ? (
          <section className="rounded-2xl bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Note interne</h2>
            <p className="mt-3 text-sm whitespace-pre-wrap text-[var(--text-secondary)]">{order.note_interne.trim()}</p>
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}
