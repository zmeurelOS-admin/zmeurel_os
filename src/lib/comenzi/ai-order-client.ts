import { clientSchema } from '@/components/clienti/ClientForm'
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
import type { Client, ClientTip, CreateClientInput } from '@/lib/supabase/queries/clienti'

export type ClientMatchSummary = Pick<Client, 'id' | 'nume_client' | 'telefon' | 'adresa' | 'tip' | 'pret_negociat_lei_kg'>

export type ClientPhoneMatchResult =
  | {
      status: 'existing'
      normalizedPhone: string
      client: ClientMatchSummary
    }
  | {
      status: 'ambiguous'
      normalizedPhone: string
      clients: ClientMatchSummary[]
    }
  | {
      status: 'new'
      normalizedPhone: string | null
    }

export type OrderClientPersistencePlan =
  | {
      action: 'none'
      reason: 'not-requested' | 'existing-client-attached'
    }
  | {
      action: 'invalid'
      reason: 'invalid-name' | 'invalid-phone' | 'missing-phone' | 'ambiguous-phone-match'
      message: string
    }
  | {
      action: 'create-new'
      input: CreateClientInput
    }

function normalizeComparablePhone(value: string | null | undefined): string | null {
  if (!value) return null
  return normalizeRomanianMobilePhone(value)
}

export function resolveExistingClientByPhone(
  clienti: ClientMatchSummary[],
  rawPhone: string | null | undefined,
): ClientPhoneMatchResult {
  const normalizedPhone = normalizeComparablePhone(rawPhone)
  if (!normalizedPhone) {
    return { status: 'new', normalizedPhone: null }
  }

  const matches = clienti.filter(
    (client) => normalizeComparablePhone(client.telefon) === normalizedPhone,
  )

  if (matches.length === 1) {
    return {
      status: 'existing',
      normalizedPhone,
      client: matches[0],
    }
  }

  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      normalizedPhone,
      clients: matches,
    }
  }

  return {
    status: 'new',
    normalizedPhone,
  }
}

export function planOrderClientPersistence(params: {
  clienti: ClientMatchSummary[]
  clientId: string | null
  clientName: string
  rawPhone: string
  address: string
  saveClientRequested: boolean
  tip?: ClientTip
  requirePhone?: boolean
}): OrderClientPersistencePlan {
  const {
    clienti,
    clientId,
    clientName,
    rawPhone,
    address,
    saveClientRequested,
    tip = 'standard',
    requirePhone = false,
  } = params

  if (!saveClientRequested) {
    return { action: 'none', reason: 'not-requested' }
  }

  if (clientId) {
    return { action: 'none', reason: 'existing-client-attached' }
  }

  const name = clientName.trim()
  const phone = rawPhone.trim()

  if (!name) {
    return {
      action: 'invalid',
      reason: 'invalid-name',
      message: 'Completează numele clientului.',
    }
  }

  if (requirePhone && !phone) {
    return {
      action: 'invalid',
      reason: 'missing-phone',
      message: 'Completează telefonul clientului.',
    }
  }

  const parsedClient = clientSchema.safeParse({
    nume_client: name,
    tip,
    telefon: phone,
    email: '',
    adresa: address.trim(),
    pret_negociat_lei_kg: '',
    observatii: '',
    salveaza_in_telefon: false,
  })

  if (!parsedClient.success) {
    const firstIssue = parsedClient.error.issues[0]
    return {
      action: 'invalid',
      reason: 'invalid-name',
      message: firstIssue?.message ?? 'Datele clientului nu sunt valide.',
    }
  }

  const normalizedPhone = phone ? normalizeRomanianMobilePhone(phone) : null
  if (phone && !normalizedPhone) {
    return {
      action: 'invalid',
      reason: 'invalid-phone',
      message: ROMANIAN_PHONE_ERROR,
    }
  }

  const existingByPhone = resolveExistingClientByPhone(clienti, phone)
  if (existingByPhone.status === 'ambiguous') {
    return {
      action: 'invalid',
      reason: 'ambiguous-phone-match',
      message: 'Telefonul apare la mai mulți clienți. Verifică manual înainte de salvare.',
    }
  }

  if (existingByPhone.status === 'existing') {
    return {
      action: 'none',
      reason: 'existing-client-attached',
    }
  }

  return {
    action: 'create-new',
    input: {
      nume_client: parsedClient.data.nume_client,
      telefon: normalizedPhone,
      adresa: parsedClient.data.adresa?.trim() || null,
      tip,
    },
  }
}
