'use client'

import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Bug, CalendarClock, ChevronRight, Loader2, MapPin, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TIP_CAPCANA_LABEL_RO, type TipCapcana } from '@/types/tratamente-metode'

export interface SelectorCapcanaActivaItem {
  id: string
  tipCapcana: TipCapcana
  nrBucati: number
  parcelaNume: string
  dataMontare: string
  dataUrmatoareaVerificare: string | null
  nrCapturatiAnterior?: number
}

export interface SelectorCapcaneActiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: SelectorCapcanaActivaItem[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onPick: (item: SelectorCapcanaActivaItem) => void
}

function parseDateOnly(value: string): Date {
  return parseISO(`${value}T00:00:00`)
}

export function SelectorCapcaneActiveSheet({
  open,
  onOpenChange,
  items,
  loading = false,
  error = null,
  onRetry,
  onPick,
}: SelectorCapcaneActiveSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[28px] px-0 pb-6 sm:max-w-none">
        <SheetHeader className="border-b border-[var(--border-default)] px-4 pb-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-left text-xl text-[var(--text-primary)] [font-weight:750]">
                Alege capcana de verificat
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-[var(--text-secondary)]">
                Capcanele active sunt listate după următoarea verificare.
              </SheetDescription>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Închide</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-3 overflow-y-auto px-4 pt-4">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Se încarcă capcanele active…
            </div>
          ) : error ? (
            <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
              <p className="font-semibold text-[var(--text-primary)]">Nu am putut încărca capcanele active.</p>
              <p className="mt-1">{error}</p>
              {onRetry ? (
                <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
                  Reîncearcă
                </Button>
              ) : null}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[20px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
              <p className="font-semibold text-[var(--text-primary)]">Nu există capcane active.</p>
              <p className="mt-1">Pune capcane întâi.</p>
            </div>
          ) : (
            items.map((item) => {
              const dueDate = item.dataUrmatoareaVerificare ? parseDateOnly(item.dataUrmatoareaVerificare) : null
              const dueLabel = dueDate
                ? `${differenceInCalendarDays(dueDate, new Date())} zile până la verificare`
                : 'Fără dată setată'

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex w-full items-center gap-3 rounded-[20px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left shadow-[var(--shadow-soft)] transition active:scale-[0.985]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] text-[var(--agri-primary)]">
                    <Bug className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)] [font-weight:700]">
                      {TIP_CAPCANA_LABEL_RO[item.tipCapcana]}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        {item.parcelaNume}
                      </span>
                      <span>{item.nrBucati} buc</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        Montată {format(parseDateOnly(item.dataMontare), 'd MMM', { locale: ro })}
                      </span>
                      {dueDate ? <span>{dueLabel}</span> : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                </button>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
