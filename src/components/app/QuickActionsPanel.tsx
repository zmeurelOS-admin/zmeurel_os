'use client'

import Link from 'next/link'
import { ClipboardPlus, ShoppingBasket, WalletCards } from 'lucide-react'

import { ActionCard } from '@/components/ui/app-card'

const quickActions = [
  {
    href: '/recoltari',
    label: 'Adaugă recoltare',
    icon: ShoppingBasket,
    className:
      'bg-[var(--cta-recoltare-bg)] text-white border-[var(--cta-recoltare-border)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--cta-recoltare-bg)]/50',
  },
  {
    href: '/activitati-agricole',
    label: 'Adaugă activitate',
    icon: ClipboardPlus,
    className:
      'bg-[var(--cta-activitate-bg)] text-white border-[var(--cta-activitate-border)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--cta-activitate-bg)]/50',
  },
  {
    href: '/vanzari',
    label: 'Înregistrează vânzare',
    icon: WalletCards,
    className:
      'bg-[var(--cta-vanzare-bg)] text-[var(--cta-vanzare-text)] border-[var(--cta-vanzare-border)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--cta-vanzare-ring)]/50',
  },
] as const

export function QuickActionsPanel() {
  return (
    <ActionCard>
      <div className="mb-3">
        <h2 className="text-base font-bold text-[var(--agri-text)]">Acțiuni rapide</h2>
        <p className="text-sm text-[var(--agri-text-muted)]">Acces rapid pentru operațiuni din teren</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 sm:justify-center ${action.className}`}
          >
            <action.icon className="h-5 w-5 shrink-0" />
            <span>{action.label}</span>
          </Link>
        ))}
      </div>
    </ActionCard>
  )
}
