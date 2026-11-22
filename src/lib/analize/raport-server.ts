/**
 * Raportul unei analize, citit pe server cu service role: pagina publică `/a/<token>` și raportul din aplicație
 * (`/api/analize/<id>/raport`, după ce ruta a verificat cu sesiunea că utilizatorul vede analiza).
 *
 * Citește DOAR coloanele de care are nevoie raportul (niciodată `certificate_number`, `certificate_photo_url`,
 * `pv_poza_path`, `nota`), verifică întâi `status` și `public_activ`, apoi construiește cu `construiesteRaport`.
 * Doar `select` (și un link semnat spre poza buletinului, când opțiunea e pornită).
 */
import QRCode from 'qrcode'

import { isMissingTableError } from '@/lib/notifications/preferinte'
import { isMissingColumnError } from '@/lib/schema-features'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { adaugaZile } from '@/lib/tratamente/zile'
import { formatPhoneDisplay } from '@/lib/utils/phone'

import { optiuniEfective, type SubstantaAnaliza } from './model'
import { COLOANE_ANALIZA_RAPORT, construiesteRaport, urlPublicAnaliza, type AnalizaPentruRaport, type RaportAnaliza } from './raport'
import { ZILE_INAINTE_DE_PRELEVARE, tratamenteInaintePrelevare, type ActivitatePentruAnaliza, type AplicarePentruAnaliza } from './tratamente-inainte'

// Tabelele noi nu sunt în tipurile generate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any
type Raspuns<T> = { data: T | null; error: { code?: string; message?: string } | null }

/** Tokenul linkului: litere, cifre, `-` și `_`, 10–64 de caractere. Altfel nici nu căutăm. */
export function tokenValid(token: string | null | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{10,64}$/.test(token)
}

/** Originea linkului public (fără slash la final). */
export function origineAplicatie(host?: string | null, proto?: string | null): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (env) return env.replace(/\/$/, '')
  if (host) return `${proto || 'https'}://${host}`
  return 'https://app.zmeurel.ro'
}

type AnalizaCuTenant = AnalizaPentruRaport & { id: string; tenant_id: string }

export interface RaportCuQr {
  raport: RaportAnaliza
  qrSvg: string
  analizaId: string
}

async function construiesteDinAnaliza(admin: Admin, analiza: AnalizaCuTenant, origine: string, previzualizare: boolean): Promise<RaportCuQr | null> {
  // Verificarea întâi: neconform, la laborator sau link oprit → nimic altceva nu se citește.
  if (analiza.status !== 'conform') return null
  if (!previzualizare && !analiza.public_activ) return null

  const tenantId = analiza.tenant_id
  const [parceleLegate, substanteRes, tenantRes, acteRes, setariRes] = await Promise.all([
    admin.from('analize_fructe_parcele').select('parcela_id').eq('analiza_id', analiza.id) as Promise<Raspuns<Array<{ parcela_id: string }>>>,
    admin
      .from('analize_fructe_substante')
      .select('substanta,valoare_mg_kg,lmr_mg_kg,ordine')
      .eq('analiza_id', analiza.id)
      .order('ordine', { ascending: true }) as Promise<Raspuns<SubstantaAnaliza[]>>,
    admin.from('tenants').select('nume_ferma,localitate,contact_phone').eq('id', tenantId).maybeSingle() as Promise<
      Raspuns<{ nume_ferma: string | null; localitate: string | null; contact_phone: string | null }>
    >,
    // Doar seria, valabilitatea, localitatea și telefonul. Numărul și poza atestatului nu se cer.
    admin.from('farmer_legal_docs').select('legal_type,certificate_series,certificate_expiry,locality,phone').eq('tenant_id', tenantId).maybeSingle() as Promise<
      Raspuns<{ legal_type: string | null; certificate_series: string | null; certificate_expiry: string | null; locality: string | null; phone: string | null }>
    >,
    admin.from('tenant_settings').select('analize_public_implicit').eq('tenant_id', tenantId).maybeSingle() as Promise<Raspuns<{ analize_public_implicit: unknown }>>,
  ])
  if (parceleLegate.error) throw parceleLegate.error
  if (substanteRes.error) throw substanteRes.error
  if (tenantRes.error) throw tenantRes.error
  if (acteRes.error) throw acteRes.error
  if (setariRes.error && !isMissingColumnError(setariRes.error)) throw setariRes.error

  const parcelaIds = (parceleLegate.data ?? []).map((row) => row.parcela_id)
  const parceleRes = (await (parcelaIds.length
    ? admin.from('parcele').select('id,nume_parcela,soi,soi_plantat,cultura,tip_fruct').in('id', parcelaIds).eq('tenant_id', tenantId)
    : Promise.resolve({ data: [], error: null }))) as Raspuns<
    Array<{ id: string; nume_parcela: string | null; soi: string | null; soi_plantat: string | null; cultura: string | null; tip_fruct: string | null }>
  >
  if (parceleRes.error) throw parceleRes.error

  // Tratamentele din cele 30 de zile dinainte (cu o zi în plus de fiecare parte, pentru fusul orar).
  const de = adaugaZile(analiza.data_prelevare, -(ZILE_INAINTE_DE_PRELEVARE + 1))
  const pana = adaugaZile(analiza.data_prelevare, 1)
  const [aplicariRes, activitatiRes] = parcelaIds.length
    ? await Promise.all([
        admin
          .from('aplicari_tratament')
          .select(
            'id,parcela_id,status,data_aplicata,metoda_aplicare,lot_id,produs_nume_manual,produs:produse_fitosanitare(nume_comercial,phi_zile,tip),produse:aplicari_tratament_produse(produs_nume_snapshot,phi_zile_snapshot,tip_snapshot)',
          )
          .eq('tenant_id', tenantId)
          .eq('status', 'aplicata')
          .in('parcela_id', parcelaIds)
          .gte('data_aplicata', `${de}T00:00:00Z`)
          .lte('data_aplicata', `${pana}T23:59:59Z`) as Promise<Raspuns<AplicarePentruAnaliza[]>>,
        admin
          .from('activitati_agricole')
          .select('id,parcela_id,data_aplicare,tip_activitate,produs_utilizat,timp_pauza_zile')
          .eq('tenant_id', tenantId)
          .in('parcela_id', parcelaIds)
          .gte('data_aplicare', de)
          .lte('data_aplicare', pana) as Promise<Raspuns<ActivitatePentruAnaliza[]>>,
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (aplicariRes.error) throw aplicariRes.error
  if (activitatiRes.error) throw activitatiRes.error

  const aplicari = (aplicariRes.data ?? []).map((row) => ({
    ...row,
    produs: Array.isArray(row.produs) ? (row.produs[0] ?? null) : row.produs,
    produse: Array.isArray(row.produse) ? row.produse : [],
  }))

  const optiuniFerma = setariRes.data?.analize_public_implicit ?? null
  const optiuni = optiuniEfective(optiuniFerma, analiza.public_optiuni)
  let pozaBuletinUrl: string | null = null
  if (optiuni.poza_buletin && analiza.buletin_path) {
    const { data } = await admin.storage.from('analize').createSignedUrl(analiza.buletin_path, 60 * 60)
    pozaBuletinUrl = data?.signedUrl ?? null
  }

  const acte = acteRes.data
  const telefon = acte?.phone || tenantRes.data?.contact_phone || null
  const url = urlPublicAnaliza(origine, analiza.public_token)
  const raport = construiesteRaport(
    {
      analiza,
      ferma: { nume: tenantRes.data?.nume_ferma ?? null, localitate: tenantRes.data?.localitate || acte?.locality || null },
      atestat: acte?.legal_type === 'certificat_producator' ? { serie: acte.certificate_series, valabilPana: acte.certificate_expiry } : null,
      telefon: telefon ? formatPhoneDisplay(telefon) : null,
      optiuniFerma,
      parcele: (parceleRes.data ?? []).map((p) => ({
        nume: p.nume_parcela?.trim() || 'Parcelă',
        soi: p.soi?.trim() || p.soi_plantat?.trim() || null,
        cultura: p.cultura?.trim() || p.tip_fruct?.trim() || null,
      })),
      substante: (substanteRes.data ?? []).map((s) => ({
        ...s,
        valoare_mg_kg: s.valoare_mg_kg === null ? null : Number(s.valoare_mg_kg),
        lmr_mg_kg: s.lmr_mg_kg === null ? null : Number(s.lmr_mg_kg),
      })),
      tratamente: tratamenteInaintePrelevare({ aplicari, activitati: activitatiRes.data ?? [], parcelaIds, dataPrelevare: analiza.data_prelevare }),
      url,
      pozaBuletinUrl,
    },
    { previzualizare },
  )
  if (!raport) return null
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
  return { raport, qrSvg, analizaId: analiza.id }
}

/** Pagina publică: doar conform + link activ, după token. `null` → 404. */
export async function raportPublicDupaToken(token: string, origine: string): Promise<RaportCuQr | null> {
  if (!tokenValid(token)) return null
  const admin = getSupabaseAdmin() as Admin
  const { data, error } = (await admin.from('analize_fructe').select(COLOANE_ANALIZA_RAPORT).eq('public_token', token).maybeSingle()) as Raspuns<AnalizaCuTenant>
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  if (!data) return null
  return construiesteDinAnaliza(admin, data, origine, false)
}

/**
 * Raportul din aplicație (previzualizare: și cu linkul oprit). Apelantul a verificat deja, cu sesiunea
 * utilizatorului, că analiza `id` e a fermei lui (RLS).
 */
export async function raportPentruAplicatie(id: string, tenantId: string, origine: string): Promise<RaportCuQr | null> {
  const admin = getSupabaseAdmin() as Admin
  const { data, error } = (await admin
    .from('analize_fructe')
    .select(COLOANE_ANALIZA_RAPORT)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()) as Raspuns<AnalizaCuTenant>
  if (error) throw error
  if (!data) return null
  return construiesteDinAnaliza(admin, data, origine, true)
}
