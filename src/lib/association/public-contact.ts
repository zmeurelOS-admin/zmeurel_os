import { cache } from 'react'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

export const ASSOCIATION_PUBLIC_CONTACT_SLUG = 'gusta-din-bucovina'

export type AssociationPublicContact = {
  facebookUrl: string
  instagramUrl: string
  merchantEmail: string
  merchantPhone: string
  orderPhone: string
}

export const DEFAULT_ASSOCIATION_PUBLIC_CONTACT: AssociationPublicContact = {
  facebookUrl: 'https://www.facebook.com/haigustadinbucovina',
  instagramUrl: '',
  merchantEmail: '',
  merchantPhone: '',
  orderPhone: '',
}

function cleanText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function sanitizeAssociationPublicContact(
  input: Partial<AssociationPublicContact> | null | undefined,
): AssociationPublicContact {
  return {
    facebookUrl: cleanText(input?.facebookUrl),
    instagramUrl: cleanText(input?.instagramUrl),
    merchantEmail: cleanText(input?.merchantEmail),
    merchantPhone: cleanText(input?.merchantPhone),
    orderPhone: cleanText(input?.orderPhone),
  }
}

export async function loadAssociationPublicContact(): Promise<AssociationPublicContact> {
  const admin = getSupabaseAdmin() as AnyAdmin

  try {
    const { data, error } = await admin
      .from('association_public_contacts')
      .select('facebook_url, instagram_url, email, phone, order_phone')
      .eq('slug', ASSOCIATION_PUBLIC_CONTACT_SLUG)
      .maybeSingle()

    if (error || !data) {
      return { ...DEFAULT_ASSOCIATION_PUBLIC_CONTACT }
    }

    return sanitizeAssociationPublicContact({
      facebookUrl: data.facebook_url,
      instagramUrl: data.instagram_url,
      merchantEmail: data.email,
      merchantPhone: data.phone,
      orderPhone: data.order_phone,
    })
  } catch (error) {
    console.warn('[association-public-contact] load failed', error)
    return { ...DEFAULT_ASSOCIATION_PUBLIC_CONTACT }
  }
}

export const loadAssociationPublicContactCached = cache(loadAssociationPublicContact)

export async function saveAssociationPublicContact(
  input: Partial<AssociationPublicContact>,
): Promise<AssociationPublicContact> {
  const admin = getSupabaseAdmin() as AnyAdmin
  const nextValue = sanitizeAssociationPublicContact({
    ...DEFAULT_ASSOCIATION_PUBLIC_CONTACT,
    ...input,
  })

  const payload = {
    slug: ASSOCIATION_PUBLIC_CONTACT_SLUG,
    facebook_url: nextValue.facebookUrl || null,
    instagram_url: nextValue.instagramUrl || null,
    email: nextValue.merchantEmail || null,
    phone: nextValue.merchantPhone || null,
    order_phone: nextValue.orderPhone || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin.from('association_public_contacts').upsert(payload, {
    onConflict: 'slug',
  })

  if (error) {
    throw error
  }

  return nextValue
}
