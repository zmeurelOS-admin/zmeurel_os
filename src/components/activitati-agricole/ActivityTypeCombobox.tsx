'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

import { Label } from '@/components/ui/label'
import type { ActivityOption } from '@/lib/activitati/activity-options'

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
}

export function ActivityTypeCombobox({
  id,
  label,
  placeholder = 'Tip operațiune',
  options,
  value,
  error,
  onChange,
}: ActivityTypeComboboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )
  const showSearch = options.length > 6
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
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

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

  return (
    <div className="space-y-2" ref={rootRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() =>
            setOpen((current) => {
              const nextOpen = !current
              if (nextOpen) {
                setQuery(selectedOption ? '' : value)
              }
              return nextOpen
            })
          }
          className="agri-control flex h-12 w-full items-center justify-between rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 text-left text-base text-[var(--agri-text)] shadow-sm"
        >
          <span className={selectedOption || value ? 'truncate' : 'truncate text-[var(--agri-text-muted)]'}>
            {selectedOption?.label || value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--agri-text-muted)]" />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-lg">
            {showSearch ? (
              <div className="border-b border-[var(--agri-border)] p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--agri-text-muted)]" />
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && customValue && !hasExactMatch) {
                        event.preventDefault()
                        handleSelect(customValue)
                      }
                    }}
                    placeholder="Caută sau scrie o activitate..."
                    className="flex h-10 w-full rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface)] pl-9 pr-3 text-sm text-[var(--agri-text)] outline-none ring-0 placeholder:text-[var(--agri-text-muted)]"
                  />
                </div>
              </div>
            ) : null}

            <div className="max-h-64 overflow-y-auto p-1">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value
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
                    <span>{option.label}</span>
                    {isSelected ? <Check className="h-4 w-4 text-[var(--agri-primary)]" /> : null}
                  </button>
                )
              })}

              {showSearch && customValue && !hasExactMatch ? (
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    handleSelect(customValue)
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
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
