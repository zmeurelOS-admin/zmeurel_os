'use client'

import { useState, type ReactNode } from 'react'
import { CalendarDays, Check, MapPin, Plus, UserPlus } from 'lucide-react'

import {
  BottomSheet,
  Button,
  CalendarPanel,
  CalendarSheet,
  KgField,
  NumberStepper,
  NumericKeypad,
  Segments,
  StatusPill,
  StepForm,
  StepFormFrame,
  StepFormTitle,
  SuccessScreen,
  SummaryList,
  SummaryRow,
  Tile,
  TileGroup,
  ToggleRow,
  formatDecimal,
  kitText,
  longDayRo,
  todayIso,
  useKeypadFields,
  useStepForm,
  type StepFormApi,
  type StepFormFooter,
} from '@/components/kit'
import { cn } from '@/lib/utils'

import { KitSection, Stare } from './KitShowcaseClient'
import { DEMO_CULEGATORI, formatKg, formatLei } from './kit-demo-data'

// ─── Foaie de jos ──────────────────────────────────────────────────────────────

type Plata = 'cash' | 'transfer' | 'neplatit'

function ConfirmaLivrareContent() {
  const [plata, setPlata] = useState<Plata>('cash')
  const [suma, setSuma] = useState<number | null>(240)
  const [locatie, setLocatie] = useState(true)

  return (
    <div className="space-y-4">
      <p className={cn('text-fg-muted', kitText.secondary)}>Cofetăria Aroma · 8 kg</p>
      <Segments<Plata>
        aria-label="Felul plății"
        value={plata}
        onValueChange={setPlata}
        options={[
          { value: 'cash', label: 'Cash' },
          { value: 'transfer', label: 'Transfer' },
          { value: 'neplatit', label: 'Nu a plătit' },
        ]}
      />
      {plata !== 'neplatit' ? (
        <div className="flex items-center justify-between gap-3">
          <span className={cn('font-bold text-fg', kitText.base)}>Suma încasată</span>
          <NumberStepper size="compact" label="Suma încasată" unit="lei" step={10} min={0} value={suma} onChange={setSuma} />
        </div>
      ) : null}
      <ToggleRow
        icon={<MapPin />}
        title="Salvează locația de aici"
        subtitle="Precizie GPS: 12 m"
        checked={locatie}
        onCheckedChange={setLocatie}
      />
    </div>
  )
}

/** Aspectul foii, desenat în cadru (foaia reală se deschide peste pagină, în portal). */
function SheetPreview({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-t-sheet border border-border-subtle bg-surface shadow-overlay">
      <div className="mx-auto mt-3 h-1.5 w-11 rounded-full bg-border-strong" aria-hidden />
      <p className={cn('px-4 pb-2 pt-4 font-extrabold text-fg', kitText.section)}>{title}</p>
      <div className="px-4 pb-4 pt-2">{children}</div>
      {footer ? <div className="border-t border-border-subtle px-4 pb-4 pt-3">{footer}</div> : null}
    </div>
  )
}

function FoaieDemo() {
  const [open, setOpen] = useState(false)
  const [lunga, setLunga] = useState(false)

  return (
    <>
      <Stare label="Aspect (desenat în cadru)">
        <SheetPreview
          title="Confirmă livrarea"
          footer={
            <Button variant="primary" size="touch-lg" className="w-full">
              <Check aria-hidden />
              Da, livrat
            </Button>
          }
        >
          <ConfirmaLivrareContent />
        </SheetPreview>
      </Stare>
      <Stare label="Foaia reală (peste pagină, urmează tema aplicației)">
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="neutral" size="touch" onClick={() => setOpen(true)}>
            Deschide
          </Button>
          <Button variant="neutral" size="touch" onClick={() => setLunga(true)}>
            Conținut lung
          </Button>
        </div>
      </Stare>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Confirmă livrarea"
        footer={
          <Button variant="primary" size="touch-lg" className="w-full" onClick={() => setOpen(false)}>
            <Check aria-hidden />
            Da, livrat
          </Button>
        }
      >
        <ConfirmaLivrareContent />
      </BottomSheet>

      <BottomSheet
        open={lunga}
        onOpenChange={setLunga}
        title="Opririle de azi"
        description="Conținutul se derulează; titlul și butonul rămân pe loc."
        footer={
          <Button variant="primary" size="touch-lg" className="w-full" onClick={() => setLunga(false)}>
            Gata
          </Button>
        }
      >
        <ol className="space-y-2">
          {Array.from({ length: 18 }, (_, index) => (
            <li key={index} className={cn('rounded-box bg-surface-muted px-4 py-3 font-semibold text-fg', kitText.base)}>
              Oprirea {index + 1}
            </li>
          ))}
        </ol>
      </BottomSheet>
    </>
  )
}

// ─── Calendar ──────────────────────────────────────────────────────────────────

function CalendarDemo() {
  const [today] = useState(todayIso)
  const [inline, setInline] = useState<string | null>(null)
  const [inSheet, setInSheet] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <>
      <Stare label="În pagină, cu scurtături; zilele trecute sunt inactive">
        <CalendarPanel value={inline} onChange={setInline} min={today} />
        <p className={cn('mt-3 font-semibold text-fg', kitText.secondary)}>
          {inline ? `Ales: ${longDayRo(inline)}` : 'Nimic ales încă'}
        </p>
      </Stare>
      <Stare label="În foaie (se închide la alegere)">
        <Button variant="neutral" size="touch" className="w-full" onClick={() => setOpen(true)}>
          <CalendarDays aria-hidden />
          {inSheet ? longDayRo(inSheet) : 'Alege data livrării'}
        </Button>
      </Stare>
      <CalendarSheet open={open} onOpenChange={setOpen} title="Când livrezi?" value={inSheet} onChange={setInSheet} min={today} />
    </>
  )
}

// ─── Număr cu pași ─────────────────────────────────────────────────────────────

function NumarDemo() {
  const [bucati, setBucati] = useState<number | null>(50)
  const [kg, setKg] = useState<number | null>(null)
  const [pret, setPret] = useState<number | null>(30)
  const [limitat, setLimitat] = useState<number | null>(1)

  return (
    <>
      <Stare label="Mare, cu pași rapizi (minimum 1)">
        <NumberStepper
          label="Bucăți"
          unit="bucăți"
          min={1}
          quickSteps={[-10, -5, 5, 10]}
          value={bucati}
          onChange={setBucati}
        />
      </Stare>
      <Stare label="Mare, cu zecimale, necompletat la pornire">
        <NumberStepper label="Cantitate" unit="kg" step={0.5} decimals={1} min={0} max={50} value={kg} onChange={setKg} />
      </Stare>
      <Stare label="Compact, în rând (pas 0,5)">
        <div className="flex items-center justify-between gap-3">
          <span className={cn('font-bold text-fg', kitText.base)}>Preț pe kg</span>
          <NumberStepper size="compact" label="Preț pe kg" unit="lei" step={0.5} decimals={2} min={0} value={pret} onChange={setPret} />
        </div>
      </Stare>
      <Stare label="La limită (1–3): butonul devine inactiv">
        <NumberStepper size="compact" label="Lădițe" min={1} max={3} value={limitat} onChange={setLimitat} />
      </Stare>
      <Stare label="Dezactivat">
        <NumberStepper size="compact" label="Cantitate fixă" unit="kg" value={12} onChange={() => undefined} disabled />
      </Stare>
    </>
  )
}

// ─── Tastatură numerică + câmp de kg ───────────────────────────────────────────

const TARIF_LEI_KG = 4

function TastaturaDemo() {
  const fields = useKeypadFields({ fields: ['cal1', 'cal2'] as const })
  const [cuCal2, setCuCal2] = useState(false)

  const total = (fields.numbers.cal1 ?? 0) + (cuCal2 ? (fields.numbers.cal2 ?? 0) : 0)

  return (
    <div className="space-y-3">
      <KgField
        label="Calitatea 1"
        value={fields.values.cal1}
        active={fields.active === 'cal1'}
        onActivate={() => fields.setActive('cal1')}
      />
      {cuCal2 ? (
        <KgField
          size="md"
          label="Calitatea 2"
          value={fields.values.cal2}
          active={fields.active === 'cal2'}
          onActivate={() => fields.setActive('cal2')}
        />
      ) : (
        <Button
          variant="quiet"
          size="touch"
          className="w-full"
          onClick={() => {
            setCuCal2(true)
            fields.setActive('cal2')
          }}
        >
          <Plus aria-hidden />
          Adaugă calitatea 2
        </Button>
      )}
      <div className="flex items-baseline justify-between">
        <span className={cn('text-fg-muted', kitText.secondary)}>Plată estimată ({TARIF_LEI_KG} lei/kg)</span>
        <span className={cn('font-extrabold text-fg', kitText.card)}>{formatLei(total * TARIF_LEI_KG)}</span>
      </div>
      <NumericKeypad onKey={fields.press} listenToKeyboard={false} />
      <div className="grid grid-cols-2 gap-2">
        {/* O valoare care există deja (editare, cantitate dictată) se pune cu `setValue`, nu se propune. */}
        <Button variant="neutral" size="touch" onClick={() => fields.setValue(fields.active, 27.35)}>
          Pune 27,35
        </Button>
        <Button
          variant="quiet"
          size="touch"
          onClick={() => {
            fields.reset()
            setCuCal2(false)
          }}
        >
          Golește
        </Button>
      </div>
    </div>
  )
}

// ─── Recapitulare ──────────────────────────────────────────────────────────────

function RecapitulareDemo() {
  return (
    <>
      <Stare label="Cu „Schimbă” (tot rândul e apăsabil)">
        <SummaryList>
          <SummaryRow label="Client" value="Maria Ionescu" onChange={() => undefined} />
          <SummaryRow label="Cantitate" value="9 kg" amount={formatLei(270)} onChange={() => undefined} />
          <SummaryRow label="Livrare" value="Mâine, vineri" onChange={() => undefined} />
        </SummaryList>
      </Stare>
      <Stare label="Fără „Schimbă”">
        <SummaryList>
          <SummaryRow label="Preț" value="30 lei/kg" />
          <SummaryRow label="Total" value="9 kg" amount={formatLei(270)} />
        </SummaryList>
      </Stare>
    </>
  )
}

// ─── Reușită ───────────────────────────────────────────────────────────────────

function ReusitaDemo() {
  return (
    <>
      <Stare label="Două butoane">
        <SuccessScreen
          className="min-h-0 py-4"
          title="Comanda e salvată"
          description="Maria Ionescu · 9 kg · 270 lei"
          primaryAction={{ label: 'Comandă nouă', onClick: () => undefined }}
          secondaryAction={{ label: 'Închide', onClick: () => undefined }}
        />
      </Stare>
      <Stare label="Un buton">
        <SuccessScreen
          className="min-h-0 py-4"
          title="Livrat"
          description="Cofetăria Aroma · 240 lei, cash"
          primaryAction={{ label: 'Următoarea oprire', onClick: () => undefined }}
        />
      </Stare>
    </>
  )
}

// ─── Formular pe pași ──────────────────────────────────────────────────────────

const FORM_STEPS = ['culegator', 'kg', 'verificare'] as const

/** Starea și conținutul formularului demonstrativ. Aceleași pentru varianta din cadru și pentru fereastră. */
function useFormularDemo(form: StepFormApi, onClose: () => void) {
  const fields = useKeypadFields({ fields: ['cal1', 'cal2'] as const })
  const [culegator, setCulegator] = useState<string | null>(null)
  const [cuCal2, setCuCal2] = useState(false)
  const [saving, setSaving] = useState(false)

  // O cheie de idempotență nouă înseamnă o înregistrare nouă: câmpurile pornesc goale.
  const [stateFor, setStateFor] = useState(form.clientSyncId)
  if (stateFor !== form.clientSyncId) {
    setStateFor(form.clientSyncId)
    setCulegator(null)
    setCuCal2(false)
    setSaving(false)
    fields.reset()
  }

  const ales = DEMO_CULEGATORI.find((c) => c.id === culegator)
  const cal1 = fields.numbers.cal1 ?? 0
  const cal2 = cuCal2 ? (fields.numbers.cal2 ?? 0) : 0
  const total = cal1 + cal2
  const plata = total * TARIF_LEI_KG

  const save = (thenRestart: boolean) => {
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      form.markSuccess()
      if (thenRestart) form.restart()
    }, 900)
  }

  let content: ReactNode = null
  let footer: StepFormFooter | null = null
  let dock: ReactNode = null

  if (form.stepKey === 'culegator') {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Cine a cules?</StepFormTitle>
        <TileGroup
          type="single"
          aria-label="Cine a cules"
          value={culegator}
          onValueChange={(value) => {
            setCulegator(value)
            form.next()
          }}
        >
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
      </div>
    )
  } else if (form.stepKey === 'kg') {
    content = (
      <div className="space-y-3">
        <StepFormTitle eyebrow={ales ? `${ales.prenume} ${ales.nume}` : undefined}>Câte kilograme?</StepFormTitle>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="neutral" icon={<CalendarDays aria-hidden />}>
            Azi
          </StatusPill>
          <StatusPill tone="neutral">Parcela Maravilla 1</StatusPill>
        </div>
        <KgField
          label="Calitatea 1"
          value={fields.values.cal1}
          active={fields.active === 'cal1'}
          onActivate={() => fields.setActive('cal1')}
        />
        {cuCal2 ? (
          <KgField
            size="md"
            label="Calitatea 2"
            value={fields.values.cal2}
            active={fields.active === 'cal2'}
            onActivate={() => fields.setActive('cal2')}
          />
        ) : (
          <Button
            variant="quiet"
            size="touch"
            className="w-full"
            onClick={() => {
              setCuCal2(true)
              fields.setActive('cal2')
            }}
          >
            <Plus aria-hidden />
            Adaugă calitatea 2
          </Button>
        )}
        <div className="flex items-baseline justify-between">
          <span className={cn('text-fg-muted', kitText.secondary)}>Plată estimată</span>
          <span className={cn('font-extrabold text-fg', kitText.card)}>{formatLei(plata)}</span>
        </div>
      </div>
    )
    dock = <NumericKeypad onKey={fields.press} listenToKeyboard={false} />
    footer = { primary: { label: 'Continuă', onClick: form.next, disabled: total <= 0 } }
  } else {
    content = (
      <div className="space-y-4">
        <StepFormTitle>Verifică și salvează</StepFormTitle>
        <SummaryList>
          <SummaryRow
            label="Culegător"
            value={ales ? `${ales.prenume} ${ales.nume}` : '—'}
            onChange={() => form.editFromSummary('culegator')}
          />
          <SummaryRow
            label="Kilograme"
            value={cuCal2 ? `${formatKg(cal1)} + ${formatKg(cal2)} (cal. 2)` : formatKg(cal1)}
            onChange={() => form.editFromSummary('kg')}
          />
          <SummaryRow label="Plată estimată" value={`${formatDecimal(total)} kg × ${TARIF_LEI_KG} lei`} amount={formatLei(plata)} />
        </SummaryList>
        <p className={cn('break-all text-fg-muted', kitText.helper)}>
          Cheia de idempotență a acestei înregistrări: {form.clientSyncId}
        </p>
      </div>
    )
    footer = {
      primary: { label: saving ? 'Se salvează…' : 'Salvează', loading: saving, onClick: () => save(false) },
      secondary: { label: 'Salvează + următorul', disabled: saving, onClick: () => save(true) },
    }
  }

  const success = (
    <SuccessScreen
      title="Salvat"
      description={ales ? `${ales.prenume} ${ales.nume} · ${formatKg(total)} · ${formatLei(plata)}` : undefined}
      primaryAction={{ label: 'Încă o cântărire', onClick: form.restart }}
      secondaryAction={{ label: 'Închide', onClick: onClose }}
    />
  )

  return { content, footer, dock, success, total }
}

function FormularInCadru() {
  const [open, setOpen] = useState(true)
  const form = useStepForm({ steps: FORM_STEPS, summaryKey: 'verificare', open, analytics: false })
  const demo = useFormularDemo(form, () => setOpen(false))

  if (!open) {
    return (
      <Button variant="neutral" size="touch" className="w-full" onClick={() => setOpen(true)}>
        Redeschide formularul din cadru
      </Button>
    )
  }

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-box border border-border">
      <StepFormFrame
        form={form}
        onClose={() => setOpen(false)}
        footer={demo.footer}
        dock={demo.dock}
        success={demo.success}
      >
        {demo.content}
      </StepFormFrame>
    </div>
  )
}

function FormularInFereastra() {
  const [open, setOpen] = useState(false)
  const form = useStepForm({ steps: FORM_STEPS, summaryKey: 'verificare', open, analytics: false })
  const demo = useFormularDemo(form, () => setOpen(false))

  // Garda de închidere: cu kilograme tastate și nesalvate, X / Esc / „înapoi” cer întâi confirmare.
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [confirmFor, setConfirmFor] = useState(form.clientSyncId)
  if (confirmFor !== form.clientSyncId) {
    setConfirmFor(form.clientSyncId)
    setConfirmingClose(false)
  }
  const closeGuard = () => {
    if (form.done || demo.total <= 0) return false
    setConfirmingClose(true)
    return true
  }

  return (
    <>
      <Button variant="primary" size="touch-lg" className="w-full" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Adaugă kg
      </Button>
      <StepForm
        form={form}
        open={open}
        onOpenChange={setOpen}
        closeGuard={closeGuard}
        title="Adaugă kilograme"
        stepLabel={confirmingClose ? 'Nesalvat' : undefined}
        onBack={() => {
          if (!confirmingClose) return false
          setConfirmingClose(false)
          return true
        }}
        footer={confirmingClose ? null : demo.footer}
        dock={confirmingClose ? undefined : demo.dock}
        success={demo.success}
      >
        {confirmingClose ? (
          <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
            <StepFormTitle>Renunți la {formatKg(demo.total)}?</StepFormTitle>
            <p className={cn('text-fg-muted', kitText.base)}>Kilogramele tastate nu au fost salvate.</p>
            <div className="mt-3 flex flex-col gap-2.5">
              <Button variant="primary" size="touch-lg" className="w-full" onClick={() => setConfirmingClose(false)}>
                Continuă
              </Button>
              <Button variant="neutral" size="touch-lg" className="w-full" onClick={() => setOpen(false)}>
                Renunță
              </Button>
            </div>
          </div>
        ) : (
          demo.content
        )}
      </StepForm>
    </>
  )
}

function FormularDemo() {
  return (
    <>
      <Stare label="Carcasa, în cadru (funcțională: alege, tastează, salvează)">
        <FormularInCadru />
      </Stare>
      <Stare label="Fereastra reală: ecran plin pe telefon, urmează tema aplicației">
        <FormularInFereastra />
      </Stare>
    </>
  )
}

// ─── Secțiunile ────────────────────────────────────────────────────────────────

export function CompuseSections() {
  return (
    <>
      <KitSection
        id="foaie"
        title="Foaie de jos"
        description="Se deschide peste bara de jos, ascunde butonul plutitor și se închide la „înapoi” pe Android."
      >
        <FoaieDemo />
      </KitSection>
      <KitSection id="calendar" title="Calendar" description="În pagină sau în foaie; scurtături Azi / Mâine / Poimâine, limite.">
        <CalendarDemo />
      </KitSection>
      <KitSection id="numar" title="Număr cu pași" description="Mare (ecran dedicat) și compact (în rând). Se poate și tasta.">
        <NumarDemo />
      </KitSection>
      <KitSection
        id="tastatura"
        title="Tastatură numerică și câmp de kg"
        description="Câmpul pornește gol. Tastatura scrie în câmpul activ: o virgulă, cel mult două zecimale."
      >
        <TastaturaDemo />
      </KitSection>
      <KitSection id="recapitulare" title="Rând de recapitulare">
        <RecapitulareDemo />
      </KitSection>
      <KitSection id="reusita" title="Ecran de reușită">
        <ReusitaDemo />
      </KitSection>
      <KitSection
        id="formular"
        title="Formular pe pași"
        description="Exemplu: culegător → kilograme → verificare. Nu trimite analytics și nu salvează nimic. În fereastră, închiderea cu kilograme tastate cere confirmare (closeGuard)."
      >
        <FormularDemo />
      </KitSection>
    </>
  )
}
