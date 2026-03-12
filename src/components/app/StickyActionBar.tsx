'use client'

import { cn } from '@/lib/utils'

interface StickyActionBarProps {
  children: React.ReactNode
  className?: string
}

export function StickyActionBar({ children, className }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 border-t border-[var(--agri-border)] bg-white/95 px-4 pt-3 pb-[calc(var(--safe-b)+var(--app-nav-clearance)+12px)] backdrop-blur',
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </div>
  )
}
