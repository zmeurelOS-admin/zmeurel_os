'use client'

import { cn } from '@/lib/utils'

interface StickyActionBarProps {
  className?: string
  children: React.ReactNode
}

export function StickyActionBar({ className, children }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 border-t border-[var(--surface-divider)] bg-[color:color-mix(in_srgb,var(--agri-surface)_92%,transparent)] px-5 pt-3 pb-[calc(var(--app-nav-clearance)+12px)] backdrop-blur',
        className
      )}
    >
      {children}
    </div>
  )
}
