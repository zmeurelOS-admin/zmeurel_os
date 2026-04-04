import type { Comanda } from '@/lib/supabase/queries/comenzi'

export const MAGAZIN_DATA_ORIGIN = 'magazin_public'

export function isMagazinPublicOrder(c: Comanda): boolean {
  return c.data_origin === MAGAZIN_DATA_ORIGIN
}

/** Grup heuristic: același telefon + aceeași zi (data_comanda) + origine magazin. */
export function magazinGroupKey(c: Comanda): string | null {
  if (!isMagazinPublicOrder(c)) return null
  const phone = (c.telefon || '').trim()
  const day = (c.data_comanda || '').slice(0, 10)
  return `${phone}|${day}`
}

export function getMagazinGroupOrders(all: Comanda[], selected: Comanda): Comanda[] {
  const key = magazinGroupKey(selected)
  if (!key) return []
  return all
    .filter((c) => magazinGroupKey(c) === key)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Apropie liniile din același batch magazin (pentru tabel desktop). */
export function sortComenziForMagazinGrouping(items: Comanda[]): Comanda[] {
  const copy = [...items]
  copy.sort((a, b) => {
    const da = (a.data_livrare || a.data_comanda || '').slice(0, 10)
    const db = (b.data_livrare || b.data_comanda || '').slice(0, 10)
    if (da !== db) return da.localeCompare(db)
    const ka = magazinGroupKey(a)
    const kb = magazinGroupKey(b)
    if (ka && kb && ka === kb) return a.created_at.localeCompare(b.created_at)
    if (ka && kb && ka !== kb) return ka.localeCompare(kb)
    if (ka && !kb) return -1
    if (!ka && kb) return 1
    return b.created_at.localeCompare(a.created_at)
  })
  return copy
}

export function magazinDesktopRowClassName(row: Comanda, index: number, rows: Comanda[]): string {
  if (!isMagazinPublicOrder(row)) return ''
  const key = magazinGroupKey(row)
  if (!key) return ''
  const prev = rows[index - 1]
  const prevKey = prev ? magazinGroupKey(prev) : null
  const parts = [
    'border-l-[3px] border-l-[color:color-mix(in_srgb,var(--info-text)_50%,transparent)]',
    'bg-[color:color-mix(in_srgb,var(--soft-info-bg)_40%,transparent)]',
  ]
  if (prev && prevKey === key) {
    parts.push('border-t border-dashed border-[var(--agri-border)]')
  }
  return parts.join(' ')
}
