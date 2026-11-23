'use client'

import { Plus, X } from 'lucide-react'

import { BigInput, Button, FilterPills, NumberStepper, Segments, ToggleRow, kitFocus, kitText } from '@/components/kit'
import { eticheta, type LinieNoua, type MetodaLinie, type ProdusLinieNou } from '@/lib/plan'
import { citesteTextFertirigare, textFertirigare } from '@/lib/tratamente/doze'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'
import { cn } from '@/lib/utils'

type MetodaEditor = 'foliar' | 'fertirigare' | 'fertilizare_baza'
type ModDozaLinie = 'hl' | 'ha'

const metodaEditor = (metoda: MetodaLinie | null): MetodaEditor =>
  metoda === 'fertirigare' ? 'fertirigare' : metoda === 'fertilizare_baza' || metoda === 'granulat_sol' ? 'fertilizare_baza' : 'foliar'

const modLinie = (linie: LinieNoua): ModDozaLinie =>
  linie.produse.some((p) => Number(p.doza_l_per_ha) > 0) && !linie.produse.some((p) => Number(p.doza_ml_per_hl) > 0) ? 'ha' : 'hl'

const nr = (value: string): number | null => {
  const n = Number(value.replace(',', '.').trim())
  return value.trim() && Number.isFinite(n) && n >= 0 ? n : null
}
const txt = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value).replace('.', ','))

function Eticheta({ children }: { children: React.ReactNode }) {
  return <p className={cn('font-bold text-fg', kitText.secondary)}>{children}</p>
}

/**
 * Editorul unei linii de plan (ține locul conținutului pasului, ca restul alegerilor dintr-un formular pe pași):
 * stadiul, metoda, produsele cu doza, scopul și „repetă la N zile, de M ori”. Produsul se alege cu
 * `onAlegeProdus` (formularul părinte arată lista de produse în locul editorului).
 */
export function LinieEditor({
  linie,
  onChange,
  stadii,
  culturaTip,
  onAlegeProdus,
}: {
  linie: LinieNoua
  onChange: (linie: LinieNoua) => void
  stadii: readonly StadiuCod[]
  culturaTip: string
  onAlegeProdus: () => void
}) {
  const metoda = metodaEditor(linie.metoda)
  const mod = modLinie(linie)

  const patchProdus = (index: number, patch: Partial<ProdusLinieNou>) =>
    onChange({ ...linie, produse: linie.produse.map((p, i) => (i === index ? { ...p, ...patch } : p)) })

  const schimbaMod = (next: ModDozaLinie) =>
    onChange({
      ...linie,
      produse: linie.produse.map((p) => {
        const valoare = p.doza_ml_per_hl ?? p.doza_l_per_ha
        return next === 'ha' ? { ...p, doza_l_per_ha: valoare, doza_ml_per_hl: null } : { ...p, doza_ml_per_hl: valoare, doza_l_per_ha: null }
      }),
    })

  const schimbaMetoda = (next: MetodaEditor) =>
    onChange({
      ...linie,
      metoda: next,
      // Dozele nu se traduc între metode: pornesc goale.
      produse: linie.produse.map((p) => ({ ...p, doza_ml_per_hl: null, doza_l_per_ha: null, cantitate_text: null })),
    })

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Eticheta>Stadiul</Eticheta>
        <FilterPills
          aria-label="Stadiul liniei"
          wrap
          options={stadii.map((s) => ({ value: s, label: eticheta(s, culturaTip) }))}
          value={linie.stadiu}
          onValueChange={(stadiu) => onChange({ ...linie, stadiu })}
        />
      </section>

      <section className="space-y-2">
        <Eticheta>Metoda</Eticheta>
        <Segments
          aria-label="Metoda"
          options={[
            { value: 'foliar', label: 'Foliar' },
            { value: 'fertirigare', label: 'Fertirigare' },
            { value: 'fertilizare_baza', label: 'La sol' },
          ]}
          value={metoda}
          onValueChange={schimbaMetoda}
        />
      </section>

      <section className="space-y-2">
        <Eticheta>Produsele</Eticheta>
        {metoda === 'foliar' && linie.produse.length > 0 ? (
          <Segments aria-label="Doza" options={[{ value: 'hl', label: 'La 100 l' }, { value: 'ha', label: 'La hectar' }]} value={mod} onValueChange={schimbaMod} />
        ) : null}
        <ul className="space-y-2">
          {linie.produse.map((produs, index) => {
            const fert = citesteTextFertirigare(produs.cantitate_text)
            const solid = produs.tip === 'ingrasamant'
            return (
              <li key={`${produs.nume}-${index}`} className="space-y-2 rounded-box border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <p className={cn('min-w-0 flex-1 font-semibold text-fg', kitText.base)}>{produs.nume}</p>
                  <button
                    type="button"
                    aria-label={`Scoate ${produs.nume}`}
                    onClick={() => onChange({ ...linie, produse: linie.produse.filter((_, i) => i !== index) })}
                    className={cn('flex size-touch shrink-0 items-center justify-center rounded-control text-fg-muted active:bg-surface-muted [&_svg]:size-5', kitFocus)}
                  >
                    <X aria-hidden />
                  </button>
                </div>
                {metoda === 'fertirigare' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <BigInput
                      label="g / plantă"
                      inputMode="decimal"
                      value={txt(fert?.gPePlanta)}
                      onChange={(event) => {
                        const g = nr(event.target.value)
                        patchProdus(index, { cantitate_text: g && g > 0 ? textFertirigare(g, fert?.rezervor ?? 'A') : null })
                      }}
                    />
                    <Segments
                      aria-label={`Rezervorul pentru ${produs.nume}`}
                      className="self-end"
                      options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]}
                      value={fert?.rezervor ?? 'A'}
                      onValueChange={(rezervor) => patchProdus(index, { cantitate_text: textFertirigare(fert?.gPePlanta ?? 1, rezervor) })}
                    />
                  </div>
                ) : metoda === 'fertilizare_baza' ? (
                  <BigInput
                    label={solid ? 'kg / ha' : 'l / ha'}
                    inputMode="decimal"
                    value={txt(produs.doza_l_per_ha)}
                    onChange={(event) => patchProdus(index, { doza_l_per_ha: nr(event.target.value), doza_ml_per_hl: null })}
                  />
                ) : (
                  <BigInput
                    label={mod === 'ha' ? (solid ? 'kg / ha' : 'l / ha') : solid ? 'g la 100 l' : 'ml la 100 l'}
                    inputMode="decimal"
                    value={txt(mod === 'ha' ? produs.doza_l_per_ha : produs.doza_ml_per_hl)}
                    onChange={(event) =>
                      patchProdus(index, mod === 'ha' ? { doza_l_per_ha: nr(event.target.value), doza_ml_per_hl: null } : { doza_ml_per_hl: nr(event.target.value), doza_l_per_ha: null })
                    }
                  />
                )}
              </li>
            )
          })}
        </ul>
        <Button type="button" variant="neutral" size="touch" className="w-full border-dashed" onClick={onAlegeProdus}>
          <Plus aria-hidden />
          {linie.produse.length === 0 ? 'Alege produsul' : 'Adaugă produs'}
        </Button>
      </section>

      <BigInput label="Scopul (opțional)" placeholder="De ex. botritis, bor la înflorire" value={linie.scop ?? ''} onChange={(event) => onChange({ ...linie, scop: event.target.value })} />

      <section className="space-y-2">
        <ToggleRow
          title="Se repetă"
          subtitle="După ce o faci, apare din nou cât timp parcela e în același stadiu"
          checked={Boolean(linie.repetare)}
          onCheckedChange={(checked) => onChange({ ...linie, repetare: checked ? { zile: 7, ori: 2 } : null })}
        />
        {linie.repetare ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className={cn('text-fg-muted', kitText.secondary)}>La câte zile</p>
              <NumberStepper
                label="La câte zile"
                size="compact"
                min={1}
                max={60}
                unit="zile"
                value={linie.repetare.zile}
                onChange={(zile) => onChange({ ...linie, repetare: { zile: zile ?? 7, ori: linie.repetare?.ori ?? null } })}
              />
            </div>
            <div className="space-y-1">
              <p className={cn('text-fg-muted', kitText.secondary)}>De câte ori</p>
              <NumberStepper
                label="De câte ori în total"
                size="compact"
                min={1}
                max={20}
                unit="ori"
                value={linie.repetare.ori}
                onChange={(ori) => onChange({ ...linie, repetare: { zile: linie.repetare?.zile ?? 7, ori } })}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
