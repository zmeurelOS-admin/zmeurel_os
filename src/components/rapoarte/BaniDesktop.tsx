'use client'

import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'

import { Button, GraficBare, SectiuneFisa, StatTile, kitText } from '@/components/kit'
import { formatKg, formatLei, formatNumber, shortDateRo } from '@/lib/format-ro'
import type { MiscareStoc } from '@/lib/magazie/stoc'
import { documentHtml, documentRegistruCasa, numeFisier } from '@/lib/rapoarte/export'
import { ETICHETA_COMUNE, profitPeParcele, REGULA_PROFIT_PARCELA, TITLU_PROFIT_PARCELA, type IesireMagazieParcela } from '@/lib/rapoarte/profit-parcela'
import { luniRaport, peClienti, peCulegatori, perioadaRaport, sumarRaport, type DateRaport, type TipPerioada } from '@/lib/rapoarte/raport'
import { luniCuMiscari, registruCasa } from '@/lib/rapoarte/registru-casa'
import { cn } from '@/lib/utils'

const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
const numeLuna = (luna: string) => `${LUNI[Number(luna.slice(5, 7)) - 1]} ${luna.slice(0, 4)}`
const lei = (valoare: number) => (valoare < 0 ? `− ${formatLei(Math.abs(valoare))}` : formatLei(valoare))

function descarcaXls(nume: string, html: string) {
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nume
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function tipareste(html: string) {
  const fereastra = window.open('', '_blank')
  if (!fereastra) return
  fereastra.document.write(html)
  fereastra.document.close()
  fereastra.focus()
  fereastra.print()
}

export interface BaniDesktopProps {
  azi: string
  tip: TipPerioada
  date: DateRaport
  magazieMiscari: readonly MiscareStoc[]
  iesiriParcele: readonly IesireMagazieParcela[]
  /** Deschide exporturile existente (raportul perioadei, registrul de tratamente). */
  onExporturi: () => void
}

/**
 * Bani și rapoarte pe desktop (promptul 35, §8, varianta B), doar proprietarul: cifrele perioadei, venitul și
 * cheltuielile pe luni, profitul ESTIMAT pe parcelă (cu regula scrisă și rândul „Comune, neîmpărțite pe parcele”),
 * registrul de încasări și plăți pe lună și „Registre și exporturi”.
 */
export function BaniDesktop({ azi, tip, date, magazieMiscari, iesiriParcele, onExporturi }: BaniDesktopProps) {
  const perioada = useMemo(() => perioadaRaport(tip, azi, date.recoltari), [azi, date.recoltari, tip])
  const sumar = useMemo(() => sumarRaport(date, perioada), [date, perioada])
  // Graficul pe luni arată tot anul până azi, oricare ar fi perioada aleasă (pe o lună n-ar avea ce compara).
  const luni = useMemo(() => luniRaport(date, { start: tip === 'luna' ? `${azi.slice(0, 4)}-01-01` : perioada.start, end: perioada.end }), [azi, date, perioada, tip])
  const profit = useMemo(
    () =>
      profitPeParcele({
        recoltari: date.recoltari,
        parcele: date.parcele,
        vanzari: date.vanzari,
        cheltuieli: date.cheltuieli,
        miscariMagazie: magazieMiscari,
        iesiri: iesiriParcele,
        start: perioada.start,
        end: perioada.end,
      }),
    [date, iesiriParcele, magazieMiscari, perioada],
  )
  const culegatori = useMemo(() => peCulegatori(date, perioada).slice(0, 8), [date, perioada])
  const clienti = useMemo(() => peClienti(date, perioada).slice(0, 8), [date, perioada])

  const luniRegistru = useMemo(
    () => luniCuMiscari(azi, [...date.vanzari.map((vanzare) => vanzare.data_incasare ?? vanzare.data), ...date.cheltuieli.map((cheltuiala) => cheltuiala.data), ...date.investitii.map((investitie) => investitie.data)]),
    [azi, date.cheltuieli, date.investitii, date.vanzari],
  )
  const [luna, setLuna] = useState(azi.slice(0, 7))
  const numeClienti = useMemo(() => new Map(date.clienti.map((client) => [client.id, client.nume_client?.trim() || 'Client'])), [date.clienti])
  const registru = useMemo(
    () => registruCasa({ luna, vanzari: date.vanzari, butasi: date.butasi, cheltuieli: date.cheltuieli, investitii: date.investitii, numeClient: (id) => (id ? (numeClienti.get(id) ?? 'Client') : 'Client fără nume') }),
    [date.butasi, date.cheltuieli, date.investitii, date.vanzari, luna, numeClienti],
  )
  const docRegistru = () => documentRegistruCasa(registru)

  return (
    <div className="hidden space-y-4 pb-8 pt-3 lg:block">
      <section aria-label={`Cifrele ${perioada.eticheta}`} className="grid grid-cols-5 gap-3">
        <StatTile tone="inverse" value={formatLei(sumar.incasat)} label={`Venit ${perioada.eticheta}`} />
        <StatTile value={formatLei(sumar.cheltuieli)} label="Cheltuieli" />
        <StatTile tone={sumar.profit < 0 ? 'warning' : 'neutral'} value={lei(sumar.profit)} label="Profit · încasat − cheltuieli" />
        <StatTile value={formatLei(sumar.investitii.totalLei)} label="Investiții · separat, nu scad din profit" />
        <StatTile value={formatNumber(sumar.recoltatKg)} unit="kg" label="Recoltat" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectiuneFisa titlu="Venit și cheltuieli pe luni">
          {luni.every((item) => item.incasat === 0 && item.cheltuieli === 0) ? (
            <p className={cn('text-fg-muted', kitText.secondary)}>Nimic încasat sau cheltuit în perioada aleasă.</p>
          ) : (
            <GraficBare
              eticheta="Venitul și cheltuielile pe luni, în lei"
              bare={luni.map((item) => ({ cheie: item.luna, eticheta: item.eticheta, valoare: item.incasat, comparatie: item.cheltuieli }))}
              formatare={(valoare) => formatLei(valoare)}
              legenda={['Venit', 'Cheltuieli']}
              comparatieTon="alerta"
              inaltime={200}
            />
          )}
        </SectiuneFisa>

        <SectiuneFisa titlu={TITLU_PROFIT_PARCELA}>
          {profit.parcele.length === 0 ? (
            <p className={cn('text-fg-muted', kitText.secondary)}>Nicio recoltare și nicio cheltuială directă pe parcele {perioada.eticheta}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={cn('w-full border-collapse text-fg', kitText.secondary)}>
                <caption className="sr-only">{TITLU_PROFIT_PARCELA}</caption>
                <thead>
                  <tr className="text-left text-fg-muted">
                    <th scope="col" className="py-1.5 pr-2 font-bold">Parcelă</th>
                    <th scope="col" className="py-1.5 pr-2 text-right font-bold">kg</th>
                    <th scope="col" className="py-1.5 pr-2 text-right font-bold">Venit estimat</th>
                    <th scope="col" className="py-1.5 pr-2 text-right font-bold">Directe</th>
                    <th scope="col" className="py-1.5 text-right font-bold">Rezultat</th>
                  </tr>
                </thead>
                <tbody>
                  {profit.parcele.map((rand) => (
                    <tr key={rand.id} className="border-t border-border-subtle">
                      <th scope="row" className="py-1.5 pr-2 text-left font-semibold">{rand.nume}</th>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-right tabular-nums">{formatNumber(rand.kg)}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-right tabular-nums">{rand.venit === null ? '—' : formatLei(rand.venit)}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-right tabular-nums" title={`cules ${formatLei(rand.cules)} · tratamente ${formatLei(rand.tratamente)}`}>
                        {formatLei(rand.directe)}
                      </td>
                      <td className="py-1.5 text-right font-bold tabular-nums">{rand.rezultat === null ? '—' : lei(rand.rezultat)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border-subtle text-fg-muted">
                    <th scope="row" className="py-1.5 pr-2 text-left font-semibold">{ETICHETA_COMUNE}</th>
                    <td className="py-1.5 pr-2" />
                    <td className="py-1.5 pr-2" />
                    <td className="py-1.5 pr-2 whitespace-nowrap text-right tabular-nums">{formatLei(profit.comune)}</td>
                    <td className="py-1.5 whitespace-nowrap text-right tabular-nums">{lei(-profit.comune)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <th scope="row" className="py-1.5 pr-2 text-left">Total estimat</th>
                    <td colSpan={3} />
                    <td className="py-1.5 whitespace-nowrap text-right tabular-nums">{profit.total === null ? '—' : lei(profit.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className={cn('text-fg-muted', kitText.helper)}>
            {profit.pretMediuKg === null ? 'Nicio vânzare încasată în perioadă: venitul pe parcelă nu se poate estima. ' : `Preț mediu încasat: ${formatLei(profit.pretMediuKg)}/kg. `}
            {REGULA_PROFIT_PARCELA}
          </p>
        </SectiuneFisa>
      </div>

      <SectiuneFisa
        titlu={`Registrul de încasări și plăți · ${numeLuna(luna)}`}
        dreapta={
          <div className="flex flex-wrap items-center gap-2">
            <label className={cn('flex items-center gap-2 text-fg-muted', kitText.secondary)}>
              Luna
              <select
                value={luna}
                onChange={(event) => setLuna(event.target.value)}
                className={cn('h-touch rounded-control border border-border bg-surface px-3 text-fg', kitText.base)}
              >
                {luniRegistru.map((item) => (
                  <option key={item} value={item}>
                    {numeLuna(item)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="neutral" size="touch" onClick={() => descarcaXls(numeFisier(`registru-incasari-plati-${luna}`, azi, 'xls'), documentHtml(docRegistru()))}>
              <FileSpreadsheet aria-hidden />
              Excel
            </Button>
            <Button type="button" variant="neutral" size="touch" onClick={() => tipareste(documentHtml(docRegistru(), true))}>
              <Printer aria-hidden />
              PDF
            </Button>
          </div>
        }
      >
        {registru.randuri.length === 0 ? (
          <p className={cn('text-fg-muted', kitText.secondary)}>Nicio încasare și nicio plată în {numeLuna(luna)}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn('w-full border-collapse text-fg', kitText.secondary)}>
              <caption className="sr-only">Registrul de încasări și plăți, {numeLuna(luna)}</caption>
              <thead>
                <tr className="text-left text-fg-muted">
                  <th scope="col" className="py-1.5 pr-3 font-bold">Data</th>
                  <th scope="col" className="py-1.5 pr-3 font-bold">Explicație</th>
                  <th scope="col" className="py-1.5 pr-3 font-bold">Bon</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-bold">Încasări</th>
                  <th scope="col" className="py-1.5 text-right font-bold">Plăți</th>
                </tr>
              </thead>
              <tbody>
                {registru.randuri.map((rand) => (
                  <tr key={rand.id} className="border-t border-border-subtle">
                    <td className="whitespace-nowrap py-1.5 pr-3">{shortDateRo(rand.data)}</td>
                    <td className="py-1.5 pr-3">{rand.explicatie}</td>
                    <td className="py-1.5 pr-3 text-fg-muted">{rand.document ? 'Da' : '—'}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-right tabular-nums text-success-text">{rand.incasare > 0 ? formatLei(rand.incasare) : ''}</td>
                    <td className="py-1.5 whitespace-nowrap text-right tabular-nums">{rand.plata > 0 ? formatLei(rand.plata) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <th scope="row" colSpan={3} className="py-1.5 pr-3 text-left">
                    Total · diferența {lei(registru.diferenta)}
                  </th>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-right tabular-nums">{formatLei(registru.totalIncasari)}</td>
                  <td className="py-1.5 whitespace-nowrap text-right tabular-nums">{formatLei(registru.totalPlati)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className={cn('text-fg-muted', kitText.helper)}>
          Încasările intră la ziua încasării (ca în Rapoarte), plățile sunt cheltuielile și investițiile. Fără sold: caietul nu știe cât era în casă la început.
        </p>
      </SectiuneFisa>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectiuneFisa titlu="Pe culegători">
          {culegatori.length === 0 ? (
            <p className={cn('text-fg-muted', kitText.secondary)}>Nicio recoltare în perioadă.</p>
          ) : (
            <ul className={cn('space-y-1.5 text-fg', kitText.secondary)}>
              {culegatori.map((rand) => (
                <li key={rand.id} className="flex flex-wrap justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold">{rand.nume}</span>
                  <span className="tabular-nums">
                    {formatKg(rand.kg)} · {formatLei(rand.plata)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectiuneFisa>
        <SectiuneFisa titlu="Pe clienți (încasat)">
          {clienti.length === 0 ? (
            <p className={cn('text-fg-muted', kitText.secondary)}>Nicio vânzare încasată în perioadă.</p>
          ) : (
            <ul className={cn('space-y-1.5 text-fg', kitText.secondary)}>
              {clienti.map((rand) => (
                <li key={rand.id} className="flex flex-wrap justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold">{rand.nume}</span>
                  <span className="tabular-nums">{formatLei(rand.incasat)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectiuneFisa>
        <SectiuneFisa titlu="Registre și exporturi" className="scroll-mt-4">
          <div id="registre" className="space-y-2">
            <p className={cn('text-fg-muted', kitText.secondary)}>Raportul perioadei și registrul de tratamente (ANSVSA), în Excel sau PDF.</p>
            <Button type="button" variant="primary" size="touch" onClick={onExporturi}>
              <Download aria-hidden />
              Exportă raportul sau registrul de tratamente
            </Button>
            <Button type="button" variant="neutral" size="touch" onClick={() => descarcaXls(numeFisier(`registru-incasari-plati-${luna}`, azi, 'xls'), documentHtml(docRegistru()))}>
              <FileSpreadsheet aria-hidden />
              Registrul de încasări și plăți · {numeLuna(luna)}
            </Button>
          </div>
        </SectiuneFisa>
      </div>
    </div>
  )
}
