import { describe, expect, it } from 'vitest'

import {
  actiuniCiclu,
  comparaRanduri,
  etichetaComutatorLastar,
  etichetaFaraLastar,
  lastariMod,
  modLastari,
  randuriActiuneCiclu,
  stadiuCurentLastar,
  stadiuPentruCiclu,
  stadiuPentruPlan,
  textStadiiLastari,
} from '@/lib/parcele/lastari'
import { stadiuCurentParcela } from '@/lib/parcele/stadiu-curent'
import { listStadiiPentruGrup, normalizeStadiu } from '@/lib/parcele/stadii-canonic'
import { stadiiCurente } from '@/lib/plan/stadii'
import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'

let id = 0
function rand(stadiu: string, zi: string, cohort: 'floricane' | 'primocane' | null = null, inregistrat = `${zi}T08:00:00Z`): ParcelaStadiuCanonic {
  id += 1
  return {
    id: `s${String(id).padStart(3, '0')}`,
    tenant_id: 't',
    parcela_id: 'p1',
    an: Number(zi.slice(0, 4)),
    stadiu,
    cohort,
    data_observata: zi,
    sursa: 'manual',
    observatii: null,
    created_at: inregistrat,
    updated_at: inregistrat,
    created_by: null,
  }
}

/** Ce scrie foaia Stadiul pentru o acțiune a ciclului, în ziua dată. */
function scrie(actiune: Parameters<typeof randuriActiuneCiclu>[0], zi: string): ParcelaStadiuCanonic[] {
  return randuriActiuneCiclu(actiune).map((r) => rand(r.stadiu, zi, r.cohort, `${zi}T18:00:00Z`))
}

describe('modul de lucru al lăstarilor (implicit, fără UPDATE)', () => {
  it('salvat câștigă; altfel an1_an2 dacă există floricane (sau sezon mixt), altfel an1', () => {
    expect(modLastari({ grup: 'rubus', salvat: 'an2', stadii: [] })).toBe('an2')
    expect(modLastari({ grup: 'rubus', stadii: [rand('inflorit', '2026-06-01', 'floricane')] })).toBe('an1_an2')
    expect(modLastari({ grup: 'rubus', sistemConducere: 'mixt_floricane_primocane', stadii: [] })).toBe('an1_an2')
    expect(modLastari({ grup: 'rubus', stadii: [rand('inflorit', '2026-06-01', 'primocane'), rand('inflorit', '2026-06-01')] })).toBe('an1')
    expect(modLastari({ grup: 'rubus', salvat: 'altceva', stadii: [] })).toBe('an1')
    expect(modLastari({ grup: 'pomi_samanoase', salvat: 'an2', stadii: [] })).toBeNull()
  })

  it('lăstarii din foaie, după mod', () => {
    expect(lastariMod('an1')).toEqual(['primocane'])
    expect(lastariMod('an2')).toEqual(['floricane'])
    expect(lastariMod('an1_an2')).toEqual(['floricane', 'primocane'])
    expect(etichetaComutatorLastar('floricane')).toBe('Floricane · lăstar an 2')
    expect(etichetaComutatorLastar('primocane')).toBe('Primocane · lăstar an 1')
  })
})

describe('stadiul curent: după dată, la aceeași zi ultimul înregistrat, peste ani', () => {
  it('o notare cu o zi mai veche nu devine stadiul curent', () => {
    const stadii = [rand('legare_fruct', '2026-06-10', 'floricane', '2026-06-10T08:00:00Z'), rand('inflorit', '2026-06-08', 'floricane', '2026-06-11T08:00:00Z')]
    expect(stadiuCurentLastar(stadii, 'floricane', 'an1_an2')?.stadiu).toBe('legare_fruct')
  })

  it('la aceeași zi, ultimul înregistrat', () => {
    const stadii = [rand('inflorit', '2026-06-10', 'floricane', '2026-06-10T08:00:00Z'), rand('legare_fruct', '2026-06-10', 'floricane', '2026-06-10T19:00:00Z')]
    expect(stadiuCurentLastar(stadii, 'floricane', 'an1_an2')?.stadiu).toBe('legare_fruct')
    expect(comparaRanduri(stadii[1], stadii[0])).toBeLessThan(0)
  })

  it('rândurile vechi fără cohortă: în an1 sunt ale lăstarului de an 1; în an1_an2 se citesc ca până acum', () => {
    const vechi = [rand('inflorit', '2026-06-01')]
    expect(stadiuCurentLastar(vechi, 'primocane', 'an1')?.stadiu).toBe('inflorit')
    expect(stadiuCurentLastar(vechi, 'floricane', 'an2')?.stadiu).toBe('inflorit')
    expect(stadiuCurentLastar(vechi, 'floricane', 'an1_an2')).toBeNull()
    expect(stadiuCurentLastar(vechi, 'primocane', 'an1_an2')).toBeNull()
    // Doar rânduri vechi, în an1_an2: textul de pe card rămâne cel de până acum.
    expect(stadiuCurentParcela({ stadii: vechi, grup: 'rubus', config: null, modSalvat: 'an1_an2' }).text).toBe('Înflorit')
  })
})

describe('ciclul an 1 + an 2 (promptul 33)', () => {
  const mod = 'an1_an2' as const

  it('după „După recoltare primocane”: Tai tot / Păstrez; după „După recoltare floricane”: Tăiat; altfel nimic', () => {
    expect(actiuniCiclu(mod, 'primocane', 'post_recoltare')).toEqual(['tai_tot', 'pastrez'])
    expect(actiuniCiclu(mod, 'floricane', 'post_recoltare')).toEqual(['taiat_an2'])
    expect(actiuniCiclu(mod, 'primocane', 'maturitate')).toEqual([])
    expect(actiuniCiclu('an1', 'primocane', 'post_recoltare')).toEqual([])
    expect(actiuniCiclu('an2', 'floricane', 'post_recoltare')).toEqual([])
  })

  it('„Păstrez” scrie două rânduri: an 2 pe „Floricane în repaus” și an 1 tăiat', () => {
    expect(randuriActiuneCiclu('pastrez')).toEqual([
      { stadiu: 'pastrat', cohort: 'floricane' },
      { stadiu: 'taiat', cohort: 'primocane' },
    ])
    const stadii = [rand('post_recoltare', '2026-10-01', 'primocane'), rand('post_recoltare', '2026-08-01', 'floricane'), ...scrie('pastrez', '2026-11-05')]
    expect(stadiuCurentLastar(stadii, 'floricane', mod)?.stadiu).toBe('pastrat')
    // Lăstarii de an 1 din toamnă au devenit lăstari de an 2: an 1 fără stadiu până la „Pornire lăstari noi”.
    expect(stadiuCurentLastar(stadii, 'primocane', mod)).toBeNull()
    // Promptul 34, §2: lăstarul de an 1 tăiat apare pe card cu data.
    expect(stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod }).text).toBe('An 2: În repaus · An 1: Tăiat pe 5 nov.')
  })

  it('„Tai tot” nu creează lăstar de an 2', () => {
    const stadii = [rand('post_recoltare', '2026-10-01', 'primocane'), ...scrie('tai_tot', '2026-11-05')]
    expect(stadiuCurentLastar(stadii, 'primocane', mod)).toBeNull()
    expect(stadiuCurentLastar(stadii, 'floricane', mod)).toBeNull()
    expect(stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod })).toMatchObject({ text: 'Lăstar an 1: Tăiat pe 5 nov.', ziua: '2026-11-05' })
  })

  it('„Tăiat” pe an 2: fără stadiu până la următorul „Păstrez”', () => {
    let stadii = [rand('post_recoltare', '2026-08-01', 'floricane'), ...scrie('taiat_an2', '2026-08-10')]
    expect(stadiuCurentLastar(stadii, 'floricane', mod)).toBeNull()
    stadii = [...stadii, rand('post_recoltare', '2026-10-01', 'primocane'), ...scrie('pastrez', '2026-11-01')]
    expect(stadiuCurentLastar(stadii, 'floricane', mod)?.stadiu).toBe('pastrat')
  })

  it('lăstarii noi de an 1 de la „Pornire lăstari noi”, după „Tai tot”', () => {
    const stadii = [...scrie('tai_tot', '2026-11-05'), rand('umflare_muguri', '2027-04-02', 'primocane')]
    expect(stadiuCurentLastar(stadii, 'primocane', mod)?.stadiu).toBe('umflare_muguri')
  })

  it('pe card: ambele stadii, când există', () => {
    const stadii = [rand('inflorit', '2027-06-01', 'floricane'), rand('buton_verde', '2027-06-01', 'primocane')]
    expect(stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod }).text).toBe('An 2: Înflorit · An 1: Creștere lăstari')
  })
})

describe('trecerea de an', () => {
  const mod = 'an1_an2' as const
  // „Păstrez” pus în noiembrie 2026.
  const stadii = [rand('post_recoltare', '2026-10-10', 'primocane'), rand('post_recoltare', '2026-08-01', 'floricane'), ...scrie('pastrez', '2026-11-15')]

  it('„Floricane în repaus” se vede și în ianuarie–martie 2027 (fișă, listă, foaia Stadiul)', () => {
    // Fișa, lista și foaia citesc anul trecut + anul acesta (`getStadiiCanoniceFermaDoiAni`): aceleași rânduri.
    for (const ziua of ['2027-01-10', '2027-03-20']) {
      const randuri = stadii.filter((r) => r.data_observata <= ziua)
      const curent = stadiuCurentParcela({ stadii: randuri, grup: 'rubus', config: null, modSalvat: mod })
      // Promptul 34, §2: lăstarul de an 1 tăiat la „Păstrez” rămâne pe card, cu data.
      expect(curent.text).toBe('An 2: În repaus · An 1: Tăiat pe 15 nov.')
      expect(curent.peLastari.find((p) => p.lastar === 'floricane')?.stadiu).toBe('pastrat')
    }
  })

  it('planul și „E timpul pentru…”: „pastrat” contează ca repaus în 2027; „taiat” nu e stadiu', () => {
    expect(stadiiCurente(stadii, 2027)).toEqual([{ cohort: 'floricane', stadiu: 'repaus_vegetativ', din: '2026-11-15' }])
  })

  it('1 ianuarie: „După recoltare” din anul trecut nu pornește planul (nicio notificare)', () => {
    const vara = [rand('post_recoltare', '2026-08-20', 'floricane'), rand('post_recoltare', '2026-10-01', 'primocane')]
    expect(stadiiCurente(vara, 2027)).toEqual([])
    // Fără cohortă, la fel.
    expect(stadiiCurente([rand('post_recoltare', '2026-08-20')], 2027)).toEqual([])
    // „Repaus vegetativ” din decembrie trece în anul nou.
    expect(stadiiCurente([rand('repaus_vegetativ', '2026-12-01', 'floricane')], 2027)).toEqual([{ cohort: 'floricane', stadiu: 'repaus_vegetativ', din: '2026-12-01' }])
    // În același an, orice stadiu contează.
    expect(stadiiCurente([rand('post_recoltare', '2027-08-20', 'floricane')], 2027)).toEqual([{ cohort: 'floricane', stadiu: 'post_recoltare', din: '2027-08-20' }])
  })

  it('stadiuPentruPlan', () => {
    expect(stadiuPentruPlan('pastrat', '2026-11-15', 2027)).toBe('repaus_vegetativ')
    expect(stadiuPentruPlan('taiat', '2027-01-02', 2027)).toBeNull()
    expect(stadiuPentruPlan('inflorit', '2026-06-01', 2027)).toBeNull()
    expect(stadiuPentruPlan('inflorit', '2026-06-01', null)).toBe('inflorit')
  })
})

describe('etichetele', () => {
  it('fără cuvântul lăstarului, pe card', () => {
    expect(etichetaFaraLastar('Înflorit pe floricane')).toBe('Înflorit')
    expect(etichetaFaraLastar('Floricane în repaus')).toBe('În repaus')
    expect(etichetaFaraLastar('După recoltare primocane')).toBe('După recoltare')
    expect(etichetaFaraLastar('Creștere lăstari primocane')).toBe('Creștere lăstari')
    expect(etichetaFaraLastar('Primele fructe colorate')).toBe('Primele fructe colorate')
    expect(textStadiiLastari([{ lastar: 'floricane', eticheta: 'Primele fructe colorate' }, { lastar: 'primocane', eticheta: null }])).toBe(
      'Lăstar an 2: Primele fructe colorate',
    )
    expect(textStadiiLastari([{ lastar: null, eticheta: 'Înflorire' }])).toBe('Înflorire')
  })

  it('codurile noi se recunosc, dar nu sunt plăci în foaia Stadiul', () => {
    expect(normalizeStadiu('pastrat')).toBe('pastrat')
    expect(normalizeStadiu('taiat')).toBe('taiat')
    expect(listStadiiPentruGrup('rubus')).not.toContain('pastrat')
    expect(listStadiiPentruGrup('rubus')).not.toContain('taiat')
  })
})

describe('promptul 34, §1: butoanele ciclului la rândurile vechi fără cohortă', () => {
  const mod = 'an1_an2' as const

  it('un singur „După recoltare” vechi, fără cohortă: pe an 1 apar „Tai tot” / „Păstrez”, pe an 2 nimic', () => {
    const stadii = [rand('post_recoltare', '2026-10-01')]
    const stare = stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod })
    expect(stare.ciclu).toEqual({ floricane: null, primocane: 'post_recoltare' })
    expect(actiuniCiclu(mod, 'primocane', stare.ciclu.primocane ?? null)).toEqual(['tai_tot', 'pastrez'])
    expect(actiuniCiclu(mod, 'floricane', stare.ciclu.floricane ?? null)).toEqual([])
    // Cardul rămâne cum era (rândul vechi, fără lăstar), iar datele nu se rescriu.
    expect(stare.text).toBe('După recoltare')
    expect(stadii[0].cohort).toBeNull()
  })

  it('cu rânduri pe floricane și „După recoltare” salvat fără cohortă: la fel', () => {
    const stadii = [rand('inflorit', '2026-06-01', 'floricane'), rand('post_recoltare', '2026-10-01')]
    // Fără mod salvat, rândul pe floricane face modul an1_an2.
    const stare = stadiuCurentParcela({ stadii, grup: 'rubus', config: null })
    expect(stare.mod).toBe(mod)
    expect(actiuniCiclu(mod, 'primocane', stare.ciclu.primocane ?? null)).toEqual(['tai_tot', 'pastrez'])
  })

  it('după „Tai tot” butoanele dispar, iar cardul nu mai arată „După recoltare” de pe rândul vechi', () => {
    const stadii = [rand('post_recoltare', '2026-10-01'), ...scrie('tai_tot', '2026-11-05')]
    const stare = stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod })
    expect(stadiuPentruCiclu(stadii, mod, 'primocane')).toBeNull()
    expect(actiuniCiclu(mod, 'primocane', stare.ciclu.primocane ?? null)).toEqual([])
    expect(stare.text).toBe('Lăstar an 1: Tăiat pe 5 nov.')
  })

  it('un rând nou cu cohortă câștigă în fața unui rând vechi mai vechi', () => {
    const stadii = [rand('post_recoltare', '2026-10-01'), rand('umflare_muguri', '2027-04-01', 'primocane')]
    expect(stadiuPentruCiclu(stadii, mod, 'primocane')).toBe('umflare_muguri')
  })

  it('în modurile cu un singur lăstar, stadiul obișnuit', () => {
    const stadii = [rand('post_recoltare', '2026-10-01')]
    expect(stadiuPentruCiclu(stadii, 'an1', 'primocane')).toBe('post_recoltare')
    expect(stadiuPentruCiclu(stadii, 'an2', 'floricane')).toBe('post_recoltare')
  })
})

describe('promptul 34, §2: „Tăiat” pe card, cu data', () => {
  const mod = 'an1_an2' as const

  it('lăstarul tăiat apare cu data până la următorul lui stadiu', () => {
    let stadii = [rand('post_recoltare', '2026-08-01', 'floricane'), ...scrie('taiat_an2', '2026-08-10'), rand('maturitate', '2026-08-10', 'primocane')]
    expect(stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod }).text).toBe('An 2: Tăiat pe 10 aug. · An 1: Recoltare')
    stadii = [...stadii, rand('post_recoltare', '2026-10-01', 'primocane'), ...scrie('pastrez', '2026-11-01')]
    // După „Păstrez”, lăstarul de an 2 are din nou stadiu; eticheta „Tăiat” a lui dispare.
    expect(stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod }).text).toBe('An 2: În repaus · An 1: Tăiat pe 1 nov.')
  })

  it('planul tratează „Tăiat” ca fără stadiu, ca înainte', () => {
    const stadii = scrie('tai_tot', '2026-11-05')
    expect(stadiuCurentParcela({ stadii, grup: 'rubus', config: null, modSalvat: mod }).peLastari.every((item) => item.stadiu === null)).toBe(true)
  })
})
