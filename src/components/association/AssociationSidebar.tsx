'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { isNavItemActive, SidebarLink, type SidebarNavItem } from '@/components/layout/Sidebar'
import { queryKeys } from '@/lib/query-keys'

async function fetchPendingOffersCount(): Promise<number> {
  const res = await fetch('/api/association/offers?countOnly=1', { credentials: 'same-origin' })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { pendingCount?: number } } | null
  if (!res.ok || !json?.ok) return 0
  return json.data?.pendingCount ?? 0
}

/** Navigare workspace Asociație (desktop sidebar) — fără Membri (inserat doar pentru admin). */
export const ASSOCIATION_NAV_ITEMS: SidebarNavItem[] = [
  { href: '/asociatie', label: 'Panou', emoji: '🏛', exact: true },
  { href: '/asociatie/produse', label: 'Produse în asociație', emoji: '🛒' },
  { href: '/asociatie/oferte', label: 'Oferte', emoji: '📨' },
  { href: '/asociatie/comenzi', label: 'Comenzi magazin', emoji: '📋' },
  { href: '/asociatie/livrari', label: 'Livrări', emoji: '🚚' },
  { href: '/asociatie/producatori', label: 'Producători', emoji: '🌾' },
  { href: '/asociatie/setari', label: 'Setări asociație', emoji: '⚙️' },
  { href: '/magazin/asociatie', label: 'Vitrină publică', emoji: '🛍️' },
]

const MEMBRI_ITEM: SidebarNavItem = { href: '/asociatie/membri', label: 'Membri', emoji: '👥' }

function buildAssociationNavItems(isAdmin: boolean): SidebarNavItem[] {
  if (!isAdmin) return ASSOCIATION_NAV_ITEMS
  const out: SidebarNavItem[] = []
  for (const item of ASSOCIATION_NAV_ITEMS) {
    out.push(item)
    if (item.href === '/asociatie/producatori') {
      out.push(MEMBRI_ITEM)
    }
  }
  return out
}

export type AssociationSidebarProps = {
  collapsed: boolean
  pathname: string
  searchString: string
  hash: string
}

export function AssociationSidebar({ collapsed, pathname, searchString, hash }: AssociationSidebarProps) {
  const { associationRole } = useDashboardAuth()
  const items = useMemo(
    () => buildAssociationNavItems(associationRole === 'admin'),
    [associationRole]
  )

  const { data: pendingOfferCount = 0 } = useQuery({
    queryKey: queryKeys.associationOffersPendingCount,
    queryFn: fetchPendingOffersCount,
    staleTime: 45_000,
    refetchOnWindowFocus: true,
  })

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <SidebarLink
          key={item.href}
          href={item.href}
          label={item.label}
          emoji={item.emoji}
          collapsed={collapsed}
          active={isNavItemActive(item, pathname, searchString, hash)}
          badge={
            item.href === '/asociatie/oferte' && pendingOfferCount > 0 ? (
              <span className="min-w-[1.25rem] rounded-full bg-[var(--status-warning-text)] px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                {pendingOfferCount > 99 ? '99+' : pendingOfferCount}
              </span>
            ) : undefined
          }
        />
      ))}
    </div>
  )
}
