/**
 * Salvarea unei recoltări, o singură dată per cheie a formularului (`form.clientSyncId`).
 * Cheia e aceeași cât e deschis formularul (inclusiv la reîncercare) și alta la „Următorul culegător”.
 *
 * Dublurile le oprește serverul: cheia se trimite ca `client_sync_id`, iar `create_recoltare_idempotent`
 * întoarce recoltarea deja creată când aceeași cheie vine a doua oară. Garda adaugă doar ce ține de ecran:
 * 1. Cât o trimitere e în curs, a doua apăsare nu trimite nimic.
 * 2. După o salvare reușită, garda nu mai trimite (întoarce ce s-a salvat).
 * 3. Spune când serverul are alte valori decât cele din formular (aceeași cheie, kilograme schimbate
 *    între încercări): corectarea se face de mână, nu automat.
 */
import type { CreateRecoltareInput, Recoltare, RecoltareMutationResult } from '@/lib/supabase/queries/recoltari'

import { savedDiffersFromAttempt, type RecoltareAttempt } from './day-view'

export interface RecoltareSaveGuard {
  /** Cheia formularului pentru care a fost creată garda; se trimite ca `client_sync_id`. */
  readonly key: string
  inFlight: boolean
  saved: RecoltareSaved | null
}

export interface RecoltareSaved {
  status: 'saved'
  recoltare: Recoltare
  /** Salvată, dar sincronizarea manoperei a eșuat. */
  warning?: string
  /** Serverul are alte valori decât cele din formular (kilograme schimbate între încercări). */
  differs: boolean
}

export type RecoltareSaveOutcome = RecoltareSaved | { status: 'busy' } | { status: 'failed'; error: string }

export function createRecoltareSaveGuard(key: string): RecoltareSaveGuard {
  return { key, inFlight: false, saved: null }
}

export async function saveRecoltareGuarded(params: {
  guard: RecoltareSaveGuard
  attempt: RecoltareAttempt
  observatii?: string
  create: (input: CreateRecoltareInput) => Promise<RecoltareMutationResult>
}): Promise<RecoltareSaveOutcome> {
  const { guard, attempt, observatii, create } = params

  if (guard.saved) return guard.saved
  if (guard.inFlight) return { status: 'busy' }

  guard.inFlight = true
  try {
    let result: RecoltareMutationResult
    try {
      result = await create({ ...attempt, observatii, client_sync_id: guard.key })
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error && error.message ? error.message : 'Recoltarea nu s-a salvat.',
      }
    }

    if (!result.success) {
      return { status: 'failed', error: result.error || 'Recoltarea nu s-a salvat.' }
    }

    guard.saved = {
      status: 'saved',
      recoltare: result.data,
      warning: result.warning,
      differs: savedDiffersFromAttempt(result.data, attempt),
    }
    return guard.saved
  } finally {
    guard.inFlight = false
  }
}
