'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'

import {
  keypadValueFrom,
  parseKeypadValue,
  pressKeypadField,
  type KeypadKey,
  type KeypadOptions,
} from './lib/keypad'
import { kitFocus, kitText } from './text'

// ─── Starea câmpurilor scrise cu tastatura din aplicație ───────────────────────

export interface UseKeypadFieldsOptions<K extends string> extends KeypadOptions {
  /** Câmpurile care se pot scrie (ex. `['cal1', 'cal2']`). Primul e activ la pornire. */
  fields: readonly K[]
}

function emptyValues<K extends string>(fields: readonly K[]): Record<K, string> {
  return Object.fromEntries(fields.map((field) => [field, ''])) as Record<K, string>
}

/**
 * Ține valorile (text, cu virgulă) și câmpul activ. Toate câmpurile pornesc GOALE, fără valoare propusă.
 * `press` se leagă de `NumericKeypad`, `values` și `active` de `KgField`.
 * `setValue` e pentru o valoare care există deja (înregistrarea editată, o cantitate dictată), nu pentru propuneri.
 */
export function useKeypadFields<K extends string>({ fields, maxDecimals, maxIntegerDigits }: UseKeypadFieldsOptions<K>) {
  const [values, setValues] = useState<Record<K, string>>(() => emptyValues(fields))
  const [active, setActive] = useState<K>(fields[0])

  const options: KeypadOptions = { maxDecimals, maxIntegerDigits }

  const press = (key: KeypadKey) => setValues((prev) => pressKeypadField(prev, active, key, options))

  /** Golește un câmp (ex. când „calitatea 2” e scoasă). */
  const clear = (field: K) => setValues((prev) => ({ ...prev, [field]: '' }))

  /** Pune într-un câmp o valoare venită din afară; trece prin aceleași limite ca tastele. Nevalid → câmp gol. */
  const setValue = (field: K, raw: number | string | null | undefined) =>
    setValues((prev) => ({ ...prev, [field]: keypadValueFrom(raw, options) }))

  const reset = () => {
    setValues(emptyValues(fields))
    setActive(fields[0])
  }

  const numbers = Object.fromEntries(fields.map((field) => [field, parseKeypadValue(values[field] ?? '')])) as Record<
    K,
    number | null
  >

  return { values, numbers, active, setActive, press, clear, setValue, reset }
}

// ─── Câmpul ────────────────────────────────────────────────────────────────────

export interface KgFieldProps {
  /** Numele câmpului (ex. „Calitatea 1”). Se afișează și se citește. */
  label: string
  /** Valoarea ca text, cu virgulă (din `useKeypadFields`). Text gol = necompletat. */
  value: string
  unit?: string
  /** Câmpul în care scrie tastatura. */
  active: boolean
  onActivate: () => void
  /** `hero` = cifra mare, pe ecran dedicat; `md` = pe un rând, lângă alte câmpuri. */
  size?: 'hero' | 'md'
  className?: string
}

/** Ce aude utilizatorul unui cititor de ecran: câmpul, valoarea și starea. */
export function kgFieldLabel(label: string, value: string, unit: string, active: boolean): string {
  const spoken = value ? `${value} ${unit}` : 'necompletat'
  return `${label}, ${spoken}${active ? ', activ' : ''}`
}

/**
 * Câmp de cantitate scris cu tastatura din aplicație. Nu e `<input>`, deci tastatura telefonului nu se deschide.
 * Pentru cititoarele de ecran e un buton apăsat / neapăsat, cu eticheta „câmp, valoare, stare”, iar valoarea
 * se anunță la fiecare schimbare (`aria-live` politicos).
 */
/**
 * Mărimea cifrelor la câmpul `md` (promptul 34, §9): o valoare lungă (846.488) nu iese din câmp într-o coloană
 * îngustă; cifrele se micșorează după câte caractere are valoarea.
 */
export function pasTextValoareMd(value: string): 'section' | 'card' | 'base' {
  const lungime = value.length
  if (lungime <= 6) return 'section'
  if (lungime <= 8) return 'card'
  return 'base'
}

export function KgField({ label, value, unit = 'kg', active, onActivate, size = 'hero', className }: KgFieldProps) {
  const empty = value === ''
  const hero = size === 'hero'

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-pressed={active}
        aria-label={kgFieldLabel(label, value, unit, active)}
        onClick={onActivate}
        className={cn(
          'flex w-full rounded-box border-2 bg-surface transition-[border-color,box-shadow]',
          kitFocus,
          hero ? 'flex-col items-center gap-1 px-4 py-4' : 'min-h-touch-lg flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2',
          active ? 'border-primary ring-[3px] ring-primary/20' : 'border-border',
        )}
      >
        <span className={cn('min-w-0 break-words font-semibold', hero ? kitText.secondary : kitText.base, active ? 'text-fg' : 'text-fg-muted')}>
          {label}
        </span>
        <span className="flex min-w-0 max-w-full flex-wrap items-baseline justify-end gap-x-2">
          <span
            className={cn(
              'flex min-w-0 items-center font-extrabold',
              hero ? kitText.figure : kitText[pasTextValoareMd(value)],
              hero && 'min-h-16',
              empty ? 'text-fg-muted' : 'text-fg',
            )}
          >
            {empty ? (active ? null : '—') : value}
            {active ? (
              <span aria-hidden className="ml-0.5 h-[0.8em] w-[3px] animate-pulse rounded-full bg-primary" />
            ) : null}
          </span>
          <span className={cn('font-bold text-fg-muted', hero ? kitText.section : kitText.base)}>{unit}</span>
        </span>
      </button>
      {/* Doar câmpul activ anunță: e singurul a cărui valoare se schimbă. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {active ? `${label}: ${empty ? 'necompletat' : `${value} ${unit}`}` : ''}
      </span>
    </div>
  )
}
