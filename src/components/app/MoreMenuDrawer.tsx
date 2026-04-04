'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useRef } from 'react'
import {
  Archive,
  BanknoteArrowUp,
  BarChart3,
  Building2,
  ExternalLink,
  FileSearch,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useQueryClient } from '@tanstack/react-query'

import { AppDrawer } from '@/components/app/AppDrawer'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button } from '@/components/ui/button'
import { prepareClientBeforeServerSignOut } from '@/lib/auth/server-sign-out-form'

interface MoreMenuDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MenuItem = {
  href: string
  label: string
  icon: LucideIcon
}

type MenuGroup = {
  title: string
  items: MenuItem[]
  badge?: string
}

const groups: MenuGroup[] = [
  {
    title: 'Operațiuni',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/parcele', label: 'Terenuri', icon: MapPin },
      { href: '/cheltuieli', label: 'Cheltuieli', icon: Receipt },
      { href: '/investitii', label: 'Investiții', icon: TrendingUp },
      { href: '/comenzi', label: 'Comenzi', icon: ShoppingBag },
      { href: '/vanzari', label: 'Vânzări', icon: BanknoteArrowUp },
      { href: '/stocuri', label: 'Stocuri', icon: Archive },
      { href: '/vanzari-butasi', label: 'Material săditor', icon: ShoppingBag },
      { href: '/produse', label: 'Produse', icon: Package },
    ],
  },
  {
    title: 'Administrare',
    items: [
      { href: '/clienti', label: 'Clienți', icon: Users },
      { href: '/culegatori', label: 'Culegători', icon: Leaf },
      { href: '/rapoarte', label: 'Rapoarte', icon: BarChart3 },
    ],
  },
]

const adminGroup: MenuGroup = {
  title: 'Admin (Zmeurel)',
  badge: 'Admin',
  items: [
    { href: '/admin', label: 'Panou admin', icon: ShieldCheck },
    { href: '/admin/analytics', label: 'Analytics global', icon: BarChart3 },
    { href: '/admin/audit', label: 'Audit', icon: FileSearch },
  ],
}

const associationGroup: MenuGroup = {
  title: 'Asociație',
  items: [{ href: '/asociatie', label: 'Gustă din Bucovina (panou)', icon: Building2 }],
}

function isMoreMenuItemActive(pathname: string, href: string) {
  const path = pathname.replace(/\/$/, '') || '/'
  if (href === '/admin') return path === '/admin'
  return path.startsWith(href)
}

const MOBILE_NAV_PRIMARY = new Set(['/dashboard', '/recoltari', '/comenzi'])

export function MoreMenuDrawer({ open, onOpenChange }: MoreMenuDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isSuperAdmin: isSuperAdminUser, associationRole } = useDashboardAuth()
  const ignoreCloseUntilRef = useRef(0)
  const prevOpenRef = useRef(false)
  if (open && !prevOpenRef.current) {
    ignoreCloseUntilRef.current = Date.now() + 220
  }
  prevOpenRef.current = open

  const handleOpenChange = (next: boolean) => {
    if (!next && Date.now() < ignoreCloseUntilRef.current) return
    onOpenChange(next)
  }

  const inAssociationWorkspace = pathname.startsWith('/asociatie')

  const farmMenuSections = useMemo(() => {
    const cleanedGroups = groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !MOBILE_NAV_PRIMARY.has(item.href)),
    }))
    const base = associationRole ? [associationGroup, ...cleanedGroups] : cleanedGroups
    if (!isSuperAdminUser) return base
    return [...base, adminGroup]
  }, [isSuperAdminUser, associationRole])

  const handleNavigate = (href: string) => {
    onOpenChange(false)
    window.setTimeout(() => {
      router.push(href)
    }, 0)
  }

  const renderGroup = (group: MenuGroup) => (
    <section key={group.title} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--agri-text-muted)]">
          {group.title}
        </h3>
        {'badge' in group ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--soft-success-text)]">
            <ShieldCheck className="h-3 w-3" />
            {group.badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        {group.items.map((item) => {
          const active = isMoreMenuItemActive(pathname, item.href)
          const Icon = item.icon

          return (
            <button
              key={`${group.title}-${item.href}-${item.label}`}
              type="button"
              onClick={() => handleNavigate(item.href)}
              className={`agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold ${
                active
                  ? 'border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] text-[var(--soft-success-text)]'
                  : 'text-[var(--agri-text)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <AppDrawer open={open} onOpenChange={handleOpenChange} title="Mai mult" disableHistory hideHeader showHandle contentClassName="w-full max-w-full sm:max-w-full">
      <div className="space-y-4">
        {inAssociationWorkspace && associationRole ? (
          <>
            <section className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--agri-text-muted)]">
                Asociație
              </h3>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => handleNavigate('/asociatie/oferte')}
                  className={`agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold ${
                    isMoreMenuItemActive(pathname, '/asociatie/oferte')
                      ? 'border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] text-[var(--soft-success-text)]'
                      : 'text-[var(--agri-text)]'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    📨
                  </span>
                  Oferte
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('/asociatie/producatori')}
                  className={`agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold ${
                    isMoreMenuItemActive(pathname, '/asociatie/producatori')
                      ? 'border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] text-[var(--soft-success-text)]'
                      : 'text-[var(--agri-text)]'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    🧑‍🌾
                  </span>
                  Fermieri
                </button>
                {associationRole === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => handleNavigate('/asociatie/membri')}
                    className={`agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold ${
                      isMoreMenuItemActive(pathname, '/asociatie/membri')
                        ? 'border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] text-[var(--soft-success-text)]'
                        : 'text-[var(--agri-text)]'
                    }`}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      👥
                    </span>
                    Membri
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleNavigate('/asociatie/setari')}
                  className={`agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold ${
                    isMoreMenuItemActive(pathname, '/asociatie/setari')
                      ? 'border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] text-[var(--soft-success-text)]'
                      : 'text-[var(--agri-text)]'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    ⚙️
                  </span>
                  Setări
                </button>
                <a
                  href="/magazin/asociatie"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOpenChange(false)}
                  className="agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold text-[var(--agri-text)]"
                >
                  <Store className="h-4 w-4 shrink-0" />
                  Vezi magazinul
                  <ExternalLink className="ml-auto h-3.5 w-3.5 text-[var(--agri-text-muted)]" aria-hidden />
                </a>
              </div>
            </section>

            <div className="border-t border-[var(--agri-border)] pt-4">
              <button
                type="button"
                onClick={() => handleNavigate('/dashboard')}
                className="agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold text-[var(--agri-text)]"
              >
                <span className="text-base leading-none" aria-hidden>
                  🌱
                </span>
                Înapoi la fermă
              </button>
            </div>

            {isSuperAdminUser ? renderGroup(adminGroup) : null}
          </>
        ) : (
          farmMenuSections.map((group) => renderGroup(group))
        )}

        <section className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--agri-text-muted)]">
            Cont & Setări
          </h3>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleNavigate('/settings#profil')}
              className="agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold text-[var(--agri-text)]"
            >
              <Settings className="h-4 w-4" />
              Profil utilizator
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('/termeni')}
              className="agri-control flex h-10 w-full items-center gap-3 px-3 text-sm font-semibold text-[var(--agri-text)]"
            >
              <ShieldCheck className="h-4 w-4" />
              Ajutor
            </button>

            <form
              action="/api/auth/sign-out"
              method="POST"
              className="w-full"
              onSubmit={() => prepareClientBeforeServerSignOut(queryClient)}
            >
              <Button
                type="submit"
                variant="outline"
                className="agri-control h-10 w-full justify-start gap-3 border-[var(--soft-danger-border)] text-sm font-semibold text-[var(--soft-danger-text)] hover:bg-[var(--soft-danger-bg)]"
              >
                <LogOut className="h-4 w-4" />
                Deconectare
              </Button>
            </form>
          </div>
        </section>
      </div>
    </AppDrawer>
  )
}
