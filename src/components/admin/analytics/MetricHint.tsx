'use client'

import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function MetricHint({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'cursor-help border-b border-dotted border-[var(--agri-text-muted)] text-[var(--agri-text)] decoration-dotted underline-offset-2',
              className
            )}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left font-normal leading-snug">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
