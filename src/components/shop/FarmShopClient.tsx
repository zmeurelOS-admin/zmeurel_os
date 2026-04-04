'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { PublicShopProduct } from '@/lib/shop/load-public-shop'
import { toast } from '@/lib/ui/toast'

const CATEGORIE_LABEL: Record<string, string> = {
  fruct: 'Fructe',
  leguma: 'Legume',
  procesat: 'Procesate',
  altele: 'Altele',
}

function formatPrice(p: PublicShopProduct): string {
  if (p.pret_unitar == null) return '—'
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(p.pret_unitar))
}

function shortDesc(text: string | null, max = 96): string {
  if (!text?.trim()) return ''
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

type CartMap = Record<string, number>

type OrderSuccess = {
  orderIds: string[]
  totalLei: number
  currency: string
}

export function FarmShopClient({
  tenantId,
  farmName,
  products,
}: {
  tenantId: string
  farmName: string
  products: PublicShopProduct[]
}) {
  const [category, setCategory] = useState<string>('all')
  const [detailProduct, setDetailProduct] = useState<PublicShopProduct | null>(null)
  const [qtyDraft, setQtyDraft] = useState('1')
  const [cart, setCart] = useState<CartMap>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccess | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nume, setNume] = useState('')
  const [telefon, setTelefon] = useState('')
  const [locatie, setLocatie] = useState('')
  const [observatii, setObservatii] = useState('')

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.categorie))
    return Array.from(s).sort()
  }, [products])

  const filtered = useMemo(() => {
    if (category === 'all') return products
    return products.filter((p) => p.categorie === category)
  }, [products, category])

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
      .filter(Boolean) as { product: PublicShopProduct; qty: number }[]
  }, [cart, products])

  const estimatedTotal = useMemo(() => {
    return cartLines.reduce((sum, { product: p, qty }) => {
      if (p.pret_unitar == null) return sum
      return sum + Number(p.pret_unitar) * qty
    }, 0)
  }, [cartLines])

  useEffect(() => {
    if (checkoutOpen && cartLines.length === 0 && !orderSuccess) {
      setCheckoutOpen(false)
    }
  }, [checkoutOpen, cartLines.length, orderSuccess])

  const openCheckout = () => {
    setCartOpen(false)
    setOrderSuccess(null)
    setCheckoutOpen(true)
  }

  const closeCheckout = () => {
    setCheckoutOpen(false)
    setOrderSuccess(null)
  }

  const submitOrder = async () => {
    if (cartLines.length === 0) return
    const n = nume.trim()
    const t = telefon.trim()
    const l = locatie.trim()
    if (n.length < 2) {
      toast.error('Introdu numele.')
      return
    }
    if (t.length < 5) {
      toast.error('Introdu un număr de telefon valid.')
      return
    }
    if (l.length < 3) {
      toast.error('Introdu localitatea sau adresa de livrare.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/shop/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          lines: cartLines.map(({ product: p, qty }) => ({ produsId: p.id, qty })),
          nume: n,
          telefon: t,
          locatie: l,
          observatii: observatii.trim() || undefined,
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
      setCart({})
      setNume('')
      setTelefon('')
      setLocatie('')
      setObservatii('')
      setOrderSuccess({
        orderIds: data.orderIds,
        totalLei: Number(data.totalLei ?? 0),
        currency: data.currency ?? 'RON',
      })
    } catch {
      toast.error('Eroare de rețea. Încearcă din nou.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = (p: PublicShopProduct) => {
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

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#f6faf7] via-[#f2f7f4] to-[#e8f0ec] text-[#0f1411] dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      <header className="border-b border-emerald-900/10 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 sm:py-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-400/90">
            Magazin fermier
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50 sm:text-3xl">
            {farmName}
          </h1>
          <p className="max-w-xl text-sm text-emerald-900/65 dark:text-zinc-400">
            Comandă direct de la fermă — produse proaspete, prețuri clare.
          </p>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto max-w-6xl px-4 py-6 sm:py-8',
          cartTotalQty > 0 && 'pb-28',
        )}
      >
        {categories.length > 1 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                category === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                  : 'bg-white/90 text-emerald-900 ring-1 ring-emerald-900/10 hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700',
              )}
            >
              Toate
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition',
                  category === c
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                    : 'bg-white/90 text-emerald-900 ring-1 ring-emerald-900/10 hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700',
                )}
              >
                {CATEGORIE_LABEL[c] ?? c}
              </button>
            ))}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-white/90 px-6 py-12 text-center text-emerald-900/70 ring-1 ring-emerald-900/10 dark:bg-zinc-900/80 dark:text-zinc-400 dark:ring-zinc-800">
            Nu există produse în această categorie.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <li key={p.id}>
                <article
                  className={cn(
                    'group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md shadow-emerald-950/5 ring-1 ring-emerald-900/10 transition',
                    'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-950/10',
                    'dark:bg-zinc-900 dark:ring-zinc-800',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openDetail(p)}
                    className="flex flex-1 flex-col text-left"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-emerald-50/80 dark:bg-zinc-800">
                      {p.poza_1_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- public URLs from Supabase storage; domains vary per project
                        <img
                          src={p.poza_1_url}
                          alt=""
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-5xl opacity-40">
                          🫐
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h2 className="text-base font-bold leading-snug text-emerald-950 dark:text-zinc-50">{p.nume}</h2>
                      {p.descriere ? (
                        <p className="line-clamp-2 text-sm text-emerald-900/65 dark:text-zinc-400">{shortDesc(p.descriere, 120)}</p>
                      ) : null}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div>
                          <p className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                            {formatPrice(p)} <span className="text-sm font-semibold text-emerald-900/60">{p.moneda}</span>
                          </p>
                          <p className="text-xs font-medium text-emerald-900/50">/ {p.unitate_vanzare}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="border-t border-emerald-900/10 p-3 dark:border-zinc-800">
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-sm hover:bg-emerald-700"
                      onClick={() => openDetail(p)}
                    >
                      Comandă
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Detaliu produs */}
      <Dialog open={detailProduct !== null} onOpenChange={(o) => !o && setDetailProduct(null)}>
        <DialogContent className="max-h-[min(92dvh,640px)] gap-0 overflow-y-auto rounded-2xl border-emerald-900/10 p-0 sm:max-w-md">
          {detailProduct ? (
            <>
              <div className="relative aspect-[16/10] w-full bg-emerald-50 dark:bg-zinc-800">
                {detailProduct.poza_1_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- public URLs from Supabase storage; domains vary per project
                  <img
                    src={detailProduct.poza_1_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-6xl opacity-30">🫐</div>
                )}
              </div>
              <div className="space-y-4 p-5">
                <DialogHeader>
                  <DialogTitle className="text-left text-xl font-bold text-emerald-950 dark:text-zinc-50">
                    {detailProduct.nume}
                  </DialogTitle>
                </DialogHeader>
                {detailProduct.descriere ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-emerald-900/80 dark:text-zinc-300">
                    {detailProduct.descriere}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-900 dark:bg-zinc-800 dark:text-zinc-200">
                    {formatPrice(detailProduct)} {detailProduct.moneda} / {detailProduct.unitate_vanzare}
                  </span>
                  {detailProduct.gramaj_per_unitate != null ? (
                    <span className="rounded-lg bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {Number(detailProduct.gramaj_per_unitate)} g / unitate
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shop_qty">Cantitate</Label>
                  <Input
                    id="shop_qty"
                    inputMode="decimal"
                    className="h-12 rounded-xl text-base"
                    value={qtyDraft}
                    onChange={(e) => setQtyDraft(e.target.value)}
                    min="0.01"
                    step="any"
                  />
                </div>
                <Button type="button" className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold" onClick={addFromDetail}>
                  Adaugă în coș
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Coș */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Coșul tău</DialogTitle>
          </DialogHeader>
          {cartLines.length === 0 ? (
            <p className="text-sm text-emerald-900/60">Coșul este gol.</p>
          ) : (
            <ul className="space-y-3">
              {cartLines.map(({ product: p, qty }) => {
                const step = p.unitate_vanzare === 'buc' ? 1 : 0.5
                return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-900/10 px-3 py-2 dark:border-zinc-700"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-emerald-950 dark:text-zinc-100">{p.nume}</p>
                    <p className="text-xs text-emerald-900/55">
                      {formatPrice(p)} {p.moneda}/{p.unitate_vanzare}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-900/15 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      aria-label="Scade"
                      onClick={() => setLineQty(p.id, qty - step)}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[3rem] text-center text-sm font-semibold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-900/15 bg-white dark:border-zinc-600 dark:bg-zinc-800"
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
          )}
          <div className="flex flex-col gap-2 border-t border-emerald-900/10 pt-3 dark:border-zinc-700">
            <p className="text-sm font-semibold text-emerald-950 dark:text-zinc-100">
              Total estimativ:{' '}
              <span className="tabular-nums">
                {new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(estimatedTotal)}{' '}
                RON
              </span>
            </p>
            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold"
              onClick={openCheckout}
            >
              Continuă comanda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <Dialog open={checkoutOpen} onOpenChange={(o) => !o && closeCheckout()}>
        <DialogContent className="flex max-h-[min(96dvh,720px)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          {orderSuccess ? (
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="h-14 w-14 text-emerald-600" aria-hidden />
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-xl font-bold text-emerald-950 dark:text-zinc-50">
                    Comanda a fost trimisă
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-emerald-900/75 dark:text-zinc-400">
                  Fermierul o va vedea în aplicație și te poate contacta pentru confirmare.
                </p>
                <p className="text-xs text-emerald-900/55 dark:text-zinc-500">
                  {orderSuccess.orderIds.length === 1 ? (
                    <>
                      Referință:{' '}
                      <span className="font-mono font-semibold text-emerald-900 dark:text-zinc-300">
                        {orderSuccess.orderIds[0].replace(/-/g, '').slice(0, 12)}
                      </span>
                    </>
                  ) : (
                    <>
                      Au fost înregistrate {orderSuccess.orderIds.length} linii de comandă (câte una per produs).
                    </>
                  )}
                </p>
                <p className="text-sm font-semibold text-emerald-950 dark:text-zinc-100">
                  Total estimativ:{' '}
                  {new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(orderSuccess.totalLei)}{' '}
                  {orderSuccess.currency}
                </p>
              </div>
              <Button type="button" className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold" onClick={closeCheckout}>
                Închide
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader className="border-b border-emerald-900/10 px-5 pb-4 pt-5 dark:border-zinc-700 sm:px-6">
                <DialogTitle className="text-left text-lg font-bold text-emerald-950 dark:text-zinc-50">
                  Date de livrare
                </DialogTitle>
                <p className="text-left text-sm text-emerald-900/65 dark:text-zinc-400">
                  Completează datele tale — nu este nevoie de cont.
                </p>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <div className="mb-6 rounded-xl bg-emerald-50/80 p-3 dark:bg-zinc-800/80">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-400/90">
                    Rezumat
                  </p>
                  <ul className="space-y-2 text-sm">
                    {cartLines.map(({ product: p, qty }) => {
                      const sub =
                        p.pret_unitar != null ? Number(p.pret_unitar) * qty : null
                      return (
                        <li key={p.id} className="flex justify-between gap-2 border-b border-emerald-900/10 pb-2 last:border-0 dark:border-zinc-600">
                          <span className="min-w-0 text-emerald-950 dark:text-zinc-100">
                            {p.nume}{' '}
                            <span className="text-emerald-900/60">
                              × {qty} {p.unitate_vanzare}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums font-medium">
                            {sub != null
                              ? `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(sub)} ${p.moneda}`
                              : '—'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-3 text-base font-bold text-emerald-950 dark:text-zinc-50">
                    Total estimativ:{' '}
                    <span className="tabular-nums">
                      {new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(estimatedTotal)} RON
                    </span>
                  </p>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitOrder()
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="shop_nume">Nume</Label>
                    <Input
                      id="shop_nume"
                      className="h-12 rounded-xl text-base"
                      value={nume}
                      onChange={(e) => setNume(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop_tel">Telefon</Label>
                    <Input
                      id="shop_tel"
                      type="tel"
                      className="h-12 rounded-xl text-base"
                      value={telefon}
                      onChange={(e) => setTelefon(e.target.value)}
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop_loc">Localitate / adresă livrare</Label>
                    <Textarea
                      id="shop_loc"
                      className="min-h-[88px] rounded-xl text-base"
                      value={locatie}
                      onChange={(e) => setLocatie(e.target.value)}
                      placeholder="Ex.: București, sector 3, str. …"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop_obs">Observații (opțional)</Label>
                    <Textarea
                      id="shop_obs"
                      className="min-h-[80px] rounded-xl text-base"
                      value={observatii}
                      onChange={(e) => setObservatii(e.target.value)}
                      placeholder="Orice detaliu despre livrare sau produs"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting || cartLines.length === 0}
                    className="h-12 min-h-[48px] w-full rounded-xl bg-emerald-600 text-base font-semibold"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                        Se trimite…
                      </>
                    ) : (
                      'Trimite comanda'
                    )}
                  </Button>
                </form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bară coș */}
      {cartTotalQty > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-900/15 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,40,25,0.12)] backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingBag className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-950 dark:text-zinc-50">Coș activ</p>
                <p className="truncate text-xs text-emerald-900/60">
                  {cartLines.length} {cartLines.length === 1 ? 'linie' : 'linii'} · cantitate totală{' '}
                  {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(cartTotalQty)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" className="rounded-xl border-emerald-600/40 px-3 font-semibold" onClick={openCheckout}>
                Comandă
              </Button>
              <Button type="button" className="rounded-xl bg-emerald-600 px-4 font-semibold" onClick={() => setCartOpen(true)}>
                Coș
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
