'use client'

import { useEffect, useRef, useState } from 'react'

interface AppShellProps {
  /** Omite slotul de header din shell când e `null` (ex. header randat în client). */
  header?: React.ReactNode | null
  children: React.ReactNode
  fab?: React.ReactNode
  bottomBar?: React.ReactNode
  bottomBarFixed?: boolean
  bottomInset?: string
}

/** Distanța barei fixe față de bara de jos (px), aceeași în stil și în spațiul lăsat dedesubt. */
const DISTANTA_BARA = 12
/** Aer între ultimul rând al paginii și bara fixă (px). */
const AER_SUB_CONTINUT = 16

/**
 * Bara fixată jos (butonul mare al paginii): pagina lasă dedesubt exact cât ocupă ea (promptul 34, §6), măsurat,
 * nu ghicit: înălțimea barei (crește cu „Mărimea: Mare”) + distanța față de bara de jos + bara de jos cu zona sigură.
 * Pe desktop bara e ascunsă (`md:hidden`), deci înălțimea măsurată e 0.
 */
function useInaltimeBara(activ: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [inaltime, setInaltime] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!activ || !el) return
    const masoara = () => setInaltime(el.offsetHeight)
    // `ResizeObserver` raportează și la pornire; fără el, o singură măsurare, după desenare.
    if (typeof ResizeObserver === 'undefined') {
      const cadru = window.requestAnimationFrame(masoara)
      return () => window.cancelAnimationFrame(cadru)
    }
    const observer = new ResizeObserver(masoara)
    observer.observe(el)
    return () => observer.disconnect()
  }, [activ])

  return { ref, inaltime: activ ? inaltime : 0 }
}

export function AppShell({
  header,
  children,
  fab,
  bottomBar,
  bottomBarFixed = false,
  bottomInset = 'var(--app-nav-clearance)',
}: AppShellProps) {
  const baraFixa = Boolean(bottomBar) && bottomBarFixed
  const { ref: baraRef, inaltime: inaltimeBara } = useInaltimeBara(baraFixa)
  const spatiuJos =
    baraFixa && inaltimeBara > 0 ? `calc(${bottomInset} + ${inaltimeBara + DISTANTA_BARA + AER_SUB_CONTINUT}px)` : bottomInset

  return (
    <div className="min-h-0 bg-[var(--agri-bg)]">
      {header != null ? <div className="relative z-bar">{header}</div> : null}

      {/* Fără z-index aici: un strat propriu ar închide tot ce e `fixed` în pagină sub bara de jos și sub FAB. */}
      <div className="relative px-[var(--shell-content-px)] sm:px-5 md:px-6" style={{ paddingBottom: spatiuJos }}>
        <div className="mx-auto w-full max-w-md pb-28 pt-0.5 sm:max-w-full sm:pb-32 md:pt-1">{children}</div>
      </div>

      {bottomBar ? (
        bottomBarFixed ? (
          <div
            ref={baraRef}
            className="fixed inset-x-0 z-bar md:hidden"
            style={{ bottom: `calc(var(--app-nav-clearance) + ${DISTANTA_BARA}px)` }}
          >
            {bottomBar}
          </div>
        ) : (
          <div className="relative z-30">{bottomBar}</div>
        )
      ) : null}
      {fab}
    </div>
  )
}
