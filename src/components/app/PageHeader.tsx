'use client'

import { Plus } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { HighVisibilityToggle } from '@/components/app/HighVisibilityToggle'
import { SyncStatusIndicator } from '@/components/app/SyncStatusIndicator'
import { UserProfileMenu } from '@/components/app/UserProfileMenu'
import { Button } from '@/components/ui/button'
import { useAddAction } from '@/contexts/AddActionContext'

interface PageHeaderProps {
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
}

type HeaderPrimaryAction = {
  label: string
  fallbackHref?: string
} | null

function getPrimaryAction(pathname: string): HeaderPrimaryAction {
  if (pathname === '/dashboard') return { label: 'Adauga recoltare', fallbackHref: '/recoltari?add=1' }
  if (pathname.startsWith('/parcele')) return { label: 'Adauga parcela' }
  if (pathname.startsWith('/recoltari')) return { label: 'Adauga recoltare', fallbackHref: '/recoltari?add=1' }
  if (pathname.startsWith('/activitati-agricole')) return { label: 'Adauga activitate' }
  if (pathname.startsWith('/comenzi')) return { label: 'Adauga comanda', fallbackHref: '/comenzi?add=1' }
  if (pathname.startsWith('/vanzari-butasi')) return { label: 'Adauga comanda butasi' }
  if (pathname.startsWith('/investitii')) return { label: 'Adauga investitie' }
  if (pathname.startsWith('/cheltuieli')) return { label: 'Adauga cheltuiala', fallbackHref: '/cheltuieli?add=1' }
  if (pathname.startsWith('/culegatori')) return { label: 'Adauga culegator' }
  if (pathname.startsWith('/clienti')) return { label: 'Adauga client' }
  if (pathname.startsWith('/settings')) return null
  if (pathname.startsWith('/admin')) return null
  if (pathname.startsWith('/planuri')) return null
  return null
}

export function PageHeader({ title, subtitle, rightSlot, summary }: PageHeaderProps) {
  const { triggerAddAction } = useAddAction()
  const pathname = usePathname()
  const router = useRouter()
  const primaryAction = getPrimaryAction(pathname)

  return (
    <CompactPageHeader
      title={title}
      subtitle={subtitle}
      summary={summary}
      rightSlot={
        <div className="flex items-center justify-end gap-2 text-white lg:gap-3">
          {primaryAction ? (
            <Button
              type="button"
              variant="outline"
              className="hidden h-10 items-center gap-2 rounded-xl border-white/40 bg-white/20 px-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/30 lg:inline-flex lg:hover:opacity-95"
              onClick={() => {
                const handled = triggerAddAction()
                if (!handled && primaryAction.fallbackHref) {
                  router.push(primaryAction.fallbackHref)
                }
              }}
            >
              <Plus className="h-4 w-4" />
              {primaryAction.label}
            </Button>
          ) : null}
          <SyncStatusIndicator />
          {rightSlot ? <div className="flex items-center">{rightSlot}</div> : null}
          <HighVisibilityToggle />
          <UserProfileMenu />
        </div>
      }
    />
  )
}
