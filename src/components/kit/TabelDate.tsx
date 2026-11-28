'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { catreCsv, descarcaCsv, numeFisierCsv, type CelulaCsv } from '@/lib/export/csv'
import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export interface ColoanaTabel<T> {
  id: string
  titlu: string
  /** Valoarea pentru sortare și export. */
  valoare: (rand: T) => string | number | null
  /** Ce se arată în celulă (implicit valoarea). */
  afisare?: (rand: T) => ReactNode
  aliniere?: 'stanga' | 'dreapta'
  /** Celula din rândul de totaluri (primește rândurile afișate). */
  total?: (randuri: readonly T[]) => ReactNode
  /** Valoarea din CSV, dacă diferă (ex. număr brut în loc de „1.250 lei”). `false` = coloana nu intră în export. */
  csv?: ((rand: T) => CelulaCsv) | false
  /** Fără sortare pe coloana asta. */
  faraSortare?: boolean
}

export interface TabelDateProps<T> {
  coloane: ReadonlyArray<ColoanaTabel<T>>
  randuri: readonly T[]
  cheie: (rand: T) => string
  /** Numele tabelului pentru cititoarele de ecran (ex. „Comenzile”). */
  eticheta: string
  /** Clic pe un rând: deschide elementul (în Listă, cu `?id=`). */
  onDeschide?: (rand: T) => void
  /** Bife pe rânduri + bara de acțiuni în bloc. */
  selectie?: boolean
  /** Acțiunile în bloc pentru rândurile bifate (apare doar cu cel puțin o bifă). */
  actiuniBloc?: (selectate: T[], golesteSelectia: () => void) => ReactNode
  /** Baza numelui fișierului exportat (`comenzi` → `comenzi-2026-11-28.csv`). Lipsă = fără buton de export. */
  numeExport?: string
  /** Ziua de azi (ISO), pentru numele fișierului. */
  aziIso?: string
  /** Rânduri pe pagină când sunt multe (implicit 100, de la 500 de rânduri în sus). */
  pePagina?: number
  /** Deasupra tabelului, în stânga barei (ex. filtrele). */
  sus?: ReactNode
  /** Tabelul gol. */
  gol?: ReactNode
  className?: string
}

const PRAG_PAGINI = 500

/** Rândurile și capul pentru CSV, în ordinea afișată. Pur, testat. */
export function randuriCsv<T>(coloane: ReadonlyArray<ColoanaTabel<T>>, randuri: readonly T[]): { cap: string[]; randuri: CelulaCsv[][] } {
  const exportate = coloane.filter((coloana) => coloana.csv !== false)
  return {
    cap: exportate.map((coloana) => coloana.titlu),
    randuri: randuri.map((rand) => exportate.map((coloana) => (typeof coloana.csv === 'function' ? coloana.csv(rand) : coloana.valoare(rand)))),
  }
}

/**
 * Tabelul pe toată lățimea (promptul 35, §4): coloane sortabile, totaluri jos, selecție multiplă cu acțiuni în bloc,
 * export CSV (descărcare din browser). Peste `@tanstack/react-table` (deja în proiect).
 */
export function TabelDate<T>({
  coloane,
  randuri,
  cheie,
  eticheta,
  onDeschide,
  selectie = false,
  actiuniBloc,
  numeExport,
  aziIso,
  pePagina = 100,
  sus,
  gol,
  className,
}: TabelDateProps<T>) {
  const [sortare, setSortare] = useState<SortingState>([])
  const [bife, setBife] = useState<RowSelectionState>({})
  const [pagina, setPagina] = useState(0)

  const definitii = useMemo<ColumnDef<T>[]>(
    () =>
      coloane.map((coloana) => ({
        id: coloana.id,
        accessorFn: (rand: T) => coloana.valoare(rand),
        header: coloana.titlu,
        enableSorting: !coloana.faraSortare,
        sortUndefined: 'last',
        sortingFn: (a, b, id) => {
          const x = a.getValue<string | number | null>(id)
          const y = b.getValue<string | number | null>(id)
          if (x === y) return 0
          if (x === null || x === '') return 1
          if (y === null || y === '') return -1
          if (typeof x === 'number' && typeof y === 'number') return x - y
          return String(x).localeCompare(String(y), 'ro', { numeric: true, sensitivity: 'base' })
        },
      })),
    [coloane],
  )

  // TanStack Table întoarce funcții nememoizabile; componenta nu e memoizată de React Compiler, deci e în regulă.
  // eslint-disable-next-line react-hooks/incompatible-library
  const tabel = useReactTable({
    data: randuri as T[],
    columns: definitii,
    state: { sorting: sortare, rowSelection: bife },
    onSortingChange: setSortare,
    onRowSelectionChange: setBife,
    getRowId: (rand) => cheie(rand),
    enableRowSelection: selectie,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const toate = tabel.getRowModel().rows
  const cuPagini = toate.length > PRAG_PAGINI
  const nrPagini = cuPagini ? Math.ceil(toate.length / pePagina) : 1
  const paginaEfectiva = Math.min(pagina, nrPagini - 1)
  const vizibile = cuPagini ? toate.slice(paginaEfectiva * pePagina, (paginaEfectiva + 1) * pePagina) : toate
  const afisate = toate.map((rand) => rand.original)
  const selectate = tabel.getSelectedRowModel().rows.map((rand) => rand.original)
  const golesteSelectia = () => setBife({})
  const areTotaluri = coloane.some((coloana) => coloana.total)

  const exporta = () => {
    if (!numeExport) return
    const sursa = selectate.length > 0 ? afisate.filter((rand) => selectate.includes(rand)) : afisate
    const date = randuriCsv(coloane, sursa)
    descarcaCsv(numeFisierCsv(numeExport, aziIso ?? new Date().toISOString().slice(0, 10)), catreCsv(date.cap, date.randuri))
  }

  const toateBifate = toate.length > 0 && toate.every((rand) => rand.getIsSelected())
  const catevaBifate = !toateBifate && toate.some((rand) => rand.getIsSelected())

  return (
    <div className={cn('hidden space-y-3 lg:block', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{sus}</div>
        <div className="flex flex-wrap items-center gap-2">
          {selectie && selectate.length > 0 ? (
            <>
              <span className={cn('font-semibold text-fg', kitText.secondary)}>{selectate.length} selectate</span>
              {actiuniBloc?.(selectate, golesteSelectia)}
              <Button type="button" variant="quiet" size="touch" onClick={golesteSelectia}>
                Deselectează
              </Button>
            </>
          ) : null}
          {numeExport ? (
            <Button type="button" variant="neutral" size="touch" onClick={exporta} disabled={afisate.length === 0}>
              <Download aria-hidden />
              {selectate.length > 0 ? 'Exportă selectatele' : 'Exportă CSV'}
            </Button>
          ) : null}
        </div>
      </div>

      {toate.length === 0 ? (
        <div className="rounded-box border border-border bg-surface p-4">{gol}</div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-border bg-surface">
          <table aria-label={eticheta} className={cn('w-full border-collapse text-fg', kitText.secondary)}>
            <thead className="bg-surface-muted">
              <tr>
                {selectie ? (
                  <th scope="col" className="w-12 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      aria-label="Selectează toate rândurile"
                      checked={toateBifate}
                      ref={(el) => {
                        if (el) el.indeterminate = catevaBifate
                      }}
                      onChange={(event) => tabel.toggleAllRowsSelected(event.target.checked)}
                      className={cn('size-5 accent-primary', kitFocus)}
                    />
                  </th>
                ) : null}
                {tabel.getHeaderGroups()[0].headers.map((header) => {
                  const coloana = coloane.find((item) => item.id === header.column.id)
                  const dreapta = coloana?.aliniere === 'dreapta'
                  const directie = header.column.getIsSorted()
                  const sortabila = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={directie === 'asc' ? 'ascending' : directie === 'desc' ? 'descending' : sortabila ? 'none' : undefined}
                      className={cn('whitespace-nowrap px-3 py-2 font-bold text-fg-muted', dreapta ? 'text-right' : 'text-left')}
                    >
                      {sortabila ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn('inline-flex min-h-touch items-center gap-1 rounded-control font-bold hover:text-fg', dreapta && 'flex-row-reverse', kitFocus)}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {directie === 'asc' ? (
                            <ArrowUp className="size-4" aria-hidden />
                          ) : directie === 'desc' ? (
                            <ArrowDown className="size-4" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-4 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {vizibile.map((rand) => (
                <tr
                  key={rand.id}
                  onClick={onDeschide ? () => onDeschide(rand.original) : undefined}
                  className={cn('border-t border-border-subtle', onDeschide && 'cursor-pointer hover:bg-surface-muted', rand.getIsSelected() && 'bg-primary-soft')}
                >
                  {selectie ? (
                    <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label="Selectează rândul"
                        checked={rand.getIsSelected()}
                        onChange={rand.getToggleSelectedHandler()}
                        className={cn('size-5 accent-primary', kitFocus)}
                      />
                    </td>
                  ) : null}
                  {rand.getVisibleCells().map((celula) => {
                    const coloana = coloane.find((item) => item.id === celula.column.id)
                    const continut = coloana?.afisare ? coloana.afisare(rand.original) : (celula.getValue<string | number | null>() ?? '—')
                    return (
                      <td key={celula.id} className={cn('px-3 py-2 align-top', coloana?.aliniere === 'dreapta' ? 'text-right tabular-nums' : 'text-left')}>
                        {continut}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            {areTotaluri ? (
              <tfoot className="border-t-2 border-border bg-surface-muted font-bold">
                <tr>
                  {selectie ? <td className="px-3 py-2" /> : null}
                  {coloane.map((coloana, index) => (
                    <td key={coloana.id} className={cn('px-3 py-2', coloana.aliniere === 'dreapta' ? 'text-right tabular-nums' : 'text-left')}>
                      {coloana.total ? coloana.total(afisate) : index === 0 ? 'Total' : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}

      {cuPagini ? (
        <div className="flex items-center justify-end gap-2">
          <span className={cn('text-fg-muted', kitText.helper)}>
            Pagina {paginaEfectiva + 1} din {nrPagini} · {toate.length} rânduri
          </span>
          <Button type="button" variant="neutral" size="touch" disabled={paginaEfectiva === 0} onClick={() => setPagina(paginaEfectiva - 1)}>
            Înapoi
          </Button>
          <Button type="button" variant="neutral" size="touch" disabled={paginaEfectiva >= nrPagini - 1} onClick={() => setPagina(paginaEfectiva + 1)}>
            Înainte
          </Button>
        </div>
      ) : null}
    </div>
  )
}
