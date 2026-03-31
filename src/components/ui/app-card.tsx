import * as React from 'react'

import { cn } from '@/lib/utils'

export type AppCardProps = React.ComponentProps<'div'> & {
  /** Umbră „ridicată” la hover — doar pentru carduri realmente interactive (ex. onClick). */
  elevateOnHover?: boolean
}

const appCardBaseClass =
  'w-full rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-[18px] shadow-[var(--agri-elevated-shadow)]'

const appCardElevateHoverClass =
  'transition-[box-shadow] duration-150 ease-out hover:shadow-[var(--agri-elevated-shadow-hover)]'

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
    <AppCard data-slot="info-card" elevateOnHover={elevateOnHover} className={cn('text-left', className)} {...props} />
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
    <AppCard data-slot="list-card" elevateOnHover={elevateOnHover} className={cn('text-left', className)} {...props} />
  )
}

function AppCardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-card-header"
      className={cn(
        'mb-3.5 flex items-start justify-between gap-4 [&_[data-slot=app-card-title]]:text-sm [&_[data-slot=app-card-title]]:font-semibold [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold',
        className
      )}
      {...props}
    />
  )
}

function AppCardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="app-card-content" className={cn('space-y-4 text-sm', className)} {...props} />
}

function AppCardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="app-card-footer" className={cn('mt-4 flex flex-wrap gap-2', className)} {...props} />
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
