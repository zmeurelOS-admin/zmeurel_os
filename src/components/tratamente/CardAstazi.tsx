'use client'

import { CloudSun, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ro } from 'date-fns/locale'

import { getLabelRo, normalizeStadiu } from '@/lib/tratamente/stadii-canonic'
import type { SugestieAstazi } from '@/lib/supabase/queries/tratamente'

export type CardAstaziProps = {
  sugestie: SugestieAstazi | null
  vreme?: { temperatura: number; conditie: string }
  onStropitAcum: () => void
}

function formatDateRo(date: Date): string {
  return format(date, 'EEEE, d MMMM yyyy', { locale: ro })
}

function formatFenofaza(value: string): string {
  const stadiu = normalizeStadiu(value)
  return stadiu ? getLabelRo(stadiu) : value
}

export function CardAstazi({ sugestie, vreme, onStropitAcum }: CardAstaziProps) {
  return (
    <section
      className="rounded-2xl p-4 text-white shadow-lg md:p-5"
      style={{ background: 'linear-gradient(135deg, var(--agri-primary), var(--agri-primary-dark))' }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-white/75">Astăzi</div>
          <div className="mt-1 text-lg font-bold capitalize leading-tight">{formatDateRo(new Date())}</div>
        </div>
        {vreme ? (
          <div className="flex items-center gap-1.5 text-right text-sm text-white/90">
            <CloudSun className="h-4 w-4" aria-hidden />
            <span>{vreme.temperatura}°C · {vreme.conditie}</span>
          </div>
        ) : null}
      </div>

      {sugestie ? (
        <div className="rounded-xl border border-white/15 bg-white/10 p-3">
          <div className="mb-1.5 text-xs text-white/75">
            Sugestie din {sugestie.sursa === 'plan' ? 'planul tău activ' : 'recomandări platformă'}
          </div>
          <div className="text-sm font-semibold leading-snug">
            {sugestie.produs.nume}
            {sugestie.produs.dozaText ? ` — ${sugestie.produs.dozaText}` : ''}
          </div>
          <div className="mt-1 text-xs text-white/75">
            {sugestie.titlu} · Fenofază: {formatFenofaza(sugestie.fenofazaCurenta)} · Parcelă {sugestie.parcela.nume}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/15 bg-white/10 p-3 text-sm text-white/80">
          Nu există o sugestie activă pentru azi.
        </div>
      )}

      <button
        type="button"
        onClick={onStropitAcum}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[var(--agri-primary-dark)] shadow-sm transition active:scale-[0.985]"
      >
        <Plus className="h-5 w-5" aria-hidden />
        Stropit acum
      </button>
    </section>
  )
}
