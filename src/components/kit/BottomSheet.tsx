'use client'

import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { kitText } from './text'

export interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Titlul foii. E obligatoriu (numele ferestrei pentru cititoarele de ecran). */
  title: ReactNode
  /** Titlul rămâne doar pentru cititoarele de ecran. */
  hideTitle?: boolean
  description?: ReactNode
  children: ReactNode
  /** Zonă fixă jos, de obicei butonul principal (56 px). */
  footer?: ReactNode
  /** Butonul de închidere (48 px). Implicit apare. */
  showClose?: boolean
  className?: string
}

/**
 * Foaie de jos.
 *
 * Rădăcina e `Dialog` din `ui/dialog` (ascunde butonul plutitor prin `data-modal-open` și închide foaia
 * la „înapoi” pe Android), iar conținutul e `SheetContent` din `ui/sheet` (portal, capcană de focus, Esc).
 * Se deschide peste bara de jos, pe stratul `z-modal`.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  children,
  footer,
  showClose = true,
  className,
}: BottomSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        // Fără descriere, Radix cere marcarea explicită, altfel avertizează în consolă.
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'mx-auto flex max-h-[90dvh] w-full max-w-md flex-col gap-0 overflow-hidden rounded-t-sheet border-0 bg-surface p-0 text-fg shadow-overlay',
          className,
        )}
      >
        <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-border-strong" aria-hidden />

        <div className={cn('flex shrink-0 items-start gap-3 px-4', hideTitle && !showClose ? 'pt-2' : 'pb-2 pt-2')}>
          <div className={cn('flex min-w-0 flex-1 flex-col gap-1', !hideTitle && 'pt-2.5')}>
            <DialogPrimitive.Title className={hideTitle ? 'sr-only' : cn('font-extrabold text-fg', kitText.section)}>
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className={cn('text-fg-muted', kitText.secondary)}>
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {showClose ? (
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="quiet" size="icon-touch" aria-label="Închide" className="shrink-0 bg-surface-muted">
                <X aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          ) : null}
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2',
            footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]',
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-border-subtle bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Dialog>
  )
}
