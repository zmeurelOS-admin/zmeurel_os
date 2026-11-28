'use client'

import type { ReactNode } from 'react'
import { Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

/** Evenimentul care deschide căutarea globală (ascultat de `CautareGlobala`). Kitul nu citește date. */
export const EVENIMENT_CAUTARE = 'caietul:deschide-cautarea'

export function deschideCautarea() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENIMENT_CAUTARE))
}

export interface ActiuneAntet {
  label: string
  onClick: () => void
  /** Fără iconiță se pune „+”. `null` = fără iconiță. */
  icon?: ReactNode | null
  disabled?: boolean
}

export interface AntetDesktopProps {
  /** Comutatoarele paginii (ex. „Listă / Tabel”, „Comenzi / Livrări azi”). */
  comutatoare?: ReactNode
  /** Acțiunea principală a paginii („+ Comandă”). */
  actiune?: ActiuneAntet | null
  /** Butoane în plus, înaintea acțiunii principale (ex. „Din mesaj”, „Registrul de tratamente”). */
  alte?: ReactNode
  /** Fără câmpul de căutare (paginile de admin, asociația). */
  faraCautare?: boolean
  className?: string
}

/** Câmpul de căutare din antet: deschide căutarea globală (Ctrl K / ⌘ K). */
export function CampCautare({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={deschideCautarea}
      aria-label="Caută comandă, client, parcelă (Ctrl K)"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        'flex h-touch w-[min(320px,28vw)] min-w-[200px] items-center gap-2 rounded-control border border-border bg-surface px-3 text-left text-fg-muted hover:bg-surface-muted',
        kitText.secondary,
        kitFocus,
        className,
      )}
    >
      <Search className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 break-words">Caută comandă, client, parcelă…</span>
      <kbd className={cn('shrink-0 rounded-control border border-border-subtle bg-surface-muted px-1.5 font-semibold', kitText.helper)}>Ctrl K</kbd>
    </button>
  )
}

/**
 * Partea din dreapta a antetului de pe desktop (promptul 35, §1): căutarea globală, comutatoarele paginii și acțiunea
 * principală. Se vede doar de la 1024 px (`hidden lg:flex`); pe telefon nu apare nimic.
 */
export function AntetDesktop({ comutatoare, actiune, alte, faraCautare = false, className }: AntetDesktopProps) {
  return (
    <div className={cn('hidden min-w-0 flex-wrap items-center justify-end gap-2 lg:flex', className)}>
      {faraCautare ? null : <CampCautare />}
      {comutatoare}
      {alte}
      {actiune ? (
        <Button type="button" variant="primary" size="touch" onClick={actiune.onClick} disabled={actiune.disabled}>
          {actiune.icon === undefined ? <Plus aria-hidden /> : actiune.icon}
          {actiune.label}
        </Button>
      ) : null}
    </div>
  )
}
