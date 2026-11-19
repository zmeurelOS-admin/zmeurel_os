'use client'

import { useEffect } from 'react'
import { Delete } from 'lucide-react'

import { cn } from '@/lib/utils'

import { KEYPAD_KEYS, keypadKeyFromKeyboard, type KeypadKey } from './lib/keypad'
import { kitFocus, kitText } from './text'

export interface NumericKeypadProps {
  onKey: (key: KeypadKey) => void
  disabled?: boolean
  /** Fără virgulă (numere întregi). */
  integerOnly?: boolean
  /** Ascultă și tastatura fizică (cifre, virgulă sau punct, Backspace). Implicit da. */
  listenToKeyboard?: boolean
  /** Numele grupului de taste pentru cititoarele de ecran. */
  'aria-label'?: string
  className?: string
}

const KEY_LABEL: Partial<Record<KeypadKey, string>> = {
  ',': 'virgulă',
  backspace: 'Șterge ultima cifră',
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Tastatură numerică mare, în aplicație: 1–9, virgulă, 0, ștergere. Scrie în câmpul activ (`useKeypadFields`).
 * Tastele au 60 px, fix, ca să rămână peste 54 px și la densitatea compactă.
 */
export function NumericKeypad({
  onKey,
  disabled = false,
  integerOnly = false,
  listenToKeyboard = true,
  className,
  'aria-label': ariaLabel = 'Tastatură numerică',
}: NumericKeypadProps) {
  useEffect(() => {
    if (!listenToKeyboard || disabled) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return
      const key = keypadKeyFromKeyboard(event.key)
      if (!key || (integerOnly && key === ',')) return
      event.preventDefault()
      onKey(key)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [listenToKeyboard, disabled, integerOnly, onKey])

  return (
    <div role="group" aria-label={ariaLabel} className={cn('grid grid-cols-3 gap-2', className)}>
      {KEYPAD_KEYS.map((key) => {
        if (integerOnly && key === ',') return <span key={key} aria-hidden />
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={KEY_LABEL[key]}
            onClick={() => onKey(key)}
            className={cn(
              'flex h-15 select-none items-center justify-center rounded-box bg-surface-muted font-bold text-fg transition-colors active:bg-border-strong disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-7',
              kitText.screen,
              kitFocus,
            )}
          >
            {key === 'backspace' ? <Delete aria-hidden /> : key}
          </button>
        )
      })}
    </div>
  )
}
