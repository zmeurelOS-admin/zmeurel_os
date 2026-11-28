'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { AntetDesktop, kitFocus, kitText, type AntetDesktopProps } from '@/components/kit'
import { cn } from '@/lib/utils'

/**
 * Piesele comune ale ecranelor Mai mult, Notificări și Setări (mockup 20.11):
 * antetul cu „Înapoi”, grupurile cu titlu, rândurile care deschid o subpagină, iconița colorată.
 */

export type IconTone = 'primary' | 'info' | 'neutral' | 'warning' | 'danger'

const ICON_TONE_CLASS: Record<IconTone, string> = {
  primary: 'bg-primary-soft text-primary',
  info: 'bg-info-bg text-info-text',
  neutral: 'bg-neutral-bg text-neutral-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
}

/** Pătratul colorat cu iconița (36 px în rânduri, 32 px pe plăci, 40 px pe notificări). */
export function IconBadge({
  children,
  tone = 'primary',
  size = 'md',
  className,
}: {
  children: ReactNode
  tone?: IconTone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center [&_svg]:size-5',
        size === 'sm' && 'size-8 rounded-control',
        size === 'md' && 'size-9 rounded-control',
        size === 'lg' && 'size-10 rounded-control',
        ICON_TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Antetul unei subpagini: „Înapoi” (48 px) + titlu + loc în dreapta.
 * „Înapoi” merge pe istoric când se poate, altfel la `backHref` (link direct, pagină deschisă din notificare).
 */
export function ScreenHeader({
  title,
  backHref,
  right,
  large = false,
  subtitle,
  desktop,
  titleDesktop,
}: {
  title: string
  /** Alt titlu de la 1024 px (ex. „Bani și rapoarte” pentru Rapoarte). */
  titleDesktop?: string
  /** Rândul de context de sub titlu; pe telefon apare doar dacă e dat (promptul 35, §1). */
  subtitle?: string
  /** Partea din dreapta a antetului pe desktop (căutarea, comutatoarele, acțiunea principală). */
  desktop?: AntetDesktopProps
  /** Fără `backHref`: fără buton „Înapoi” (ecranul de sus, ex. Mai mult). */
  backHref?: string
  right?: ReactNode
  /** Titlul de 26 px al unui ecran principal (Mai mult); altfel 22 px. */
  large?: boolean
}) {
  const router = useRouter()

  return (
    <header className="bg-page pt-[max(var(--safe-t),8px)]">
      <div className={cn('mx-auto flex w-full max-w-modul items-center gap-1 pb-2 pt-1', backHref ? 'px-3' : 'px-5')}>
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Înapoi"
            onClick={(event) => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                event.preventDefault()
                router.back()
              }
            }}
            className={cn(
              'flex size-touch shrink-0 items-center justify-center rounded-box text-fg active:bg-surface-muted',
              // Pe desktop modulele sunt în bara laterală: „înapoi” spre „Mai mult” nu are sens (promptul 35, §1).
              backHref === '/mai-mult' && 'lg:hidden',
              kitFocus,
            )}
          >
            <ChevronLeft className="size-6" strokeWidth={2.2} aria-hidden />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className={cn('truncate font-extrabold text-fg', large ? kitText.screen : kitText.section)}>
            {titleDesktop ? (
              <>
                <span className="lg:hidden">{title}</span>
                <span className="hidden lg:inline">{titleDesktop}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {subtitle ? <p className={cn('mt-0.5 break-words text-fg-muted', kitText.helper)}>{subtitle}</p> : null}
        </div>
        {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
        <AntetDesktop {...desktop} className="ml-2" />
      </div>
    </header>
  )
}

/** Conținutul unui ecran: lat cât un telefon, centrat pe desktop. */
export function ScreenBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-modul space-y-5 pb-6 pt-1', className)}>{children}</div>
}

/** Grup cu titlu (15 px) și rândurile lipite într-un card. */
export function RowGroup({
  title,
  titleTone = 'muted',
  children,
  danger = false,
  id,
}: {
  title?: ReactNode
  titleTone?: 'muted' | 'fg' | 'danger'
  children: ReactNode
  /** Grupul „Ireversibil”: contur roșu. */
  danger?: boolean
  id?: string
}) {
  return (
    <section id={id} className="space-y-2">
      {title ? (
        <h2
          className={cn(
            'font-bold',
            kitText.secondary,
            titleTone === 'muted' && 'text-fg-muted',
            titleTone === 'fg' && 'text-fg',
            titleTone === 'danger' && 'text-danger-text',
          )}
        >
          {title}
        </h2>
      ) : null}
      <div
        className={cn(
          'divide-y overflow-hidden rounded-box border bg-surface',
          danger ? 'divide-danger-border border-danger-border' : 'divide-border border-border',
        )}
      >
        {children}
      </div>
    </section>
  )
}

const ROW_CLASS = 'flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2 text-left active:bg-surface-muted'

function RowContent({
  icon,
  iconTone,
  label,
  sub,
  subTone = 'muted',
  trailing,
  chevron,
  labelTone = 'fg',
}: {
  icon?: ReactNode
  iconTone?: IconTone
  label: ReactNode
  sub?: ReactNode
  subTone?: 'muted' | 'warning' | 'danger' | 'success'
  trailing?: ReactNode
  chevron?: boolean
  labelTone?: 'fg' | 'danger'
}) {
  return (
    <>
      {icon ? <IconBadge tone={iconTone}>{icon}</IconBadge> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('font-semibold', kitText.base, labelTone === 'danger' ? 'text-danger-text' : 'text-fg')}>{label}</span>
        {sub ? (
          <span
            className={cn(
              kitText.helper,
              subTone === 'muted' && 'text-fg-muted',
              subTone === 'warning' && 'text-warning-text',
              subTone === 'danger' && 'text-danger-text',
              subTone === 'success' && 'text-success-text',
            )}
          >
            {sub}
          </span>
        ) : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      {chevron ? <ChevronRight className="size-5 shrink-0 text-fg-subtle" aria-hidden /> : null}
    </>
  )
}

export interface NavRowProps {
  href: string
  label: ReactNode
  sub?: ReactNode
  subTone?: 'muted' | 'warning' | 'danger' | 'success'
  icon?: ReactNode
  iconTone?: IconTone
  trailing?: ReactNode
  /** Link în afara aplicației (WhatsApp, magazinul public): se deschide în altă filă. */
  external?: boolean
  'aria-label'?: string
}

/** Rând care deschide o pagină (săgeată în dreapta). */
export function NavRow({ href, external, 'aria-label': ariaLabel, ...content }: NavRowProps) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={cn(ROW_CLASS, kitFocus)}>
        <RowContent {...content} chevron />
      </a>
    )
  }
  return (
    <Link href={href} aria-label={ariaLabel} className={cn(ROW_CLASS, kitFocus)}>
      <RowContent {...content} chevron />
    </Link>
  )
}

/** Rând-buton (acțiune pe loc: deschide o confirmare, o alegere). */
export function ActionRow({
  onClick,
  disabled,
  danger,
  chevron = false,
  expanded,
  ...content
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  chevron?: boolean
  /** Pentru rândurile care deschid ceva sub ele, în același ecran. */
  expanded?: boolean
  label: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  iconTone?: IconTone
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      className={cn(ROW_CLASS, kitFocus, 'disabled:cursor-not-allowed disabled:opacity-45')}
    >
      <RowContent {...content} labelTone={danger ? 'danger' : 'fg'} chevron={chevron} />
    </button>
  )
}

/** Rând doar de citit (ex. emailul contului). */
export function InfoRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex min-h-[60px] flex-col justify-center gap-0.5 px-3.5 py-2">
      <span className={cn('text-fg-muted', kitText.helper)}>{label}</span>
      <span className={cn('break-all font-semibold text-fg', kitText.base)}>{value}</span>
    </div>
  )
}

/** Cardul simplu cu margini (ex. „Datele tale”, „Locul fermei pe hartă”). */
export function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-3 rounded-box border border-border bg-surface p-3.5', className)}>{children}</div>
}
