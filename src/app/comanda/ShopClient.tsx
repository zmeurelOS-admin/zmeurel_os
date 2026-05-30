'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import styles from './comanda.module.css'

const WA_NUMBER = '40752953048'
const WA_BASE = `https://wa.me/${WA_NUMBER}`

const B2B_WA_MESSAGE =
  'Bună! Reprezentăm [numele afacerii] și suntem interesați să achiziționăm fructe proaspete de la Zmeurel pentru clienții noștri. Puteți să ne trimiteți o ofertă B2B?'
const B2B_WA_HREF = `${WA_BASE}?text=${encodeURIComponent(B2B_WA_MESSAGE)}`

export type ComandaShopProduct = {
  id: string
  name: string
  description: string | null
  unit_label: string
  price_lei: number | null
  available: boolean
  sort_order: number
}

type CartLine = {
  product: ComandaShopProduct
  qty: number
}

type DeliveryMode = 'livrare' | 'ridicare'

type NotifyState = {
  open: boolean
  name: string
  phone: string
  loading: boolean
  done: boolean
  error: string | null
}

function productImageSrc(id: string): string | null {
  switch (id) {
    case 'afine-300':
    case 'afine-500':
      return '/shop/shop-afine.jpg'
    case 'zmeura':
      return '/shop/shop-zmeura.jpg'
    case 'mure':
      return '/shop/shop-mure.jpg'
    default:
      return null
  }
}

function formatLei(value: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

function buildNotifyWaUrl(productId: string, name: string, phone: string): string | null {
  let message: string | null = null
  if (productId === 'zmeura') {
    message = `Bună! Vreau să fiu anunțat(ă) când aveți Zmeură disponibilă.\nNumele meu: ${name}\nTelefon: ${phone}`
  } else if (productId === 'mure') {
    message = `Bună! Vreau să fiu anunțat(ă) când aveți Mure disponibile.\nNumele meu: ${name}\nTelefon: ${phone}`
  }
  if (!message) return null
  return `${WA_BASE}?text=${encodeURIComponent(message)}`
}

function buildWaMessage(input: {
  lines: CartLine[]
  total: number
  name: string
  phone: string
  deliveryMode: DeliveryMode
  address: string
  notes: string
}) {
  const productLines = input.lines
    .map((line) => {
      const unit = line.product.price_lei ?? 0
      const sub = unit * line.qty
      return `• ${line.product.unit_label} × ${line.qty} = ${formatLei(sub)} lei`
    })
    .join('\n')

  const deliveryLine =
    input.deliveryMode === 'livrare'
      ? `Livrare la: ${input.address.trim()}`
      : 'Ridicare de la fermă'

  const notesBlock = input.notes.trim() ? `\nObservații: ${input.notes.trim()}` : ''

  return `Comandă nouă — Zmeurel 🍓

${productLines}
TOTAL: ${formatLei(input.total)} lei

Nume: ${input.name.trim()}
Telefon: ${input.phone.trim()}
${deliveryLine}${notesBlock}`
}

function ZmeurelLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/icons/icon.svg"
        alt="Zmeurel"
        width={36}
        height={36}
        unoptimized
        className="shrink-0 rounded-[10px]"
      />
      <span className={`text-[22px] font-semibold tracking-tight text-[#F16B6B] ${styles.fontDisplay}`}>
        Zmeurel
      </span>
    </div>
  )
}

function TrustPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F3DAD4] bg-white px-3 py-2 text-xs font-medium text-[#312E3F]">
      <span className="text-[#0D9B5C]" aria-hidden>
        ✓
      </span>
      {children}
    </span>
  )
}

export function ShopClient({
  products,
  loadError,
}: {
  products: ComandaShopProduct[]
  loadError: string | null
}) {
  const available = useMemo(() => products.filter((p) => p.available), [products])
  const comingSoon = useMemo(() => products.filter((p) => !p.available), [products])

  const [qtyById, setQtyById] = useState<Record<string, number>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('livrare')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [orderSuccess, setOrderSuccess] = useState(false)

  const [notifyById, setNotifyById] = useState<Record<string, NotifyState>>({})
  const [cartToastVisible, setCartToastVisible] = useState(false)
  const cartToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showCartAddedToast = useCallback(() => {
    if (cartToastTimerRef.current) {
      clearTimeout(cartToastTimerRef.current)
    }
    setCartToastVisible(true)
    cartToastTimerRef.current = setTimeout(() => {
      setCartToastVisible(false)
      cartToastTimerRef.current = null
    }, 1300)
  }, [])

  useEffect(() => {
    return () => {
      if (cartToastTimerRef.current) {
        clearTimeout(cartToastTimerRef.current)
      }
    }
  }, [])

  const cartLines = useMemo((): CartLine[] => {
    return available
      .filter((p) => (qtyById[p.id] ?? 0) > 0)
      .map((p) => ({ product: p, qty: qtyById[p.id] ?? 0 }))
  }, [available, qtyById])

  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines])
  const cartTotal = useMemo(
    () => cartLines.reduce((s, l) => s + (l.product.price_lei ?? 0) * l.qty, 0),
    [cartLines],
  )

  const setQty = useCallback((id: string, next: number) => {
    setQtyById((prev) => {
      const value = Math.max(0, Math.min(99, next))
      if (value === 0) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: value }
    })
  }, [])

  const scrollToProducts = () => {
    document.getElementById('produse')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openNotify = (productId: string) => {
    setNotifyById((prev) => ({
      ...prev,
      [productId]: {
        open: true,
        name: prev[productId]?.name ?? '',
        phone: prev[productId]?.phone ?? '',
        loading: false,
        done: prev[productId]?.done ?? false,
        error: null,
      },
    }))
  }

  const updateNotify = (productId: string, patch: Partial<NotifyState>) => {
    setNotifyById((prev) => {
      const current: NotifyState = prev[productId] ?? {
        open: true,
        name: '',
        phone: '',
        loading: false,
        done: false,
        error: null,
      }
      return {
        ...prev,
        [productId]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  const submitNotify = async (product: ComandaShopProduct) => {
    const state = notifyById[product.id]
    if (!state?.name.trim() || !state.phone.trim()) {
      updateNotify(product.id, { error: 'Completează numele și telefonul.' })
      return
    }

    updateNotify(product.id, { loading: true, error: null })
    try {
      const res = await fetch('/api/shop/b2c/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: state.name.trim(),
          customer_phone: state.phone.trim(),
          product_id: product.id,
          product_name: product.name,
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        updateNotify(product.id, {
          loading: false,
          error: json.error ?? 'Nu am putut trimite cererea.',
        })
        return
      }
      const name = state.name.trim()
      const phone = state.phone.trim()
      updateNotify(product.id, { loading: false, done: true, open: false })
      const notifyWaUrl = buildNotifyWaUrl(product.id, name, phone)
      if (notifyWaUrl) {
        window.open(notifyWaUrl, '_blank', 'noopener,noreferrer')
      }
    } catch {
      updateNotify(product.id, { loading: false, error: 'Eroare de rețea. Încearcă din nou.' })
    }
  }

  const submitOrder = async () => {
    if (!orderName.trim() || !orderPhone.trim()) {
      setOrderError('Completează numele și telefonul.')
      return
    }
    if (deliveryMode === 'livrare' && !orderAddress.trim()) {
      setOrderError('Introdu adresa de livrare.')
      return
    }
    if (cartLines.length === 0) {
      setOrderError('Coșul este gol.')
      return
    }

    setOrderSubmitting(true)
    setOrderError(null)
    setOrderSuccess(false)

    const items = cartLines.map((line) => ({
      vid: line.product.id,
      label: `${line.product.name} — ${line.product.unit_label}`,
      qty: line.qty,
      price_lei: line.product.price_lei ?? 0,
    }))

    try {
      const res = await fetch('/api/shop/b2c/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: orderName.trim(),
          customer_phone: orderPhone.trim(),
          delivery_mode: deliveryMode,
          delivery_address: deliveryMode === 'livrare' ? orderAddress.trim() : undefined,
          items,
          total_lei: cartTotal,
          notes: orderNotes.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string; order_id?: string }
      if (!res.ok || !json.success) {
        setOrderError(json.error ?? 'Nu am putut salva comanda.')
        setOrderSubmitting(false)
        return
      }

      setOrderSuccess(true)
      const message = buildWaMessage({
        lines: cartLines,
        total: cartTotal,
        name: orderName,
        phone: orderPhone,
        deliveryMode,
        address: orderAddress,
        notes: orderNotes,
      })
      window.open(`${WA_BASE}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')

      setQtyById({})
      setOrderSubmitting(false)
    } catch {
      setOrderError('Eroare de rețea. Încearcă din nou.')
      setOrderSubmitting(false)
    }
  }

  return (
    <div className="w-full pb-32">
      {/* TOPBAR */}
      <header className="sticky top-0 z-40 border-b border-[#F3DAD4]/80 bg-[#FFF6F3]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <ZmeurelLogo />
          <a
            href="https://wa.me/40752953048?text=Bun%C4%83!%20A%C8%99%20dori%20s%C4%83%20comand%20afine%20siberiene%20de%20la%20Zmeurel."
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white ${styles.waPulse}`}
          >
            <WaIcon />
            WhatsApp
          </a>
        </div>
      </header>

      <div className="px-3 pt-3">
        {loadError ? (
          <p className="mb-3 rounded-2xl border border-[#F3DAD4] bg-white px-4 py-3 text-sm text-[#E15453]">
            {loadError}
          </p>
        ) : null}

        {/* HERO */}
        <section className="overflow-hidden rounded-[26px] bg-[#F16B6B] p-5 text-white shadow-md">
          <div
            className={`mb-4 inline-block rounded-2xl bg-gradient-to-r from-[#5B4FCF] to-[#7B6BFF] px-4 py-2 text-[11px] font-semibold leading-snug tracking-wide text-white shadow-md ${styles.badgeTilt}`}
          >
            <span className="block uppercase opacity-90">Acum disponibile</span>
            <span className={`block text-sm ${styles.fontDisplay}`}>Afine siberiene</span>
            <span className="block opacity-90">Recoltă 2026 · Văratec</span>
          </div>

          <div className="grid gap-4">
            <div>
              <h1 className={`text-[1.65rem] font-semibold leading-tight ${styles.fontDisplay}`}>
                Primele fructe ale sezonului, Culese în ziua livrării.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/95">
                Afine siberiene proaspete din ferma noastră din Văratec. Culese dimineața și livrate în aceeași
                zi.
              </p>
              <button
                type="button"
                onClick={scrollToProducts}
                className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#E15453] shadow-sm transition active:scale-[0.98]"
              >
                Comandă acum
              </button>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden rounded-[22px]">
              <Image
                src="/shop/shop-hero.jpg"
                alt="Afine siberiene proaspete culese dimineața în ferma din Văratec"
                fill
                priority
                sizes="(max-width: 640px) 100vw, 540px"
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-[#312E3F]/25">
                <span className={`text-center text-lg font-semibold text-white/90 ${styles.fontDisplay}`}>
                  Culese azi-dimineață
                </span>
              </div>
              <span className="absolute bottom-3 left-3 rounded-full bg-[#312E3F]/85 px-3 py-1 text-xs font-medium text-white">
                Văratec · Suceava
              </span>
            </div>
          </div>
        </section>

        {/* TRUST */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <TrustPill>Culese în ziua livrării</TrustPill>
          <TrustPill>Livrare la domiciliu</TrustPill>
          <TrustPill>Cash sau Revolut</TrustPill>
        </div>

        {/* PRODUSE */}
        <section id="produse" className="mt-8 scroll-mt-24">
          <h2 className={`text-xl font-semibold text-[#312E3F] ${styles.fontDisplay}`}>Produse</h2>

          <div className="mt-4 space-y-3">
            {available.map((product) => {
              const qty = qtyById[product.id] ?? 0
              return (
                <article
                  key={product.id}
                  className="flex items-center gap-3 rounded-[14px] border border-[#F3DAD4] bg-white p-3 shadow-sm"
                >
                  <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={productImageSrc(product.id) ?? '/shop/shop-afine.jpg'}
                      alt={`${product.name} — ${product.unit_label}, culese proaspăt`}
                      width={72}
                      height={72}
                      sizes="72px"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold leading-tight text-[#312E3F]">{product.name}</h3>
                    <p className="mt-0.5 text-xs text-[#312E3F]/60">{product.unit_label}</p>
                    <p className="mt-0.5 text-[17px] font-bold text-[#F16B6B]">
                      {product.price_lei != null ? `${formatLei(product.price_lei)} lei` : '—'}
                    </p>
                  </div>
                  {qty === 0 ? (
                    <button
                      type="button"
                      aria-label={`Adaugă ${product.name}`}
                      onClick={() => {
                        setQty(product.id, 1)
                        showCartAddedToast()
                      }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F16B6B] text-[22px] leading-none font-light text-white active:scale-[0.98]"
                    >
                      +
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#F3DAD4] bg-[#FFF6F3] px-0.5 py-0.5">
                      <button
                        type="button"
                        aria-label="Scade cantitatea"
                        onClick={() => setQty(product.id, qty - 1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold text-[#312E3F]"
                      >
                        −
                      </button>
                      <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums text-[#312E3F]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label="Crește cantitatea"
                        onClick={() => {
                          setQty(product.id, qty + 1)
                          showCartAddedToast()
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F16B6B] text-base font-semibold text-white"
                      >
                        +
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {comingSoon.length > 0 ? (
            <>
              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#F3DAD4]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#312E3F]/60">
                  Se coc pe plantă
                </span>
                <span className="h-px flex-1 bg-[#F3DAD4]" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {comingSoon.map((product) => {
                  const notify = notifyById[product.id]
                  return (
                    <article
                      key={product.id}
                      className="overflow-hidden rounded-[14px] border border-[#F3DAD4] bg-white shadow-sm"
                    >
                      <div className="relative h-[90px] w-full overflow-hidden">
                        <Image
                          src={productImageSrc(product.id) ?? '/shop/shop-zmeura.jpg'}
                          alt={`${product.name} — în curând la fermă`}
                          fill
                          sizes="(max-width: 640px) 50vw, 200px"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-[#5B4FCF] to-[#7B6BFF]" />
                        <span className="absolute left-2 top-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                          Se coc
                        </span>
                        <h3
                          className={`absolute bottom-2 left-2 right-2 text-sm font-semibold leading-tight text-white ${styles.fontDisplay}`}
                        >
                          {product.name}
                        </h3>
                      </div>
                      <div className="p-2.5">
                        {product.description ? (
                          <p className="text-[11px] leading-snug text-[#312E3F]/60">{product.description}</p>
                        ) : null}

                        {notify?.done ? (
                          <p className="mt-2 rounded-lg bg-[#E8F5EE] px-2 py-1.5 text-[11px] font-medium leading-snug text-[#0D9B5C]">
                            Te-am înregistrat! Îți trimitem un mesaj când sunt disponibile.
                          </p>
                        ) : notify?.open ? (
                          <div className="mt-2 space-y-1.5 rounded-lg border border-[#F3DAD4] bg-[#FFF6F3] p-2">
                            <label className="block text-[10px] font-semibold text-[#312E3F]">
                              Nume
                              <input
                                value={notify.name}
                                onChange={(e) => updateNotify(product.id, { name: e.target.value })}
                                className="mt-0.5 w-full rounded-md border border-[#F3DAD4] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#F16B6B]"
                                autoComplete="name"
                              />
                            </label>
                            <label className="block text-[10px] font-semibold text-[#312E3F]">
                              Telefon
                              <input
                                value={notify.phone}
                                onChange={(e) => updateNotify(product.id, { phone: e.target.value })}
                                className="mt-0.5 w-full rounded-md border border-[#F3DAD4] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#F16B6B]"
                                autoComplete="tel"
                                inputMode="tel"
                              />
                            </label>
                            {notify.error ? (
                              <p className="text-[10px] text-[#E15453]">{notify.error}</p>
                            ) : null}
                            <button
                              type="button"
                              disabled={notify.loading}
                              onClick={() => submitNotify(product)}
                              className="w-full rounded-lg bg-gradient-to-r from-[#5B4FCF] to-[#7B6BFF] py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                            >
                              {notify.loading ? '…' : 'Trimite'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openNotify(product.id)}
                            className="mt-2 w-full min-h-11 rounded-lg border border-[#5B4FCF] bg-white py-3 text-xs font-bold text-[#5B4FCF]"
                          >
                            Anunță-mă
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          ) : null}
        </section>

        {/* DESPRE */}
        <section className="mt-10 rounded-[26px] bg-[#312E3F] p-6 text-white">
          <div className="relative mb-5 aspect-[16/10] w-full overflow-hidden rounded-[18px]">
            <img
              src="/shop/shop-ferma.jpg"
              alt="Ferma Zmeurel din Văratec, pe pământ bucovinean"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">De la noi din Văratec</p>
          <h2 className={`mt-2 text-2xl font-semibold ${styles.fontDisplay}`}>Gust cu zâmbete dulci</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/90">
            Culegem cu mâna, dimineața, coapte la momentul potrivit. Fără grabă, fără compromisuri.
            Ce ajunge la tine a crescut în Văratec, pe pământ bucovinean.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/90">
            Cultivăm cu pasiune și livrăm prospețime direct la ușa ta încă din noiembrie 2020.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-[#F16B6B]">✓</span> Culese în ziua livrării
            </li>
            <li className="flex gap-2">
              <span className="text-[#F16B6B]">✓</span> Recoltă manuală, fruct cu fruct
            </li>
            <li className="flex gap-2">
              <span className="text-[#F16B6B]">✓</span> Cash sau Revolut
            </li>
          </ul>
        </section>

        {/* LIVRARE */}
        <section className="mt-10">
          <h2 className={`text-xl font-semibold ${styles.fontDisplay}`}>Livrare</h2>
          <div className="mt-4 space-y-3">
            <InfoCard
              icon="🚗"
              title="Livrare la domiciliu"
              text="În Suceava și comunele din jur. Minim 1 kg."
            />
            <InfoCard icon="⚖️" title="Comune din jur" text="Minim 2 kg în afara municipiului Suceava." />
            <InfoCard
              icon="🫐"
              title="Proaspete garantat"
              text="Culegem în ziua livrării — fără depozitare lungă."
            />
          </div>
        </section>

        {/* B2B */}
        <section
          className="mt-10 rounded-2xl py-[18px] pl-4 pr-4 text-sm leading-[1.6] text-[#312E3F]"
          style={{
            background: '#FCE3DF',
            borderLeft: '3px solid #F16B6B',
          }}
        >
          <p className="text-[14px] leading-[1.6] text-[#312E3F]">
            Patiserii, cofetării sau magazine locale — dacă doriți să oferiți clienților voștri fructe proaspete
            de calitate, suntem partenerii potriviți. Contactați-ne pentru o ofertă dedicată.
          </p>
          <a
            href={B2B_WA_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block w-fit rounded-full border-0 bg-[#25D366] px-5 py-2.5 text-[14px] font-extrabold text-white no-underline transition active:scale-[0.98]"
          >
            Scrieți-ne pe WhatsApp
          </a>
        </section>

        {/* FOOTER */}
        <footer className="mt-10 -mx-3 rounded-t-[26px] bg-[#F16B6B] px-5 py-8 text-white">
          <FooterBrand />
          <p className="mt-4 text-sm leading-relaxed">
            Văratec, jud. Suceava
            <br />
            <a href="tel:+40752953048" className="font-semibold underline-offset-2 hover:underline">
              +40 752 953 048
            </a>
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <FooterSocialLink href={WA_BASE} label="WhatsApp">
              <FooterWhatsAppIcon />
            </FooterSocialLink>
            <FooterSocialLink href="https://www.facebook.com/ZmeuraSuceava/" label="Facebook">
              <FooterFacebookIcon />
            </FooterSocialLink>
            <FooterSocialLink href="https://www.instagram.com/zmeurel_sv/" label="Instagram">
              <FooterInstagramIcon />
            </FooterSocialLink>
          </div>
          <p className="mt-6 text-xs text-white/75">© {new Date().getFullYear()} Zmeurel · Văratec</p>
        </footer>
      </div>

      {/* COȘ FIX */}
      {cartCount > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[540px] items-center justify-between gap-3 rounded-[18px] bg-[#312E3F] px-4 py-3 text-white shadow-lg">
            <div className="text-sm">
              <p className="font-semibold">
                {cartCount} {cartCount === 1 ? 'produs' : 'produse'}
              </p>
              <p className="text-white/80">{formatLei(cartTotal)} lei</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOrderSuccess(false)
                setOrderError(null)
                setSheetOpen(true)
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white ${styles.waPulse}`}
            >
              <WaIcon />
              Comandă pe WhatsApp
            </button>
          </div>
        </div>
      ) : null}

      {/* ORDER SHEET */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Închide"
            className={`absolute inset-0 bg-black/40 ${styles.sheetBackdrop}`}
            onClick={() => !orderSubmitting && setSheetOpen(false)}
          />
          <div
            className={`relative mx-auto max-h-[90dvh] w-full max-w-[540px] overflow-y-auto rounded-t-[26px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 ${styles.sheetPanel}`}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#F3DAD4]" aria-hidden />
            <h2 className={`text-xl font-semibold text-[#312E3F] ${styles.fontDisplay}`}>Finalizează comanda</h2>

            {orderSuccess ? (
              <p className="mt-4 rounded-xl bg-[#E8F5EE] px-4 py-3 text-sm font-medium text-[#0D9B5C]">
                Comanda a fost salvată. WhatsApp s-a deschis cu mesajul pregătit — trimite-l pentru confirmare.
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  <Field label="Nume" value={orderName} onChange={setOrderName} autoComplete="name" />
                  <Field
                    label="Telefon"
                    value={orderPhone}
                    onChange={setOrderPhone}
                    autoComplete="tel"
                    inputMode="tel"
                  />

                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#312E3F]">Mod livrare</p>
                    <div className="flex gap-2">
                      <ToggleChip
                        active={deliveryMode === 'livrare'}
                        onClick={() => setDeliveryMode('livrare')}
                        label="Livrare"
                      />
                      <ToggleChip
                        active={deliveryMode === 'ridicare'}
                        onClick={() => setDeliveryMode('ridicare')}
                        label="Ridicare"
                      />
                    </div>
                  </div>

                  {deliveryMode === 'livrare' ? (
                    <Field label="Adresă livrare" value={orderAddress} onChange={setOrderAddress} />
                  ) : null}

                  <label className="block text-xs font-semibold text-[#312E3F]">
                    Observații (opțional)
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full resize-none rounded-lg border border-[#F3DAD4] bg-[#FFF6F3] px-3 py-[14px] text-sm outline-none focus:border-[#F16B6B]"
                    />
                  </label>
                </div>

                <p className="mt-4 rounded-xl bg-[#FFF6F3] px-3 py-2 text-xs leading-relaxed text-[#312E3F]/80">
                  Livrăm în Suceava și comunele învecinate. Minim 2 kg în afara municipiului. Nu livrăm prin
                  curier.
                </p>

                <p className="mt-2 rounded-xl bg-[#FFF6F3] px-3 py-2 text-xs font-medium text-[#312E3F]/80">
                  Plată: Cash sau Revolut
                </p>

                {orderError ? <p className="mt-3 text-sm text-[#E15453]">{orderError}</p> : null}

                <button
                  type="button"
                  disabled={orderSubmitting}
                  onClick={submitOrder}
                  className="mt-4 w-full rounded-full bg-[#25D366] py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {orderSubmitting ? 'Se salvează…' : 'Trimite comanda'}
                </button>
              </>
            )}

            <button
              type="button"
              className="mt-3 w-full py-2 text-sm font-medium text-[#312E3F]/60"
              onClick={() => setSheetOpen(false)}
            >
              Închide
            </button>
          </div>
        </div>
      ) : null}

      {cartToastVisible ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-20 z-[70] -translate-x-1/2 rounded-full bg-[#312E3F] px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          ✓ Adăugat în coș
        </div>
      ) : null}
    </div>
  )
}

function WaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function InfoCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-[22px] border border-[#F3DAD4] bg-white p-4 shadow-sm">
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="font-semibold text-[#312E3F]">{title}</p>
        <p className="mt-0.5 text-sm text-[#312E3F]/75">{text}</p>
      </div>
    </div>
  )
}

function FooterBrand() {
  return (
    <div>
      <Image
        src="/icons/icon.svg"
        alt="Zmeurel"
        width={54}
        height={54}
        unoptimized
        className="mb-2 block rounded-[14px]"
      />
      <p className={`text-[28px] font-semibold leading-none text-white ${styles.fontDisplay}`}>Zmeurel</p>
      <p
        className={`mt-1 text-sm italic ${styles.fontDisplay}`}
        style={{ color: 'rgba(255,255,255,0.9)' }}
      >
        gust cu zâmbete dulci
      </p>
    </div>
  )
}

function FooterSocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-xl border border-white/28 bg-white/18 text-white transition active:scale-[0.98]"
    >
      {children}
    </a>
  )
}

function FooterWhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden>
      <path d="M12 2a10 10 0 00-8.7 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4-1.1l-.3-.2-2.8.7.8-2.7-.2-.3A8 8 0 1112 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5 0a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5s-.5-1.3-.7-1.7-.4-.4-.5-.4h-.5a1 1 0 00-.7.3c-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6 1.8 2.7 4.3 3.8c1.6.7 2.2.7 3 .6.5 0 1.4-.6 1.6-1.1s.2-1 .1-1.1-.2-.2-.4-.3z" />
    </svg>
  )
}

function FooterFacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden>
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  )
}

function FooterInstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="24" height="24" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  inputMode?: 'tel' | 'text'
}) {
  return (
    <label className="block text-xs font-semibold text-[#312E3F]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#F3DAD4] bg-white px-3 py-[14px] text-sm outline-none focus:border-[#F16B6B]"
        autoComplete={autoComplete}
        inputMode={inputMode}
      />
    </label>
  )
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-[#F16B6B] text-white' : 'border border-[#F3DAD4] bg-[#FFF6F3] text-[#312E3F]'
      }`}
    >
      {label}
    </button>
  )
}
