import { eticheteSaptamani, inceputSaptamana, type SaptamanaCapturi } from '@/lib/capcane'
import { kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

export interface SemnTratament {
  zi: string
  text: string
}

/**
 * Graficul pe parcelă: totalul capturilor pe săptămână (bare), linia punctată a pragului și tratamentele aplicate pe
 * parcelă (💧 sub săptămâna lor), ca să se vadă dacă au avut efect.
 */
export function GraficCapcane({
  saptamani,
  pestePrag,
  pragCapturi,
  tratamente,
}: {
  saptamani: readonly SaptamanaCapturi[]
  /** Aceeași lungime ca `saptamani`. */
  pestePrag: readonly boolean[]
  /** Capturile la prag pentru grup (prag × bucăți), sau `null` fără prag. */
  pragCapturi: number | null
  tratamente: readonly SemnTratament[]
}) {
  const maxim = Math.max(1, pragCapturi ?? 0, ...saptamani.map((s) => s.capturi ?? 0)) * 1.15
  const etichete = eticheteSaptamani(saptamani.map((s) => s.start))
  const tratamentePeSaptamana = new Set(tratamente.map((t) => inceputSaptamana(t.zi)))
  const descriere = saptamani
    .map((s, i) => `${etichete[i]}: ${s.capturi === null ? 'neverificat' : s.capturi}${pestePrag[i] ? ' (peste prag)' : ''}${tratamentePeSaptamana.has(s.start) ? ', tratament' : ''}`)
    .join('; ')

  return (
    <figure className="space-y-2" aria-label={`Capturi pe săptămână. ${descriere}`}>
      <div className="relative h-[150px] rounded-box border border-border bg-surface px-2 pb-1 pt-6" aria-hidden>
        <div className="relative flex h-full items-end gap-1.5">
          {pragCapturi !== null ? (
            <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-warning" style={{ bottom: `${(pragCapturi / maxim) * 100}%` }} />
          ) : null}
          {saptamani.map((s, i) => {
            const inaltime = s.capturi === null ? 0 : Math.max(3, (s.capturi / maxim) * 100)
            return (
              <div key={s.start} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                {s.capturi !== null ? (
                  <span className={cn('mb-0.5 font-bold', kitText.helper, pestePrag[i] ? 'text-warning-text' : 'text-fg-muted')}>{s.capturi}</span>
                ) : (
                  <span className={cn('mb-0.5 text-fg-subtle', kitText.helper)}>–</span>
                )}
                <div
                  className={cn('w-full max-w-[32px] rounded-t-control', s.capturi === null ? 'bg-transparent' : pestePrag[i] ? 'bg-warning' : 'bg-primary')}
                  style={{ height: `${inaltime}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-1.5 px-2" aria-hidden>
        {saptamani.map((s, i) => (
          <span key={s.start} className={cn('min-w-0 flex-1 truncate text-center text-fg-muted', kitText.helper)}>
            {etichete[i]}
            {tratamentePeSaptamana.has(s.start) ? <span className="block">💧</span> : null}
          </span>
        ))}
      </div>
    </figure>
  )
}
