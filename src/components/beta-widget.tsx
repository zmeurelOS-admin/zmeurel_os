'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

import { SUPPORT_WHATSAPP_URL } from '@/lib/support'
import { cn } from '@/lib/utils'

/**
 * „Ești în beta”: un punct mic în colțul de sus al carcasei. Conținutul (WhatsApp) se deschide doar la atingere,
 * niciodată singur, ca să nu acopere butonul principal al paginii sau conținutul.
 *
 * Stratul e `z-fab` (sub `z-overlay` / `z-modal`): foile (`BottomSheet`) și formularele pe pași (`StepForm`) stau
 * deasupra lui. Stă sus, deci nu atinge bara de jos și butoanele fixate jos.
 */
export default function BetaWidget() {
  const [deschis, setDeschis] = useState(false)
  const radacina = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!deschis) return
    const laAtingere = (event: PointerEvent) => {
      if (radacina.current && !radacina.current.contains(event.target as Node)) setDeschis(false)
    }
    const laTasta = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDeschis(false)
    }
    document.addEventListener('pointerdown', laAtingere)
    document.addEventListener('keydown', laTasta)
    return () => {
      document.removeEventListener('pointerdown', laAtingere)
      document.removeEventListener('keydown', laTasta)
    }
  }, [deschis])

  return (
    <div
      ref={radacina}
      className="beta-widget fixed right-1 top-[calc(var(--safe-t)+4px)] z-fab print:hidden"
    >
      <button
        type="button"
        aria-expanded={deschis}
        aria-controls="beta-widget-continut"
        aria-label="Ești în beta: scrie-mi o problemă sau o sugestie"
        title="Ești în beta"
        onClick={() => setDeschis((value) => !value)}
        className="flex size-7 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span aria-hidden className={cn('block size-2.5 rounded-full bg-primary ring-2 ring-surface', deschis && 'bg-fg-muted')} />
      </button>

      {deschis ? (
        <div
          id="beta-widget-continut"
          role="dialog"
          aria-label="Ești în beta"
          className="absolute right-0 top-8 w-[min(280px,calc(100vw-24px))] rounded-card border border-border bg-surface-raised p-4 shadow-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-bold text-fg">Ești în beta</p>
            <button
              type="button"
              onClick={() => setDeschis(false)}
              aria-label="Închide"
              className="-mr-2 -mt-2 flex size-10 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-[15px] text-fg-muted">Ai o problemă sau o sugestie?</p>
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setDeschis(false)}
            className="mt-3 inline-flex h-touch w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-[15px] font-semibold text-primary-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <MessageCircle className="size-4" aria-hidden />
            Scrie-mi pe WhatsApp
          </a>
        </div>
      ) : null}
    </div>
  )
}
