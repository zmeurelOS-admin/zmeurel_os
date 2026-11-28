'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ReceiptText, Search } from 'lucide-react'

import { AntetFisa, BigInput, EmptyState, SectiuneFisa, StatusPill, TabelDate, VedereListaDetaliu, kitText, type ColoanaTabel } from '@/components/kit'
import { formatKg, formatLei, formatLeiKg, shortDateRo } from '@/lib/format-ro'
import type { VedereModul } from '@/lib/ui/useIdDinUrl'
import { searchVanzari, type VanzareRow } from '@/lib/vanzari/view'
import { cn } from '@/lib/utils'

import { useVanzareFisa } from './useVanzareFisa'

function VanzareFisa(props: { vanzare: VanzareRow; todayIso: string; canWrite: boolean; vanzariPlataPartiala: boolean }) {
  const fisa = useVanzareFisa({ ...props, activ: true, inPanou: true, onClose: () => undefined })
  if (!fisa) return null
  return (
    <div className="space-y-4">
      <AntetFisa titlu={props.vanzare.clientNume} context={fisa.view === 'detalii' ? fisa.description : `${props.vanzare.clientNume} · total ${formatLei(props.vanzare.total)}`} />
      <SectiuneFisa titlu={fisa.view === 'parte' ? fisa.title : undefined} className="max-w-xl">
        {fisa.content}
      </SectiuneFisa>
    </div>
  )
}

export interface VanzariDesktopProps {
  /** Rândurile filei alese (luna sau neîncasatele), cele mai noi primele. */
  randuri: readonly VanzareRow[]
  todayIso: string
  canWrite: boolean
  vanzariPlataPartiala: boolean
  vedere: VedereModul
  idAles: string | null
  onAlege: (id: string, optiuni: { push: boolean }) => void
  onDeschideDinTabel: (id: string) => void
  /** Filele și luna, sus în listă / tabel. */
  sus: ReactNode
}

/** Vânzările pe desktop (promptul 35, §8): listă + fișă (aceeași ca foaia) sau tabelul cu totaluri și CSV. */
export function VanzariDesktop({ randuri, todayIso, canWrite, vanzariPlataPartiala, vedere, idAles, onAlege, onDeschideDinTabel, sus }: VanzariDesktopProps) {
  const [text, setText] = useState('')
  const lista = useMemo(() => searchVanzari(randuri, text), [randuri, text])
  const camp = (
    <BigInput aria-label="Caută după client" placeholder="Caută după client" value={text} onChange={(event) => setText(event.target.value)} leading={<Search aria-hidden />} autoComplete="off" />
  )
  const gol = <EmptyState icon={<ReceiptText />} title="Nicio vânzare aici" description="Vânzările apar singure când livrezi o comandă; la poartă, cu „Vânzare rapidă”." />

  const coloane: ColoanaTabel<VanzareRow>[] = [
    { id: 'data', titlu: 'Data', valoare: (row) => row.data.slice(0, 10), afisare: (row) => shortDateRo(row.data) },
    { id: 'client', titlu: 'Client', valoare: (row) => row.clientNume },
    { id: 'kg', titlu: 'kg', valoare: (row) => Number(row.cantitate_kg) || 0, aliniere: 'dreapta', total: (rs) => formatKg(rs.reduce((sum, row) => sum + (Number(row.cantitate_kg) || 0), 0)) },
    { id: 'pret', titlu: 'lei/kg', valoare: (row) => Number(row.pret_lei_kg) || 0, afisare: (row) => formatLeiKg(Number(row.pret_lei_kg) || 0), aliniere: 'dreapta' },
    { id: 'total', titlu: 'Total', valoare: (row) => row.total, afisare: (row) => formatLei(row.total), aliniere: 'dreapta', total: (rs) => formatLei(rs.reduce((sum, row) => sum + row.total, 0)) },
    {
      id: 'plata',
      titlu: 'Plată',
      valoare: (row) => (row.incasata ? 'Încasat' : 'Neîncasat'),
      afisare: (row) => <StatusPill tone={row.incasata ? 'success' : 'warning'}>{row.incasata ? 'Încasat' : 'Neîncasat'}</StatusPill>,
    },
    { id: 'rest', titlu: 'Rest', valoare: (row) => row.rest, afisare: (row) => (row.rest > 0 ? formatLei(row.rest) : '—'), aliniere: 'dreapta', total: (rs) => formatLei(rs.reduce((sum, row) => sum + row.rest, 0)) },
  ]

  if (vedere === 'tabel') {
    return (
      <TabelDate<VanzareRow>
        eticheta="Vânzările"
        coloane={coloane}
        randuri={lista}
        cheie={(row) => row.id}
        onDeschide={(row) => onDeschideDinTabel(row.id)}
        selectie
        numeExport="vanzari"
        aziIso={todayIso}
        sus={
          <div className="flex flex-wrap items-center gap-3">
            {sus}
            <div className="w-[min(320px,100%)]">{camp}</div>
          </div>
        }
        gol={gol}
      />
    )
  }

  return (
    <VedereListaDetaliu<VanzareRow>
      etichetaLista="Vânzările"
      elemente={lista}
      cheie={(row) => row.id}
      idAles={idAles}
      onAlege={onAlege}
      capLista={
        <>
          {sus}
          {camp}
        </>
      }
      gol={gol}
      randeazaRand={(row) => (
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1 break-words font-bold text-fg">{row.clientNume}</span>
            <span className="shrink-0 font-bold text-fg">{formatLei(row.total)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn('text-fg-muted', kitText.helper)}>
              {shortDateRo(row.data)} · {formatKg(Number(row.cantitate_kg) || 0)}
            </span>
            <StatusPill tone={row.incasata ? 'success' : 'warning'}>{row.incasata ? 'Încasat' : 'Neîncasat'}</StatusPill>
          </div>
        </div>
      )}
      randeazaFisa={(row) => <VanzareFisa key={row.id} vanzare={row} todayIso={todayIso} canWrite={canWrite} vanzariPlataPartiala={vanzariPlataPartiala} />}
    />
  )
}
