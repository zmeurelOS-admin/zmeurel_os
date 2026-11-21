'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { Download } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { Button, EmptyState, ListRow, Segments, StatHero, StatTile, kitText } from '@/components/kit'
import { ExportRaportSheet } from '@/components/rapoarte/ExportRaportSheet'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { formatKg, formatLei, formatNumber } from '@/lib/format-ro'
import {
  luniRaport,
  peClienti,
  peCulegatori,
  peParcele,
  perioadaRaport,
  sumarRaport,
  type DateRaport,
  type LunaRaport,
  type TipPerioada,
} from '@/lib/rapoarte/raport'
import { aziRo } from '@/lib/tratamente/zile'
import { cn } from '@/lib/utils'

function subscribeToDayChange(onChange: () => void) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(onChange, 60_000)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
const readToday = () => aziRo()
const noServerDay = () => null

type Lista = 'parcele' | 'culegatori' | 'clienti'

/** „24.180 lei” / „− 1.200 lei”. */
function lei(valoare: number): string {
  return valoare < 0 ? `− ${formatLei(Math.abs(valoare))}` : formatLei(valoare)
}

function GraficLuni({ luni }: { luni: LunaRaport[] }) {
  const max = Math.max(1, ...luni.flatMap((luna) => [luna.incasat, luna.cheltuieli]))
  const gol = luni.every((luna) => luna.incasat === 0 && luna.cheltuieli === 0)
  return (
    <section aria-labelledby="rapoarte-grafic" className="space-y-3 rounded-box border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="rapoarte-grafic" className={cn('font-bold text-fg', kitText.secondary)}>
          Încasat și cheltuieli, pe luni
        </h2>
        <span className={cn('flex items-center gap-3 text-fg-muted', kitText.helper)} aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            Încasat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-fg-subtle" />
            Cheltuieli
          </span>
        </span>
      </div>
      {gol ? (
        <p className={cn('text-fg-muted', kitText.secondary)}>Nimic încasat sau cheltuit în perioada aleasă.</p>
      ) : (
        <ul className="flex h-32 items-end gap-2 overflow-x-auto pb-0.5">
          {luni.map((luna) => (
            <li key={luna.luna} className="flex h-full min-w-9 flex-1 flex-col items-center justify-end gap-1">
              <span className="sr-only">
                {luna.eticheta}: încasat {formatLei(luna.incasat)}, cheltuieli {formatLei(luna.cheltuieli)}
              </span>
              <span className="flex h-full w-full items-end justify-center gap-0.5" aria-hidden>
                <span className="w-1/2 max-w-5 rounded-t-md bg-primary" style={{ height: `${Math.max(luna.incasat > 0 ? 3 : 0, (luna.incasat / max) * 100)}%` }} />
                <span className="w-1/2 max-w-5 rounded-t-md bg-fg-subtle" style={{ height: `${Math.max(luna.cheltuieli > 0 ? 3 : 0, (luna.cheltuieli / max) * 100)}%` }} />
              </span>
              <span className={cn('text-fg-muted', kitText.helper)} aria-hidden>
                {luna.eticheta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const cifra = (text: string) => <span className={cn('whitespace-nowrap font-extrabold tabular-nums text-fg', kitText.base)}>{text}</span>

export function RapoartePageClient({ date }: { date: DateRaport }) {
  useTrackModuleView('rapoarte')
  const azi = useSyncExternalStore(subscribeToDayChange, readToday, noServerDay)
  const [tip, setTip] = useState<TipPerioada>('sezon')
  const [lista, setLista] = useState<Lista>('parcele')
  const [exportOpen, setExportOpen] = useState(false)

  const perioada = useMemo(() => (azi ? perioadaRaport(tip, azi, date.recoltari) : null), [azi, tip, date.recoltari])
  const sumar = useMemo(() => (perioada ? sumarRaport(date, perioada) : null), [date, perioada])
  const luni = useMemo(() => (perioada ? luniRaport(date, perioada) : []), [date, perioada])
  const parcele = useMemo(() => (perioada ? peParcele(date, perioada) : []), [date, perioada])
  const culegatori = useMemo(() => (perioada ? peCulegatori(date, perioada) : []), [date, perioada])
  const clienti = useMemo(() => (perioada ? peClienti(date, perioada) : []), [date, perioada])

  let randuri: React.ReactNode
  if (lista === 'parcele') {
    randuri = parcele.map((parcela) => (
      <li key={parcela.id}>
        <ListRow
          avatar={false}
          title={parcela.nume}
          detail={
            parcela.personal
              ? 'Personal · nu intră la kg recoltate'
              : parcela.nrPlante
                ? `${formatNumber(parcela.nrPlante)} plante · ${formatNumber(parcela.kgPePlanta ?? 0, 1)} kg/plantă`
                : 'Fără număr de plante'
          }
          trailing={cifra(formatKg(parcela.kg))}
        />
      </li>
    ))
  } else if (lista === 'culegatori') {
    randuri = culegatori.map((culegator) => (
      <li key={culegator.id}>
        <ListRow title={culegator.nume} detail={`Plată ${formatLei(culegator.plata)}`} trailing={cifra(formatKg(culegator.kg))} />
      </li>
    ))
  } else {
    randuri = clienti.map((client) => (
      <li key={client.id}>
        <ListRow title={client.nume} detail="încasat" trailing={cifra(formatLei(client.incasat))} />
      </li>
    ))
  }
  const listaGoala = (lista === 'parcele' ? parcele : lista === 'culegatori' ? culegatori : clienti).length === 0

  return (
    <AppShell
      header={
        <ScreenHeader
          title="Rapoarte"
          backHref="/mai-mult"
          right={
            <Button type="button" variant="quiet" size="icon-touch" aria-label="Exportă" disabled={!perioada} onClick={() => setExportOpen(true)}>
              <Download aria-hidden />
            </Button>
          }
        />
      }
    >
      <ScreenBody className="space-y-3.5 pb-8">
        <Segments
          aria-label="Perioada"
          options={[
            { value: 'luna', label: 'Luna' },
            { value: 'sezon', label: 'Sezonul' },
            { value: 'an', label: 'Anul' },
          ]}
          value={tip}
          onValueChange={setTip}
        />

        {sumar && perioada ? (
          <>
            <StatHero
              label={`Profit ${perioada.eticheta}`}
              value={(sumar.profit < 0 ? '− ' : '') + formatNumber(Math.abs(sumar.profit))}
              unit="lei"
              footer={<p className={cn('font-semibold opacity-85', kitText.secondary)}>încasat − cheltuieli, fără investiții</p>}
            />

            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Încasat" value={formatNumber(sumar.incasat)} unit="lei" />
              <StatTile label="Cheltuieli" value={formatNumber(sumar.cheltuieli)} unit="lei" />
              <StatTile label="Recoltat" value={formatNumber(sumar.recoltatKg)} unit="kg" />
              <StatTile label="Investiții · separat" value={formatNumber(sumar.investitii.totalLei)} unit="lei" />
            </div>
            {sumar.investitii.count > 0 ? (
              <p className={cn('-mt-1 px-1 text-fg-muted', kitText.helper)}>
                {sumar.investitii.count === 1 ? 'O investiție' : `${sumar.investitii.count} investiții`} {perioada.eticheta}:{' '}
                {sumar.investitii.peCategorii.map((item) => `${item.categorie} ${lei(item.lei)}`).join(', ')}. Nu scad din profit.
              </p>
            ) : null}

            <GraficLuni luni={luni} />

            <Segments
              aria-label="Lista"
              panelId="rapoarte-lista"
              options={[
                { value: 'parcele', label: 'Parcele' },
                { value: 'culegatori', label: 'Culegători' },
                { value: 'clienti', label: 'Clienți' },
              ]}
              value={lista}
              onValueChange={setLista}
            />
            <div id="rapoarte-lista">
              {listaGoala ? (
                <EmptyState
                  title={lista === 'clienti' ? 'Nimic încasat' : 'Nicio recoltare'}
                  description={lista === 'clienti' ? 'Nicio vânzare încasată în perioada aleasă.' : 'Nicio recoltare în perioada aleasă.'}
                />
              ) : (
                <ul className="space-y-2">{randuri}</ul>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3" aria-busy="true" aria-label="Se calculează raportul">
            <div className="h-36 animate-pulse rounded-card bg-surface-muted" />
            <div className="h-40 animate-pulse rounded-box bg-surface-muted" />
          </div>
        )}
      </ScreenBody>

      {perioada && sumar && azi ? (
        <ExportRaportSheet
          open={exportOpen}
          onOpenChange={setExportOpen}
          azi={azi}
          perioada={perioada}
          date={date}
          sumar={sumar}
          luni={luni}
          parcele={parcele}
          culegatori={culegatori}
          clienti={clienti}
        />
      ) : null}
    </AppShell>
  )
}
