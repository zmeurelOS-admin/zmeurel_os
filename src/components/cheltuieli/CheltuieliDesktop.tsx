'use client'

import type { ReactNode } from 'react'
import { Search, Wallet } from 'lucide-react'

import { AntetFisa, BigInput, EmptyState, SectiuneFisa, TabelDate, VedereListaDetaliu, kitText, type ColoanaTabel } from '@/components/kit'
import { resolveCheltuialaCategorie, resolveInvestitieCategorie } from '@/lib/financial/categories'
import { formatLei, shortDateRo } from '@/lib/format-ro'
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import type { Investitie } from '@/lib/supabase/queries/investitii'
import { isAutoManoperaCheltuiala } from '@/lib/supabase/queries/manopera-auto'
import type { VedereModul } from '@/lib/ui/useIdDinUrl'
import { cn } from '@/lib/utils'

import { CategorieIcon } from './CategorieIcon'

export type RandBani = { kind: 'cheltuiala'; row: Cheltuiala } | { kind: 'investitie'; row: Investitie }

const categorieRand = (item: RandBani) => (item.kind === 'cheltuiala' ? resolveCheltuialaCategorie(item.row.categorie) : resolveInvestitieCategorie(item.row.categorie))
const titluRand = (item: RandBani) => {
  if (item.kind === 'cheltuiala' && isAutoManoperaCheltuiala(item.row)) return 'Manoperă cules'
  return item.row.descriere?.replace('[AUTO_MANOPERA]', '').trim() || categorieRand(item)
}

export interface CheltuieliDesktopProps {
  randuri: readonly RandBani[]
  parcelaNames: ReadonlyMap<string, string>
  todayIso: string
  vedere: VedereModul
  idAles: string | null
  onAlege: (id: string, optiuni: { push: boolean }) => void
  onDeschideDinTabel: (id: string) => void
  /** Fișa rândului ales: aceleași bucăți ca foaia de pe telefon (titlul, ziua, conținutul cu acțiunile). */
  titluFisa: ReactNode
  descriereFisa: ReactNode
  continutFisa: ReactNode
  sus: ReactNode
  cautare: string
  onCautare: (text: string) => void
}

/** Cheltuielile și investițiile pe desktop (promptul 35, §8): listă + fișă sau tabelul cu totaluri și CSV. */
export function CheltuieliDesktop({ randuri, parcelaNames, todayIso, vedere, idAles, onAlege, onDeschideDinTabel, titluFisa, descriereFisa, continutFisa, sus, cautare, onCautare }: CheltuieliDesktopProps) {
  const camp = (
    <BigInput
      aria-label="Caută după categorie, furnizor sau descriere"
      placeholder="Caută: categorie, furnizor…"
      value={cautare}
      onChange={(event) => onCautare(event.target.value)}
      leading={<Search aria-hidden />}
      autoComplete="off"
    />
  )
  const gol = <EmptyState icon={<Wallet />} title="Nimic în perioada aleasă" description="Schimbă luna (anul, la investiții) sau căutarea." />
  const investitii = randuri.some((item) => item.kind === 'investitie')

  const coloane: ColoanaTabel<RandBani>[] = [
    { id: 'data', titlu: 'Data', valoare: (item) => item.row.data.slice(0, 10), afisare: (item) => shortDateRo(item.row.data) },
    { id: 'categorie', titlu: 'Categorie', valoare: categorieRand },
    { id: 'descriere', titlu: 'Ce', valoare: titluRand },
    { id: 'furnizor', titlu: 'Furnizor', valoare: (item) => item.row.furnizor?.trim() || null },
    ...(investitii
      ? [{ id: 'parcela', titlu: 'Parcelă', valoare: (item: RandBani) => (item.kind === 'investitie' && item.row.parcela_id ? (parcelaNames.get(item.row.parcela_id) ?? null) : null) }]
      : []),
    { id: 'bon', titlu: 'Bon', valoare: (item) => (item.row.document_url ? 'da' : null), faraSortare: true },
    {
      id: 'suma',
      titlu: 'Sumă',
      valoare: (item) => Number(item.row.suma_lei) || 0,
      afisare: (item) => formatLei(Number(item.row.suma_lei) || 0),
      aliniere: 'dreapta',
      total: (rs) => formatLei(rs.reduce((sum, item) => sum + (Number(item.row.suma_lei) || 0), 0)),
    },
  ]

  if (vedere === 'tabel') {
    return (
      <TabelDate<RandBani>
        eticheta={investitii ? 'Investițiile' : 'Cheltuielile'}
        coloane={coloane}
        randuri={randuri}
        cheie={(item) => item.row.id}
        onDeschide={(item) => onDeschideDinTabel(item.row.id)}
        selectie
        numeExport={investitii ? 'investitii' : 'cheltuieli'}
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
    <VedereListaDetaliu<RandBani>
      etichetaLista={investitii ? 'Investițiile' : 'Cheltuielile'}
      elemente={randuri}
      cheie={(item) => item.row.id}
      idAles={idAles}
      onAlege={onAlege}
      capLista={
        <>
          {sus}
          {camp}
        </>
      }
      gol={gol}
      randeazaRand={(item) => (
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-4" aria-hidden>
            <CategorieIcon kind={item.kind} categorie={item.row.categorie} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 break-words font-bold text-fg">{titluRand(item)}</span>
              <span className="shrink-0 font-bold text-fg">{formatLei(Number(item.row.suma_lei) || 0)}</span>
            </span>
            <span className={cn('block break-words text-fg-muted', kitText.helper)}>
              {[shortDateRo(item.row.data), categorieRand(item) === titluRand(item) ? null : categorieRand(item), item.row.furnizor?.trim()].filter(Boolean).join(' · ')}
            </span>
          </span>
        </div>
      )}
      randeazaFisa={() => (
        <div className="space-y-4">
          <AntetFisa titlu={titluFisa} context={descriereFisa} />
          <SectiuneFisa className="max-w-xl">{continutFisa}</SectiuneFisa>
        </div>
      )}
    />
  )
}
