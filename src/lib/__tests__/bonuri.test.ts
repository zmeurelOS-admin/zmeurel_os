import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BON_JPEG_QUALITY,
  BON_UNREADABLE_MESSAGE,
  BonImageError,
  bonStoragePath,
  bonStoragePathOf,
  fitWithin,
  prepareBonImage,
  resolveBonLink,
  textSalvat,
} from '@/lib/bonuri'

describe('fitWithin', () => {
  it('micșorează latura mare la 1600 px și păstrează proporția', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 })
  })

  it('lasă neatinsă o poză mai mică de 1600 px', () => {
    expect(fitWithin(1200, 900)).toEqual({ width: 1200, height: 900 })
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })
})

describe('prepareBonImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function stubCanvas() {
    const drawImage = vi.fn()
    const exported: Array<{ width: number; height: number; type?: string; quality?: unknown }> = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ fillStyle: '', fillRect: vi.fn(), drawImage }) as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
      quality?: unknown,
    ) {
      exported.push({ width: this.width, height: this.height, type, quality })
      callback(new Blob(['jpeg'], { type: type ?? 'image/png' }))
    })
    return { drawImage, exported }
  }

  it('exportă JPEG 0,8 cu latura mare de 1600 px', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4032, height: 3024, close })))
    const { drawImage, exported } = stubCanvas()

    const blob = await prepareBonImage(new Blob(['x'], { type: 'image/heic' }))

    expect(blob.type).toBe('image/jpeg')
    expect(exported).toEqual([{ width: 1600, height: 1200, type: 'image/jpeg', quality: BON_JPEG_QUALITY }])
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200)
    expect(close).toHaveBeenCalled()
  })

  it('nu mărește o poză mică', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })))
    const { exported } = stubCanvas()

    await prepareBonImage(new Blob(['x'], { type: 'image/jpeg' }))

    expect(exported[0]).toMatchObject({ width: 800, height: 600 })
  })

  it('o poză care nu se poate decoda dă mesajul pentru fermier', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode')
      }),
    )
    // jsdom nu are `decode` și nici `URL.createObjectURL`.
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error('decode')
      }),
    })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }))
    stubCanvas()

    const promise = prepareBonImage(new Blob(['nu e poză'], { type: 'text/plain' }))
    await expect(promise).rejects.toBeInstanceOf(BonImageError)
    await expect(promise).rejects.toThrow(BON_UNREADABLE_MESSAGE)
  })
})

describe('legătura bonului', () => {
  it('un URL vechi se deschide direct', () => {
    expect(resolveBonLink('https://exemplu.ro/bon.pdf')).toEqual({ kind: 'direct', url: 'https://exemplu.ro/bon.pdf' })
    expect(resolveBonLink('http://exemplu.ro/bon.jpg')).toEqual({ kind: 'direct', url: 'http://exemplu.ro/bon.jpg' })
    expect(bonStoragePathOf('https://exemplu.ro/bon.pdf')).toBeNull()
  })

  it('o cale din bucket cere URL semnat', () => {
    const path = bonStoragePath('tenant-1', 'cheltuieli', 'cheie-1')
    expect(path).toBe('tenant-1/cheltuieli/cheie-1.jpg')
    expect(resolveBonLink(path)).toEqual({ kind: 'storage', path })
    expect(bonStoragePathOf(path)).toBe(path)
  })

  it('fără valoare nu e niciun bon', () => {
    expect(resolveBonLink(null)).toBeNull()
    expect(resolveBonLink('')).toBeNull()
    expect(resolveBonLink('   ')).toBeNull()
  })
})

describe('textSalvat', () => {
  it('cu bon sau fără poză aleasă: doar rezumatul', () => {
    expect(textSalvat('Ambalaje · 12,50 lei', null)).toBe('Ambalaje · 12,50 lei')
  })

  it('„Salvează fără bon” după o urcare picată: spune „fără bon”', () => {
    expect(textSalvat('Ambalaje · 12,50 lei', 'ales')).toBe('Ambalaje · 12,50 lei · fără bon. Poza o adaugi din „Editează”.')
  })

  it('fără internet: spune „fără bon” și că poza se adaugă cu internet', () => {
    expect(textSalvat('Ambalaje · 12,50 lei', 'offline')).toBe(
      'Ambalaje · 12,50 lei · fără bon. Poza o adaugi din „Editează”, cu internet.',
    )
  })
})
