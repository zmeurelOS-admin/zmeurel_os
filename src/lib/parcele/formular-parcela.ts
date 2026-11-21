/**
 * Formularul de parcelă (nou / editare), fără React: ciorna (text, cum se scrie), validarea și ce se trimite
 * în `parcele`. Aceleași câmpuri ca formularul vechi, plus „Volum de soluție la o stropire”
 * (`volum_solutie_l`, din migrarea Tratamente) și „Pentru: Comercial / Personal” (`rol`).
 *
 * Notele parcelei pot avea blocuri ascunse (culturile mai multe, `[zmeurel:…]`): omul vede doar textul lui,
 * iar blocurile se păstrează la salvare.
 */
import { buildParcelaObservatii, getParcelCropRowsFromObservatii, stripHiddenAgricultureMetadata } from '@/lib/parcele/crop-config'
import {
  coerceStatusOperationalFromDb,
  parseParcelaScop,
  type ParcelaScop,
  type StatusOperational,
} from '@/lib/parcele/dashboard-relevance'
import { parseParcelCropValues, serializeParcelLegacyCropLabel } from '@/lib/parcele/parcel-form-options'
import type { UnitateTip } from '@/lib/parcele/unitate'
import { normalizeUnitateTip } from '@/lib/parcele/unitate'
import type { Parcela, ParcelaUpdate } from '@/lib/supabase/queries/parcele'

export interface ParcelaDraft {
  nume: string
  tip: UnitateTip
  cultura: string
  soi: string
  plante: string
  suprafata: string
  volum: string
  rol: ParcelaScop
  // Mai multe detalii
  statusOperational: StatusOperational
  status: string
  anPlantare: string
  dataPlantarii: string
  randuri: string
  distanta: string
  irigare: string
  apareInDashboard: boolean
  contribuieLaProductie: boolean
  latitudine: string
  longitudine: string
  observatii: string
}

/** La „Comercial” parcela intră în Acasă și în producție; altfel nu (regula formularului vechi). */
export function implicitePentruScop(scop: ParcelaScop): { apareInDashboard: boolean; contribuieLaProductie: boolean } {
  return scop === 'comercial' ? { apareInDashboard: true, contribuieLaProductie: true } : { apareInDashboard: false, contribuieLaProductie: false }
}

const textNumar = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? '' : String(value).replace('.', ','))

export function draftParcelaNoua(an: number): ParcelaDraft {
  return {
    nume: '',
    tip: 'camp',
    cultura: '',
    soi: '',
    plante: '',
    suprafata: '',
    volum: '',
    rol: 'comercial',
    statusOperational: 'activ',
    status: 'Activ',
    anPlantare: String(an),
    dataPlantarii: '',
    randuri: '',
    distanta: '',
    irigare: '',
    apareInDashboard: true,
    contribuieLaProductie: true,
    latitudine: '',
    longitudine: '',
    observatii: '',
  }
}

export function draftDinParcela(parcela: Parcela & { volum_solutie_l?: number | null }, an: number): ParcelaDraft {
  const crop = parseParcelCropValues({ cultura: parcela.cultura, soi: parcela.soi, soi_plantat: parcela.soi_plantat, tip_fruct: parcela.tip_fruct })
  return {
    nume: parcela.nume_parcela ?? '',
    tip: normalizeUnitateTip(parcela.tip_unitate),
    cultura: crop.cultura,
    soi: crop.soi,
    plante: parcela.nr_plante && parcela.nr_plante > 0 ? String(parcela.nr_plante) : '',
    suprafata: textNumar(parcela.suprafata_m2),
    volum: textNumar(parcela.volum_solutie_l),
    rol: parseParcelaScop(parcela.rol) ?? 'comercial',
    statusOperational: coerceStatusOperationalFromDb(parcela.status_operational),
    status: parcela.status ?? 'Activ',
    anPlantare: parcela.an_plantare ? String(parcela.an_plantare) : String(an),
    dataPlantarii: parcela.data_plantarii ?? '',
    randuri: parcela.nr_randuri ? String(parcela.nr_randuri) : '',
    distanta: textNumar(parcela.distanta_intre_randuri),
    irigare: parcela.sistem_irigare ?? '',
    apareInDashboard: parcela.apare_in_dashboard ?? true,
    contribuieLaProductie: parcela.contribuie_la_productie ?? true,
    latitudine: parcela.latitudine === null || parcela.latitudine === undefined ? '' : String(parcela.latitudine),
    longitudine: parcela.longitudine === null || parcela.longitudine === undefined ? '' : String(parcela.longitudine),
    observatii: stripHiddenAgricultureMetadata(parcela.observatii),
  }
}

/** „1.200,5” / „1200.5” / „1 200” → 1200.5; gol → `null`; altceva → `NaN`. */
export function numarRo(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const compact = trimmed.replace(/\s/g, '')
  const normalized = compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact
  const n = Number(normalized)
  return Number.isFinite(n) ? n : Number.NaN
}

export type CampParcela = 'nume' | 'suprafata' | 'plante' | 'volum' | 'anPlantare' | 'randuri' | 'distanta' | 'latitudine' | 'longitudine' | 'dataPlantarii'

export function eroriParcela(draft: ParcelaDraft): Partial<Record<CampParcela, string>> {
  const erori: Partial<Record<CampParcela, string>> = {}
  if (draft.nume.trim().length === 0) erori.nume = 'Scrie numele parcelei.'
  const suprafata = numarRo(draft.suprafata)
  if (suprafata === null) erori.suprafata = 'Scrie suprafața în m².'
  else if (!Number.isFinite(suprafata) || suprafata <= 0) erori.suprafata = 'Suprafața e un număr mai mare ca 0, de exemplu 700.'
  const plante = numarRo(draft.plante)
  if (plante !== null && (!Number.isInteger(plante) || plante <= 0)) erori.plante = 'Numărul de plante e un număr întreg, de exemplu 500.'
  const volum = numarRo(draft.volum)
  if (volum !== null && (!Number.isFinite(volum) || volum <= 0)) erori.volum = 'Volumul e în litri, de exemplu 60.'
  const an = numarRo(draft.anPlantare)
  if (an === null || !Number.isInteger(an) || an < 1900 || an > 2100) erori.anPlantare = 'Anul plantării, de exemplu 2024.'
  const randuri = numarRo(draft.randuri)
  if (randuri !== null && (!Number.isInteger(randuri) || randuri <= 0)) erori.randuri = 'Numărul de rânduri e un număr întreg.'
  const distanta = numarRo(draft.distanta)
  if (distanta !== null && (!Number.isFinite(distanta) || distanta <= 0)) erori.distanta = 'Distanța e în metri, de exemplu 3.'
  const lat = numarRo(draft.latitudine)
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) erori.latitudine = 'Latitudinea e între -90 și 90.'
  const lon = numarRo(draft.longitudine)
  if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) erori.longitudine = 'Longitudinea e între -180 și 180.'
  if (draft.dataPlantarii.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dataPlantarii.trim())) erori.dataPlantarii = 'Data plantării nu e validă.'
  return erori
}

/**
 * Ce se scrie în `parcele`. `cuVolum` = coloana `volum_solutie_l` există. La editare, notele păstrează blocurile
 * ascunse ale parcelei (`observatiiVechi`). La solarii cultura se ține în `culturi`, nu pe parcelă.
 */
export function payloadParcela(draft: ParcelaDraft, options: { cuVolum: boolean; observatiiVechi?: string | null }): ParcelaUpdate & { volum_solutie_l?: number | null } {
  const solar = draft.tip === 'solar'
  const cultura = solar ? '' : draft.cultura.trim()
  const soi = solar ? '' : draft.soi.trim()
  const plante = numarRo(draft.plante)
  const randuri = numarRo(draft.randuri)
  const distanta = numarRo(draft.distanta)
  const lat = numarRo(draft.latitudine)
  const lon = numarRo(draft.longitudine)
  const payload: ParcelaUpdate & { volum_solutie_l?: number | null } = {
    nume_parcela: draft.nume.trim(),
    tip_unitate: draft.tip,
    suprafata_m2: numarRo(draft.suprafata) ?? 0,
    cultura: cultura || null,
    tip_fruct: cultura || null,
    soi: soi || null,
    soi_plantat: serializeParcelLegacyCropLabel(cultura, soi) || null,
    nr_plante: solar ? null : plante && Number.isInteger(plante) && plante > 0 ? plante : null,
    rol: draft.rol,
    apare_in_dashboard: draft.apareInDashboard,
    contribuie_la_productie: draft.contribuieLaProductie,
    status_operational: draft.statusOperational,
    status: draft.status || 'Activ',
    an_plantare: Number(numarRo(draft.anPlantare)) || new Date().getFullYear(),
    data_plantarii: draft.dataPlantarii.trim() || null,
    nr_randuri: randuri && Number.isInteger(randuri) && randuri > 0 ? randuri : null,
    distanta_intre_randuri: distanta && distanta > 0 ? distanta : null,
    sistem_irigare: draft.irigare.trim() || null,
    latitudine: lat !== null && Number.isFinite(lat) ? lat : null,
    longitudine: lon !== null && Number.isFinite(lon) ? lon : null,
    observatii: buildParcelaObservatii(draft.observatii, getParcelCropRowsFromObservatii(options.observatiiVechi)),
  }
  if (options.cuVolum) {
    const volum = numarRo(draft.volum)
    payload.volum_solutie_l = volum !== null && Number.isFinite(volum) && volum > 0 ? volum : null
  }
  return payload
}
