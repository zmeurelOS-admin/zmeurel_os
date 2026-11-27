'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  ExternalLink,
  LogOut,
  Mail,
  Settings,
  Smartphone,
  Store,
  Users,
  UsersRound,
} from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { BottomSheet, Button, StatusPill, kitFocus, kitText } from '@/components/kit'
import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { ActionRow, IconBadge, NavRow, RowGroup, ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { ICONITE_MENIU } from '@/components/app/navigatie-iconite'
import { grupuriMeniu, meniuAdmin, meniuFinal, type IntrareMeniu } from '@/lib/navigatie/meniu'
import { FoaieInstalare } from '@/components/pwa/FoaieInstalare'
import { useInstalare } from '@/components/pwa/useInstalare'
import { cereInstalarea, esteIphone } from '@/lib/pwa/instalare'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { prepareClientBeforeServerSignOut } from '@/lib/auth/server-sign-out-form'
import { isHiddenOperatorEmail, mesajIesireOperatorLink } from '@/lib/farm-members/operator-link'
import { useUnreadNotificationsCount } from '@/lib/notifications/useUnreadCount'
import { queryKeys } from '@/lib/query-keys'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getMagazieStocSauNimic } from '@/lib/supabase/queries/magazie'
import { rezumatMagazie } from '@/lib/magazie/stoc'
import { useShopOrdersInLivrareCount } from '@/lib/shop/useShopOrdersInLivrareCount'
import { usePauzeActive } from '@/lib/tratamente/hooks'
import { pauzeOrdonate } from '@/lib/tratamente/pauza'
import { pastilaPauza } from '@/lib/tratamente/texte'
import { aziRo } from '@/lib/tratamente/zile'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/brand'

/** O placă din „Mai mult”: o intrare a navigației comune (`src/lib/navigatie/meniu.ts`). */
type TileDef = IntrareMeniu

function initialsOf(name: string): string {
  const parts = name
    .replace(/^ferma\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'F'
  if (parts.length === 1) return `F${parts[0].charAt(0)}`.toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

function userNameOf(email: string | null): string {
  if (!email) return 'Tu'
  if (email.endsWith('@demo.zmeurel.local')) return 'Cont demo'
  // Contul ascuns al operatorului din link: adresa internă nu spune nimic omului.
  if (isHiddenOperatorEmail(email)) return 'Tu'
  const local = email.split('@')[0] ?? ''
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return name || 'Tu'
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-page bg-danger px-1.5 font-extrabold text-primary-contrast',
        kitText.helper,
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Numele parcelelor (pentru pastila de pauză), din lista de parcele deja în cache. */
function useParcelNames(ids: readonly string[], enabled: boolean): string[] {
  const { data } = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, enabled: enabled && ids.length > 0, staleTime: 30_000, refetchOnWindowFocus: false })
  return ids.map((id) => data?.find((parcela) => parcela.id === id)?.nume_parcela?.trim() || 'parcelă')
}

function NavTile({ item, badge }: { item: TileDef; badge?: number }) {
  const icon = ICONITE_MENIU[item.iconita]
  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-box border border-border bg-surface px-1 text-center active:bg-surface-muted',
        kitFocus,
      )}
    >
      <IconBadge tone={item.ton} size="sm">
        {icon}
      </IconBadge>
      <span className={cn('font-semibold leading-tight text-fg', kitText.secondary)}>{item.label}</span>
      {badge && badge > 0 ? <CountBadge count={badge} className="absolute right-1.5 top-1.5" /> : null}
    </Link>
  )
}

export function MaiMultPageClient({ farmName, localitate }: { farmName: string | null; localitate: string | null }) {
  useTrackModuleView('mai_mult')
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const {
    email,
    isSuperAdmin,
    associationRole,
    memberRole,
    memberAccess,
    farmName: contextFarmName,
    linkOnly,
    ownerName,
  } = useDashboardAuth()
  const { unsubscribe: unsubscribePush } = usePushSubscription()
  const { data: unread = 0 } = useUnreadNotificationsCount()
  const { data: shopInLivrareCount = 0 } = useShopOrdersInLivrareCount()
  const submittingRef = useRef(false)
  const signOutFormRef = useRef<HTMLFormElement>(null)
  // Operatorul din link confirmă ieșirea: fără parolă, intră din nou doar cu un link nou.
  const [confirmIesire, setConfirmIesire] = useState(false)
  // Promptul 34, §4: „Instalează aplicația”, cât nu e instalată (și în demo).
  const instalare = useInstalare()
  const [foaieInstalare, setFoaieInstalare] = useState(false)
  const instaleaza = async () => {
    if (instalare.arePrompt && !esteIphone(navigator.userAgent)) {
      await cereInstalarea()
      return
    }
    setFoaieInstalare(true)
  }
  const iesireConfirmataRef = useRef(false)

  const isOperator = memberRole === 'operator'
  const ctxMeniu = { memberRole, memberAccess, isSuperAdmin, associationRole }
  const canSeeTratamente = !isOperator || (memberAccess ?? []).some((item) => item.module === 'tratamente')
  // Semnalul de pauză de pe rândul „Tratamente” (aceeași sursă ca Acasă și Recoltări).
  const [azi] = useState(aziRo)
  const { pauze } = usePauzeActive(azi, { enabled: canSeeTratamente })
  const numeParcelePauza = useParcelNames(pauzeOrdonate(pauze).map((pauza) => pauza.parcelaId), canSeeTratamente)
  const pastila = pastilaPauza(numeParcelePauza)
  // Magazia (promptul 28): „15 produse · 2 pe terminate”. Fără migrare: rândul spune „după actualizarea bazei de date”.
  const magazieQuery = useQuery({ queryKey: queryKeys.magazieStoc, queryFn: getMagazieStocSauNimic, enabled: canSeeTratamente, staleTime: 60_000 })
  const rezumatMag = magazieQuery.data ? rezumatMagazie(magazieQuery.data) : null
  // Deschisă din bara asociației (`/mai-mult?spatiu=asociatie`): aceeași listă ca foaia de dinainte.
  const inAssociationWorkspace = searchParams.get('spatiu') === 'asociatie' && Boolean(associationRole)

  // Navigația comună cu bara laterală (promptul 34, §10): fără ce e deja în bara de jos.
  const groups = useMemo(
    () => grupuriMeniu({ memberRole, memberAccess }, { faraPrincipale: true }),
    [memberAccess, memberRole],
  )

  const name = farmName ?? contextFarmName ?? 'Ferma ta'
  const role = isOperator ? 'operator' : email?.endsWith('@demo.zmeurel.local') ? 'demo' : 'proprietar'
  const cardDetail = [userNameOf(email), role, localitate].filter(Boolean).join(' · ')

  const farmCardInner = (
    <>
      <span
        aria-hidden
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-box bg-primary font-extrabold text-primary-contrast', kitText.base)}
      >
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('truncate font-bold text-fg', kitText.base)}>{name}</span>
        <span className={cn('truncate text-primary', kitText.helper)}>{cardDetail}</span>
      </span>
      {isOperator ? null : <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden />}
    </>
  )

  const bell = (
    <Link
      href="/notificari"
      aria-label={unread > 0 ? `Notificări: ${unread} necitite` : 'Notificări'}
      className={cn(
        'relative flex size-touch items-center justify-center rounded-box border border-border-strong bg-surface text-fg active:bg-surface-muted',
        kitFocus,
      )}
    >
      <Bell className="size-[22px]" aria-hidden />
      {unread > 0 ? <CountBadge count={unread} className="absolute -right-1.5 -top-1.5" /> : null}
    </Link>
  )

  return (
    <AppShell header={<ScreenHeader title="Mai mult" large right={bell} />}>
      <ScreenBody className="space-y-3.5">
        {inAssociationWorkspace ? (
          <>
            <RowGroup title="Asociație">
              <NavRow href="/asociatie/oferte" label="Oferte" icon={<Mail />} iconTone="primary" />
              <NavRow href="/asociatie/producatori" label="Fermieri" icon={<UsersRound />} iconTone="primary" />
              {associationRole === 'admin' ? (
                <NavRow href="/asociatie/membri" label="Membri" icon={<Users />} iconTone="primary" />
              ) : null}
              <NavRow href="/asociatie/setari" label="Setări" icon={<Settings />} iconTone="neutral" />
              <NavRow
                href="/magazin/asociatie"
                external
                label="Vezi magazinul"
                icon={<Store />}
                iconTone="neutral"
                trailing={<ExternalLink className="size-4 text-fg-subtle" aria-hidden />}
              />
            </RowGroup>
            <RowGroup>
              <NavRow href="/dashboard" label="Înapoi la fermă" icon={<ArrowLeft />} iconTone="primary" />
            </RowGroup>
          </>
        ) : (
          <>
            {isOperator ? (
              <div className="flex min-h-[68px] items-center gap-3 rounded-box bg-primary-soft px-3.5 py-2.5">{farmCardInner}</div>
            ) : (
              <Link
                href="/settings"
                className={cn('flex min-h-[68px] items-center gap-3 rounded-box bg-primary-soft px-3.5 py-2.5 active:opacity-90', kitFocus)}
              >
                {farmCardInner}
              </Link>
            )}

            {associationRole ? (
              <RowGroup>
                <NavRow href="/asociatie" label="Gustă din Bucovina" sub="Panoul asociației" icon={<Building2 />} iconTone="primary" />
              </RowGroup>
            ) : null}

            {groups.map((group) => (
              <section key={group.titlu} className="space-y-2">
                <h2 className={cn('font-bold text-fg-muted', kitText.secondary)}>{group.titlu}</h2>
                {group.intrari.some((item) => item.rand) ? (
                  <div className="overflow-hidden rounded-box border border-border bg-surface">
                    {group.intrari
                      .filter((item) => item.rand)
                      .map((item, index) => (
                        <div key={item.href} className={index > 0 ? 'border-t border-border' : undefined}>
                          {item.href === '/tratamente/magazie' ? (
                            <NavRow
                              href={item.href}
                              label={item.label}
                              sub={
                          rezumatMag
                            ? rezumatMag.produse > 0
                              ? rezumatMag.text
                              : 'Produsele de tratament și cât mai ai'
                            : magazieQuery.isLoading
                              ? 'Produsele de tratament și cât mai ai'
                              : 'După actualizarea bazei de date'
                              }
                              icon={ICONITE_MENIU[item.iconita]}
                              iconTone={item.ton}
                              trailing={rezumatMag && rezumatMag.peTerminate > 0 ? <StatusPill tone="warning">{`${rezumatMag.peTerminate} pe terminate`}</StatusPill> : undefined}
                            />
                          ) : (
                            <NavRow
                              href={item.href}
                              label={item.label}
                              sub={item.sub}
                              icon={ICONITE_MENIU[item.iconita]}
                              iconTone={item.ton}
                              trailing={item.href === '/tratamente' && pastila ? <StatusPill tone="warning">{pastila}</StatusPill> : undefined}
                            />
                          )}
                        </div>
                      ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {group.intrari.filter((item) => !item.rand).map((item) => (
                    <NavTile key={item.href} item={item} badge={item.href === '/livrari' ? shopInLivrareCount : undefined} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        {isSuperAdmin ? (
          <RowGroup title={`Admin (${APP_NAME})`}>
            {meniuAdmin(ctxMeniu).map((row) => (
              <NavRow key={row.href} href={row.href} label={row.label} icon={ICONITE_MENIU[row.iconita]} iconTone={row.ton} />
            ))}
          </RowGroup>
        ) : null}

        <RowGroup>
          {meniuFinal(ctxMeniu)
            .filter((row) => !row.extern)
            .map((row) => (
              <NavRow key={row.href} href={row.href} label={row.label} sub={row.sub} icon={ICONITE_MENIU[row.iconita]} iconTone={row.ton} />
            ))}
          {instalare.pregatit && !instalare.instalata ? (
            <ActionRow
              onClick={() => void instaleaza()}
              label="Instalează aplicația"
              sub="Pune Caietul pe ecranul telefonului"
              icon={<Smartphone />}
              iconTone="primary"
              chevron
            />
          ) : null}
          {/* Promptul 34, §3: în locul bulei „Ești în beta”. Superadminul (Andrei) nu-și scrie singur. */}
          {meniuFinal(ctxMeniu)
            .filter((row) => row.extern)
            .map((row) => (
              <NavRow key={row.href} href={row.href} external label={row.label} sub={row.sub} icon={ICONITE_MENIU[row.iconita]} iconTone={row.ton} />
            ))}
          <form
            ref={signOutFormRef}
            action="/api/auth/sign-out"
            method="POST"
            onSubmit={async (event) => {
              event.preventDefault()
              if (linkOnly && !iesireConfirmataRef.current) {
                setConfirmIesire(true)
                return
              }
              if (submittingRef.current) return
              submittingRef.current = true
              const form = event.currentTarget
              await prepareClientBeforeServerSignOut(queryClient, { unsubscribePush })
              form.submit()
            }}
          >
            <button
              type="submit"
              className={cn(
                'flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2 text-left font-semibold text-danger-text active:bg-surface-muted',
                kitText.base,
                kitFocus,
              )}
            >
              <IconBadge tone="danger">
                <LogOut />
              </IconBadge>
              Ieși din cont
            </button>
          </form>
        </RowGroup>

      </ScreenBody>
      <FoaieInstalare open={foaieInstalare} onOpenChange={setFoaieInstalare} />
      <BottomSheet
        open={confirmIesire}
        onOpenChange={setConfirmIesire}
        title="Ieși din cont?"
        footer={
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              variant="danger"
              size="touch-lg"
              className="w-full"
              onClick={() => {
                iesireConfirmataRef.current = true
                setConfirmIesire(false)
                signOutFormRef.current?.requestSubmit()
              }}
            >
              Da, ieși
            </Button>
            <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setConfirmIesire(false)}>
              Rămân
            </Button>
          </div>
        }
      >
        <p className={cn('text-fg', kitText.base)}>{mesajIesireOperatorLink(ownerName)}</p>
      </BottomSheet>
    </AppShell>
  )
}
