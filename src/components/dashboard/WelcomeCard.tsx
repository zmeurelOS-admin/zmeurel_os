'use client'

import { X } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'

interface WelcomeCardProps {
  onAddTerrain: () => void
  onDismiss: () => void
}

export function WelcomeCard({ onAddTerrain, onDismiss }: WelcomeCardProps) {
  return (
    <AppCard className="relative px-5 py-6 text-center sm:px-6 sm:py-7">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 text-[var(--agri-text-muted)] sm:right-3 sm:top-3"
        aria-label="Închide ghidul"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="mb-4 text-[2.5rem] leading-none" aria-hidden>
        🌱
      </div>
      <h2 className="text-lg leading-tight tracking-[-0.02em] text-[var(--agri-text)] [font-weight:650] sm:text-xl">
        Adaugă sau marchează un teren pentru producție comercială.
      </h2>
      <Button
        type="button"
        className="agri-cta mt-6 w-full min-h-12 bg-[var(--agri-primary)] text-white"
        onClick={onAddTerrain}
      >
        Configurează terenurile
      </Button>
      <p className="mt-3 text-xs leading-relaxed text-[var(--agri-text-muted)]">
        Dashboard-ul principal arată implicit doar terenurile comerciale relevante pentru producție și vânzări.
      </p>
      <Button
        type="button"
        variant="link"
        className="mt-2 h-auto min-h-0 p-0 text-xs font-medium text-[var(--agri-text-muted)]"
        onClick={onDismiss}
      >
        Nu am nevoie de ghid
      </Button>
    </AppCard>
  )
}
