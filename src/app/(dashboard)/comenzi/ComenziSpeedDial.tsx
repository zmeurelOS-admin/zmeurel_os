'use client'

import { ClipboardList, Pencil, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

type ComenziSpeedDialProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNewOrder: () => void
  onFromMessage: () => void
}

export function ComenziSpeedDial({
  open,
  onOpenChange,
  onNewOrder,
  onFromMessage,
}: ComenziSpeedDialProps) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Închide acțiunile rapide"
        className="fixed inset-0 z-[41] bg-black/20 md:hidden"
        onClick={() => onOpenChange(false)}
      />

      <div
        className="fixed right-4 z-[44] flex flex-col items-end gap-2 md:hidden"
        style={{
          bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 76px)',
        }}
      >
        <SpeedDialAction
          icon={<Pencil className="h-4 w-4" aria-hidden />}
          label="Comandă nouă"
          delayClass="delay-75"
          onClick={() => {
            onOpenChange(false)
            onNewOrder()
          }}
        />
        <SpeedDialAction
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
          label="Din mesaj"
          delayClass="delay-0"
          onClick={() => {
            onOpenChange(false)
            onFromMessage()
          }}
        />
      </div>

      <div
        className="fixed right-4 z-[45] md:hidden"
        style={{
          bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 12px)',
        }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          data-mobile-fab="true"
          aria-label="Închide acțiunile rapide"
          className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[var(--primary)] p-0 text-[var(--primary-foreground)] shadow-[var(--shadow-glow)] transition-all duration-200 hover:scale-105 hover:brightness-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        >
          <Plus className="h-6 w-6 rotate-45 transition-transform duration-200" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </>
  )
}

function SpeedDialAction({
  icon,
  label,
  delayClass,
  onClick,
}: {
  icon: ReactNode
  label: string
  delayClass: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex min-h-11 translate-y-0 items-center gap-2 rounded-full bg-[var(--surface-card)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-elevated)] transition-all duration-200 active:scale-[0.985]',
        'animate-in fade-in slide-in-from-bottom-2',
        delayClass,
      ].join(' ')}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-card-muted)] text-[var(--primary)]">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}
