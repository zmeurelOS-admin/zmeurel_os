/** Logica formularului pe pași, fără React: navigare, ciclul de analytics, sesiunea (cheia de idempotență). */

// ─── Navigare ──────────────────────────────────────────────────────────────────

export interface StepNavState {
  /** Indexul pasului curent în lista de pași. */
  index: number
  /** Pasul a fost deschis din recapitulare („Schimbă”): „mai departe” și „înapoi” se întorc acolo. */
  returnToSummary: boolean
}

export interface StepNavConfig {
  steps: readonly string[]
  /** Cheia pasului de recapitulare, dacă formularul are unul. */
  summaryKey?: string
}

const clampIndex = (index: number, steps: readonly string[]) => Math.min(Math.max(index, 0), Math.max(steps.length - 1, 0))

function summaryIndex({ steps, summaryKey }: StepNavConfig): number {
  return summaryKey ? steps.indexOf(summaryKey) : -1
}

export function initialNavState(config: StepNavConfig, initialStep?: string): StepNavState {
  const index = initialStep ? config.steps.indexOf(initialStep) : 0
  return { index: clampIndex(index < 0 ? 0 : index, config.steps), returnToSummary: false }
}

export function navNext(state: StepNavState, config: StepNavConfig): StepNavState {
  const summary = summaryIndex(config)
  if (state.returnToSummary && summary >= 0) return { index: summary, returnToSummary: false }
  return { index: clampIndex(state.index + 1, config.steps), returnToSummary: false }
}

export function navBack(state: StepNavState, config: StepNavConfig): StepNavState {
  const summary = summaryIndex(config)
  if (state.returnToSummary && summary >= 0) return { index: summary, returnToSummary: false }
  return { index: clampIndex(state.index - 1, config.steps), returnToSummary: false }
}

/** Sare la un pas. Cu `fromSummary`, pasul se întoarce apoi în recapitulare. */
export function navGoTo(state: StepNavState, config: StepNavConfig, key: string, fromSummary = false): StepNavState {
  const index = config.steps.indexOf(key)
  if (index < 0) return state
  return { index, returnToSummary: fromSummary && summaryIndex(config) >= 0 && index !== summaryIndex(config) }
}

export function navCanGoBack(state: StepNavState): boolean {
  return state.returnToSummary || state.index > 0
}

/** Pașii numărați în „Pasul x din y” (recapitularea nu se numără). */
export function countedSteps(config: StepNavConfig): number {
  return summaryIndex(config) >= 0 ? config.steps.length - 1 : config.steps.length
}

export function stepLabelRo(state: StepNavState, config: StepNavConfig): string {
  if (state.index === summaryIndex(config)) return 'Verificare'
  return `Pasul ${state.index + 1} din ${countedSteps(config)}`
}

/** Cât la sută din formular e parcurs (pasul curent inclus). */
export function stepProgressPercent(state: StepNavState, config: StepNavConfig, done = false): number {
  if (done || config.steps.length === 0) return 100
  return Math.round(((state.index + 1) / config.steps.length) * 100)
}

// ─── Ciclul de analytics ───────────────────────────────────────────────────────

export interface FormTrackEvent {
  eventName: 'open_create_form' | 'create_success' | 'create_failed' | 'form_abandoned'
  moduleName: string
  status: 'started' | 'success' | 'failed' | 'abandoned'
  metadata?: Record<string, unknown>
}

export type FormTracker = (event: FormTrackEvent) => void

export interface FormLifecycle {
  /**
   * Formularul s-a deschis. Apelat de mai multe ori pe aceeași deschidere, trimite un singur eveniment.
   * `moduleName = null` oprește urmărirea pentru această deschidere (editare, pagini demonstrative).
   */
  opened: (moduleName: string | null) => void
  /** Formularul s-a închis. Fără salvare reușită înainte, trimite `form_abandoned` (o singură dată). */
  closed: (metadata?: Record<string, unknown>) => void
  succeeded: (metadata?: Record<string, unknown>) => void
  failed: (metadata?: Record<string, unknown>) => void
  /** După o salvare reușită, utilizatorul începe încă una fără să închidă formularul. */
  restarted: () => void
}

/**
 * `open_create_form` → `create_success` / `create_failed` / `form_abandoned`, ca în restul aplicației
 * (tiparul `submittedRef` + `hasOpenedRef`), ținut într-un singur loc.
 */
export function createFormLifecycle(track: FormTracker): FormLifecycle {
  let isOpen = false
  let submitted = false
  let activeModule: string | null = null

  const send = (event: Omit<FormTrackEvent, 'moduleName'>) => {
    if (activeModule === null) return
    track({ ...event, moduleName: activeModule })
  }

  return {
    opened(moduleName) {
      if (isOpen) return
      isOpen = true
      submitted = false
      activeModule = moduleName
      send({ eventName: 'open_create_form', status: 'started' })
    },
    closed(metadata) {
      if (!isOpen) return
      isOpen = false
      if (!submitted) send({ eventName: 'form_abandoned', status: 'abandoned', metadata })
    },
    succeeded(metadata) {
      if (!isOpen || submitted) return
      submitted = true
      send({ eventName: 'create_success', status: 'success', metadata })
    },
    failed(metadata) {
      if (!isOpen) return
      send({ eventName: 'create_failed', status: 'failed', metadata })
    },
    restarted() {
      if (!isOpen) return
      submitted = false
      send({ eventName: 'open_create_form', status: 'started' })
    },
  }
}

// ─── Sesiunea unei deschideri ──────────────────────────────────────────────────

export interface StepFormSession {
  /** Starea `open` pentru care a fost creată sesiunea. */
  open: boolean
  /**
   * Cheia de idempotență (`client_sync_id`) a înregistrării create în această deschidere.
   * Rămâne aceeași la reîncercarea după o eroare, deci serverul nu creează dubluri.
   */
  clientSyncId: string
  nav: StepNavState
  /** Salvarea a reușit; formularul arată ecranul de reușită. */
  done: boolean
}

export function createSession(
  open: boolean,
  generateId: () => string,
  config: StepNavConfig,
  initialStep?: string,
): StepFormSession {
  return { open, clientSyncId: generateId(), nav: initialNavState(config, initialStep), done: false }
}
