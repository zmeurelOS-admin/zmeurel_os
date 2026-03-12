import * as React from 'react'

import { cn } from '@/lib/utils'

const appCardBaseClass =
  'w-full rounded-2xl border border-[var(--agri-border)] bg-white p-5 shadow-sm'

function AppCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-card"
      className={cn(appCardBaseClass, className)}
      {...props}
    />
  )
}

function InfoCard({ className, ...props }: React.ComponentProps<'div'>) {
  return <AppCard data-slot="info-card" className={cn('text-left', className)} {...props} />
}

function EntityCard({ className, ...props }: React.ComponentProps<'div'>) {
  return <AppCard data-slot="entity-card" className={cn('text-left', className)} {...props} />
}

function ActionCard({ className, ...props }: React.ComponentProps<'div'>) {
  return <AppCard data-slot="action-card" className={cn('text-left', className)} {...props} />
}

function ListCard({ className, ...props }: React.ComponentProps<'div'>) {
  return <AppCard data-slot="list-card" className={cn('text-left', className)} {...props} />
}

function AppCardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="app-card-header"
      className={cn(
        'mb-4 flex items-start justify-between gap-4 [&_[data-slot=app-card-title]]:text-sm [&_[data-slot=app-card-title]]:font-semibold [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold',
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
