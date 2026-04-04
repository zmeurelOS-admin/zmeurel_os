import * as React from 'react'

import { cn } from '@/lib/utils'

export type AppCardProps = React.ComponentProps<'div'> & {
  /** Umbră „ridicată” la hover — doar pentru carduri realmente interactive (ex. onClick). */
  elevateOnHover?: boolean
}

// AppCard este containerul semantic de baza pentru toate suprafetele de tip card.
// Paleta si contrastul vin din token-uri, nu din culori locale in componente.
const appCardBaseClass =
  'w-full rounded-[var(--agri-radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-[var(--text-primary)] shadow-[var(--shadow-soft)] sm:p-[18px]'

const appCardElevateHoverClass =
  'transition-[box-shadow] duration-150 ease-out hover:shadow-[var(--shadow-elevated)]'

function AppCard({ className, elevateOnHover, ...props }: AppCardProps) {
  return (
    <div
      data-slot="app-card"
      className={cn(appCardBaseClass, elevateOnHover && appCardElevateHoverClass, className)}
      {...props}
    />
  )
}

function InfoCard({ className, elevateOnHover, ...props }: AppCardProps) {
  return (
    <AppCard
      data-slot="info-card"
      elevateOnHover={elevateOnHover}
      className={cn('bg-[var(--surface-card-elevated)] text-left shadow-[var(--shadow-elevated)]', className)}
      {...props}
    />
  )
}

function EntityCard({ className, elevateOnHover, ...props }: AppCardProps) {
  return (
    <AppCard data-slot="entity-card" elevateOnHover={elevateOnHover} className={cn('text-left', className)} {...props} />
  )
}

function ActionCard({ className, elevateOnHover, ...props }: AppCardProps) {
  return (
    <AppCard data-slot="action-card" elevateOnHover={elevateOnHover} className={cn('text-left', className)} {...props} />
  )
}

function ListCard({ className, elevateOnHover, ...props }: AppCardProps) {
  return (
    <AppCard
      data-slot="list-card"
      elevateOnHover={elevateOnHover}
      className={cn('bg-[var(--surface-card-muted)] text-left', className)}
      {...props}
    />
  )
}

function AppCardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-card-header"
      className={cn(
        'mb-3 flex items-start justify-between gap-3.5 text-[var(--text-primary)] [&_[data-slot=app-card-title]]:text-sm [&_[data-slot=app-card-title]]:[font-weight:650] [&_h1]:text-sm [&_h1]:[font-weight:650] [&_h2]:text-sm [&_h2]:[font-weight:650] [&_h3]:text-sm [&_h3]:[font-weight:650]',
        className,
      )}
      {...props}
    />
  )
}

function AppCardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="app-card-content" className={cn('space-y-3.5 text-sm text-[var(--text-secondary)]', className)} {...props} />
  )
}

function AppCardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-card-footer"
      className={cn('mt-3.5 flex flex-wrap gap-2 border-t border-[var(--divider)] pt-3 text-[var(--text-secondary)]', className)}
      {...props}
    />
  )
}

export {
  AppCard,
  InfoCard,
  EntityCard,
  ActionCard,
  ListCard,
  AppCardHeader,
  AppCardContent,
  AppCardFooter,
}
