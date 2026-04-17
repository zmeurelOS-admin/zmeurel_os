'use client'

import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { LineChart, Sparkles } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { StadiuFenologicParcela } from '@/lib/supabase/queries/tratamente'
import { STADII_ORDINE } from '@/lib/tratamente/stadiu-ordering'

interface StadiuCurentCardProps {
  stadiuCurent: StadiuFenologicParcela | null
  stadiuProgress: number
  stadiuUrmator: string | null
  onRecord: () => void
}

function getStadiuLabel(stadiu: string | null | undefined): string {
  if (!stadiu) return 'Fără stadiu'
  return STADII_ORDINE[stadiu]?.label ?? stadiu.replaceAll('_', ' ')
}

function formatObservedLabel(stadiuCurent: StadiuFenologicParcela): string {
  const sursa = stadiuCurent.sursa === 'manual'
    ? 'manual'
    : stadiuCurent.sursa === 'gdd'
      ? 'GDD'
      : stadiuCurent.sursa === 'poza'
        ? 'poză'
        : 'automat'

  return `Observat ${format(parseISO(stadiuCurent.data_observata), 'd MMM', { locale: ro })}, ${sursa}`
}

export function StadiuCurentCard({
  stadiuCurent,
  stadiuProgress,
  stadiuUrmator,
  onRecord,
}: StadiuCurentCardProps) {
  if (!stadiuCurent) {
    return (
      <AppCard className="rounded-2xl border-l-4 border-l-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_7%,var(--surface-card))]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--agri-primary)_14%,var(--surface-card))] text-[var(--agri-primary)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">Stadiu curent</p>
            <p className="mt-1 text-base font-medium text-[var(--text-primary)]">
              Nu ai înregistrat niciun stadiu anul acesta.
            </p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Începe cu <span className="font-medium text-[var(--text-primary)]">repaus</span> sau{' '}
              <span className="font-medium text-[var(--text-primary)]">umflare muguri</span>.
            </p>
            <Button type="button" size="sm" className="mt-4 bg-[var(--agri-primary)] text-white" onClick={onRecord}>
              Înregistrează primul stadiu
            </Button>
          </div>
        </div>
      </AppCard>
    )
  }

  return (
    <AppCard className="rounded-2xl border-l-4 border-l-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_7%,var(--surface-card))]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">Stadiu curent</p>
          <h2 className="mt-1 text-xl leading-tight text-[var(--text-primary)] [font-weight:750]">
            {getStadiuLabel(stadiuCurent.stadiu)}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{formatObservedLabel(stadiuCurent)}</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onRecord}>
          Actualizează stadiu
        </Button>
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--surface-card)]/80 p-3 shadow-[var(--shadow-soft)]">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <LineChart className="h-3.5 w-3.5" />
            Progres fenologic
          </span>
          <span>{stadiuProgress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,var(--surface-card))]">
          <div
            className="h-full rounded-full bg-[var(--agri-primary)] transition-[width] duration-300"
            style={{ width: `${stadiuProgress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          {stadiuUrmator
            ? `Următorul stadiu: ${getStadiuLabel(stadiuUrmator)}`
            : 'Parcela este deja în ultimul stadiu definit pentru acest an.'}
        </p>
      </div>
    </AppCard>
  )
}
