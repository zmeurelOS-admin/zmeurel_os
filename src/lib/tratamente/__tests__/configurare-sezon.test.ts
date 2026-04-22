import { describe, expect, it } from 'vitest'

import {
  getLabelStadiuContextual,
  getSistemConducereLabel,
  getTipCicluSoiLabel,
  needsCohortSelection,
  needsConfigurareSezon,
} from '@/lib/tratamente/configurare-sezon'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'

const configurareNedeterminata: ConfigurareSezon = {
  id: 'cfg-1',
  tenant_id: 'tenant-1',
  parcela_id: 'parcela-1',
  an: 2026,
  sistem_conducere: null,
  tip_ciclu_soi: 'nedeterminat',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const configurareMixta: ConfigurareSezon = {
  ...configurareNedeterminata,
  sistem_conducere: 'mixt_floricane_primocane',
}

const configurarePrimocaneOnly: ConfigurareSezon = {
  ...configurareNedeterminata,
  sistem_conducere: 'primocane_only',
}

describe('configurare sezonieră', () => {
  it('înlocuiește post-recoltare cu Producție în curs la solanacee nedeterminat', () => {
    expect(getLabelStadiuContextual('post_recoltare', configurareNedeterminata)).toBe('Producție în curs')
  })

  it('păstrează label-ul canonice pentru rubus când configurarea nu schimbă stadiul', () => {
    expect(getLabelStadiuContextual('inflorit', configurareNedeterminata)).toBe('Înflorit')
  })

  it('folosește vocabular Rubus când există sistem de conducere sezonier', () => {
    expect(getLabelStadiuContextual('buton_verde', configurareMixta)).toBe('Inflorescențe vizibile')
    expect(
      getLabelStadiuContextual('buton_verde', configurareMixta, {
        cohort: 'primocane',
      })
    ).toBe('Creștere lăstari primocane')
  })

  it('activează configurarea sezonieră doar pentru rubus și solanacee', () => {
    expect(needsConfigurareSezon('rubus')).toBe(true)
    expect(needsConfigurareSezon('solanacee')).toBe(true)
    expect(needsConfigurareSezon('frunzoase')).toBe(false)
  })

  it('formatează etichetele pentru sistemul de conducere și tipul de ciclu', () => {
    expect(getSistemConducereLabel('primocane_only')).toBe('Doar lăstari an 1 (primocane)')
    expect(getSistemConducereLabel('mixt_floricane_primocane')).toBe('Mixt: lăstari an 1 + an 2')
    expect(getTipCicluSoiLabel('determinat')).toBe('Soi determinat')
    expect(getTipCicluSoiLabel('nedeterminat')).toBe('Soi nedeterminat')
  })

  it('activează cohort trigger doar pentru rubus mixt cu configurare explicită', () => {
    expect(needsCohortSelection('rubus', configurareMixta)).toBe(true)
    expect(needsCohortSelection('rubus', configurarePrimocaneOnly)).toBe(false)
    expect(needsCohortSelection('solanacee', configurareMixta)).toBe(false)
    expect(needsCohortSelection('rubus', null)).toBe(false)
  })
})
