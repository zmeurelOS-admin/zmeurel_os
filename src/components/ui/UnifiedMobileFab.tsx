'use client'

import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
  const [isMountedVisible, setIsMountedVisible] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsMountedVisible(true), 300)
    return () => window.clearTimeout(timeout)
  }, [])

  const visible = hasAction && !isFabSuppressedPath(pathname)
  const contextualTitle = useMemo(() => {
    if (pathname.startsWith('/activitati')) return 'Adaugă activitate'
    if (pathname.startsWith('/recoltari')) return 'Adaugă recoltare'
    if (pathname.startsWith('/comenzi')) return 'Adaugă comandă'
    if (pathname.startsWith('/cheltuieli')) return 'Adaugă cheltuială'
    return 'Adaugă'
  }, [pathname])

  if (!visible) return null

  return (
    <div
      className="md:hidden"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 12px)',
        right: 16,
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
        title={contextualTitle}
        aria-label={currentLabel ?? contextualTitle}
        className={[
          'relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[#2D6A4F] p-0 text-white shadow-lg transition-all duration-150 hover:scale-105 hover:bg-[#1f4a37] hover:shadow-[0_8px_24px_rgba(45,106,79,0.32)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2 dark:border-2 dark:border-emerald-400/30 dark:shadow-[0_4px_20px_rgba(45,106,79,0.5)]',
          isMountedVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.8]',
        ].join(' ')}
      >
        <Plus className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}
