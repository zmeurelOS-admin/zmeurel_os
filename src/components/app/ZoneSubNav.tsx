'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { getZoneForPath, isSectionActive, OPEN_FARM_MENU_EVENT } from '@/lib/navigation/zones'
import { cn } from '@/lib/utils'

/**
 * V2 · Secțiunile zonei curente, sub titlul paginii (doar pe mobil), plus butonul meniului fermei.
 * Pe rutele din afara zonelor (setări, produse etc.) rămâne doar butonul de meniu.
 */
export function ZoneSubNav() {
  const pathname = usePathname() ?? ''
  const { associationRole, memberRole, memberAccess } = useDashboardAuth()
  if (associationRole && pathname.startsWith('/asociatie')) return null

  const zone = getZoneForPath(pathname)
  const canSeeParcele = memberRole !== 'operator' || (memberAccess ?? []).some((item) => item.module === 'parcele')
  const sections = (zone?.sections ?? []).filter((s) => s.href !== '/parcele' || canSeeParcele)

  return (
    <div className="mt-2 flex items-center gap-2 lg:hidden">
      <nav aria-label={zone ? `Secțiuni ${zone.label}` : 'Secțiuni'} className="min-w-0 flex-1">
        {sections.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto rounded-[14px] bg-[var(--surface-card-muted)] p-1 [scrollbar-width:none]">
            {sections.map((section) => {
              const active = isSectionActive(pathname, section)
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] px-3 text-[14.5px] transition-colors',
                    active
                      ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(20,33,26,0.18)] [font-weight:800]'
                      : 'text-[var(--text-secondary)] [font-weight:700]',
                  )}
                >
                  {section.label}
                </Link>
              )
            })}
          </div>
        ) : null}
      </nav>
      <button
        type="button"
        aria-label="Mai mult"
        onClick={() => window.dispatchEvent(new Event(OPEN_FARM_MENU_EVENT))}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}
