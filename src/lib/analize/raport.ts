/**
 * Raportul unei analize: pagina publică `/a/<token>`, raportul din aplicație, PDF-ul și afișul A4 cu QR.
 * Toate pornesc din `construiesteRaport`, care alege DOAR câmpurile permise.
 *
 * Nu apar niciodată: numărul atestatului, poza atestatului, poza PV-ului, numele inspectorului, nota internă.
 * Raportul există doar pentru `status = 'conform'` (și, public, doar cu `public_activ`); altfel `null` → 404.
 * Funcții pure (HTML-ul are textul scăpat).
 */
import { escapeHtml } from '@/lib/rapoarte/export'

import { dataScurtaAnaliza } from './lista'
import { optiuniEfective, PRELEVAT_IN_RAPORT, type PrelevatDe, type StatusAnaliza, type SubstantaAnaliza } from './model'
import { textPauzaInainte, type TratamentInainte } from './tratamente-inainte'

/** Doar câmpurile analizei pe care raportul le poate citi (selectul de pe server cere exact acestea). */
export const COLOANE_ANALIZA_RAPORT =
  'id,tenant_id,status,public_activ,public_optiuni,public_token,data_prelevare,pv_numar,prelevat_de,laborator,data_predare,buletin_numar,buletin_data,buletin_path,ce_s_a_analizat,rest_nedetectate'

export interface AnalizaPentruRaport {
  status: StatusAnaliza
  public_activ: boolean
  public_optiuni: unknown
  public_token: string
  data_prelevare: string
  pv_numar: string | null
  prelevat_de: PrelevatDe | null
  laborator: string | null
  data_predare: string | null
  buletin_numar: string | null
  buletin_data: string | null
  buletin_path: string | null
  ce_s_a_analizat: string | null
  rest_nedetectate: boolean | null
}

export interface IntrareRaport {
  analiza: AnalizaPentruRaport
  ferma: { nume: string | null; localitate: string | null }
  /** Din Actele fermei, doar la atestat de producător: seria și valabilitatea (numărul nu intră aici). */
  atestat: { serie: string | null; valabilPana: string | null } | null
  telefon: string | null
  optiuniFerma: unknown
  parcele: ReadonlyArray<{ nume: string; soi: string | null; cultura: string | null }>
  substante: readonly SubstantaAnaliza[]
  tratamente: readonly TratamentInainte[]
  /** Linkul public (pentru QR). */
  url: string
  /** Linkul semnat spre poza buletinului, doar dacă opțiunea e pornită (îl face serverul). */
  pozaBuletinUrl?: string | null
}

export interface RaportAnaliza {
  ferma: { nume: string; localitate: string | null }
  atestat: { serie: string; valabilPana: string | null } | null
  parcele: Array<{ nume: string; soi: string | null }>
  /** Cultura și soiul, câte o etichetă, fiecare o singură dată („Zmeure Delniwa”, „Zmeură Maravilla”). */
  soiuri: string[]
  prelevare: { data: string; pv: string | null; cine: string | null }
  laborator: string | null
  buletin: { numar: string | null; data: string | null }
  analizat: string | null
  substante: Array<{ substanta: string; gasit: number | null; limita: number | null }> | null
  restNedetectate: boolean
  tratamente: Array<{ zi: string; nume: string; pauza: string; respectata: boolean }> | null
  telefon: string | null
  pozaBuletinUrl: string | null
  url: string
}

const curat = (valoare: string | null | undefined): string | null => valoare?.trim() || null

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Eticheta unei parcele din cultură și soi, fără repetiții: în demo (și la multe ferme) cultura și soiul au același
 * text („Zmeure Maravilla”), iar uneori unul îl conține pe celălalt („Zmeură” + „Zmeură Maravilla”).
 */
function etichetaParcela(cultura: string | null, soi: string | null): string | null {
  if (cultura && soi) {
    const c = fold(cultura)
    const s = fold(soi)
    if (s.includes(c)) return soi
    if (c.includes(s)) return cultura
    return `${cultura} ${soi}`
  }
  return cultura ?? soi
}

/** Etichetele cultură + soi ale parcelelor, fiecare o singură dată (fără diacritice/majuscule la comparare), în ordinea parcelelor. */
export function soiuriRaport(parcele: ReadonlyArray<{ soi: string | null; cultura: string | null }>): string[] {
  const vazute = new Set<string>()
  const rezultat: string[] = []
  for (const parcela of parcele) {
    const eticheta = etichetaParcela(curat(parcela.cultura), curat(parcela.soi))
    if (!eticheta) continue
    const cheie = fold(eticheta)
    if (vazute.has(cheie)) continue
    vazute.add(cheie)
    rezultat.push(eticheta)
  }
  return rezultat
}

/**
 * Raportul, cu doar câmpurile permise de opțiuni. `null` dacă analiza nu e conformă sau (public) linkul e oprit.
 * `previzualizare` = raportul din aplicație: arată și când linkul public e oprit (dar tot doar pentru conform).
 */
export function construiesteRaport(intrare: IntrareRaport, options: { previzualizare?: boolean } = {}): RaportAnaliza | null {
  const { analiza } = intrare
  if (analiza.status !== 'conform') return null
  if (!options.previzualizare && !analiza.public_activ) return null

  const optiuni = optiuniEfective(intrare.optiuniFerma, analiza.public_optiuni)
  const serie = curat(intrare.atestat?.serie)

  return {
    ferma: { nume: curat(intrare.ferma.nume) ?? 'Ferma', localitate: curat(intrare.ferma.localitate) },
    atestat: serie ? { serie, valabilPana: curat(intrare.atestat?.valabilPana) } : null,
    parcele: intrare.parcele.map((parcela) => ({ nume: parcela.nume, soi: curat(parcela.soi) })),
    soiuri: soiuriRaport(intrare.parcele),
    prelevare: {
      data: analiza.data_prelevare,
      pv: optiuni.numere ? curat(analiza.pv_numar) : null,
      cine: analiza.prelevat_de ? PRELEVAT_IN_RAPORT[analiza.prelevat_de] : null,
    },
    laborator: curat(analiza.laborator),
    buletin: { numar: optiuni.numere ? curat(analiza.buletin_numar) : null, data: analiza.buletin_data },
    analizat: curat(analiza.ce_s_a_analizat),
    substante: optiuni.substante
      ? [...intrare.substante]
          .sort((a, b) => a.ordine - b.ordine)
          .filter((s) => s.substanta.trim())
          .map((s) => ({ substanta: s.substanta.trim(), gasit: s.valoare_mg_kg, limita: s.lmr_mg_kg }))
      : null,
    restNedetectate: analiza.rest_nedetectate === true,
    tratamente: optiuni.tratamente
      ? intrare.tratamente.map((t) => ({ zi: t.zi, nume: t.nume, pauza: textPauzaInainte(t), respectata: t.respectata }))
      : null,
    telefon: optiuni.telefon ? curat(intrare.telefon) : null,
    pozaBuletinUrl: optiuni.poza_buletin && analiza.buletin_path ? (intrare.pozaBuletinUrl ?? null) : null,
    url: intrare.url,
  }
}

// ─── Textele raportului (aceleași pe pagină, în PDF și pe afiș) ────────────────────────────────────

const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

/** `2031-07-15` → `15.07.2031`. */
export function dataPunct(ziua: string): string {
  const [an, luna, zi] = ziua.slice(0, 10).split('-')
  return `${zi}.${luna}.${an}`
}

/** `2026-07-03` → `3 iulie 2026`. */
export function dataLungaCuAn(ziua: string): string {
  return `${Number(ziua.slice(8, 10))} ${LUNI[Number(ziua.slice(5, 7)) - 1]} ${ziua.slice(0, 4)}`
}

export function textAtestat(raport: Pick<RaportAnaliza, 'atestat'>): string | null {
  if (!raport.atestat) return null
  return `Atestat de producător seria ${raport.atestat.serie}${raport.atestat.valabilPana ? ` · valabil până la ${dataPunct(raport.atestat.valabilPana)}` : ''}`
}

export function textParceleRaport(raport: Pick<RaportAnaliza, 'parcele' | 'soiuri'>): string {
  const nume = raport.parcele.map((p) => p.nume)
  const parcele =
    nume.length === 0 ? '' : nume.length === 1 ? `parcela ${nume[0]}` : `parcelele ${nume.slice(0, -1).join(', ')} și ${nume[nume.length - 1]}`
  return [raport.soiuri.join(', '), parcele].filter(Boolean).join(' · ')
}

export function textPrelevare(raport: Pick<RaportAnaliza, 'prelevare' | 'laborator' | 'buletin'>): string {
  const pv = [raport.prelevare.pv ? `PV nr. ${raport.prelevare.pv}` : null, raport.prelevare.cine].filter(Boolean).join(', ')
  const parti = [
    `Prelevată ${dataLungaCuAn(raport.prelevare.data)}${pv ? ` (${pv})` : ''}`,
    raport.laborator ? `predată la ${raport.laborator}` : null,
    raport.buletin.numar || raport.buletin.data
      ? `buletin${raport.buletin.numar ? ` nr. ${raport.buletin.numar}` : ''}${raport.buletin.data ? ` din ${dataLungaCuAn(raport.buletin.data)}` : ''}`
      : null,
  ]
  return parti.filter(Boolean).join(' · ')
}

/** `0.08` → „0,08”, `10` → „10”, `0.005` → „0,005” (fără zerouri inutile). */
export function numarMgKg(valoare: number | null): string {
  if (valoare === null || !Number.isFinite(valoare)) return '—'
  const text = String(Number(valoare.toFixed(4)))
  return text.replace('.', ',')
}

export function textTratamentRaport(t: { zi: string; nume: string; pauza: string; respectata: boolean }, azi?: string): string {
  return `${t.nume} (${dataScurtaAnaliza(t.zi, azi ?? t.zi)}, ${t.pauza}${t.respectata ? ' ✓' : ''})`
}

// ─── HTML pentru PDF și afiș (fereastra de tipărire, ca în Rapoarte) ──────────────────────────────

function sectiuniHtml(raport: RaportAnaliza, mare: boolean): string {
  const atestat = textAtestat(raport)
  const substante = raport.substante?.length
    ? `<table><thead><tr><th>Substanță</th><th>Găsit (mg/kg)</th><th>Limita (mg/kg)</th></tr></thead><tbody>${raport.substante
        .map((s) => `<tr><td>${escapeHtml(s.substanta)}</td><td>${escapeHtml(numarMgKg(s.gasit))}</td><td>${escapeHtml(numarMgKg(s.limita))}</td></tr>`)
        .join('')}${raport.restNedetectate ? '<tr><td colspan="3">Restul substanțelor analizate: nedetectate</td></tr>' : ''}</tbody></table>`
    : raport.restNedetectate
      ? '<p>Substanțele analizate: nedetectate.</p>'
      : ''
  const tratamente = raport.tratamente
    ? `<p class="k">Tratamente în cele 30 de zile dinainte: ${
        raport.tratamente.length ? escapeHtml(raport.tratamente.map((t) => textTratamentRaport(t)).join('; ')) : 'niciunul'
      }</p>`
    : ''
  return [
    `<h1>${escapeHtml(raport.ferma.nume)}${raport.ferma.localitate ? ` · ${escapeHtml(raport.ferma.localitate)}` : ''}</h1>`,
    atestat ? `<p class="k">${escapeHtml(atestat)}</p>` : '',
    `<p class="ok">✓ Conform: nicio limită depășită</p>`,
    `<p class="k">${escapeHtml(textParceleRaport(raport))}</p>`,
    raport.analizat ? `<p class="k">Analiza: ${escapeHtml(raport.analizat)}</p>` : '',
    `<p class="k">${escapeHtml(textPrelevare(raport))}</p>`,
    mare ? '' : substante,
    mare ? '' : tratamente,
    raport.telefon ? `<p class="k">Comenzi: ${escapeHtml(raport.telefon)}</p>` : '',
  ].join('')
}

const STIL_COMUN =
  'body{font-family:Arial,sans-serif;color:black;margin:0}h1{margin:0 0 6px}p{margin:0 0 8px}.k{color:dimgray}.ok{background:honeydew;color:darkgreen;border-radius:12px;padding:10px 12px;font-weight:bold}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border-bottom:1px solid gainsboro;padding:6px 4px;text-align:left}th{color:dimgray}'

/** PDF-ul raportului (A4 portret), cu QR mic în colț. `qrSvg` = SVG-ul codului QR (din `qrcode`). */
export function htmlRaportPdf(raport: RaportAnaliza, qrSvg: string): string {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8" /><title>Raportul analizei · ${escapeHtml(raport.ferma.nume)}</title><style>${STIL_COMUN}body{padding:28px;font-size:13px}h1{font-size:22px}.hd{display:flex;gap:16px;justify-content:space-between;align-items:flex-start}.qr{width:120px;height:120px;flex:none}.qr svg{width:100%;height:100%}.url{font-size:11px;color:dimgray;word-break:break-all}@page{size:A4;margin:12mm}</style></head><body><div class="hd"><div>${sectiuniHtml(raport, false)}</div><div class="qr">${qrSvg}</div></div><p class="url">${escapeHtml(raport.url)}</p></body></html>`
}

/** Afișul A4 pentru piață: verdictul mare, ferma, parcelele și un QR mare spre același link. */
export function htmlAfisA4(raport: RaportAnaliza, qrSvg: string): string {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8" /><title>Afiș · analiza la fructe · ${escapeHtml(raport.ferma.nume)}</title><style>${STIL_COMUN}body{padding:16mm;font-size:20px;text-align:center}h1{font-size:40px;margin-bottom:12px}.titlu{font-size:28px;font-weight:bold;margin-bottom:16px}.ok{font-size:34px;padding:18px;margin:18px 0}.qr{width:120mm;height:120mm;margin:12mm auto 6mm}.qr svg{width:100%;height:100%}.scan{font-size:22px;font-weight:bold}.url{font-size:14px;color:dimgray;word-break:break-all}@page{size:A4;margin:0}</style></head><body><p class="titlu">Analiza la fructe</p>${sectiuniHtml(raport, true)}<div class="qr">${qrSvg}</div><p class="scan">Scanează pentru raportul complet</p><p class="url">${escapeHtml(raport.url)}</p></body></html>`
}

/** Linkul public al unei analize. */
export function urlPublicAnaliza(origine: string, token: string): string {
  return `${origine.replace(/\/$/, '')}/a/${encodeURIComponent(token)}`
}
