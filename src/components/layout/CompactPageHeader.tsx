'use client'

import { kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

interface CompactPageHeaderProps {
  title?: string
  /** Titlul afișat sub 768 px în locul lui `title`. */
  phoneTitle?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
  className?: string
  /** Pe telefon, `rightSlot` pe rând separat sub titlu (evită înghesuirea). */
  stackMobileRightSlotBelow?: boolean
}

/**
 * Antetul ecranelor cu `PageHeader` (promptul 34, §10): același pe telefon și pe desktop — titlu, subtitlu și ce e în
 * dreapta, pe lățimea coloanei modulelor (`max-w-modul`). Fără fundalul verde și fără scurtăturile de pe desktop:
 * navigarea e în bara laterală, cu clopoțelul și contul.
 */
export function CompactPageHeader({ title, phoneTitle, subtitle, rightSlot, summary, className, stackMobileRightSlotBelow }: CompactPageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-bar border-b border-border-subtle bg-page/95 px-[var(--shell-content-px)] pb-1.5 pt-[calc(var(--safe-t)+7px)] backdrop-blur-sm sm:px-5 md:px-6 md:pb-3 md:pt-4',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-modul min-h-[42px]',
          stackMobileRightSlotBelow && rightSlot ? 'flex-col gap-2 md:flex-row md:items-center md:justify-between' : 'items-center justify-between gap-x-2 gap-y-2',
        )}
      >
        {title || subtitle ? (
          <div className="min-w-0 flex-1 lg:min-w-[220px]">
            {title ? (
              <h1 className={cn('break-words font-extrabold text-fg', kitText.section)}>
                {phoneTitle ? (
                  // Ales din CSS, nu din JavaScript: titlul de telefon e corect de la prima randare.
                  <>
                    <span className="md:hidden">{phoneTitle}</span>
                    <span className="hidden md:inline">{title}</span>
                  </>
                ) : (
                  title
                )}
              </h1>
            ) : null}
            {subtitle ? <p className={cn('mt-0.5 break-words text-fg-muted', kitText.helper)}>{subtitle}</p> : null}
          </div>
        ) : null}
        {rightSlot ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-fg">{rightSlot}</div> : null}
      </div>
      {summary ? <div className="mx-auto mt-2 w-full max-w-modul">{summary}</div> : null}
    </header>
  )
}
