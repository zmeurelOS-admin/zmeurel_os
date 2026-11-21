'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { InvitaStepForm } from '@/components/echipa/InvitaStepForm'
import { MembruSheet } from '@/components/echipa/MembruSheet'
import { Button, ListRow, Notice, kitText } from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { incarcaEchipa, type MembruEchipa } from '@/lib/echipa/api'
import { initialeNume, numeProprietar, randMembru } from '@/lib/echipa/drepturi'
import { cn } from '@/lib/utils'

const AVATAR_TON: Record<'proprietar' | 'operator' | 'livrator', string> = {
  proprietar: 'bg-primary-soft text-primary',
  operator: 'bg-info-bg text-info-text',
  livrator: 'bg-neutral-bg text-neutral-text',
}

function Avatar({ text, ton }: { text: string; ton: keyof typeof AVATAR_TON }) {
  return (
    <span
      aria-hidden
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-control font-extrabold', kitText.secondary, AVATAR_TON[ton])}
    >
      {text}
    </span>
  )
}

/** Operatorii, apoi livratorii; fiecare grup în ordinea în care au intrat. */
function ordoneaza(membri: MembruEchipa[]): MembruEchipa[] {
  return [...membri].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'operator' ? -1 : 1
    return a.created_at.localeCompare(b.created_at)
  })
}

/**
 * Echipa (Setări → Echipa), pe kit: proprietarul, operatorii, livratorii, fiecare cu ce poate face.
 * Atingi un om → foaie (acces, link nou, dezactivare). „Invită pe cineva” → formular în 2 pași.
 */
export function EchipaClient() {
  const { email } = useDashboardAuth()
  const [membri, setMembri] = useState<MembruEchipa[]>([])
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState<string | null>(null)
  const [deschisId, setDeschisId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [invitaOpen, setInvitaOpen] = useState(false)

  const incarca = useCallback(async () => {
    setEroare(null)
    try {
      setMembri(await incarcaEchipa())
    } catch (cause) {
      setEroare(cause instanceof Error ? cause.message : 'Nu am putut încărca echipa.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Prima încărcare a listei, după montare.
    void incarca()
  }, [incarca])

  const lista = useMemo(() => ordoneaza(membri), [membri])
  const deschis = useMemo(() => membri.find((membru) => membru.id === deschisId) ?? null, [membri, deschisId])

  const invitaButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setInvitaOpen(true)}>
      <UserPlus aria-hidden />
      Invită pe cineva
    </Button>
  )

  return (
    <AppShell
      header={<ScreenHeader title="Echipa" backHref="/settings" />}
      bottomBarFixed
      bottomBar={
        <div className="mx-auto w-full max-w-md pl-18 pr-4">
          <div className="rounded-box shadow-2">{invitaButton}</div>
        </div>
      }
    >
      <ScreenBody className="space-y-3 pb-28">
        <ListRow
          leading={<Avatar text={initialeNume(numeProprietar(email))} ton="proprietar" />}
          title={numeProprietar(email)}
          detail={randMembru('proprietar')}
        />

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă echipa">
            <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : eroare ? (
          <Notice tone="danger" title="Echipa nu s-a încărcat">
            <span className="flex flex-col gap-2">
              <span>{eroare}</span>
              <Button type="button" variant="neutral" size="touch" onClick={() => void incarca()}>
                Încearcă din nou
              </Button>
            </span>
          </Notice>
        ) : (
          <ul className="space-y-2">
            {lista.map((membru) => (
              <li key={membru.id}>
                <ListRow
                  leading={<Avatar text={initialeNume(membru.name)} ton={membru.role} />}
                  title={membru.name}
                  detail={randMembru(membru.role, membru.modules_access)}
                  onClick={() => {
                    setDeschisId(membru.id)
                    setSheetOpen(true)
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {!loading && !eroare ? (
          <p className={cn('px-1 text-fg-muted', kitText.helper)}>
            {lista.length > 0
              ? 'Atingi un om ca să-i schimbi accesul, să-i retrimiți linkul sau să-l dezactivezi.'
              : 'Încă nu ai invitat pe nimeni. Operatorul își face cont și vede doar ce-i dai; livratorul primește un link pentru Livrări.'}
          </p>
        ) : null}
      </ScreenBody>

      <MembruSheet
        membru={deschis}
        open={sheetOpen && Boolean(deschis)}
        onOpenChange={setSheetOpen}
        onAccessSaved={(id, modulesAccess) =>
          setMembri((current) => current.map((membru) => (membru.id === id ? { ...membru, modules_access: modulesAccess } : membru)))
        }
        onDeactivated={(id) => setMembri((current) => current.filter((membru) => membru.id !== id))}
      />

      <InvitaStepForm open={invitaOpen} onOpenChange={setInvitaOpen} onInvited={() => void incarca()} />
    </AppShell>
  )
}
