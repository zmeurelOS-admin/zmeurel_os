'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { BigInput, Button, ListRow, Notice, NumberStepper, StatusPill, StepFormTitle, Tile, TileGroup, kitText } from '@/components/kit'
import { searchKey } from '@/lib/format-ro'
import type { ProdusCatalog } from '@/lib/tratamente/model'
import { zileText } from '@/lib/tratamente/zile'
import type { TipProdusNou } from '@/lib/supabase/queries/tratamente'
import { cn } from '@/lib/utils'

const TIP_LABEL: Record<string, string> = {
  fungicid: 'Fungicid',
  insecticid: 'Insecticid',
  acaricid: 'Acaricid',
  erbicid: 'Erbicid',
  foliar: 'Foliar',
  ingrasamant: 'Îngrășământ',
  bioregulator: 'Biostimulator',
  altul: 'Altul',
}

export interface ProdusRecent {
  produs: ProdusCatalog | null
  nume: string
  /** „Ultima: marți 15.07, Maravilla 1”. */
  ultima: string
}

function metaProdus(produs: Pick<ProdusCatalog, 'tip' | 'substanta_activa' | 'frac_irac'>): string {
  return [TIP_LABEL[produs.tip] ?? produs.tip, produs.substanta_activa?.trim(), produs.frac_irac?.trim()].filter(Boolean).join(' · ')
}

function PauzaPill({ phi }: { phi: number | null }) {
  if (phi === null || phi === undefined) return <StatusPill tone="neutral">pauză ?</StatusPill>
  if (phi <= 0) return <StatusPill tone="success">fără pauză</StatusPill>
  return <StatusPill tone="warning">pauză {phi} z</StatusPill>
}

const potrivit = (produs: ProdusCatalog, cautare: string) => {
  if (!cautare) return true
  return searchKey(`${produs.nume_comercial} ${produs.substanta_activa}`).includes(cautare)
}

/** Alegerile rapide la sol: ce se pune de obicei fără catalog. */
const SUGESTII_SOL = ['Gunoi de grajd', 'Compost']

/**
 * Alegerea produsului: căutare după nume sau substanță, „Folosite recent”, catalogul (filtrat „pentru zmeur”
 * când parcela e de zmeură, cu „Arată toate”) și „Nu e în listă”. Ține locul conținutului pasului.
 */
export function AlegeProdus({
  catalog,
  recente,
  doarZmeur,
  dejaAlese,
  onAlege,
  onProdusNou,
  numeManual = false,
}: {
  catalog: readonly ProdusCatalog[]
  recente: readonly ProdusRecent[]
  /** Parcelele alese sunt de zmeură: catalogul arată întâi produsele omologate pentru zmeur. */
  doarZmeur: boolean
  /** Numele produselor deja în rezervor (nu se adaugă de două ori). */
  dejaAlese: ReadonlySet<string>
  onAlege: (produs: ProdusCatalog | null, numeManual?: string) => void
  onProdusNou: () => void
  /**
   * La sol (promptul 34, §8): produsul se poate scrie de mână doar pentru tratamentul acesta (gunoi de grajd),
   * fără catalog și fără magazie.
   */
  numeManual?: boolean
}) {
  const [text, setText] = useState('')
  const [toate, setToate] = useState(false)
  const cautare = searchKey(text)

  const dinCatalog = useMemo(() => {
    const filtrate = catalog.filter((produs) => potrivit(produs, cautare) && !dejaAlese.has(produs.nume_comercial))
    if (!doarZmeur || toate || cautare) return filtrate
    return filtrate.filter((produs) => (produs.omologat_culturi ?? []).some((cultura) => searchKey(cultura).startsWith('zmeur')) || produs.tenant_id !== null)
  }, [catalog, cautare, dejaAlese, doarZmeur, toate])
  const ascunse = catalog.filter((produs) => !dejaAlese.has(produs.nume_comercial)).length - dinCatalog.length

  const recenteVizibile = recente.filter(
    (item) => !dejaAlese.has(item.nume) && (!cautare || searchKey(`${item.nume} ${item.produs?.substanta_activa ?? ''}`).includes(cautare)),
  )

  const [manual, setManual] = useState('')
  const alegeManual = (nume: string) => {
    const curat = nume.trim()
    if (curat && !dejaAlese.has(curat)) onAlege(null, curat)
  }

  return (
    <div className="space-y-4">
      {numeManual ? (
        <section className="space-y-2.5 rounded-box border-2 border-border bg-surface p-3" aria-labelledby="produs-scris">
          <h3 id="produs-scris" className={cn('font-bold text-fg', kitText.base)}>
            Scrie ce ai pus
          </h3>
          <div className="flex flex-wrap gap-2">
            {SUGESTII_SOL.filter((nume) => !dejaAlese.has(nume)).map((nume) => (
              <Button key={nume} type="button" variant="neutral" size="touch" onClick={() => alegeManual(nume)}>
                {nume}
              </Button>
            ))}
          </div>
          <BigInput
            label="Numele (fără catalog)"
            placeholder="ex. Gunoi de grajd de vită"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            autoComplete="off"
            maxLength={120}
          />
          <Button type="button" variant="primary" size="touch" className="w-full" disabled={!manual.trim()} onClick={() => alegeManual(manual)}>
            Folosește numele scris
          </Button>
        </section>
      ) : null}

      <BigInput
        label="Caută produsul"
        leading={<Search aria-hidden />}
        placeholder="Produs sau substanță activă"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
      />

      {recenteVizibile.length > 0 ? (
        <section className="space-y-2" aria-label="Folosite recent">
          <h3 className={cn('px-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>Folosite recent</h3>
          <ul className="space-y-2">
            {recenteVizibile.map((item) => (
              <li key={`recent-${item.nume}`}>
                <ListRow
                  avatar={false}
                  chevron={false}
                  title={item.nume}
                  detail={[item.produs ? metaProdus(item.produs) : null, item.ultima].filter(Boolean).join(' · ')}
                  trailing={<PauzaPill phi={item.produs?.phi_zile ?? null} />}
                  onClick={() => onAlege(item.produs, item.produs ? undefined : item.nume)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2" aria-label="Din catalog">
        <h3 className={cn('px-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>
          {doarZmeur && !toate && !cautare ? 'Din catalog · pentru zmeur' : 'Din catalog'}
        </h3>
        {dinCatalog.length === 0 ? (
          <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Niciun produs găsit.</p>
        ) : (
          <ul className="space-y-2">
            {dinCatalog.map((produs) => (
              <li key={produs.id}>
                <ListRow
                  avatar={false}
                  chevron={false}
                  title={produs.nume_comercial}
                  detail={metaProdus(produs)}
                  trailing={<PauzaPill phi={produs.phi_zile} />}
                  onClick={() => onAlege(produs)}
                />
              </li>
            ))}
          </ul>
        )}
        {doarZmeur && !toate && !cautare && ascunse > 0 ? (
          <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => setToate(true)}>
            Arată toate ({ascunse} pentru alte culturi)
          </Button>
        ) : null}
      </section>

      <Button type="button" variant="neutral" size="touch" className="w-full" onClick={onProdusNou}>
        Nu e în listă: scriu eu numele și pauza
      </Button>
    </div>
  )
}

const TIPURI_NOI: Array<{ value: TipProdusNou; label: string }> = [
  { value: 'fungicid', label: 'Fungicid' },
  { value: 'insecticid', label: 'Insecticid' },
  { value: 'foliar', label: 'Foliar' },
  { value: 'ingrasamant', label: 'Îngrășământ' },
  { value: 'bioregulator', label: 'Biostimulator' },
  { value: 'altul', label: 'Altul' },
]

/** „Nu e în listă”: produs nou al fermei, cu nume, tip și pauză. */
export function ProdusNou({
  tipImplicit,
  onSalveaza,
}: {
  tipImplicit: TipProdusNou
  onSalveaza: (input: { nume: string; tip: TipProdusNou; phiZile: number | null }) => Promise<string | null>
}) {
  const [nume, setNume] = useState('')
  const [tip, setTip] = useState<TipProdusNou>(tipImplicit)
  const [phi, setPhi] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!nume.trim() || saving) return
    setSaving(true)
    setError(null)
    const result = await onSalveaza({ nume: nume.trim(), tip, phiZile: phi })
    setSaving(false)
    if (result) setError(result)
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <StepFormTitle>Produs nou</StepFormTitle>
      <BigInput label="Numele produsului" value={nume} onChange={(event) => setNume(event.target.value)} autoFocus maxLength={120} placeholder="ex. Serenade ASO" />
      <div className="space-y-2">
        <p className={cn('font-bold text-fg', kitText.secondary)}>Ce fel de produs</p>
        <TileGroup type="single" value={tip} onValueChange={(value) => value && setTip(value as TipProdusNou)} aria-label="Tipul produsului" columns={3}>
          {TIPURI_NOI.map((item) => (
            <Tile key={item.value} value={item.value} size="sm" title={item.label} />
          ))}
        </TileGroup>
      </div>
      <div className="space-y-2">
        <p className={cn('font-bold text-fg', kitText.secondary)}>Pauza până la recoltare (de pe etichetă)</p>
        <NumberStepper size="compact" label="Pauza în zile" value={phi} onChange={setPhi} min={0} max={120} unit="zile" />
        <p className={cn('text-fg-muted', kitText.helper)}>
          {phi === null ? 'Lasă gol dacă nu știi; 0 = fără pauză.' : phi === 0 ? 'Fără pauză.' : `Nu se recoltează ${zileText(phi)} după aplicare.`}
        </p>
      </div>
      {error ? (
        <Notice tone="danger" title="Nu s-a salvat produsul">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={saving} disabled={!nume.trim()}>
        Adaugă produsul
      </Button>
    </form>
  )
}
