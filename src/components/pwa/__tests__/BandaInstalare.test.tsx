import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ email: 'ion@example.com' as string | null }))

vi.mock('@/components/app/DashboardAuthContext', () => ({ useDashboardAuth: () => ({ email: state.email }) }))

import { BandaInstalare } from '@/components/pwa/BandaInstalare'
import { ascultaInstalarea } from '@/lib/pwa/instalare'

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36'
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

/** Ziua de ieri: banda apare de la a doua zi de folosire. */
function folositDeIeri() {
  const ieri = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date(Date.now() - 86_400_000))
  window.localStorage.setItem('zmeurel_instalare', JSON.stringify({ primaZi: ieri, aSalvat: false, inchisaLa: null }))
}

beforeEach(() => {
  window.localStorage.clear()
  state.email = 'ion@example.com'
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('BandaInstalare (promptul 34, §4)', () => {
  it('Android cu promptul prins: „Instalează” deschide promptul sistemului', async () => {
    setUserAgent(UA_ANDROID)
    folositDeIeri()
    ascultaInstalarea()
    const prompt = vi.fn(async () => undefined)
    const eveniment = Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) })
    render(<BandaInstalare />)
    act(() => {
      window.dispatchEvent(eveniment)
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Instalează' }))
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('iPhone: „Instalează” deschide foaia cu pașii din Safari', async () => {
    setUserAgent(UA_IPHONE)
    folositDeIeri()
    render(<BandaInstalare />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Instalează' }))
    expect(await screen.findByRole('list', { name: 'Pașii pe iPhone' })).toBeTruthy()
    expect(screen.getByText('Alege „Adaugă pe ecranul principal”')).toBeTruthy()
  })

  it('demo: banda nu apare; X o ascunde', async () => {
    setUserAgent(UA_ANDROID)
    folositDeIeri()
    state.email = 'x@demo.zmeurel.local'
    const { unmount } = render(<BandaInstalare />)
    expect(screen.queryByRole('region', { name: 'Instalează aplicația' })).toBeNull()
    unmount()

    state.email = 'ion@example.com'
    render(<BandaInstalare />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Nu acum' }))
    expect(screen.queryByRole('region', { name: 'Instalează aplicația' })).toBeNull()
  })
})
