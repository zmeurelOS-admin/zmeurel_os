'use client'

import { useMemo, useState } from 'react'
import { Map as MapIcon, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { ComutatorVedere } from '@/components/comenzi/ComutatoareComenzi'
import { BigInput, EmptyState, FilterPills, StatusPill, TabelDate, VedereListaDetaliu, kitText, type ColoanaTabel } from '@/components/kit'
import { ParcelaStepForm } from '@/components/parcele/ParcelaStepForm'
import { useParceleStare } from '@/components/parcele/useParceleStare'
import { ScreenHeader } from '@/components/setari/SetariUi'
import { useAziRo } from '@/hooks/useAziRo'
import { formatNumber, shortDateRo, searchKey } from '@/lib/format-ro'
import { culturaSoi, esteParcelaPersonala, liniaParcelei } from '@/lib/parcele/card'
import { ordoneazaParcele, ultimaLucrarePeParcela } from '@/lib/parcele/tabel'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import { useVedereDinUrl } from '@/lib/ui/useIdDinUrl'
import { cn } from '@/lib/utils'

import { ParcelaFisa } from '@/app/(dashboard)/parcele/[id]/ParcelaFisaClient'

type Filtru = 'toate' | 'comerciale' | 'personale'

/**
 * Parcelele pe desktop (promptul 35, §6): lista în stânga, fișa parcelei alese în dreapta (aceeași ca pe telefon,
 * `ParcelaFisa inPanou`), sau tabelul. Parcela aleasă e în adresă ca `/parcele/<id>` (adresa folosită peste tot).
 */
export function ParceleDesktop({ idAles }: { idAles: string | null }) {
  const router = useRouter()
  const azi = useAziRo()
  const { memberRole, accessLevel } = useDashboardAuth()
  const poateScrie = memberRole !== 'operator' || accessLevel === 'write'
  const stare = useParceleStare(azi)
  const [vedere, setVedere] = useVedereDinUrl()
  const [filtru, setFiltru] = useState<Filtru>('toate')
  const [text, setText] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const toate = useMemo(() => ordoneazaParcele(stare.parcele, esteParcelaPersonala), [stare.parcele])
  const numere = useMemo(
    () => ({ toate: toate.length, comerciale: toate.filter((p) => !esteParcelaPersonala(p)).length, personale: toate.filter(esteParcelaPersonala).length }),
    [toate],
  )
  const lista = useMemo(() => {
    const cheie = searchKey(text)
    return toate.filter(
      (parcela) =>
        (filtru === 'toate' || (filtru === 'personale') === esteParcelaPersonala(parcela)) &&
        (!cheie || [parcela.nume_parcela, culturaSoi(parcela)].some((valoare) => searchKey(valoare).includes(cheie))),
    )
  }, [filtru, text, toate])
  const ultima = useMemo(() => ultimaLucrarePeParcela(stare.lucrari, azi), [azi, stare.lucrari])
  const an = azi?.slice(0, 4) ?? ''

  const alege = (id: string, push: boolean) => {
    const adresa = `/parcele/${encodeURIComponent(id)}`
    if (push) router.push(adresa, { scroll: false })
    else router.replace(adresa, { scroll: false })
  }

  const capLista = (
    <>
      <BigInput aria-label="Caută o parcelă" placeholder="Caută o parcelă" value={text} onChange={(event) => setText(event.target.value)} leading={<Search aria-hidden />} autoComplete="off" />
      {numere.personale > 0 ? (
        <FilterPills<Filtru>
          aria-label="Ce parcele arăt"
          wrap
          value={filtru}
          onValueChange={setFiltru}
          options={[
            { value: 'toate', label: 'Toate', count: numere.toate },
            { value: 'comerciale', label: 'Comerciale', count: numere.comerciale },
            { value: 'personale', label: 'Personale', count: numere.personale },
          ]}
        />
      ) : null}
    </>
  )
  const gol = <EmptyState icon={<MapIcon />} title={toate.length === 0 ? 'Nicio parcelă' : 'Nicio parcelă aici'} description={toate.length === 0 ? 'Adaugă parcelele fermei: recoltările, tratamentele și lucrările se notează pe ele.' : 'Schimbă filtrul sau căutarea.'} />

  const coloane: ColoanaTabel<Parcela>[] = [
    { id: 'nume', titlu: 'Parcelă', valoare: (p) => p.nume_parcela?.trim() || 'Parcelă' },
    { id: 'cultura', titlu: 'Cultură', valoare: (p) => culturaSoi(p) },
    { id: 'plante', titlu: 'Plante', valoare: (p) => Number(p.nr_plante) || null, afisare: (p) => (p.nr_plante ? formatNumber(p.nr_plante) : '—'), aliniere: 'dreapta' },
    { id: 'suprafata', titlu: 'Suprafață (m²)', valoare: (p) => Number(p.suprafata_m2) || null, afisare: (p) => (p.suprafata_m2 ? formatNumber(p.suprafata_m2) : '—'), aliniere: 'dreapta' },
    { id: 'stadiu', titlu: 'Stadiu', valoare: (p) => stare.stadiuPeParcela.get(p.id)?.text ?? null },
    {
      id: 'recoltat',
      titlu: `Recoltat ${an} (kg)`,
      valoare: (p) => (esteParcelaPersonala(p) ? null : (stare.kg.get(p.id) ?? 0)),
      afisare: (p) => (esteParcelaPersonala(p) ? 'Personal' : formatNumber(stare.kg.get(p.id) ?? 0, 0)),
      aliniere: 'dreapta',
      total: (rs) => formatNumber(rs.filter((p) => !esteParcelaPersonala(p)).reduce((sum, p) => sum + (stare.kg.get(p.id) ?? 0), 0), 0),
    },
    {
      id: 'ultima',
      titlu: 'Ultima lucrare',
      valoare: (p) => ultima.get(p.id)?.zi ?? null,
      afisare: (p) => {
        const item = ultima.get(p.id)
        return item ? `${item.titlu} · ${shortDateRo(item.zi)}` : '—'
      },
      csv: (p) => {
        const item = ultima.get(p.id)
        return item ? `${item.titlu} · ${item.zi}` : ''
      },
    },
  ]

  return (
    <AppShell
      header={
        <ScreenHeader
          title="Parcele"
          subtitle={toate.length > 0 ? `${toate.length} ${toate.length === 1 ? 'parcelă' : 'parcele'}` : undefined}
          desktop={{
            comutatoare: <ComutatorVedere vedere={vedere} onVedere={setVedere} />,
            actiune: poateScrie ? { label: 'Parcelă', onClick: () => setFormOpen(true) } : null,
          }}
        />
      }
    >
      <div className="mx-auto w-full max-w-modul pb-8 pt-3">
        {stare.loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă parcelele">
            <div className="h-[92px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[92px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : vedere === 'tabel' ? (
          <TabelDate<Parcela>
            eticheta="Parcelele"
            coloane={coloane}
            randuri={lista}
            cheie={(p) => p.id}
            onDeschide={(p) => router.push(`/parcele/${encodeURIComponent(p.id)}`)}
            numeExport="parcele"
            aziIso={azi ?? undefined}
            sus={<div className="flex flex-wrap items-center gap-3">{capLista}</div>}
            gol={gol}
          />
        ) : (
          <VedereListaDetaliu<Parcela>
            etichetaLista="Parcelele"
            elemente={lista}
            cheie={(p) => p.id}
            idAles={idAles}
            onAlege={(id, { push }) => alege(id, push)}
            capLista={capLista}
            gol={gol}
            randeazaRand={(parcela) => {
              const semnal = stare.semnale.get(parcela.id) ?? null
              return (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 break-words font-bold text-fg">{parcela.nume_parcela?.trim() || 'Parcelă fără nume'}</span>
                    <span className="shrink-0 font-bold text-fg">{esteParcelaPersonala(parcela) ? 'Personal' : `${formatNumber(stare.kg.get(parcela.id) ?? 0, 0)} kg`}</span>
                  </div>
                  <span className={cn('block break-words text-fg-muted', kitText.helper)}>{liniaParcelei(parcela)}</span>
                  {semnal ? (
                    <StatusPill tone={semnal.ton} wrap>
                      {semnal.text}
                    </StatusPill>
                  ) : null}
                </div>
              )
            }}
            randeazaFisa={(parcela) => <ParcelaFisa key={parcela.id} parcelaId={parcela.id} inPanou />}
          />
        )}
      </div>
      <ParcelaStepForm open={formOpen} onOpenChange={setFormOpen} onSaved={() => undefined} />
    </AppShell>
  )
}
