'use client'

import { useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Flag,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Search,
  Sprout,
  Trash2,
  Truck,
  UserPlus,
  X,
} from 'lucide-react'

import {
  ActionCard,
  ActionCardChip,
  BigInput,
  BigTextarea,
  Button,
  CheckRow,
  EmptyState,
  FilterPills,
  ListRow,
  Notice,
  ProgressBar,
  Segments,
  StatHero,
  StatTile,
  StatusPill,
  Tile,
  TileGroup,
  ToggleRow,
  kitText,
} from '@/components/kit'
import { cn } from '@/lib/utils'

import { KitSection, Stare } from './KitShowcaseClient'
import { DEMO_COMENZI_AZI, DEMO_CULEGATORI, DEMO_STOC_KG, formatKg, formatLei } from './kit-demo-data'

// ─── Butoane ───────────────────────────────────────────────────────────────────

function ButoaneDemo() {
  const [loading, setLoading] = useState(false)

  const simulate = () => {
    setLoading(true)
    window.setTimeout(() => setLoading(false), 1500)
  }

  return (
    <>
      <Stare label="Variante, 48 px (touch)">
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="primary" size="touch">
            Principal
          </Button>
          <Button variant="neutral" size="touch">
            Secundar
          </Button>
          <Button variant="danger" size="touch">
            Pericol
          </Button>
          <Button variant="quiet" size="touch">
            Fantomă
          </Button>
        </div>
      </Stare>
      <Stare label="Acțiunea principală, 56 px (touch-lg)">
        <Button variant="primary" size="touch-lg" className="w-full">
          <Plus aria-hidden />
          Adaugă kg
        </Button>
      </Stare>
      <Stare label="Cu iconiță">
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="neutral" size="touch">
            <Phone aria-hidden />
            Sună
          </Button>
          <Button variant="danger" size="touch">
            <Trash2 aria-hidden />
            Șterge
          </Button>
        </div>
      </Stare>
      <Stare label="Încărcare (apasă)">
        <Button variant="primary" size="touch-lg" className="w-full" loading={loading} onClick={simulate}>
          {loading ? 'Se salvează…' : 'Salvează'}
        </Button>
      </Stare>
      <Stare label="Dezactivat">
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="primary" size="touch" disabled>
            Principal
          </Button>
          <Button variant="neutral" size="touch" disabled>
            Secundar
          </Button>
        </div>
      </Stare>
      <Stare label="Doar iconiță, 48 px (icon-touch)">
        <div className="flex gap-2.5">
          <Button variant="neutral" size="icon-touch" aria-label="Înapoi">
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="quiet" size="icon-touch" aria-label="Închide">
            <X aria-hidden />
          </Button>
          <Button variant="primary" size="icon-touch" aria-label="Adaugă">
            <Plus aria-hidden />
          </Button>
        </div>
      </Stare>
    </>
  )
}

// ─── Plăci ─────────────────────────────────────────────────────────────────────

const CANTITATI = ['2', '3', '4', '5', '6', '8', '10']

function PlaciDemo() {
  const [culegator, setCulegator] = useState<string | null>(null)
  const [cantitate, setCantitate] = useState<string | null>(null)
  const [zile, setZile] = useState<string[]>(['azi'])

  return (
    <>
      <Stare label="Alegere unică, cu subtitlu și insignă (nimic preselectat)">
        <TileGroup type="single" aria-label="Culegător" value={culegator} onValueChange={setCulegator}>
          {DEMO_CULEGATORI.slice(0, 3).map((c) => (
            <Tile
              key={c.id}
              value={c.id}
              leading={c.prenume.charAt(0)}
              title={c.prenume}
              subtitle={c.nume}
              badge={c.kgAzi ? `✓ azi ${formatKg(c.kgAzi)}` : undefined}
            />
          ))}
          <Tile title="Culegător nou" leading={<UserPlus />} dashed onClick={() => undefined} />
        </TileGroup>
      </Stare>
      <Stare label="Plăci scurte, 4 coloane">
        <TileGroup type="single" columns={4} aria-label="Cantitate" value={cantitate} onValueChange={setCantitate}>
          {CANTITATI.map((kg) => (
            <Tile key={kg} value={kg} size="sm" title={`${kg} kg`} />
          ))}
          <Tile value="alta" size="sm" title="Alta" dashed />
        </TileGroup>
      </Stare>
      <Stare label="Alegere multiplă">
        <TileGroup type="multiple" columns={3} aria-label="Zile de livrare" value={zile} onValueChange={setZile}>
          <Tile value="azi" size="sm" title="Azi" subtitle="mie." />
          <Tile value="maine" size="sm" title="Mâine" subtitle="joi" />
          <Tile value="poimaine" size="sm" title="Poimâine" subtitle="vin." />
        </TileGroup>
      </Stare>
      <Stare label="Dezactivat">
        <TileGroup type="single" aria-label="Exemplu dezactivat" value="a" onValueChange={() => undefined}>
          <Tile value="a" title="Aleasă" subtitle="dezactivată" disabled />
          <Tile value="b" title="Nealeasă" subtitle="dezactivată" disabled />
        </TileGroup>
      </Stare>
    </>
  )
}

// ─── Segmente ──────────────────────────────────────────────────────────────────

type ZiFiltru = 'azi' | 'maine' | 'programate' | 'fara'

function SegmenteDemo() {
  const [zi, setZi] = useState<ZiFiltru>('azi')
  const [vedere, setVedere] = useState<'active' | 'luna' | 'toate'>('active')

  return (
    <>
      <Stare label="4 opțiuni (la 390 px, o etichetă de peste 8–9 litere se taie)">
        <Segments<ZiFiltru>
          aria-label="Ce comenzi arăt"
          value={zi}
          onValueChange={setZi}
          options={[
            { value: 'azi', label: 'Azi' },
            { value: 'maine', label: 'Mâine' },
            { value: 'programate', label: 'Programate' },
            { value: 'fara', label: 'Fără dată' },
          ]}
        />
      </Stare>
      <Stare label="3 opțiuni, cu contor">
        <Segments
          aria-label="Vedere"
          value={vedere}
          onValueChange={setVedere}
          options={[
            { value: 'active', label: 'De livrat', count: 7 },
            { value: 'luna', label: 'Luna asta', count: 23 },
            { value: 'toate', label: 'Toate', count: 96 },
          ]}
        />
      </Stare>
    </>
  )
}

// ─── Filtre pastilă ────────────────────────────────────────────────────────────

function FiltreDemo() {
  const [sursa, setSursa] = useState('toate')
  const [stari, setStari] = useState<string[]>(['noi'])

  return (
    <>
      <Stare label="Derulare orizontală, cu iconiță și contor">
        <FilterPills
          aria-label="Filtrează după sursa comenzii"
          value={sursa}
          onValueChange={setSursa}
          options={[
            { value: 'toate', label: 'Toate sursele', count: 23 },
            { value: 'whatsapp', label: 'WhatsApp', count: 14, icon: <MessageCircle aria-hidden /> },
            { value: 'telefon', label: 'Telefon', count: 6, icon: <Phone aria-hidden /> },
            { value: 'personal', label: 'Personal', count: 3 },
          ]}
        />
      </Stare>
      <Stare label="Pe rânduri, alegere multiplă">
        <FilterPills
          multiple
          wrap
          aria-label="Filtrează după stare"
          value={stari}
          onValueChange={setStari}
          options={[
            { value: 'noi', label: 'Noi', count: 5 },
            { value: 'programate', label: 'Programate', count: 12 },
            { value: 'in-livrare', label: 'În livrare', count: 3 },
            { value: 'livrate', label: 'Livrate', count: 48 },
          ]}
        />
      </Stare>
    </>
  )
}

// ─── Cifre ─────────────────────────────────────────────────────────────────────

function CifreDemo() {
  return (
    <>
      <Stare label="Tonuri: inversat, neutru, atenție">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile tone="inverse" value="7" label="comenzi azi" />
          <StatTile value="54" unit="kg" label="de livrat" />
          <StatTile tone="warning" value="1.620" label="lei de încasat" />
        </div>
      </Stare>
      <Stare label="Varianta mare (totalul zilei)">
        <StatHero
          label="Cules azi"
          value="248,5"
          unit="kg"
          items={[
            { label: 'de plată culegătorilor', value: formatLei(994) },
            { label: 'culegători', value: '5' },
            { label: 'calitatea 1', value: formatKg(231) },
            { label: 'calitatea 2', value: formatKg(17.5) },
          ]}
        />
      </Stare>
    </>
  )
}

// ─── Pastilă de status ─────────────────────────────────────────────────────────

function StatusDemo() {
  return (
    <>
      <Stare label="Cele 5 tonuri">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="neutral">Fără dată</StatusPill>
          <StatusPill tone="info">Nouă</StatusPill>
          <StatusPill tone="success">Livrată</StatusPill>
          <StatusPill tone="warning">În livrare</StatusPill>
          <StatusPill tone="danger">Anulată</StatusPill>
        </div>
      </Stare>
      <Stare label="Cu iconiță">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="warning" icon={<Flag aria-hidden />}>
            Prioritară
          </StatusPill>
          <StatusPill tone="success" icon={<Check aria-hidden />}>
            Achitat
          </StatusPill>
          <StatusPill tone="info" icon={<CalendarDays aria-hidden />}>
            Programată
          </StatusPill>
        </div>
      </Stare>
    </>
  )
}

// ─── Stare goală ───────────────────────────────────────────────────────────────

function GolDemo() {
  return (
    <>
      <Stare label="Cu acțiune">
        <EmptyState
          icon={<Sprout />}
          title="Nimic cules azi"
          description="Adaugă primele kilograme când vine primul culegător la cântar."
          action={
            <Button variant="primary" size="touch">
              <Plus aria-hidden />
              Adaugă kg
            </Button>
          }
        />
      </Stare>
      <Stare label="Fără acțiune (filtru fără rezultate)">
        <EmptyState icon={<Search />} title="Nicio comandă aici" description="Schimbă filtrul sau caută altceva." />
      </Stare>
    </>
  )
}

// ─── Câmp mare ─────────────────────────────────────────────────────────────────

function CampuriDemo() {
  const [nume, setNume] = useState('')
  const [cautare, setCautare] = useState('')
  const [nota, setNota] = useState('')

  return (
    <>
      <Stare label="Cu etichetă și text ajutător">
        <BigInput
          label="Numele clientului"
          placeholder="ex. Maria Ionescu"
          hint="Apare pe comandă și în lista de livrări."
          value={nume}
          onChange={(event) => setNume(event.target.value)}
          autoComplete="off"
        />
      </Stare>
      <Stare label="Cu iconiță (căutare)">
        <BigInput
          aria-label="Caută client"
          type="search"
          placeholder="Caută după nume sau telefon"
          leading={<Search />}
          value={cautare}
          onChange={(event) => setCautare(event.target.value)}
          autoComplete="off"
        />
      </Stare>
      <Stare label="Eroare">
        <BigInput
          label="Telefon"
          inputMode="tel"
          defaultValue="0744"
          error="Numărul e prea scurt. Scrie toate cele 10 cifre."
        />
      </Stare>
      <Stare label="Dezactivat">
        <BigInput label="Preț pe kg" defaultValue="30 lei" disabled />
      </Stare>
      <Stare label="Pe mai multe rânduri">
        <BigTextarea
          label="Notă pentru livrare"
          placeholder="ex. Sună înainte, lasă la vecină"
          value={nota}
          onChange={(event) => setNota(event.target.value)}
        />
      </Stare>
    </>
  )
}

// ─── Rând de listă ─────────────────────────────────────────────────────────────

function OprireNumar({ numar }: { numar: number }) {
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-extrabold text-fg',
        kitText.base,
      )}
      aria-hidden
    >
      {numar}
    </span>
  )
}

function RanduriDemo() {
  return (
    <>
      <Stare label="Apăsabil: inițială, detaliu, săgeată">
        <div className="space-y-2.5">
          <ListRow title="Maria Ionescu" detail="0744 123 456 · 4 comenzi" onClick={() => undefined} />
          <ListRow title="Patiseria Bucovina" detail="Patiserie · 26 lei/kg" onClick={() => undefined} />
          <ListRow
            title="Ion Popescu"
            detail="Gura Humorului"
            trailing={<StatusPill tone="info">Nou</StatusPill>}
            onClick={() => undefined}
          />
        </div>
      </Stare>
      <Stare label="Oprire pe traseu: număr și cantitate">
        <div className="space-y-2.5">
          <ListRow
            leading={<OprireNumar numar={2} />}
            title="Ion Popescu"
            detail="Gura Humorului · str. Bucovinei 14"
            trailing={<span className={cn('font-bold text-fg', kitText.base)}>5 kg</span>}
            onClick={() => undefined}
          />
          <ListRow
            leading={<OprireNumar numar={3} />}
            title="Cofetăria Aroma"
            detail="Suceava · fără locație încă"
            trailing={<span className={cn('font-bold text-fg', kitText.base)}>8 kg</span>}
            onClick={() => undefined}
          />
        </div>
      </Stare>
      <Stare label="Static (nu e apăsabil)">
        <ListRow
          title="Ana Lungu"
          detail="2 cântăriri azi"
          trailing={<span className={cn('font-bold text-fg', kitText.base)}>35 kg</span>}
        />
      </Stare>
      <Stare label="Dezactivat">
        <ListRow title="Vasile Rotaru" detail="inactiv din august" onClick={() => undefined} disabled />
      </Stare>
    </>
  )
}

// ─── Rând cu comutator ─────────────────────────────────────────────────────────

function ComutatorDemo() {
  const [locatie, setLocatie] = useState(true)
  const [prioritara, setPrioritara] = useState(false)
  const [final, setFinal] = useState(true)

  return (
    <>
      <Stare label="Pornit / oprit (apasă)">
        <ToggleRow
          title="Salvează locația de aici"
          subtitle="Precizie GPS: 12 m"
          checked={locatie}
          onCheckedChange={setLocatie}
        />
      </Stare>
      <Stare label="Ton de atenție, cu iconiță">
        <ToggleRow
          tone="warning"
          icon={<Flag />}
          title="Prioritară"
          subtitle="Apare prima în listă și e bifată implicit la livrare"
          checked={prioritara}
          onCheckedChange={setPrioritara}
        />
      </Stare>
      <Stare label="Fără subtitlu">
        <ToggleRow title="Mut-o la finalul traseului" checked={final} onCheckedChange={setFinal} />
      </Stare>
      <Stare label="Dezactivat">
        <ToggleRow
          title="Salvează locația de aici"
          subtitle="Precizia GPS e prea slabă (180 m)"
          checked={false}
          onCheckedChange={() => undefined}
          disabled
        />
      </Stare>
    </>
  )
}

// ─── Rând bifabil ──────────────────────────────────────────────────────────────

function BifaDemo() {
  const [a, setA] = useState(false)
  const [b, setB] = useState(true)

  return (
    <>
      <Stare label="Nebifat / bifat (apasă)">
        <div className="space-y-2.5">
          <CheckRow title="Ion Popescu" detail="Gura Humorului" trailing="5 kg" checked={a} onCheckedChange={setA} />
          <CheckRow
            title="Maria Ionescu"
            detail="Fălticeni"
            trailing="9 kg"
            badge={
              <StatusPill tone="warning" icon={<Flag aria-hidden />}>
                Prioritară
              </StatusPill>
            }
            checked={b}
            onCheckedChange={setB}
          />
        </div>
      </Stare>
      <Stare label="Blocat, cu motiv">
        <CheckRow
          title="Cofetăria Aroma"
          detail="Suceava"
          trailing="8 kg"
          checked={false}
          onCheckedChange={() => undefined}
          locked
          lockedReason="Nu ajunge stocul: lipsesc 3 kg"
        />
      </Stare>
    </>
  )
}

// ─── Bandă de mesaj ────────────────────────────────────────────────────────────

function BenziDemo() {
  return (
    <div className="space-y-2.5">
      <Notice tone="warning" icon={<Flag />} title="2 prioritare azi · 21 kg">
        De livrat cu prioritate.
      </Notice>
      <Notice tone="info" title="Traseul pornește de unde ești">
        Clienții fără locație rămân la final.
      </Notice>
      <Notice tone="success" title="Toate cele 7 livrări sunt făcute" />
      <Notice
        tone="danger"
        title="Prioritarele depășesc stocul"
        action={
          <Button variant="neutral" size="touch">
            Vezi stocul
          </Button>
        }
      >
        Ai 21 kg de livrat cu prioritate și doar 18 kg în stoc.
      </Notice>
    </div>
  )
}

// ─── Bară de progres ───────────────────────────────────────────────────────────

function ProgresDemo() {
  return (
    <div className="space-y-5">
      <ProgressBar label="Traseul de azi" valueLabel="3 din 7 livrate" value={3} max={7} />
      <ProgressBar tone="warning" label="Rămas în stoc" valueLabel="4 kg din 30 kg" value={4} max={30} />
      <ProgressBar tone="danger" label="Rămas în stoc" valueLabel="0 kg din 30 kg" value={0} max={30} />
      <ProgressBar tone="success" label="Traseul de azi" valueLabel="7 din 7 livrate" value={7} max={7} />
    </div>
  )
}

// ─── Card cu acțiune ───────────────────────────────────────────────────────────

function CardDemo() {
  const [loading, setLoading] = useState(false)

  return (
    <>
      <Stare label="Card de comandă: zone fixe + un buton principal">
        <ActionCard
          title="Maria Ionescu"
          meta="Fălticeni · comandat ieri"
          amount={formatLei(270)}
          pills={
            <>
              <ActionCardChip>9 kg</ActionCardChip>
              <StatusPill tone="warning" icon={<Flag aria-hidden />}>
                Prioritară
              </StatusPill>
            </>
          }
          footer={
            <>
              <span className={cn('inline-flex items-center gap-1.5 font-semibold text-fg', kitText.secondary)}>
                <CalendarDays className="size-4" aria-hidden />
                Livrare azi
              </span>
              <StatusPill tone="info">Programată</StatusPill>
            </>
          }
          onOpen={() => undefined}
          openLabel="Deschide comanda Mariei Ionescu"
          action={{
            label: loading ? 'Se trimite…' : 'Pune în livrare',
            icon: <Truck aria-hidden />,
            loading,
            onClick: () => {
              setLoading(true)
              window.setTimeout(() => setLoading(false), 1500)
            },
          }}
        />
      </Stare>
      <Stare label="Fără buton (comandă livrată)">
        <ActionCard
          title="Ion Popescu"
          meta="Gura Humorului · livrată azi, 10:42"
          amount={formatLei(150)}
          pills={<ActionCardChip>5 kg</ActionCardChip>}
          footer={
            <>
              <span className={cn('font-medium text-fg-muted', kitText.secondary)}>Cash</span>
              <StatusPill tone="success">Livrată</StatusPill>
            </>
          }
        />
      </Stare>
    </>
  )
}

// ─── Exemple din mockup-uri ────────────────────────────────────────────────────

function CulegatoriExemplu() {
  const [ales, setAles] = useState<string | null>(null)

  return (
    <TileGroup type="single" aria-label="Cine a cules" value={ales} onValueChange={setAles}>
      {DEMO_CULEGATORI.map((c) => (
        <Tile
          key={c.id}
          value={c.id}
          leading={c.prenume.charAt(0)}
          title={c.prenume}
          subtitle={c.nume}
          badge={c.kgAzi ? `✓ azi ${formatKg(c.kgAzi)}` : undefined}
        />
      ))}
      <Tile title="Culegător nou" leading={<UserPlus />} dashed onClick={() => undefined} />
    </TileGroup>
  )
}

function PuneInLivrareExemplu() {
  const [bifate, setBifate] = useState<string[]>(() =>
    DEMO_COMENZI_AZI.filter((comanda) => comanda.prioritara).map((comanda) => comanda.id),
  )

  const kgBifate = DEMO_COMENZI_AZI.filter((comanda) => bifate.includes(comanda.id)).reduce(
    (sum, comanda) => sum + comanda.kg,
    0,
  )
  const ramas = DEMO_STOC_KG - kgBifate
  const prioritare = DEMO_COMENZI_AZI.filter((comanda) => comanda.prioritara)

  return (
    <div className="space-y-3">
      <Notice tone="warning" icon={<Flag />} title={`${prioritare.length} prioritare azi · ${formatKg(prioritare.reduce((s, c) => s + c.kg, 0))}`}>
        De livrat cu prioritate.
      </Notice>
      <ProgressBar
        tone={ramas <= 5 ? 'warning' : 'primary'}
        label="Rămas în stoc"
        valueLabel={`${formatKg(ramas)} din ${formatKg(DEMO_STOC_KG)}`}
        value={ramas}
        max={DEMO_STOC_KG}
      />
      <div className="space-y-2.5">
        {DEMO_COMENZI_AZI.map((comanda) => {
          const checked = bifate.includes(comanda.id)
          const lipsa = comanda.kg - ramas
          return (
            <CheckRow
              key={comanda.id}
              title={comanda.client}
              detail={comanda.localitate}
              trailing={formatKg(comanda.kg)}
              badge={
                comanda.prioritara ? (
                  <StatusPill tone="warning" icon={<Flag aria-hidden />}>
                    Prioritară
                  </StatusPill>
                ) : undefined
              }
              checked={checked}
              onCheckedChange={(next) =>
                setBifate((prev) => (next ? [...prev, comanda.id] : prev.filter((id) => id !== comanda.id)))
              }
              locked={!checked && lipsa > 0}
              lockedReason={`Nu ajunge stocul: lipsesc ${formatKg(lipsa)}`}
            />
          )
        })}
      </div>
      <Button variant="primary" size="touch-lg" className="w-full" disabled={bifate.length === 0}>
        <Truck aria-hidden />
        Trimite în Livrări ({bifate.length})
      </Button>
    </div>
  )
}

function UrmatoareaOprireExemplu() {
  return (
    <div className="space-y-3">
      <ProgressBar label="Traseul de azi" valueLabel="3 din 7 livrate" value={3} max={7} />
      <ActionCard
        emphasis="hero"
        leading="4"
        title="Cofetăria Aroma"
        meta="Suceava · str. Ștefan cel Mare 22"
        amount={formatLei(240)}
        amountLabel="de încasat"
        pills={<ActionCardChip>8 kg</ActionCardChip>}
        note="Sună înainte. Intrarea e prin curte."
        secondaryActions={[
          { label: 'Sună', icon: <Phone aria-hidden />, onClick: () => undefined },
          {
            label: 'Navighează',
            icon: <Navigation aria-hidden />,
            onClick: () => undefined,
            disabled: true,
            disabledReason: 'fără locație încă',
          },
        ]}
        action={{ label: 'Livrat', icon: <Check aria-hidden />, onClick: () => undefined }}
      />
    </div>
  )
}

function ExempleDemo() {
  const [prioritara, setPrioritara] = useState(true)

  return (
    <>
      <Stare label="Recoltări, pasul 1: plăcile de culegători">
        <CulegatoriExemplu />
      </Stare>
      <Stare label="Comenzi: „Pune în livrare azi”, cu stocul scăzut pe loc">
        <PuneInLivrareExemplu />
      </Stare>
      <Stare label="Comenzi, pasul 2: comandă prioritară">
        <ToggleRow
          tone="warning"
          icon={<Flag />}
          title="Prioritară"
          subtitle="Cere dată de livrare"
          checked={prioritara}
          onCheckedChange={setPrioritara}
        />
      </Stare>
      <Stare label="Livrări: următoarea oprire">
        <UrmatoareaOprireExemplu />
      </Stare>
    </>
  )
}

// ─── Secțiunile ────────────────────────────────────────────────────────────────

export function PrimitiveSections() {
  return (
    <>
      <KitSection
        id="butoane"
        title="Butoane"
        description="Același buton din ui/button, cu mărimile touch (48) și touch-lg (56) și variantele primary, neutral, danger, quiet."
      >
        <ButoaneDemo />
      </KitSection>
      <KitSection
        id="placi"
        title="Plăci (Tile)"
        description="Alegere unică sau multiplă. Fără valoare, placa e una de acțiune."
      >
        <PlaciDemo />
      </KitSection>
      <KitSection id="segmente" title="Segmente" description="Câte o opțiune activă; săgețile mută selecția.">
        <SegmenteDemo />
      </KitSection>
      <KitSection id="filtre" title="Filtre pastilă" description="Derulare orizontală sau pe rânduri, cu contor.">
        <FiltreDemo />
      </KitSection>
      <KitSection id="cifre" title="Cifre" description="StatTile în rând și StatHero pentru totalul paginii.">
        <CifreDemo />
      </KitSection>
      <KitSection id="status" title="Pastilă de status" description="Tonul spune rolul, nu numele statusului.">
        <StatusDemo />
      </KitSection>
      <KitSection id="gol" title="Stare goală">
        <GolDemo />
      </KitSection>
      <KitSection id="campuri" title="Câmp mare" description="56 px, text de 17 px (Safari nu mai mărește pagina la focus).">
        <CampuriDemo />
      </KitSection>
      <KitSection id="randuri" title="Rând de listă">
        <RanduriDemo />
      </KitSection>
      <KitSection id="comutator" title="Rând cu comutator" description="Tot rândul e ținta.">
        <ComutatorDemo />
      </KitSection>
      <KitSection id="bifa" title="Rând bifabil" description="Un rând blocat nu se poate bifa și spune de ce.">
        <BifaDemo />
      </KitSection>
      <KitSection id="benzi" title="Bandă de mesaj">
        <BenziDemo />
      </KitSection>
      <KitSection id="progres" title="Bară de progres">
        <ProgresDemo />
      </KitSection>
      <KitSection id="card" title="Card cu acțiune" description="Zone fixe și un singur buton principal.">
        <CardDemo />
      </KitSection>
      <KitSection
        id="exemple"
        title="Exemple din mockup-uri"
        description="Primitivele puse împreună, ca în Recoltări, Comenzi și Livrări."
      >
        <ExempleDemo />
      </KitSection>
    </>
  )
}
