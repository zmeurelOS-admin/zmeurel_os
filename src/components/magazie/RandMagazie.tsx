'use client'

import { ListRow, ProgressBar, StatusPill, kitText } from '@/components/kit'
import { nivelBara, textAplicariRamase, type StocProdus } from '@/lib/magazie/stoc'
import { formatCantitateStoc } from '@/lib/magazie/unitati'
import { cn } from '@/lib/utils'

/** Un produs din Magazie: bara de nivel, cantitatea, „ajunge pentru ~N aplicări” și „pe terminate”. */
export function RandMagazie({ rand, onClick }: { rand: StocProdus; onClick: () => void }) {
  const ajunge = textAplicariRamase(rand.aplicari_ramase)
  const cantitate = formatCantitateStoc(rand.stoc, rand.unitate)
  return (
    <ListRow
      avatar={false}
      title={rand.nume}
      aria-label={`${rand.nume}: ${cantitate}${ajunge ? `, ${ajunge}` : ''}${rand.pe_terminate ? ', pe terminate' : ''}`}
      detail={
        <span className="flex flex-col gap-1.5">
          <span className={cn(rand.stoc < 0 && 'font-semibold text-danger-text')}>
            {cantitate}
            {ajunge ? ` · ${ajunge}` : ''}
          </span>
          <ProgressBar
            value={nivelBara(rand.stoc, rand.prag, rand.doza_ultima) * 100}
            max={100}
            tone={rand.stoc <= 0 ? 'danger' : rand.pe_terminate ? 'warning' : 'primary'}
            aria-label={`Nivel ${rand.nume}`}
            aria-valuetext={cantitate}
          />
        </span>
      }
      trailing={rand.pe_terminate ? <StatusPill tone={rand.stoc <= 0 ? 'danger' : 'warning'}>{rand.stoc < 0 ? 'negativ' : 'pe terminate'}</StatusPill> : undefined}
      onClick={onClick}
    />
  )
}

/** „Nu s-a putut încărca” / „după actualizarea bazei de date”, scris la fel în toate ecranele Magaziei. */
export function MagazieIndisponibila({ className }: { className?: string }) {
  return (
    <p className={cn('rounded-box bg-surface-muted px-3.5 py-3 text-fg-muted', kitText.secondary, className)}>
      Magazia va merge după actualizarea bazei de date. Tratamentele se salvează ca până acum.
    </p>
  )
}
