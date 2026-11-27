'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronUp, Download, Settings, ShieldCheck } from 'lucide-react'

import LogoutButton from '@/components/LogoutButton'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { kitFocus, kitText } from '@/components/kit'
import { isHiddenOperatorEmail } from '@/lib/farm-members/operator-link'
import { cn } from '@/lib/utils'

function formatUserName(email: string | null): string {
  if (!email) return 'Contul tău'
  if (email.endsWith('@demo.zmeurel.local')) return 'Cont demo'
  if (isHiddenOperatorEmail(email)) return 'Operator'
  const local = email.split('@')[0] ?? ''
  if (!local) return 'Contul tău'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getAvatarInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

/**
 * Contul, jos în bara laterală (promptul 34, §10): numele, apoi Setări, exportul, „Planul tău” și ieșirea din cont.
 * Fereastra se deschide în sus. `restrans` = bara laterală strânsă (doar inițialele).
 */
export function UserProfileMenu({ restrans = false }: { restrans?: boolean }) {
  const { email, memberRole } = useDashboardAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const userName = useMemo(() => formatUserName(email), [email])
  const initials = useMemo(() => getAvatarInitials(userName), [userName])
  const operator = memberRole === 'operator'

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  const itemClassName = cn('flex min-h-touch items-center gap-2.5 rounded-control px-3 font-semibold text-fg hover:bg-surface-muted [&_svg]:size-4', kitText.secondary, kitFocus)

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn('flex min-h-touch w-full items-center gap-2.5 rounded-control px-2 text-left hover:bg-surface-muted', kitFocus)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Contul: ${userName}`}
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary', kitText.helper)} aria-hidden>
          {initials}
        </span>
        {restrans ? null : (
          <>
            <span className={cn('min-w-0 flex-1 break-words font-semibold text-fg', kitText.secondary)}>{userName}</span>
            <ChevronUp className="size-4 shrink-0 text-fg-muted" aria-hidden />
          </>
        )}
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-popover mb-2 w-64 rounded-card border border-border bg-surface p-2 shadow-2" role="menu">
          {operator ? null : (
            <>
              <Link href="/settings" onClick={() => setOpen(false)} className={itemClassName}>
                <Settings aria-hidden />
                Setări
              </Link>
              <Link href="/settings/cont" onClick={() => setOpen(false)} className={itemClassName}>
                <Download aria-hidden />
                Exportă datele
              </Link>
              <Link href="/planuri" onClick={() => setOpen(false)} className={itemClassName}>
                <ShieldCheck aria-hidden />
                Planul tău
              </Link>
              <div className="my-1 h-px bg-border" />
            </>
          )}
          <LogoutButton variant="ghost" className={cn(itemClassName, 'w-full justify-start text-danger-text hover:bg-danger-bg')} label="Ieși din cont" />
        </div>
      ) : null}
    </div>
  )
}
