import { calculeazaZileRamase, formatDozaLabel } from '@/lib/tratamente/scheduler'

describe('scheduler helpers', () => {
  describe('formatDozaLabel', () => {
    it('formatează corect doza în ml/hl', () => {
      expect(formatDozaLabel(500, null)).toBe('500 ml/hl')
    })

    it('formatează corect doza în L/ha', () => {
      expect(formatDozaLabel(null, 2)).toBe('2 L/ha')
    })

    it('prioritizează L/ha când ambele valori sunt populate', () => {
      expect(formatDozaLabel(500, 2)).toBe('2 L/ha')
    })

    it('returnează null când lipsesc ambele doze', () => {
      expect(formatDozaLabel(null, null)).toBeNull()
    })
  })

  describe('calculeazaZileRamase', () => {
    const now = new Date('2026-04-16T09:00:00.000Z')

    it('returnează 0 pentru aplicările planificate azi', () => {
      expect(calculeazaZileRamase('2026-04-16', now)).toBe(0)
    })

    it('returnează 1 pentru aplicările planificate mâine', () => {
      expect(calculeazaZileRamase('2026-04-17', now)).toBe(1)
    })

    it('returnează null pentru alte zile', () => {
      expect(calculeazaZileRamase('2026-04-18', now)).toBeNull()
    })

    it('respectă fusul Europe/Bucharest aproape de miezul nopții', () => {
      const almostMidnightUtc = new Date('2026-04-15T22:30:00.000Z')

      expect(calculeazaZileRamase('2026-04-16', almostMidnightUtc)).toBe(0)
      expect(calculeazaZileRamase('2026-04-17', almostMidnightUtc)).toBe(1)
    })
  })
})
