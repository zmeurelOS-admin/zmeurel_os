'use client'

import Link from 'next/link'
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
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppDrawer } from '@/components/app/AppDrawer'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabase/client'

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
    title: 'Operatiuni',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/parcele', label: 'Parcele', icon: MapPin },
      { href: '/activitati-agricole', label: 'Activitati agricole', icon: ClipboardList },
      { href: '/cheltuieli', label: 'Cheltuieli', icon: Receipt },
      { href: '/comenzi', label: 'Comenzi', icon: ShoppingBag },
      { href: '/vanzari', label: 'Vanzari fructe', icon: BanknoteArrowUp },
      { href: '/stocuri', label: 'Stocuri', icon: Archive },
      { href: '/vanzari-butasi', label: 'Vanzari butasi', icon: ShoppingBag },
    ],
  },
  {
    title: 'Administrare',
    items: [
      { href: '/clienti', label: 'Clienti', icon: Users },
      { href: '/culegatori', label: 'Culegatori', icon: Leaf },
      { href: '/rapoarte', label: 'Rapoarte', icon: BarChart3 },
    ],
  },
]

const adminGroup: MenuGroup = {
  title: 'Admin (Zmeurel)',
  badge: 'Admin',
  items: [
    { href: '/admin/analytics', label: 'Analytics global (agregat)', icon: BarChart3 },
    { href: '/admin', label: 'Lista tenanti', icon: UsersRound },
  ],
}

// Modules rendered in the mobile bottom navbar should not be duplicated in More.
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
    const supabase = getSupabase()
    await supabase.auth.signOut()
    onOpenChange(false)
    router.push('/login')
    toast.success('Te-ai delogat cu succes.')
  }

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} title="Mai multe module">
      <div className="space-y-6">
        {sections.map((group) => (
          <section key={group.title} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--agri-text-muted)]">{group.title}</h3>
              {'badge' in group ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  <ShieldCheck className="h-3 w-3" />
                  {group.badge}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href)
                const Icon = item.icon

                return (
                  <Link
                    key={`${group.title}-${item.href}-${item.label}`}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={`agri-control flex h-12 items-center gap-3 px-3 text-sm font-semibold ${
                      active ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'text-[var(--agri-text)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}

        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--agri-text-muted)]">Cont & Setari</h3>
          <div className="space-y-2">
            <Link
              href="/settings#profil"
              onClick={() => onOpenChange(false)}
              className="agri-control flex h-12 items-center gap-3 px-3 text-sm font-semibold text-[var(--agri-text)]"
            >
              <Settings className="h-4 w-4" />
              Profil utilizator
            </Link>

            <Link
              href="/termeni"
              onClick={() => onOpenChange(false)}
              className="agri-control flex h-12 items-center gap-3 px-3 text-sm font-semibold text-[var(--agri-text)]"
            >
              <ShieldCheck className="h-4 w-4" />
              Ajutor
            </Link>

            <Button
              type="button"
              variant="outline"
              className="agri-control h-12 w-full justify-start gap-3 border-red-300 text-sm font-semibold text-red-700 hover:bg-red-50"
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

