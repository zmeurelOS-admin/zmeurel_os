'use client'

import { AlertCircle } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

interface ConfigurareSezonBannerProps {
  an: number
  configurareSezon: ConfigurareSezon | null
  grupBiologic: GrupBiologic | null
  onConfigure: () => void
}

export function ConfigurareSezonBanner({
  an,
  configurareSezon,
  grupBiologic,
  onConfigure,
}: ConfigurareSezonBannerProps) {
  if (grupBiologic !== 'rubus' || configurareSezon?.sistem_conducere) {
    return null
  }

  return (
    <AppCard className="rounded-2xl bg-[color:color-mix(in_srgb,var(--status-warning-bg)_70%,var(--surface-card))] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--status-warning-border)_18%,var(--surface-card))] text-[var(--status-warning-text)]">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base text-[var(--text-primary)] [font-weight:700]">
            Configurează sistemul de conducere pentru {an}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Activează profilul potrivit pentru rubus ca să afișăm stadiile și regulile corecte în acest sezon.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" className="bg-[var(--agri-primary)] text-white" onClick={onConfigure}>
              Configurează
            </Button>
          </div>
        </div>
      </div>
    </AppCard>
  )
}

