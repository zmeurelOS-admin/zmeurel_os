'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  CircleHelp,
  Download,
  House,
  Settings,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react'

import LogoutButton from '@/components/LogoutButton'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'

function formatUserName(email: string | null): string {
  if (!email) return 'Popa Andrei'
  if (email.endsWith('@demo.zmeurel.local')) return 'Demo'
  const local = email.split('@')[0] ?? ''
  if (!local) return 'Popa Andrei'

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

export function UserProfileMenu() {
  const { email } = useDashboardAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const userName = useMemo(() => formatUserName(email), [email])
  const initials = useMemo(() => getAvatarInitials(userName), [userName])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
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

  const itemClassName =
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-gray-50'

  return (
    <div ref={wrapperRef} className="relative hidden md:z-[60] md:flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="cursor-pointer items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-2.5 py-1.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/30 md:inline-flex"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-medium text-white">
          {initials}
        </span>
        <span className="max-w-[160px] truncate">{userName}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-[70] mt-2 w-64 rounded-xl border border-[var(--agri-border)] bg-white py-2 shadow-lg"
          role="menu"
        >
          <div className="px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-medium text-white">
                {initials}
              </span>
              <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
            </div>
          </div>

          <div className="my-1 h-px bg-[var(--agri-border)]" />

          <Link href="/settings#profil" onClick={() => setOpen(false)} className={itemClassName}>
            <UserCircle2 className="h-4 w-4" />
            Profil
          </Link>
          <Link href="/settings#password" onClick={() => setOpen(false)} className={itemClassName}>
            <Settings className="h-4 w-4" />
            Setări cont
          </Link>
          <Link href="/settings#ferma" onClick={() => setOpen(false)} className={itemClassName}>
            <House className="h-4 w-4" />
            Setări fermă
          </Link>
          <Link href="/settings#gdpr" onClick={() => setOpen(false)} className={itemClassName}>
            <Download className="h-4 w-4" />
            Export date
          </Link>

          <div className="my-1 h-px bg-[var(--agri-border)]" />

          <Link href="/planuri" onClick={() => setOpen(false)} className={itemClassName}>
            <ShieldCheck className="h-4 w-4" />
            Plan abonament
          </Link>

          <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ajutor
          </div>
          <Link href="/termeni" onClick={() => setOpen(false)} className={itemClassName}>
            <CircleHelp className="h-4 w-4" />
            Ajutor
          </Link>

          <div className="my-1 h-px bg-[var(--agri-border)]" />

          <LogoutButton
            variant="ghost"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
            label="Deconectare"
          />
        </div>
      ) : null}
    </div>
  )
}
