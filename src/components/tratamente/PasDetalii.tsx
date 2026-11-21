'use client'

import { Plus, X } from 'lucide-react'

import { Button, CheckRow, Notice, NumberStepper, Segments, kitFocus, kitText } from '@/components/kit'
import type { Avertisment } from '@/lib/tratamente/avertismente'
import {
  cantitateStropire,
  formatCantitate,
  formatKgTratament,
  kgFertirigare,
  suprafataHa,
  type ModDoza,
  type UnitateProdus,
} from '@/lib/tratamente/doze'
import { pauzaCiorna, type CiornaTratament, type ParcelaFormular, type ProdusCiorna } from '@/lib/tratamente/formular'
import { zileText } from '@/lib/tratamente/zile'
import { cn } from '@/lib/utils'

import { ParcelePills } from './ParcelePills'

const TIP_SCURT: Record<string, string> = {
  fungicid: 'Fungicid',
  insecticid: 'Insecticid',
  acaricid: 'Acaricid',
  erbicid: 'Erbicid',
  foliar: 'Foliar',
  ingrasamant: 'Îngrășământ',
  bioregulator: 'Biostimulator',
  altul: 'Altul',
}

function metaProdus(produs: ProdusCiorna): string {
  const pauza = produs.phi === null ? null : produs.phi > 0 ? `pauză ${zileText(produs.phi)}` : 'fără pauză'
  return [produs.tip ? TIP_SCURT[produs.tip] ?? produs.tip : null, produs.frac, pauza].filter(Boolean).join(' · ')
}

function Eticheta({ children }: { children: React.ReactNode }) {
  return <p className={cn('font-bold text-fg', kitText.secondary)}>{children}</p>
}

function ScoateProdus({ nume, onClick }: { nume: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Scoate ${nume}`}
      onClick={onClick}
      className={cn('flex size-touch shrink-0 items-center justify-center rounded-control text-fg-muted active:bg-surface-muted [&_svg]:size-5', kitFocus)}
    >
      <X aria-hidden />
    </button>
  )
}

function AdaugaProdus({ onClick, primul }: { onClick: () => void; primul: boolean }) {
  return (
    <Button type="button" variant="neutral" size="touch" className="w-full border-dashed" onClick={onClick}>
      <Plus aria-hidden />
      {primul ? 'Alege produsul' : 'Adaugă produs'}
    </Button>
  )
}

function Avertismente({ list }: { list: readonly Avertisment[] }) {
  if (list.length === 0) return null
  return (
    <div className="space-y-2">
      {list.map((item) => (
        <Notice key={`${item.tip}-${item.titlu}`} tone="warning" title={item.titlu}>
          {item.detaliu}
        </Notice>
      ))}
    </div>
  )
}

function LiniePauza({ produse }: { produse: readonly ProdusCiorna[] }) {
  const { zile, produs } = pauzaCiorna(produse)
  return (
    <p className={cn('flex items-baseline justify-between gap-3 px-1', kitText.secondary)}>
      <span className="text-fg-muted">Pauză până la recoltare</span>
      <span className={cn('font-extrabold', zile > 0 ? 'text-warning-text' : 'text-success-text')}>
        {zile > 0 ? `${zileText(zile)} · ${produs}` : 'Fără pauză'}
      </span>
    </p>
  )
}

export interface PasDetaliiProps {
  ciorna: CiornaTratament
  parcele: readonly ParcelaFormular[]
  /** Volumul folosit (propus din parcele sau scris de om). */
  volumL: number | null
  volumPropus: number | null
  onVolum: (volum: number | null) => void
  onParcele: (ids: string[]) => void
  onMod: (mod: ModDoza) => void
  onProdus: (key: string, patch: Partial<ProdusCiorna>) => void
  onScoate: (key: string) => void
  onAdauga: () => void
  avertismente: readonly Avertisment[]
  lipsa: string | null
}

/** Pasul 2: unde și cu ce. Arată diferit pentru stropire, fertirigare și „la sol”. */
export function PasDetalii(props: PasDetaliiProps) {
  if (props.ciorna.metoda === 'fertirigare') return <DetaliiFertirigare {...props} />
  if (props.ciorna.metoda === 'sol') return <DetaliiSol {...props} />
  return <DetaliiStropire {...props} />
}

function DetaliiStropire({ ciorna, parcele, volumL, volumPropus, onVolum, onParcele, onMod, onProdus, onScoate, onAdauga, avertismente, lipsa }: PasDetaliiProps) {
  const alese = parcele.filter((parcela) => ciorna.parcelaIds.includes(parcela.id))
  const ha = suprafataHa(alese)
  const unitateMare = (unitate: UnitateProdus) => (unitate === 'g' ? 'kg' : 'l')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Eticheta>Unde</Eticheta>
        <ParcelePills parcele={parcele} value={ciorna.parcelaIds} onChange={onParcele} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Eticheta>Soluție</Eticheta>
          <p className={cn('text-fg-muted', kitText.helper)}>
            {volumPropus !== null ? `Propus din parcele: ${volumPropus} l` : ciorna.parcelaIds.length > 0 ? 'Scrie câți litri faci' : 'Alege parcelele'}
          </p>
        </div>
        <NumberStepper size="compact" label="Soluție" value={volumL} onChange={onVolum} step={10} min={0} max={20000} decimals={1} unit="l" />
      </div>

      <Segments
        aria-label="Cum e scrisă doza"
        options={[
          { value: 'hl', label: 'Doza la 100 l' },
          { value: 'ha', label: 'Doza la ha' },
        ]}
        value={ciorna.mod}
        onValueChange={onMod}
      />

      <div className="space-y-2">
        <Eticheta>Cu ce · în același rezervor</Eticheta>
        {ciorna.produse.map((produs) => {
          const total = cantitateStropire({ doza: produs.doza, mod: ciorna.mod, volumL, suprafataHa: ha })
          return (
            <div key={produs.key} className="space-y-2 rounded-box border-2 border-border bg-surface p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className={cn('font-bold text-fg', kitText.base)}>{produs.nume}</p>
                  <p className={cn('text-fg-muted', kitText.helper)}>{metaProdus(produs)}</p>
                </div>
                <p className={cn('shrink-0 text-right font-extrabold text-fg', kitText.base)} aria-label={`Cât pui din ${produs.nume}`}>
                  {total !== null ? formatCantitate(total, produs.unitate) : '—'}
                </p>
                <ScoateProdus nume={produs.nume} onClick={() => onScoate(produs.key)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <NumberStepper
                  size="compact"
                  label={`Doza ${produs.nume}`}
                  value={produs.doza}
                  onChange={(doza) => onProdus(produs.key, { doza })}
                  step={ciorna.mod === 'hl' ? 10 : 0.1}
                  min={0}
                  max={ciorna.mod === 'hl' ? 10000 : 100}
                  decimals={2}
                  unit={ciorna.mod === 'hl' ? `${produs.unitate} / 100 l` : `${unitateMare(produs.unitate)} / ha`}
                />
              </div>
              <Segments
                aria-label={`Unitatea pentru ${produs.nume}`}
                options={[
                  { value: 'ml', label: ciorna.mod === 'hl' ? 'Lichid (ml)' : 'Lichid (l)' },
                  { value: 'g', label: ciorna.mod === 'hl' ? 'Pulbere (g)' : 'Pulbere (kg)' },
                ]}
                value={produs.unitate}
                onValueChange={(unitate) => onProdus(produs.key, { unitate })}
              />
            </div>
          )
        })}
        <AdaugaProdus onClick={onAdauga} primul={ciorna.produse.length === 0} />
      </div>

      <Avertismente list={avertismente} />
      {ciorna.produse.length > 0 ? <LiniePauza produse={ciorna.produse} /> : null}
      {lipsa && ciorna.produse.length > 0 ? <p className={cn('px-1 text-fg-muted', kitText.helper)}>{lipsa}</p> : null}
    </div>
  )
}

const CALCIU = /calcinit|calciu|azotat de calc|nitrat de calc/i

function DetaliiFertirigare({ ciorna, parcele, onParcele, onProdus, onScoate, onAdauga, lipsa }: PasDetaliiProps) {
  const alese = parcele.filter((parcela) => ciorna.parcelaIds.includes(parcela.id))
  const totalRezervor = (rezervor: 'A' | 'B') =>
    ciorna.produse
      .filter((produs) => produs.rezervor === rezervor)
      .reduce((sum, produs) => sum + alese.reduce((acc, parcela) => acc + (kgFertirigare(produs.gPePlanta, parcela.nr_plante) ?? 0), 0), 0)
  const totalA = totalRezervor('A')
  const totalB = totalRezervor('B')
  const areRezervorB = ciorna.produse.some((produs) => produs.rezervor === 'B')
  const textParcela = (parcela: ParcelaFormular) =>
    (['A', 'B'] as const)
      .filter((rezervor) => rezervor === 'A' || areRezervorB)
      .map((rezervor) => {
        const kg = ciorna.produse
          .filter((produs) => produs.rezervor === rezervor)
          .reduce((sum, produs) => sum + (kgFertirigare(produs.gPePlanta, parcela.nr_plante) ?? 0), 0)
        return `${rezervor} ${formatKgTratament(kg)}`
      })
      .join(' · ')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Eticheta>Cu ce · grame pe plantă</Eticheta>
        {ciorna.produse.map((produs) => (
          <div key={produs.key} className="space-y-2 rounded-box border-2 border-border bg-surface p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className={cn('font-bold text-fg', kitText.base)}>{produs.nume}</p>
                <p className={cn('text-fg-muted', kitText.helper)}>Rezervor {produs.rezervor}</p>
              </div>
              <ScoateProdus nume={produs.nume} onClick={() => onScoate(produs.key)} />
            </div>
            <NumberStepper
              size="compact"
              label={`Grame pe plantă ${produs.nume}`}
              value={produs.gPePlanta}
              onChange={(gPePlanta) => onProdus(produs.key, { gPePlanta })}
              step={0.5}
              min={0}
              max={1000}
              decimals={2}
              unit="g / plantă"
            />
            <Segments
              aria-label={`Rezervorul pentru ${produs.nume}`}
              options={[
                { value: 'A', label: 'Rezervor A' },
                { value: 'B', label: 'Rezervor B' },
              ]}
              value={produs.rezervor}
              onValueChange={(rezervor) => onProdus(produs.key, { rezervor })}
            />
          </div>
        ))}
        <AdaugaProdus onClick={onAdauga} primul={ciorna.produse.length === 0} />
      </div>

      <div className="space-y-2">
        <Eticheta>Pe parcele · cât pui în rezervor</Eticheta>
        {parcele.map((parcela) => {
          const bifata = ciorna.parcelaIds.includes(parcela.id)
          const plante = Number(parcela.nr_plante) || 0
          return (
            <CheckRow
              key={parcela.id}
              title={parcela.nume_parcela?.trim() || 'Parcelă fără nume'}
              detail={plante > 0 ? `${new Intl.NumberFormat('ro-RO').format(plante)} plante` : 'Fără număr de plante (completează-l în Parcele)'}
              checked={bifata}
              onCheckedChange={(checked) =>
                onParcele(checked ? [...ciorna.parcelaIds, parcela.id] : ciorna.parcelaIds.filter((id) => id !== parcela.id))
              }
              trailing={
                <span className={cn('font-bold', kitText.secondary, bifata ? 'text-fg' : 'text-fg-subtle')}>
                  {bifata ? (plante > 0 && ciorna.produse.length > 0 ? textParcela(parcela) : '—') : 'nu azi'}
                </span>
              }
            />
          )
        })}
      </div>

      {ciorna.produse.some((produs) => CALCIU.test(produs.nume)) ? (
        <Notice tone="info" title="Calciul merge separat">
          Produsele cu calciu nu se amestecă în același rezervor cu sulfații sau fosfații.
        </Notice>
      ) : null}

      {ciorna.produse.length > 0 ? (
        <p className={cn('flex items-baseline justify-between gap-3 px-1', kitText.secondary)}>
          <span className="text-fg-muted">Total · {pauzaCiorna(ciorna.produse).zile > 0 ? `pauză ${zileText(pauzaCiorna(ciorna.produse).zile)}` : 'fără pauză'}</span>
          <span className="font-extrabold text-fg">
            A {formatKgTratament(totalA)}
            {areRezervorB ? ` · B ${formatKgTratament(totalB)}` : ''}
          </span>
        </p>
      ) : null}
      {lipsa && ciorna.produse.length > 0 ? <p className={cn('px-1 text-fg-muted', kitText.helper)}>{lipsa}</p> : null}
    </div>
  )
}

function DetaliiSol({ ciorna, parcele, onParcele, onProdus, onScoate, onAdauga, lipsa }: PasDetaliiProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Eticheta>Unde</Eticheta>
        <ParcelePills parcele={parcele} value={ciorna.parcelaIds} onChange={onParcele} />
      </div>
      <div className="space-y-2">
        <Eticheta>Cu ce · cât în total</Eticheta>
        {ciorna.produse.map((produs) => (
          <div key={produs.key} className="space-y-2 rounded-box border-2 border-border bg-surface p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className={cn('font-bold text-fg', kitText.base)}>{produs.nume}</p>
                <p className={cn('text-fg-muted', kitText.helper)}>{metaProdus(produs)}</p>
              </div>
              <ScoateProdus nume={produs.nume} onClick={() => onScoate(produs.key)} />
            </div>
            <NumberStepper
              size="compact"
              label={`Cantitate ${produs.nume}`}
              value={produs.doza}
              onChange={(doza) => onProdus(produs.key, { doza })}
              step={1}
              min={0}
              max={100000}
              decimals={2}
              unit={produs.unitate === 'ml' ? 'l' : 'kg'}
            />
            <Segments
              aria-label={`Unitatea pentru ${produs.nume}`}
              options={[
                { value: 'g', label: 'Kilograme' },
                { value: 'ml', label: 'Litri' },
              ]}
              value={produs.unitate}
              onValueChange={(unitate) => onProdus(produs.key, { unitate })}
            />
          </div>
        ))}
        <AdaugaProdus onClick={onAdauga} primul={ciorna.produse.length === 0} />
      </div>
      {ciorna.produse.length > 0 ? <LiniePauza produse={ciorna.produse} /> : null}
      {lipsa && ciorna.produse.length > 0 ? <p className={cn('px-1 text-fg-muted', kitText.helper)}>{lipsa}</p> : null}
    </div>
  )
}
