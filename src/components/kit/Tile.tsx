'use client'

import { createContext, useContext, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

// ─── Logica de selecție (pură, testată) ────────────────────────────────────────

/** Alegere unică: placa apăsată înlocuiește selecția; aceeași placă o scoate doar dacă `allowDeselect`. */
export function nextSingleTileValue(current: string | null, value: string, allowDeselect = false): string | null {
  if (current === value) return allowDeselect ? null : current
  return value
}

/** Alegere multiplă: placa apăsată intră în listă sau iese din ea. */
export function nextMultipleTileValue(current: readonly string[], value: string): string[] {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
}

// ─── Grup ──────────────────────────────────────────────────────────────────────

interface TileGroupContextValue {
  type: 'single' | 'multiple'
  isSelected: (value: string) => boolean
  hasSelection: boolean
  toggle: (value: string) => void
}

const TileGroupContext = createContext<TileGroupContextValue | null>(null)

interface TileGroupBaseProps {
  /** Numărul de coloane ale grilei. Implicit 2. */
  columns?: 2 | 3 | 4
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
  children: ReactNode
}

interface TileGroupSingleProps extends TileGroupBaseProps {
  type: 'single'
  /** `null` = nimic ales încă. */
  value: string | null
  onValueChange: (value: string | null) => void
  /** A doua apăsare pe placa aleasă o deselectează. */
  allowDeselect?: boolean
}

interface TileGroupMultipleProps extends TileGroupBaseProps {
  type: 'multiple'
  value: readonly string[]
  onValueChange: (value: string[]) => void
}

export type TileGroupProps = TileGroupSingleProps | TileGroupMultipleProps

const COLUMN_CLASS: Record<NonNullable<TileGroupBaseProps['columns']>, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown'])
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp'])

export function TileGroup(props: TileGroupProps) {
  const { columns = 2, className, children } = props

  const context: TileGroupContextValue =
    props.type === 'single'
      ? {
          type: 'single',
          isSelected: (value) => props.value === value,
          hasSelection: props.value !== null,
          toggle: (value) => {
            const next = nextSingleTileValue(props.value, value, props.allowDeselect)
            if (next !== props.value) props.onValueChange(next)
          },
        }
      : {
          type: 'multiple',
          isSelected: (value) => props.value.includes(value),
          hasSelection: props.value.length > 0,
          toggle: (value) => props.onValueChange(nextMultipleTileValue(props.value, value)),
        }

  // La alegere unică, săgețile mută focusul și selecția, ca la butoanele radio.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.type !== 'single') return
    const forward = NEXT_KEYS.has(event.key)
    if (!forward && !PREVIOUS_KEYS.has(event.key)) return
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'),
    )
    const index = radios.findIndex((radio) => radio === document.activeElement)
    if (index < 0) return
    event.preventDefault()
    const target = radios[(index + (forward ? 1 : -1) + radios.length) % radios.length]
    target.focus()
    target.click()
  }

  return (
    <TileGroupContext.Provider value={context}>
      <div
        role={props.type === 'single' ? 'radiogroup' : 'group'}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        onKeyDown={handleKeyDown}
        className={cn('grid gap-2.5', COLUMN_CLASS[columns], className)}
      >
        {children}
      </div>
    </TileGroupContext.Provider>
  )
}

// ─── Placă ─────────────────────────────────────────────────────────────────────

export interface TileProps {
  /** Valoarea plăcii în grup. Fără `value`, placa e una de acțiune (ex. „Culegător nou”). */
  value?: string
  title: ReactNode
  subtitle?: ReactNode
  /** Insignă pe ultimul rând al plăcii (ex. „✓ azi 35 kg”). */
  badge?: ReactNode
  /** Inițială sau iconiță într-un cerc, deasupra titlului. */
  leading?: ReactNode
  /** `lg` = placă înaltă, pe mai multe rânduri; `sm` = placă scurtă, pe un rând (cantitate, dată). */
  size?: 'lg' | 'sm'
  /** Contur punctat, pentru „adaugă / altul”. */
  dashed?: boolean
  disabled?: boolean
  /** Pentru plăcile de acțiune (fără `value`). */
  onClick?: () => void
  'aria-label'?: string
  className?: string
}

export function Tile({
  value,
  title,
  subtitle,
  badge,
  leading,
  size = 'lg',
  dashed = false,
  disabled = false,
  onClick,
  className,
  'aria-label': ariaLabel,
}: TileProps) {
  const group = useContext(TileGroupContext)
  const selectable = group !== null && value !== undefined
  const selected = selectable && group.isSelected(value)
  const isRadio = selectable && group.type === 'single'

  const handleClick = () => {
    if (selectable) group.toggle(value)
    onClick?.()
  }

  return (
    <button
      type="button"
      role={selectable ? (isRadio ? 'radio' : 'checkbox') : undefined}
      aria-checked={selectable ? selected : undefined}
      aria-label={ariaLabel}
      // Radio: doar placa aleasă intră în ordinea de tab; dacă nu e niciuna aleasă, toate.
      tabIndex={isRadio && group.hasSelection && !selected ? -1 : undefined}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'relative flex w-full rounded-box border-2 transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        kitFocus,
        size === 'lg'
          ? 'min-h-[88px] flex-col items-start gap-2 p-4 text-left'
          : 'min-h-touch-lg flex-col items-center justify-center gap-0.5 px-2 py-2 text-center',
        selected
          ? 'border-primary bg-primary text-primary-contrast'
          : dashed
            ? 'border-dashed border-border-strong bg-surface text-fg-muted'
            : 'border-border bg-surface text-fg',
        className,
      )}
    >
      {leading ? (
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full font-extrabold [&_svg]:size-5',
            kitText.base,
            selected ? 'bg-primary-contrast/20' : 'bg-surface-muted text-fg',
          )}
          aria-hidden
        >
          {leading}
        </span>
      ) : null}
      <span className={cn('flex min-w-0 max-w-full flex-col', size === 'sm' && 'items-center')}>
        <span className={cn('max-w-full break-words font-bold', kitText.base)}>{title}</span>
        {subtitle ? (
          <span className={cn('max-w-full font-medium', kitText.secondary, selected ? 'opacity-90' : 'text-fg-muted')}>
            {subtitle}
          </span>
        ) : null}
      </span>
      {badge ? (
        <span
          className={cn(
            'mt-auto inline-flex min-h-7 max-w-full items-center rounded-control bg-success-bg px-2 font-bold text-success-text',
            kitText.secondary,
          )}
        >
          <span className="break-words">{badge}</span>
        </span>
      ) : null}
    </button>
  )
}
