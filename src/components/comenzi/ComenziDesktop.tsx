'use client'

import { useMemo, useState } from 'react'
import { ClipboardList, Flag, Search, Truck } from 'lucide-react'

import {
  BigInput,
  Button,
  EmptyState,
  FilterPills,
  StatusPill,
  TabelDate,
  VedereListaDetaliu,
  kitText,
  type ColoanaTabel,
} from '@/components/kit'
import { comandaDayLabel, comandaPlata, comandaStatus } from '@/lib/comenzi/display'
import { mesajEroareComanda, parseStocInsuficient } from '@/lib/comenzi/day-view'
import { eligibilePentruLivrare, filtreazaComenzi, FILTRE_COMENZI_DESKTOP, inFiltru, numarPeFiltre, type FiltruComenziDesktop } from '@/lib/comenzi/tabel'
import { formatKg, formatLei, formatLeiKg, phoneDigits, round2, searchKey } from '@/lib/format-ro'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'
import type { VedereModul } from '@/lib/ui/useIdDinUrl'
import { cn } from '@/lib/utils'

import { ComandaFisa } from './ComandaFisa'
import { useComandaActions } from './useComandaActions'

export interface ComenziDesktopProps {
  comenzi: readonly Comanda[]
  numeClient: (comanda: Comanda) => string
  telefonClient: (comanda: Comanda) => string | null
  todayIso: string
  canWrite: boolean
  canDelete: boolean
  hasPrioritara: boolean
  onEdit: (comanda: Comanda) => void
  vedere: VedereModul
  idAles: string | null
  onAlege: (id: string, optiuni: { push: boolean }) => void
  /** Clic pe un rând din tabel: trece în Listă, cu comanda aleasă. */
  onDeschideDinTabel: (id: string) => void
  filtruInitial?: FiltruComenziDesktop
}

function cauta(comenzi: readonly Comanda[], text: string, numeClient: (comanda: Comanda) => string): Comanda[] {
  const cheie = searchKey(text)
  if (!cheie) return [...comenzi]
  const cifre = phoneDigits(text).replace(/^0+/, '')
  return comenzi.filter(
    (comanda) =>
      searchKey(numeClient(comanda)).includes(cheie) ||
      searchKey(comanda.locatie_livrare ?? '').includes(cheie) ||
      (cifre.length >= 3 && phoneDigits(comanda.telefon).includes(cifre)),
  )
}

/**
 * Comenzile pe desktop (promptul 35, §5): listă + fișă (filtrele Toate · Azi · Mâine · Săptămâna · De pregătit ·
 * În livrare · Neîncasate) sau tabelul cu totaluri, selecție și „Pune în livrare” în bloc. Se vede de la 1024 px.
 */
export function ComenziDesktop({
  comenzi,
  numeClient,
  telefonClient,
  todayIso,
  canWrite,
  canDelete,
  hasPrioritara,
  onEdit,
  vedere,
  idAles,
  onAlege,
  onDeschideDinTabel,
  filtruInitial = 'azi',
}: ComenziDesktopProps) {
  const actions = useComandaActions()
  const [filtru, setFiltru] = useState<FiltruComenziDesktop>(filtruInitial)
  const [text, setText] = useState('')
  const [inBloc, setInBloc] = useState(false)

  // O comandă deschisă din altă parte (căutarea globală, un link) care nu e în filtrul curent: trecem pe „Toate”.
  const [ajustatPentru, setAjustatPentru] = useState<string | null>(null)
  if (idAles && idAles !== ajustatPentru) {
    const dinAdresa = comenzi.find((comanda) => comanda.id === idAles)
    if (dinAdresa) {
      setAjustatPentru(idAles)
      if (!inFiltru(dinAdresa, filtru, todayIso)) {
        setFiltru('toate')
        setText('')
      }
    }
  }

  const numere = useMemo(() => numarPeFiltre(comenzi, todayIso), [comenzi, todayIso])
  const lista = useMemo(() => cauta(filtreazaComenzi(comenzi, filtru, todayIso), text, numeClient), [comenzi, filtru, numeClient, text, todayIso])
  const eligibile = useMemo(() => new Set(eligibilePentruLivrare(comenzi, todayIso).map((comanda) => comanda.id)), [comenzi, todayIso])

  const filtre = (
    <FilterPills<FiltruComenziDesktop>
      aria-label="Ce comenzi arăt"
      wrap
      value={filtru}
      onValueChange={setFiltru}
      options={FILTRE_COMENZI_DESKTOP.map((item) => ({ ...item, count: numere[item.value] }))}
    />
  )
  const campCautare = (
    <BigInput
      aria-label="Caută în comenzi după client, telefon sau adresă"
      placeholder="Client, telefon, adresă"
      value={text}
      onChange={(event) => setText(event.target.value)}
      leading={<Search aria-hidden />}
      autoComplete="off"
    />
  )

  /** „Pune în livrare” în bloc: aceeași acțiune ca în fișă, comandă cu comandă; la prima fără stoc se oprește. */
  const puneInLivrare = async (selectate: Comanda[], goleste: () => void) => {
    const deMutat = selectate.filter((comanda) => eligibile.has(comanda.id))
    if (deMutat.length === 0 || inBloc) return
    setInBloc(true)
    let puse = 0
    try {
      for (const comanda of deMutat) {
        try {
          await actions.update(comanda.id, { status: 'in_livrare' })
          puse += 1
        } catch (cauza) {
          const stoc = parseStocInsuficient(cauza)
          const motiv = stoc
            ? `lipsesc ${formatKg(Math.max(0, round2(stoc.necesarKg - stoc.disponibilKg)))}`
            : (mesajEroareComanda(cauza) ?? 'nu s-a putut')
          toast.error(`${puse} ${puse === 1 ? 'pusă' : 'puse'} în livrare · ${numeClient(comanda)} n-a intrat: ${motiv}`)
          return
        }
      }
      toast.success(`${puse} ${puse === 1 ? 'comandă pusă' : 'comenzi puse'} în livrare`)
      goleste()
    } finally {
      setInBloc(false)
    }
  }

  const coloane: ColoanaTabel<Comanda>[] = [
    { id: 'client', titlu: 'Client', valoare: (comanda) => numeClient(comanda) },
    { id: 'telefon', titlu: 'Telefon', valoare: (comanda) => comanda.telefon?.trim() || telefonClient(comanda) || null, faraSortare: true },
    {
      id: 'livrare',
      titlu: 'Livrare',
      valoare: (comanda) => comanda.data_livrare?.slice(0, 10) ?? null,
      afisare: (comanda) => (comanda.data_livrare ? comandaDayLabel(comanda, todayIso) : 'Fără dată'),
    },
    { id: 'adresa', titlu: 'Adresă', valoare: (comanda) => comanda.locatie_livrare?.trim() || null },
    {
      id: 'kg',
      titlu: 'kg',
      valoare: (comanda) => Number(comanda.cantitate_kg) || 0,
      aliniere: 'dreapta',
      total: (randuri) => formatKg(randuri.reduce((sum, comanda) => sum + (Number(comanda.cantitate_kg) || 0), 0)),
    },
    {
      id: 'pret',
      titlu: 'lei/kg',
      valoare: (comanda) => Number(comanda.pret_per_kg) || 0,
      afisare: (comanda) => formatLeiKg(comanda.pret_per_kg),
      aliniere: 'dreapta',
    },
    {
      id: 'total',
      titlu: 'Total',
      valoare: (comanda) => Number(comanda.total) || 0,
      afisare: (comanda) => formatLei(comanda.total),
      aliniere: 'dreapta',
      total: (randuri) => formatLei(randuri.reduce((sum, comanda) => sum + (Number(comanda.total) || 0), 0)),
    },
    { id: 'plata', titlu: 'Plată', valoare: (comanda) => comandaPlata(comanda)?.label ?? null },
    {
      id: 'stare',
      titlu: 'Stare',
      valoare: (comanda) => comandaStatus(comanda, todayIso).label,
      afisare: (comanda) => {
        const stare = comandaStatus(comanda, todayIso)
        return <StatusPill tone={stare.tone}>{stare.label}</StatusPill>
      },
    },
  ]

  const gol = (
    <EmptyState
      icon={<ClipboardList />}
      title={comenzi.length === 0 ? 'Nicio comandă încă' : 'Nicio comandă aici'}
      description={comenzi.length === 0 ? 'Notează comanda când sună clientul sau lipește mesajul lui la „Din mesaj”.' : 'Schimbă filtrul sau căutarea.'}
    />
  )

  if (vedere === 'tabel') {
    return (
      <TabelDate<Comanda>
        eticheta="Comenzile"
        coloane={coloane}
        randuri={lista}
        cheie={(comanda) => comanda.id}
        onDeschide={(comanda) => onDeschideDinTabel(comanda.id)}
        selectie={canWrite}
        actiuniBloc={(selectate, goleste) => {
          const pot = selectate.filter((comanda) => eligibile.has(comanda.id)).length
          return (
            <Button type="button" variant="primary" size="touch" disabled={pot === 0} loading={inBloc} onClick={() => void puneInLivrare(selectate, goleste)}>
              <Truck aria-hidden />
              {pot === 0 ? 'Niciuna nu poate intra în livrare' : `Pune ${pot} în livrare`}
            </Button>
          )
        }}
        numeExport="comenzi"
        aziIso={todayIso}
        sus={
          <div className="flex flex-wrap items-center gap-3">
            {filtre}
            <div className="w-[min(360px,100%)]">{campCautare}</div>
          </div>
        }
        gol={gol}
      />
    )
  }

  return (
    <VedereListaDetaliu<Comanda>
      etichetaLista="Comenzile"
      elemente={lista}
      cheie={(comanda) => comanda.id}
      idAles={idAles}
      onAlege={onAlege}
      capLista={
        <>
          {campCautare}
          {filtre}
        </>
      }
      gol={gol}
      fisaGoala={<EmptyState icon={<ClipboardList />} title="Alege o comandă" description="Fișa ei apare aici." />}
      randeazaRand={(comanda) => {
        const stare = comandaStatus(comanda, todayIso)
        return (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 break-words font-bold text-fg">
                {comanda.prioritara ? <Flag className="mr-1 inline size-4 text-warning-text" aria-label="Prioritară" /> : null}
                {numeClient(comanda)}
              </span>
              <span className="shrink-0 font-bold text-fg">{formatKg(comanda.cantitate_kg)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={cn('min-w-0 flex-1 break-words text-fg-muted', kitText.helper)}>
                {[comanda.data_livrare ? comandaDayLabel(comanda, todayIso) : 'Fără dată', comanda.locatie_livrare?.trim()]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <StatusPill tone={stare.tone}>{stare.label}</StatusPill>
            </div>
          </div>
        )
      }}
      randeazaFisa={(comanda) => (
        <ComandaFisa
          key={comanda.id}
          comanda={comanda}
          comenzi={comenzi}
          clientName={numeClient(comanda)}
          numeClient={numeClient}
          clientTelefon={telefonClient(comanda)}
          todayIso={todayIso}
          canWrite={canWrite}
          canDelete={canDelete}
          hasPrioritara={hasPrioritara}
          onEdit={onEdit}
          onAlege={(id) => onAlege(id, { push: true })}
        />
      )}
    />
  )
}
