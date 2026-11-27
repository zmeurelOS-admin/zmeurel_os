import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '@/components/app/AppShell'

/** jsdom nu desenează: înălțimea barei vine din `offsetHeight`, simulat. */
let inaltime = 64
let original: typeof window.ResizeObserver

/** Ca în browser: `ResizeObserver` raportează imediat după `observe`. */
class ResizeObserverCaInBrowser {
  constructor(private readonly callback: () => void) {}
  observe() {
    this.callback()
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => inaltime)
  original = window.ResizeObserver
  ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverCaInBrowser
})

afterEach(() => {
  vi.restoreAllMocks()
  ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = original
})

describe('AppShell — bara fixată jos (promptul 34, §6)', () => {
  it('lasă dedesubt înălțimea barei + distanța față de bara de jos + aer, peste bara de jos și zona sigură', async () => {
    inaltime = 122
    const { container } = render(
      <AppShell bottomBarFixed bottomBar={<button type="button">Lucrare</button>}>
        <p>Jurnal</p>
      </AppShell>,
    )
    const continut = screen.getByText('Jurnal').parentElement?.parentElement as HTMLElement
    await waitFor(() => expect(continut.style.paddingBottom).toBe('calc(var(--app-nav-clearance) + 150px)'))
    expect(container.querySelector('.fixed')).not.toBeNull()
  })

  it('fără bară fixă, doar bara de jos', () => {
    render(
      <AppShell>
        <p>Jurnal</p>
      </AppShell>,
    )
    const continut = screen.getByText('Jurnal').parentElement?.parentElement as HTMLElement
    expect(continut.style.paddingBottom).toBe('var(--app-nav-clearance)')
  })
})
