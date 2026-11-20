import { describe, expect, it } from 'vitest'

import { getNotificationUiConfig, shouldSendWebPushForType } from '@/lib/notifications/config'
import {
  PRAGURI_METEO,
  TIPURI_ZILNICE,
  alertaMeteo,
  baniDeIncasat,
  comenziMaine,
  esteFermaReala,
  formatGrade,
  inPerioada,
  numarRo,
  prognozaDinFetchMeteo,
  type ComandaPentruMaine,
  type PrognozaFerma,
  type VanzarePentruIncasare,
} from '@/lib/notifications/zilnice'

describe('numarRo', () => {
  it('singular, plural, „de” de la 20', () => {
    expect(numarRo(1, 'comandă', 'comenzi')).toBe('1 comandă')
    expect(numarRo(4, 'comandă', 'comenzi')).toBe('4 comenzi')
    expect(numarRo(19, 'zi', 'zile')).toBe('19 zile')
    expect(numarRo(20, 'zi', 'zile')).toBe('20 de zile')
    expect(numarRo(30, 'zi', 'zile')).toBe('30 de zile')
    expect(numarRo(101, 'zi', 'zile')).toBe('101 zile')
    expect(numarRo(100, 'zi', 'zile')).toBe('100 de zile')
  })
})

// ─── Comenzi de mâine ─────────────────────────────────────────────────────────

describe('comenziMaine', () => {
  const azi = '2026-11-20'
  const comanda = (over: Partial<ComandaPentruMaine>): ComandaPentruMaine => ({
    id: 'c1',
    tenant_id: 't1',
    data_livrare: '2026-11-21',
    status: 'confirmata',
    cantitate_kg: 10,
    ...over,
  })

  it('o singură notificare pe fermă, cu totalul de kg', () => {
    const result = comenziMaine(
      [
        comanda({ id: 'a', status: 'noua', cantitate_kg: 12.5 }),
        comanda({ id: 'b', status: 'confirmata', cantitate_kg: 20 }),
        comanda({ id: 'c', status: 'programata', cantitate_kg: 7.5 }),
      ],
      azi,
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      tenantId: 't1',
      type: 'comenzi_maine',
      title: '3 comenzi de livrat mâine',
      body: 'Încă nu sunt puse în livrare. Total 40 kg.',
      reminderKey: 'maine:t1:2026-11-20',
      entityType: 'comenzi',
      entityId: null,
    })
    expect(result[0].data).toMatchObject({ delivery_date: '2026-11-21', order_ids: ['a', 'b', 'c'], total_kg: 40 })
  })

  it('comenzile deja puse în livrare, livrate sau anulate nu intră', () => {
    const result = comenziMaine(
      [
        comanda({ id: 'a', status: 'in_livrare' }),
        comanda({ id: 'b', status: 'livrata' }),
        comanda({ id: 'c', status: 'anulata' }),
      ],
      azi,
    )
    expect(result).toEqual([])
  })

  it('doar livrările de mâine (nu azi, nu poimâine)', () => {
    const result = comenziMaine(
      [
        comanda({ id: 'azi', data_livrare: '2026-11-20' }),
        comanda({ id: 'poimaine', data_livrare: '2026-11-22' }),
        comanda({ id: 'fara', data_livrare: null }),
        comanda({ id: 'maine', data_livrare: '2026-11-21', cantitate_kg: 3 }),
      ],
      azi,
    )
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('1 comandă de livrat mâine')
    expect(result[0].body).toBe('Încă nu e pusă în livrare. Total 3 kg.')
    expect(result[0].entityId).toBe('maine')
  })

  it('fermele separat; mâine peste sfârșit de lună', () => {
    const result = comenziMaine(
      [
        comanda({ id: 'a', tenant_id: 't1', data_livrare: '2026-12-01' }),
        comanda({ id: 'b', tenant_id: 't2', data_livrare: '2026-12-01' }),
      ],
      '2026-11-30',
    )
    expect(result.map((n) => n.reminderKey).sort()).toEqual(['maine:t1:2026-11-30', 'maine:t2:2026-11-30'])
  })
})

// ─── Bani de încasat ──────────────────────────────────────────────────────────

describe('baniDeIncasat', () => {
  const azi = '2026-11-20'
  let seq = 0
  const vanzare = (over: Partial<VanzarePentruIncasare>): VanzarePentruIncasare => ({
    id: `v${++seq}`,
    tenant_id: 't1',
    client_id: 'cl1',
    client_nume: 'Ioana Rotaru',
    data: '2026-11-06',
    cantitate_kg: 4,
    pret_lei_kg: 30,
    status_plata: 'neplatit',
    suma_incasata_partial_lei: null,
    ...over,
  })

  it('ziua 14: „Ioana Rotaru: 120 lei de 14 zile”, cu tot restul clientului', () => {
    const result = baniDeIncasat(
      [
        vanzare({ data: '2026-11-06' }), // 120 lei, 14 zile
        vanzare({ data: '2026-11-15', cantitate_kg: 2, pret_lei_kg: 30, suma_incasata_partial_lei: 20 }), // 40 lei rest
      ],
      azi,
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'incasari_restante',
      title: 'Ioana Rotaru: 160 lei de 14 zile',
      reminderKey: 'rest:t1:cl1:14:2026-11-20',
      entityType: 'clienti',
      entityId: 'cl1',
    })
    expect(result[0].body).toBe('Cea mai veche livrare neîncasată e din 6 noiembrie.')
  })

  it('doar în zilele 7, 14 și 30', () => {
    const zile = (data: string) => baniDeIncasat([vanzare({ data })], azi).map((n) => n.title)
    expect(zile('2026-11-13')).toEqual(['Ioana Rotaru: 120 lei de 7 zile'])
    expect(zile('2026-11-06')).toEqual(['Ioana Rotaru: 120 lei de 14 zile'])
    expect(zile('2026-10-21')).toEqual(['Ioana Rotaru: 120 lei de 30 de zile'])
    for (const data of ['2026-11-20', '2026-11-14', '2026-11-12', '2026-11-07', '2026-10-22', '2026-10-20', '2026-09-01']) {
      expect(zile(data)).toEqual([])
    }
  })

  it('se socotește de la cea mai veche livrare neîncasată, nu de la cele plătite', () => {
    const result = baniDeIncasat(
      [
        vanzare({ data: '2026-10-21', status_plata: 'platit' }), // plătită: nu contează
        vanzare({ data: '2026-11-13' }), // cea mai veche neîncasată: 7 zile
      ],
      azi,
    )
    expect(result.map((n) => n.title)).toEqual(['Ioana Rotaru: 120 lei de 7 zile'])
  })

  it('încasate integral (inclusiv plata parțială cât totalul) și fără client: nimic', () => {
    expect(
      baniDeIncasat(
        [
          vanzare({ status_plata: 'Platit' }),
          vanzare({ status_plata: 'incasat' }),
          vanzare({ suma_incasata_partial_lei: 120 }),
          vanzare({ client_id: null }),
        ],
        azi,
      ),
    ).toEqual([])
  })

  it('„restanta” și „neplatit” sunt neîncasate', () => {
    const result = baniDeIncasat([vanzare({ status_plata: 'restanta' })], azi)
    expect(result).toHaveLength(1)
  })

  it('până la 3 clienți: câte una pentru fiecare', () => {
    const result = baniDeIncasat(
      [
        vanzare({ client_id: 'a', client_nume: 'A' }),
        vanzare({ client_id: 'b', client_nume: 'B', data: '2026-11-13' }),
        vanzare({ client_id: 'c', client_nume: 'C', data: '2026-10-21' }),
      ],
      azi,
    )
    expect(result).toHaveLength(3)
    expect(result.map((n) => n.reminderKey).sort()).toEqual([
      'rest:t1:a:14:2026-11-20',
      'rest:t1:b:7:2026-11-20',
      'rest:t1:c:30:2026-11-20',
    ])
  })

  it('peste 3 clienți în aceeași zi: o singură notificare', () => {
    const result = baniDeIncasat(
      [
        vanzare({ client_id: 'a', pret_lei_kg: 50 }), // 200
        vanzare({ client_id: 'b', pret_lei_kg: 50, data: '2026-11-13' }), // 200
        vanzare({ client_id: 'c', pret_lei_kg: 50, data: '2026-10-21' }), // 200
        vanzare({ client_id: 'd', pret_lei_kg: 65 }), // 260
        vanzare({ client_id: 'e', data: '2026-11-10' }), // 10 zile: nu intră
      ],
      azi,
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      title: '4 clienți au de plătit 860 lei',
      reminderKey: 'rest:t1:grup:2026-11-20',
      entityType: null,
      entityId: null,
    })
    expect(result[0].data).toMatchObject({ grup: true, client_ids: ['a', 'b', 'c', 'd'], total_lei: 860 })
  })

  it('fermele se socotesc separat', () => {
    const result = baniDeIncasat(
      [vanzare({ tenant_id: 't1', client_id: 'a' }), vanzare({ tenant_id: 't2', client_id: 'a' })],
      azi,
    )
    expect(result.map((n) => n.tenantId).sort()).toEqual(['t1', 't2'])
  })
})

// ─── Meteo ────────────────────────────────────────────────────────────────────

/** 7:00 în București, în ziua dată (iarna UTC+2; vara UTC+3 — ora exactă nu schimbă ziua). */
function dimineata(ziua: string): Date {
  return new Date(`${ziua}T05:00:00Z`)
}

function prognoza(over: Partial<PrognozaFerma> & { pentruZiua: string }): PrognozaFerma {
  return { tenantId: 't1', minimaC: null, perioade: null, ...over }
}

describe('inPerioada', () => {
  it('perioadele simple și cea peste Anul Nou', () => {
    expect(inPerioada('2026-03-01', PRAGURI_METEO.inghetPrimavara)).toBe(true)
    expect(inPerioada('2026-05-31', PRAGURI_METEO.inghetPrimavara)).toBe(true)
    expect(inPerioada('2026-06-01', PRAGURI_METEO.inghetPrimavara)).toBe(false)
    expect(inPerioada('2026-11-16', PRAGURI_METEO.ger)).toBe(true)
    expect(inPerioada('2027-01-10', PRAGURI_METEO.ger)).toBe(true)
    expect(inPerioada('2027-02-28', PRAGURI_METEO.ger)).toBe(true)
    expect(inPerioada('2028-02-29', PRAGURI_METEO.ger)).toBe(true)
    expect(inPerioada('2027-03-01', PRAGURI_METEO.ger)).toBe(false)
    expect(inPerioada('2026-11-15', PRAGURI_METEO.ger)).toBe(false)
  })
})

describe('formatGrade', () => {
  it('minus tipografic, fără „−0”', () => {
    expect(formatGrade(-2.4)).toBe('−2 °C')
    expect(formatGrade(-16.6)).toBe('−17 °C')
    expect(formatGrade(-0.3)).toBe('0 °C')
    expect(formatGrade(3)).toBe('3 °C')
  })
})

describe('alertaMeteo — îngheț și ger, pe anotimpuri', () => {
  it('primăvara: minima ≤ 0 °C → îngheț', () => {
    const result = alertaMeteo(prognoza({ pentruZiua: '2026-04-11', minimaC: -2 }), dimineata('2026-04-10'))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'meteo_inghet',
      title: 'Îngheț la noapte: −2 °C',
      body: 'Protejează plantele sensibile.',
      reminderKey: 'meteo:t1:meteo_inghet:2026-04-10',
    })
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-04-11', minimaC: 0 }), dimineata('2026-04-10'))).toHaveLength(1)
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-04-11', minimaC: 0.5 }), dimineata('2026-04-10'))).toEqual([])
  })

  it('vara (iunie – mijlocul lui septembrie): niciun îngheț', () => {
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-06-02', minimaC: -1 }), dimineata('2026-06-01'))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-09-15', minimaC: -3 }), dimineata('2026-09-14'))).toEqual([])
  })

  it('toamna (15 septembrie – 15 noiembrie): pragul e −2 °C', () => {
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-10-11', minimaC: -1 }), dimineata('2026-10-10'))).toEqual([])
    const result = alertaMeteo(prognoza({ pentruZiua: '2026-09-16', minimaC: -2 }), dimineata('2026-09-15'))
    expect(result.map((n) => n.title)).toEqual(['Îngheț la noapte: −2 °C'])
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-11-16', minimaC: -5 }), dimineata('2026-11-15'))).toHaveLength(1)
  })

  it('iarna (16 noiembrie – sfârșitul lui februarie): doar gerul ≤ −15 °C', () => {
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-11-17', minimaC: -5 }), dimineata('2026-11-16'))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: '2027-01-11', minimaC: -14.6 }), dimineata('2027-01-10'))).toEqual([])
    const result = alertaMeteo(prognoza({ pentruZiua: '2027-01-11', minimaC: -17 }), dimineata('2027-01-10'))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'meteo_inghet', title: 'Ger puternic la noapte: −17 °C' })
    // 28 februarie e încă iarnă, 1 martie e primăvară (pragul 0 °C).
    expect(alertaMeteo(prognoza({ pentruZiua: '2027-03-01', minimaC: -5 }), dimineata('2027-02-28'))).toEqual([])
    expect(
      alertaMeteo(prognoza({ pentruZiua: '2027-03-02', minimaC: -5 }), dimineata('2027-03-01')).map((n) => n.title),
    ).toEqual(['Îngheț la noapte: −5 °C'])
  })

  it('fără minimă sau cu prognoză pentru altă zi: nimic', () => {
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-04-11', minimaC: null }), dimineata('2026-04-10'))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-04-10', minimaC: -5 }), dimineata('2026-04-10'))).toEqual([])
    expect(alertaMeteo({ tenantId: 't1', pentruZiua: null, minimaC: -5, perioade: null }, dimineata('2026-04-10'))).toEqual([])
  })
})

describe('alertaMeteo — furtună', () => {
  const ziVara = '2026-07-10'
  const maine = '2026-07-11'

  it('cod 2xx cu probabilitate ≥ 0,5 → grindină', () => {
    const result = alertaMeteo(
      prognoza({ pentruZiua: maine, perioade: [{ furtuna: false, probabilitate: 0.9 }, { furtuna: true, probabilitate: 0.7 }] }),
      dimineata(ziVara),
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'meteo_grindina',
      title: 'Risc de furtună cu grindină mâine',
      body: 'Probabilitate 70%.',
      reminderKey: 'meteo:t1:meteo_grindina:2026-07-10',
    })
  })

  it('probabilitate sub 0,5, ploaie fără furtună sau date lipsă: nimic', () => {
    expect(alertaMeteo(prognoza({ pentruZiua: maine, perioade: [{ furtuna: true, probabilitate: 0.49 }] }), dimineata(ziVara))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: maine, perioade: [{ furtuna: false, probabilitate: 1 }] }), dimineata(ziVara))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: maine, perioade: [{ furtuna: null, probabilitate: 1 }] }), dimineata(ziVara))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: maine, perioade: [{ furtuna: true, probabilitate: null }] }), dimineata(ziVara))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: maine, perioade: null }), dimineata(ziVara))).toEqual([])
  })

  it('doar 1 mai – 15 septembrie', () => {
    const furtuna = [{ furtuna: true, probabilitate: 0.8 }]
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-04-30', perioade: furtuna }), dimineata('2026-04-29'))).toEqual([])
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-05-02', perioade: furtuna }), dimineata('2026-05-01'))).toHaveLength(1)
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-09-16', perioade: furtuna }), dimineata('2026-09-15'))).toHaveLength(1)
    expect(alertaMeteo(prognoza({ pentruZiua: '2026-09-17', perioade: furtuna }), dimineata('2026-09-16'))).toEqual([])
  })

  it('în mai pot pleca amândouă (îngheț și furtună)', () => {
    const result = alertaMeteo(
      prognoza({ pentruZiua: '2026-05-06', minimaC: -1, perioade: [{ furtuna: true, probabilitate: 0.6 }] }),
      dimineata('2026-05-05'),
    )
    expect(result.map((n) => n.type).sort()).toEqual(['meteo_grindina', 'meteo_inghet'])
  })
})

describe('prognozaDinFetchMeteo', () => {
  it('mâine = ziua de după `fetchedAt` (București); iconița „11” = furtună', () => {
    expect(
      prognozaDinFetchMeteo('t1', {
        available: true,
        fetchedAt: '2026-07-10T04:30:00Z',
        forecastTomorrow: { tempMin: 14.2, icon: '11d', pop: 0.8 },
      }),
    ).toEqual({ tenantId: 't1', pentruZiua: '2026-07-11', minimaC: 14.2, perioade: [{ furtuna: true, probabilitate: 0.8 }] })
  })

  it('după 21:00 UTC e deja ziua următoare în București', () => {
    const p = prognozaDinFetchMeteo('t1', { available: true, fetchedAt: '2026-11-20T22:30:00Z', forecastTomorrow: { tempMin: -3 } })
    expect(p.pentruZiua).toBe('2026-11-22')
    expect(p.perioade).toBeNull()
  })

  it('meteo indisponibil sau răspuns gol: nimic de verificat', () => {
    expect(prognozaDinFetchMeteo('t1', { available: false })).toEqual({ tenantId: 't1', pentruZiua: null, minimaC: null, perioade: null })
    expect(prognozaDinFetchMeteo('t1', null).pentruZiua).toBeNull()
    expect(
      prognozaDinFetchMeteo('t1', { available: true, fetchedAt: '2026-07-10T04:30:00Z', forecastTomorrow: { tempMin: null, icon: '10d', pop: 0.4 } }),
    ).toMatchObject({ minimaC: null, perioade: [{ furtuna: false, probabilitate: 0.4 }] })
  })
})

describe('tipurile zilnice în config', () => {
  it('push pornit, cu iconiță și ton', () => {
    for (const type of Object.values(TIPURI_ZILNICE)) {
      expect(shouldSendWebPushForType(type)).toBe(true)
      expect(getNotificationUiConfig(type)).not.toBe(getNotificationUiConfig('system'))
    }
    expect(getNotificationUiConfig('comenzi_maine')).toMatchObject({ ton: 'informare' })
    expect(getNotificationUiConfig('incasari_restante')).toMatchObject({ ton: 'avertizare' })
    expect(getNotificationUiConfig('meteo_inghet')).toMatchObject({ ton: 'avertizare' })
    expect(getNotificationUiConfig('meteo_grindina')).toMatchObject({ ton: 'avertizare' })
  })
})

describe('esteFermaReala — cine primește verificarea zilnică', () => {
  it('o fermă cu proprietar cu email real intră', () => {
    expect(esteFermaReala({ is_demo: false }, 'ion@gmail.com')).toBe(true)
    expect(esteFermaReala({}, 'ion@gmail.com')).toBe(true)
  })

  it('demo-urile nu intră (după email sau după is_demo)', () => {
    expect(esteFermaReala({ is_demo: false }, 'x1@demo.zmeurel.local')).toBe(false)
    expect(esteFermaReala({ is_demo: false }, ' X1@Demo.Zmeurel.Local ')).toBe(false)
    expect(esteFermaReala({ is_demo: true }, 'ion@gmail.com')).toBe(false)
  })

  it('conturile de test automate @example.test nu intră', () => {
    expect(esteFermaReala({ is_demo: false }, 'e2e-1@example.test')).toBe(false)
    expect(esteFermaReala({ is_demo: false }, ' E2E@Example.Test ')).toBe(false)
  })

  it('@example.com nu e tratat drept cont de test', () => {
    expect(esteFermaReala({ is_demo: false }, 'cineva@example.com')).toBe(true)
  })
})
