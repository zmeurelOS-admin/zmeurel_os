'use client'

import { Droplets, Mountain, RotateCcw, SprayCan, SquareDashed } from 'lucide-react'

import { ListRow, StepFormTitle, Tile, TileGroup, kitText } from '@/components/kit'
import type { MetodaFormular } from '@/lib/tratamente/model'
import { cn } from '@/lib/utils'

export interface RepetaOptiune {
  key: string
  titlu: string
  detaliu: string
  metoda: MetodaFormular
}

const ICON: Record<MetodaFormular, React.ReactNode> = {
  stropire: <SprayCan aria-hidden />,
  fertirigare: <Droplets aria-hidden />,
  sol: <Mountain aria-hidden />,
}

/** Pasul 1: „Repetă” un tratament anterior sau alege metoda. Capcanele au tab-ul lor (montare, verificare): aici apar doar ca trimitere. */
export function PasMetoda({
  repeta,
  onRepeta,
  onMetoda,
}: {
  repeta: readonly RepetaOptiune[]
  onRepeta: (key: string) => void
  onMetoda: (metoda: MetodaFormular) => void
}) {
  return (
    <div className="space-y-4">
      <StepFormTitle>Ce faci?</StepFormTitle>

      {repeta.length > 0 ? (
        <section className="space-y-2" aria-label="Repetă">
          <p className={cn('font-bold text-fg', kitText.secondary)}>Repetă</p>
          <ul className="space-y-2">
            {repeta.map((item) => (
              <li key={item.key}>
                <ListRow
                  avatar={false}
                  leading={
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-5" aria-hidden>
                      <RotateCcw />
                    </span>
                  }
                  title={item.titlu}
                  detail={item.detaliu}
                  onClick={() => onRepeta(item.key)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2" aria-label="Sau alege">
        <p className={cn('font-bold text-fg', kitText.secondary)}>{repeta.length > 0 ? 'Sau alege' : 'Alege'}</p>
        <TileGroup type="single" value={null} onValueChange={() => undefined} aria-label="Metoda">
          <Tile value="stropire" leading={ICON.stropire} title="Stropire" subtitle="Fungicid, insecticid, foliar" onClick={() => onMetoda('stropire')} />
          <Tile value="fertirigare" leading={ICON.fertirigare} title="Fertirigare" subtitle="Prin picurare, pe parcele" onClick={() => onMetoda('fertirigare')} />
          <Tile value="sol" leading={ICON.sol} title="La sol" subtitle="Granulat, îngrășământ de bază" onClick={() => onMetoda('sol')} />
          <Tile leading={<SquareDashed aria-hidden />} title="Capcane" subtitle="În tab-ul Capcane, din Tratamente" disabled />
        </TileGroup>
      </section>
    </div>
  )
}
