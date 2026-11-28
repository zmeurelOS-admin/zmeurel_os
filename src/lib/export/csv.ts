/**
 * CSV pentru Excel în română (promptul 35, §4): separator `;`, zecimale cu virgulă, BOM UTF-8 (diacriticele se văd
 * corect la dublu-clic), rânduri despărțite cu CRLF. Fără bibliotecă.
 */

export type CelulaCsv = string | number | boolean | null | undefined

const BOM = '﻿'

/** Un număr cu virgulă zecimală, fără separator de mii (Excel îl citește ca număr). */
export function numarCsv(valoare: number): string {
  if (!Number.isFinite(valoare)) return ''
  const rotunjit = Math.round(valoare * 100) / 100
  return String(rotunjit).replace('.', ',')
}

/**
 * Textul unei celule. Ghilimele când conține `;`, ghilimele, rând nou sau spații la capete. O formulă (`=…`, `@…`,
 * `+` / `-` urmat de altceva decât o cifră) primește un apostrof în față, ca Excel să n-o execute.
 */
export function celulaCsv(valoare: CelulaCsv): string {
  if (valoare === null || valoare === undefined) return ''
  if (typeof valoare === 'number') return numarCsv(valoare)
  if (typeof valoare === 'boolean') return valoare ? 'da' : 'nu'
  let text = String(valoare)
  if (/^[=@\t\r]/.test(text) || /^[+-](?![\d\s])/.test(text)) text = `'${text}`
  if (/[;"\r\n]/.test(text) || text !== text.trim()) return `"${text.replace(/"/g, '""')}"`
  return text
}

/** Documentul CSV: capul tabelului, apoi rândurile. */
export function catreCsv(cap: readonly string[], randuri: ReadonlyArray<ReadonlyArray<CelulaCsv>>): string {
  const linii = [cap.map(celulaCsv).join(';'), ...randuri.map((rand) => rand.map(celulaCsv).join(';'))]
  return `${BOM}${linii.join('\r\n')}\r\n`
}

/** `comenzi-2026-11-28.csv` */
export function numeFisierCsv(baza: string, aziIso: string): string {
  const curat = baza
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${curat || 'export'}-${aziIso}.csv`
}

/** Descarcă fișierul din browser (fără server). */
export function descarcaCsv(numeFisier: string, continut: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([continut], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = numeFisier
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
