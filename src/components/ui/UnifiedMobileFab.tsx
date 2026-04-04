'use client'

import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'

import { useAddAction } from '@/contexts/AddActionContext'

/** Rute unde nu afișăm FAB mobil, chiar dacă există alte acțiuni în context. */
function isFabSuppressedPath(pathname: string): boolean {
  if (pathname === '/dashboard' || pathname === '/') return true
  if (pathname.startsWith('/stocuri')) return true
  if (pathname.startsWith('/rapoarte')) return true
  if (pathname.startsWith('/admin')) return true
  if (pathname.startsWith('/settings')) return true
  return false
}

export default function UnifiedMobileFab() {
  const pathname = usePathname()
  const { triggerAddAction, hasAction, currentLabel } = useAddAction()

  const visible = hasAction && !isFabSuppressedPath(pathname)

  if (!visible) return null

  return (
    <div
      className="md:hidden"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 10px)',
        right: 14,
        zIndex: 42,
      }}
    >
      <button
        type="button"
        onClick={() => {
          triggerAddAction()
        }}
        data-tutorial="quick-add-button"
        data-mobile-fab="true"
        className="relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-[var(--agri-border)] bg-[var(--fab-surface)] p-0 shadow-[var(--agri-shadow)] ring-1 ring-[color:color-mix(in_srgb,var(--agri-primary)_16%,transparent)] transition-[box-shadow,transform] hover:shadow-[var(--agri-elevated-shadow-hover)] active:scale-[0.98] dark:border-[var(--agri-border)]"
        aria-label={currentLabel}
      >
        <Plus className="h-7 w-7 text-[var(--fab-text)]" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  )
}
