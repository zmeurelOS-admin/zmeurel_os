import { describe, expect, it, vi } from 'vitest'

import {
  DEMO_ANALIZA_CE_S_A_ANALIZAT,
  DEMO_ANALIZA_NOTA,
  analizeDemoDeSters,
  deleteDemoAnalize,
  type AnalizaPentruStergereDemo,
} from '@/lib/demo/demo-analize'

const analiza = (id: string, extra: Partial<AnalizaPentruStergereDemo> = {}): AnalizaPentruStergereDemo => ({
  id,
  nota: DEMO_ANALIZA_NOTA,
  ce_s_a_analizat: DEMO_ANALIZA_CE_S_A_ANALIZAT,
  pv_poza_path: null,
  buletin_path: null,
  ...extra,
})

describe('analizele demo care pleacă la reîncărcarea demo-ului', () => {
  const parceleDemo = new Set(['p-demo-1', 'p-demo-2'])

  it('analiza seed-ului pe parcele demo se șterge', () => {
    const r = analizeDemoDeSters([analiza('a')], [{ analiza_id: 'a', parcela_id: 'p-demo-1' }, { analiza_id: 'a', parcela_id: 'p-demo-2' }], parceleDemo)
    expect(r.map((x) => x.id)).toEqual(['a'])
  })

  it('analiza orfană (fără parcele, de la o reîncărcare veche) se șterge', () => {
    expect(analizeDemoDeSters([analiza('orfana')], [], parceleDemo).map((x) => x.id)).toEqual(['orfana'])
  })

  it('analiza omului (alte texte) nu se atinge, chiar pe parcele demo sau fără parcele', () => {
    const aOmului = analiza('om', { nota: 'prelevat de mine', ce_s_a_analizat: 'Multireziduu' })
    expect(analizeDemoDeSters([aOmului], [{ analiza_id: 'om', parcela_id: 'p-demo-1' }], parceleDemo)).toEqual([])
    expect(analizeDemoDeSters([aOmului], [], parceleDemo)).toEqual([])
  })

  it('analiza demo legată și de o parcelă reală rămâne', () => {
    const r = analizeDemoDeSters([analiza('a')], [{ analiza_id: 'a', parcela_id: 'p-demo-1' }, { analiza_id: 'a', parcela_id: 'p-reala' }], parceleDemo)
    expect(r).toEqual([])
  })
})

function fakeAdmin(analize: AnalizaPentruStergereDemo[], legaturi: Array<{ analiza_id: string; parcela_id: string }>) {
  const sterse: string[][] = []
  const fisiere: string[][] = []
  const admin = {
    from(table: string) {
      return {
        select: () => ({
          eq: (_c: string, tenant: string) => {
            const rezultat = { data: table === 'analize_fructe' ? analize : legaturi, error: null }
            expect(tenant).toBe('t1')
            return Object.assign(Promise.resolve(rezultat), { in: () => Promise.resolve(rezultat) })
          },
        }),
        delete: () => ({
          eq: (_c: string, tenant: string) => ({
            in: (_col: string, ids: string[]) => {
              expect(table).toBe('analize_fructe')
              expect(tenant).toBe('t1')
              sterse.push(ids)
              return Promise.resolve({ error: null })
            },
          }),
        }),
      }
    },
    storage: {
      from: (bucket: string) => ({
        remove: vi.fn(async (paths: string[]) => {
          expect(bucket).toBe('analize')
          fisiere.push(paths)
          return { error: null }
        }),
      }),
    },
  }
  return { admin, sterse, fisiere }
}

describe('deleteDemoAnalize', () => {
  it('șterge doar analizele demo ale fermei și fișierele lor de sub prefixul fermei', async () => {
    const { admin, sterse, fisiere } = fakeAdmin(
      [
        analiza('demo', { buletin_path: 't1/buletin.pdf', pv_poza_path: 'alt-tenant/pv.jpg' }),
        analiza('om', { nota: null, ce_s_a_analizat: 'Analiza mea' }),
      ],
      [{ analiza_id: 'demo', parcela_id: 'p1' }],
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const numar = await deleteDemoAnalize(admin as any, 't1', ['p1'])
    expect(numar).toBe(1)
    expect(sterse).toEqual([['demo']])
    expect(fisiere).toEqual([['t1/buletin.pdf']])
  })

  it('fără tabelul analizelor nu face nimic', async () => {
    const admin = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) }),
      }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await deleteDemoAnalize(admin as any, 't1', ['p1'])).toBe(0)
  })
})
