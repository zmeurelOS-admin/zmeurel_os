/**
 * Montarea și verificarea, partea pură: rândurile de salvat, pașii verificării, rezumatul de la final, textul alertei.
 */
import { adaugaZile } from '@/lib/notifications/zilnice/common'

import { capcaneText, capturiText, numeTipBucati, type GrupCapcane, type TipCapcana } from './model'
import { pestePrag, type PraguriCapcane } from './prag'
import { capturiInSaptamana } from './saptamani'
import { atractantScadent } from './scadenta'

// ─── Montarea ──────────────────────────────────────────────────────────────────────────────────

/**
 * Cheia grupului `index` dintr-o montare pe mai multe parcele: primul grup păstrează cheia formularului, următoarele
 * schimbă ultimele 4 cifre hexa (aceeași la reîncercare, alta pe fiecare parcelă, tot un UUID valid).
 */
export function cheieGrup(cheieFormular: string, index: number): string {
  if (index === 0) return cheieFormular
  const coada = cheieFormular.slice(-4)
  const valoare = (parseInt(coada, 16) + index) % 0x10000
  return `${cheieFormular.slice(0, -4)}${valoare.toString(16).padStart(4, '0')}`
}

export interface MontareInput {
  tenantId: string
  parcelaIds: readonly string[]
  tip: TipCapcana
  nrBucati: number
  intervalVerificareZile: number
  dataMontare: string
  observatii: string | null
  fotoPath: string | null
  clientSyncId: string
  createdBy: string | null
}

/** Mai multe parcele → câte un grup pe fiecare (rândurile pentru `capcane_montate`). */
export function grupuriDinMontare(input: MontareInput) {
  const parcele = [...new Set(input.parcelaIds)]
  return parcele.map((parcelaId, index) => ({
    tenant_id: input.tenantId,
    parcela_id: parcelaId,
    tip_capcana: input.tip,
    nr_bucati: input.nrBucati,
    data_montare: input.dataMontare,
    interval_verificare_zile: input.intervalVerificareZile,
    interval_atractant_zile: null,
    data_schimb_atractant: null,
    data_urmatoarea_verificare: adaugaZile(input.dataMontare, input.intervalVerificareZile),
    status: 'activa',
    observatii: input.observatii,
    foto_url: input.fotoPath,
    client_sync_id: cheieGrup(input.clientSyncId, index),
    created_by: input.createdBy,
  }))
}

// ─── Verificarea ───────────────────────────────────────────────────────────────────────────────

export interface PasVerificare {
  grupId: string
  /** 1..nr_bucati. */
  nr: number
  /** Atractantul grupului e scadent: comutatorul „Am schimbat atractantul” apare la fiecare capcană din grup. */
  atractantScadent: boolean
}

/** Câte un pas pe fiecare capcană din grupurile alese, în ordinea grupurilor. */
export function pasiVerificare(grupuri: ReadonlyArray<GrupCapcane>, azi: string): PasVerificare[] {
  return grupuri.flatMap((grup) =>
    Array.from({ length: Math.max(1, grup.nr_bucati) }, (_, i) => ({ grupId: grup.id, nr: i + 1, atractantScadent: atractantScadent(grup, azi) })),
  )
}

export interface CapturaPas {
  capturi: number | null
  atractantSchimbat: boolean
  nota: string | null
  fotoPath: string | null
}

/** Rândurile pentru `capcane_verificari`: câte unul pe capcană, aceeași dată și aceeași cheie (per grup). */
export function randuriVerificare(input: {
  tenantId: string
  data: string
  clientSyncId: string
  createdBy: string | null
  pasi: readonly PasVerificare[]
  raspunsuri: ReadonlyMap<string, CapturaPas>
  pestePragPeGrup?: ReadonlyMap<string, boolean>
}) {
  return input.pasi.map((pas) => {
    const raspuns = input.raspunsuri.get(cheiePas(pas))
    return {
      tenant_id: input.tenantId,
      capcana_montata_id: pas.grupId,
      capcana_nr: pas.nr,
      data_verificare: input.data,
      nr_capturati: Math.max(0, Math.round(raspuns?.capturi ?? 0)),
      atractant_schimbat: Boolean(raspuns?.atractantSchimbat),
      observatii: raspuns?.nota?.trim() || null,
      foto_url: raspuns?.fotoPath ?? null,
      actiune: raspuns?.atractantSchimbat ? 'inlocuit' : 'doar_observat',
      prag_depasit: input.pestePragPeGrup?.get(pas.grupId) ?? false,
      client_sync_id: input.clientSyncId,
      created_by: input.createdBy,
    }
  })
}

export function cheiePas(pas: Pick<PasVerificare, 'grupId' | 'nr'>): string {
  return `${pas.grupId}:${pas.nr}`
}

export interface RezumatGrup {
  grupId: string
  parcelaId: string
  tip: TipCapcana
  nrBucati: number
  /** Capturile la verificarea de azi (toate capcanele grupului). */
  capturiAzi: number
  /** Capturile din săptămâna verificării, cu verificarea de azi. */
  capturiSaptamana: number
  pestePrag: boolean
}

/**
 * Rezumatul de la finalul verificării, pe grup: cât s-a prins azi, cât în săptămână (cu verificările de dinainte)
 * și dacă grupul a trecut de prag.
 */
export function rezumatVerificare(input: {
  grupuri: ReadonlyArray<GrupCapcane>
  pasi: readonly PasVerificare[]
  raspunsuri: ReadonlyMap<string, CapturaPas>
  verificariAnterioare: ReadonlyArray<{ grup_id: string; data: string; capturi: number }>
  data: string
  praguri: PraguriCapcane
  inCoacere: (parcelaId: string, zi: string) => boolean
}): RezumatGrup[] {
  return input.grupuri.map((grup) => {
    const capturiAzi = input.pasi
      .filter((pas) => pas.grupId === grup.id)
      .reduce((suma, pas) => suma + Math.max(0, input.raspunsuri.get(cheiePas(pas))?.capturi ?? 0), 0)
    // Verificările de azi deja salvate (o reîncercare) nu se adună de două ori: le înlocuiește cea de acum.
    const anterioare = input.verificariAnterioare.filter((v) => v.grup_id === grup.id && v.data.slice(0, 10) !== input.data)
    const capturiSaptamana = (capturiInSaptamana(anterioare, input.data) ?? 0) + capturiAzi
    return {
      grupId: grup.id,
      parcelaId: grup.parcela_id,
      tip: grup.tip,
      nrBucati: grup.nr_bucati,
      capturiAzi,
      capturiSaptamana,
      pestePrag: pestePrag({
        capturi: capturiSaptamana,
        nrBucati: grup.nr_bucati,
        prag: input.praguri[grup.tip],
        inCoacere: input.inCoacere(grup.parcela_id, input.data),
      }),
    }
  })
}

const NUME_ALERTA: Record<TipCapcana, string> = {
  drosophila: 'Drosophila',
  lipicioasa_galbena: 'Capturi pe lipicioasele galbene',
  feromoni: 'Capturi pe capcanele cu feromoni',
  alta: 'Capturi',
}

/** „Drosophila peste prag la Maravilla 1 (9 în 3 capcane)”. */
export function textAlertaPrag(input: { tip: TipCapcana; parcela: string; capturi: number; nrBucati: number }): string {
  return `${NUME_ALERTA[input.tip]} peste prag la ${input.parcela} (${input.capturi} în ${capcaneText(input.nrBucati)})`
}

/** Rândul din rezumat: „Maravilla 1 · 3 Drosophila: 9 capturi azi”. */
export function textRezumatGrup(parcela: string, rezumat: Pick<RezumatGrup, 'tip' | 'nrBucati' | 'capturiAzi'>): string {
  return `${parcela} · ${rezumat.nrBucati} ${numeTipBucati(rezumat.tip, rezumat.nrBucati)}: ${capturiText(rezumat.capturiAzi)}`
}
