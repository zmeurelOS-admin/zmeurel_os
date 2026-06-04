import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  markAsked,
  markNotificationPromptSession,
  shouldShowNotificationPrompt,
} from '@/lib/shop/useNotificationPrompt'

function setPermission(permission: NotificationPermission) {
  Object.defineProperty(window.Notification, 'permission', {
    configurable: true,
    get: () => permission,
  })
}

describe('shop notification prompt decision', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.restoreAllMocks()
    if (!('Notification' in window)) {
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: class NotificationMock {},
      })
    }
    setPermission('default')
  })

  it('se afișează doar când permisiunea este default și nu a fost cerută', () => {
    expect(shouldShowNotificationPrompt()).toBe(true)
  })

  it('nu se afișează după permisiune granted sau denied', () => {
    setPermission('granted')
    expect(shouldShowNotificationPrompt()).toBe(false)

    setPermission('denied')
    expect(shouldShowNotificationPrompt()).toBe(false)
  })

  it('nu se afișează după markAsked', () => {
    markAsked()
    expect(window.localStorage.getItem('zmeurel_notif_asked')).toBe('true')
    expect(shouldShowNotificationPrompt()).toBe(false)
  })

  it('nu reapare în aceeași sesiune după Mai târziu', () => {
    markNotificationPromptSession()
    expect(window.sessionStorage.getItem('zmeurel_notif_session')).toBe('true')
    expect(shouldShowNotificationPrompt()).toBe(false)
  })
})
