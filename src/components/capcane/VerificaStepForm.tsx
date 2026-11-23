'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck, StickyNote } from 'lucide-react'

import {
  BigTextarea,
  Button,
  KgField,
  ListRow,
  Notice,
  NumericKeypad,
  StepForm,
  StepFormTitle,
  ToggleRow,
  kitText,
  useKeypadFields,
  useStepForm,
} from '@/components/kit'
import {
  ETICHETA_TIP_CAPCANA,
  capcaneText,
  capturiText,
  cheiePas,
  pasiVerificare,
  rezumatVerificare,
  textAlertaPrag,
  titluGrup,
  zileDeLaAtractant,
  type CapturaPas,
  type GrupCapcane,
  type PasVerificare,
  type PraguriCapcane,
  type RezumatGrup,
  type VerificareCapcana,
} from '@/lib/capcane'
import { queryKeys } from '@/lib/query-keys'
import { anuntaPestePrag, incarcaPozaCapcana, salveazaVerificare } from '@/lib/supabase/queries/capcane'
import { zileText } from '@/lib/tratamente/zile'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { IconitaTip } from './IconitaTip'
import { PozaRand, type PozaAleasa } from './PozaRand'

const FIELDS = ['n'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

type Vedere = null | 'nota' | 'renunta'
type Raspuns = { capturi: number | null; nota: string; poza: PozaAleasa }

export interface VerificaStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todayIso: string
  /** Grupurile de verificat (de obicei cele scadente azi). */
  grupuri: readonly GrupCapcane[]
  /** Verificările de dinainte (pentru totalul săptămânii). */
  verificari: readonly VerificareCapcana[]
  numeParcele: ReadonlyMap<string, string>
  praguri: PraguriCapcane
  inCoacere: (parcelaId: string, zi: string) => boolean
  /** „Fă un tratament pe Maravilla 1”: formularul de tratament cu parcela aleasă. */
  onTratament?: (parcelaId: string) => void
}

/**
 * „Verifică acum”: câte un pas pe capcană („Verificare · 2 din 6”): câte ai prins (tastatura mare, câmpul pornește
 * gol), „Am schimbat atractantul” când e scadent, poză și notă opțional. La final, rezumatul și, pentru grupurile peste
 * prag, „Fă un tratament pe …”. Salvarea trimite cheia formularului; alerta „Peste prag” o trimite serverul.
 */
export function VerificaStepForm({ open, onOpenChange, todayIso, grupuri, verificari, numeParcele, praguri, inCoacere, onTratament }: VerificaStepFormProps) {
  const queryClient = useQueryClient()
  const [pasi, setPasi] = useState<PasVerificare[]>([])
  const [grupuriSesiune, setGrupuriSesiune] = useState<GrupCapcane[]>([])
  const steps = useMemo(() => pasi.map((_, i) => `c${i}`), [pasi])
  const form = useStepForm({ steps: steps.length > 0 ? steps : ['c0'], open, analytics: { moduleName: 'capcane' } })
  const fields = useKeypadFields({ fields: FIELDS, maxIntegerDigits: 4, maxDecimals: 0 })

  const [raspunsuri, setRaspunsuri] = useState<Map<string, Raspuns>>(new Map())
  const [atractant, setAtractant] = useState<Map<string, boolean>>(new Map())
  const [vedere, setVedere] = useState<Vedere>(null)
  const [notaText, setNotaText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [rezumat, setRezumat] = useState<RezumatGrup[] | null>(null)
  const [pasIncarcat, setPasIncarcat] = useState<string | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    const lista = [...grupuri]
    setGrupuriSesiune(lista)
    setPasi(pasiVerificare(lista, todayIso))
    setRaspunsuri(new Map())
    setAtractant(new Map())
    setVedere(null)
    setNotaText('')
    setSaving(false)
    setSaveError(null)
    setRezumat(null)
    setPasIncarcat(null)
    fields.reset()
  }

  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const pas = pasi[form.index] ?? null
  const cheie = pas ? cheiePas(pas) : null
  // La schimbarea pasului: câmpul arată ce s-a scris deja la capcana aceea (sau pornește gol).
  if (cheie && pasIncarcat !== cheie) {
    setPasIncarcat(cheie)
    const existent = raspunsuri.get(cheie)
    if (existent?.capturi !== null && existent?.capturi !== undefined) fields.setValue('n', existent.capturi)
    else fields.clear('n')
  }

  const grupPeId = useMemo(() => new Map(grupuriSesiune.map((grup) => [grup.id, grup])), [grupuriSesiune])
  const grup = pas ? grupPeId.get(pas.grupId) ?? null : null
  const valoare = fields.numbers.n
  const raspunsCurent: Raspuns = (cheie && raspunsuri.get(cheie)) || { capturi: null, nota: '', poza: null }

  /** Răspunsurile, cu valoarea din câmp pentru pasul curent. */
  const raspunsuriCuCurent = useMemo(() => {
    const map = new Map(raspunsuri)
    if (cheie) map.set(cheie, { ...(map.get(cheie) ?? { nota: '', poza: null }), capturi: valoare })
    return map
  }, [cheie, raspunsuri, valoare])

  const capturiPentruCalcul = (map: ReadonlyMap<string, Raspuns>) => {
    const rezultat = new Map<string, CapturaPas>()
    for (const p of pasi) {
      const r = map.get(cheiePas(p))
      rezultat.set(cheiePas(p), { capturi: r?.capturi ?? null, atractantSchimbat: atractant.get(p.grupId) ?? false, nota: r?.nota ?? null, fotoPath: null })
    }
    return rezultat
  }

  const verificariAnterioare = useMemo(() => verificari.map((v) => ({ grup_id: v.grup_id, data: v.data, capturi: v.capturi })), [verificari])
  const rezumatLive = useMemo(
    () =>
      rezumatVerificare({
        grupuri: grupuriSesiune,
        pasi,
        raspunsuri: capturiPentruCalcul(raspunsuriCuCurent),
        verificariAnterioare,
        data: todayIso,
        praguri,
        inCoacere,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `capturiPentruCalcul` citește `pasi` și `atractant`
    [grupuriSesiune, pasi, raspunsuriCuCurent, atractant, verificariAnterioare, todayIso, praguri, inCoacere],
  )

  const nume = (parcelaId: string) => numeParcele.get(parcelaId) ?? 'Parcelă'

  const pastreazaCurent = () => {
    if (!cheie) return raspunsuriCuCurent
    setRaspunsuri(raspunsuriCuCurent)
    return raspunsuriCuCurent
  }

  const save = async () => {
    if (saving || valoare === null) return
    const toate = pastreazaCurent()
    const key = form.clientSyncId
    setSaving(true)
    setSaveError(null)
    try {
      // Pozele (opționale), una pe capcană; dacă nu se pot urca, verificarea se salvează fără ele.
      const capturi = capturiPentruCalcul(toate)
      let pozeNesalvate = 0
      for (const p of pasi) {
        const r = toate.get(cheiePas(p))
        if (!r?.poza) continue
        try {
          const path = await incarcaPozaCapcana(r.poza.blob, 'verificare', `${key}-${p.grupId.slice(0, 8)}-${p.nr}`)
          capturi.set(cheiePas(p), { ...capturi.get(cheiePas(p))!, fotoPath: path })
        } catch {
          pozeNesalvate += 1
        }
      }
      const final = rezumatVerificare({ grupuri: grupuriSesiune, pasi, raspunsuri: capturi, verificariAnterioare, data: todayIso, praguri, inCoacere })
      await salveazaVerificare({
        clientSyncId: key,
        data: todayIso,
        pasi,
        raspunsuri: capturi,
        pestePragPeGrup: new Map(final.map((r) => [r.grupId, r.pestePrag])),
      })
      const peste = final.filter((r) => r.pestePrag).map((r) => r.grupId)
      void anuntaPestePrag(peste, todayIso)
      void queryClient.invalidateQueries({ queryKey: queryKeys.capcane })
      hapticSuccess()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      setRezumat(final)
      if (pozeNesalvate > 0) setSaveError(pozeNesalvate === 1 ? 'O poză nu s-a putut salva.' : `${pozeNesalvate} poze nu s-au putut salva.`)
      form.markSuccess({ capcane: pasi.length, grupuri: grupuriSesiune.length, peste_prag: peste.length })
    } catch (error) {
      hapticError()
      if (liveKeyRef.current !== key) return
      setSaving(false)
      const message = error instanceof Error ? error.message : ''
      setSaveError(NETWORK_ERROR.test(message) ? 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: nu se dublează.' : message || 'Nu s-a salvat.')
      form.markFailed()
    }
  }

  const close = () => onOpenChange(false)
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (raspunsuri.size === 0 && valoare === null) return false
    setVedere('renunta')
    return true
  }
  const handleBack = () => {
    if (vedere) {
      setVedere(null)
      return true
    }
    pastreazaCurent()
    return false
  }

  const ultimul = form.index >= pasi.length - 1
  const rezumatGrupCurent = grup ? rezumatLive.find((r) => r.grupId === grup.id) : null
  const ultimulDinGrup = pas && grup ? pas.nr >= grup.nr_bucati : false

  let content: React.ReactNode = null
  let stepLabel: string | undefined = pasi.length > 0 ? `Verificare · ${form.index + 1} din ${pasi.length}` : 'Verificare'
  const showKeypad = vedere === null && Boolean(pas)

  if (pasi.length === 0) {
    content = (
      <Notice tone="info" title="Nicio capcană de verificat">
        Montează întâi capcane pe o parcelă.
      </Notice>
    )
  } else if (vedere === 'renunta') {
    stepLabel = 'Nesalvat'
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la verificare?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Capturile scrise nu au fost salvate.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setVedere(null)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'nota' && cheie) {
    stepLabel = 'Notă'
    content = (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          setRaspunsuri((prev) => new Map(prev).set(cheie, { ...raspunsCurent, capturi: valoare, nota: notaText.trim() }))
          setVedere(null)
        }}
      >
        <StepFormTitle>Notă la capcana {pas?.nr}</StepFormTitle>
        <BigTextarea label="Notă (opțional)" value={notaText} onChange={(event) => setNotaText(event.target.value)} maxLength={300} placeholder="ex. multe femele, capcana căzută" autoFocus />
        <Button type="submit" variant="primary" size="touch-lg" className="w-full">
          Gata
        </Button>
      </form>
    )
  } else if (pas && grup) {
    const zileAtractant = zileDeLaAtractant(grup, todayIso)
    const subtitlu =
      grup.tip === 'drosophila' && zileAtractant !== null
        ? `${ETICHETA_TIP_CAPCANA[grup.tip]} · atractant schimbat acum ${zileText(Math.max(0, zileAtractant))}`
        : ETICHETA_TIP_CAPCANA[grup.tip]
    content = (
      <div className="space-y-3">
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <div className="space-y-1">
          <StepFormTitle>
            {nume(grup.parcela_id)} · capcana {pas.nr}
          </StepFormTitle>
          <p className={cn('text-fg-muted', kitText.secondary)}>{subtitlu}</p>
        </div>
        <KgField label="Câte ai prins?" unit="insecte" value={fields.values.n} active onActivate={() => undefined} />
        {/* Sub câmp, nu la capătul pasului: tastatura din `dock` ar ascunde-o pe telefon. */}
        {rezumatGrupCurent?.pestePrag && (ultimulDinGrup || ultimul) ? (
          <Notice tone="warning" title={`Peste prag la ${nume(grup.parcela_id)}`}>
            {`Total ${rezumatGrupCurent.capturiSaptamana} în ${capcaneText(grup.nr_bucati)} săptămâna aceasta.${inCoacere(grup.parcela_id, todayIso) ? ' Fructele sunt în coacere.' : ''}`}
          </Notice>
        ) : null}
        {pas.atractantScadent ? (
          <ToggleRow
            title="Am schimbat atractantul"
            subtitle={`la toate cele ${grup.nr_bucati} din ${nume(grup.parcela_id)}`}
            checked={atractant.get(grup.id) ?? false}
            onCheckedChange={(checked) => setAtractant((prev) => new Map(prev).set(grup.id, checked))}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          {raspunsCurent.poza ? null : (
            <PozaRand
              poza={null}
              onChange={(poza) => setRaspunsuri((prev) => new Map(prev).set(cheie!, { ...raspunsCurent, capturi: valoare, poza }))}
              disabled={saving}
            />
          )}
          <Button
            type="button"
            variant="neutral"
            size="touch"
            className={cn('w-full', raspunsCurent.poza && 'col-span-2')}
            onClick={() => {
              setNotaText(raspunsCurent.nota)
              setVedere('nota')
            }}
          >
            <StickyNote aria-hidden />
            {raspunsCurent.nota ? 'Notă ✓' : 'Notă'}
          </Button>
        </div>
        {raspunsCurent.poza ? (
          <PozaRand
            poza={raspunsCurent.poza}
            onChange={(poza) => setRaspunsuri((prev) => new Map(prev).set(cheie!, { ...raspunsCurent, capturi: valoare, poza }))}
            disabled={saving}
          />
        ) : null}
      </div>
    )
  }

  const succes = rezumat ? (
    <div className="space-y-4 py-2" role="status">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-bg text-success-text [&_svg]:size-8" aria-hidden>
          <CircleCheck />
        </span>
        <StepFormTitle>Verificare salvată</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.secondary)}>{`${capcaneText(pasi.length)} · ${capturiText(rezumat.reduce((s, r) => s + r.capturiAzi, 0))} azi`}</p>
      </div>
      {saveError ? <Notice tone="warning" title={saveError} /> : null}
      <ul className="space-y-2" aria-label="Rezumatul verificării">
        {rezumat.map((r) => (
          <li key={r.grupId}>
            <ListRow
              avatar={false}
              leading={<IconitaTip tip={r.tip} ton={r.pestePrag ? 'warning' : 'primary'} />}
              title={titluGrup(nume(r.parcelaId), r.tip, r.nrBucati)}
              detail={`${capturiText(r.capturiAzi)} azi · ${capturiText(r.capturiSaptamana)} săptămâna aceasta${r.pestePrag ? ' · peste prag' : ''}`}
            />
          </li>
        ))}
      </ul>
      {rezumat
        .filter((r) => r.pestePrag)
        .map((r) => (
          <Notice
            key={r.grupId}
            tone="warning"
            title={`Peste prag la ${nume(r.parcelaId)}`}
            action={
              onTratament ? (
                <Button
                  type="button"
                  variant="neutral"
                  size="touch"
                  className="w-full"
                  onClick={() => {
                    close()
                    // Formularul de tratament se deschide după ce acesta s-a închis (nimic peste un formular pe pași).
                    window.setTimeout(() => onTratament(r.parcelaId), 220)
                  }}
                >
                  Fă un tratament pe {nume(r.parcelaId)}
                </Button>
              ) : undefined
            }
          >
            {textAlertaPrag({ tip: r.tip, parcela: nume(r.parcelaId), capturi: r.capturiSaptamana, nrBucati: r.nrBucati })}.
          </Notice>
        ))}
      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={close}>
        Gata
      </Button>
    </div>
  ) : undefined

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Verificare capcane"
      description="Câte insecte ai prins în fiecare capcană."
      stepLabel={stepLabel}
      onBack={handleBack}
      dock={showKeypad ? <NumericKeypad onKey={fields.press} disabled={saving} integerOnly aria-label="Tastatură pentru capturi" /> : undefined}
      footer={
        showKeypad
          ? {
              primary: ultimul
                ? { label: saving ? 'Se salvează…' : 'Salvează verificarea', onClick: () => void save(), loading: saving, disabled: valoare === null || saving }
                : {
                    label: 'Următoarea capcană',
                    onClick: () => {
                      pastreazaCurent()
                      form.next()
                    },
                    disabled: valoare === null,
                  },
            }
          : null
      }
      success={succes}
    >
      {content}
    </StepForm>
  )
}
