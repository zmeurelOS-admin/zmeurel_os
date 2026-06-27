'use client'

import type { ComandaPaymentStatus } from '@/lib/supabase/queries/comenzi'

interface PaymentStatusToggleProps {
  value: ComandaPaymentStatus
  onChange: (value: ComandaPaymentStatus) => void
  disabled?: boolean
}

const OPTIONS: Array<{ value: ComandaPaymentStatus; label: string }> = [
  { value: 'platit', label: 'Plătit' },
  { value: 'neplatit', label: 'Neplătit' },
]

export function PaymentStatusToggle({
  value,
  onChange,
  disabled = false,
}: PaymentStatusToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Statusul plății"
      className="grid grid-cols-2 rounded-xl bg-[var(--surface-card-muted)] p-1"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition active:scale-[0.985] disabled:opacity-50 ${
              selected
                ? option.value === 'platit'
                  ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] shadow-sm'
                  : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
