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
      'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800 focus-visible:ring-emerald-300',
  },
  {
    href: '/activitati-agricole',
    label: 'Adaugă activitate',
    icon: ClipboardPlus,
    className:
      'bg-blue-700 text-white border-blue-800 hover:bg-blue-800 focus-visible:ring-blue-300',
  },
  {
    href: '/vanzari',
    label: 'Înregistrează vânzare',
    icon: WalletCards,
    className:
      'bg-amber-500 text-slate-950 border-amber-600 hover:bg-amber-400 focus-visible:ring-amber-300',
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
