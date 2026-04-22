'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, EllipsisVertical, PencilLine, Trash2 } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PlanTratamentLinieCuProdus } from '@/lib/supabase/queries/tratamente'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

import { formatDoza, getStadiuMeta } from '@/components/tratamente/plan-wizard/helpers'

interface LinieRowProps {
  grupBiologic?: GrupBiologic | null
  index: number
  linie: PlanTratamentLinieCuProdus
  onDelete: () => void
  onEdit: () => void
  onMoveDown: () => void
  onMoveUp: () => void
  total: number
}

function resolveDoza(linie: PlanTratamentLinieCuProdus): string {
  if (typeof linie.doza_l_per_ha === 'number' && linie.doza_l_per_ha > 0) {
    return formatDoza(linie.doza_l_per_ha, 'l/ha')
  }

  return formatDoza(linie.doza_ml_per_hl, 'ml/hl')
}

export function LinieRow({
  grupBiologic,
  index,
  linie,
  onDelete,
  onEdit,
  onMoveDown,
  onMoveUp,
  total,
}: LinieRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const stadiu = getStadiuMeta(linie.stadiu_trigger, grupBiologic, linie.cohort_trigger)
  const isManual = !linie.produs && Boolean(linie.produs_nume_manual?.trim())
  const displayName =
    linie.produs?.nume_comercial ?? linie.produs_nume_manual?.trim() ?? 'Produs fără nume'

  return (
    <AppCard className="rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--surface-card-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
              #{linie.ordine}
            </span>
            <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)]">
              {stadiu.emoji} {stadiu.label}
            </span>
            {isManual ? (
              <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                manual
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-base text-[var(--text-primary)] [font-weight:650]">
            {displayName}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{resolveDoza(linie)}</p>

          {linie.observatii?.trim() ? (
            <p
              className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]"
              title={linie.observatii}
            >
              {linie.observatii.length > 40
                ? `${linie.observatii.slice(0, 40)}…`
                : linie.observatii}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Mută sus linia ${index + 1}`}
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Mută jos linia ${index + 1}`}
            disabled={index === total - 1}
            onClick={onMoveDown}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>

          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Acțiuni pentru linia ${index + 1}`}
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-2">
              <div className="space-y-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)]"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit()
                  }}
                >
                  <PencilLine className="h-4 w-4" aria-label="Editează linia" />
                  Editează
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--soft-danger-text)] transition hover:bg-[var(--surface-card-muted)]"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete()
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-label="Șterge linia" />
                  Șterge
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </AppCard>
  )
}
