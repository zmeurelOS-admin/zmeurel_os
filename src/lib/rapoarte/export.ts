/**
 * Exportul din Rapoarte: același document HTML pentru Excel (fișier `.xls` din HTML, formatul de până acum)
 * și pentru PDF (fereastra de tipărire a browserului). Funcții pure, cu textul scăpat (`&`, `<`, `>`, `"`).
 * CSV-ul s-a scos (decizia din 21.11).
 */
import { formatKg, formatLei, formatNumber } from '@/lib/format-ro'

import type { RandRegistru } from './registru-tratamente'

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** `2026-07-15` → `15.07.2026`. */
export function dataRo(iso: string): string {
  const [an, luna, zi] = iso.slice(0, 10).split('-')
  return an && luna && zi ? `${zi}.${luna}.${an}` : iso
}

export interface TabelExport {
  titlu: string
  coloane: string[]
  randuri: (string | number)[][]
}

export interface DocumentExport {
  titlu: string
  /** Rândul de sub titlu (ex. „Perioada: 01.06.2026 – 21.11.2026”). */
  subtitlu: string
  tabele: TabelExport[]
}

function tabelHtml(tabel: TabelExport): string {
  const cap = tabel.coloane.map((coloana) => `<th>${escapeHtml(coloana)}</th>`).join('')
  const corp =
    tabel.randuri.length > 0
      ? tabel.randuri.map((rand) => `<tr>${rand.map((celula) => `<td>${escapeHtml(celula)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${tabel.coloane.length}">Nimic în perioada aleasă.</td></tr>`
  return `<h2>${escapeHtml(tabel.titlu)}</h2><table border="1"><thead><tr>${cap}</tr></thead><tbody>${corp}</tbody></table>`
}

/** Documentul întreg. `tiparire` adaugă stilul pentru PDF (culori cu nume, fără hex). */
export function documentHtml(doc: DocumentExport, tiparire = false): string {
  const stil = tiparire
    ? '<style>body{font-family:Arial,sans-serif;padding:24px;color:black}h1{margin:0 0 4px;font-size:22px}h2{margin:20px 0 8px;font-size:16px}p{margin:0 0 12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid gray;padding:6px;text-align:left;vertical-align:top}th{background:gainsboro}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style>'
    : ''
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(doc.titlu)}</title>${stil}</head><body><h1>${escapeHtml(doc.titlu)}</h1><p>${escapeHtml(doc.subtitlu)}</p>${doc.tabele.map(tabelHtml).join('')}</body></html>`
}

export interface RaportPentruExport {
  eticheta: string
  start: string
  end: string
  incasat: number
  cheltuieli: number
  profit: number
  recoltatKg: number
  investitiiLei: number
  luni: { luna: string; incasat: number; cheltuieli: number }[]
  parcele: { nume: string; kg: number; nrPlante: number | null; kgPePlanta: number | null; personal: boolean }[]
  culegatori: { nume: string; kg: number; plata: number }[]
  clienti: { nume: string; incasat: number }[]
  cheltuieliPeCategorii: { categorie: string; lei: number }[]
  investitiiPeCategorii: { categorie: string; lei: number }[]
}

export function documentRaport(raport: RaportPentruExport): DocumentExport {
  return {
    titlu: `Raport ${raport.eticheta}`,
    subtitlu: `Perioada: ${dataRo(raport.start)} – ${dataRo(raport.end)}`,
    tabele: [
      {
        titlu: 'Pe scurt',
        coloane: ['Indicator', 'Valoare'],
        randuri: [
          ['Profit (încasat − cheltuieli, fără investiții)', formatLei(raport.profit)],
          ['Încasat', formatLei(raport.incasat)],
          ['Cheltuieli', formatLei(raport.cheltuieli)],
          ['Recoltat (fără parcelele personale)', formatKg(raport.recoltatKg)],
          ['Investiții (separat, nu scad din profit)', formatLei(raport.investitiiLei)],
        ],
      },
      {
        titlu: 'Încasat și cheltuieli, pe luni',
        coloane: ['Luna', 'Încasat (lei)', 'Cheltuieli (lei)'],
        randuri: raport.luni.map((luna) => [luna.luna, formatNumber(luna.incasat), formatNumber(luna.cheltuieli)]),
      },
      {
        titlu: 'Pe parcele',
        coloane: ['Parcela', 'Kg', 'Plante', 'Kg/plantă', 'Rol'],
        randuri: raport.parcele.map((parcela) => [
          parcela.nume,
          formatNumber(parcela.kg),
          parcela.nrPlante ?? '',
          parcela.kgPePlanta !== null ? formatNumber(parcela.kgPePlanta, 1) : '',
          parcela.personal ? 'Personal' : 'Comercial',
        ]),
      },
      {
        titlu: 'Pe culegători',
        coloane: ['Culegător', 'Kg', 'Plată (lei)'],
        randuri: raport.culegatori.map((culegator) => [culegator.nume, formatNumber(culegator.kg), formatNumber(culegator.plata)]),
      },
      {
        titlu: 'Pe clienți (încasat)',
        coloane: ['Client', 'Încasat (lei)'],
        randuri: raport.clienti.map((client) => [client.nume, formatNumber(client.incasat)]),
      },
      {
        titlu: 'Cheltuieli pe categorii',
        coloane: ['Categorie', 'Lei'],
        randuri: raport.cheltuieliPeCategorii.map((rand) => [rand.categorie, formatNumber(rand.lei)]),
      },
      {
        titlu: 'Investiții pe categorii',
        coloane: ['Categorie', 'Lei'],
        randuri: raport.investitiiPeCategorii.map((rand) => [rand.categorie, formatNumber(rand.lei)]),
      },
    ],
  }
}

export const COLOANE_REGISTRU = [
  'Data',
  'Parcela',
  'Metoda',
  'Produsul',
  'Substanța activă',
  'Doza',
  'Cantitatea',
  'Pauza (zile)',
  'Se poate recolta de la',
] as const

export function documentRegistru(randuri: readonly RandRegistru[], start: string, end: string): DocumentExport {
  return {
    titlu: 'Registrul de tratamente',
    subtitlu: `Perioada: ${dataRo(start)} – ${dataRo(end)}`,
    tabele: [
      {
        titlu: 'Tratamente aplicate',
        coloane: [...COLOANE_REGISTRU],
        randuri: randuri.map((rand) => [
          dataRo(rand.data),
          rand.parcela,
          rand.importat ? `${rand.metoda} (din Activități)` : rand.metoda,
          rand.produs,
          rand.substanta,
          rand.doza,
          rand.cantitate,
          rand.pauzaZile > 0 ? rand.pauzaZile : '',
          rand.recoltarePermisa ? dataRo(rand.recoltarePermisa) : '',
        ]),
      },
    ],
  }
}

/** Numele fișierului: `raport-sezonul-2026-2026-11-21.xls`. */
export function numeFisier(baza: string, azi: string, extensie: 'xls'): string {
  const slug = baza
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug}-${azi}.${extensie}`
}
