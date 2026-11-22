'use client'

import { CalendarDays, CloudSun } from 'lucide-react'

import { formatLei } from '@/lib/format-ro'
import { textVerificare, type VerificareProdus } from '@/lib/magazie/formular'
import { formatCantitateStoc } from '@/lib/magazie/unitati'
import { cn } from '@/lib/utils'

import { ListRow, Notice, Segments, StatusPill, SummaryList, SummaryRow, kitText } from '@/components/kit'
import type { Avertisment } from '@/lib/tratamente/avertismente'
import { ZiCuDataRo, ziCuDataRo, zileText } from '@/lib/tratamente/zile'

export type CandTip = 'acum' | 'alta_zi' | 'planifica'

export interface RezumatTratament {
  unde: string
  solutie: string | null
  /** Câte un rând pe produs, cu cantitatea calculată. */
  produse: string[]
  pauza: { zile: number; produs: string | null }
  /** Prima zi de recoltare, dacă tratamentul are pauză și nu e doar planificat. */
  panaLa: string | null
  parceleText: string
}

/** Ce spune magazia despre tratament (promptul 28). `null` = fără magazie (migrare neaplicată sau produse neurmărite). */
export interface MagazieTratament {
  verificari: VerificareProdus[]
  /** Costul estimat, doar pentru proprietar (`null` pentru operator sau fără prețuri). */
  cost: number | null
}

/** Pasul 3: când (făcut acum / altă zi / planifică), fereastra meteo, rezumatul și pauza rezultată. */
export function PasCand({
  cand,
  onCand,
  zi,
  onAlegeZi,
  meteo,
  avertismentMeteo,
  rezumat,
  magazie = null,
}: {
  cand: CandTip
  onCand: (cand: CandTip) => void
  zi: string | null
  onAlegeZi: () => void
  /** „Fără ploaie · vânt 6 km/h · 24 °C” (doar la stropire, la „Făcut acum”). `null` = fără prognoză. */
  meteo: { bun: boolean; detaliu: string } | null
  avertismentMeteo: Avertisment | null
  rezumat: RezumatTratament
  magazie?: MagazieTratament | null
}) {
  const lipsuri = magazie?.verificari.filter((verificare) => verificare.tip === 'lipsa') ?? []
  return (
    <div className="space-y-4">
      <Segments
        aria-label="Când"
        options={[
          { value: 'acum', label: 'Făcut acum' },
          { value: 'alta_zi', label: 'Altă zi' },
          { value: 'planifica', label: 'Planifică' },
        ]}
        value={cand}
        onValueChange={onCand}
      />

      {cand !== 'acum' ? (
        <ListRow
          avatar={false}
          leading={
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
              <CalendarDays />
            </span>
          }
          title={zi ? ZiCuDataRo(zi) : 'Alege ziua'}
          detail={cand === 'planifica' ? 'Ziua în care îl faci' : 'Ziua în care l-ai făcut'}
          onClick={onAlegeZi}
        />
      ) : null}

      {cand === 'acum' && meteo ? (
        avertismentMeteo ? (
          <Notice tone="warning" title={avertismentMeteo.titlu}>
            {avertismentMeteo.detaliu}
          </Notice>
        ) : (
          <Notice tone="success" icon={<CloudSun aria-hidden />} title={meteo.bun ? 'Bun de stropit acum' : 'Vremea de acum'}>
            {meteo.detaliu}
          </Notice>
        )
      ) : null}

      <SummaryList>
        <SummaryRow label="Unde" value={<span className="block whitespace-normal">{rezumat.unde}</span>} />
        {rezumat.solutie ? <SummaryRow label="Soluție" value={rezumat.solutie} /> : null}
        <SummaryRow
          label="Produse"
          value={
            rezumat.produse.length > 0
              ? rezumat.produse.map((linie) => (
                  <span key={linie} className="block whitespace-normal">
                    {linie}
                  </span>
                ))
              : '—'
          }
        />
        <SummaryRow
          label="Pauză"
          value={rezumat.pauza.zile > 0 ? `${zileText(rezumat.pauza.zile)}${rezumat.pauza.produs ? ` (${rezumat.pauza.produs})` : ''}` : 'Fără pauză'}
        />
      </SummaryList>

      {magazie ? (
        <section className="space-y-2" aria-labelledby="pas-cand-magazie">
          <h3 id="pas-cand-magazie" className={cn('px-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>
            Din magazie
          </h3>
          <ul className="space-y-2">
            {magazie.verificari.map((verificare, index) => (
              <li
                key={`${verificare.nume}-${index}`}
                className="flex min-h-touch items-center gap-3 rounded-box border border-border bg-surface px-3.5 py-2.5"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('truncate font-bold text-fg', kitText.base)}>
                    {verificare.nume}
                    {verificare.tip === 'ajunge' || verificare.tip === 'lipsa' ? ` · ${formatCantitateStoc(verificare.necesar, verificare.unitate)}` : ''}
                  </span>
                  <span className={cn('text-fg-muted', kitText.secondary)}>{textVerificare(verificare)}</span>
                </span>
                {verificare.tip === 'ajunge' ? <StatusPill tone="success">OK</StatusPill> : null}
                {verificare.tip === 'lipsa' ? <StatusPill tone="danger">{`lipsesc ${formatCantitateStoc(verificare.lipsesc, null)}`}</StatusPill> : null}
              </li>
            ))}
          </ul>
          {lipsuri.length > 0 ? (
            <Notice tone="warning" title={`Nu ajunge ${lipsuri.map((verificare) => verificare.nume).join(', ')}`}>
              Poți salva. Stocul apare negativ până treci intrarea.
            </Notice>
          ) : null}
          {magazie.cost !== null ? (
            <div className="flex min-h-touch items-center justify-between gap-3 rounded-box bg-surface-muted px-3.5 py-2.5">
              <span className={cn('text-fg', kitText.base)}>
                Cost estimat <span className={cn('text-fg-muted', kitText.helper)}>· doar tu vezi</span>
              </span>
              <span className={cn('font-extrabold tabular-nums text-fg', kitText.base)}>{formatLei(Math.round(magazie.cost))}</span>
            </div>
          ) : null}
          <p className={cn('px-1 text-fg-muted', kitText.helper)}>Abia un tratament făcut scade din magazie; cel planificat nu.</p>
        </section>
      ) : null}

      {cand === 'planifica' ? (
        <Notice tone="info" title={zi ? `Planificat ${ziCuDataRo(zi)}` : 'Alege ziua'}>
          Apare în Acasă la „De făcut azi”, cu notificare dimineața. Pauza începe când îl marchezi făcut.
        </Notice>
      ) : rezumat.panaLa ? (
        <Notice tone="warning" title={`Nu recolta din ${rezumat.parceleText} până ${ziCuDataRo(rezumat.panaLa)}`}>
          {cand === 'acum' ? 'Apare în jurnal, în Acasă și în Recoltări.' : 'Pauza se socotește de la ziua în care ai aplicat.'}
        </Notice>
      ) : (
        <Notice tone="success" title="Fără pauză">
          Poți recolta oricând din aceste parcele.
        </Notice>
      )}
    </div>
  )
}
