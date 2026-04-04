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
    'flex w-full items-center justify-between gap-2 rounded-[10px] px-[14px] py-[10px] text-left text-sm font-semibold text-white transition-all duration-200 ease-out',
    'bg-white/[0.10] hover:bg-white/[0.15]',
    open && 'bg-white/[0.15] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
  )

  const menuItem = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 px-[14px] py-2.5 text-left text-sm font-medium text-white transition-colors duration-200',
      active ? 'bg-white/[0.14]' : 'hover:bg-white/10'
    )

  const menuPanel = (
    <ul
      className="overflow-hidden rounded-[10px] border border-white/20 py-1 shadow-lg outline-none"
      style={{ background: 'var(--agri-primary)' }}
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
                'flex h-11 w-11 items-center justify-center rounded-[10px] text-lg transition-all duration-200 ease-out',
                'bg-[var(--agri-primary)] text-white shadow-sm',
                open
                  ? 'ring-2 ring-white/35'
                  : 'hover:brightness-[1.06] active:scale-[0.98]'
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
      <div className="rounded-[10px] bg-[var(--agri-primary)] p-[2px] shadow-sm">
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
