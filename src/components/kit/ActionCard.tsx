'use client'

import { useId, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export interface ActionCardAction {
  label: ReactNode
  icon?: ReactNode
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}

export interface ActionCardSecondaryAction {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  /** De ce e inactivă (ex. „fără locație încă”). Se afișează sub butoane și se citește. */
  disabledReason?: string
}

export interface ActionCardProps {
  title: ReactNode
  /** Rândul de sub titlu (localitate, dată, sursă). */
  meta?: ReactNode
  /** Suma sau cantitatea din dreapta sus. */
  amount?: ReactNode
  /** Eticheta de sub sumă (ex. „de încasat”). */
  amountLabel?: ReactNode
  /** Cercul din stânga titlului (ex. numărul opririi pe traseu). */
  leading?: ReactNode
  /** Rândul de pastile (`ActionCardChip`, `StatusPill`). */
  pills?: ReactNode
  /** Notă evidențiată (ex. nota din comandă). */
  note?: ReactNode
  /** Subsolul zonei de conținut: informație în stânga, statusuri în dreapta. */
  footer?: ReactNode
  /** Deschide detaliile: zona de conținut devine buton. */
  onOpen?: () => void
  /** Numele butonului de deschidere (ex. „Deschide comanda lui Ion Popescu”). */
  openLabel?: string
  /** Singurul buton principal al cardului. */
  action?: ActionCardAction
  /** Acțiuni secundare, pe un rând, deasupra butonului principal (ex. Sună / Navighează). */
  secondaryActions?: ReadonlyArray<ActionCardSecondaryAction>
  /** `hero` = cardul principal al ecranului (ex. următoarea oprire): contur accentuat, buton de 56 px. */
  emphasis?: 'default' | 'hero'
  className?: string
}

/** Card cu zone fixe (titlu, detalii, sumă, pastile, subsol) și un singur buton principal. */
export function ActionCard({
  title,
  meta,
  amount,
  amountLabel,
  leading,
  pills,
  note,
  footer,
  onOpen,
  openLabel,
  action,
  secondaryActions,
  emphasis = 'default',
  className,
}: ActionCardProps) {
  const reasonId = useId()
  const hero = emphasis === 'hero'
  const disabledReasons = (secondaryActions ?? []).filter((item) => item.disabled && item.disabledReason)

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? (
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-primary-contrast [&_svg]:size-5',
                kitText.base,
              )}
            >
              {leading}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <span className={cn('font-extrabold text-fg', hero ? kitText.section : kitText.card)}>{title}</span>
            {meta ? <span className={cn('font-medium text-fg-muted', kitText.secondary)}>{meta}</span> : null}
          </div>
        </div>
        {amount ? (
          <span className="flex shrink-0 flex-col items-end">
            <span className={cn('font-extrabold text-fg', kitText.section)}>{amount}</span>
            {amountLabel ? <span className={cn('text-fg-muted', kitText.helper)}>{amountLabel}</span> : null}
          </span>
        ) : null}
      </div>
      {pills ? <div className="flex flex-wrap gap-1.5">{pills}</div> : null}
      {note ? <p className={cn('rounded-control bg-surface-muted px-3 py-2 text-fg', kitText.secondary)}>{note}</p> : null}
      {footer ? (
        <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">{footer}</div>
      ) : null}
    </>
  )

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card bg-surface',
        hero ? 'border-2 border-primary shadow-2' : 'border border-border shadow-1',
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className={cn('flex w-full flex-col gap-3 p-4 text-left transition-transform active:scale-[0.99]', kitFocus)}
        >
          {body}
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-4">{body}</div>
      )}

      {action || secondaryActions?.length ? (
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          {secondaryActions?.length ? (
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: `repeat(${secondaryActions.length}, minmax(0, 1fr))` }}
            >
              {secondaryActions.map((item) => (
                <Button
                  key={item.label}
                  type="button"
                  variant="neutral"
                  size="touch"
                  disabled={item.disabled}
                  aria-describedby={item.disabled && item.disabledReason ? reasonId : undefined}
                  onClick={item.onClick}
                  className={cn('min-w-0 gap-1.5 px-2 has-[>svg]:px-2', kitText.secondary)}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </Button>
              ))}
            </div>
          ) : null}
          {disabledReasons.length ? (
            <p id={reasonId} className={cn('text-fg-muted', kitText.helper)}>
              {disabledReasons.map((item) => `${item.label}: ${item.disabledReason}`).join(' · ')}
            </p>
          ) : null}
          {action ? (
            <Button
              type="button"
              variant="primary"
              size={hero ? 'touch-lg' : 'touch'}
              loading={action.loading}
              disabled={action.disabled}
              onClick={action.onClick}
              className="w-full"
            >
              {action.loading ? null : action.icon}
              {action.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Pastilă de conținut din card (ex. „Maravilla · 50 buc”). Nu e apăsabilă. */
export function ActionCardChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center rounded-control bg-primary-soft px-3 font-bold text-fg',
        kitText.secondary,
        className,
      )}
    >
      {children}
    </span>
  )
}
