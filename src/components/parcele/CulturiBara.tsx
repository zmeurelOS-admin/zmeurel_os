'use client'

import type { Cultura } from '@/lib/supabase/queries/culturi'

interface CulturiBaraProps {
  suprafataTotala: number
  culturi: Cultura[]
}

export function CulturiBara({ suprafataTotala, culturi }: CulturiBaraProps) {
  const activeCulturi = culturi.filter((c) => c.activa)
  const ocupata = activeCulturi.reduce((sum, c) => sum + Number(c.suprafata_ocupata || 0), 0)
  const hasSuprafataData = activeCulturi.some((c) => c.suprafata_ocupata != null)

  if (!hasSuprafataData || suprafataTotala <= 0) return null

  const percent = Math.min(100, suprafataTotala > 0 ? (ocupata / suprafataTotala) * 100 : 0)
  const libera = Math.max(0, suprafataTotala - ocupata)
  const isOverflow = ocupata > suprafataTotala

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--agri-text)]">Suprafață ocupată</span>
        <span className={`font-semibold ${isOverflow ? 'text-red-600' : 'text-[var(--agri-text-muted)]'}`}>
          {ocupata.toFixed(0)} / {suprafataTotala.toFixed(0)} mp
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--agri-border)]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percent}%`,
            background: isOverflow ? '#ef4444' : percent > 85 ? '#f97316' : '#16a34a',
          }}
        />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[var(--agri-text-muted)]">
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full"
            style={{ background: isOverflow ? '#ef4444' : '#16a34a' }}
          />
          Ocupat: {ocupata.toFixed(0)} mp
        </span>
        {!isOverflow ? (
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--agri-border)]" />
            Liber: {libera.toFixed(0)} mp
          </span>
        ) : (
          <span className="font-semibold text-red-600">⚠️ Depășit cu {(ocupata - suprafataTotala).toFixed(0)} mp</span>
        )}
      </div>
    </div>
  )
}
