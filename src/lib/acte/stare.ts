/**
 * Starea „Actelor fermei” (fostele Documente legale): ce lipsește, pe rânduri, și textul de sus.
 * Sursa unică pentru ecranul Actele fermei, bannerul din aplicație, rândul din Setări și `getLegalDocsMissingFields`.
 * Regulile sunt cele de dinainte (aceleași câmpuri obligatorii, după forma juridică).
 */

export type FormaJuridica = 'certificat_producator' | 'pfa' | 'ii' | 'srl'

/** Rândurile ecranului; fiecare deschide o foaie cu câmpurile lui. */
export type RandActe = 'ferma' | 'certificat' | 'contact' | 'poza' | 'confirmare'

export type CampActe =
  | 'full_name'
  | 'legal_type'
  | 'locality'
  | 'phone'
  | 'certificate_photo_url'
  | 'accepted'
  | 'certificate_series'
  | 'certificate_number'
  | 'certificate_expiry'
  | 'cui'

/** Datele, indiferent dacă vin din rândul salvat sau din ciorna din ecran. */
export interface ActeDate {
  full_name?: string | null
  legal_type?: FormaJuridica | null
  locality?: string | null
  phone?: string | null
  certificate_photo_url?: string | null
  /** Confirmarea legală (în bază: `legal_accepted_at`). */
  accepted?: boolean
  certificate_series?: string | null
  certificate_number?: string | null
  certificate_expiry?: string | null
  cui?: string | null
}

export interface LipsaActe {
  camp: CampActe
  rand: RandActe
  /** Cu literă mică, pentru liste: „seria certificatului”. */
  eticheta: string
}

export const RAND_CAMPURI: Record<RandActe, readonly CampActe[]> = {
  ferma: ['legal_type', 'cui', 'locality'],
  certificat: ['certificate_series', 'certificate_number', 'certificate_expiry'],
  contact: ['full_name', 'phone'],
  poza: ['certificate_photo_url'],
  confirmare: ['accepted'],
}

const RAND_AL_CAMPULUI = Object.fromEntries(
  (Object.entries(RAND_CAMPURI) as Array<[RandActe, readonly CampActe[]]>).flatMap(([rand, campuri]) =>
    campuri.map((camp) => [camp, rand]),
  ),
) as Record<CampActe, RandActe>

/** Rândul pe care stă un câmp (pentru erorile de validare). */
export function randAlCampului(camp: CampActe): RandActe {
  return RAND_AL_CAMPULUI[camp]
}

export function esteCertificat(forma: FormaJuridica | null | undefined): forma is 'certificat_producator' {
  return forma === 'certificat_producator'
}

export function etichetaPoza(forma: FormaJuridica | null | undefined): string {
  return esteCertificat(forma) || !forma ? 'poza certificatului' : 'poza documentului'
}

function gol(value: string | null | undefined): boolean {
  return !value?.trim()
}

/** Ce lipsește, în ordinea rândurilor de pe ecran. */
export function lipsuriActe(date: ActeDate | null | undefined): LipsaActe[] {
  const d = date ?? {}
  const forma = d.legal_type ?? null
  const lipsa = (camp: CampActe, eticheta: string): LipsaActe => ({ camp, rand: RAND_AL_CAMPULUI[camp], eticheta })
  const lista: LipsaActe[] = []

  if (!forma) lista.push(lipsa('legal_type', 'forma juridică'))
  if (forma && !esteCertificat(forma) && gol(d.cui)) lista.push(lipsa('cui', 'CUI-ul'))
  if (gol(d.locality)) lista.push(lipsa('locality', 'localitatea'))

  if (esteCertificat(forma)) {
    if (gol(d.certificate_number)) lista.push(lipsa('certificate_number', 'numărul certificatului'))
    if (gol(d.certificate_series)) lista.push(lipsa('certificate_series', 'seria certificatului'))
    if (gol(d.certificate_expiry)) lista.push(lipsa('certificate_expiry', 'data vizei'))
  }

  if (gol(d.full_name)) lista.push(lipsa('full_name', 'numele'))
  if (gol(d.phone)) lista.push(lipsa('phone', 'telefonul'))
  if (gol(d.certificate_photo_url)) lista.push(lipsa('certificate_photo_url', etichetaPoza(forma)))
  if (!d.accepted) lista.push(lipsa('accepted', 'confirmarea datelor'))

  return lista
}

/** „a, b și c” */
export function insiruire(parti: readonly string[]): string {
  if (parti.length <= 1) return parti[0] ?? ''
  return `${parti.slice(0, -1).join(', ')} și ${parti[parti.length - 1]}`
}

/** „Lipsește o dată”, „Lipsesc 2 date”, „Lipsesc 20 de date”. */
export function titluLipsuri(numar: number): string {
  if (numar === 1) return 'Lipsește o dată'
  const rest = numar % 100
  return rest === 0 || rest >= 20 ? `Lipsesc ${numar} de date` : `Lipsesc ${numar} date`
}

function cuMajuscula(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

export interface StareActe {
  complete: boolean
  lipsuri: LipsaActe[]
  /** „Complete” sau „Lipsesc 2 date”. */
  titlu: string
  /** „Seria certificatului și data vizei.” (`null` când e complet). */
  detaliu: string | null
}

export function stareActe(date: ActeDate | null | undefined): StareActe {
  const lipsuri = lipsuriActe(date)
  if (lipsuri.length === 0) return { complete: true, lipsuri, titlu: 'Complete', detaliu: null }
  return {
    complete: false,
    lipsuri,
    titlu: titluLipsuri(lipsuri.length),
    detaliu: `${cuMajuscula(insiruire(lipsuri.map((item) => item.eticheta)))}.`,
  }
}

export function lipsuriPeRand(lipsuri: readonly LipsaActe[], rand: RandActe): LipsaActe[] {
  return lipsuri.filter((item) => item.rand === rand)
}

/** Rândul salvat (`farmer_legal_docs`) → datele pentru stare. */
export function acteDinDocument(
  doc:
    | {
        full_name?: string | null
        legal_type?: FormaJuridica | null
        locality?: string | null
        phone?: string | null
        certificate_photo_url?: string | null
        legal_accepted_at?: string | null
        certificate_series?: string | null
        certificate_number?: string | null
        certificate_expiry?: string | null
        cui?: string | null
      }
    | null
    | undefined,
): ActeDate {
  return {
    full_name: doc?.full_name ?? null,
    legal_type: doc?.legal_type ?? null,
    locality: doc?.locality ?? null,
    phone: doc?.phone ?? null,
    certificate_photo_url: doc?.certificate_photo_url ?? null,
    accepted: Boolean(doc?.legal_accepted_at),
    certificate_series: doc?.certificate_series ?? null,
    certificate_number: doc?.certificate_number ?? null,
    certificate_expiry: doc?.certificate_expiry ?? null,
    cui: doc?.cui ?? null,
  }
}

/** Textul bannerului din aplicație: același lucru ca sus, pe ecranul Actele fermei. */
export function textBannerActe(stare: StareActe): string {
  if (stare.complete) return 'Actele fermei nu sunt încă validate. Verifică-le.'
  return `Actele fermei: ${stare.titlu.charAt(0).toLowerCase()}${stare.titlu.slice(1)} (${insiruire(stare.lipsuri.map((item) => item.eticheta))}).`
}
