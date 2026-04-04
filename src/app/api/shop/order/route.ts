import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import {
  createNotificationForTenantOwner,
  createNotificationsForAssociationAdmins,
  NOTIFICATION_TYPES,
} from '@/lib/notifications/create'
import {
  formatDeliveryDateFromIso,
  getDeliveryFee,
  getNextDeliveryDateIso,
} from '@/lib/shop/association/delivery'
import { notifyFarmerShopOrder } from '@/lib/shop/notify-farmer-shop-order'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/types/supabase'

type TenantShopRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  'id' | 'nume_ferma' | 'owner_user_id'
>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  /** `association_shop` → `data_origin = magazin_asociatie` și preț din listarea asociației. */
  channel: z.enum(['farm_shop', 'association_shop']).optional(),
  /** @deprecated Preferă `channel`. */
  checkoutContext: z.enum(['farm', 'association']).optional(),
  tenantId: z.string().regex(UUID_RE, 'tenant invalid'),
  lines: z
    .array(
      z.object({
        produsId: z.string().regex(UUID_RE),
        qty: z.number().positive().max(50_000),
      }),
    )
    .min(1)
    .max(40),
  nume: z.string().trim().min(2, 'Introdu numele').max(120),
  telefon: z.string().trim().min(5, 'Introdu telefonul').max(40),
  locatie: z.string().trim().min(3, 'Introdu localitatea sau adresa').max(500),
  observatii: z.string().trim().max(2000).optional(),
  /** Subtotal întreg coș (toate fermele) — pentru livrare asociație. */
  cartSubtotalLei: z.number().nonnegative().optional(),
  /** Index fermă în checkout (0 = prima) — taxa livrare pe primul rând al primei ferme. */
  associationCheckoutPart: z
    .object({
      farmIndex: z.number().int().min(0),
      farmCount: z.number().int().min(1),
    })
    .optional(),
  /** Consimțământ contact WhatsApp (magazin asociație). */
  whatsappConsent: z.boolean().optional(),
})

function todayIsoBucharest(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

export async function POST(request: Request) {
  const originCheck = validateSameOriginMutation(request)
  if (originCheck) return originCheck

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalid' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors
    const first =
      Object.values(msg).flat()[0] ?? parsed.error.issues[0]?.message ?? 'Date invalide'
    return NextResponse.json({ ok: false, error: first }, { status: 400 })
  }

  const {
    tenantId,
    lines,
    nume,
    telefon,
    locatie,
    observatii,
    channel,
    checkoutContext,
    cartSubtotalLei,
    associationCheckoutPart,
    whatsappConsent,
  } = parsed.data
  const waConsent = whatsappConsent ?? true
  const orderChannel: 'farm_shop' | 'association_shop' =
    channel ?? (checkoutContext === 'association' ? 'association_shop' : 'farm_shop')
  const orderDataOrigin = orderChannel === 'association_shop' ? 'magazin_asociatie' : 'magazin_public'

  try {
    const admin = getSupabaseAdmin() as AnyAdmin

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id, nume_ferma, owner_user_id')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantError || !tenant) {
      return NextResponse.json({ ok: false, error: 'Ferma nu a fost găsită.' }, { status: 404 })
    }

    const tenantRow = tenant as TenantShopRow

    const ids = Array.from(new Set(lines.map((l) => l.produsId)))
    const { data: produseRows, error: prodError } = await admin
      .from('produse')
      .select('id,tenant_id,nume,unitate_vanzare,pret_unitar,association_price,association_listed,moneda,status')
      .eq('tenant_id', tenantId)
      .in('id', ids)

    if (prodError) {
      console.error('[shop/order]', prodError)
      return NextResponse.json({ ok: false, error: 'Nu am putut verifica produsele.' }, { status: 500 })
    }

    const byId = new Map((produseRows ?? []).map((r: { id: string }) => [r.id, r]))

    type ProdRow = {
      id: string
      tenant_id: string
      nume: string
      unitate_vanzare: string
      pret_unitar: number | null
      association_price: number | null
      association_listed: boolean | null
      moneda: string
      status: string
    }

    let totalLei = 0
    const resolved: {
      produsId: string
      nume: string
      unitate: string
      qty: number
      pret: number
      moneda: string
      lineTotal: number
    }[] = []

    for (const line of lines) {
      const row = byId.get(line.produsId) as ProdRow | undefined
      if (!row || row.status !== 'activ') {
        return NextResponse.json(
          { ok: false, error: 'Un produs nu mai este disponibil. Reîncarcă pagina.' },
          { status: 400 },
        )
      }
      if (orderChannel === 'association_shop') {
        if (!row.association_listed) {
          return NextResponse.json(
            { ok: false, error: `Produsul „${row.nume}” nu este disponibil în magazinul asociației.` },
            { status: 400 },
          )
        }
      }
      const unitFarm = row.pret_unitar != null ? round2(Number(row.pret_unitar)) : NaN
      const unitAssoc =
        row.association_price != null ? round2(Number(row.association_price)) : NaN
      const pret =
        orderChannel === 'association_shop'
          ? (row.association_price != null ? unitAssoc : unitFarm)
          : unitFarm
      if (!Number.isFinite(pret) || pret <= 0) {
        return NextResponse.json(
          { ok: false, error: `Produsul „${row.nume}” nu are preț setat. Contactează fermă.` },
          { status: 400 },
        )
      }
      const qty = round2(line.qty)
      const lineTotal = round2(qty * pret)
      totalLei = round2(totalLei + lineTotal)
      resolved.push({
        produsId: row.id,
        nume: row.nume,
        unitate: row.unitate_vanzare,
        qty,
        pret,
        moneda: row.moneda || 'RON',
        lineTotal,
      })
    }

    const today = todayIsoBucharest()
    const orderIds: string[] = []
    const batchNote = `Magazin online · ${resolved.length} ${resolved.length === 1 ? 'linie' : 'linii'}`

    const linesSubtotalBatch = round2(resolved.reduce((s, x) => s + x.lineTotal, 0))
    const cartSubtotalForDelivery =
      orderChannel === 'association_shop'
        ? round2(cartSubtotalLei ?? linesSubtotalBatch)
        : linesSubtotalBatch
    const deliveryDateIso =
      orderChannel === 'association_shop' ? getNextDeliveryDateIso() : today
    const deliveryFeeWholeCart =
      orderChannel === 'association_shop' ? getDeliveryFee(cartSubtotalForDelivery) : 0
    const farmIndex = associationCheckoutPart?.farmIndex ?? 0

    for (let i = 0; i < resolved.length; i++) {
      const r = resolved[i]
      const parts: string[] = []
      if (i === 0) {
        parts.push(batchNote)
        if (observatii) parts.push(observatii)
        if (orderChannel === 'association_shop') {
          parts.push(
            `Livrare: ${formatDeliveryDateFromIso(deliveryDateIso)} · ${deliveryFeeWholeCart > 0 ? `+${deliveryFeeWholeCart} RON` : 'GRATUIT'}`,
          )
        }
      }
      parts.push(`${r.nume} · ${r.qty} ${r.unitate} × ${r.pret} ${r.moneda}/${r.unitate}`)

      const lineDelivery =
        orderChannel === 'association_shop' && farmIndex === 0 && i === 0
          ? round2(deliveryFeeWholeCart)
          : 0

      const insertPayload: Record<string, unknown> = {
        tenant_id: tenantId,
        client_id: null,
        client_nume_manual: nume,
        telefon,
        locatie_livrare: locatie,
        data_comanda: today,
        data_livrare: deliveryDateIso,
        cantitate_kg: r.qty,
        pret_per_kg: r.pret,
        total: r.lineTotal,
        cost_livrare: lineDelivery,
        status: 'noua',
        observatii: parts.join('\n'),
        data_origin: orderDataOrigin,
        produs_id: r.produsId,
        whatsapp_consent: waConsent,
      }

      const { data: inserted, error: insErr } = await admin
        .from('comenzi')
        .insert(insertPayload)
        .select('id')
        .single()

      if (insErr) {
        console.error('[shop/order] insert', insErr)
        return NextResponse.json(
          { ok: false, error: 'Nu am putut salva comanda. Încearcă din nou.' },
          { status: 500 },
        )
      }
      orderIds.push((inserted as { id: string }).id)
    }

    try {
      const productSummary = resolved.map((r) => r.nume).join(', ')
      const extra = {
        orderIds,
        tenantId,
        clientName: nume,
        totalLei,
        currency: resolved[0]?.moneda ?? 'RON',
        lineCount: resolved.length,
        channel: orderChannel === 'association_shop' ? 'association_shop' : 'farm_shop',
      }
      if (orderChannel === 'association_shop') {
        void createNotificationsForAssociationAdmins(
          NOTIFICATION_TYPES.order_new,
          'Comandă nouă',
          `${nume} a comandat: ${productSummary}`,
          extra,
          'order',
          orderIds[0] ?? null,
        )
      } else {
        void createNotificationForTenantOwner(
          tenantId,
          NOTIFICATION_TYPES.order_new,
          'Comandă nouă din magazin',
          `${nume} a comandat: ${productSummary}`,
          extra,
          'order',
          orderIds[0] ?? null,
        )
      }
    } catch (e) {
      console.error('[shop/order] notifications', e)
    }

    await notifyFarmerShopOrder(admin, {
      tenantId,
      numeFerma: tenantRow.nume_ferma ?? '',
      ownerUserId: tenantRow.owner_user_id ?? null,
      clientName: nume,
      phone: telefon,
      lineCount: resolved.length,
      totalLei,
      currency: resolved[0]?.moneda ?? 'RON',
      dataOrigin: orderDataOrigin,
    })

    const cartDeliveryFeeLei =
      orderChannel === 'association_shop' && farmIndex === 0 ? deliveryFeeWholeCart : 0

    return NextResponse.json({
      ok: true,
      orderIds,
      totalLei,
      linesSubtotalLei: totalLei,
      cartDeliveryFeeLei,
      deliveryDateIso: orderChannel === 'association_shop' ? deliveryDateIso : undefined,
      currency: resolved[0]?.moneda ?? 'RON',
    })
  } catch (e) {
    console.error('[shop/order]', e)
    return NextResponse.json({ ok: false, error: 'Eroare server.' }, { status: 500 })
  }
}
