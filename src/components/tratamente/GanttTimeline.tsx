'use client'

import { cn } from '@/lib/utils'
import type { GanttRow } from '@/lib/tratamente/conformitate'

const MONTH_LABELS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec']

interface GanttTimelineProps {
  labelsById: Record<string, { produs: string; data: string }>
  onSelect?: (aplicareId: string) => void
  rows: GanttRow[]
}

function getColorClasses(color: string, status: string): string {
  const isApplied = status === 'aplicata'
  const isCancelled = status === 'anulata'

  const palette =
    color === 'blue'
      ? isApplied
        ? 'bg-sky-500 border-sky-500 text-white'
        : 'border-sky-500 text-sky-700 dark:text-sky-300'
      : color === 'orange'
        ? isApplied
          ? 'bg-orange-500 border-orange-500 text-white'
          : 'border-orange-500 text-orange-700 dark:text-orange-300'
        : color === 'yellow'
          ? isApplied
            ? 'bg-amber-400 border-amber-400 text-[var(--text-primary)]'
            : 'border-amber-400 text-amber-700 dark:text-amber-300'
          : color === 'green'
            ? isApplied
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
            : isApplied
              ? 'bg-slate-500 border-slate-500 text-white'
              : 'border-slate-400 text-slate-700 dark:text-slate-300'

  if (isCancelled) {
    return cn('border-slate-400 bg-slate-200/60 text-slate-600 opacity-80 dark:bg-slate-800/50 dark:text-slate-300', palette)
  }

  if (status === 'planificata' || status === 'reprogramata') {
    return cn('border-2 border-dashed bg-transparent', palette)
  }

  return cn('border bg-transparent', palette)
}

export function GanttTimeline({ labelsById, onSelect, rows }: GanttTimelineProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="img" aria-label="Calendar anual al aplicărilor de tratamente">
      {rows.map((row) => (
        <section key={row.luna} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm text-[var(--text-primary)] [font-weight:650]">{MONTH_LABELS[row.luna - 1]}</h3>
            <span className="text-xs text-[var(--text-secondary)]">{row.aplicari.length} aplicări</span>
          </div>

          <div className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <div className="pt-1 text-[11px] text-[var(--text-secondary)]">
              <div>1</div>
              <div className="mt-3">8</div>
              <div className="mt-3">16</div>
              <div className="mt-3">24</div>
              <div className="mt-3">31</div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-31 gap-1">
                {Array.from({ length: 31 }, (_, index) => (
                  <div
                    key={`${row.luna}-day-${index + 1}`}
                    className="h-2 rounded-full bg-[var(--surface-card-muted)]"
                    aria-hidden
                  />
                ))}
              </div>

              <div className="grid grid-cols-31 gap-1">
                {row.aplicari.map((aplicare, index) => {
                  const meta = labelsById[aplicare.aplicareId]
                  const label = meta
                    ? `${meta.produs} · ${meta.data}`
                    : `Aplicare ${aplicare.aplicareId}`

                  return (
                    <button
                      key={`${aplicare.aplicareId}-${index}`}
                      type="button"
                      title={label}
                      aria-label={label}
                      data-testid="gantt-pill"
                      className={cn(
                        'relative min-h-7 rounded-md px-1 text-[10px] [font-weight:650] transition-transform active:scale-[0.97]',
                        getColorClasses(aplicare.tipCuloare, aplicare.status)
                      )}
                      style={{ gridColumn: `${Math.min(Math.max(aplicare.ziua, 1), 31)} / span 1` }}
                      onClick={() => onSelect?.(aplicare.aplicareId)}
                    >
                      <span className="truncate">{aplicare.ziua}</span>
                      {aplicare.status === 'anulata' ? (
                        <span
                          data-testid="gantt-pill-cancelled-line"
                          className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rotate-[-25deg] bg-current"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}

