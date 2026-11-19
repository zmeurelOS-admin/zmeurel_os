/**
 * Salvarea unei recoltări fără dubluri, cât timp serverul nu primește o cheie de idempotență.
 * O „gardă” ține de o cheie a formularului (`form.clientSyncId`): aceeași cât e deschis formularul,
 * alta la „Următorul culegător”.
 *
 * Reguli:
 * 1. Cât o trimitere e în curs, a doua apăsare nu trimite nimic.
 * 2. După o salvare reușită, garda nu mai trimite (întoarce ce s-a salvat).
 * 3. Înaintea oricărei reîncercări, recitește recoltările și caută una apărută de la prima trimitere,
 *    cu datele uneia dintre încercările de până atunci. Dacă există, trimiterea ajunsese la server.
 *    Dacă recitirea nu reușește (fără internet), NU retrimite.
 */
import type { CreateRecoltareInput, Recoltare, RecoltareMutationResult } from '@/lib/supabase/queries/recoltari'

import { findNewMatchingRecoltare, savedDiffersFromAttempt, type RecoltareAttempt } from './day-view'

export interface RecoltareSaveGuard {
  /** Cheia formularului pentru care a fost creată garda. */
  readonly key: string
  /** Id-urile recoltărilor cunoscute înainte de prima trimitere. */
  readonly knownIds: ReadonlySet<string>
  /** Datele trimise la fiecare încercare de până acum. */
  attempts: RecoltareAttempt[]
  inFlight: boolean
  saved: RecoltareSaved | null
}

export interface RecoltareSaved {
  status: 'saved'
  recoltare: Recoltare
  /** Salvată, dar sincronizarea manoperei a eșuat. */
  warning?: string
  /** Găsită pe server după o trimitere rămasă fără răspuns (nu s-a mai trimis a doua oară). */
  recovered: boolean
  /** Serverul are alte valori decât cele din formular (kilograme schimbate între încercări). */
  differs: boolean
}

export type RecoltareSaveOutcome =
  | RecoltareSaved
  | { status: 'busy' }
  | {
      status: 'failed'
      error: string
      /** Nu s-a putut verifica dacă trimiterea anterioară a ajuns; nu s-a retrimis. */
      unverified: boolean
    }

export const UNVERIFIED_SAVE_MESSAGE =
  'Nu am putut verifica dacă recoltarea s-a salvat. Verifică internetul și apasă din nou „Salvează”.'

export function createRecoltareSaveGuard(key: string, knownRecoltari: readonly Pick<Recoltare, 'id'>[]): RecoltareSaveGuard {
  return {
    key,
    knownIds: new Set(knownRecoltari.map((recoltare) => recoltare.id)),
    attempts: [],
    inFlight: false,
    saved: null,
  }
}

export async function saveRecoltareGuarded(params: {
  guard: RecoltareSaveGuard
  attempt: RecoltareAttempt
  observatii?: string
  /** Recitește recoltările de pe server (fără cache). Aruncă dacă nu reușește. */
  refetch: () => Promise<readonly Recoltare[]>
  create: (input: CreateRecoltareInput) => Promise<RecoltareMutationResult>
}): Promise<RecoltareSaveOutcome> {
  const { guard, attempt, observatii, refetch, create } = params

  if (guard.saved) return guard.saved
  if (guard.inFlight) return { status: 'busy' }

  guard.inFlight = true
  try {
    if (guard.attempts.length > 0) {
      let fresh: readonly Recoltare[]
      try {
        fresh = await refetch()
      } catch {
        return { status: 'failed', error: UNVERIFIED_SAVE_MESSAGE, unverified: true }
      }

      // De la cea mai nouă încercare spre cea mai veche: ultima trimisă e cea mai probabil ajunsă.
      for (let index = guard.attempts.length - 1; index >= 0; index -= 1) {
        const existing = findNewMatchingRecoltare({
          recoltari: fresh,
          knownIds: guard.knownIds,
          attempt: guard.attempts[index],
        })
        if (existing) {
          guard.saved = {
            status: 'saved',
            recoltare: existing,
            recovered: true,
            differs: savedDiffersFromAttempt(existing, attempt),
          }
          return guard.saved
        }
      }
    }

    guard.attempts.push({ ...attempt })

    let result: RecoltareMutationResult
    try {
      result = await create({ ...attempt, observatii })
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error && error.message ? error.message : 'Recoltarea nu s-a salvat.',
        unverified: false,
      }
    }

    if (!result.success) {
      return { status: 'failed', error: result.error || 'Recoltarea nu s-a salvat.', unverified: false }
    }

    guard.saved = {
      status: 'saved',
      recoltare: result.data,
      warning: result.warning,
      recovered: false,
      differs: savedDiffersFromAttempt(result.data, attempt),
    }
    return guard.saved
  } finally {
    guard.inFlight = false
  }
}
