'use client'

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { PlanActivParcela } from '@/lib/supabase/queries/tratamente'

interface PlanActivCardProps {
  createHref?: string | null
  detailsHref: string | null
  editHref?: string | null
  hubHref?: string
  listHref?: string
  onAssign: () => void
  planActiv: PlanActivParcela | null
}

export function PlanActivCard({
  createHref,
  detailsHref,
  editHref,
  hubHref = '/tratamente',
  listHref = '/tratamente/planuri',
  onAssign,
  planActiv,
}: PlanActivCardProps) {
  if (!planActiv?.plan) {
    return (
      <AppCard className="rounded-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">Plan asignat</p>
            <p className="mt-1 text-base font-medium text-[var(--text-primary)]">
              Nicio parcelă asignată pentru 2026
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="bg-[var(--agri-primary)] text-white" onClick={onAssign}>
                Atribuie plan
              </Button>
              {createHref ? (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={createHref}>Creează plan nou</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </AppCard>
    )
  }

  return (
    <AppCard className="rounded-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">Plan asignat</p>
          <h2 className="mt-1 text-lg leading-tight text-[var(--text-primary)] [font-weight:650]">
            {planActiv.plan.nume}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{planActiv.plan.cultura_tip}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {editHref ? (
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={editHref}>Editează plan</Link>
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAssign}>
            Schimbă plan
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--divider)] pt-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Plan activ pentru anul {planActiv.an}
          </p>
          <Link
            href="/tratamente/produse-fitosanitare"
            className="text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--agri-primary)]"
          >
            Bibliotecă produse
          </Link>
          <Link
            href={listHref}
            className="text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--agri-primary)]"
          >
            Toate planurile
          </Link>
          <Link
            href={hubHref}
            className="text-xs font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--agri-primary)]"
          >
            Hub tratamente
          </Link>
        </div>
        {detailsHref ? (
          <Link
            href={detailsHref}
            className="text-sm font-medium text-[var(--agri-primary)] transition-colors hover:text-[color:color-mix(in_srgb,var(--agri-primary)_82%,black)]"
          >
            Vezi detalii
          </Link>
        ) : null}
      </div>
    </AppCard>
  )
}
