'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type AppSelectOption = {
  value: string
  label: string
  emoji?: string
  disabled?: boolean
}

export type AppSelectGroup = {
  label: string
  options: AppSelectOption[]
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function flattenOptions(options: AppSelectOption[], groups?: AppSelectGroup[]): AppSelectOption[] {
  if (groups?.length) {
    return groups.flatMap((group) => group.options)
  }
  return options
}

export interface AppSelectProps {
  id: string
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  options?: AppSelectOption[]
  groups?: AppSelectGroup[]
  error?: string
  disabled?: boolean
  showSearchThreshold?: number
  searchPlaceholder?: string
  emptyMessage?: string
  triggerClassName?: string
  menuClassName?: string
  listClassName?: string
  getOptionLeadingIcon?: (option: AppSelectOption) => ReactNode
  getOptionDisplayLabel?: (option: AppSelectOption) => string
}

export function AppSelect({
  id,
  label,
  placeholder = 'Selectează',
  value,
  onChange,
  options = [],
  groups,
  error,
  disabled = false,
  showSearchThreshold = 8,
  searchPlaceholder = 'Caută...',
  emptyMessage = 'Nicio opțiune găsită',
  triggerClassName,
  menuClassName,
  listClassName,
  getOptionLeadingIcon,
  getOptionDisplayLabel,
}: AppSelectProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const allOptions = useMemo(() => flattenOptions(options, groups), [groups, options])

  const selectedOption = useMemo(
    () => allOptions.find((option) => option.value === value) ?? null,
    [allOptions, value]
  )

  const selectedLeading = useMemo(() => {
    if (!selectedOption) return null
    if (getOptionLeadingIcon) return getOptionLeadingIcon(selectedOption)
    if (selectedOption.emoji) {
      return <span aria-hidden>{selectedOption.emoji}</span>
    }
    return null
  }, [getOptionLeadingIcon, selectedOption])

  const showSearch = allOptions.length > showSearchThreshold
  const effectiveQuery = showSearch ? query : ''

  const filteredValueSet = useMemo(() => {
    if (!effectiveQuery.trim()) return null
    const needle = normalizeText(effectiveQuery)
    return new Set(
      allOptions
        .filter((option) => normalizeText(option.label).includes(needle))
        .map((option) => option.value)
    )
  }, [allOptions, effectiveQuery])

  useEffect(() => {
    if (!open || !showSearch) return
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, showSearch])

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  const renderOptionLeading = (option: AppSelectOption) => {
    if (getOptionLeadingIcon) {
      const icon = getOptionLeadingIcon(option)
      if (icon) {
        return (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]">
            {icon}
          </span>
        )
      }
    }
    if (option.emoji) {
      return (
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)] text-sm"
          aria-hidden
        >
          {option.emoji}
        </span>
      )
    }
    return null
  }

  const renderOptionButton = (option: AppSelectOption) => {
    if (filteredValueSet && !filteredValueSet.has(option.value)) return null
    const isSelected = option.value === value
    return (
      <button
        key={`${option.value}-${option.label}`}
        type="button"
        disabled={option.disabled}
        onMouseDown={(event) => {
          event.preventDefault()
          if (!option.disabled) handleSelect(option.value)
        }}
        className={cn(
          'flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-[var(--agri-text)] transition-colors hover:bg-[var(--agri-surface-muted)]',
          option.disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {renderOptionLeading(option)}
          <span className="truncate">{getOptionDisplayLabel?.(option) ?? option.label}</span>
        </span>
        {isSelected ? <Check className="h-4 w-4 shrink-0 text-[var(--agri-primary)]" aria-hidden /> : null}
      </button>
    )
  }

  const triggerLabel = selectedOption
    ? getOptionDisplayLabel?.(selectedOption) ?? selectedOption.label
    : value || placeholder

  const listContent = groups?.length ? (
    groups.map((group) => {
      const visibleOptions = group.options.filter(
        (option) => !filteredValueSet || filteredValueSet.has(option.value)
      )
      if (visibleOptions.length === 0) return null
      return (
        <div key={group.label} className="py-1">
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">
            {group.label}
          </p>
          {group.options.map((option) => renderOptionButton(option))}
        </div>
      )
    })
  ) : (
    options.map((option) => renderOptionButton(option))
  )

  const hasVisibleOptions = filteredValueSet
    ? allOptions.some((option) => filteredValueSet.has(option.value))
    : allOptions.length > 0

  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (disabled) return
          setOpen(nextOpen)
          if (nextOpen) {
            setQuery(selectedOption ? '' : value)
            return
          }
          setQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'agri-control flex h-12 w-full items-center justify-between rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 text-left text-base text-[var(--agri-text)] shadow-sm',
              disabled && 'cursor-not-allowed opacity-60',
              triggerClassName
            )}
          >
            <span
              className={cn(
                'flex min-w-0 items-center gap-2',
                selectedOption || value ? 'text-[var(--agri-text)]' : 'text-[var(--agri-text-muted)]'
              )}
            >
              {selectedLeading ? (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]">
                  {selectedLeading}
                </span>
              ) : null}
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'z-[1105] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-0 shadow-lg',
            menuClassName
          )}
        >
          {showSearch ? (
            <div className="border-b border-[var(--agri-border)] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--agri-text-muted)]" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="flex h-10 w-full rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface)] pl-9 pr-3 text-sm text-[var(--agri-text)] outline-none ring-0 placeholder:text-[var(--agri-text-muted)]"
                />
              </div>
            </div>
          ) : null}

          <div className={cn('max-h-64 overflow-y-auto p-1', listClassName)} role="listbox" aria-label={label ?? placeholder}>
            {listContent}
            {!hasVisibleOptions ? (
              <p className="px-3 py-2 text-sm text-[var(--agri-text-muted)]">{emptyMessage}</p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
