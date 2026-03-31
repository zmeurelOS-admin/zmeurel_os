'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import {
  Archive,
  BanknoteArrowUp,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPin,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button } from '@/components/ui/button'
import { getSupabase, resetSupabaseInstance } from '@/lib/supabase/client'

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
    { href: '/admin/analytics', label: 'Analytics global', icon: BarChart3 },
    { href: '/admin', label: 'Lista tenantilor', icon: UsersRound },
  ],
}

const MOBILE_NAV_PRIMARY = new Set(['/dashboard', '/recoltari', '/comenzi'])

export function MoreMenuDrawer({ open, onOpenChange }: MoreMenuDrawerProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { isSuperAdmin: isSuperAdminUser } = useDashboardAuth()

  const sections = useMemo(() => {
    const cleanedGroups = groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !MOBILE_NAV_PRIMARY.has(item.href)),
    }))
    if (!isSuperAdminUser) return cleanedGroups
    return [...cleanedGroups, adminGroup]
  }, [isSuperAdminUser])

  const handleLogout = async () => {
    try {
      const supabase = getSupabase()
      await supabase.auth.signOut({ scope: 'local' })
      resetSupabaseInstance()
    } catch {
      // ignore — proceed with redirect regardless
    }
    window.location.replace('/')
  }

  const handleNavigate = (href: string) => {
    onOpenChange(false)
    window.setTimeout(() => {
      router.push(href)
    }, 0)
  }

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} title="Mai mult" disableHistory hideHeader showHandle contentClassName="w-full max-w-full sm:max-w-full">
      <div className="space-y-4">
        {sections.map((group) => (
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
                const active = pathname.startsWith(item.href)
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
        ))}

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

            <Button
              type="button"
              variant="outline"
              className="agri-control h-10 w-full justify-start gap-3 border-[var(--soft-danger-border)] text-sm font-semibold text-[var(--soft-danger-text)] hover:bg-[var(--soft-danger-bg)]"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Deconectare
            </Button>
          </div>
        </section>
      </div>
    </AppDrawer>
  )
}
