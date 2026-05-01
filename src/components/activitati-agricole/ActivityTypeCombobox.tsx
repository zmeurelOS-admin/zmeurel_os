'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isTipActivitateDeprecata } from '@/lib/activitati/activity-options'
import type { ActivityOption } from '@/lib/activitati/activity-options'
import { cn } from '@/lib/utils'

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

interface ActivityTypeComboboxProps {
  id: string
  label: string
  placeholder?: string
  options: ActivityOption[]
  value: string
  error?: string
  onChange: (value: string) => void
  showSearchThreshold?: number
  triggerClassName?: string
  menuClassName?: string
  listClassName?: string
  getOptionLeadingIcon?: (option: ActivityOption) => ReactNode
  getOptionDisplayLabel?: (option: ActivityOption) => string
}

export function ActivityTypeCombobox({
  id,
  label,
  placeholder = 'Tip operațiune',
  options,
  value,
  error,
  onChange,
  showSearchThreshold = 6,
  triggerClassName,
  menuClassName,
  listClassName,
  getOptionLeadingIcon,
  getOptionDisplayLabel,
}: ActivityTypeComboboxProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [deprecatedMessage, setDeprecatedMessage] = useState<string | null>(null)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )
  const selectedOptionIcon = useMemo(
    () => (selectedOption && getOptionLeadingIcon ? getOptionLeadingIcon(selectedOption) : null),
    [getOptionLeadingIcon, selectedOption]
  )
  const showSearch = options.length > showSearchThreshold
  const effectiveQuery = showSearch ? query : ''
  const filteredOptions = useMemo(() => {
    if (!effectiveQuery.trim()) return options
    const needle = normalizeText(effectiveQuery)
    return options.filter((option) => normalizeText(option.label).includes(needle))
  }, [effectiveQuery, options])
  const hasExactMatch = useMemo(() => {
    const needle = normalizeText(query)
    if (!needle) return false
    return options.some(
      (option) =>
        normalizeText(option.label) === needle || normalizeText(option.value) === needle
    )
  }, [options, query])
  const customValue = query.trim()

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
    setDeprecatedMessage(null)
  }

  const handleCustomValueSelect = (inputValue: string) => {
    if (isTipActivitateDeprecata(inputValue)) {
      setDeprecatedMessage('Acest tip se înregistrează în modulul Protecție & Nutriție.')
      return
    }

    handleSelect(inputValue)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) {
            setQuery(selectedOption ? '' : value)
            return
          }
          setDeprecatedMessage(null)
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(
              'agri-control flex h-12 w-full items-center justify-between rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 text-left text-base text-[var(--agri-text)] shadow-sm',
              triggerClassName
            )}
          >
            <span
              className={cn(
                'flex min-w-0 items-center gap-2',
                selectedOption || value ? 'text-[var(--agri-text)]' : 'text-[var(--agri-text-muted)]'
              )}
            >
              {selectedOptionIcon ? (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]">
                  {selectedOptionIcon}
                </span>
              ) : null}
              <span className="truncate">
                {selectedOption
                  ? getOptionDisplayLabel?.(selectedOption) ?? selectedOption.label
                  : value || placeholder}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--agri-text-muted)]" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-0 shadow-lg',
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
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setQuery(nextValue)
                      if (!nextValue.trim() || !isTipActivitateDeprecata(nextValue)) {
                        setDeprecatedMessage(null)
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && customValue && !hasExactMatch) {
                        event.preventDefault()
                        handleCustomValueSelect(customValue)
                      }
                    }}
                    placeholder="Caută sau scrie o activitate..."
                    className="flex h-10 w-full rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface)] pl-9 pr-3 text-sm text-[var(--agri-text)] outline-none ring-0 placeholder:text-[var(--agri-text-muted)]"
                  />
                </div>
                {deprecatedMessage ? (
                  <div className="mt-2 flex items-start gap-2 text-sm text-amber-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{deprecatedMessage}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={cn('max-h-64 overflow-y-auto p-1', listClassName)}>
              {filteredOptions.map((option) => {
                const isSelected = option.value === value
                const optionIcon = getOptionLeadingIcon?.(option) ?? null
                return (
                  <button
                    key={option.value}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleSelect(option.value)
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-[var(--agri-text)] transition-colors hover:bg-[var(--agri-surface-muted)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {optionIcon ? (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--surface-divider)] bg-[var(--agri-surface-muted)]">
                          {optionIcon}
                        </span>
                      ) : null}
                      <span className="truncate">{getOptionDisplayLabel?.(option) ?? option.label}</span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 text-[var(--agri-primary)]" /> : null}
                  </button>
                )
              })}

              {showSearch && customValue && !hasExactMatch ? (
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    handleCustomValueSelect(customValue)
                  }}
                  className="flex w-full items-center justify-between rounded-lg border-t border-[var(--agri-border)] px-3 py-2 text-left text-sm font-medium text-[var(--agri-primary)] transition-colors hover:bg-[var(--agri-surface-muted)]"
                >
                  <span>{`Folosește "${customValue}"`}</span>
                  <Check className="h-4 w-4" />
                </button>
              ) : null}

              {filteredOptions.length === 0 && !(showSearch && customValue && !hasExactMatch) ? (
                <p className="px-3 py-2 text-sm text-[var(--agri-text-muted)]">Nicio activitate găsită</p>
              ) : null}
            </div>
        </PopoverContent>
      </Popover>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
