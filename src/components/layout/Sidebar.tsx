"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AssociationContextSwitcher } from "@/components/association/AssociationContextSwitcher"
import { AssociationSidebar } from "@/components/association/AssociationSidebar"
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { useDemoBannerVisible } from "@/hooks/useDemoBannerVisible"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "sidebar-collapsed"
const EXPANDED_WIDTH = 240
const COLLAPSED_WIDTH = 64
const DEMO_BANNER_HEIGHT = 48

type GroupKey = "ferma" | "comercial" | "finante"

type SidebarAccordionKey = GroupKey | "admin"

export type SidebarNavItem = {
  href: string
  label: string
  emoji: string
  /** Dacă true, ruta e activă doar la potrivire exactă (ex. hub /admin fără sub-rute). */
  exact?: boolean
}

type NavItem = SidebarNavItem

type Group = {
  key: GroupKey
  label: string
  items: NavItem[]
}

const TOP_ITEM: NavItem = { href: "/dashboard", label: "Dashboard", emoji: "🏡" }

const GROUPS: Group[] = [
  {
    key: "ferma",
    label: "Fermă",
    items: [
      { href: "/parcele", label: "Parcele", emoji: "🌿" },
      { href: "/recoltari", label: "Recoltări", emoji: "🧺" },
      { href: "/activitati-agricole", label: "Activități agricole", emoji: "🌱" },
      { href: "/culegatori", label: "Culegători", emoji: "👷" },
    ],
  },
  {
    key: "comercial",
    label: "Comercial",
    items: [
      { href: "/comenzi", label: "Comenzi", emoji: "📋" },
      { href: "/vanzari", label: "Vânzări", emoji: "💰" },
      { href: "/clienti", label: "Clienți", emoji: "👥" },
      { href: "/produse", label: "Produse", emoji: "🛒" },
      { href: "/stocuri", label: "Stocuri", emoji: "📦" },
    ],
  },
  {
    key: "finante",
    label: "Finanțe",
    items: [
      { href: "/cheltuieli", label: "Cheltuieli", emoji: "💸" },
      { href: "/investitii", label: "Investiții", emoji: "💼" },
    ],
  },
]

const FOOTER_ITEMS: NavItem[] = [{ href: "/settings", label: "Setări", emoji: "⚙️" }]

/** Zonă superadmin — același guard ca `admin/layout.tsx` (`useDashboardAuth().isSuperAdmin`). */
const ADMIN_DESKTOP_NAV: NavItem[] = [
  { href: "/admin", label: "Panou admin", emoji: "🛡️", exact: true },
  { href: "/admin/analytics", label: "Analytics", emoji: "📈" },
  { href: "/admin/audit", label: "Audit", emoji: "📜" },
]

function stripHashAndSearch(href: string) {
  return href.split(/[?#]/)[0]
}

function getSearchString(href: string) {
  const queryIndex = href.indexOf("?")
  if (queryIndex === -1) return ""
  const hashIndex = href.indexOf("#")
  return href.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex)
}

function getHashValue(href: string) {
  const hashIndex = href.indexOf("#")
  return hashIndex === -1 ? "" : href.slice(hashIndex)
}

function deriveOpenSectionFromPath(pathname: string, isSuperAdmin: boolean): SidebarAccordionKey | null {
  if (isSuperAdmin && pathname.startsWith("/admin")) return "admin"
  return getGroupForPath(pathname)
}

function getGroupForPath(pathname: string): GroupKey | null {
  if (
    pathname.startsWith("/parcele") ||
    pathname.startsWith("/recoltari") ||
    pathname.startsWith("/activitati-agricole") ||
    pathname.startsWith("/culegatori")
  ) {
    return "ferma"
  }
  if (
    pathname.startsWith("/comenzi") ||
    pathname.startsWith("/vanzari") ||
    pathname.startsWith("/clienti") ||
    pathname.startsWith("/produse") ||
    pathname.startsWith("/stocuri")
  ) {
    return "comercial"
  }
  if (pathname.startsWith("/cheltuieli") || pathname.startsWith("/investitii")) {
    return "finante"
  }
  return null
}

type SidebarLinkProps = {
  href: string
  label: string
  emoji: string
  collapsed: boolean
  active: boolean
  onNavigate?: () => void
  /** Badge opțional (ex. număr oferte în așteptare). */
  badge?: ReactNode
}

export function SidebarLink({ href, label, emoji, collapsed, active, onNavigate, badge }: SidebarLinkProps) {
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={onNavigate}
      className={cn(
        "group flex items-center rounded-2xl text-sm font-semibold transition-all duration-200",
        collapsed ? "justify-center px-2 py-[10px]" : "gap-3 px-3 py-[11px]",
        active
          ? "bg-[var(--success-bg)] text-[var(--success-text)]"
          : "text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)]"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl text-[22px] transition-transform duration-200",
          collapsed ? "h-10 w-10" : "h-10 w-10",
          active
            ? "bg-[color:color-mix(in_srgb,var(--success-bg)_86%,var(--surface-card))]"
            : "bg-transparent group-hover:bg-[var(--surface-card-muted)]"
        )}
      >
        {emoji}
      </span>
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate">{label}</span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </span>
      ) : null}
      <span className="sr-only">{label}</span>
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

type SidebarGroupProps = {
  group: Group
  collapsed: boolean
  activeGroup: GroupKey | null
  open: boolean
  onOpenChange: (open: boolean) => void
  pathname: string
  searchString: string
  hash: string
  onNavigate?: () => void
}

function SidebarGroup({
  group,
  collapsed,
  activeGroup,
  open,
  onOpenChange,
  pathname,
  searchString,
  hash,
  onNavigate,
}: SidebarGroupProps) {
  if (collapsed) {
    return (
      <div className="space-y-1">
        {group.items.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            emoji={item.emoji}
            collapsed
            active={isNavItemActive(item, pathname, searchString, hash)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="space-y-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--agri-text-muted)] transition-colors hover:bg-[var(--agri-surface-muted)] hover:text-[var(--agri-text)]",
              group.key === activeGroup ? "text-[var(--success-text)]" : ""
            )}
          >
            <span>{group.label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                open ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-1">
          <div className="space-y-1">
            {group.items.map((item) => (
              <SidebarLink
                key={item.href}
                href={item.href}
                label={item.label}
                emoji={item.emoji}
                collapsed={false}
                active={isNavItemActive(item, pathname, searchString, hash)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function isActiveHref(
  href: string,
  pathname: string,
  searchString: string,
  hash: string,
  exactPath = false
) {
  const base = stripHashAndSearch(href)
  const expectedSearch = getSearchString(href)
  const expectedHash = getHashValue(href)

  const pathNorm = (pathname.replace(/\/$/, "") || "/") as string
  const baseNorm = (base.replace(/\/$/, "") || "/") as string
  if (exactPath) {
    if (pathNorm !== baseNorm) return false
  } else if (!pathname.startsWith(base)) {
    return false
  }
  if (expectedSearch && expectedSearch !== searchString) return false
  if (expectedHash && expectedHash !== hash) return false
  return true
}

export function isNavItemActive(item: NavItem, pathname: string, searchString: string, hash: string) {
  return isActiveHref(item.href, pathname, searchString, hash, item.exact === true)
}

type AdminDesktopNavProps = {
  collapsed: boolean
  pathname: string
  searchString: string
  hash: string
}

function AdminDesktopNav({
  collapsed,
  pathname,
  searchString,
  hash,
  open,
  onOpenChange,
}: AdminDesktopNavProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  if (collapsed) {
    return (
      <div className="space-y-1">
        {ADMIN_DESKTOP_NAV.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            emoji={item.emoji}
            collapsed
            active={isNavItemActive(item, pathname, searchString, hash)}
          />
        ))}
      </div>
    )
  }

  const inAdminZone = pathname.startsWith("/admin")

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="space-y-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--agri-text-muted)] transition-colors hover:bg-[var(--agri-surface-muted)] hover:text-[var(--agri-text)] data-[state=open]:[&>svg]:rotate-180",
              inAdminZone ? "text-[var(--success-text)]" : ""
            )}
          >
            <span>Administrare</span>
            <ChevronDown className="h-4 w-4 transition-transform duration-200" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1">
          {ADMIN_DESKTOP_NAV.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={item.label}
              emoji={item.emoji}
              collapsed={false}
              active={isNavItemActive(item, pathname, searchString, hash)}
            />
          ))}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isSuperAdmin: isSuperAdminUser, associationRole } = useDashboardAuth()
  const bannerVisible = useDemoBannerVisible()
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const [hash, setHash] = useState("")
  const [openSection, setOpenSection] = useState<SidebarAccordionKey | null>(null)
  const [openSectionPath, setOpenSectionPath] = useState("")

  const currentGroup = useMemo(() => getGroupForPath(pathname), [pathname])
  const searchString = searchParams.toString()
  const inAssociationWorkspace = pathname.startsWith("/asociatie")

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      try {
        setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1")
      } catch {
        setCollapsed(false)
      }
    }, 0)
    return () => window.clearTimeout(syncTimer)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
    } catch {
      // Ignore storage failures
    }

    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px`
    )
  }, [collapsed])

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash || "")
    updateHash()
    window.addEventListener("hashchange", updateHash)
    return () => window.removeEventListener("hashchange", updateHash)
  }, [])

  const pathnameOpenSection = useMemo(
    () => deriveOpenSectionFromPath(pathname, isSuperAdminUser),
    [pathname, isSuperAdminUser]
  )
  const activeOpenSection =
    collapsed || inAssociationWorkspace
      ? null
      : openSectionPath === pathname
        ? openSection
        : pathnameOpenSection

  const bannerOffset = bannerVisible ? DEMO_BANNER_HEIGHT : 0

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden border-r border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-elevated)] transition-[width] duration-300 ease-in-out md:flex"
        style={{
          top: bannerOffset,
          height: `calc(100vh - ${bannerOffset}px)`,
          width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        }}
        aria-label="Navigare desktop"
      >
        <TooltipProvider delayDuration={150}>
          <div className="relative flex h-full w-full flex-col overflow-hidden">
            <button
              type="button"
              aria-label={collapsed ? "Extinde sidebar" : "Restrânge sidebar"}
              onClick={() => setCollapsed((current) => !current)}
              className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-card-muted)]"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            <div
              className={cn(
                "border-b border-[var(--border-default)] px-3 pb-4 pt-4",
                collapsed ? "px-2" : "pr-12"
              )}
            >
              <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-1.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--success-bg)_85%,var(--surface-card))] shadow-[inset_0_1px_0_color:color-mix(in_srgb,var(--surface-card)_70%,transparent)]">
                  <Image src="/icons/icon.svg" alt="Zmeurel" width={28} height={28} className="h-7 w-7" />
                </span>
                {!collapsed ? (
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold tracking-wide text-[var(--text-primary)]">
                      Zmeurel
                    </span>
                    <span className="block text-xs font-medium uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                      OS
                    </span>
                  </span>
                ) : null}
              </Link>
            </div>

            {associationRole ? (
              <div
                className={cn(
                  "border-b border-[var(--border-default)] px-2 pb-3",
                  collapsed ? "px-1.5" : ""
                )}
              >
                <AssociationContextSwitcher collapsed={collapsed} />
              </div>
            ) : null}

            <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
              {inAssociationWorkspace ? (
                <AssociationSidebar
                  collapsed={collapsed}
                  pathname={pathname}
                  searchString={searchString}
                  hash={hash}
                />
              ) : (
                <>
                  <SidebarLink
                    href={TOP_ITEM.href}
                    label={TOP_ITEM.label}
                    emoji={TOP_ITEM.emoji}
                    collapsed={collapsed}
                    active={isNavItemActive(TOP_ITEM, pathname, searchString, hash)}
                  />

                  <div className="space-y-2 pt-1">
                    {GROUPS.map((group) => (
                      <SidebarGroup
                        key={group.key}
                        group={group}
                        collapsed={collapsed}
                        activeGroup={currentGroup}
                        open={activeOpenSection === group.key}
                        onOpenChange={(next) => {
                          setOpenSectionPath(pathname)
                          if (next) setOpenSection(group.key)
                          else setOpenSection(null)
                        }}
                        pathname={pathname}
                        searchString={searchString}
                        hash={hash}
                      />
                    ))}
                  </div>

                  {isSuperAdminUser ? (
                    <div className="space-y-2 pt-1">
                      <AdminDesktopNav
                        collapsed={collapsed}
                        pathname={pathname}
                        searchString={searchString}
                        hash={hash}
                        open={activeOpenSection === "admin"}
                        onOpenChange={(next) => {
                          setOpenSectionPath(pathname)
                          if (next) setOpenSection("admin")
                          else setOpenSection(null)
                        }}
                      />
                    </div>
                  ) : null}
                </>
              )}

              {inAssociationWorkspace && isSuperAdminUser ? (
                <div className="space-y-2 pt-1">
                  <AdminDesktopNav
                    collapsed={collapsed}
                    pathname={pathname}
                    searchString={searchString}
                    hash={hash}
                    open={activeOpenSection === "admin"}
                    onOpenChange={(next) => {
                      setOpenSectionPath(pathname)
                      if (next) setOpenSection("admin")
                      else setOpenSection(null)
                    }}
                  />
                </div>
              ) : null}

              <div className="pt-2">
                <Separator />
              </div>

              <div className="space-y-2 pt-2">
                {FOOTER_ITEMS.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    emoji={item.emoji}
                    collapsed={collapsed}
                    active={isNavItemActive(item, pathname, searchString, hash)}
                  />
                ))}
              </div>
            </nav>
          </div>
        </TooltipProvider>
      </aside>
    </>
  )
}
