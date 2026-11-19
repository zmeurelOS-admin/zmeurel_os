'use client'

import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus } from 'lucide-react'

import { BigInput, Button, ListRow, Notice, StepFormTitle, kitText } from '@/components/kit'
import { resolveExistingClientByPhone } from '@/lib/comenzi/ai-order-client'
import { formatLeiKg, phoneDigits, searchKey } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
import { createClienți, type Client } from '@/lib/supabase/queries/clienti'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import { cn } from '@/lib/utils'

const MAX_RECENT = 8
const MAX_RESULTS = 30

/** Clienții ultimelor comenzi, fără dubluri, cei mai recenți primii. */
export function recentClients(
  comenzi: readonly Pick<Comanda, 'client_id' | 'created_at'>[],
  clienti: readonly Client[],
  limit = MAX_RECENT,
): Client[] {
  const byId = new Map(clienti.map((client) => [client.id, client]))
  const seen = new Set<string>()
  const result: Client[] = []
  const sorted = [...comenzi].sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')))
  for (const comanda of sorted) {
    if (!comanda.client_id || seen.has(comanda.client_id)) continue
    const client = byId.get(comanda.client_id)
    if (!client) continue
    seen.add(comanda.client_id)
    result.push(client)
    if (result.length >= limit) break
  }
  return result
}

/** Căutare după nume (fără diacritice) sau după cifrele telefonului. */
export function searchClients(clienti: readonly Client[], query: string, limit = MAX_RESULTS): Client[] {
  const text = searchKey(query)
  if (!text) return []
  const digits = phoneDigits(query)
  // „0745…” găsește și „+40745…”: comparăm fără zeroul de la început.
  const digitsTail = digits.replace(/^0+/, '')
  return clienti
    .filter((client) => {
      if (searchKey(client.nume_client).includes(text)) return true
      return digitsTail.length >= 3 && phoneDigits(client.telefon).includes(digitsTail)
    })
    .slice(0, limit)
}

export function clientDetail(client: Pick<Client, 'tip' | 'pret_negociat_lei_kg' | 'adresa' | 'telefon'>): string {
  const parts: string[] = []
  if (client.tip === 'patiserie' || client.tip === 'magazin') {
    const label = client.tip === 'patiserie' ? 'Patiserie' : 'Magazin'
    const price = Number(client.pret_negociat_lei_kg ?? 0)
    parts.push(price > 0 ? `${label} · ${formatLeiKg(price)}` : label)
  }
  if (client.adresa?.trim()) parts.push(client.adresa.trim())
  else if (client.telefon?.trim()) parts.push(client.telefon.trim())
  return parts.join(' · ')
}

// ─── Pasul 1: clientul ─────────────────────────────────────────────────────────

export interface ComandaClientStepProps {
  clienti: readonly Client[]
  comenzi: readonly Pick<Comanda, 'client_id' | 'created_at'>[]
  /** Ce e scris în căutare la deschidere (ex. numele venit din chat sau de pe o comandă fără client). */
  initialQuery?: string
  onPick: (client: Client) => void
  /** Deschide „Client nou”, cu ce s-a scris în căutare pus deja în câmpuri. */
  onAddNew: (seed: { nume: string; telefon: string }) => void
}

/** Căutare după nume sau telefon, clienții recenți și „Client nou”. Atingerea unui client trece la detalii. */
export function ComandaClientStep({ clienti, comenzi, initialQuery = '', onPick, onAddNew }: ComandaClientStepProps) {
  const [query, setQuery] = useState(initialQuery)
  const recent = useMemo(() => recentClients(comenzi, clienti), [comenzi, clienti])
  const results = useMemo(() => searchClients(clienti, query), [clienti, query])
  const searching = query.trim() !== ''
  const list = searching ? results : recent.length > 0 ? recent : clienti.slice(0, MAX_RECENT)

  const seedFromQuery = () => {
    const text = query.trim()
    const looksLikePhone = /^[+\d\s()-]{6,}$/.test(text)
    return looksLikePhone ? { nume: '', telefon: text } : { nume: text, telefon: '' }
  }

  return (
    <div className="space-y-4">
      <StepFormTitle>Pentru cine e comanda?</StepFormTitle>

      <BigInput
        aria-label="Caută după nume sau telefon"
        placeholder="Nume sau telefon"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leading={<Search aria-hidden />}
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="search"
      />

      <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => onAddNew(seedFromQuery())}>
        <UserPlus aria-hidden />
        Client nou
      </Button>

      <section aria-labelledby="comanda-clienti-lista" className="space-y-2">
        <h3 id="comanda-clienti-lista" className={cn('px-1 font-bold text-fg-muted', kitText.secondary)}>
          {searching ? `Rezultate (${results.length})` : recent.length > 0 ? 'Clienți recenți' : 'Clienți'}
        </h3>
        {list.length === 0 ? (
          <Notice tone="info" title={searching ? 'Niciun client găsit' : 'Nu ai niciun client încă'}>
            {searching ? 'Verifică numele sau adaugă-l ca „Client nou”.' : 'Adaugă primul client cu butonul de mai sus.'}
          </Notice>
        ) : (
          <ul className="space-y-2">
            {list.map((client) => (
              <li key={client.id}>
                <ListRow
                  title={client.nume_client}
                  detail={clientDetail(client) || undefined}
                  onClick={() => onPick(client)}
                  aria-label={`Alege clientul ${client.nume_client}`}
                />
              </li>
            ))}
          </ul>
        )}
        {!searching && clienti.length > list.length ? (
          <p className={cn('px-1 text-fg-muted', kitText.helper)}>
            Ai {clienti.length} clienți. Caută după nume sau telefon ca să-i vezi pe ceilalți.
          </p>
        ) : null}
      </section>
    </div>
  )
}

// ─── Client nou (în pas, nu în foaie suprapusă) ────────────────────────────────

export interface ComandaClientNouProps {
  clienti: readonly Client[]
  seed: { nume: string; telefon: string }
  onCreated: (client: Client) => void
  /** Telefonul există deja la alt client: îl alegem pe acela. */
  onUseExisting: (client: Client) => void
}

/** Nume + telefon. Dacă telefonul e deja la un client, îl propunem pe acela în loc să facem o dublură. */
export function ComandaClientNou({ clienti, seed, onCreated, onUseExisting }: ComandaClientNouProps) {
  const queryClient = useQueryClient()
  const [nume, setNume] = useState(seed.nume)
  const [telefon, setTelefon] = useState(seed.telefon)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const numeCurat = nume.trim().replace(/\s+/g, ' ')
  const telefonCurat = telefon.trim()
  const telefonNormalizat = telefonCurat ? normalizeRomanianMobilePhone(telefonCurat) : null
  const telefonInvalid = telefonCurat !== '' && !telefonNormalizat

  const match = useMemo(() => resolveExistingClientByPhone([...clienti], telefonCurat), [clienti, telefonCurat])
  const existing =
    match.status === 'existing'
      ? clienti.find((client) => client.id === match.client.id) ?? null
      : match.status === 'ambiguous'
        ? clienti.find((client) => client.id === match.clients[0]?.id) ?? null
        : null

  const canSave = numeCurat.length >= 2 && !telefonInvalid && !existing

  const save = async () => {
    if (!canSave || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const created = await createClienți({ nume_client: numeCurat, telefon: telefonNormalizat, tip: 'standard' })
      queryClient.setQueryData<Client[]>(queryKeys.clienti, (previous) =>
        previous ? [...previous.filter((item) => item.id !== created.id), created] : previous,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      onCreated(created)
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Clientul nu s-a salvat.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <StepFormTitle>Client nou</StepFormTitle>
      <BigInput
        label="Nume"
        value={nume}
        onChange={(event) => setNume(event.target.value)}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={120}
      />
      <BigInput
        label="Telefon"
        type="tel"
        inputMode="tel"
        value={telefon}
        onChange={(event) => setTelefon(event.target.value)}
        autoComplete="off"
        enterKeyHint="done"
        placeholder="07xx xxx xxx"
        error={telefonInvalid ? ROMANIAN_PHONE_ERROR : undefined}
        hint="Îl folosim pentru apel și WhatsApp. Poți să-l adaugi și mai târziu."
      />
      {existing ? (
        <Notice
          tone="warning"
          title={`Numărul e deja la ${existing.nume_client}`}
          action={
            <Button type="button" variant="neutral" size="touch" onClick={() => onUseExisting(existing)}>
              Folosește clientul existent
            </Button>
          }
        >
          Ca să nu apară de două ori, alege clientul existent sau scrie alt număr.
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" title="Clientul nu s-a salvat">
          {error}
        </Notice>
      ) : null}
      {/* Butonul stă sub câmpuri, nu în zona de jos: acolo l-ar acoperi tastatura telefonului. */}
      <Button type="submit" variant="primary" size="touch-lg" className="w-full" disabled={!canSave} loading={saving}>
        {saving ? 'Se salvează…' : 'Salvează și continuă'}
      </Button>
    </form>
  )
}
