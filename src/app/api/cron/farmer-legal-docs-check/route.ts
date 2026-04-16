import { NextResponse } from 'next/server'

import {
  createNotificationForTenantOwner,
  createNotificationsForAssociationAdmins,
  NOTIFICATION_TYPES,
} from '@/lib/notifications/create'
import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const headerSecret = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')
  const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null

  return headerSecret === expected || bearerSecret === expected
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdmin()
    const today = new Date()
    const todayYmd = today.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
    const threshold = new Date(today)
    threshold.setDate(threshold.getDate() + 30)
    const thresholdYmd = threshold.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })

    const { data: docs, error } = await admin
      .from('farmer_legal_docs')
      .select('tenant_id, full_name, certificate_expiry, legal_type, legal_docs_complete, tenants!inner(nume_ferma, owner_user_id)')
      .eq('legal_type', 'certificat_producator')
      .not('certificate_expiry', 'is', null)

    if (error) {
      throw error
    }

    const expiringSoon: Array<{ tenantId: string; farmName: string; expiryDate: string }> = []
    const expired: Array<{ tenantId: string; farmName: string; expiryDate: string }> = []

    for (const row of (docs ?? []) as Array<{
      tenant_id: string
      certificate_expiry: string
      tenants: { nume_ferma: string | null; owner_user_id: string | null } | Array<{ nume_ferma: string | null; owner_user_id: string | null }> | null
    }>) {
      const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants
      const farmName = tenant?.nume_ferma?.trim() || 'Ferma ta'

      if (row.certificate_expiry < todayYmd) {
        expired.push({ tenantId: row.tenant_id, farmName, expiryDate: row.certificate_expiry })
      } else if (row.certificate_expiry <= thresholdYmd) {
        expiringSoon.push({ tenantId: row.tenant_id, farmName, expiryDate: row.certificate_expiry })
      }
    }

    await Promise.all(
      expiringSoon.map((item) =>
        createNotificationForTenantOwner(
          item.tenantId,
          NOTIFICATION_TYPES.legal_docs_expiring,
          'Certificatul tău expiră curând',
          `Certificatul tău de producător expiră pe ${new Date(`${item.expiryDate}T00:00:00`).toLocaleDateString('ro-RO', {
            dateStyle: 'long',
          })}. Actualizează-l pentru a continua să vinzi.`,
          { tenantId: item.tenantId, expiryDate: item.expiryDate },
          'farmer_legal_docs',
          item.tenantId,
        ),
      ),
    )

    let unlistedProducts = 0
    for (const item of expired) {
      const { data: rows, error: unlistError } = await admin
        .from('produse')
        .update({
          association_listed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', item.tenantId)
        .eq('association_listed', true)
        .select('id')

      if (unlistError) {
        throw unlistError
      }

      unlistedProducts += rows?.length ?? 0

      await createNotificationForTenantOwner(
        item.tenantId,
        NOTIFICATION_TYPES.legal_docs_expired,
        'Certificatul tău a expirat',
        `Certificatul tău de producător a expirat pe ${new Date(`${item.expiryDate}T00:00:00`).toLocaleDateString('ro-RO', {
          dateStyle: 'long',
        })}. Actualizează-l pentru a continua să vinzi.`,
        { tenantId: item.tenantId, expiryDate: item.expiryDate },
        'farmer_legal_docs',
        item.tenantId,
      )

      await createNotificationsForAssociationAdmins(
        NOTIFICATION_TYPES.legal_docs_expired,
        'Certificat expirat la producător',
        `${item.farmName} are certificatul expirat din ${new Date(`${item.expiryDate}T00:00:00`).toLocaleDateString('ro-RO', {
          dateStyle: 'long',
        })}. Produsele au fost retrase automat din listarea asociației.`,
        { tenantId: item.tenantId, expiryDate: item.expiryDate, farmName: item.farmName },
        'farmer_legal_docs',
        item.tenantId,
      )
    }

    return NextResponse.json({
      ok: true,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      unlistedProducts,
    })
  } catch (error) {
    captureApiError(error, { route: '/api/cron/farmer-legal-docs-check' })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check legal docs' },
      { status: 500 },
    )
  }
}
