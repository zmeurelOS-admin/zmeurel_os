'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

import { BaseCard } from '@/components/app/BaseCard'
import { calculateProfit } from '@/lib/calculations/profit'

interface ProfitSummaryCardProps {
  revenue: number
  cost: number
  title?: string
  subtitle?: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(value)
}

export function ProfitSummaryCard({
  revenue,
  cost,
  title = 'Profit',
  subtitle = 'Venit vs cost',
}: ProfitSummaryCardProps) {
  const metrics = calculateProfit(revenue, cost)
  const positive = metrics.profit >= 0

  return (
    <BaseCard className={positive ? 'border-emerald-500' : 'border-red-500'}>
      <div className="mb-3 flex justify-between items-start gap-3 lg:gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-base font-medium text-[var(--agri-text)]">{subtitle}</p>
        </div>
        <span
          className={`ml-0 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl lg:ml-2 ${
            positive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-2.5">
          <dt className="text-sm text-muted-foreground">Venit</dt>
          <dd className="value-money-positive mt-1 text-base">{formatCurrency(metrics.revenue)}</dd>
        </div>
        <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-2.5">
          <dt className="text-sm text-muted-foreground">Cost</dt>
          <dd className="value-money-negative mt-1 text-base">{formatCurrency(metrics.cost)}</dd>
        </div>
        <div className={`rounded-xl border p-2.5 ${positive ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
          <dt className="text-sm text-muted-foreground">Profit</dt>
          <dd className={`mt-1 text-base ${positive ? 'value-money-positive' : 'value-money-negative'}`}>
            {formatCurrency(metrics.profit)}
          </dd>
        </div>
        <div className={`rounded-xl border p-2.5 ${positive ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
          <dt className="text-sm text-muted-foreground">Marja</dt>
          <dd className={`mt-1 text-base font-semibold ${positive ? 'text-emerald-800' : 'text-red-800'}`}>
            {metrics.margin.toFixed(1)}%
          </dd>
        </div>
      </dl>
    </BaseCard>
  )
}
