'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/** Adresa cu un parametru schimbat (sau scos, la `null`), restul păstrați. Pur, testat. */
export function adresaCuParametru(pathname: string, search: string, nume: string, valoare: string | null): string {
  const parametri = new URLSearchParams(search)
  if (valoare === null || valoare === '') parametri.delete(nume)
  else parametri.set(nume, valoare)
  const text = parametri.toString()
  return text ? `${pathname}?${text}` : pathname
}

/**
 * Un parametru din adresă, citit și scris (promptul 35, §4): elementul ales (`?id=`), vederea (`?vedere=tabel`).
 * `push` = intră în istoric (un clic: „înapoi” din browser revine la elementul de dinainte); altfel `replace`
 * (săgețile, ca să nu umple istoricul).
 */
export function useParametruUrl(nume: string): [string | null, (valoare: string | null, optiuni?: { push?: boolean }) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const valoare = searchParams.get(nume)
  const search = searchParams.toString()

  const seteaza = useCallback(
    (urmatoarea: string | null, optiuni?: { push?: boolean }) => {
      const adresa = adresaCuParametru(pathname, search, nume, urmatoarea)
      if (optiuni?.push) router.push(adresa, { scroll: false })
      else router.replace(adresa, { scroll: false })
    },
    [nume, pathname, router, search],
  )

  return [valoare, seteaza]
}

/** Elementul ales din listă: `?id=`. Parametrii vechi (ex. `?client=` la Clienți) se citesc prin `alias`. */
export function useIdDinUrl(alias?: string): [string | null, (id: string | null, optiuni?: { push?: boolean }) => void] {
  const [id, seteaza] = useParametruUrl('id')
  const searchParams = useSearchParams()
  const vechi = alias ? searchParams.get(alias) : null
  return [id ?? vechi, seteaza]
}

export type VedereModul = 'lista' | 'tabel'

/** Comutatorul „Listă / Tabel” din antet, ținut în adresă (`?vedere=tabel`). */
export function useVedereDinUrl(): [VedereModul, (vedere: VedereModul) => void] {
  const [valoare, seteaza] = useParametruUrl('vedere')
  const vedere: VedereModul = valoare === 'tabel' ? 'tabel' : 'lista'
  const schimba = useCallback((urmatoarea: VedereModul) => seteaza(urmatoarea === 'tabel' ? 'tabel' : null), [seteaza])
  return [vedere, schimba]
}
