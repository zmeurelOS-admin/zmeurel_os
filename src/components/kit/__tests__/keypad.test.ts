import { describe, expect, it } from 'vitest'

import {
  applyKeypadKey,
  keypadKeyFromKeyboard,
  parseKeypadValue,
  pressKeypadField,
  type KeypadKey,
} from '@/components/kit/lib/keypad'

const type = (keys: KeypadKey[], start = '') => keys.reduce((value, key) => applyKeypadKey(value, key), start)

describe('tastatura numerică — applyKeypadKey', () => {
  it('pornește de la gol și adaugă cifrele în ordine', () => {
    expect(type([])).toBe('')
    expect(type(['2', '7'])).toBe('27')
  })

  it('scrie o valoare de cântar cu zecimale', () => {
    expect(type(['2', '7', ',', '3', '5'])).toBe('27,35')
  })

  it('acceptă o singură virgulă', () => {
    expect(type(['2', ',', ',', '5', ','])).toBe('2,5')
  })

  it('acceptă cel mult 2 zecimale', () => {
    expect(type(['2', ',', '3', '5', '9', '1'])).toBe('2,35')
  })

  it('virgula pe câmp gol scrie „0,”', () => {
    expect(type([','])).toBe('0,')
    expect(type([',', '5'])).toBe('0,5')
  })

  it('un zero de început nu se adună', () => {
    expect(type(['0', '0'])).toBe('0')
    expect(type(['0', '5'])).toBe('5')
    expect(type(['0', ',', '0', '5'])).toBe('0,05')
  })

  it('ștergerea scoate ultimul caracter, inclusiv virgula, până la gol', () => {
    expect(type(['backspace'], '27,35')).toBe('27,3')
    expect(type(['backspace', 'backspace'], '27,3')).toBe('27')
    expect(type(['backspace', 'backspace', 'backspace'], '27')).toBe('')
  })

  it('după ștergerea virgulei se poate pune din nou', () => {
    expect(type(['backspace', 'backspace', ',', '5'], '2,3')).toBe('2,5')
  })

  it('limitează partea întreagă (implicit 4 cifre)', () => {
    expect(type(['1', '2', '3', '4', '5'])).toBe('1234')
    expect(type(['1', '2', '3', '4', ',', '5'])).toBe('1234,5')
  })

  it('fără zecimale, virgula e ignorată', () => {
    expect(applyKeypadKey('12', ',', { maxDecimals: 0 })).toBe('12')
  })
})

describe('tastatura numerică — valoarea', () => {
  it('câmpul gol e necompletat, nu zero', () => {
    expect(parseKeypadValue('')).toBeNull()
  })

  it('transformă textul cu virgulă în număr', () => {
    expect(parseKeypadValue('27,35')).toBe(27.35)
    expect(parseKeypadValue('27,')).toBe(27)
    expect(parseKeypadValue('0,')).toBe(0)
  })
})

describe('tastatura numerică — mai multe câmpuri', () => {
  it('tasta ajunge doar în câmpul activ', () => {
    const start = { cal1: '', cal2: '' }
    const afterCal1 = pressKeypadField(pressKeypadField(start, 'cal1', '2'), 'cal1', '7')
    expect(afterCal1).toEqual({ cal1: '27', cal2: '' })

    const afterCal2 = pressKeypadField(afterCal1, 'cal2', '3')
    expect(afterCal2).toEqual({ cal1: '27', cal2: '3' })
  })

  it('nu modifică obiectul primit', () => {
    const start = { cal1: '1', cal2: '' }
    pressKeypadField(start, 'cal1', '2')
    expect(start).toEqual({ cal1: '1', cal2: '' })
  })
})

describe('tastatura numerică — tastatura fizică', () => {
  it('cifre, virgulă, punct și Backspace', () => {
    expect(keypadKeyFromKeyboard('7')).toBe('7')
    expect(keypadKeyFromKeyboard(',')).toBe(',')
    expect(keypadKeyFromKeyboard('.')).toBe(',')
    expect(keypadKeyFromKeyboard('Backspace')).toBe('backspace')
  })

  it('ignoră restul tastelor', () => {
    expect(keypadKeyFromKeyboard('a')).toBeNull()
    expect(keypadKeyFromKeyboard('Enter')).toBeNull()
    expect(keypadKeyFromKeyboard('F5')).toBeNull()
  })
})
