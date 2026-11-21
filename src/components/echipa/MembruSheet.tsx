'use client'

import { useState } from 'react'
import { Link2, ShieldCheck, UserX } from 'lucide-react'

import { BottomSheet, Button, Notice, SummaryList, SummaryRow, kitText } from '@/components/kit'
import { DrepturiEditor } from '@/components/echipa/DrepturiEditor'
import { LinkInvitatie } from '@/components/echipa/LinkInvitatie'
import { dezactiveaza, retrimiteLink, salveazaAcces, type MembruEchipa } from '@/lib/echipa/api'
import { accesDinCiorna, areVreunModul, cePoateFace, ciornaDinAcces, ROL_ETICHETA, type CiornaDrepturi } from '@/lib/echipa/drepturi'
import { toStoredFarmMemberAccess } from '@/lib/farm-members/access'
import { formatPhoneDisplay } from '@/lib/utils/phone'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

type Mod = 'actiuni' | 'acces' | 'link' | 'dezactivare'

function dataRo(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' }).format(data)
}

export interface MembruSheetProps {
  membru: MembruEchipa | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accesul salvat (rândul se actualizează pe loc). */
  onAccessSaved: (id: string, modulesAccess: unknown) => void
  onDeactivated: (id: string) => void
}

/** Foaia unui om din echipă: schimbă accesul, retrimite linkul (livrator, operator din link), dezactivează. */
export function MembruSheet({ membru, open, onOpenChange, onAccessSaved, onDeactivated }: MembruSheetProps) {
  const [mod, setMod] = useState<Mod>('actiuni')
  const [ciorna, setCiorna] = useState<CiornaDrepturi | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [sesiuniInchise, setSesiuniInchise] = useState(false)
  const [busy, setBusy] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  // Foaia redeschisă (sau alt om) pornește din lista de acțiuni.
  const [cheie, setCheie] = useState<string | null>(null)
  const cheieNoua = open && membru ? membru.id : null
  if (cheie !== cheieNoua) {
    setCheie(cheieNoua)
    setMod('actiuni')
    setCiorna(null)
    setLink(null)
    setSesiuniInchise(false)
    setBusy(false)
    setEroare(null)
  }

  if (!membru) return null
  const esteOperator = membru.role === 'operator'
  // Operatorul din link primește link nou; cel cu Google sau parolă intră singur din pagina de logare.
  const operatorDinLink = esteOperator && membru.account_kind === 'link'
  const intrareOperator =
    membru.account_kind === 'google'
      ? 'Intră cu Google din pagina de logare.'
      : membru.account_kind === 'parola'
        ? 'Intră cu emailul și parola din pagina de logare.'
        : null

  const run = async (actiune: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setEroare(null)
    try {
      await actiune()
    } catch (cause) {
      setEroare(cause instanceof Error && cause.message ? cause.message : 'Nu s-a putut. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  const salveaza = () =>
    run(async () => {
      if (!ciorna || !areVreunModul(ciorna)) return
      const modules = await salveazaAcces(membru.id, accesDinCiorna(ciorna))
      onAccessSaved(membru.id, toStoredFarmMemberAccess(modules))
      toast.success('Accesul s-a salvat.')
      setMod('actiuni')
    })

  const linkNou = () =>
    run(async () => {
      const rezultat = await retrimiteLink(membru.id)
      setLink(rezultat.link)
      setSesiuniInchise(rezultat.sesiuniInchise)
      setMod('link')
    })

  const confirmaDezactivarea = () =>
    run(async () => {
      await dezactiveaza(membru.id)
      toast.success(`${membru.name} a fost dezactivat.`)
      onDeactivated(membru.id)
      onOpenChange(false)
    })

  const notice = eroare ? (
    <Notice tone="danger" title="Nu s-a salvat">
      {eroare}
    </Notice>
  ) : null

  let titlu = membru.name
  let body
  let footer

  if (mod === 'acces' && ciorna) {
    titlu = `Accesul lui ${membru.name}`
    body = (
      <div className="space-y-3">
        {notice}
        <DrepturiEditor value={ciorna} onChange={setCiorna} disabled={busy} />
      </div>
    )
    footer = (
      <div className="flex flex-col gap-2.5">
        <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={busy} disabled={!areVreunModul(ciorna)} onClick={() => void salveaza()}>
          {areVreunModul(ciorna) ? 'Salvează accesul' : 'Alege cel puțin un modul'}
        </Button>
        <Button type="button" variant="quiet" size="touch" className="w-full" disabled={busy} onClick={() => setMod('actiuni')}>
          Înapoi
        </Button>
      </div>
    )
  } else if (mod === 'link' && link) {
    titlu = 'Link nou'
    body = (
      <div className="space-y-3">
        <p className={cn('text-fg-muted', kitText.secondary)}>
          {esteOperator
            ? `Linkul vechi nu mai merge${sesiuniInchise ? ', iar telefonul vechi a ieșit din cont' : ''}. Trimite-i lui ${membru.name} pe acesta: intră în același cont, cu tot ce a notat.`
            : `Linkul vechi nu mai merge. Trimite-i lui ${membru.name} pe acesta.`}
        </p>
        <LinkInvitatie rol={membru.role} nume={membru.name} telefon={membru.phone} link={link} />
      </div>
    )
    footer = (
      <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => onOpenChange(false)}>
        Gata
      </Button>
    )
  } else if (mod === 'dezactivare') {
    titlu = `Dezactivezi pe ${membru.name}?`
    body = (
      <div className="space-y-3">
        {notice}
        <p className={cn('text-fg', kitText.base)}>
          {esteOperator
            ? 'Nu mai poate intra în ferma ta. Ce a notat până acum rămâne.'
            : 'Linkul lui nu mai merge. Livrările făcute până acum rămân.'}
        </p>
      </div>
    )
    footer = (
      <div className="flex flex-col gap-2.5">
        <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={busy} onClick={() => void confirmaDezactivarea()}>
          Da, dezactivează
        </Button>
        <Button type="button" variant="neutral" size="touch" className="w-full" disabled={busy} onClick={() => setMod('actiuni')}>
          Nu, renunț
        </Button>
      </div>
    )
  } else {
    body = (
      <div className="space-y-3">
        {notice}
        <SummaryList>
          <SummaryRow label="Rol" value={ROL_ETICHETA[membru.role]} />
          <SummaryRow label="Poate" value={cePoateFace(membru.role, membru.modules_access)} />
          <SummaryRow label="Telefon" value={membru.phone?.trim() ? formatPhoneDisplay(membru.phone) : '—'} />
          <SummaryRow label="Adăugat" value={dataRo(membru.created_at)} />
          {esteOperator && membru.account_kind ? (
            <SummaryRow label="Intră" value={operatorDinLink ? 'Din link, fără parolă' : membru.account_kind === 'google' ? 'Cu Google' : 'Cu email și parolă'} />
          ) : null}
        </SummaryList>
        {intrareOperator ? <p className={cn('text-fg-muted', kitText.secondary)}>{intrareOperator}</p> : null}
      </div>
    )
    footer = (
      <div className="flex flex-col gap-2.5">
        {esteOperator ? (
          <Button
            type="button"
            variant="primary"
            size="touch-lg"
            className="w-full"
            onClick={() => {
              setCiorna(ciornaDinAcces(membru.modules_access))
              setEroare(null)
              setMod('acces')
            }}
          >
            <ShieldCheck aria-hidden />
            Schimbă accesul
          </Button>
        ) : null}
        {operatorDinLink ? (
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" loading={busy} onClick={() => void linkNou()}>
            <Link2 aria-hidden />
            Retrimite linkul
          </Button>
        ) : null}
        {esteOperator ? null : (
          <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={busy} onClick={() => void linkNou()}>
            <Link2 aria-hidden />
            Retrimite linkul
          </Button>
        )}
        <Button
          type="button"
          variant="quiet"
          size="touch"
          className="w-full text-danger-text"
          disabled={busy}
          onClick={() => {
            setEroare(null)
            setMod('dezactivare')
          }}
        >
          <UserX aria-hidden />
          Dezactivează
        </Button>
      </div>
    )
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={titlu} footer={footer}>
      {body}
    </BottomSheet>
  )
}
