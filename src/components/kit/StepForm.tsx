'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { generateClientId } from '@/lib/offline/generateClientId'
import { cn } from '@/lib/utils'

import {
  createFormLifecycle,
  createSession,
  navBack,
  navCanGoBack,
  navGoTo,
  navNext,
  stepLabelRo,
  stepProgressPercent,
  type StepFormSession,
  type StepNavConfig,
} from './lib/step-form'
import { kitText } from './text'

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface UseStepFormOptions {
  /** Cheile pașilor, în ordine. Lista se poate schimba între randări (pași care depind de răspunsuri). */
  steps: readonly string[]
  open: boolean
  /** Cheia pasului de recapitulare, dacă există. Nu se numără în „Pasul x din y”. */
  summaryKey?: string
  /** Pasul de pornire la deschidere (ex. recapitularea, la editare). Implicit primul. */
  initialStep?: string
  /** La `edit` nu se trimit evenimente de analytics, iar eticheta e „Editare”. */
  mode?: 'create' | 'edit'
  /** Modulul pentru ciclul `open_create_form` → `create_success` / `create_failed` / `form_abandoned`. `false` = fără. */
  analytics?: { moduleName: string } | false
}

export interface StepFormApi {
  stepKey: string
  index: number
  /** Câți pași se numără (fără recapitulare). */
  count: number
  isSummary: boolean
  canGoBack: boolean
  /** Salvarea a reușit (după `markSuccess`). */
  done: boolean
  /** „Pasul x din y”, „Verificare” sau „Editare”. */
  label: string
  /** 0–100. */
  progress: number
  /**
   * Cheia de idempotență a înregistrării (`client_sync_id`). Aceeași cât e deschis formularul, inclusiv
   * la reîncercarea după eroare; alta la `restart` și la următoarea deschidere.
   */
  clientSyncId: string
  next: () => void
  back: () => void
  goTo: (key: string) => void
  /** Deschide un pas din recapitulare; „mai departe” și „înapoi” se întorc în recapitulare. */
  editFromSummary: (key: string) => void
  /** Salvarea a reușit: trimite `create_success` și trece pe ecranul de reușită. */
  markSuccess: (metadata?: Record<string, unknown>) => void
  /** Salvarea a eșuat: trimite `create_failed`. Formularul rămâne pe loc, cu aceeași cheie de idempotență. */
  markFailed: (metadata?: Record<string, unknown>) => void
  /** Începe încă o înregistrare fără să închidă formularul (ex. „Salvează + următorul”). */
  restart: () => void
}

/**
 * Starea unui formular pe pași: navigarea, resetul la deschidere, ciclul de analytics și cheia de idempotență.
 * Modulul scrie doar conținutul pașilor și salvarea.
 */
export function useStepForm({
  steps,
  open,
  summaryKey,
  initialStep,
  mode = 'create',
  analytics = false,
}: UseStepFormOptions): StepFormApi {
  const config: StepNavConfig = { steps, summaryKey }

  const [session, setSession] = useState<StepFormSession>(() => createSession(open, generateClientId, config, initialStep))

  // La fiecare deschidere pornim de la zero (reset în timpul randării, fără effect).
  // La închidere păstrăm pasul, ca să nu sară conținutul cât se animă ieșirea.
  if (session.open !== open) {
    setSession(open ? createSession(true, generateClientId, config, initialStep) : { ...session, open: false })
  }

  const [lifecycle] = useState(() => createFormLifecycle(trackEvent))
  const moduleName = mode === 'create' && analytics ? analytics.moduleName : null

  const index = Math.min(session.nav.index, Math.max(steps.length - 1, 0))
  const nav = { ...session.nav, index }
  const stepKey = steps[index] ?? ''

  const stepKeyRef = useRef(stepKey)
  useEffect(() => {
    stepKeyRef.current = stepKey
  }, [stepKey])

  const pendingClose = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (pendingClose.current) {
      clearTimeout(pendingClose.current)
      pendingClose.current = null
    }
    if (open) lifecycle.opened(moduleName)
    else lifecycle.closed({ step: stepKeyRef.current })

    return () => {
      // Demontare cu formularul deschis = renunțare. Amânată un tick, ca remontarea din StrictMode să o anuleze.
      pendingClose.current = setTimeout(() => lifecycle.closed({ step: stepKeyRef.current }), 0)
    }
  }, [open, lifecycle, moduleName])

  const isSummary = Boolean(summaryKey) && stepKey === summaryKey

  return {
    stepKey,
    index,
    count: summaryKey && steps.includes(summaryKey) ? steps.length - 1 : steps.length,
    isSummary,
    canGoBack: !session.done && (mode === 'edit' && summaryKey ? !isSummary : navCanGoBack(nav)),
    done: session.done,
    label: session.done ? '' : mode === 'edit' ? 'Editare' : stepLabelRo(nav, config),
    progress: stepProgressPercent(nav, config, session.done),
    clientSyncId: session.clientSyncId,
    next: () => setSession((prev) => ({ ...prev, nav: navNext(prev.nav, config) })),
    back: () =>
      setSession((prev) => ({
        ...prev,
        // La editare, orice pas se întoarce în recapitulare.
        nav:
          mode === 'edit' && summaryKey
            ? navGoTo(prev.nav, config, summaryKey)
            : navBack(prev.nav, config),
      })),
    goTo: (key) => setSession((prev) => ({ ...prev, nav: navGoTo(prev.nav, config, key) })),
    editFromSummary: (key) => setSession((prev) => ({ ...prev, nav: navGoTo(prev.nav, config, key, true) })),
    markSuccess: (metadata) => {
      lifecycle.succeeded(metadata)
      setSession((prev) => ({ ...prev, done: true }))
    },
    markFailed: (metadata) => lifecycle.failed(metadata),
    restart: () => {
      lifecycle.restarted()
      setSession(createSession(true, generateClientId, config, initialStep))
    },
  }
}

// ─── Carcasa ───────────────────────────────────────────────────────────────────

export interface StepFormFooterAction {
  label: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
}

export interface StepFormFooter {
  /** Butonul principal (56 px). */
  primary: StepFormFooterAction
  /** Al doilea buton, sub cel principal (ex. „Salvează + următorul”). */
  secondary?: StepFormFooterAction
}

export interface StepFormFrameProps {
  form: StepFormApi
  onClose: () => void
  /** Înlocuiește eticheta implicită („Pasul x din y”). */
  stepLabel?: string
  /** Butoanele de jos pentru pasul curent. Fără `footer`, zona de jos dispare (pași care merg mai departe la alegere). */
  footer?: StepFormFooter | null
  /** Ce apare după `form.markSuccess()` (de obicei `SuccessScreen`). */
  success?: ReactNode
  /**
   * Prinde „înapoi” înaintea navigării (ex. închide un calendar deschis în pas).
   * Întoarce `true` dacă a tratat apăsarea.
   */
  onBack?: () => boolean
  children: ReactNode
  className?: string
}

/**
 * Carcasa formularului pe pași, fără fereastră: antet (înapoi, eticheta pasului, închide, bară de progres),
 * zonă cu scroll, zonă de jos cu unul sau două butoane.
 */
export function StepFormFrame({
  form,
  onClose,
  stepLabel,
  footer,
  success,
  onBack,
  children,
  className,
}: StepFormFrameProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 })
  }, [form.index, form.done])

  const showSuccess = form.done && Boolean(success)
  const handleBack = () => {
    if (onBack?.()) return
    form.back()
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col bg-surface text-fg', className)}>
      <div className="shrink-0 space-y-3 px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="flex min-h-touch items-center justify-between gap-2">
          <Button
            type="button"
            variant="quiet"
            size="icon-touch"
            aria-label="Înapoi"
            onClick={handleBack}
            className={cn('bg-surface-muted', !form.canGoBack && 'invisible')}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className={cn('font-semibold text-fg-muted', kitText.secondary)} aria-live="polite">
            {showSuccess ? '' : (stepLabel ?? form.label)}
          </span>
          <Button
            type="button"
            variant="quiet"
            size="icon-touch"
            aria-label="Închide"
            onClick={onClose}
            className="bg-surface-muted"
          >
            <X aria-hidden />
          </Button>
        </div>
        <div
          role="progressbar"
          aria-label="Progresul formularului"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={form.progress}
          className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${form.progress}%` }}
          />
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {showSuccess ? success : children}
      </div>

      {footer && !showSuccess ? (
        <div className="flex shrink-0 flex-col gap-2.5 border-t border-border-subtle bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
          <Button
            type="button"
            variant="primary"
            size="touch-lg"
            className="w-full"
            disabled={footer.primary.disabled}
            loading={footer.primary.loading}
            onClick={footer.primary.onClick}
          >
            {footer.primary.loading ? null : footer.primary.icon}
            {footer.primary.label}
          </Button>
          {footer.secondary ? (
            <Button
              type="button"
              variant="neutral"
              size="touch-lg"
              className="w-full"
              disabled={footer.secondary.disabled}
              loading={footer.secondary.loading}
              onClick={footer.secondary.onClick}
            >
              {footer.secondary.loading ? null : footer.secondary.icon}
              {footer.secondary.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export interface StepFormProps extends Omit<StepFormFrameProps, 'onClose' | 'className'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Numele ferestrei pentru cititoarele de ecran (ex. „Adaugă kilograme”). */
  title: string
  description?: string
}

/**
 * Formular pe pași într-o fereastră: ecran plin pe telefon, card de 480 px pe desktop.
 * Peste `ui/dialog` (portal, capcană de focus, Esc, ascunderea butonului plutitor, „înapoi” pe Android).
 */
export function StepForm({ open, onOpenChange, title, description, ...frameProps }: StepFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        mobileFullHeight
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-surface p-0 text-fg shadow-overlay sm:max-w-none sm:p-0 md:h-[min(90dvh,860px)] md:max-h-[min(90dvh,860px)] md:w-[min(96vw,480px)] md:rounded-card md:border md:border-border"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description ?? 'Completezi pas cu pas.'}</DialogDescription>
        <StepFormFrame {...frameProps} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** Titlul unui pas: supratitlu opțional + întrebarea pasului (26 px). */
export function StepFormTitle({ eyebrow, children }: { eyebrow?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1">
      {eyebrow ? <p className={cn('font-bold text-primary', kitText.secondary)}>{eyebrow}</p> : null}
      <h2 className={cn('font-extrabold text-fg', kitText.screen)}>{children}</h2>
    </div>
  )
}
