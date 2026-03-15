'use client'

import { CalendarClock, MapPinned, Package, Receipt, ShoppingBasket, Users } from 'lucide-react'

import { BaseCard } from '@/components/app/BaseCard'

export interface RecentActivityItem {
  id: string
  type: 'recoltare' | 'cheltuiala' | 'comanda' | 'client' | 'parcela' | 'vanzare'
  description: string
  timestamp: string
}

const PLACEHOLDER_ITEMS: RecentActivityItem[] = [
  { id: 'ph-1', type: 'recoltare', description: 'Recoltare adaugata', timestamp: new Date().toISOString() },
  { id: 'ph-2', type: 'cheltuiala', description: 'Cheltuială înregistrat?', timestamp: new Date().toISOString() },
  { id: 'ph-3', type: 'comanda', description: 'Comanda noua', timestamp: new Date().toISOString() },
  { id: 'ph-4', type: 'client', description: 'Client nou', timestamp: new Date().toISOString() },
]

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Acum'

  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getIcon(type: RecentActivityItem['type']) {
  switch (type) {
    case 'recoltare':
      return Package
    case 'cheltuiala':
      return Receipt
    case 'comanda':
      return ShoppingBasket
    case 'client':
      return Users
    case 'parcela':
      return MapPinned
    case 'vanzare':
      return ShoppingBasket
    default:
      return CalendarClock
  }
}

export function RecentActivityCard({ items }: { items?: RecentActivityItem[] }) {
  const activityItems = items && items.length > 0 ? items : PLACEHOLDER_ITEMS

  return (
    <BaseCard className="min-h-[196px]">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--agri-text)]">Activitate recentă</h3>

        <div className="space-y-2">
          {activityItems.map((item) => {
            const Icon = getIcon(item.type)
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 py-2.5"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--agri-border)] bg-white text-[var(--agri-text-muted)]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--agri-text)]">{item.description}</p>
                  <p className="text-xs text-[var(--agri-text-muted)]">{formatTimestamp(item.timestamp)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </BaseCard>
  )
}
