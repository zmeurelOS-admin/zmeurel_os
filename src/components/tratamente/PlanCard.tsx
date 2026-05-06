'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ClipboardList, FileSpreadsheet, PencilLine, Plus, RotateCcw, Copy, Archive, Trash2 } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { PlanTratamentListItem } from '@/lib/supabase/queries/tratamente'
import { cn } from '@/lib/utils'

interface PlanCardProps {
  plan: PlanTratamentListItem
  onEdit: () => void
  onDuplica: () => void
  onArhiveaza: () => void
  onSterge: () => void
  onClick?: () => void
}

function formatPlanMeta(plan: PlanTratamentListItem) {
  const parcelaPrincipala = plan.parcele_asociate[0]?.parcela_nume ?? null
  return parcelaPrincipala ? `${plan.cultura_tip} · ${parcelaPrincipala}` : plan.cultura_tip
}

function renderMetric(value: number, label: string) {
  return (
    <div className="rounded-[16px] bg-[var(--surface-card-muted)] px-3 py-3 text-center">
      <div className="text-[18px] leading-none text-[var(--text-primary)] [font-weight:700]">{value}</div>
      <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{label}</div>
    </div>
  )
}

export function PlanCard({
  plan,
  onEdit,
  onDuplica,
  onArhiveaza,
  onSterge,
  onClick,
}: PlanCardProps) {
  const anPlan = plan.parcele_asociate[0]?.an ?? '—'
  const tipuriVizibile = plan.tipuri_interventie.slice(0, 3)
  const tipuriAscunse = plan.tipuri_interventie.length - tipuriVizibile.length
  const isEmptyPlan = plan.linii_count === 0
  const [actionsOpen, setActionsOpen] = useState(false)

  return (
    <AppCard
      className={cn(
        'rounded-[22px] border border-[var(--border-default)]/70 p-4 transition-colors hover:border-[var(--border-strong)]'
      )}
    >
      <div className="space-y-4" onClick={() => setActionsOpen((current) => !current)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] [font-weight:650]',
                  plan.arhivat
                    ? 'bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
                    : 'bg-[rgba(13,155,92,0.08)] text-[var(--agri-primary)]'
                )}
              >
                {plan.arhivat ? 'Arhivat' : 'Activ'}
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">{anPlan}</span>
            </div>

            <div className="space-y-1">
              <h3 className="line-clamp-2 text-[15px] leading-5 text-[var(--text-primary)] [font-weight:500]">
                {plan.nume}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">{formatPlanMeta(plan)}</p>
            </div>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>

        {isEmptyPlan ? (
          <div className="rounded-[16px] border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-4 text-center text-sm text-[var(--text-secondary)]">
            Plan gol — importă sau adaugă intervenții
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {renderMetric(plan.linii_count, 'intervenții')}
            {renderMetric(plan.nr_produse, 'produse')}
            {renderMetric(plan.nr_aplicate, 'aplicate')}
          </div>
        )}

        {isEmptyPlan ? null : plan.tipuri_interventie.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tipuriVizibile.map((tip) => (
              <span
                key={tip}
                className="rounded-[10px] bg-[var(--surface-card-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                {tip}
              </span>
            ))}
            {tipuriAscunse > 0 ? (
              <span className="rounded-[10px] bg-[var(--surface-card-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
                +{tipuriAscunse}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[16px] border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-3 text-center text-xs text-[var(--text-secondary)]">
            Plan fără tipuri de intervenție configurate.
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--divider)] pt-3">
          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            {isEmptyPlan ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/tratamente/planuri/import">
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Excel
                </Link>
              </Button>
            ) : null}
            {onClick ? (
              <Button
                type="button"
                size="sm"
                className="w-auto rounded-xl bg-[#3D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#356b53]"
                onClick={onClick}
              >
                Vezi plan
              </Button>
            ) : null}
          </div>
        </div>
        {actionsOpen ? (
          <div className="grid gap-2 border-t border-[var(--divider)] pt-3" onClick={(event) => event.stopPropagation()}>
            <Button type="button" variant="outline" className="justify-start" onClick={onEdit}>
              <PencilLine className="h-4 w-4" />
              Editează
            </Button>
            <Button type="button" variant="outline" className="justify-start" onClick={onDuplica}>
              <Copy className="h-4 w-4" />
              Duplică
            </Button>
            <Button type="button" variant="outline" className="justify-start" onClick={onArhiveaza}>
              {plan.arhivat ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {plan.arhivat ? 'Dezarhivează' : 'Arhivează'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start text-red-500 hover:text-red-500"
              onClick={onSterge}
            >
              <Trash2 className="h-4 w-4" />
              Șterge
            </Button>
          </div>
        ) : null}
      </div>
    </AppCard>
  )
}

export function CardPlanNou() {
  return (
    <AppCard className="flex min-h-[280px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--surface-card)] text-[var(--text-secondary)]">
        <Plus className="h-6 w-6" />
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="text-base text-[var(--text-primary)] [font-weight:650]">Plan nou</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Creează manual un plan sau importă-l din Excel.
        </p>
      </div>
      <div className="mt-5 flex w-full flex-col gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href="/tratamente/planuri/import">
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </Link>
        </Button>
        <Button type="button" asChild>
          <Link href="/tratamente/planuri/nou">Creează manual</Link>
        </Button>
      </div>
    </AppCard>
  )
}
