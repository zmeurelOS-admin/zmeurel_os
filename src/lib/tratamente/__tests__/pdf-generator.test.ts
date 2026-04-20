import { describe, expect, it } from 'vitest'

import { buildFisaAnsvsaPdfDocument } from '@/lib/tratamente/pdf'

describe('pdf-generator', () => {
  it('generează un PDF > 1000 bytes', async () => {
    const pdf = await buildFisaAnsvsaPdfDocument({
      an: 2026,
      cultura: 'Zmeur',
      generatedAt: '18.04.2026',
      parcelaCod: 'P1',
      parcelaId: 'p1',
      parcelaNume: 'Parcela Nord',
      suprafataHa: '1',
      tenant: {
        numeFerma: 'Ferma Demo',
        cif: 'RO123',
        adresa: 'Suceava',
        operatorResponsabil: 'Andrei Popa',
      },
      rows: [
        {
          nrCrt: '1',
          dataAplicare: '18.04.2026',
          produs: 'Kocide 2000',
          substantaActiva: 'hidroxid de cupru',
          dozaAplicata: '2 l/ha',
          suprafataTratata: '1',
          cantitateUtilizata: '2 l',
          agentDaunator: 'Mana',
          phiZile: '7',
          operator: 'Andrei Popa',
          semnatura: '',
        },
      ],
    })

    expect(pdf.byteLength).toBeGreaterThan(1000)
  })

  it('metadata conține titlul așteptat', async () => {
    const pdf = await buildFisaAnsvsaPdfDocument({
      an: 2026,
      cultura: 'Zmeur',
      generatedAt: '18.04.2026',
      parcelaCod: 'P1',
      parcelaId: 'p1',
      parcelaNume: 'Parcela Nord',
      suprafataHa: '1',
      tenant: {
        numeFerma: 'Ferma Demo',
        cif: 'RO123',
        adresa: 'Suceava',
        operatorResponsabil: 'Andrei Popa',
      },
      rows: [],
    })

    const raw = Buffer.from(pdf).toString('latin1')
    expect(raw).toContain('FISA TRATAMENTE FITOSANITARE')
  })

  it('fără aplicări generează PDF valid cu tabel gol', async () => {
    const pdf = await buildFisaAnsvsaPdfDocument({
      an: 2026,
      cultura: 'Zmeur',
      generatedAt: '18.04.2026',
      parcelaCod: 'P1',
      parcelaId: 'p1',
      parcelaNume: 'Parcela Nord',
      suprafataHa: '1',
      tenant: {
        numeFerma: 'Ferma Demo',
        cif: 'RO123',
        adresa: 'Suceava',
        operatorResponsabil: 'Andrei Popa',
      },
      rows: [],
    })

    expect(pdf.byteLength).toBeGreaterThan(1000)
  })
})
