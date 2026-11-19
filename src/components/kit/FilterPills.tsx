'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export interface FilterPillOption<T extends string = string> {
  value: T
  label: ReactNode
  /** Contor afișat după etichetă. */
  count?: number
  icon?: ReactNode
}

interface FilterPillsBaseProps<T extends string> {
  options: ReadonlyArray<FilterPillOption<T>>
  /** Ce filtrează pastilele (ex. „Filtrează după sursa comenzii”). */
  'aria-label': string
  /** Pastilele trec pe rândul următor în loc să se deruleze orizontal. */
  wrap?: boolean
  className?: string
}

interface FilterPillsSingleProps<T extends string> extends FilterPillsBaseProps<T> {
  multiple?: false
  value: T
  onValueChange: (value: T) => void
}

interface FilterPillsMultipleProps<T extends string> extends FilterPillsBaseProps<T> {
  multiple: true
  value: readonly T[]
  onValueChange: (value: T[]) => void
}

export type FilterPillsProps<T extends string = string> = FilterPillsSingleProps<T> | FilterPillsMultipleProps<T>

/** Pastile de filtru: derulare orizontală (implicit) sau pe rânduri. Ținta are 48 px. */
export function FilterPills<T extends string = string>(props: FilterPillsProps<T>) {
  const { options, wrap = false, className } = props

  const isOn = (value: T) => (props.multiple ? props.value.includes(value) : props.value === value)

  const handleClick = (value: T) => {
    if (props.multiple) {
      props.onValueChange(
        props.value.includes(value) ? props.value.filter((item) => item !== value) : [...props.value, value],
      )
    } else {
      props.onValueChange(value)
    }
  }

  return (
    <div
      role="group"
      aria-label={props['aria-label']}
      className={cn(
        'flex gap-2',
        wrap ? 'flex-wrap' : 'overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map((option) => {
        const on = isOn(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => handleClick(option.value)}
            className={cn(
              'inline-flex h-touch shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 font-bold [&_svg]:size-4',
              kitText.secondary,
              kitFocus,
              on ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface text-fg',
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined ? <span className="font-semibold opacity-75">{option.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
