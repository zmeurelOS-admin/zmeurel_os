import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { esteScurtaturaCautare } from '@/components/app/CautareGlobala'

const tasta = (extra: Partial<Parameters<typeof esteScurtaturaCautare>[0]> = {}) => ({
  key: 'k',
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  defaultPrevented: false,
  target: document.body,
  ...extra,
})

describe('Ctrl K / ⌘ K (promptul 35, §2)', () => {
  beforeEach(() => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })
  afterEach(() => vi.restoreAllMocks())

  it('Ctrl K și ⌘ K deschid căutarea', () => {
    expect(esteScurtaturaCautare(tasta())).toBe(true)
    expect(esteScurtaturaCautare(tasta({ ctrlKey: false, metaKey: true, key: 'K' }))).toBe(true)
  })

  it('nu se atinge într-un câmp de text, cu alte modificatoare sau dacă altcineva a tratat tasta', () => {
    const camp = document.createElement('input')
    expect(esteScurtaturaCautare(tasta({ target: camp }))).toBe(false)
    expect(esteScurtaturaCautare(tasta({ target: document.createElement('textarea') }))).toBe(false)
    expect(esteScurtaturaCautare(tasta({ shiftKey: true }))).toBe(false)
    expect(esteScurtaturaCautare(tasta({ altKey: true }))).toBe(false)
    expect(esteScurtaturaCautare(tasta({ defaultPrevented: true }))).toBe(false)
    expect(esteScurtaturaCautare(tasta({ ctrlKey: false }))).toBe(false)
    expect(esteScurtaturaCautare(tasta({ key: 'j' }))).toBe(false)
  })

  it('nu se atinge când pagina nu are focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    expect(esteScurtaturaCautare(tasta())).toBe(false)
  })
})
