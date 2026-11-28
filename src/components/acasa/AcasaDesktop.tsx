'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import Link from 'next/link'
import { Banknote, Receipt, Scale, Shovel, SprayCan } from 'lucide-react'

import { EmptyState, GraficBare, SectiuneFisa, StatTile, buttonVariants, kitFocus, kitText } from '@/components/kit'
import { cifreSezon, comenziPeZile, recoltaPeSaptamani, ultimeleInregistrari, type Inregistrare, type TipInregistrare } from '@/lib/dashboard/acasa-desktop'
import { zilePrognoza } from '@/lib/dashboard/prognoza'
import { formatKg, formatLei, formatNumber, shortDateRo, weekdayDateRo } from '@/lib/format-ro'
import { textCine } from '@/lib/lucrari/formular'
import { construiesteJurnalLucrari, type LucrareRow } from '@/lib/lucrari/jurnal'
import { titluLucrare } from '@/lib/lucrari/tipuri'
import { neincasatePeste30 } from '@/lib/notifications/zilnice/neincasate-30'
import type { CulturaFerma } from '@/lib/parcele/culturi-ferma'
import { peParcele, type DateRaport } from '@/lib/rapoarte/raport'
import { etichetaStocFerma } from '@/lib/stocuri/pe-cultura'
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import type { VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi'
import { construiesteJurnal, textParcele, textProduse } from '@/lib/tratamente/jurnal'
import type { AplicareRow } from '@/lib/tratamente/model'
import { ETICHETA_TIP } from '@/lib/tratamente/model'
import { cn } from '@/lib/utils'

import { PrognozaZile, PuneLoculFermei } from './PrognozaZile'

export interface AcasaDesktopProps {
  todayIso: string
  proprietar: boolean
  /** Ce module vede operatorul (proprietarul: toate). */
  vede: { recoltari: boolean; comenzi: boolean; stocuri: boolean; parcele: boolean; tratamente: boolean; lucrari: boolean }
  comenzi: readonly Comanda[]
  recoltari: readonly Recoltare[]
  vanzari: readonly Vanzare[]
  vanzariButasi: readonly VanzareButasi[]
  /** Doar la proprietar (interogarea nu pornește pentru operator). */
  cheltuieli: readonly Cheltuiala[]
  parcele: readonly Parcela[]
  aplicari: readonly AplicareRow[]
  lucrari: readonly LucrareRow[]
  stocKg: number | null
  culturi: readonly CulturaFerma[] | null
  meteoZile: unknown
  faraLoc: boolean
  /** Coloana „De făcut azi”: mementourile și rândurile de pe telefon (`Acasa doarDeFacut`). */
  deFacut: ReactNode
}

const procentText = (valoare: number | null, an: number) => (valoare === null ? null : `${valoare > 0 ? '+' : valoare < 0 ? '−' : ''}${Math.abs(valoare)}% față de ${an - 1}`)

const ICONITA: Record<TipInregistrare, ReactNode> = {
  recoltare: <Scale aria-hidden />,
  tratament: <SprayCan aria-hidden />,
  lucrare: <Shovel aria-hidden />,
  incasare: <Banknote aria-hidden />,
  cheltuiala: <Receipt aria-hidden />,
}

/**
 * Acasă pe desktop (promptul 35, §3, varianta B): rândul de cifre, recolta pe săptămâni, „De făcut azi”, producția pe
 * parcelă, comenzile pe zilele următoare, vremea pe 3 zile și ultimele înregistrări. Banii (venit, de încasat,
 * cheltuieli, profit, încasări) doar la proprietar. Fără widgeturi mutabile.
 */
export function AcasaDesktop(props: AcasaDesktopProps) {
  const { todayIso, proprietar, vede, comenzi, recoltari, vanzari, vanzariButasi, cheltuieli, parcele, aplicari, lucrari, stocKg, culturi, meteoZile, faraLoc, deFacut } = props
  const an = Number(todayIso.slice(0, 4))
  const numeParcele = useMemo(() => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă'])), [parcele])

  const date = useMemo<DateRaport>(
    () => ({
      recoltari,
      vanzari: proprietar ? vanzari : [],
      cheltuieli: proprietar ? cheltuieli : [],
      butasi: proprietar ? vanzariButasi : [],
      investitii: [],
      parcele: parcele.map((parcela) => ({ id: parcela.id, nume_parcela: parcela.nume_parcela, nr_plante: parcela.nr_plante, rol: parcela.rol })),
      culegatori: [],
      clienti: [],
    }),
    [cheltuieli, parcele, proprietar, recoltari, vanzari, vanzariButasi],
  )
  const cifre = useMemo(
    () =>
      cifreSezon({
        todayIso,
        date,
        vanzari: proprietar ? vanzari : [],
        comenzi,
        peste30: proprietar ? neincasatePeste30(comenzi, todayIso).numar : 0,
      }),
    [comenzi, date, proprietar, todayIso, vanzari],
  )
  const saptamani = useMemo(() => recoltaPeSaptamani(recoltari, todayIso), [recoltari, todayIso])
  const productie = useMemo(() => peParcele(date, { start: `${an}-01-01`, end: todayIso }).filter((rand) => !rand.personal && rand.id !== 'fara').slice(0, 8), [an, date, todayIso])
  const zileComenzi = useMemo(() => comenziPeZile(comenzi, todayIso), [comenzi, todayIso])

  const inregistrari = useMemo(() => {
    const toate: Inregistrare[] = []
    if (vede.recoltari) {
      for (const recoltare of recoltari) {
        const kg = (Number(recoltare.kg_cal1) || 0) + (Number(recoltare.kg_cal2) || 0)
        toate.push({
          tip: 'recoltare',
          id: `r-${recoltare.id}`,
          ziua: String(recoltare.data).slice(0, 10),
          creat: String(recoltare.created_at ?? ''),
          titlu: `Recoltare · ${formatKg(kg)}`,
          detaliu: numeParcele.get(String(recoltare.parcela_id)) ?? '',
          href: '/recoltari',
        })
      }
    }
    if (vede.tratamente) {
      for (const rand of construiesteJurnal({ aplicari, activitati: [] }).facute.slice(0, 20)) {
        toate.push({
          tip: 'tratament',
          id: `t-${rand.key}`,
          ziua: rand.zi ?? '',
          creat: rand.createdAt,
          titlu: `${ETICHETA_TIP[rand.tip]} · ${textProduse(rand.produse, false) || 'fără produse'}`,
          detaliu: textParcele(rand.parcelaIds, numeParcele),
          href: '/tratamente',
        })
      }
    }
    if (vede.lucrari) {
      for (const rand of construiesteJurnalLucrari(lucrari, todayIso).facute.slice(0, 20)) {
        toate.push({
          tip: 'lucrare',
          id: `l-${rand.key}`,
          ziua: rand.zi ?? '',
          creat: rand.createdAt,
          titlu: titluLucrare(rand),
          detaliu: [textParcele(rand.parcelaIds, numeParcele), textCine(rand.cine, proprietar)].filter(Boolean).join(' · '),
          href: '/lucrari',
        })
      }
    }
    if (proprietar) {
      for (const vanzare of vanzari) {
        if (!vanzare.data_incasare) continue
        toate.push({
          tip: 'incasare',
          id: `v-${vanzare.id}`,
          ziua: String(vanzare.data_incasare).slice(0, 10),
          creat: String(vanzare.updated_at ?? vanzare.created_at ?? ''),
          titlu: `Încasare · ${formatLei((Number(vanzare.cantitate_kg) || 0) * (Number(vanzare.pret_lei_kg) || 0))}`,
          detaliu: `${formatKg(vanzare.cantitate_kg)}`,
          href: '/vanzari',
        })
      }
      for (const cheltuiala of cheltuieli) {
        toate.push({
          tip: 'cheltuiala',
          id: `c-${cheltuiala.id}`,
          ziua: String(cheltuiala.data).slice(0, 10),
          creat: String(cheltuiala.created_at ?? ''),
          titlu: `Cheltuială · ${formatLei(cheltuiala.suma_lei)}`,
          detaliu: [cheltuiala.categorie, cheltuiala.furnizor].filter(Boolean).join(' · '),
          href: '/cheltuieli',
        })
      }
    }
    return ultimeleInregistrari({ proprietar, inregistrari: toate })
  }, [aplicari, cheltuieli, lucrari, numeParcele, proprietar, recoltari, todayIso, vanzari, vede.lucrari, vede.recoltari, vede.tratamente])

  const etichetaStoc = (culturi && etichetaStocFerma(culturi)) ?? 'Stoc cal. I'
  const faraParcele = culturi !== null && culturi.length === 0

  const placi: ReactNode[] = []
  if (proprietar) {
    placi.push(
      <StatTile key="venit" tone="inverse" value={formatLei(cifre.sumar.incasat)} label={['Venit sezon', procentText(cifre.venitProcent, an)].filter(Boolean).join(' · ')} />,
    )
  }
  if (vede.recoltari) {
    placi.push(
      <StatTile key="recoltat" value={formatNumber(cifre.sumar.recoltatKg)} unit="kg" label={['Recoltat în sezon', procentText(cifre.recoltatProcent, an)].filter(Boolean).join(' · ')} />,
    )
  }
  if (proprietar) {
    placi.push(
      <StatTile
        key="incasat"
        tone={cifre.deIncasatPeste30 > 0 ? 'warning' : 'neutral'}
        value={formatLei(cifre.deIncasatLei)}
        label={cifre.deIncasatPeste30 > 0 ? `De încasat · ${cifre.deIncasatPeste30} peste 30 zile` : 'De încasat'}
      />,
    )
  }
  if (vede.stocuri || vede.comenzi) {
    placi.push(
      faraParcele ? (
        <StatTile key="stoc" value="—" label="Adaugă întâi o parcelă" />
      ) : (
        <StatTile
          key="stoc"
          value={stocKg === null ? '…' : formatNumber(stocKg)}
          unit="kg"
          label={vede.comenzi ? `${etichetaStoc} · ${formatKg(cifre.comandatKg)} comandate` : etichetaStoc}
        />
      ),
    )
  }
  if (proprietar) {
    placi.push(
      <StatTile key="cheltuieli" value={formatLei(cifre.sumar.cheltuieli)} label={`Cheltuieli sezon · profit ${cifre.sumar.profit < 0 ? `− ${formatLei(Math.abs(cifre.sumar.profit))}` : formatLei(cifre.sumar.profit)}`} />,
    )
  }

  return (
    <div className="space-y-4 pb-8 pt-3">
      {placi.length > 0 ? (
        <section aria-label="Cifrele sezonului" className={cn('grid gap-3', placi.length >= 5 ? 'grid-cols-5' : placi.length === 4 ? 'grid-cols-4' : placi.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {placi}
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {vede.recoltari ? (
          <SectiuneFisa className="self-start" titlu={`Recolta pe săptămâni · ${an}`} dreapta={<Link href="/recoltari" className={buttonVariants({ variant: 'quiet', size: 'touch' })}>Recoltări</Link>}>
            {saptamani.length < 2 ? (
              <EmptyState
                icon={<Scale />}
                title="Graficul apare după primele recoltări din sezon"
                description="Fiecare săptămână de cules devine o bară; dacă ai recoltări de anul trecut, le vezi alături."
              />
            ) : (
              <GraficBare
                eticheta={`Recolta pe săptămâni în ${an}, în kilograme`}
                bare={saptamani.map((s) => ({ cheie: s.cheie, eticheta: s.eticheta, valoare: s.kg, comparatie: s.kgAnTrecut }))}
                formatare={(valoare) => formatKg(valoare)}
                legenda={[String(an), String(an - 1)]}
                inaltime={200}
              />
            )}
          </SectiuneFisa>
        ) : null}

        <section aria-label="De făcut azi" className="min-w-0 space-y-3">
          {deFacut}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {vede.recoltari ? (
          <SectiuneFisa titlu={`Producție pe parcelă · ${an}`}>
            {productie.length === 0 ? (
              <p className={cn('text-fg-muted', kitText.secondary)}>{faraParcele ? 'Adaugă întâi o parcelă.' : `Nicio recoltare notată în ${an}.`}</p>
            ) : (
              <GraficBare
                orientare="orizontala"
                eticheta={`Kilograme recoltate pe parcelă în ${an}`}
                bare={productie.map((rand) => ({ cheie: rand.id, eticheta: rand.nume, valoare: rand.kg }))}
                formatare={(valoare) => formatKg(valoare)}
              />
            )}
          </SectiuneFisa>
        ) : null}

        {vede.comenzi ? (
          <SectiuneFisa titlu="Comenzi pe zilele următoare" dreapta={<Link href="/comenzi" className={buttonVariants({ variant: 'quiet', size: 'touch' })}>Comenzi</Link>}>
            {zileComenzi.every((ziua) => ziua.count === 0) ? (
              <p className={cn('text-fg-muted', kitText.secondary)}>Nicio comandă deschisă în următoarele 7 zile.</p>
            ) : (
              <ul className="space-y-1">
                {zileComenzi.map((ziua, index) => (
                  <li key={ziua.ziua}>
                    <Link
                      href={index === 0 ? '/comenzi' : index === 1 ? '/comenzi?filter=maine' : '/comenzi?filter=viitoare'}
                      className={cn('flex min-h-touch flex-wrap items-center justify-between gap-2 rounded-control px-2 text-fg hover:bg-surface-muted', kitText.secondary, kitFocus)}
                    >
                      <span className="font-semibold">{index === 0 ? 'Azi' : index === 1 ? 'Mâine' : weekdayDateRo(ziua.ziua)}</span>
                      <span className={ziua.count === 0 ? 'text-fg-muted' : 'font-bold'}>
                        {ziua.count === 0 ? '—' : `${ziua.count} ${ziua.count === 1 ? 'comandă' : 'comenzi'} · ${formatKg(ziua.kg)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectiuneFisa>
        ) : null}

        <SectiuneFisa titlu="Vremea pe 3 zile">
          {faraLoc ? <PuneLoculFermei /> : <PrognozaZile zile={zilePrognoza(meteoZile, todayIso)} azi={todayIso} />}
        </SectiuneFisa>
      </div>

      <SectiuneFisa titlu="Ultimele înregistrări">
        {inregistrari.length === 0 ? (
          <p className={cn('text-fg-muted', kitText.secondary)}>Recoltările, tratamentele și lucrările notate apar aici.</p>
        ) : (
          <ul className="grid gap-1 xl:grid-cols-2">
            {inregistrari.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className={cn('flex min-h-touch items-center gap-3 rounded-control px-2 py-1.5 hover:bg-surface-muted', kitFocus)}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5">{ICONITA[item.tip]}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block break-words font-semibold text-fg', kitText.secondary)}>{item.titlu}</span>
                    <span className={cn('block break-words text-fg-muted', kitText.helper)}>{[item.detaliu, shortDateRo(item.ziua)].filter(Boolean).join(' · ')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectiuneFisa>
    </div>
  )
}
