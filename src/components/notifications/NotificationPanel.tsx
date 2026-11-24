'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { notificationTimeLabel } from '@/app/(dashboard)/notificari/group'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, buttonVariants, kitText } from '@/components/kit'
import { RandNotificare, type NotificareRand } from '@/components/notifications/RandNotificare'
import { getNotificationHref } from '@/lib/notifications/navigation'
import { cn } from '@/lib/utils'

export type NotificationPanelProps = {
  notifications: NotificareRand[]
  loading?: boolean
  onMarkAllRead: () => Promise<void>
  onMarkRead: (id: string) => Promise<void>
  onClose: () => void
  onItemNavigate?: () => void
  /** Dacă true, ascunde „Vezi toate notificările” (pagina dedicată). */
  hideFooterLink?: boolean
  /**
   * Titlul „Notificări” în panou: doar pe desktop (fereastra mică). Pe telefon titlul e al foii (`BottomSheet`),
   * deci nu se mai scrie o dată în corp (promptul 33).
   */
  cuTitlu?: boolean
}

function textNecitite(n: number): string {
  if (n === 0) return 'Le-ai citit pe toate'
  return n === 1 ? '1 necitită' : `${n} necitite`
}

/**
 * Corpul foii „Notificări” din clopoțel (promptul 33, pe kit): câte sunt necitite, „Citește tot”, ultimele
 * notificări cu rândul comun (`RandNotificare`, același ca pe pagina „Notificări”) și „Vezi toate notificările”.
 */
export function NotificationPanel({
  notifications,
  loading,
  onMarkAllRead,
  onMarkRead,
  onClose,
  onItemNavigate,
  hideFooterLink,
  cuTitlu = false,
}: NotificationPanelProps) {
  const { associationRole } = useDashboardAuth()
  const router = useRouter()
  const necitite = notifications.filter((notification) => !notification.read).length

  const deschide = useCallback(
    async (notificare: NotificareRand) => {
      await onMarkRead(notificare.id)
      const href = getNotificationHref(notificare, associationRole ?? null)
      onItemNavigate?.()
      onClose()
      router.push(href)
    },
    [associationRole, onClose, onItemNavigate, onMarkRead, router],
  )

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex min-h-touch items-center justify-between gap-2">
        <div className="min-w-0">
          {cuTitlu ? <h2 className={cn('font-extrabold text-fg', kitText.card)}>Notificări</h2> : null}
          <p className={cn('text-fg-muted', kitText.secondary)}>{textNecitite(necitite)}</p>
        </div>
        {necitite > 0 ? (
          <Button type="button" variant="quiet" size="touch" className="shrink-0" onClick={() => void onMarkAllRead()}>
            Citește tot
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="space-y-1.5" aria-busy="true" aria-label="Se încarcă notificările">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-[72px] animate-pulse rounded-box bg-surface-muted" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <p className={cn('px-1 py-8 text-center text-fg-muted', kitText.secondary)}>Nicio notificare.</p>
        ) : (
          <ul className="space-y-1.5">
            {notifications.map((notificare) => (
              <li key={notificare.id}>
                <RandNotificare notificare={notificare} ora={notificationTimeLabel(notificare.created_at)} onOpen={(rand) => void deschide(rand)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!hideFooterLink ? (
        <Link href="/notificari" onClick={onClose} className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}>
          Vezi toate notificările
        </Link>
      ) : null}
    </div>
  )
}
