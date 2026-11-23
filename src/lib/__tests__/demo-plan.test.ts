import { describe, expect, it } from 'vitest'

import { DEMO_PLAN_NOTA, LINII_DEMO, deleteDemoPlan } from '@/lib/demo/demo-plan'
import { calculeazaPlan, grupeazaDeFacut, linieDinRand, stadiiCurentePeParcele, type PlanTratament } from '@/lib/plan'

describe('planul din demo', () => {
  it('are linii pe 5 stadii, cu repetare și o linie făcută', () => {
    expect(new Set(LINII_DEMO.map((l) => l.stadiu)).size).toBe(5)
    expect(LINII_DEMO.filter((l) => l.repetare)).toHaveLength(2)
    expect(LINII_DEMO.filter((l) => l.facutaPe)).toHaveLength(1)
  })

  it('cu stadiile demo: „E timpul pentru · După recoltare” pe Delniwa Nord și Maravilla, Kelpak făcut pe Maravilla', () => {
    const linii = LINII_DEMO.map((l, i) =>
      linieDinRand({
        id: `l${i}`,
        plan_id: 'plan',
        ordine: i + 1,
        stadiu_trigger: l.stadiu,
        regula_repetare: l.repetare ? 'interval' : 'fara_repetare',
        interval_repetare_zile: l.repetare?.zile ?? null,
        numar_repetari_max: l.repetare?.ori ?? null,
        metoda_aplicare: l.metoda,
        scop: l.scop,
        produse: [{ id: `p${i}`, ordine: 1, produs_nume_snapshot: l.produs.nume }],
      }),
    )
    const plan: PlanTratament = { id: 'plan', nume: 'Zmeură 2026', cultura_tip: 'zmeur', descriere: DEMO_PLAN_NOTA, activ: true, arhivat: false, linii }
    const zi = (d: string) => ({ data_observata: d, created_at: `${d}T08:00:00Z`, updated_at: `${d}T08:00:00Z` })
    // Ca `seedDemoStadii` (azi = 23.11.2026).
    const stadii = stadiiCurentePeParcele([
      { parcela_id: 'maravilla', stadiu: 'post_recoltare', cohort: 'floricane', ...zi('2026-10-14') },
      { parcela_id: 'maravilla', stadiu: 'maturitate', cohort: 'primocane', ...zi('2026-11-19') },
      { parcela_id: 'nord', stadiu: 'post_recoltare', cohort: null, ...zi('2026-11-13') },
    ])
    const asocieri = ['maravilla', 'nord', 'sud'].map((parcela_id) => ({ plan_id: 'plan', parcela_id, an: 2026, activ: true }))
    const kelpak = LINII_DEMO.findIndex((l) => l.facutaPe)
    const calcul = calculeazaPlan(plan, asocieri, {
      azi: '2026-11-23',
      an: 2026,
      stadii,
      aplicari: [{ id: 'a', parcela_id: 'maravilla', plan_linie_id: `l${kelpak}`, status: 'aplicata', zi: '2026-11-21' }],
      sarite: [],
      exceptii: [],
    })
    const grupuri = grupeazaDeFacut(plan, calcul.deFacut)
    expect(grupuri.map((g) => [g.stadiu, g.parcelaIds.sort()])).toEqual([['post_recoltare', ['maravilla', 'nord']]])
    expect(calcul.stari.get(`l${kelpak}:maravilla`)?.stare).toBe('facut')
    expect(calcul.stari.get(`l0:sud`)?.stare).toBe('fara_stadiu')
  })

  it('reîncărcarea șterge doar planul demo: întâi parcelele lui, apoi planul', async () => {
    const pasi: string[] = []
    const lant = (tabel: string, op: string) => {
      const q = {
        eq: (c: string, v: string) => (pasi.push(`${op}:${tabel}:eq:${c}=${v}`), q),
        in: (c: string, v: string[]) => (pasi.push(`${op}:${tabel}:in:${c}=${v.join(',')}`), q),
        then: (resolve: (value: unknown) => void) => resolve({ data: op === 'select' ? [{ id: 'pd' }] : null, error: null }),
      }
      return q
    }
    const admin = { from: (tabel: string) => ({ select: () => lant(tabel, 'select'), delete: () => lant(tabel, 'delete') }) }
    expect(await deleteDemoPlan(admin as never, 't')).toBe(1)
    expect(pasi).toEqual([
      'select:planuri_tratament:eq:tenant_id=t',
      `select:planuri_tratament:eq:descriere=${DEMO_PLAN_NOTA}`,
      'delete:parcele_planuri:eq:tenant_id=t',
      'delete:parcele_planuri:in:plan_id=pd',
      'delete:planuri_tratament:eq:tenant_id=t',
      'delete:planuri_tratament:in:id=pd',
    ])
  })
})
