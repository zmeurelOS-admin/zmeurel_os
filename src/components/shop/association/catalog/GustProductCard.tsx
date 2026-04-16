'use client'

import { memo, useCallback, type MouseEvent } from 'react'
import Image from 'next/image'
import { Plus } from 'lucide-react'

import { gustaBrandColors } from '@/lib/shop/association/brand-tokens'
import { cn } from '@/lib/utils'

import { getGustCategoryVisual } from './gustCategoryVisual'
import {
  collectProductImageUrls,
  formatGustPrice,
  formatGustProductUnitLabel,
  type GustCatalogProduct,
} from './gustProductTypes'
import { resolveAssociationCategory } from '@/components/shop/association/tokens'

export type GustProductCardProps = {
  product: GustCatalogProduct
  farmName: string
  onOpenDetail: (productId: string) => void
  onAddToCart: (productId: string) => void
  /** Badge colț stânga-sus (ex. categorie promoțională). */
  badge?: string
}

function GustProductCardInner({
  product: p,
  farmName,
  onOpenDetail,
  onAddToCart,
  badge,
}: GustProductCardProps) {
  const urls = collectProductImageUrls(p)
  const firstUrl = urls[0]
  const categoryKey = resolveAssociationCategory(p.association_category, p.categorie)
  const { bg, emoji } = getGustCategoryVisual(categoryKey)
  const badgeText = badge ?? null

  const open = useCallback(() => onOpenDetail(p.id), [onOpenDetail, p.id])
  const add = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      onAddToCart(p.id)
    },
    [onAddToCart, p.id],
  )

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      aria-label={`Deschide detalii: ${p.nume}`}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(13,99,66,0.14)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      )}
      style={
        {
          borderColor: '#e8e4db',
          ['--tw-outline-color' as string]: gustaBrandColors.primary,
        } as React.CSSProperties
      }
    >
      <div className="relative h-[140px] w-full shrink-0 overflow-hidden">
        {firstUrl ? (
          <Image
            src={firstUrl}
            alt={p.nume}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[48px] leading-none"
            style={{ backgroundColor: bg }}
            aria-hidden
          >
            {emoji}
          </div>
        )}
        {badgeText ? (
          <span
            className="absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: gustaBrandColors.accent }}
          >
            {badgeText}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-3.5 py-3">
        <h3
          className="line-clamp-2 text-sm font-bold leading-snug"
          style={{ color: gustaBrandColors.text }}
        >
          {p.nume}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs" style={{ color: '#5a6563' }}>
          {farmName}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-bold tabular-nums leading-none" style={{ color: gustaBrandColors.primary }}>
              {formatGustPrice(p)}{' '}
              <span className="text-xs font-semibold opacity-90">{p.moneda}</span>
            </p>
            <p className="mt-0.5 text-[11px] font-medium opacity-80" style={{ color: '#5a6563' }}>
              {formatGustProductUnitLabel(p)}
            </p>
          </div>
          <button
            type="button"
            onClick={add}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white transition-all duration-200 ease-out',
              'hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]',
            )}
            style={
              {
                backgroundColor: gustaBrandColors.primary,
                ['--tw-outline-color' as string]: gustaBrandColors.primary,
              } as React.CSSProperties
            }
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = gustaBrandColors.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = gustaBrandColors.primary
            }}
            aria-label={`Adaugă ${p.nume} în coș`}
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}

function propsEqual(a: GustProductCardProps, b: GustProductCardProps): boolean {
  return (
    a.product === b.product &&
    a.farmName === b.farmName &&
    a.badge === b.badge &&
    a.onOpenDetail === b.onOpenDetail &&
    a.onAddToCart === b.onAddToCart
  )
}

export const GustProductCard = memo(GustProductCardInner, propsEqual)
