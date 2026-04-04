import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { labelForCategory, type SortKey } from '../tokens'

import { M, PX } from './marketTokens'

type Farmer = { id: string; name: string }

type Props = {
  categories: string[]
  farmers: Farmer[]
  category: string
  farmer: string
  sort: SortKey
  showCategory: boolean
  showFarmer: boolean
  catalogProductCount: number
  filteredProductCount: number
  onCategory: (v: string) => void
  onFarmer: (v: string) => void
  onSort: (v: SortKey) => void
}

/**
 * Bară filtre sticky sub header — scroll orizontal pe mobil, pills marketplace.
 */
export function MarketFilterRail({
  categories,
  farmers,
  category,
  farmer,
  sort,
  showCategory,
  showFarmer,
  catalogProductCount,
  filteredProductCount,
  onCategory,
  onFarmer,
  onSort,
}: Props) {
  const hasFilters = showCategory || showFarmer

  return (
    <div
      className="sticky z-50 border-b backdrop-blur-md top-[calc(56px+env(safe-area-inset-top,0px))] sm:top-[calc(60px+env(safe-area-inset-top,0px))]"
      style={{
        backgroundColor: 'rgba(255, 249, 227, 0.92)',
        borderColor: M.border,
        boxShadow: '0 4px 20px rgba(61,69,67,0.06)',
      }}
    >
      <div className={cn('py-3 sm:py-4', PX)}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 shrink-0" style={{ color: M.green }} />
            <span className="assoc-heading text-sm font-bold sm:text-base" style={{ color: M.green }}>
              Catalog
            </span>
            {catalogProductCount > 0 ? (
              <span className="assoc-body text-xs font-medium sm:text-sm" style={{ color: M.muted }}>
                {filteredProductCount}
                {filteredProductCount !== catalogProductCount ? ` / ${catalogProductCount}` : ''} produse
              </span>
            ) : null}
          </div>
          <label className="assoc-body flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: M.muted }}>
              Sortare
            </span>
            <select
              value={sort}
              onChange={(e) => onSort(e.target.value as SortKey)}
              className="h-9 rounded-full border px-3 text-xs font-semibold sm:text-sm"
              style={{ borderColor: M.border, backgroundColor: '#fff', color: M.text }}
            >
              <option value="name">Nume A–Z</option>
              <option value="price-asc">Preț ↑</option>
              <option value="price-desc">Preț ↓</option>
            </select>
          </label>
        </div>

        {hasFilters ? (
          <div className="assoc-scroll-x -mx-1 flex gap-2 overflow-x-auto pb-1 pt-1">
            {showCategory ? (
              <>
                <FilterPill active={category === 'all'} onClick={() => onCategory('all')} tone="green">
                  Toate categoriile
                </FilterPill>
                {categories.map((c) => (
                  <FilterPill key={c} active={category === c} onClick={() => onCategory(c)} tone="green">
                    {labelForCategory(c)}
                  </FilterPill>
                ))}
              </>
            ) : null}
            {showFarmer ? (
              <>
                <span className="mx-1 hidden w-px self-stretch bg-[#E8E0C4] sm:block" aria-hidden />
                <FilterPill active={farmer === 'all'} onClick={() => onFarmer('all')} tone="orange">
                  Toți fermierii
                </FilterPill>
                {farmers.map((f) => (
                  <FilterPill
                    key={f.id}
                    active={farmer === f.id}
                    onClick={() => onFarmer(f.id)}
                    tone="orange"
                    title={f.name}
                  >
                    <span className="max-w-[160px] truncate sm:max-w-[220px]">{f.name}</span>
                  </FilterPill>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FilterPill({
  children,
  active,
  onClick,
  tone,
  title,
}: {
  children: ReactNode
  active: boolean
  onClick: () => void
  tone: 'green' | 'orange'
  title?: string
}) {
  const on = tone === 'green' ? M.green : M.orange
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="assoc-body shrink-0 rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm"
      style={
        active
          ? { backgroundColor: on, color: '#fff' }
          : {
              backgroundColor: '#fff',
              color: M.text,
              boxShadow: `inset 0 0 0 1px ${M.border}`,
            }
      }
    >
      {children}
    </button>
  )
}
