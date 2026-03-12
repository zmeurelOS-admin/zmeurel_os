'use client'

import type { ReactNode } from 'react'

import { EmptyStateBase } from '@/components/app/EmptyStateBase'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <EmptyStateBase
      icon={icon}
      title={title}
      description={description}
      action={actionLabel && onAction ? {
        label: actionLabel,
        onClick: onAction,
      } : undefined}
      variant="centered"
    />
  )
}
