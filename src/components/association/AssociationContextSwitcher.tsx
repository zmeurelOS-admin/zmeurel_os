'use client'

import { ChevronRight } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const ASSOCIATION_BRAND = 'Gustă din Bucovina'

type AssociationContextSwitcherProps = {
  collapsed: boolean
}

export function AssociationContextSwitcher({ collapsed }: AssociationContextSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { farmName } = useDashboardAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const inAssociationWorkspace = pathname.startsWith('/asociatie')
  const farmLabel = farmName?.trim() || 'Ferma mea'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const goFarm = () => {
    setOpen(false)
    router.push('/dashboard')
  }

  const goAssoc = () => {
    setOpen(false)
    router.push('/asociatie')
  }

  const summaryEmoji = inAssociationWorkspace ? '🏛' : '🌱'
  const summaryLabel = inAssociationWorkspace ? ASSOCIATION_BRAND : farmLabel

  const triggerClasses = cn(
    'flex w-full items-center justify-between gap-2 rounded-[14px] px-[14px] py-[10px] text-left text-sm font-semibold transition-all duration-200 ease-out',
    'bg-[color:color-mix(in_srgb,var(--agri-primary)_7%,var(--surface-card))] text-[var(--text-primary)]',
    'hover:bg-[color:color-mix(in_srgb,var(--agri-primary)_11%,var(--surface-card))]',
    open &&
      'bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,var(--surface-card))] ring-1 ring-[color:color-mix(in_srgb,var(--agri-primary)_28%,transparent)]'
  )

  const menuItem = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 px-[14px] py-2.5 text-left text-sm font-medium text-[var(--text-primary)] transition-colors duration-200',
      active
        ? 'bg-[color:color-mix(in_srgb,var(--agri-primary)_9%,var(--surface-card))]'
        : 'hover:bg-[var(--surface-card-muted)]'
    )

  const menuPanel = (
    <ul
      className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] py-1 shadow-[var(--shadow-soft)] outline-none"
      role="listbox"
      aria-label="Alege workspace"
    >
      <li role="option" aria-selected={!inAssociationWorkspace}>
        <button type="button" className={menuItem(!inAssociationWorkspace)} onClick={goFarm}>
          <span className="shrink-0" aria-hidden>
            🌱
          </span>
          <span className="truncate">{farmLabel}</span>
        </button>
      </li>
      <li role="option" aria-selected={inAssociationWorkspace}>
        <button type="button" className={menuItem(inAssociationWorkspace)} onClick={goAssoc}>
          <span className="shrink-0" aria-hidden>
            🏛
          </span>
          <span className="truncate">{ASSOCIATION_BRAND}</span>
        </button>
      </li>
    </ul>
  )

  if (collapsed) {
    return (
      <div ref={rootRef} className="relative flex justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Workspace: ${summaryLabel}. Schimbă`}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-all duration-200 ease-out',
                'border border-[color:color-mix(in_srgb,var(--agri-primary)_32%,var(--border-default))] bg-[var(--surface-card)] text-[var(--agri-primary)] shadow-[var(--shadow-soft)]',
                open
                  ? 'ring-2 ring-[color:color-mix(in_srgb,var(--agri-primary)_22%,transparent)]'
                  : 'hover:bg-[var(--surface-card-muted)] active:scale-[0.98]'
              )}
            >
              {summaryEmoji}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {summaryLabel}
          </TooltipContent>
        </Tooltip>
        {open ? (
          <div className="absolute left-full top-0 z-[60] ml-2 w-[min(260px,calc(100vw-96px))]">{menuPanel}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--agri-primary)_26%,var(--border-default))] bg-[var(--surface-card)] p-px shadow-[var(--shadow-soft)]">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
          className={triggerClasses}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-base" aria-hidden>
              {summaryEmoji}
            </span>
            <span className="truncate">{summaryLabel}</span>
          </span>
          <ChevronRight
            className={cn('h-4 w-4 shrink-0 transition-transform duration-200 ease-out', open && 'rotate-90')}
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 transition-opacity duration-200">
          {menuPanel}
        </div>
      ) : null}
    </div>
  )
}
