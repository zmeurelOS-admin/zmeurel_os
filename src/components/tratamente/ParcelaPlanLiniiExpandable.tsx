'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { PlanTratamentLinieCuProdus } from '@/lib/supabase/queries/tratamente'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { listStadiiPentruGrup, normalizeStadiu } from '@/lib/tratamente/stadii-canonic'
import { cn } from '@/lib/utils'

import { getStadiuMeta } from '@/components/tratamente/plan-wizard/helpers'

function productSummary(linie: PlanTratamentLinieCuProdus): string {
  const first = linie.produse?.[0] ?? null
  const primary =
    first?.produs?.nume_comercial ??
    first?.produs_nume_snapshot ??
    first?.produs_nume_manual?.trim() ??
    linie.produs?.nume_comercial ??
    linie.produs_nume_manual?.trim() ??
    'Intervenție'

  const extraCount = (linie.produse?.length ?? 0) > 1 ? (linie.produse?.length ?? 0) - 1 : 0
  return extraCount > 0 ? `${primary} +${extraCount}` : primary
}

function stageSortKey(stadiu: string, grupBiologic?: GrupBiologic | null): number {
  const cod = normalizeStadiu(stadiu)
  if (!cod) return 10_000
  const order = listStadiiPentruGrup(grupBiologic).findIndex((value) => value === cod)
  return order === -1 ? 9_999 : order
}

export interface ParcelaPlanLiniiExpandableProps {
  className?: string
  grupBiologic?: GrupBiologic | null
  linii: PlanTratamentLinieCuProdus[]
  planName?: string | null
  relevantLinieIds: Set<string>
  onApplyNow: (linie: PlanTratamentLinieCuProdus) => void
}

export function ParcelaPlanLiniiExpandable({
  className,
  grupBiologic,
  linii,
  planName,
  relevantLinieIds,
  onApplyNow,
}: ParcelaPlanLiniiExpandableProps) {
  const [expanded, setExpanded] = useState(false)

  const remainingLinii = useMemo(() => linii.filter((linie) => !relevantLinieIds.has(linie.id)), [linii, relevantLinieIds])

  const groups = useMemo(() => {
    const map = new Map<string, PlanTratamentLinieCuProdus[]>()
    for (const linie of remainingLinii) {
      const key = linie.stadiu_trigger
      const current = map.get(key) ?? []
      current.push(linie)
      map.set(key, current)
    }

    const entries = Array.from(map.entries())
      .map(([stadiu, items]) => {
        const meta = getStadiuMeta(stadiu, grupBiologic, null)
        return {
          stadiu,
          label: meta.label,
          order: stageSortKey(stadiu, grupBiologic),
          items: [...items].sort((a, b) => a.ordine - b.ordine),
        }
      })
      .sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label, 'ro'))

    return entries
  }, [grupBiologic, remainingLinii])

  if (linii.length === 0 || remainingLinii.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      <button
        type="button"
        className="w-full text-left text-sm font-semibold text-[var(--agri-primary)] underline-offset-4 hover:underline"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Restrânge liniile planului ↑' : 'Vezi toate liniile planului ↓'}
      </button>

      {expanded ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.stadiu} className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="text-sm text-[var(--text-primary)] [font-weight:700]">{group.label}</p>
                <div className="h-px flex-1 bg-[var(--border-default)]" />
              </div>

              <div className="space-y-2">
                {group.items.map((linie) => (
                  <div
                    key={linie.id}
                    className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                          {linie.scop?.trim() || productSummary(linie)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          #{linie.ordine}
                          {planName ? ` · ${planName}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0 bg-[var(--agri-primary)] text-white"
                        onClick={() => onApplyNow(linie)}
                      >
                        Aplică acum
                      </Button>
                    </div>
                    {linie.tip_interventie?.trim() ? (
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Tip: {linie.tip_interventie}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

