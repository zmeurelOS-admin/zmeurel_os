'use client'

import type { ParcelaScop } from '@/lib/parcele/dashboard-relevance'
import { cn } from '@/lib/utils'

function ToggleSwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
        checked
          ? 'border-primary bg-primary'
          : 'border-[var(--border-default)] bg-[var(--surface-card-muted)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export function ParcelUsageToggleCard({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[16px] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2.5 shadow-[var(--shadow-soft)]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">{description}</p>
      </div>
      <ToggleSwitch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

type ParcelUsageFieldsBase = {
  scop: ParcelaScop
  apareInDashboard: boolean
  contribuieLaProductie: boolean
  onApareChange: (v: boolean) => void
  onContribuieChange: (v: boolean) => void
  disableCommercialToggles?: boolean
  className?: string
}

export function ParcelUsageFields({
  scop,
  apareInDashboard,
  contribuieLaProductie,
  onApareChange,
  onContribuieChange,
  disableCommercialToggles = false,
  className,
}: ParcelUsageFieldsBase) {
  const togglesOff = disableCommercialToggles && scop !== 'comercial'

  return (
    <div className={cn('space-y-2.5', className)}>
      <ParcelUsageToggleCard
        label="Afișează în dashboard"
        description="Arată pe pagina principală"
        checked={apareInDashboard}
        disabled={togglesOff}
        onCheckedChange={onApareChange}
      />
      <ParcelUsageToggleCard
        label="Contribuie la producție și vânzări"
        description="Include în rapoarte comerciale"
        checked={contribuieLaProductie}
        disabled={togglesOff}
        onCheckedChange={onContribuieChange}
      />
      {togglesOff ? (
        <p className="text-xs text-[var(--text-tertiary)]">
          Pentru scopuri necomerciale, opțiunile comerciale rămân dezactivate.
        </p>
      ) : null}
    </div>
  )
}

export function applyScopDefaults(scop: ParcelaScop): {
  apare_in_dashboard: boolean
  contribuie_la_productie: boolean
} {
  if (scop === 'comercial') {
    return { apare_in_dashboard: true, contribuie_la_productie: true }
  }
  return { apare_in_dashboard: false, contribuie_la_productie: false }
}
