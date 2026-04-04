'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, ShoppingBag } from 'lucide-react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { sanitizeAssociationSettings } from '@/lib/association/public-settings'
import type { GustCheckoutSuccess } from '@/components/shop/association/cart/gustCartTypes'
import type { AssociationProduct } from '@/lib/shop/load-association-catalog'
import {
  formatDeliveryDateFromIso,
  getDeliveryFee,
  getNextDeliveryDateIso,
} from '@/lib/shop/association/delivery'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/ui/toast'

import { AssociationProductDetailContent } from './association/AssociationProductDetailContent'
import { MarketAbout } from './association/marketplace/MarketAbout'
import type { FieldErrorKey } from './association/marketplace/MarketCheckoutPanel'
import { MarketCheckoutPanel } from './association/marketplace/MarketCheckoutPanel'
import { MarketFilterRail } from './association/marketplace/MarketFilterRail'
import { MarketHeader } from './association/marketplace/MarketHeader'
import { MarketHero } from './association/marketplace/MarketHero'
import { MarketHowItWorks } from './association/marketplace/MarketHowItWorks'
import { MarketProductCard } from './association/marketplace/MarketProductCard'
import { MarketSuccessOverlay } from './association/marketplace/MarketSuccessOverlay'
import { M } from './association/marketplace/marketTokens'
import type { SortKey } from './association/tokens'

type CartMap = Record<string, number>

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

function formatPrice(p: AssociationProduct): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(p.displayPrice))
}

const sheetAssoc =
  '!border-[#E8E0C4] !bg-[#FFF9E3] !text-[#3D4543] p-0 gap-0 [&_[data-radix-dialog-close]]:text-[#3D4543]'

export function AssociationShopClient({ products }: { products: AssociationProduct[] }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const productsSectionRef = useRef<HTMLElement>(null)
  const defaultPublicSettings = useMemo(() => sanitizeAssociationSettings({}), [])

  const [category, setCategory] = useState<string>('all')
  const [farmer, setFarmer] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [detailProduct, setDetailProduct] = useState<AssociationProduct | null>(null)
  const [qtyDraft, setQtyDraft] = useState('1')
  const [cart, setCart] = useState<CartMap>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState<GustCheckoutSuccess | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nume, setNume] = useState('')
  const [telefon, setTelefon] = useState('')
  const [locatie, setLocatie] = useState('')
  const [observatii, setObservatii] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, boolean>>>({})

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.categorie))
    return Array.from(s).sort()
  }, [products])

  const farmers = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of products) {
      if (!m.has(p.tenantId)) m.set(p.tenantId, p.farmName)
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category !== 'all' && p.categorie !== category) return false
      if (farmer !== 'all' && p.tenantId !== farmer) return false
      return true
    })
  }, [products, category, farmer])

  const filteredSorted = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'name') {
      arr.sort((a, b) => a.nume.localeCompare(b.nume, 'ro'))
    } else if (sort === 'price-asc') {
      arr.sort((a, b) => Number(a.displayPrice) - Number(b.displayPrice))
    } else {
      arr.sort((a, b) => Number(b.displayPrice) - Number(a.displayPrice))
    }
    return arr
  }, [filtered, sort])

  const cartTotalQty = useMemo(
    () => Object.values(cart).reduce((a, b) => a + b, 0),
    [cart],
  )

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find((x) => x.id === id)
        return p ? { product: p, qty } : null
      })
      .filter(Boolean) as { product: AssociationProduct; qty: number }[]
  }, [cart, products])

  const cartLineCount = cartLines.length

  const cartGroupedByFarm = useMemo(() => {
    const map = new Map<
      string,
      { tenantId: string; farmName: string; lines: { product: AssociationProduct; qty: number }[] }
    >()
    for (const line of cartLines) {
      const tid = line.product.tenantId
      if (!map.has(tid)) {
        map.set(tid, { tenantId: tid, farmName: line.product.farmName, lines: [] })
      }
      map.get(tid)!.lines.push(line)
    }
    return Array.from(map.values()).sort((a, b) => a.farmName.localeCompare(b.farmName, 'ro'))
  }, [cartLines])

  const estimatedTotal = useMemo(() => {
    return cartLines.reduce((sum, { product: p, qty }) => sum + Number(p.displayPrice) * qty, 0)
  }, [cartLines])

  const scrollToProducts = () => {
    productsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const backToShop = () => {
    setCheckoutOpen(false)
    setOrderSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (checkoutOpen && cartLines.length === 0 && !orderSuccess) {
      setCheckoutOpen(false)
    }
  }, [checkoutOpen, cartLines.length, orderSuccess])

  const openCheckout = () => {
    setCartOpen(false)
    setOrderSuccess(null)
    setFieldErrors({})
    setCheckoutOpen(true)
  }

  const closeCheckout = () => {
    setCheckoutOpen(false)
    setOrderSuccess(null)
    setFieldErrors({})
  }

  const clearFieldError = (key: FieldErrorKey) => {
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const submitOrder = async () => {
    if (cartLines.length === 0) return
    const n = nume.trim()
    const t = telefon.trim()
    const l = locatie.trim()

    const nextErr: Partial<Record<FieldErrorKey, boolean>> = {}
    if (n.length < 2) nextErr.nume = true
    if (t.length < 5) nextErr.telefon = true
    if (l.length < 3) nextErr.locatie = true
    if (Object.keys(nextErr).length > 0) {
      setFieldErrors(nextErr)
      toast.error('Completează câmpurile marcate.')
      return
    }
    setFieldErrors({})

    const groups = new Map<string, { produsId: string; qty: number }[]>()
    for (const { product: p, qty } of cartLines) {
      const arr = groups.get(p.tenantId) ?? []
      arr.push({ produsId: p.id, qty })
      groups.set(p.tenantId, arr)
    }

    const linesSnapshot = [...cartLines]

    setSubmitting(true)
    try {
      let allIds: string[] = []
      let totalLei = 0
      let currency = 'RON'

      for (const [tenantId, lines] of groups) {
        const res = await fetch('/api/shop/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'association_shop',
            tenantId,
            lines,
            nume: n,
            telefon: t,
            locatie: l,
            observatii: observatii.trim() || undefined,
            whatsappConsent: true,
          }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          orderIds?: string[]
          totalLei?: number
          currency?: string
        }
        if (!res.ok || !data.ok || !data.orderIds?.length) {
          toast.error(typeof data.error === 'string' ? data.error : 'Nu am putut trimite comanda.')
          return
        }
        allIds = allIds.concat(data.orderIds)
        totalLei += Number(data.totalLei ?? 0)
        currency = data.currency ?? currency
      }

      const placedAt = new Date()
      const deliveryDateIso = getNextDeliveryDateIso()
      const deliveryDateLabel = formatDeliveryDateFromIso(deliveryDateIso)
      const fee = getDeliveryFee(totalLei)
      const summaryLines = linesSnapshot.map(({ product: p, qty }) => ({
        productName: p.nume,
        farmName: p.farmName,
        qty,
        unit: p.unitate_vanzare,
        unitPrice: Number(p.displayPrice ?? 0),
        lineTotal: round2(Number(p.displayPrice ?? 0) * qty),
        currency: p.moneda || 'RON',
      }))

      setCart({})
      setNume('')
      setTelefon('')
      setLocatie('')
      setObservatii('')
      setCheckoutOpen(false)
      setOrderSuccess({
        orderIds: allIds,
        totalLei,
        currency,
        farmCount: groups.size,
        deliveryFeeLei: fee,
        grandTotalLei: round2(totalLei + fee),
        deliveryDateLabel,
        placedAtIso: placedAt.toISOString(),
        placedAtLabel: placedAt.toLocaleString('ro-RO', {
          timeZone: 'Europe/Bucharest',
          dateStyle: 'long',
          timeStyle: 'short',
        }),
        clientName: n,
        clientTelefon: t,
        clientLocatie: l,
        whatsappConsent: true,
        summaryLines,
      })
    } catch {
      toast.error('Eroare de rețea. Încearcă din nou.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = (p: AssociationProduct) => {
    setDetailProduct(p)
    setQtyDraft(String(cart[p.id] ?? 1))
  }

  const addFromDetail = () => {
    if (!detailProduct) return
    const q = Math.max(0.01, Number(String(qtyDraft).replace(',', '.')) || 0)
    setCart((prev) => ({
      ...prev,
      [detailProduct.id]: (prev[detailProduct.id] ?? 0) + q,
    }))
    setDetailProduct(null)
  }

  const addQuick = (p: AssociationProduct) => {
    const step = p.unitate_vanzare === 'buc' ? 1 : 0.5
    setCart((prev) => ({
      ...prev,
      [p.id]: (prev[p.id] ?? 0) + step,
    }))
  }

  const setLineQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    setCart((prev) => ({ ...prev, [id]: qty }))
  }

  const showCategoryFilter = categories.length > 1
  const showFarmerFilter = farmers.length > 1

  const detailOpen = detailProduct !== null

  const detailBody =
    detailProduct != null ? (
      <AssociationProductDetailContent
        product={detailProduct}
        formatPrice={formatPrice}
        qtyDraft={qtyDraft}
        onQtyChange={setQtyDraft}
        onAddToCart={addFromDetail}
      />
    ) : null

  if (orderSuccess) {
    return (
      <MarketSuccessOverlay
        success={orderSuccess}
        publicSettings={defaultPublicSettings}
        onBackToShop={backToShop}
      />
    )
  }

  return (
    <div
      className="min-h-[100dvh]"
      style={{ backgroundColor: M.cream, color: M.text }}
      data-association-shop-ui="marketplace-v1"
    >
      <MarketHeader cartLineCount={cartLineCount} onOpenCart={() => setCartOpen(true)} />

      <MarketHero onCta={scrollToProducts} />

      <section
        ref={productsSectionRef}
        id="catalog"
        className="scroll-mt-[calc(56px+env(safe-area-inset-top,0px))] sm:scroll-mt-[calc(60px+env(safe-area-inset-top,0px))]"
      >
        {products.length === 0 ? (
          <div className="px-4 py-12 md:px-6 lg:px-8">
            <p
              className="mx-auto max-w-2xl rounded-2xl border px-6 py-16 text-center text-sm sm:text-base"
              style={{ borderColor: M.border, backgroundColor: '#fff' }}
            >
              Momentan nu sunt produse disponibile în magazinul asociației. Revino curând.
            </p>
          </div>
        ) : (
          <>
            <MarketFilterRail
              categories={categories}
              farmers={farmers}
              category={category}
              farmer={farmer}
              sort={sort}
              showCategory={showCategoryFilter}
              showFarmer={showFarmerFilter}
              catalogProductCount={products.length}
              filteredProductCount={filteredSorted.length}
              onCategory={setCategory}
              onFarmer={setFarmer}
              onSort={setSort}
            />

            <div
              className={cn(
                'px-4 pb-14 pt-8 md:px-6 lg:px-8 max-w-7xl mx-auto',
                cartTotalQty > 0 && 'pb-28 md:pb-14',
              )}
            >
              {filteredSorted.length === 0 ? (
                <p
                  className="rounded-2xl border px-6 py-12 text-center"
                  style={{ borderColor: M.border, backgroundColor: '#fff' }}
                >
                  Nu există produse pentru filtrele alese.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredSorted.map((p) => (
                    <li key={p.id}>
                      <MarketProductCard
                        product={p}
                        formatPrice={formatPrice}
                        onOpenDetail={() => openDetail(p)}
                        onAddQuick={() => addQuick(p)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <MarketHowItWorks />
      <MarketAbout />

      {/* Detalii produs: dialog desktop / sheet mobil */}
      {isDesktop ? (
        <Dialog open={detailOpen} onOpenChange={(o) => !o && setDetailProduct(null)}>
          <DialogContent
            className={cn(
              'max-h-[min(92vh,720px)] gap-0 overflow-hidden rounded-2xl border p-0 sm:max-w-lg',
              sheetAssoc,
            )}
          >
            <DialogTitle className="sr-only">
              {detailProduct ? `Produs: ${detailProduct.nume}` : 'Detalii produs'}
            </DialogTitle>
            {detailBody}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={detailOpen} onOpenChange={(o) => !o && setDetailProduct(null)}>
          <SheetContent side="bottom" className={cn('max-h-[92dvh] rounded-t-2xl', sheetAssoc)}>
            {detailBody}
          </SheetContent>
        </Sheet>
      )}

      {/* Coș: drawer dreapta desktop / sheet jos mobil */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side={isDesktop ? 'right' : 'bottom'}
          className={cn(
            'flex max-h-[90dvh] flex-col sm:!max-w-md',
            sheetAssoc,
            isDesktop && '!w-full',
          )}
        >
          <SheetHeader className="border-b px-5 pb-4 pt-2" style={{ borderColor: M.border }}>
            <SheetTitle className="assoc-heading text-left text-xl font-extrabold" style={{ color: M.green }}>
              Coșul tău
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {cartLines.length === 0 ? (
              <p className="assoc-body text-sm" style={{ color: M.muted }}>
                Coșul este gol. Adaugă produse din catalog.
              </p>
            ) : (
              <div className="space-y-6">
                {cartGroupedByFarm.map((group) => (
                  <div key={group.tenantId}>
                    <p
                      className="assoc-heading mb-2 text-xs font-bold uppercase tracking-wide"
                      style={{ color: M.green }}
                    >
                      {group.farmName}
                    </p>
                    <ul className="space-y-2 border-l-2 pl-3" style={{ borderColor: `${M.green}33` }}>
                      {group.lines.map(({ product: p, qty }) => {
                        const step = p.unitate_vanzare === 'buc' ? 1 : 0.5
                        return (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm"
                            style={{ borderColor: M.border }}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold" style={{ color: M.text }}>
                                {p.nume}
                              </p>
                              <p className="text-xs" style={{ color: M.muted }}>
                                {formatPrice(p)} {p.moneda}/{p.unitate_vanzare}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white"
                                style={{ borderColor: M.border }}
                                aria-label="Scade"
                                onClick={() => setLineQty(p.id, qty - step)}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="min-w-[3rem] text-center text-sm font-bold tabular-nums">{qty}</span>
                              <button
                                type="button"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white"
                                style={{ borderColor: M.border }}
                                aria-label="Adaugă"
                                onClick={() => setLineQty(p.id, qty + step)}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t px-5 py-4" style={{ borderColor: M.border, backgroundColor: M.creamMid }}>
            <p className="text-sm font-bold" style={{ color: M.text }}>
              Subtotal:{' '}
              <span className="tabular-nums">
                {new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
                  estimatedTotal,
                )}{' '}
                RON
              </span>
            </p>
            <p className="mt-1 text-xs" style={{ color: M.muted }}>
              Total estimativ; fermierul confirmă prețul final la livrare.
            </p>
            <button
              type="button"
              className="assoc-body mt-4 min-h-[48px] w-full rounded-full text-base font-bold text-[#3D4543] shadow-md transition hover:brightness-95"
              style={{ backgroundColor: M.orange, boxShadow: '0 4px 16px rgba(255, 158, 27, 0.35)' }}
              onClick={openCheckout}
            >
              Continuă la checkout
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Checkout */}
      {isDesktop ? (
        <Dialog open={checkoutOpen} onOpenChange={(o) => !o && closeCheckout()}>
          <DialogContent
            className={cn(
              'flex max-h-[min(96vh,760px)] flex-col overflow-hidden rounded-2xl border p-0 sm:max-w-lg',
              sheetAssoc,
            )}
          >
            <DialogTitle className="sr-only">Date de livrare și checkout</DialogTitle>
            <MarketCheckoutPanel
              cartGroupedByFarm={cartGroupedByFarm}
              estimatedTotal={estimatedTotal}
              nume={nume}
              setNume={(v) => {
                setNume(v)
                clearFieldError('nume')
              }}
              telefon={telefon}
              setTelefon={(v) => {
                setTelefon(v)
                clearFieldError('telefon')
              }}
              locatie={locatie}
              setLocatie={(v) => {
                setLocatie(v)
                clearFieldError('locatie')
              }}
              observatii={observatii}
              setObservatii={setObservatii}
              submitting={submitting}
              onSubmit={() => void submitOrder()}
              onClose={closeCheckout}
              fieldErrors={fieldErrors}
            />
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={checkoutOpen} onOpenChange={(o) => !o && closeCheckout()}>
          <SheetContent
            side="bottom"
            className={cn('flex max-h-[96dvh] flex-col overflow-hidden rounded-t-2xl', sheetAssoc)}
          >
            <MarketCheckoutPanel
              cartGroupedByFarm={cartGroupedByFarm}
              estimatedTotal={estimatedTotal}
              nume={nume}
              setNume={(v) => {
                setNume(v)
                clearFieldError('nume')
              }}
              telefon={telefon}
              setTelefon={(v) => {
                setTelefon(v)
                clearFieldError('telefon')
              }}
              locatie={locatie}
              setLocatie={(v) => {
                setLocatie(v)
                clearFieldError('locatie')
              }}
              observatii={observatii}
              setObservatii={setObservatii}
              submitting={submitting}
              onSubmit={() => void submitOrder()}
              onClose={closeCheckout}
              fieldErrors={fieldErrors}
            />
          </SheetContent>
        </Sheet>
      )}

      {cartTotalQty > 0 ? (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t p-3 md:hidden"
          style={{
            borderColor: M.border,
            background: 'rgba(255, 249, 227, 0.97)',
            boxShadow: '0 -6px 24px rgba(61, 69, 67, 0.08)',
          }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-1">
            <div className="flex min-w-0 items-center gap-2">
              <ShoppingBag className="h-6 w-6 shrink-0" style={{ color: M.green }} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: M.text }}>
                  În coș
                </p>
                <p className="truncate text-xs" style={{ color: M.muted }}>
                  {cartLineCount} {cartLineCount === 1 ? 'produs' : 'produse'} ·{' '}
                  {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(cartTotalQty)} cantitate
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="assoc-body min-h-[48px] rounded-full border-2 px-3 text-sm font-bold"
                style={{ borderColor: M.green, color: M.green }}
                onClick={openCheckout}
              >
                Comandă
              </button>
              <button
                type="button"
                className="assoc-body min-h-[48px] rounded-full px-4 text-sm font-bold text-[#3D4543] shadow-md"
                style={{ backgroundColor: M.orange }}
                onClick={() => setCartOpen(true)}
              >
                Coș
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
