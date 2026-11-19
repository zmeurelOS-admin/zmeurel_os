'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { PageHeader } from '@/components/app/PageHeader'
import { CategorieIcon } from '@/components/cheltuieli/CategorieIcon'
import {
  CheltuialaStepForm,
  type FinancialKind,
  type FinancialPrefill,
} from '@/components/cheltuieli/CheltuialaStepForm'
import {
  BigInput,
  BottomSheet,
  Button,
  EmptyState,
  ListRow,
  Notice,
  Segments,
  StatTile,
  StatusPill,
  SummaryList,
  SummaryRow,
  buttonVariants,
  kitText,
} from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { resolveCheltuialaCategorie, resolveInvestitieCategorie } from '@/lib/financial/categories'
import {
  isSameMonth,
  monthOfIso,
  rowsOfMonth,
  rowsOfYear,
  shiftMonthRef,
  sortNewestFirst,
  sumLei,
  type MonthRef,
} from '@/lib/financial/view'
import { capitalizeRo, formatLei, monthYearRo, searchKey, shortDateRo, weekdayDateRo } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { deleteCheltuiala, getCheltuieli, type Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import { deleteInvestitie, getInvestitii, type Investitie } from '@/lib/supabase/queries/investitii'
import { isAutoManoperaCheltuiala } from '@/lib/supabase/queries/manopera-auto'
import { toast } from '@/lib/ui/toast'
import { useTodayIso } from '@/lib/ui/use-today-iso'
import { cn } from '@/lib/utils'

type Tab = 'cheltuieli' | 'investitii'

export interface CheltuieliPageClientProps {
  initialCheltuieli: Cheltuiala[]
  initialInvestitii: Investitie[]
  parcele: Array<{ id: string; nume_parcela: string | null }>
  /** Fila cu care pornește pagina (`/investitii` duce la „Investiții”). */
  initialTab: Tab
}

/** `?openForm=1&suma=…&data=…&categorie=…&descriere=…` (din chatul AI). */
export function parseAiFinancialPrefill(searchParams: Pick<URLSearchParams, 'get'>): FinancialPrefill | null {
  if (searchParams.get('openForm') !== '1') return null
  const read = (name: string) => (searchParams.get(name) ?? '').trim()
  return { suma: read('suma'), data: read('data'), categorie: read('categorie'), descriere: read('descriere') }
}

const FORM_QUERY_PARAMS = ['add', 'openForm', 'suma', 'data', 'descriere', 'categorie', 'furnizor', 'parcela', 'sursa'] as const

type Row = { kind: 'cheltuiala'; row: Cheltuiala } | { kind: 'investitie'; row: Investitie }

function errorText(cause: unknown, fallback: string): string {
  return (cause as { userMessage?: string } | null)?.userMessage || (cause instanceof Error && cause.message ? cause.message : fallback)
}

/**
 * O singură pagină „Cheltuieli”, cu două file: Cheltuieli (pe lună) și Investiții (pe an).
 * Tabelele rămân separate (`cheltuieli_diverse`, `investitii`); doar interfața e comună.
 */
export function CheltuieliPageClient({ initialCheltuieli, initialInvestitii, parcele, initialTab }: CheltuieliPageClientProps) {
  useTrackModuleView('cheltuieli')

  const queryClient = useQueryClient()
  const { memberRole, accessLevel } = useDashboardAuth()
  const isOperator = memberRole === 'operator'
  const canWrite = !isOperator || accessLevel === 'write'
  const canDelete = !isOperator
  const todayIso = useTodayIso()

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState('')
  const [monthOffset, setMonthOffset] = useState(0)
  const [yearOffset, setYearOffset] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [formKind, setFormKind] = useState<FinancialKind>(initialTab === 'investitii' ? 'investitie' : 'cheltuiala')
  const [prefill, setPrefill] = useState<FinancialPrefill | null>(null)
  const [editing, setEditing] = useState<Cheltuiala | Investitie | null>(null)

  const [opened, setOpened] = useState<Row | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ─── Date ───
  const cheltuieliQuery = useQuery({
    queryKey: queryKeys.cheltuieli,
    queryFn: getCheltuieli,
    initialData: initialCheltuieli,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const investitiiQuery = useQuery({
    queryKey: queryKeys.investitii,
    queryFn: getInvestitii,
    initialData: initialInvestitii,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const cheltuieli = cheltuieliQuery.data ?? initialCheltuieli
  const investitii = investitiiQuery.data ?? initialInvestitii
  const activeQuery = tab === 'cheltuieli' ? cheltuieliQuery : investitiiQuery

  // ─── Perioada ───
  const currentMonth: MonthRef | null = todayIso ? monthOfIso(todayIso) : null
  const month = currentMonth ? shiftMonthRef(currentMonth, monthOffset) : null
  const year = currentMonth ? currentMonth.year + yearOffset : null

  const monthRows = useMemo(() => (month ? sortNewestFirst(rowsOfMonth(cheltuieli, month)) : []), [cheltuieli, month])
  const cheltuieliAn = useMemo(() => (month ? rowsOfYear(cheltuieli, month.year) : []), [cheltuieli, month])
  const yearRows = useMemo(() => (year ? sortNewestFirst(rowsOfYear(investitii, year)) : []), [investitii, year])
  const investitiiAnTrecut = useMemo(() => (year ? rowsOfYear(investitii, year - 1) : []), [investitii, year])
  const parcelaNames = useMemo(
    () => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă fără nume'])),
    [parcele],
  )

  // ─── Deschiderea din adresă (`?add=1`, `?openForm=1&…` din chatul AI) ───
  const formRequestedInUrl = searchParams.get('add') === '1' || searchParams.get('openForm') === '1'
  const [seenQuery, setSeenQuery] = useState<string | null>(null)
  const [pendingFromUrl, setPendingFromUrl] = useState<{ prefill: FinancialPrefill | null; kind: FinancialKind } | null>(null)
  if (seenQuery !== queryString) {
    setSeenQuery(queryString)
    if (formRequestedInUrl) {
      setPendingFromUrl({
        prefill: parseAiFinancialPrefill(searchParams),
        kind: searchParams.get('fila') === 'investitii' ? 'investitie' : 'cheltuiala',
      })
    } else if (pendingFromUrl) {
      setPendingFromUrl(null)
      if (canWrite) {
        setTab(pendingFromUrl.kind === 'investitie' ? 'investitii' : 'cheltuieli')
        setFormKind(pendingFromUrl.kind)
        setPrefill(pendingFromUrl.prefill)
        setEditing(null)
        setFormOpen(true)
      }
    }
  }

  useEffect(() => {
    if (!formRequestedInUrl) return
    const nextParams = new URLSearchParams(queryString)
    for (const name of FORM_QUERY_PARAMS) nextParams.delete(name)
    const query = nextParams.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname
    window.history.replaceState(window.history.state, '', nextUrl)
    router.replace(nextUrl, { scroll: false })
  }, [formRequestedInUrl, pathname, queryString, router])

  // ─── Acțiuni ───
  const openCreate = useCallback(() => {
    setFormKind(tab === 'investitii' ? 'investitie' : 'cheltuiala')
    setPrefill(null)
    setEditing(null)
    setFormOpen(true)
  }, [tab])

  const openRow = useCallback((row: Row) => {
    setOpened(row)
    setConfirmingDelete(false)
    setDeleteError(null)
    setSheetOpen(true)
  }, [])

  const openEdit = (row: Row) => {
    // Foaia se închide înainte să se deschidă formularul.
    setSheetOpen(false)
    setFormKind(row.kind)
    setPrefill(null)
    setEditing(row.row)
    setFormOpen(true)
  }

  const confirmDelete = async () => {
    if (!opened || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (opened.kind === 'cheltuiala') {
        await deleteCheltuiala(opened.row.id)
        queryClient.setQueryData<Cheltuiala[]>(queryKeys.cheltuieli, (previous) =>
          previous ? previous.filter((item) => item.id !== opened.row.id) : previous,
        )
        void queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
        trackEvent('delete_item', 'cheltuieli')
        track('cheltuiala_delete', { id: opened.row.id })
      } else {
        await deleteInvestitie(opened.row.id)
        queryClient.setQueryData<Investitie[]>(queryKeys.investitii, (previous) =>
          previous ? previous.filter((item) => item.id !== opened.row.id) : previous,
        )
        void queryClient.invalidateQueries({ queryKey: queryKeys.investitii })
        track('investitie_delete', { id: opened.row.id })
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      toast.success(opened.kind === 'cheltuiala' ? 'Cheltuială ștearsă' : 'Investiție ștearsă')
      setSheetOpen(false)
    } catch (cause) {
      setDeleteError(errorText(cause, 'Nu s-a putut șterge.'))
    } finally {
      setDeleting(false)
    }
  }

  const loading = todayIso === null
  const isCheltuieli = tab === 'cheltuieli'
  const rows: Row[] = isCheltuieli
    ? monthRows.map((row) => ({ kind: 'cheltuiala' as const, row }))
    : yearRows.map((row) => ({ kind: 'investitie' as const, row }))
  // Căutarea privește doar lista; cardurile de sus rămân totalurile perioadei.
  const searchText = searchKey(query)
  const visibleRows = searchText
    ? rows.filter((item) => {
        const categorie =
          item.kind === 'cheltuiala' ? resolveCheltuialaCategorie(item.row.categorie) : resolveInvestitieCategorie(item.row.categorie)
        const parcela = item.kind === 'investitie' && item.row.parcela_id ? parcelaNames.get(item.row.parcela_id) : null
        return [categorie, item.row.descriere, item.row.furnizor, parcela].some((value) => searchKey(value).includes(searchText))
      })
    : rows
  const periodLabel = isCheltuieli
    ? month
      ? capitalizeRo(monthYearRo(month.year, month.month))
      : ''
    : year
      ? `Anul ${year}`
      : ''
  const atPresent = isCheltuieli ? Boolean(month && currentMonth && isSameMonth(month, currentMonth)) : yearOffset === 0

  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={openCreate}>
      <Plus aria-hidden />
      {isCheltuieli ? 'Adaugă cheltuială' : 'Adaugă investiție'}
    </Button>
  )

  const openedAuto = opened?.kind === 'cheltuiala' && isAutoManoperaCheltuiala(opened.row)
  const openedDocument = opened ? ((opened.row as { document_url?: string | null }).document_url ?? null) : null

  return (
    <AppShell
      header={<PageHeader title="Cheltuieli" subtitle={periodLabel || undefined} contentVariant="workspace" />}
      bottomBarFixed
      bottomBar={
        // Butonul mare ține locul butonului plutitor (+). Loc liber în stânga pentru bula „beta”.
        canWrite && !loading ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-xl space-y-4 pt-3">
        <Segments<Tab>
          aria-label="Ce arăt"
          panelId="cheltuieli-lista"
          value={tab}
          onValueChange={(next) => {
            setTab(next)
            setQuery('')
          }}
          options={[
            { value: 'cheltuieli', label: 'Cheltuieli' },
            { value: 'investitii', label: 'Investiții' },
          ]}
        />

        {/* Perioada: luna la cheltuieli, anul la investiții. */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="neutral"
            size="icon-touch"
            aria-label={isCheltuieli ? 'Luna dinainte' : 'Anul dinainte'}
            onClick={() => (isCheltuieli ? setMonthOffset((value) => value - 1) : setYearOffset((value) => value - 1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <p className={cn('min-w-0 flex-1 truncate text-center font-extrabold text-fg', kitText.card)} aria-live="polite">
            {periodLabel || '…'}
          </p>
          <Button
            type="button"
            variant="neutral"
            size="icon-touch"
            aria-label={isCheltuieli ? 'Luna următoare' : 'Anul următor'}
            disabled={atPresent}
            onClick={() => (isCheltuieli ? setMonthOffset((value) => value + 1) : setYearOffset((value) => value + 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>

        {activeQuery.isError ? (
          <Notice
            tone="danger"
            title="Nu s-au încărcat"
            action={
              <Button type="button" variant="neutral" size="touch" loading={activeQuery.isRefetching} onClick={() => void activeQuery.refetch()}>
                Reîncearcă
              </Button>
            }
          >
            {errorText(activeQuery.error, 'Verifică internetul și încearcă din nou.')}
          </Notice>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            tone="inverse"
            value={formatLei(sumLei(rows.map((item) => item.row)))}
            label={`${isCheltuieli ? 'Luna aceasta' : `În ${year ?? ''}`} · ${rows.length} ${rows.length === 1 ? 'înregistrare' : 'înregistrări'}`}
          />
          {isCheltuieli ? (
            <StatTile value={formatLei(sumLei(cheltuieliAn))} label={`Tot anul ${month?.year ?? ''}`} />
          ) : (
            <StatTile value={formatLei(sumLei(investitiiAnTrecut))} label={`Anul trecut (${year ? year - 1 : ''})`} />
          )}
        </div>

        {canWrite ? <div className="hidden md:block">{addButton}</div> : null}

        {rows.length > 5 ? (
          <BigInput
            aria-label="Caută după categorie, furnizor sau descriere"
            placeholder="Caută: categorie, furnizor…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leading={<Search aria-hidden />}
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
          />
        ) : null}

        <section id="cheltuieli-lista" role="tabpanel" aria-label={isCheltuieli ? 'Cheltuieli' : 'Investiții'}>
          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Se încarcă">
              <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
              <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
            </div>
          ) : visibleRows.length === 0 && rows.length > 0 ? (
            <EmptyState icon={<Search />} title="Nimic găsit" description="Caută după categorie, furnizor sau ce ai cumpărat." />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Wallet />}
              title={isCheltuieli ? 'Nicio cheltuială în această lună' : 'Nicio investiție în acest an'}
              description={
                canWrite
                  ? isCheltuieli
                    ? 'Notează ce ai plătit: motorină, ambalaje, tratamente.'
                    : 'Notează ce ai cumpărat pe termen lung: butași, irigație, utilaje.'
                  : undefined
              }
            />
          ) : (
            <ul className="space-y-2">
              {visibleRows.map((item) => {
                const categorie =
                  item.kind === 'cheltuiala' ? resolveCheltuialaCategorie(item.row.categorie) : resolveInvestitieCategorie(item.row.categorie)
                const auto = item.kind === 'cheltuiala' && isAutoManoperaCheltuiala(item.row)
                const parcelaId = item.kind === 'investitie' ? item.row.parcela_id : null
                const title = auto ? 'Manoperă cules' : item.row.descriere?.trim() || categorie
                const detail = [
                  auto ? 'Automat din Recoltări' : title === categorie ? null : categorie,
                  shortDateRo(item.row.data),
                  item.row.furnizor?.trim() || null,
                  parcelaId ? parcelaNames.get(parcelaId) ?? null : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={`${item.kind}-${item.row.id}`}>
                    <ListRow
                      avatar={false}
                      leading={
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
                          <CategorieIcon kind={item.kind} categorie={item.row.categorie} />
                        </span>
                      }
                      title={title}
                      detail={detail}
                      onClick={() => openRow(item)}
                      chevron={false}
                      aria-label={`${title}, ${formatLei(Number(item.row.suma_lei) || 0)}, ${shortDateRo(item.row.data)}. Deschide`}
                      trailing={
                        <span className={cn('font-extrabold text-fg', kitText.base)}>{formatLei(Number(item.row.suma_lei) || 0)}</span>
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {todayIso ? (
        <CheltuialaStepForm
          kind={formKind}
          open={formOpen}
          onOpenChange={setFormOpen}
          todayIso={todayIso}
          parcele={parcele}
          prefill={prefill}
          editing={editing}
        />
      ) : null}

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={
          confirmingDelete
            ? opened?.kind === 'investitie'
              ? 'Ștergi investiția?'
              : 'Ștergi cheltuiala?'
            : opened
              ? formatLei(Number(opened.row.suma_lei) || 0)
              : 'Detalii'
        }
        description={opened ? capitalizeRo(weekdayDateRo(opened.row.data)) : undefined}
      >
        {opened ? (
          confirmingDelete ? (
            <div className="space-y-4">
              {deleteError ? (
                <Notice tone="danger" title="Nu s-a șters">
                  {deleteError}
                </Notice>
              ) : (
                <p className={cn('text-fg', kitText.base)}>
                  {formatLei(Number(opened.row.suma_lei) || 0)} din {shortDateRo(opened.row.data)} se șterge de tot.
                </p>
              )}
              <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={deleting} onClick={() => void confirmDelete()}>
                Șterge
              </Button>
              <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setConfirmingDelete(false)}>
                Înapoi
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {openedAuto ? (
                <div className="flex">
                  <StatusPill tone="info">Automat din Recoltări</StatusPill>
                </div>
              ) : null}
              <SummaryList>
                <SummaryRow
                  label="Categorie"
                  value={
                    opened.kind === 'cheltuiala'
                      ? resolveCheltuialaCategorie(opened.row.categorie)
                      : resolveInvestitieCategorie(opened.row.categorie)
                  }
                />
                {opened.row.furnizor?.trim() ? <SummaryRow label="Furnizor" value={opened.row.furnizor.trim()} /> : null}
                {opened.kind === 'investitie' && opened.row.parcela_id ? (
                  <SummaryRow label="Parcelă" value={parcelaNames.get(opened.row.parcela_id) ?? 'Parcelă necunoscută'} />
                ) : null}
              </SummaryList>
              {opened.row.descriere?.trim() ? (
                <p className={cn('whitespace-pre-line break-words px-1 text-fg', kitText.base)}>
                  {opened.row.descriere.replace('[AUTO_MANOPERA]', '').trim()}
                </p>
              ) : null}

              {openedAuto ? (
                <Notice tone="info" title="Se schimbă doar din Recoltări">
                  Suma urmează kilogramele notate și tarifele culegătorilor din ziua aceea.
                </Notice>
              ) : null}

              <div className="flex flex-col gap-2.5">
                {openedDocument ? (
                  <a
                    href={openedDocument}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}
                  >
                    <FileText aria-hidden />
                    Vezi bonul
                  </a>
                ) : null}
                {canWrite && !openedAuto ? (
                  <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => openEdit(opened)}>
                    <Pencil aria-hidden />
                    Editează
                  </Button>
                ) : null}
                {canDelete && !openedAuto ? (
                  <Button
                    type="button"
                    variant="quiet"
                    size="touch"
                    className="w-full text-danger-text"
                    onClick={() => {
                      setDeleteError(null)
                      setConfirmingDelete(true)
                    }}
                  >
                    <Trash2 aria-hidden />
                    Șterge
                  </Button>
                ) : null}
              </div>
            </div>
          )
        ) : null}
      </BottomSheet>
    </AppShell>
  )
}
