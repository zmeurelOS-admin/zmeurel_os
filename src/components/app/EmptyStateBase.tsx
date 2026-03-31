'use client'

import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'

type EmptyStateAction =
  | ReactNode
  | {
      label: string
      onClick: () => void
    }

interface EmptyStateBaseProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: EmptyStateAction
  variant: 'card' | 'centered'
}

function isActionConfig(action: EmptyStateAction | undefined): action is { label: string; onClick: () => void } {
  return typeof action === 'object' && action !== null && 'label' in action && 'onClick' in action
}

export function EmptyStateBase({ title, description, icon, action, variant }: EmptyStateBaseProps) {
  if (variant === 'centered') {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center text-[var(--agri-text-muted)] opacity-60">
            {icon ? icon : <Inbox className="h-5 w-5" />}
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--agri-text)]">{title}</h3>
          {description ? <p className="mt-1 max-w-xs text-center text-sm text-[var(--agri-text-muted)]">{description}</p> : null}
          {action ? (
            isActionConfig(action) ? (
              <Button
                type="button"
                className="agri-cta mt-4 bg-[var(--agri-primary)] text-white"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ) : (
              <div className="mt-4">{action}</div>
            )
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="agri-card p-6 text-center sm:p-8">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]">
        {icon ? icon : <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-lg font-bold text-[var(--agri-text)]">{title}</p>
      {description ? <p className="agri-muted mx-auto mt-2 max-w-md text-sm font-medium">{description}</p> : null}
      {action ? (
        <div className="mx-auto mt-4 w-full max-w-xs">
          {isActionConfig(action) ? (
            <Button type="button" className="agri-cta w-full bg-[var(--agri-primary)] text-white" onClick={action.onClick}>
              {action.label}
            </Button>
          ) : (
            action
          )}
        </div>
      ) : null}
    </div>
  )
}
