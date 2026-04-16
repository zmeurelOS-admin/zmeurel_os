'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useAssociationShop } from '@/components/shop/association/association-shop-context'
import { GustCatalogPage } from '@/components/shop/association/catalog/GustCatalogPage'
import { gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'

export function AssociationCatalogPageClient() {
  const {
    products,
    categoryDefinitions,
    searchQuery,
    addQuickToCart,
    openProductDetail,
    gustCatalogCartLines,
  } =
    useAssociationShop()
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const openedProdusRef = useRef<string | null>(null)

  const categorie = sp.get('categorie')?.trim() || null
  const fermier = sp.get('fermier')?.trim() || null
  const produsId = sp.get('produs')?.trim() || null

  const shopProducts = useMemo(() => {
    if (!fermier) return products
    return products.filter((p) => p.tenantId === fermier)
  }, [products, fermier])

  const farmerFilter = useMemo(() => {
    if (!fermier) return null
    const row = products.find((p) => p.tenantId === fermier)
    const farmName = row?.farmName ?? 'Fermă'
    return {
      farmName,
      onClear: () => {
        const p = new URLSearchParams(sp.toString())
        p.delete('fermier')
        const qs = p.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
      },
    }
  }, [fermier, products, router, sp, pathname])

  const onCategoryChange = useCallback(
    (cat: string | null) => {
      const p = new URLSearchParams(sp.toString())
      if (cat == null || !String(cat).trim()) p.delete('categorie')
      else p.set('categorie', cat)
      const qs = p.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, sp, pathname],
  )

  useEffect(() => {
    if (!produsId) {
      openedProdusRef.current = null
      return
    }
    if (products.length === 0) return
    if (openedProdusRef.current === produsId) return
    const found = products.find((x) => x.id === produsId)
    if (found) {
      openProductDetail(found)
      openedProdusRef.current = produsId
    }
  }, [produsId, products, openProductDetail])

  if (products.length === 0) {
    return (
      <div className="px-4 py-12 md:px-6">
        <p
          className="mx-auto max-w-2xl rounded-2xl border px-6 py-16 text-center text-sm"
          style={{ borderColor: gustaPrimaryTints[40], backgroundColor: '#fff' }}
        >
          Momentan nu sunt produse disponibile în magazinul asociației. Revino curând.
        </p>
      </div>
    )
  }

  return (
    <GustCatalogPage
      products={shopProducts}
      categoryDefinitions={categoryDefinitions}
      selectedCategory={categorie}
      onCategoryChange={onCategoryChange}
      searchQuery={searchQuery}
      onAddToCart={addQuickToCart}
      onOpenDetail={openProductDetail}
      cart={gustCatalogCartLines}
      farmerFilter={farmerFilter}
    />
  )
}
