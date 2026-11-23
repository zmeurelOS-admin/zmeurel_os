/**
 * Registrul de tratamente → secțiunea „Monitorizare cu capcane”: grupurile din sezon și capturile pe săptămâni,
 * pe parcelă. Funcții pure (tabelele intră în documentul registrului, Excel și PDF).
 */
import type { TabelExport } from '@/lib/rapoarte/export'

import { ETICHETA_TIP_CAPCANA, type GrupCapcane, type VerificareCapcana } from './model'
import { capturiLaPrag, pestePrag, type PraguriCapcane } from './prag'
import { totaluriPeSaptamana } from './saptamani'

const dataRo = (iso: string) => {
  const [an, luna, zi] = iso.slice(0, 10).split('-')
  return an && luna && zi ? `${zi}.${luna}.${an}` : iso
}

/** Grupurile care au stat montate măcar o zi în perioadă (montate până la `end`). */
export function grupuriInPerioada(grupuri: ReadonlyArray<GrupCapcane>, verificari: ReadonlyArray<VerificareCapcana>, start: string, end: string): GrupCapcane[] {
  const cuVerificari = new Set(verificari.filter((v) => v.data >= start && v.data <= end).map((v) => v.grup_id))
  return grupuri.filter((grup) => grup.data_montare <= end && (grup.status === 'activa' || cuVerificari.has(grup.id) || grup.data_montare >= start))
}

export function tabeleMonitorizare(input: {
  grupuri: ReadonlyArray<GrupCapcane>
  verificari: ReadonlyArray<VerificareCapcana>
  numeParcele: ReadonlyMap<string, string>
  praguri: PraguriCapcane
  inCoacere: (parcelaId: string, zi: string) => boolean
  start: string
  end: string
}): TabelExport[] {
  const grupuri = grupuriInPerioada(input.grupuri, input.verificari, input.start, input.end).sort((a, b) =>
    (input.numeParcele.get(a.parcela_id) ?? '').localeCompare(input.numeParcele.get(b.parcela_id) ?? '', 'ro') || a.data_montare.localeCompare(b.data_montare),
  )
  const parcela = (grup: GrupCapcane) => input.numeParcele.get(grup.parcela_id) ?? 'Parcelă'

  const randuriGrupuri = grupuri.map((grup) => [
    parcela(grup),
    ETICHETA_TIP_CAPCANA[grup.tip],
    grup.nr_bucati,
    dataRo(grup.data_montare),
    `${grup.interval_verificare_zile} zile`,
    grup.status === 'activa' ? 'Montate' : 'Scoase',
  ])

  const randuriSaptamani: (string | number)[][] = []
  for (const grup of grupuri) {
    const verificari = input.verificari.filter((v) => v.grup_id === grup.id)
    const prag = input.praguri[grup.tip]
    for (const saptamana of totaluriPeSaptamana(verificari, { de: input.start, pana: input.end })) {
      if (saptamana.capturi === null) continue
      const zi = saptamana.ultimaZi ?? saptamana.start
      const peste = pestePrag({ capturi: saptamana.capturi, nrBucati: grup.nr_bucati, prag, inCoacere: input.inCoacere(grup.parcela_id, zi) })
      randuriSaptamani.push([
        parcela(grup),
        ETICHETA_TIP_CAPCANA[grup.tip],
        `${dataRo(saptamana.start)}`,
        saptamana.verificari,
        saptamana.capturi,
        prag ? capturiLaPrag(prag, grup.nr_bucati) : '',
        peste ? 'Da' : '',
      ])
    }
  }

  return [
    {
      titlu: 'Monitorizare cu capcane · grupurile',
      coloane: ['Parcela', 'Tipul', 'Bucăți', 'Montate', 'Verificare', 'Stare'],
      randuri: randuriGrupuri,
    },
    {
      titlu: 'Monitorizare cu capcane · capturi pe săptămâni',
      coloane: ['Parcela', 'Tipul', 'Săptămâna din', 'Verificări', 'Capturi', 'Pragul (capturi)', 'Peste prag'],
      randuri: randuriSaptamani,
    },
  ]
}
