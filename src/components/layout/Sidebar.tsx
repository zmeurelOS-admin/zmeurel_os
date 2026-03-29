"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useDemoBannerVisible } from "@/hooks/useDemoBannerVisible"
import { useAiPanel } from "@/contexts/AiPanelContext"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "sidebar-collapsed"
const EXPANDED_WIDTH = 240
const COLLAPSED_WIDTH = 64
const DEMO_BANNER_HEIGHT = 48

type GroupKey = "ferma" | "comercial" | "finante"

type NavItem = {
  href: string
  label: string
  emoji: string
}

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
      { href: "/activitati-agricole", label: "Activități Agricole", emoji: "🚜" },
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

const FOOTER_ITEMS: NavItem[] = [
  { href: "/settings", label: "Setări", emoji: "⚙️" },
  { href: "/settings#profil", label: "Profil", emoji: "👤" },
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
}

function SidebarLink({ href, label, emoji, collapsed, active, onNavigate }: SidebarLinkProps) {
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
          ? "bg-green-50 text-[#2D6A4F] dark:bg-green-900/20 dark:text-emerald-400"
          : "text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)] dark:text-zinc-200 dark:hover:bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl text-[22px] transition-transform duration-200",
          collapsed ? "h-10 w-10" : "h-10 w-10",
          active
            ? "bg-[rgba(45,106,79,0.10)]"
            : "bg-transparent group-hover:bg-[rgba(45,106,79,0.08)] dark:group-hover:bg-zinc-800"
        )}
      >
        {emoji}
      </span>
      {!collapsed ? <span className="truncate">{label}</span> : null}
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
            active={isActiveHref(item.href, pathname, searchString, hash)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    )
  }

  return (
    <Collapsible open={group.key === activeGroup ? true : open} onOpenChange={onOpenChange}>
      <div className="space-y-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--agri-text-muted)] transition-colors hover:bg-[var(--agri-surface-muted)] hover:text-[var(--agri-text)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              group.key === activeGroup ? "text-[#2D6A4F] dark:text-emerald-300" : ""
            )}
          >
            <span>{group.label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                group.key === activeGroup || open ? "rotate-180" : "rotate-0"
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
                active={isActiveHref(item.href, pathname, searchString, hash)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function isActiveHref(href: string, pathname: string, searchString: string, hash: string) {
  const base = stripHashAndSearch(href)
  const expectedSearch = getSearchString(href)
  const expectedHash = getHashValue(href)

  if (!pathname.startsWith(base)) return false
  if (expectedSearch && expectedSearch !== searchString) return false
  if (expectedHash && expectedHash !== hash) return false
  if (base === "/settings" && !expectedHash) return hash !== "#profil"
  return true
}

function SidebarAiButton({
  collapsed,
}: {
  collapsed: boolean
}) {
  const { isAiPanelOpen, openAiPanel } = useAiPanel()

  const button = (
    <button
      type="button"
      onClick={openAiPanel}
      aria-label="Deschide Zmeurel AI"
      className={cn(
        "group flex w-full items-center rounded-2xl transition-all duration-200",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-3",
        isAiPanelOpen
          ? "bg-green-50 text-[#2D6A4F] dark:bg-green-900/20 dark:text-emerald-400"
          : "text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)] dark:text-zinc-200 dark:hover:bg-zinc-800"
      )}
    >
      <span
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(45,106,79,0.08)] text-[22px]",
          isAiPanelOpen ? "shadow-[0_0_0_4px_rgba(45,106,79,0.10)]" : ""
        )}
      >
        🤖
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_0_rgba(16,185,129,0.55)] animate-pulse" />
      </span>
      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-semibold">Zmeurel AI</span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </span>
      ) : null}
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        Zmeurel AI
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const bannerVisible = useDemoBannerVisible()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false

    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1"
    } catch {
      return false
    }
  })
  const [hash, setHash] = useState("")
  const [groupOpen, setGroupOpen] = useState<Record<GroupKey, boolean>>({
    ferma: false,
    comercial: false,
    finante: false,
  })

  const currentGroup = useMemo(() => getGroupForPath(pathname), [pathname])
  const searchString = searchParams.toString()

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

  const bannerOffset = bannerVisible ? DEMO_BANNER_HEIGHT : 0

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden border-r border-[var(--agri-border)] bg-white text-[var(--agri-text)] shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition-[width] duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 md:flex"
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
              className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--agri-border)] bg-white text-[var(--agri-text)] shadow-sm transition-colors hover:bg-[var(--agri-surface-muted)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            <div
              className={cn(
                "border-b border-[var(--agri-border)] px-3 pb-4 pt-4 dark:border-zinc-800",
                collapsed ? "px-2" : "pr-12"
              )}
            >
              <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-1.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(45,106,79,0.10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-[rgba(74,222,128,0.12)]">
                  <Image src="/icons/icon.svg" alt="Zmeurel" width={28} height={28} className="h-7 w-7" />
                </span>
                {!collapsed ? (
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold tracking-wide text-[var(--agri-text)] dark:text-zinc-100">
                      Zmeurel
                    </span>
                    <span className="block text-xs font-medium uppercase tracking-[0.24em] text-[var(--agri-text-muted)] dark:text-zinc-400">
                      OS
                    </span>
                  </span>
                ) : null}
              </Link>
            </div>

            <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
              <SidebarLink
                href={TOP_ITEM.href}
                label={TOP_ITEM.label}
                emoji={TOP_ITEM.emoji}
                collapsed={collapsed}
                active={isActiveHref(TOP_ITEM.href, pathname, searchString, hash)}
              />

              <div className="space-y-2 pt-1">
                {GROUPS.map((group) => (
                  <SidebarGroup
                    key={group.key}
                    group={group}
                    collapsed={collapsed}
                    activeGroup={currentGroup}
                    open={groupOpen[group.key]}
                    onOpenChange={(open) =>
                      setGroupOpen((current) => ({
                        ...current,
                        [group.key]: open,
                      }))
                    }
                    pathname={pathname}
                    searchString={searchString}
                    hash={hash}
                  />
                ))}
              </div>

              <div className="pt-2">
                <Separator />
              </div>

              <div className="space-y-2 pt-2">
                <SidebarAiButton collapsed={collapsed} />
                {!collapsed ? <Separator className="my-2" /> : null}
                {FOOTER_ITEMS.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    emoji={item.emoji}
                    collapsed={collapsed}
                    active={isActiveHref(item.href, pathname, searchString, hash)}
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
