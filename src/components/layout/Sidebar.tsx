'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Archive,
  BadgeCheck,
  LayoutDashboard,
  MapPin,
  Menu,
  PackageOpen,
  Plus,
  Receipt,
  ShoppingBag,
  Sprout,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
  X,
} from 'lucide-react'

import LogoutButton from '@/components/LogoutButton'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'

const navGroups = [
  {
    label: 'OPERAȚIUNI',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/parcele', label: 'Terenuri', icon: MapPin },
      { href: '/recoltari', label: 'Recoltări', icon: PackageOpen },
      { href: '/stocuri', label: 'Stocuri', icon: Archive },
      { href: '/activitati-agricole', label: 'Activități agricole', icon: Sprout },
    ],
  },
  {
    label: 'RELAȚII',
    items: [
      { href: '/culegatori', label: 'Culegători', icon: Users },
      { href: '/clienti', label: 'Clienți', icon: UserCheck },
    ],
  },
  {
    label: 'FINANCIAR',
    items: [
      { href: '/comenzi', label: 'Comenzi', icon: ShoppingBag },
      { href: '/vanzari-butasi', label: 'Material săditor', icon: ShoppingBag },
      { href: '/investitii', label: 'Investiții', icon: TrendingUp },
      { href: '/cheltuieli', label: 'Cheltuieli', icon: Receipt },
    ],
  },
]

const adminItems = [
  { href: '/admin/analytics', label: 'Analytics global', icon: BadgeCheck },
  { href: '/admin', label: 'Listă tenanți', icon: UsersRound },
]

type SidebarContentProps = {
  isActive: (href: string) => boolean
  onNavigate: () => void
  isSuperAdminUser: boolean
}

function SidebarContent({ isActive, onNavigate, isSuperAdminUser }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-7">
        <div className="flex items-center gap-3">
          <Image src="/icons/icon.svg" alt="Zmeurel OS" width={36} height={36} className="shrink-0" />
          <div>
            <span
              className="text-xl font-bold tracking-wide text-white"
              style={{ fontFamily: "'Georgia', serif", letterSpacing: '0.03em' }}
            >
              Zmeurel
            </span>
            <span className="block -mt-0.5 text-xs font-medium uppercase tracking-widest text-slate-400">OS</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-slate-500">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all transition-colors duration-200 ${
                        active
                          ? 'bg-[#F16B6B]/15 text-[#F16B6B] lg:bg-white/10 lg:text-white'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white lg:hover:bg-white/5 lg:hover:text-white'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                          active ? 'bg-[#F16B6B]/20' : 'bg-transparent group-hover:bg-white/5'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? 'text-[#F16B6B]' : ''}`} />
                      </div>
                      {label}
                      {active ? <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F16B6B]" /> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {isActive('/dashboard') ? (
          <div className="hidden lg:block">
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-slate-500">DASHBOARD</p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/recoltari?add=1"
                  onClick={onNavigate}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all transition-colors duration-200 hover:bg-white/5 hover:text-white lg:hover:bg-white/5 lg:hover:text-white"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent transition-all duration-200 group-hover:bg-white/5">
                    <Plus className="h-4 w-4" />
                  </div>
                  Adaugă recoltare
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </nav>

      {isSuperAdminUser ? (
        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-2 flex items-center justify-between px-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Admin (Zmeurel)</p>
            <span className="rounded-full border border-[#F16B6B]/40 bg-[#F16B6B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F8B4B4]">
              Admin
            </span>
          </div>
          <ul className="space-y-0.5">
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <li key={`${href}-${label}`}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all transition-colors duration-200 ${
                      active
                        ? 'bg-[#F16B6B]/15 text-[#F16B6B] lg:bg-white/10 lg:text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white lg:hover:bg-white/5 lg:hover:text-white'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                        active ? 'bg-[#F16B6B]/20' : 'bg-transparent group-hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-[#F16B6B]' : ''}`} />
                    </div>
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-white/10 px-3 py-4 lg:hidden">
        <LogoutButton />
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isSuperAdmin: isSuperAdminUser } = useDashboardAuth()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-[#312E3F] text-white shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-72 bg-[#312E3F] transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <SidebarContent
          isActive={isActive}
          onNavigate={() => setMobileOpen(false)}
          isSuperAdminUser={isSuperAdminUser}
        />
      </aside>

      <aside className="hidden w-64 lg:flex">
        <div className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col bg-[#312E3F]">
          <SidebarContent
            isActive={isActive}
            onNavigate={() => setMobileOpen(false)}
            isSuperAdminUser={isSuperAdminUser}
          />
        </div>
      </aside>
    </>
  )
}
