'use client'

import { type DashboardContentShellVariant } from '@/components/app/DashboardContentShell'
import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { AntetDesktop, type ActiuneAntet } from '@/components/kit'
import { useAddAction } from '@/contexts/AddActionContext'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  /** Titlul afișat sub 768 px în locul lui `title`. */
  phoneTitle?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
  headerClassName?: string
  /** Asociație: acțiunile din dreapta vizibile și pe telefon (altfel doar de la 768 px). */
  expandRightSlotOnMobile?: boolean
  /** Asociație: pe telefon, acțiunile sub titlu, pe rând separat. */
  stackMobileRightSlotBelowTitle?: boolean
  /** Fără efect din promptul 34 (§10): antetul are lățimea coloanei modulelor. Rămâne pentru paginile vechi. */
  contentVariant?: DashboardContentShellVariant
  /** Desktop (de la 1024 px, promptul 35): acțiunea principală a paginii, în dreapta antetului. */
  actiune?: ActiuneAntet | null
  /** Desktop: comutatoarele paginii („Listă / Tabel”, „Comenzi / Livrări azi”). */
  comutatoare?: React.ReactNode
  /** Desktop: butoane în plus, înaintea acțiunii principale. */
  alteActiuni?: React.ReactNode
  /** Desktop: fără câmpul de căutare globală. */
  faraCautare?: boolean
}

/**
 * Antetul unui ecran (promptul 34, §10): același pe telefon și pe desktop. Clopoțelul stă aici doar pe telefon; pe
 * desktop, clopoțelul și contul sunt în bara laterală. Butonul de adăugare al paginii (`useAddAction`, Material
 * săditor) apare în dreapta de la 768 px. De la 1024 px (promptul 35, §1), în dreapta mai stau căutarea globală,
 * comutatoarele paginii și acțiunea principală (`AntetDesktop`), în locul barei fixe de jos.
 */
export function PageHeader({
  title,
  phoneTitle,
  subtitle,
  rightSlot,
  summary,
  headerClassName,
  expandRightSlotOnMobile,
  stackMobileRightSlotBelowTitle,
  actiune,
  comutatoare,
  alteActiuni,
  faraCautare,
}: PageHeaderProps) {
  const { triggerAddAction, currentLabel, hasAction } = useAddAction()

  return (
    <CompactPageHeader
      title={title}
      phoneTitle={phoneTitle}
      subtitle={subtitle}
      summary={summary}
      className={headerClassName}
      stackMobileRightSlotBelow={stackMobileRightSlotBelowTitle}
      rightSlot={
        <>
          <div className="md:hidden">
            <NotificationBell />
          </div>
          {hasAction ? (
            <button
              type="button"
              onClick={triggerAddAction}
              className="hidden min-h-touch items-center rounded-control border border-border bg-surface px-4 font-semibold text-fg hover:bg-surface-muted md:inline-flex"
            >
              {currentLabel}
            </button>
          ) : null}
          {rightSlot ? (
            <div className={cn('flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2', !expandRightSlotOnMobile && 'hidden md:flex')}>
              {rightSlot}
            </div>
          ) : null}
          <AntetDesktop actiune={actiune} comutatoare={comutatoare} alte={alteActiuni} faraCautare={faraCautare} />
        </>
      }
    />
  )
}
