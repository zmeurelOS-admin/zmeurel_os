import { describe, expect, it } from 'vitest'

import {
  atractantScadent,
  capcaneDeVerificat,
  cheieGrup,
  dataSchimbAtractant,
  dataVerificareUrmatoare,
  destinatariMementoCapcane,
  dupaVerificare,
  eticheteSaptamani,
  grupuriDinMontare,
  inCoacere,
  inceputSaptamana,
  normalizeStatus,
  normalizeTip,
  normalizeazaPraguri,
  notificareMementoCapcane,
  pasiVerificare,
  pestePrag,
  PRAGURI_IMPLICITE,
  randuriVerificare,
  rezumatVerificare,
  stareGrup,
  textAlertaPrag,
  textPrag,
  totaluriPeSaptamana,
  verificareScadenta,
  type CapturaPas,
  type GrupCapcane,
} from '@/lib/capcane'
import { tabeleMonitorizare } from '@/lib/capcane/export'
import { NOTIFICARI_PREFERINTE_IMPLICITE, cheiePentruTip, permitePush } from '@/lib/notifications/preferinte'

const grup = (over: Partial<GrupCapcane> = {}): GrupCapcane => ({
  id: 'g1',
  parcela_id: 'p1',
  tip: 'drosophila',
  nr_bucati: 3,
  data_montare: '2026-06-01',
  data_urmatoarea_verificare: null,
  interval_verificare_zile: 7,
  interval_atractant_zile: null,
  data_schimb_atractant: null,
  status: 'activa',
  observatii: null,
  foto_url: null,
  ...over,
})

describe('tipul și starea din baza de date', () => {
  it('primește și valorile vechi din verificarea inițială', () => {
    expect(normalizeTip('drosophila')).toBe('drosophila')
    expect(normalizeTip('drosophila_otet')).toBe('drosophila')
    expect(normalizeTip('feromonala')).toBe('feromoni')
    expect(normalizeTip('lipicioasa_albastra')).toBe('alta')
    expect(normalizeTip(null)).toBe('alta')
    expect(normalizeStatus('activ')).toBe('activa')
    expect(normalizeStatus('activa')).toBe('activa')
    expect(normalizeStatus('scos')).toBe('scoasa')
    expect(normalizeStatus('expirat')).toBe('scoasa')
  })
})

describe('totalurile pe săptămână', () => {
  it('lunea săptămânii', () => {
    expect(inceputSaptamana('2026-06-24')).toBe('2026-06-22') // miercuri → luni
    expect(inceputSaptamana('2026-06-22')).toBe('2026-06-22') // luni
    expect(inceputSaptamana('2026-06-28')).toBe('2026-06-22') // duminică → lunea de dinainte
  })

  it('adună capcanele și verificările din aceeași săptămână; săptămânile goale apar cu null', () => {
    const verificari = [
      { data: '2026-06-02', capturi: 0 },
      { data: '2026-06-02', capturi: 1 },
      { data: '2026-06-05', capturi: 2 }, // a doua verificare în aceeași săptămână
      { data: '2026-06-16', capturi: 4 },
    ]
    const saptamani = totaluriPeSaptamana(verificari)
    expect(saptamani).toEqual([
      { start: '2026-06-01', capturi: 3, verificari: 2, ultimaZi: '2026-06-05' },
      { start: '2026-06-08', capturi: null, verificari: 0, ultimaZi: null },
      { start: '2026-06-15', capturi: 4, verificari: 1, ultimaZi: '2026-06-16' },
    ])
  })

  it('taie la perioadă și se întinde până la ziua dată', () => {
    const saptamani = totaluriPeSaptamana([{ data: '2026-05-20', capturi: 9 }, { data: '2026-06-02', capturi: 1 }], { de: '2026-06-01', pana: '2026-06-10' })
    expect(saptamani.map((s) => [s.start, s.capturi])).toEqual([
      ['2026-06-01', 1],
      ['2026-06-08', null],
    ])
    expect(totaluriPeSaptamana([])).toEqual([])
  })

  it('etichetele: luna la prima bară și când se schimbă', () => {
    expect(eticheteSaptamani(['2026-05-25', '2026-06-01', '2026-06-08', '2026-06-15'])).toEqual(['25 mai', '1 iun', '8', '15'])
  })
})

describe('peste prag', () => {
  const prag = { prag: 1, doar_in_coacere: true }

  it('capturile săptămânii ≥ prag × capcane, doar în coacere', () => {
    expect(pestePrag({ capturi: 3, nrBucati: 3, prag, inCoacere: true })).toBe(true)
    expect(pestePrag({ capturi: 2, nrBucati: 3, prag, inCoacere: true })).toBe(false)
    expect(pestePrag({ capturi: 9, nrBucati: 3, prag, inCoacere: false })).toBe(false)
  })

  it('fără „doar în coacere”, contează oricând', () => {
    expect(pestePrag({ capturi: 9, nrBucati: 3, prag: { prag: 1, doar_in_coacere: false }, inCoacere: false })).toBe(true)
  })

  it('fără prag, fără capturi sau fără verificare: nu', () => {
    expect(pestePrag({ capturi: 50, nrBucati: 2, prag: null, inCoacere: true })).toBe(false)
    expect(pestePrag({ capturi: 0, nrBucati: 1, prag: { prag: 0.5, doar_in_coacere: false }, inCoacere: true })).toBe(false)
    expect(pestePrag({ capturi: null, nrBucati: 1, prag, inCoacere: true })).toBe(false)
  })

  it('pragurile fermei: implicit Drosophila 1 în coacere, restul fără; valorile ciudate opresc pragul', () => {
    expect(normalizeazaPraguri(null)).toEqual(PRAGURI_IMPLICITE)
    expect(normalizeazaPraguri({ lipicioasa_galbena: { prag: 5 } })).toEqual({ ...PRAGURI_IMPLICITE, lipicioasa_galbena: { prag: 5, doar_in_coacere: false } })
    expect(normalizeazaPraguri({ drosophila: null }).drosophila).toBeNull()
    expect(normalizeazaPraguri({ drosophila: { prag: 0 } }).drosophila).toBeNull()
    expect(normalizeazaPraguri({ drosophila: { prag: 'x' } }).drosophila).toBeNull()
    expect(normalizeazaPraguri({ drosophila: 'ceva' }).drosophila).toEqual(PRAGURI_IMPLICITE.drosophila)
    expect(textPrag(PRAGURI_IMPLICITE.drosophila)).toBe('1 captură / capcană / săptămână, în coacere')
    expect(textPrag(null)).toBe('fără prag')
  })

  it('starea grupului pe listă: săptămâna ultimei verificări', () => {
    const verificari = [
      { data: '2026-06-23', capturi: 1 },
      { data: '2026-06-23', capturi: 2 },
      { data: '2026-06-26', capturi: 1 },
    ]
    const stare = stareGrup({ verificari, nrBucati: 3, prag, inCoacere: () => true })
    expect(stare).toEqual({ ultimaVerificare: '2026-06-26', capturiSaptamana: 4, capturiUltima: 1, pestePrag: true })
    expect(stareGrup({ verificari, nrBucati: 3, prag, inCoacere: () => false }).pestePrag).toBe(false)
    expect(stareGrup({ verificari: [], nrBucati: 3, prag, inCoacere: () => true }).ultimaVerificare).toBeNull()
  })
})

describe('în coacere', () => {
  it('stadiul de coacere sau recoltare, valabil în ziua aceea', () => {
    const stadii = [
      { stadiu: 'fruct_verde', data_observata: '2026-06-01' },
      { stadiu: 'parga', data_observata: '2026-06-15' },
    ]
    expect(inCoacere({ stadii, dataCules: null, zi: '2026-06-10' })).toBe(false)
    expect(inCoacere({ stadii, dataCules: null, zi: '2026-06-16' })).toBe(true)
    expect(inCoacere({ stadii: [{ stadiu: 'maturitate', data_observata: '2026-07-01' }], dataCules: null, zi: '2026-07-02' })).toBe(true)
    expect(inCoacere({ stadii: [{ stadiu: 'post_recoltare', data_observata: '2026-08-01' }], dataCules: null, zi: '2026-08-02' })).toBe(false)
  })

  it('remontant: oricare cohortă în coacere', () => {
    const stadii = [
      { stadiu: 'post_recoltare', data_observata: '2026-07-20', cohort: 'floricane' },
      { stadiu: 'parga', data_observata: '2026-08-10', cohort: 'primocane' },
    ]
    expect(inCoacere({ stadii, dataCules: null, zi: '2026-08-12' })).toBe(true)
  })

  it('fereastra culesului estimat: de la cu 7 zile înainte încolo', () => {
    expect(inCoacere({ stadii: [], dataCules: '2026-06-22', zi: '2026-06-14' })).toBe(false)
    expect(inCoacere({ stadii: [], dataCules: '2026-06-22', zi: '2026-06-15' })).toBe(true)
    expect(inCoacere({ stadii: [], dataCules: '2026-06-22', zi: '2026-07-20' })).toBe(true)
    expect(inCoacere({ stadii: [], dataCules: null, zi: '2026-07-20' })).toBe(false)
  })
})

describe('scadența verificării și a atractantului', () => {
  it('fără verificare: montarea + intervalul', () => {
    const g = grup()
    expect(dataVerificareUrmatoare(g)).toBe('2026-06-08')
    expect(verificareScadenta(g, '2026-06-07')).toBe(false)
    expect(verificareScadenta(g, '2026-06-08')).toBe(true)
    expect(verificareScadenta(g, '2026-06-12')).toBe(true) // rămâne până se verifică
    expect(verificareScadenta({ ...g, status: 'scoasa' }, '2026-06-12')).toBe(false)
  })

  it('după verificare: data verificării + interval', () => {
    const g = dupaVerificare(grup({ interval_verificare_zile: 4 }), [
      { data: '2026-06-08', atractant_schimbat: false },
      { data: '2026-06-10', atractant_schimbat: false },
    ])
    expect(g.data_urmatoarea_verificare).toBe('2026-06-14')
    expect(verificareScadenta(g, '2026-06-13')).toBe(false)
    expect(verificareScadenta(g, '2026-06-14')).toBe(true)
  })

  it('atractantul Drosophila la 7 zile de la montare sau de la ultima schimbare; alte tipuri, nu', () => {
    const g = grup()
    expect(dataSchimbAtractant(g)).toBe('2026-06-08')
    expect(atractantScadent(g, '2026-06-08')).toBe(true)
    const schimbat = dupaVerificare(g, [{ data: '2026-06-08', atractant_schimbat: true }])
    expect(schimbat.data_schimb_atractant).toBe('2026-06-08')
    expect(atractantScadent(schimbat, '2026-06-14')).toBe(false)
    expect(atractantScadent(schimbat, '2026-06-15')).toBe(true)
    expect(dataSchimbAtractant(grup({ tip: 'lipicioasa_galbena' }))).toBeNull()
    expect(dataSchimbAtractant(grup({ tip: 'feromoni', interval_atractant_zile: 30 }))).toBe('2026-07-01')
  })

  it('cardul și mementoul: câte capcane, câte cu atractantul de schimbat', () => {
    const grupuri = [
      grup({ id: 'a', nr_bucati: 3 }),
      grup({ id: 'b', nr_bucati: 3, data_schimb_atractant: '2026-06-06' }),
      grup({ id: 'c', tip: 'lipicioasa_galbena', nr_bucati: 2, data_urmatoarea_verificare: '2026-06-20' }),
    ]
    expect(capcaneDeVerificat(grupuri, '2026-06-08')).toMatchObject({ capcane: 6, atractant: 3 })
  })
})

describe('destinatarii mementoului', () => {
  const membri = [
    { user_id: 'scrie', role: 'operator', is_active: true, modules_access: [{ module: 'tratamente', level: 'write' }] },
    { user_id: 'citeste', role: 'operator', is_active: true, modules_access: [{ module: 'tratamente', level: 'read' }] },
    { user_id: 'oprit', role: 'operator', is_active: false, modules_access: [{ module: 'tratamente', level: 'write' }] },
    { user_id: 'lucrari-vechi', role: 'operator', is_active: true, modules_access: [{ module: 'activitati', level: 'write' }] },
    { user_id: 'fara', role: 'operator', is_active: true, modules_access: [{ module: 'comenzi', level: 'write' }] },
    { user_id: 'proprietar', role: 'operator', is_active: true, modules_access: [{ module: 'tratamente', level: 'write' }] },
  ]

  it('proprietarul și operatorii activi cu „Scrie” pe Tratamente, fiecare o dată', () => {
    expect(destinatariMementoCapcane({ ownerUserId: 'proprietar', membri })).toEqual(['proprietar', 'scrie'])
  })

  it('fără proprietar, doar operatorii cu „Scrie”', () => {
    expect(destinatariMementoCapcane({ ownerUserId: null, membri: membri.slice(0, 3) })).toEqual(['scrie'])
  })

  it('fiecare primește notificarea lui (cheia pe utilizator)', () => {
    const numeParcele = new Map([['p1', 'Maravilla 1']])
    const a = notificareMementoCapcane({ tenantId: 't', userId: 'u1', azi: '2026-06-08', grupuri: [grup()], numeParcele })
    const b = notificareMementoCapcane({ tenantId: 't', userId: 'u2', azi: '2026-06-08', grupuri: [grup()], numeParcele })
    expect(a?.title).toBe('Verifică capcanele · 3 capcane')
    expect(a?.body).toBe('Maravilla 1. Atractantul se schimbă azi la 3.')
    expect(a?.reminderKey).toBe('capcane:t:2026-06-08:u1')
    expect(b?.reminderKey).toBe('capcane:t:2026-06-08:u2')
    expect(notificareMementoCapcane({ tenantId: 't', userId: 'u1', azi: '2026-06-07', grupuri: [grup()], numeParcele })).toBeNull()
  })
})

describe('liniștea de noapte și comutatoarele', () => {
  it('mementoul și alerta au comutatoarele lor', () => {
    expect(cheiePentruTip('capcane_verificare')).toBe('capcane')
    expect(cheiePentruTip('capcane_peste_prag')).toBe('capcane_prag')
  })

  it('fără push între 22 și 6, ora României; ziua, da', () => {
    const noaptea = new Date('2026-06-08T20:30:00Z') // 23:30 în București (vara)
    const dimineata = new Date('2026-06-08T05:00:00Z') // 8:00 în București
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'capcane_verificare', noaptea)).toBe(false)
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'capcane_peste_prag', noaptea)).toBe(false)
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'capcane_verificare', dimineata)).toBe(true)
    expect(permitePush({ tipuri: {}, linisteNoaptea: false }, 'capcane_peste_prag', noaptea)).toBe(true)
  })

  it('comutatorul oprit oprește push-ul', () => {
    const dimineata = new Date('2026-06-08T05:00:00Z')
    expect(permitePush({ tipuri: { capcane: false }, linisteNoaptea: true }, 'capcane_verificare', dimineata)).toBe(false)
    expect(permitePush({ tipuri: { capcane_prag: false }, linisteNoaptea: true }, 'capcane_peste_prag', dimineata)).toBe(false)
  })
})

describe('montarea: mai multe parcele → mai multe grupuri', () => {
  const cheie = '123e4567-e89b-12d3-a456-426614174000'

  it('câte un grup pe parcelă, cu cheia lui, aceeași la reîncercare', () => {
    const randuri = grupuriDinMontare({
      tenantId: 't',
      parcelaIds: ['p1', 'p2', 'p1'],
      tip: 'drosophila',
      nrBucati: 3,
      intervalVerificareZile: 7,
      dataMontare: '2026-06-01',
      observatii: null,
      fotoPath: null,
      clientSyncId: cheie,
      createdBy: 'u',
    })
    expect(randuri).toHaveLength(2)
    expect(randuri.map((r) => r.parcela_id)).toEqual(['p1', 'p2'])
    expect(randuri[0].client_sync_id).toBe(cheie)
    expect(randuri[1].client_sync_id).toBe('123e4567-e89b-12d3-a456-426614174001')
    expect(randuri[1].client_sync_id).not.toBe(randuri[0].client_sync_id)
    expect(randuri[0]).toMatchObject({ tip_capcana: 'drosophila', status: 'activa', data_urmatoarea_verificare: '2026-06-08', nr_bucati: 3 })
    expect(cheieGrup(cheie, 1)).toBe(cheieGrup(cheie, 1))
    expect(cheieGrup('00000000-0000-0000-0000-00000000ffff', 1)).toBe('00000000-0000-0000-0000-000000000000')
  })
})

describe('verificarea', () => {
  const grupuri = [grup({ id: 'a', nr_bucati: 3 }), grup({ id: 'b', parcela_id: 'p2', tip: 'lipicioasa_galbena', nr_bucati: 2 })]

  it('un pas pe fiecare capcană; comutatorul atractantului doar unde e scadent', () => {
    const pasi = pasiVerificare(grupuri, '2026-06-08')
    expect(pasi.map((p) => `${p.grupId}${p.nr}`)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
    expect(pasi[0].atractantScadent).toBe(true)
    expect(pasi[3].atractantScadent).toBe(false)
  })

  it('rândurile: unul pe capcană, aceeași dată și aceeași cheie; capcana necompletată = 0', () => {
    const pasi = pasiVerificare(grupuri, '2026-06-08')
    const raspunsuri = new Map<string, CapturaPas>([
      ['a:1', { capturi: 5, atractantSchimbat: true, nota: ' muște ', fotoPath: null }],
      ['a:2', { capturi: 4, atractantSchimbat: true, nota: null, fotoPath: 'x.jpg' }],
    ])
    const randuri = randuriVerificare({ tenantId: 't', data: '2026-06-08', clientSyncId: 'k', createdBy: 'u', pasi, raspunsuri, pestePragPeGrup: new Map([['a', true]]) })
    expect(randuri).toHaveLength(5)
    expect(randuri[0]).toMatchObject({ capcana_montata_id: 'a', capcana_nr: 1, nr_capturati: 5, atractant_schimbat: true, observatii: 'muște', prag_depasit: true, client_sync_id: 'k', actiune: 'inlocuit' })
    expect(randuri[2]).toMatchObject({ capcana_nr: 3, nr_capturati: 0, atractant_schimbat: false, actiune: 'doar_observat' })
    expect(new Set(randuri.map((r) => r.data_verificare))).toEqual(new Set(['2026-06-08']))
  })

  it('rezumatul: capturile săptămânii (cu verificările de dinainte) și pragul', () => {
    const pasi = pasiVerificare(grupuri, '2026-06-11')
    const raspunsuri = new Map<string, CapturaPas>([
      ['a:1', { capturi: 3, atractantSchimbat: false, nota: null, fotoPath: null }],
      ['a:2', { capturi: 2, atractantSchimbat: false, nota: null, fotoPath: null }],
      ['b:1', { capturi: 11, atractantSchimbat: false, nota: null, fotoPath: null }],
    ])
    const rezumat = rezumatVerificare({
      grupuri,
      pasi,
      raspunsuri,
      verificariAnterioare: [
        { grup_id: 'a', data: '2026-06-08', capturi: 4 }, // aceeași săptămână
        { grup_id: 'a', data: '2026-06-01', capturi: 50 }, // altă săptămână
      ],
      data: '2026-06-11',
      praguri: PRAGURI_IMPLICITE,
      inCoacere: () => true,
    })
    expect(rezumat[0]).toMatchObject({ grupId: 'a', capturiAzi: 5, capturiSaptamana: 9, pestePrag: true })
    expect(rezumat[1]).toMatchObject({ grupId: 'b', capturiAzi: 11, pestePrag: false }) // lipicioasele: fără prag implicit
    expect(textAlertaPrag({ tip: 'drosophila', parcela: 'Maravilla 1', capturi: 9, nrBucati: 3 })).toBe('Drosophila peste prag la Maravilla 1 (9 în 3 capcane)')
  })
})

describe('registrul: monitorizare cu capcane', () => {
  it('grupurile și capturile pe săptămâni, cu pragul', () => {
    const tabele = tabeleMonitorizare({
      grupuri: [grup()],
      verificari: [
        { id: '1', grup_id: 'g1', data: '2026-06-23', capcana_nr: 1, capturi: 2, atractant_schimbat: false, observatii: null, foto_url: null },
        { id: '2', grup_id: 'g1', data: '2026-06-23', capcana_nr: 2, capturi: 2, atractant_schimbat: false, observatii: null, foto_url: null },
      ],
      numeParcele: new Map([['p1', 'Maravilla 1']]),
      praguri: PRAGURI_IMPLICITE,
      inCoacere: () => true,
      start: '2026-01-01',
      end: '2026-12-31',
    })
    expect(tabele[0].randuri[0]).toEqual(['Maravilla 1', 'Drosophila (atractant)', 3, '01.06.2026', '7 zile', 'Montate'])
    expect(tabele[1].randuri).toEqual([['Maravilla 1', 'Drosophila (atractant)', '22.06.2026', 1, 4, 3, 'Da']])
  })
})
