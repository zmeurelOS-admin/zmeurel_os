'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Ellipsis,
  FileUp,
  Megaphone,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { ClientStepForm, type ClientPrefill } from '@/components/clienti/ClientStepForm'
import { ImportClientiSheet, WhatsappMessageSheet } from '@/components/clienti/ClientiMenuSheets'
import {
  BigInput,
  BottomSheet,
  Button,
  EmptyState,
  FilterPills,
  ListRow,
  Notice,
  StatTile,
  StatusPill,
  buttonVariants,
  kitText,
} from '@/components/kit'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { DEFAULT_WA_MESSAGE, getWhatsappMessage } from '@/lib/clienti/import'
import {
  CLIENT_TIP_LABEL,
  buildClientMetrics,
  clientFilterCounts,
  clientOrders,
  clientPretLabel,
  filterClients,
  metricsOf,
  type ClientFilter,
} from '@/lib/clienti/view'
import { localitateScurta } from '@/lib/comenzi/day-view'
import { comandaStatus, phoneForLinks } from '@/lib/comenzi/display'
import { formatKg, formatLei, formatNumber, initialsOf, relativeDayRo, shortDateRo } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { deleteClienți, getClienți, type Client } from '@/lib/supabase/queries/clienti'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { toast } from '@/lib/ui/toast'
import { useTodayIso } from '@/lib/ui/use-today-iso'
import { cn } from '@/lib/utils'

// ─── Legătura cu chatul AI (prin URL) ──────────────────────────────────────────

export function hasAiClientOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

export function parseAiClientPrefill(searchParams: Pick<URLSearchParams, 'get'>): ClientPrefill | null {
  if (!hasAiClientOpenForm(searchParams)) return null
  return {
    nume_client: searchParams.get('nume_client')?.trim() ?? '',
    telefon: searchParams.get('telefon')?.trim() ?? '',
    email: searchParams.get('email')?.trim() ?? '',
    adresa: searchParams.get('adresa')?.trim() ?? '',
    observatii: searchParams.get('observatii')?.trim() ?? '',
  }
}

const FORM_QUERY_PARAMS = ['add', 'openForm', 'nume_client', 'telefon', 'email', 'adresa', 'observatii', 'google_contacts', 'client'] as const

const GOOGLE_CONTACTS_STATUS_MESSAGES: Record<string, { type: 'success' | 'error'; text: string }> = {
  connected: { type: 'success', text: 'Google Contacts a fost conectat cu succes.' },
  error: { type: 'error', text: 'Conectarea la Google Contacts a eșuat.' },
  error_denied: { type: 'error', text: 'Autorizarea Google a fost refuzată.' },
  error_state: { type: 'error', text: 'Sesiune de autorizare invalidă, încearcă din nou.' },
  error_missing_code: { type: 'error', text: 'Răspuns invalid de la Google, încearcă din nou.' },
  error_forbidden: { type: 'error', text: 'Nu ai permisiunea să conectezi Google Contacts.' },
  error_no_refresh_token: {
    type: 'error',
    text: 'Google nu a oferit un token de reîmprospătare. Revocă accesul aplicației din contul Google (Security → Third-party access) și încearcă din nou.',
  },
}

type GoogleSyncResponse = { synced: number; lastSyncAt: string }

function formatGoogleSync(lastSyncAt: string | null): string {
  const date = lastSyncAt ? new Date(lastSyncAt) : null
  if (!date || Number.isNaN(date.getTime())) return 'Niciodată sincronizat'
  const formatted = new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(date)
  return `Ultima sincronizare: ${formatted}`
}

interface ClientPageClientProps {
  initialClienți: Client[]
  /** `null` = ferma nu are sincronizarea cu Google Contacts. */
  googleSync: { enabled: boolean; lastSyncAt: string | null } | null
}

const LIST_PAGE_SIZE = 60

export function ClientPageClient({ initialClienți, googleSync }: ClientPageClientProps) {
  useTrackModuleView('clienti')

  const queryClient = useQueryClient()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const todayIso = useTodayIso()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('toti')
  const [limit, setLimit] = useState(LIST_PAGE_SIZE)
  const [openClientId, setOpenClientId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [prefill, setPrefill] = useState<ClientPrefill | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [waMessage, setWaMessage] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState(googleSync?.lastSyncAt ?? null)
  const [syncing, setSyncing] = useState(false)

  // ─── Date ───
  const {
    data: clienti = initialClienți,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    initialData: initialClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: comenzi = [] } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: vanzari = [] } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: savedWaMessage } = useQuery({
    queryKey: ['clienti', 'mesaj-whatsapp'] as const,
    queryFn: getWhatsappMessage,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  const message = waMessage ?? savedWaMessage ?? DEFAULT_WA_MESSAGE

  // Până se află ziua (prima randare), anul e 0: cifrele anului apar imediat după.
  const year = todayIso ? Number(todayIso.slice(0, 4)) : 0
  const metrics = useMemo(() => buildClientMetrics(clienti, comenzi, vanzari, year), [clienti, comenzi, vanzari, year])
  const counts = useMemo(() => clientFilterCounts(clienti, metrics), [clienti, metrics])
  const sorted = useMemo(
    () => [...clienti].sort((left, right) => (left.nume_client || '').localeCompare(right.nume_client || '', 'ro')),
    [clienti],
  )
  const visible = useMemo(() => filterClients(sorted, metrics, filter, search), [filter, metrics, search, sorted])
  const openClient = clienti.find((client) => client.id === openClientId) ?? null
  // Clientul deschis a dispărut (șters): revenim la listă.
  if (openClientId !== null && openClient === null) setOpenClientId(null)

  // ─── Deschiderea din adresă (`?add=1`, `?openForm=1&…`, `?client=<id>`) și mesajele Google ───
  const formRequestedInUrl = searchParams.get('add') === '1' || hasAiClientOpenForm(searchParams)
  const googleStatus = searchParams.get('google_contacts')
  // `?client=<id>`: fișa clientului (din notificarea „Bani de încasat”).
  const clientInUrl = searchParams.get('client')?.trim() || null
  const [seenQuery, setSeenQuery] = useState<string | null>(null)
  const [pendingFromUrl, setPendingFromUrl] = useState<{ prefill: ClientPrefill | null } | null>(null)
  if (seenQuery !== queryString) {
    setSeenQuery(queryString)
    if (clientInUrl) setOpenClientId(clientInUrl)
    if (formRequestedInUrl) {
      setPendingFromUrl({ prefill: parseAiClientPrefill(searchParams) })
    } else if (pendingFromUrl) {
      setPendingFromUrl(null)
      setPrefill(pendingFromUrl.prefill)
      setEditing(null)
      setFormOpen(true)
    }
  }

  useEffect(() => {
    if (!formRequestedInUrl && !googleStatus && !clientInUrl) return
    if (googleStatus) {
      const status = GOOGLE_CONTACTS_STATUS_MESSAGES[googleStatus]
      if (status?.type === 'success') toast.success(status.text)
      else if (status) toast.error(status.text)
    }
    const nextParams = new URLSearchParams(queryString)
    for (const name of FORM_QUERY_PARAMS) nextParams.delete(name)
    const query = nextParams.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname
    window.history.replaceState(window.history.state, '', nextUrl)
    router.replace(nextUrl, { scroll: false })
  }, [clientInUrl, formRequestedInUrl, googleStatus, pathname, queryString, router])

  // ─── Acțiuni ───
  const openCreate = useCallback(() => {
    setPrefill(null)
    setEditing(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((client: Client) => {
    setPrefill(null)
    setEditing(client)
    setFormOpen(true)
  }, [])

  const syncGoogle = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const response = await fetch('/api/integrations/google/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!response.ok) throw new Error('sync failed')
      const result = (await response.json()) as GoogleSyncResponse
      setLastSyncAt(result.lastSyncAt)
      toast.success(
        result.synced > 0
          ? `Sincronizare completă — ${result.synced} contacte actualizate`
          : 'Sincronizare completă — nicio modificare nouă',
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      setMenuOpen(false)
    } catch {
      toast.error('Sincronizarea a eșuat, încearcă din nou')
    } finally {
      setSyncing(false)
    }
  }

  const confirmDelete = async () => {
    if (!openClient || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteClienți(openClient.id)
      queryClient.setQueryData<Client[]>(queryKeys.clienti, (previous) =>
        previous ? previous.filter((client) => client.id !== openClient.id) : previous,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Client șters')
      setDeleteOpen(false)
      setOpenClientId(null)
    } catch (cause) {
      setDeleteError(cause instanceof Error && cause.message ? cause.message : 'Clientul nu s-a putut șterge.')
    } finally {
      setDeleting(false)
    }
  }

  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={openCreate}>
      <Plus aria-hidden />
      Client nou
    </Button>
  )

  // ─── Fișa clientului ───
  let body: React.ReactNode
  let bottomButton: React.ReactNode = null

  if (openClient) {
    const clientMetrics = metricsOf(metrics, openClient.id)
    const phone = phoneForLinks(openClient.telefon)
    const pretLabel = clientPretLabel(openClient)
    const orders = clientOrders(comenzi, openClient.id)
    const isB2b = openClient.tip !== 'standard'
    const newOrderHref = `/comenzi?client=${openClient.id}&nou=1`

    bottomButton = (
      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => router.push(newOrderHref)}>
        <Plus aria-hidden />
        Comandă nouă
      </Button>
    )

    body = (
      <>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="neutral" size="touch" onClick={() => setOpenClientId(null)}>
            <ArrowLeft aria-hidden />
            Clienți
          </Button>
          <Button
            type="button"
            variant="neutral"
            size="icon-touch"
            aria-label={`Editează clientul ${openClient.nume_client}`}
            onClick={() => openEdit(openClient)}
          >
            <Pencil aria-hidden />
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className={cn('break-words font-extrabold text-fg', kitText.screen)}>{openClient.nume_client}</h2>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone={isB2b ? 'info' : 'neutral'}>{pretLabel ?? CLIENT_TIP_LABEL[openClient.tip]}</StatusPill>
            {clientMetrics.neincasatLei > 0 ? (
              <StatusPill tone="warning">Neîncasat {formatLei(clientMetrics.neincasatLei)}</StatusPill>
            ) : null}
          </div>
        </div>

        {phone ? (
          <div className="grid grid-cols-2 gap-2.5">
            <a href={`tel:${phone.tel}`} className={buttonVariants({ variant: 'neutral', size: 'touch-lg' })}>
              <Phone aria-hidden />
              Sună
            </a>
            <a
              href={`https://wa.me/${phone.wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'neutral', size: 'touch-lg' })}
            >
              <MessageCircle aria-hidden />
              WhatsApp
            </a>
          </div>
        ) : (
          <Notice tone="info" title="Fără telefon">
            Adaugă numărul din „Editează”, ca să poți suna și scrie pe WhatsApp.
          </Notice>
        )}

        <dl className="space-y-3 px-1">
          {openClient.telefon?.trim() ? (
            <div>
              <dt className={cn('font-medium text-fg-muted', kitText.secondary)}>Telefon</dt>
              <dd className={cn('font-semibold text-fg', kitText.base)}>{openClient.telefon.trim()}</dd>
            </div>
          ) : null}
          <div>
            <dt className={cn('font-medium text-fg-muted', kitText.secondary)}>Adresă de livrare</dt>
            <dd className={cn('break-words font-semibold text-fg', kitText.base)}>{openClient.adresa?.trim() || 'Fără adresă'}</dd>
          </div>
          {openClient.email?.trim() ? (
            <div>
              <dt className={cn('font-medium text-fg-muted', kitText.secondary)}>Email</dt>
              <dd className={cn('break-words font-semibold text-fg', kitText.base)}>{openClient.email.trim()}</dd>
            </div>
          ) : null}
        </dl>

        <section aria-label={`Anul ${year}`} className="space-y-2">
          <h3 className={cn('px-1 font-extrabold text-fg', kitText.card)}>Anul {year}</h3>
          <div className="grid grid-cols-3 gap-2">
            <StatTile value={clientMetrics.comenziAn} label="comenzi" />
            <StatTile value={formatNumber(clientMetrics.kgAn)} unit="kg" label="livrate" />
            <StatTile value={formatNumber(clientMetrics.incasatAn)} unit="lei" label="încasat" />
          </div>
        </section>

        <section aria-label="Ultimele comenzi" className="space-y-2">
          <h3 className={cn('px-1 font-extrabold text-fg', kitText.card)}>Ultimele comenzi</h3>
          {orders.length === 0 ? (
            <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Nicio comandă încă.</p>
          ) : (
            <ul className="space-y-2">
              {orders.map((comanda) => {
                const status = comandaStatus(comanda, todayIso ?? '')
                return (
                  <li
                    key={comanda.id}
                    className="flex min-h-touch-lg items-center justify-between gap-3 rounded-box border border-border bg-surface px-4 py-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className={cn('font-bold text-fg', kitText.base)}>
                        {formatKg(comanda.cantitate_kg)} · {formatLei(comanda.total)}
                      </span>
                      <span className={cn('text-fg-muted', kitText.secondary)}>
                        {comanda.data_livrare ? relativeDayRo(comanda.data_livrare, todayIso ?? '') : 'Fără dată'}
                      </span>
                    </span>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {openClient.observatii?.trim() ? (
          <section aria-label="Observații" className="space-y-1 px-1">
            <h3 className={cn('font-extrabold text-fg', kitText.card)}>Observații</h3>
            <p className={cn('whitespace-pre-line break-words text-fg', kitText.base)}>{openClient.observatii.trim()}</p>
          </section>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {/* Butonul fix de jos e ascuns pe desktop: aici rămâne și acolo. */}
          <div className="hidden md:block">{bottomButton}</div>
          {isB2b && phone ? (
            <a
              href={`https://wa.me/${phone.wa}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}
            >
              <Megaphone aria-hidden />
              Trimite anunțul pe WhatsApp
            </a>
          ) : null}
          <Button
            type="button"
            variant="quiet"
            size="touch"
            className="w-full text-danger-text"
            onClick={() => {
              setDeleteError(null)
              setDeleteOpen(true)
            }}
          >
            <Trash2 aria-hidden />
            Șterge clientul
          </Button>
        </div>
      </>
    )
  } else if (isError) {
    body = (
      <Notice
        tone="danger"
        title="Clienții nu s-au încărcat"
        action={
          <Button type="button" variant="neutral" size="touch" loading={isRefetching} onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        }
      >
        {(error as Error | null)?.message || 'Verifică internetul și încearcă din nou.'}
      </Notice>
    )
  } else if (clienti.length === 0) {
    body = (
      <EmptyState
        icon={<Users />}
        title="Niciun client încă"
        description="Adaugă primul client sau importă-i dintr-un fișier."
        action={
          <div className="flex w-64 max-w-full flex-col gap-2.5">
            {addButton}
            <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setImportOpen(true)}>
              <FileUp aria-hidden />
              Importă din fișier
            </Button>
          </div>
        }
      />
    )
  } else {
    const shown = visible.slice(0, limit)
    bottomButton = addButton
    body = (
      <>
        <div className="flex gap-2.5">
          <BigInput
            wrapperClassName="min-w-0 flex-1"
            aria-label="Caută după nume sau telefon"
            placeholder="Nume sau telefon"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setLimit(LIST_PAGE_SIZE)
            }}
            leading={<Search aria-hidden />}
            autoComplete="off"
            enterKeyHint="search"
          />
          <Button
            type="button"
            variant="neutral"
            size="icon-touch"
            className="size-14 shrink-0"
            aria-label="Mai multe: import, Google Contacts, mesajul WhatsApp"
            onClick={() => setMenuOpen(true)}
          >
            <Ellipsis aria-hidden />
          </Button>
        </div>

        <FilterPills<ClientFilter>
          aria-label="Ce clienți arăt"
          value={filter}
          onValueChange={(next) => {
            setFilter(next)
            setLimit(LIST_PAGE_SIZE)
          }}
          options={[
            { value: 'toti', label: 'Toți', count: counts.toti },
            { value: 'persoane', label: 'Persoane', count: counts.persoane },
            { value: 'patiserii', label: 'Patiserii', count: counts.patiserii },
            { value: 'magazine', label: 'Magazine', count: counts.magazine },
            { value: 'neincasat', label: 'Neîncasat', count: counts.neincasat },
          ]}
        />

        <div className="hidden md:block">{addButton}</div>

        {shown.length === 0 ? (
          <EmptyState icon={<Search />} title="Niciun client găsit" description="Schimbă filtrul sau căutarea." />
        ) : (
          <ul className="space-y-2">
            {shown.map((client) => {
              const clientMetrics = metricsOf(metrics, client.id)
              const pretLabel = client.tip !== 'standard' ? clientPretLabel(client) : null
              const detail = [
                pretLabel,
                localitateScurta(client.adresa),
                clientMetrics.ultimaComanda ? `ultima: ${shortDateRo(clientMetrics.ultimaComanda.data)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={client.id}>
                  <ListRow
                    avatar={initialsOf(client.nume_client)}
                    title={client.nume_client}
                    detail={detail || client.telefon?.trim() || 'Fără detalii'}
                    onClick={() => setOpenClientId(client.id)}
                    aria-label={`Deschide fișa: ${client.nume_client}${clientMetrics.neincasatLei > 0 ? `, neîncasat ${formatLei(clientMetrics.neincasatLei)}` : ''}`}
                    trailing={
                      clientMetrics.neincasatLei > 0 ? (
                        <span className="flex flex-col items-end">
                          <span className={cn('font-extrabold text-warning-text', kitText.secondary)}>
                            {formatLei(clientMetrics.neincasatLei)}
                          </span>
                          <span className={cn('text-fg-muted', kitText.helper)}>neîncasat</span>
                        </span>
                      ) : undefined
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
        {visible.length > shown.length ? (
          <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setLimit((value) => value + LIST_PAGE_SIZE)}>
            Arată încă {Math.min(LIST_PAGE_SIZE, visible.length - shown.length)}
          </Button>
        ) : null}
      </>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Clienți"
          subtitle={`${clienti.length} ${clienti.length === 1 ? 'client' : 'clienți'}`}
          contentVariant="workspace"
        />
      }
      bottomBarFixed
      bottomBar={
        // Butonul mare ține locul butonului plutitor (+).
        bottomButton ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box shadow-2">{bottomButton}</div>
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-modul space-y-4 pt-3">{body}</div>

      <ClientStepForm open={formOpen} onOpenChange={setFormOpen} clienti={clienti} editing={editing} prefill={prefill} />

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Mai multe">
        <ul className="space-y-2">
          <li>
            <ListRow
              avatar={false}
              leading={<MenuIcon><FileUp aria-hidden /></MenuIcon>}
              title="Importă din fișier"
              detail="Excel sau CSV, inclusiv exportul din Google Contacts"
              onClick={() => {
                // O foaie se închide înainte să se deschidă alta.
                setMenuOpen(false)
                setImportOpen(true)
              }}
            />
          </li>
          {googleSync ? (
            <li>
              {googleSync.enabled ? (
                <ListRow
                  avatar={false}
                  leading={<MenuIcon><RefreshCw aria-hidden className={syncing ? 'animate-spin' : undefined} /></MenuIcon>}
                  title={syncing ? 'Se sincronizează…' : 'Sincronizează cu Google Contacts'}
                  detail={formatGoogleSync(lastSyncAt)}
                  disabled={syncing}
                  chevron={false}
                  onClick={() => void syncGoogle()}
                />
              ) : (
                <a
                  href="/api/integrations/google/connect"
                  className={cn(buttonVariants({ variant: 'neutral', size: 'touch-lg' }), 'w-full justify-start')}
                >
                  <RefreshCw aria-hidden />
                  Reconectează Google Contacts
                </a>
              )}
            </li>
          ) : null}
          <li>
            <ListRow
              avatar={false}
              leading={<MenuIcon><Megaphone aria-hidden /></MenuIcon>}
              title="Mesajul WhatsApp implicit"
              detail="Anunțul pentru patiserii și magazine"
              onClick={() => {
                setMenuOpen(false)
                setWaOpen(true)
              }}
            />
          </li>
        </ul>
        <p className={cn('mt-4 px-1 text-fg-muted', kitText.helper)}>
          „Șterge toți clienții” s-a mutat în Setări › Date.
        </p>
      </BottomSheet>

      <ImportClientiSheet open={importOpen} onOpenChange={setImportOpen} />
      <WhatsappMessageSheet open={waOpen} onOpenChange={setWaOpen} message={message} onSaved={setWaMessage} />

      <BottomSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Ștergi clientul?"
        description={openClient?.nume_client}
      >
        <div className="space-y-4">
          {deleteError ? (
            <Notice tone="danger" title="Clientul nu s-a șters">
              {deleteError}
            </Notice>
          ) : (
            <p className={cn('text-fg', kitText.base)}>
              Un client cu comenzi sau vânzări nu poate fi șters: istoricul lui rămâne.
            </p>
          )}
          <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={deleting} onClick={() => void confirmDelete()}>
            Șterge clientul
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setDeleteOpen(false)}>
            Renunță
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  )
}

function MenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5">
      {children}
    </span>
  )
}
