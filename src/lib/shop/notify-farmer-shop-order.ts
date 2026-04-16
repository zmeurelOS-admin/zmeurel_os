import type { SupabaseClient } from '@supabase/supabase-js'

import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import type { Database } from '@/types/supabase'

export type ShopOrderNotifyPayload = {
  tenantId: string
  numeFerma: string
  ownerUserId: string | null
  clientName: string
  phone: string
  lineCount: number
  totalLei: number
  currency: string
  /** `magazin_asociatie` | `magazin_public` etc. */
  dataOrigin?: string | null
}

function resendApiKey(): string | undefined {
  return (
    process.env.SHOP_ORDER_NOTIFY_RESEND_API_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    undefined
  )
}

function buildMessageBody(p: ShopOrderNotifyPayload): string {
  const total = Number.isFinite(p.totalLei) ? p.totalLei.toFixed(2) : String(p.totalLei)
  const isAssoc = p.dataOrigin === 'magazin_asociatie'
  const header = isAssoc ? 'Comandă nouă din Magazinul Gustă din Bucovina' : 'Comandă nouă din magazin'
  const intro = isAssoc
    ? `Comanda a fost plasată de clientul ${p.clientName} prin platforma Zmeurel OS (operator tehnic). Comerciant: asociația.`
    : `Comandă plasată prin platforma Zmeurel OS de clientul ${p.clientName}.`
  return [
    header,
    '',
    intro,
    '',
    `Client: ${p.clientName}`,
    `Telefon: ${p.phone}`,
    `Produse: ${p.lineCount} ${p.lineCount === 1 ? 'linie' : 'linii'}`,
    `Total estimat: ${total} ${p.currency}`,
    '',
    p.numeFerma ? `Fermă (linie): ${p.numeFerma}` : '',
    '',
    'Poți gestiona comanda în Zmeurel OS → modulul Comenzi.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function resolveRecipientEmail(
  admin: SupabaseClient<Database>,
  payload: ShopOrderNotifyPayload,
): Promise<string | null> {
  const override = process.env.SHOP_ORDER_NOTIFY_EMAIL?.trim()
  if (override) return override

  if (!payload.ownerUserId) {
    
    return null
  }

  const { data, error } = await admin.auth.admin.getUserById(payload.ownerUserId)
  if (error) {
    
    return null
  }
  const email = data.user?.email?.trim()
  if (!email) {
    
    return null
  }
  return email
}

async function resolveAssociationAdminEmails(admin: SupabaseClient<Database>): Promise<string[]> {
  const { data: members, error } = await admin.from('association_members').select('user_id').eq('role', 'admin')
  if (error || !members?.length) {
    
    return []
  }
  const out: string[] = []
  for (const m of members as { user_id: string }[]) {
    const { data: u, error: ue } = await admin.auth.admin.getUserById(m.user_id)
    if (ue || !u.user?.email) continue
    const em = u.user.email.trim()
    if (em) out.push(em)
  }
  return [...new Set(out)]
}

/**
 * Trimite o notificare scurtă fermierului după o comandă din magazinul public.
 * Pentru `magazin_asociatie`, notifică și administratorii asociației (același conținut).
 * Nu aruncă erori: eșecurile sunt logate; checkout-ul trebuie să rămână neafectat.
 */
export async function notifyFarmerShopOrder(
  admin: SupabaseClient<Database>,
  payload: ShopOrderNotifyPayload,
): Promise<void> {
  try {
    const apiKey = resendApiKey()
    const from = process.env.SHOP_ORDER_NOTIFY_FROM?.trim()

    const body = buildMessageBody(payload)

    if (!apiKey || !from) {
      
      return
    }

    const farmerTo = await resolveRecipientEmail(admin, payload)
    const association = payload.dataOrigin === 'magazin_asociatie'
    const adminEmails = association ? await resolveAssociationAdminEmails(admin) : []

    const toList = [farmerTo, ...adminEmails].filter((e): e is string => Boolean(e && e.length > 0))
    const uniqueTo = [...new Set(toList)]

    if (uniqueTo.length === 0) return

    const subject =
      association
        ? 'Comandă nouă din Magazinul Gustă din Bucovina'
        : 'Comandă nouă din magazin · Zmeurel'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: uniqueTo,
        subject,
        text: body,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(
        '[shop-order-notify] resend failed',
        sanitizeForLog({
          status: res.status,
          body_length: errText.length,
        }),
      )
      return
    }

    
  } catch (e) {
    console.error(
      '[shop-order-notify] unexpected',
      sanitizeForLog({
        error: toSafeErrorContext(e),
      }),
    )
  }
}
