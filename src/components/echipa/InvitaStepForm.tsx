'use client'

import { useRef, useState } from 'react'
import { Truck, UserRound } from 'lucide-react'

import {
  BigInput,
  Button,
  Notice,
  StepForm,
  StepFormTitle,
  Tile,
  TileGroup,
  kitText,
  useStepForm,
} from '@/components/kit'
import { DrepturiEditor } from '@/components/echipa/DrepturiEditor'
import { LinkInvitatie } from '@/components/echipa/LinkInvitatie'
import { invitaLivrator, invitaOperator } from '@/lib/echipa/api'
import { accesDinCiorna, areVreunModul, ciornaGoala, type CiornaDrepturi } from '@/lib/echipa/drepturi'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

type Rol = 'operator' | 'livrator'

interface Draft {
  rol: Rol | null
  nume: string
  telefon: string
  drepturi: CiornaDrepturi
}

function draftGol(): Draft {
  return { rol: null, nume: '', telefon: '', drepturi: ciornaGoala() }
}

const PASI_OPERATOR = ['cine', 'drepturi'] as const
const PASI_LIVRATOR = ['cine'] as const

export interface InvitaStepFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** După ce linkul s-a generat (lista echipei se reîncarcă). */
  onInvited?: (rol: Rol) => void
}

/**
 * „Invită pe cineva” în 2 pași: (1) cine e — operator sau livrator, nume, telefon;
 * (2) doar pentru operator, ce poate face pe fiecare modul (totul pe „Nu” la pornire).
 * La final, linkul cu „Trimite pe WhatsApp” și „Copiază linkul”.
 */
export function InvitaStepForm({ open, onOpenChange, onInvited }: InvitaStepFormProps) {
  const [draft, setDraft] = useState<Draft>(draftGol)
  const steps = draft.rol === 'livrator' ? PASI_LIVRATOR : PASI_OPERATOR
  const form = useStepForm({ steps, open, analytics: { moduleName: 'echipa' } })

  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const inFlight = useRef(false)

  // Fiecare deschidere pornește de la zero (resetul dă același rezultat dacă rulează de două ori).
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  if (!open && sessionKey !== null) setSessionKey(null)
  if (open && sessionKey !== form.clientSyncId) {
    setSessionKey(form.clientSyncId)
    setDraft(draftGol())
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setLink(null)
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }))

  const numeCurat = draft.nume.trim().replace(/\s+/g, ' ')
  const pasCineGata = draft.rol !== null && numeCurat.length >= 2
  const dirty = draft.rol !== null || draft.nume.trim() !== '' || draft.telefon.trim() !== '' || areVreunModul(draft.drepturi)

  const genereaza = async () => {
    if (inFlight.current || !draft.rol || !pasCineGata) return
    if (draft.rol === 'operator' && !areVreunModul(draft.drepturi)) return
    inFlight.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const rezultat =
        draft.rol === 'operator'
          ? await invitaOperator(accesDinCiorna(draft.drepturi))
          : await invitaLivrator({ name: numeCurat, phone: draft.telefon.trim() })
      hapticSuccess()
      setLink(rezultat.link)
      form.markSuccess({ rol: draft.rol })
      onInvited?.(draft.rol)
    } catch (cause) {
      hapticError()
      setSaveError(cause instanceof Error && cause.message ? cause.message : 'Nu am putut genera linkul.')
      form.markFailed({ rol: draft.rol })
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const close = () => onOpenChange(false)

  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setConfirmingClose(true)
    return true
  }

  const eroare = saveError ? (
    <Notice tone="danger" title="Linkul nu s-a generat">
      {saveError}
    </Notice>
  ) : null

  let content
  if (confirmingClose) {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>Renunți la invitație?</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>Nu s-a generat niciun link.</p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setConfirmingClose(false)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (form.stepKey === 'drepturi') {
    content = (
      <div className="space-y-4">
        <StepFormTitle eyebrow={`${numeCurat} · operator`}>Ce poate face?</StepFormTitle>
        <p className={cn('-mt-2 text-fg-muted', kitText.secondary)}>Pornești cu tot oprit; aprinzi doar ce face omul.</p>
        {eroare}
        <DrepturiEditor value={draft.drepturi} onChange={(drepturi) => set('drepturi', drepturi)} disabled={saving} />
      </div>
    )
  } else {
    content = (
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (!pasCineGata) return
          if (draft.rol === 'operator') form.next()
          else void genereaza()
        }}
      >
        <StepFormTitle>Cine e?</StepFormTitle>
        {eroare}
        <TileGroup
          type="single"
          columns={2}
          value={draft.rol}
          onValueChange={(value) => set('rol', (value as Rol | null) ?? draft.rol)}
          aria-label="Rolul"
        >
          <Tile value="operator" leading={<UserRound />} title="Operator" subtitle="Își face cont; vede doar ce-i dai" />
          <Tile value="livrator" leading={<Truck />} title="Livrator" subtitle="Fără cont; doar Livrări" />
        </TileGroup>
        <BigInput
          label="Nume"
          value={draft.nume}
          onChange={(event) => set('nume', event.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={80}
          placeholder="ex. Ana Pavel"
          error={draft.nume.trim() !== '' && numeCurat.length < 2 ? 'Numele trebuie să aibă minimum 2 litere.' : undefined}
        />
        <BigInput
          label="Telefon (opțional)"
          type="tel"
          inputMode="tel"
          value={draft.telefon}
          onChange={(event) => set('telefon', event.target.value)}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="07xx xxx xxx"
          hint="Cu telefonul, WhatsApp deschide direct conversația cu omul."
        />
        {draft.rol === 'livrator' ? (
          <p className={cn('text-fg-muted', kitText.helper)}>Livratorul primește un link pe telefon; vede doar Livrări.</p>
        ) : null}
      </form>
    )
  }

  const footer = confirmingClose
    ? null
    : form.stepKey === 'drepturi'
      ? {
          primary: {
            label: areVreunModul(draft.drepturi) ? 'Generează linkul' : 'Alege cel puțin un modul',
            onClick: () => void genereaza(),
            disabled: !areVreunModul(draft.drepturi),
            loading: saving,
          },
        }
      : {
          primary: {
            label: draft.rol === 'livrator' ? 'Generează linkul' : 'Mai departe',
            onClick: () => (draft.rol === 'livrator' ? void genereaza() : form.next()),
            disabled: !pasCineGata,
            loading: saving,
          },
        }

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title="Invită pe cineva"
      description="Cine e, apoi ce poate face. La final primești linkul."
      stepLabel={confirmingClose ? 'Nesalvat' : form.count > 1 ? form.label : 'Invită'}
      onBack={() => {
        if (!confirmingClose) return false
        setConfirmingClose(false)
        return true
      }}
      footer={footer}
      success={
        link && draft.rol ? (
          <div role="status" className="flex min-h-full flex-col justify-center gap-4 py-6">
            <div className="space-y-1 text-center">
              <h2 className={cn('font-extrabold text-fg', kitText.screen)}>Linkul e gata</h2>
              <p className={cn('text-fg-muted', kitText.base)}>
                Pentru {numeCurat} · {draft.rol === 'operator' ? 'operator' : 'livrator'}
              </p>
            </div>
            <LinkInvitatie rol={draft.rol} nume={numeCurat} telefon={draft.telefon} link={link} />
            <p className={cn('text-center text-fg-muted', kitText.helper)}>
              {draft.rol === 'operator'
                ? 'Linkul e valabil 7 zile. Omul își face cont și intră direct în ferma ta.'
                : 'Livratorul deschide linkul pe telefon; nu are nevoie de cont.'}
            </p>
            <Button type="button" variant="quiet" size="touch" className="w-full" onClick={close}>
              Gata
            </Button>
          </div>
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
