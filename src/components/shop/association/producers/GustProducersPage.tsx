'use client'

import Link from 'next/link'
import { MapPin } from 'lucide-react'

import { labelForCategory } from '@/components/shop/association/tokens'
import { gustaBrandColors, gustaBrandShadows, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import { associationProducerProfilePath } from '@/lib/shop/association-routes'
import { cn } from '@/lib/utils'

export type GustProducerCard = {
  tenantId: string
  farmName: string
  specialty: string
  /** Afișat sub specialitate (implicit Suceava dacă nu există în date). */
  location: string
}

export type GustProducersPageProps = {
  producers: GustProducerCard[]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function GustProducersPage({ producers }: GustProducersPageProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="assoc-heading text-2xl font-extrabold md:text-3xl" style={{ color: gustaBrandColors.primary }}>
        Producători din rețea
      </h1>
      <p className="assoc-body mt-2 max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: '#5a6563' }}>
        Oamenii din spatele produselor comercializate prin magazinul Asociației Gustă din Bucovina
      </p>

      {producers.length === 0 ? (
        <p className="assoc-body mt-10 text-center text-sm" style={{ color: '#5a6563' }}>
          Nu există producători în catalog momentan.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4">
          {producers.map((f) => (
            <li key={f.tenantId}>
              <Link
                href={associationProducerProfilePath(f.tenantId)}
                className={cn(
                  'flex w-full flex-col items-center rounded-2xl border bg-white p-4 text-center shadow-sm transition',
                  'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
                )}
                style={{ borderColor: gustaPrimaryTints[40], boxShadow: gustaBrandShadows.sm }}
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${gustaBrandColors.primary}, ${gustaPrimaryTints[80]})`,
                  }}
                >
                  {initialsFromName(f.farmName)}
                </div>
                <p className="assoc-heading mt-3 line-clamp-2 text-sm font-bold" style={{ color: gustaBrandColors.text }}>
                  {f.farmName}
                </p>
                <p className="assoc-body mt-1 line-clamp-2 text-xs font-medium" style={{ color: gustaPrimaryTints[80] }}>
                  {f.specialty}
                </p>
                <p
                  className="assoc-body mt-2 flex items-center justify-center gap-1 text-[11px]"
                  style={{ color: '#5a6563' }}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: gustaBrandColors.primary }} aria-hidden />
                  {f.location}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Construiește rânduri pentru UI din lista de produse (unic pe tenant). Specialitatea = categorie predominantă. */
export function buildGustProducerCardsFromProducts(products: AssociationProduct[]): GustProducerCard[] {
  const m = new Map<string, { farmName: string; categories: string[]; region: string | null }>()
  for (const p of products) {
    const cur = m.get(p.tenantId)
    if (!cur) {
      m.set(p.tenantId, {
        farmName: p.farmName?.trim() || 'Fermă locală',
        categories: [p.categorie],
        region: p.farmRegion,
      })
    } else {
      cur.categories.push(p.categorie)
      if (!cur.region && p.farmRegion) cur.region = p.farmRegion
    }
  }
  return Array.from(m.entries())
    .map(([tenantId, v]) => {
      const counts = new Map<string, number>()
      for (const c of v.categories) {
        const k = c.trim()
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
      let top = ''
      let topN = -1
      const sortedKeys = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'ro'))
      for (const cat of sortedKeys) {
        const n = counts.get(cat) ?? 0
        if (n > topN) {
          topN = n
          top = cat
        }
      }
      const specialty = top ? labelForCategory(top) : '—'
      const location = v.region?.trim() || 'Suceava'
      return {
        tenantId,
        farmName: v.farmName,
        specialty,
        location,
      }
    })
    .sort((a, b) => a.farmName.localeCompare(b.farmName, 'ro'))
}
