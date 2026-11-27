'use client'

import { useEffect, useRef, useState } from 'react'
import { Smartphone, X } from 'lucide-react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, kitFocus, kitText } from '@/components/kit'
import { aratBanda, ascultaInstalarea, cereInstalarea, esteIphone, inchideBanda, noteazaFolosirea, ziRo } from '@/lib/pwa/instalare'
import { cn } from '@/lib/utils'

import { FoaieInstalare } from './FoaieInstalare'
import { useInstalare } from './useInstalare'

const DEMO = '@demo.zmeurel.local'
const esteDemo = (email: string | null | undefined) => (email ?? '').trim().toLowerCase().endsWith(DEMO)

/**
 * Banda „Pune Caietul pe ecranul telefonului · Instalează” (promptul 34, §4), doar în Acasă, doar pe telefon, deasupra
 * barei de jos. Cont real (proprietar sau operator), aplicația neinstalată, de la a doua zi de folosire sau după prima
 * salvare; X = ascunsă 30 de zile. Cât e vizibilă, butonul plutitor urcă cu înălțimea ei (`--banda-instalare-h`).
 */
export function BandaInstalare() {
  const { email } = useDashboardAuth()
  const { pregatit, arePrompt, instalata, stare } = useInstalare()
  const [foaie, setFoaie] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // Momentul deschiderii Acasă: banda nu se schimbă de la sine cât e deschisă pagina.
  const [moment] = useState(() => ({ azi: ziRo(), acum: Date.now() }))
  const vizibila = pregatit && aratBanda({ demo: esteDemo(email), instalata, stare, azi: moment.azi, acum: moment.acum })

  useEffect(() => {
    const el = ref.current
    const radacina = document.documentElement
    if (!vizibila || !el) return
    const masoara = () => radacina.style.setProperty('--banda-instalare-h', `${el.offsetHeight + 8}px`)
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver === 'undefined') masoara()
    else {
      observer = new ResizeObserver(masoara)
      observer.observe(el)
    }
    return () => {
      observer?.disconnect()
      radacina.style.removeProperty('--banda-instalare-h')
    }
  }, [vizibila])

  const instaleaza = async () => {
    if (arePrompt && !esteIphone(navigator.userAgent)) {
      await cereInstalarea()
      return
    }
    setFoaie(true)
  }

  return (
    <>
      {vizibila ? (
        <div
          ref={ref}
          role="region"
          aria-label="Instalează aplicația"
          className="fixed inset-x-3 z-fab flex items-center gap-3 rounded-box border border-border bg-surface-raised px-3 py-2.5 shadow-2 md:hidden"
          style={{ bottom: 'calc(var(--app-nav-clearance) + 8px)' }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-5" aria-hidden>
            <Smartphone />
          </span>
          <p className={cn('min-w-0 flex-1 break-words font-semibold text-fg', kitText.secondary)}>Pune Caietul pe ecranul telefonului</p>
          <Button type="button" variant="primary" size="touch" className="shrink-0 px-4" onClick={() => void instaleaza()}>
            Instalează
          </Button>
          <button
            type="button"
            aria-label="Nu acum"
            onClick={() => inchideBanda()}
            className={cn('-mr-1 flex size-touch shrink-0 items-center justify-center rounded-full text-fg-muted active:bg-surface-muted', kitFocus)}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}
      <FoaieInstalare open={foaie} onOpenChange={setFoaie} />
    </>
  )
}

/** Montat o dată în layout-ul platformei: prinde promptul și notează prima zi de folosire (doar cont real). */
export function AscultaInstalarea() {
  const { email } = useDashboardAuth()
  const demo = esteDemo(email)
  useEffect(() => {
    ascultaInstalarea()
    if (!demo) noteazaFolosirea()
  }, [demo])
  return null
}
