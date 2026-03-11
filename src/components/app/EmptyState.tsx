'use client'

import type { ReactNode } from 'react'
import { EmptyStateBase } from '@/components/app/EmptyStateBase'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  primaryAction?:
    | ReactNode
    | {
        label: string
        onClick: () => void
      }
}

export function EmptyState({
  title,
  description,
  icon,
  primaryAction,
}: EmptyStateProps) {
  return (
    <EmptyStateBase
      title={title}
      description={description}
      icon={icon}
      action={primaryAction}
      variant="card"
    />
  )
}
