'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

import { clampNumber, formatDecimal, parseDecimal, sanitizeDecimalInput, stepValue } from './lib/number'
import { kitFocus, kitText } from './text'

export interface NumberStepperProps {
  /** `null` = necompletat. */
  value: number | null
  onChange: (value: number | null) => void
  /** `lg` = cifra mare, pe ecran dedicat; `compact` = pe un rând. */
  size?: 'lg' | 'compact'
  /** Pasul butoanelor − și +. Implicit 1. */
  step?: number
  /** Pași rapizi, afișați sub câmp la mărimea `lg` (ex. `[-10, -5, 5, 10]`). */
  quickSteps?: readonly number[]
  min?: number
  max?: number
  /** Câte zecimale se pot scrie (0–2). Implicit 0. */
  decimals?: number
  /** Unitatea afișată lângă valoare (ex. „kg”, „buc”, „lei”). */
  unit?: string
  /** Numele câmpului pentru cititoarele de ecran (ex. „Cantitate”). */
  label: string
  disabled?: boolean
  className?: string
}

const formatStep = (value: number) => formatDecimal(Math.abs(value))

/** Număr cu butoane − și +. Se poate și tasta direct (virgulă zecimală). */
export function NumberStepper({
  value,
  onChange,
  size = 'lg',
  step = 1,
  quickSteps,
  min,
  max,
  decimals = 0,
  unit,
  label,
  disabled = false,
  className,
}: NumberStepperProps) {
  // Textul tastat se păstrează cât timp corespunde valorii (ex. „12,” rămâne „12,” deși valoarea e 12).
  const [draft, setDraft] = useState<{ text: string; forValue: number | null } | null>(null)
  const text = draft && draft.forValue === value ? draft.text : formatDecimal(value, decimals)

  const current = value ?? 0
  const atMin = min !== undefined && current <= min
  const atMax = max !== undefined && current >= max
  const unitSuffix = unit ? ` ${unit}` : ''

  const change = (delta: number) => onChange(stepValue(value, delta, { min, max, decimals }))

  const handleInput = (raw: string) => {
    const nextText = sanitizeDecimalInput(raw, decimals)
    const parsed = parseDecimal(nextText)
    setDraft({ text: nextText, forValue: parsed })
    onChange(parsed)
  }

  const handleBlur = () => {
    setDraft(null)
    if (value !== null) {
      const clamped = clampNumber(value, min, max)
      if (clamped !== value) onChange(clamped)
    }
  }

  const input = (
    <input
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      aria-label={unit ? `${label}, ${unit}` : label}
      value={text}
      disabled={disabled}
      onChange={(event) => handleInput(event.target.value)}
      onBlur={handleBlur}
      className={
        size === 'lg'
          ? cn('h-20 w-full bg-transparent text-center font-extrabold text-fg outline-none disabled:opacity-45', kitText.figure)
          : cn(
              'h-touch w-20 rounded-control border-2 border-border-strong bg-surface text-center font-bold text-fg outline-none focus:border-primary disabled:opacity-45',
              kitText.card,
            )
      }
    />
  )

  if (size === 'compact') {
    const buttonClass = cn(
      'flex size-touch shrink-0 items-center justify-center rounded-control bg-surface-muted text-fg active:bg-border-strong disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-5',
      kitFocus,
    )
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button
          type="button"
          aria-label={`Scade ${formatStep(step)}${unitSuffix}: ${label}`}
          disabled={disabled || atMin}
          onClick={() => change(-step)}
          className={buttonClass}
        >
          <Minus aria-hidden strokeWidth={2.6} />
        </button>
        {input}
        <button
          type="button"
          aria-label={`Adaugă ${formatStep(step)}${unitSuffix}: ${label}`}
          disabled={disabled || atMax}
          onClick={() => change(step)}
          className={buttonClass}
        >
          <Plus aria-hidden strokeWidth={2.6} />
        </button>
        {unit ? <span className={cn('font-medium text-fg-muted', kitText.secondary)}>{unit}</span> : null}
      </div>
    )
  }

  const roundButton = cn(
    'flex size-16 shrink-0 items-center justify-center rounded-full text-fg active:opacity-80 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-8',
    kitFocus,
  )

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Scade ${formatStep(step)}${unitSuffix}: ${label}`}
          disabled={disabled || atMin}
          onClick={() => change(-step)}
          className={cn(roundButton, 'bg-surface-muted')}
        >
          <Minus aria-hidden strokeWidth={2.6} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          {input}
          {unit ? <span className={cn('font-medium text-fg-muted', kitText.base)}>{unit}</span> : null}
        </div>
        <button
          type="button"
          aria-label={`Adaugă ${formatStep(step)}${unitSuffix}: ${label}`}
          disabled={disabled || atMax}
          onClick={() => change(step)}
          className={cn(roundButton, 'bg-primary-soft')}
        >
          <Plus aria-hidden strokeWidth={2.6} />
        </button>
      </div>
      {quickSteps?.length ? (
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(quickSteps.length, 4)}, minmax(0, 1fr))` }}
        >
          {quickSteps.map((delta) => (
            <button
              key={delta}
              type="button"
              aria-label={`${delta > 0 ? 'Adaugă' : 'Scade'} ${formatStep(delta)}${unitSuffix}: ${label}`}
              disabled={disabled || (delta > 0 ? atMax : atMin)}
              onClick={() => change(delta)}
              className={cn(
                'h-touch-lg rounded-box font-extrabold text-fg active:opacity-80 disabled:cursor-not-allowed disabled:opacity-45',
                kitText.base,
                kitFocus,
                delta > 0 ? 'bg-primary-soft' : 'bg-surface-muted',
              )}
            >
              {delta > 0 ? `+${formatStep(delta)}` : `−${formatStep(delta)}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
