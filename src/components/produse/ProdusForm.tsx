'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'

import {
  BigInput,
  Button,
  FilterPills,
  Notice,
  StepForm,
  StepFormTitle,
  ToggleRow,
  kitText,
  useStepForm,
} from '@/components/kit'
import {
  CATEGORII_AFISATE,
  CIORNA_GOALA,
  ciornaDinProdus,
  ciornaSchimbata,
  ETICHETA_CATEGORIE,
  ETICHETA_UNITATE,
  eroriProdus,
  motivFaraStergere,
  payloadProdus,
  unitatiDeAles,
  type CiornaProdus,
  type UnitateProdus,
} from '@/lib/produse/produs'
import { queryKeys } from '@/lib/query-keys'
import { createProdus, deleteProdus, getUtilizareProdus, updateProdus, type CategorieProdus, type Produs } from '@/lib/supabase/queries/produse'
import { toast } from '@/lib/ui/toast'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

const STEPS = ['produs'] as const
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

function mesajEroare(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ''
  if (NETWORK_ERROR.test(message)) return 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”.'
  if (/row-level security|42501/i.test(message)) return 'Nu ai drept de scriere pe produse.'
  return message || 'Nu s-a salvat. Verifică internetul și încearcă din nou.'
}

type Vedere = 'formular' | 'sterge' | 'renunta'
type Stergere = { stare: 'verific' } | { stare: 'liber' } | { stare: 'folosit'; motiv: string } | { stare: 'eroare' }

export interface ProdusFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Produsul editat; fără el, produs nou. */
  produs: Produs | null
}

/**
 * Produs nou / editare pe kit: nume, „se vinde la”, gramaj, preț, categorie, „Activ”.
 * Pozele, linkul de magazin și câmpurile de asociație nu apar până la magazinul nou (datele rămân în bază).
 * Ștergerea cere confirmare; un produs folosit în comenzi sau vânzări se poate doar dezactiva.
 */
export function ProdusForm({ open, onOpenChange, produs }: ProdusFormProps) {
  const queryClient = useQueryClient()
  const editing = produs !== null
  const form = useStepForm({ steps: STEPS, open, mode: editing ? 'edit' : 'create', analytics: { moduleName: 'produse' } })

  const [ciorna, setCiorna] = useState<CiornaProdus>(CIORNA_GOALA)
  const [initiala, setInitiala] = useState<CiornaProdus>(CIORNA_GOALA)
  const [incercat, setIncercat] = useState(false)
  const [vedere, setVedere] = useState<Vedere>('formular')
  const [stergere, setStergere] = useState<Stergere>({ stare: 'verific' })
  const [saving, setSaving] = useState<'salvez' | 'sterg' | 'dezactivez' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    // Poate rula de două ori pentru aceeași deschidere: aceleași intrări, același rezultat.
    setSessionKey(form.clientSyncId)
    const start = produs ? ciornaDinProdus(produs) : CIORNA_GOALA
    setCiorna(start)
    setInitiala(start)
    setIncercat(false)
    setVedere('formular')
    setStergere({ stare: 'verific' })
    setSaving(null)
    setSaveError(null)
  }

  // `produse` nu are cheie de idempotență: un formular de produs nou se salvează o singură dată.
  const creat = useRef(new Set<string>())
  const inFlight = useRef(false)
  const erori = eroriProdus(ciorna)
  const areErori = Object.keys(erori).length > 0
  const dirty = ciornaSchimbata(ciorna, initiala)

  const invalideaza = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.produse })
    void queryClient.invalidateQueries({ queryKey: queryKeys.produseActiv })
  }

  const close = () => onOpenChange(false)

  const save = async () => {
    setIncercat(true)
    if (areErori || inFlight.current) return
    const key = form.clientSyncId
    if (!editing && creat.current.has(key)) return close()
    inFlight.current = true
    setSaving('salvez')
    setSaveError(null)
    try {
      const payload = payloadProdus(ciorna)
      if (produs) await updateProdus(produs.id, payload)
      else {
        await createProdus(payload)
        creat.current.add(key)
      }
      invalideaza()
      hapticSuccess()
      form.markSuccess()
      toast.success(editing ? 'Produs salvat.' : `${payload.nume} a fost adăugat.`)
      close()
    } catch (cause) {
      hapticError()
      setSaveError(mesajEroare(cause))
      form.markFailed()
    } finally {
      inFlight.current = false
      setSaving(null)
    }
  }

  const deschideStergerea = async () => {
    if (!produs) return
    setVedere('sterge')
    setStergere({ stare: 'verific' })
    try {
      const motiv = motivFaraStergere(await getUtilizareProdus(produs.id))
      setStergere(motiv ? { stare: 'folosit', motiv } : { stare: 'liber' })
    } catch {
      setStergere({ stare: 'eroare' })
    }
  }

  const sterge = async () => {
    if (!produs || inFlight.current) return
    inFlight.current = true
    setSaving('sterg')
    try {
      await deleteProdus(produs.id)
      invalideaza()
      hapticSuccess()
      toast.success('Produs șters.')
      close()
    } catch (cause) {
      hapticError()
      toast.error(mesajEroare(cause))
    } finally {
      inFlight.current = false
      setSaving(null)
    }
  }

  const dezactiveaza = async () => {
    if (!produs || inFlight.current) return
    inFlight.current = true
    setSaving('dezactivez')
    try {
      await updateProdus(produs.id, { status: 'inactiv' })
      invalideaza()
      hapticSuccess()
      toast.success('Produsul a fost dezactivat.')
      close()
    } catch (cause) {
      hapticError()
      toast.error(mesajEroare(cause))
    } finally {
      inFlight.current = false
      setSaving(null)
    }
  }

  const closeGuard = () => {
    if (saving) return true
    if (!dirty || vedere !== 'formular') return false
    setVedere('renunta')
    return true
  }

  const handleBack = () => {
    if (vedere !== 'formular') {
      setVedere('formular')
      return true
    }
    return false
  }

  const set = <K extends keyof CiornaProdus>(camp: K, valoare: CiornaProdus[K]) => setCiorna((prev) => ({ ...prev, [camp]: valoare }))

  let content: React.ReactNode
  if (vedere === 'renunta') {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>{editing ? 'Renunți la modificări?' : 'Renunți la produs?'}</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>{editing ? 'Produsul rămâne cum era.' : 'Ce ai scris nu a fost salvat.'}</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setVedere('formular')}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (vedere === 'sterge' && produs) {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Ștergi „{produs.nume}”?</StepFormTitle>
        {stergere.stare === 'verific' ? (
          <p className={cn('text-fg-muted', kitText.base)} aria-live="polite">
            Verific dacă produsul apare în comenzi sau vânzări…
          </p>
        ) : stergere.stare === 'eroare' ? (
          <Notice tone="danger" title="Nu am putut verifica produsul">
            Verifică internetul și încearcă din nou.
          </Notice>
        ) : stergere.stare === 'folosit' ? (
          <Notice tone="warning" title="Nu se poate șterge" className="text-left">
            {stergere.motiv}
          </Notice>
        ) : (
          <p className={cn('text-fg-muted', kitText.base)}>Nu apare în nicio comandă sau vânzare. Ștergerea nu se poate anula.</p>
        )}
        <div className="mt-3 flex flex-col gap-2.5">
          {stergere.stare === 'liber' ? (
            <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={saving === 'sterg'} onClick={() => void sterge()}>
              Șterge produsul
            </Button>
          ) : null}
          {stergere.stare === 'folosit' && produs.status === 'activ' ? (
            <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={saving === 'dezactivez'} onClick={() => void dezactiveaza()}>
              Dezactivează produsul
            </Button>
          ) : null}
          {stergere.stare === 'eroare' ? (
            <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => void deschideStergerea()}>
              Încearcă din nou
            </Button>
          ) : null}
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" disabled={saving !== null} onClick={() => setVedere('formular')}>
            Nu, renunț
          </Button>
        </div>
      </div>
    )
  } else {
    content = (
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <StepFormTitle>{editing ? 'Produs' : 'Produs nou'}</StepFormTitle>
        {saveError ? (
          <Notice tone="danger" title="Nu s-a salvat">
            {saveError}
          </Notice>
        ) : null}
        <BigInput
          label="Nume"
          value={ciorna.nume}
          onChange={(event) => set('nume', event.target.value)}
          autoComplete="off"
          maxLength={120}
          placeholder="ex. Gem de casă"
          error={incercat ? erori.nume : undefined}
        />
        <div className="space-y-2">
          <p className={cn('font-bold text-fg', kitText.secondary)} id="produs-unitate">
            Se vinde la
          </p>
          <FilterPills<UnitateProdus>
            aria-label="Se vinde la"
            wrap
            options={unitatiDeAles(produs?.unitate_vanzare).map((unitate) => ({ value: unitate, label: ETICHETA_UNITATE[unitate] }))}
            value={ciorna.unitate}
            onValueChange={(unitate) => set('unitate', unitate)}
          />
        </div>
        <div className={cn('grid gap-3', ciorna.unitate !== 'kg' ? 'grid-cols-2' : 'grid-cols-1')}>
          {ciorna.unitate !== 'kg' ? (
            <BigInput
              label="Gramaj"
              value={ciorna.gramaj}
              onChange={(event) => set('gramaj', event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="500"
              trailing={<span className={cn('font-bold text-fg-muted', kitText.base)}>g</span>}
              error={incercat ? erori.gramaj : undefined}
            />
          ) : null}
          <BigInput
            label={ciorna.unitate === 'kg' ? 'Preț pe kg' : 'Preț'}
            value={ciorna.pret}
            onChange={(event) => set('pret', event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="18"
            trailing={<span className={cn('font-bold text-fg-muted', kitText.base)}>lei</span>}
            error={incercat ? erori.pret : undefined}
          />
        </div>
        <div className="space-y-2">
          <p className={cn('font-bold text-fg', kitText.secondary)}>Categorie</p>
          <FilterPills<CategorieProdus>
            aria-label="Categorie"
            wrap
            options={CATEGORII_AFISATE.map((categorie) => ({ value: categorie, label: ETICHETA_CATEGORIE[categorie] }))}
            value={ciorna.categorie}
            onValueChange={(categorie) => set('categorie', categorie)}
          />
        </div>
        <ToggleRow title="Activ" subtitle="apare la comenzi și vânzări" checked={ciorna.activ} onCheckedChange={(activ) => set('activ', activ)} />
        {editing ? (
          <Button type="button" variant="quiet" size="touch" className="w-full text-danger-text" onClick={() => void deschideStergerea()}>
            <Trash2 aria-hidden />
            Șterge produsul
          </Button>
        ) : null}
        {/* Enter din tastatura telefonului salvează. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    )
  }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? `Editează: ${produs?.nume ?? 'produs'}` : 'Produs nou'}
      description="Numele, cum se vinde, prețul și categoria."
      stepLabel={vedere === 'renunta' ? 'Nesalvat' : vedere === 'sterge' ? 'Ștergere' : editing ? 'Editare' : 'Produs nou'}
      onBack={handleBack}
      footer={
        vedere === 'formular'
          ? {
              primary: {
                label: saving === 'salvez' ? 'Se salvează…' : 'Salvează',
                onClick: () => void save(),
                loading: saving === 'salvez',
                disabled: saving !== null || (incercat && areErori),
              },
            }
          : null
      }
    >
      {content}
    </StepForm>
  )
}
