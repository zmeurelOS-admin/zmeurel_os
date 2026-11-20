'use client'

import {
  DESTRUCTIVE_STEP_UP_HEADER,
  destructiveActionScopes,
  type DestructiveActionScope,
} from '@/lib/auth/destructive-action-step-up-contract'

/**
 * Ștergerile din Setări › Contul tău › Ireversibil, pe fluxurile de dinainte:
 * parola → token de confirmare (`/api/auth/destructive-step-up`) → cererea de ștergere.
 */

function getApiErrorMessage(payload: { error?: string | { message?: string } | null }, fallback: string) {
  if (typeof payload.error === 'string') return payload.error
  if (payload.error && typeof payload.error === 'object' && payload.error.message) return payload.error.message
  return fallback
}

async function requestStepUpToken(scope: DestructiveActionScope, password: string): Promise<string> {
  const response = await fetch('/api/auth/destructive-step-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, password }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    stepUpToken?: string
    error?: string | { message?: string }
  }
  if (!response.ok || payload.ok !== true || typeof payload.stepUpToken !== 'string') {
    throw new Error(getApiErrorMessage(payload, 'Confirmarea a eșuat. Verifică parola și încearcă din nou.'))
  }
  return payload.stepUpToken
}

/** „Șterge datele fermei”: contul rămâne, ferma o iei de la zero (`POST /api/farm/reset`, ca până acum). */
export async function resetFarmData(password: string): Promise<void> {
  const stepUpToken = await requestStepUpToken(destructiveActionScopes.farmReset, password)
  const response = await fetch('/api/farm/reset', {
    method: 'POST',
    headers: { [DESTRUCTIVE_STEP_UP_HEADER]: stepUpToken },
  })
  const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string | { message?: string } }
  if (!response.ok || payload.success !== true) {
    throw new Error(getApiErrorMessage(payload, 'Nu am putut șterge datele fermei.'))
  }
}

/** „Șterge contul”: contul și ferma dispar de tot (`DELETE /api/gdpr/account`). */
export async function deleteAccountAndFarm(password: string): Promise<void> {
  const stepUpToken = await requestStepUpToken(destructiveActionScopes.gdprAccountDelete, password)
  const response = await fetch('/api/gdpr/account', {
    method: 'DELETE',
    headers: { [DESTRUCTIVE_STEP_UP_HEADER]: stepUpToken },
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string | { message?: string } }
  if (!response.ok) throw new Error(getApiErrorMessage(payload, 'Nu am putut șterge contul.'))
}
