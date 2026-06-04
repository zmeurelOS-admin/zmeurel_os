'use client'

const NOTIFICATION_ASKED_KEY = 'zmeurel_notif_asked'
const NOTIFICATION_SESSION_KEY = 'zmeurel_notif_session'

function storageValue(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function shouldShowNotificationPrompt(): boolean {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (Notification.permission === 'denied') return false
  if (Notification.permission === 'granted') return false
  if (storageValue(window.localStorage, NOTIFICATION_ASKED_KEY) === 'true') return false
  if (storageValue(window.sessionStorage, NOTIFICATION_SESSION_KEY) === 'true') return false

  return Notification.permission === 'default'
}

export function markAsked(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NOTIFICATION_ASKED_KEY, 'true')
  } catch {
    // Best-effort browser preference.
  }
}

export function markNotificationPromptSession(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(NOTIFICATION_SESSION_KEY, 'true')
  } catch {
    // Best-effort browser preference.
  }
}
