'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Pencil, Phone, Plus, Trash2, UserCheck, UserX, Users } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { CulegatorStepForm } from '@/components/culegatori/CulegatorStepForm'
import {
  BottomSheet,
  Button,
  EmptyState,
  ListRow,
  Notice,
  Segments,
  StatTile,
  StatusPill,
  buttonVariants,
  kitText,
  longDayRo,
} from '@/components/kit'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { phoneForLinks } from '@/lib/comenzi/display'
import {
  buildCulegatorStats,
  culegatoriByStatus,
  culegatoriSummary,
  normalizeTipAngajare,
  statsOf,
} from '@/lib/culegatori/view'
import { capitalizeRo, formatKg, formatLei, formatLeiKg, formatNumber, initialsOf, weekdayDateRo } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { deleteCulegator, getCulegatori, updateCulegator, type Culegator } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { toast } from '@/lib/ui/toast'
import { useTodayIso } from '@/lib/ui/use-today-iso'
import { cn } from '@/lib/utils'

interface Props {
  initialCulegatori: Culegator[]
}

type StatusTab = 'activi' | 'inactivi'

export function CulegatorPageClient({ initialCulegatori }: Props) {
  useTrackModuleView('culegatori')

  const queryClient = useQueryClient()
  const router = useRouter()
  const todayIso = useTodayIso()

  const [tab, setTab] = useState<StatusTab>('activi')
  const [openId, setOpenId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Culegator | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState<'status' | 'sterge' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    data: culegatori = initialCulegatori,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
    initialData: initialCulegatori,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: recoltari = [] } = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const stats = useMemo(() => (todayIso ? buildCulegatorStats(recoltari, todayIso) : new Map()), [recoltari, todayIso])
  const summary = useMemo(() => culegatoriSummary(stats), [stats])
  const activi = useMemo(() => culegatoriByStatus(culegatori, true), [culegatori])
  const inactivi = useMemo(() => culegatoriByStatus(culegatori, false), [culegatori])
  const visible = tab === 'activi' ? activi : inactivi
  const parcelaNames = useMemo(
    () => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă fără nume'])),
    [parcele],
  )

  const opened = culegatori.find((culegator) => culegator.id === openId) ?? null
  // Culegătorul deschis a dispărut (șters): revenim la listă.
  if (openId !== null && opened === null) setOpenId(null)

  const openCreate = useCallback(() => {
    setEditing(null)
    setFormOpen(true)
  }, [])

  // „Primii pași” din Acasă: `/culegatori?nou=1` deschide direct „Culegător nou”.
  const searchParams = useSearchParams()
  const deschideNou = searchParams.get('nou') === '1'
  useEffect(() => {
    if (!deschideNou) return
    openCreate()
    router.replace('/culegatori')
  }, [deschideNou, openCreate, router])

  const openEdit = useCallback((culegator: Culegator) => {
    setEditing(culegator)
    setFormOpen(true)
  }, [])

  const toggleStatus = async (culegator: Culegator) => {
    if (busy) return
    setBusy('status')
    setActionError(null)
    try {
      const row = await updateCulegator(culegator.id, { status_activ: !culegator.status_activ })
      queryClient.setQueryData<Culegator[]>(queryKeys.culegatori, (previous) =>
        previous ? previous.map((item) => (item.id === row.id ? { ...item, ...row } : item)) : previous,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.culegatori })
      toast.success(row.status_activ ? `${row.nume_prenume}: din nou activ` : `${row.nume_prenume}: marcat inactiv`)
    } catch (cause) {
      setActionError(cause instanceof Error && cause.message ? cause.message : 'Nu s-a putut schimba.')
    } finally {
      setBusy(null)
    }
  }

  const confirmDelete = async () => {
    if (!opened || busy) return
    setBusy('sterge')
    setActionError(null)
    try {
      await deleteCulegator(opened.id)
      queryClient.setQueryData<Culegator[]>(queryKeys.culegatori, (previous) =>
        previous ? previous.filter((item) => item.id !== opened.id) : previous,
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.culegatori })
      toast.success('Culegător șters')
      setDeleteOpen(false)
      setOpenId(null)
    } catch (cause) {
      setActionError(cause instanceof Error && cause.message ? cause.message : 'Culegătorul nu s-a putut șterge.')
    } finally {
      setBusy(null)
    }
  }

  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={openCreate}>
      <Plus aria-hidden />
      Culegător nou
    </Button>
  )

  let body: React.ReactNode
  let bottomButton: React.ReactNode = null

  if (opened) {
    const own = statsOf(stats, opened.id)
    const phone = phoneForLinks(opened.telefon)
    const tarif = Number(opened.tarif_lei_kg)
    const addKgHref = `/recoltari?culegator=${opened.id}`

    bottomButton = opened.status_activ ? (
      <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => router.push(addKgHref)}>
        <Plus aria-hidden />
        Adaugă kg azi
      </Button>
    ) : null

    body = (
      <>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="neutral" size="touch" onClick={() => setOpenId(null)}>
            <ArrowLeft aria-hidden />
            Culegători
          </Button>
          <Button
            type="button"
            variant="neutral"
            size="icon-touch"
            aria-label={`Editează culegătorul ${opened.nume_prenume}`}
            onClick={() => openEdit(opened)}
          >
            <Pencil aria-hidden />
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className={cn('break-words font-extrabold text-fg', kitText.screen)}>{opened.nume_prenume}</h2>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone={opened.status_activ ? 'success' : 'neutral'}>{opened.status_activ ? 'Activ' : 'Inactiv'}</StatusPill>
            <StatusPill tone="neutral">{normalizeTipAngajare(opened.tip_angajare)}</StatusPill>
          </div>
        </div>

        {actionError && !deleteOpen ? (
          <Notice tone="danger" title="Nu s-a putut face">
            {actionError}
          </Notice>
        ) : null}

        {phone ? (
          <a href={`tel:${phone.tel}`} className={cn(buttonVariants({ variant: 'neutral', size: 'touch-lg' }), 'w-full')}>
            <Phone aria-hidden />
            Sună · {opened.telefon?.trim()}
          </a>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <StatTile value={Number.isFinite(tarif) ? formatNumber(tarif) : '—'} unit="lei/kg" label="tarif" />
          <StatTile value={formatNumber(own.kgSezon)} unit="kg" label="sezon" />
          <StatTile value={formatNumber(own.platitSezon)} unit="lei" label="plătit" />
        </div>

        <section aria-label="Ultimele zile" className="space-y-2">
          <h3 className={cn('px-1 font-extrabold text-fg', kitText.card)}>Ultimele zile</h3>
          {own.zile.length === 0 ? (
            <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Nicio recoltare notată în acest sezon.</p>
          ) : (
            <ul className="space-y-2">
              {own.zile.slice(0, 8).map((zi) => (
                <li
                  key={`${zi.data}-${zi.parcelaId ?? ''}`}
                  className="flex min-h-touch-lg items-center justify-between gap-3 rounded-box border border-border bg-surface px-4 py-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className={cn('font-bold text-fg', kitText.base)}>{capitalizeRo(weekdayDateRo(zi.data))}</span>
                    <span className={cn('truncate text-fg-muted', kitText.secondary)}>
                      {zi.parcelaId ? parcelaNames.get(zi.parcelaId) ?? 'Parcelă necunoscută' : 'Fără parcelă'}
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-extrabold text-fg', kitText.base)}>{formatKg(zi.kg)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {opened.observatii?.trim() ? (
          <section aria-label="Notă" className="space-y-1 px-1">
            <h3 className={cn('font-extrabold text-fg', kitText.card)}>Notă</h3>
            <p className={cn('whitespace-pre-line break-words text-fg', kitText.base)}>{opened.observatii.trim()}</p>
          </section>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {bottomButton ? <div className="hidden md:block">{bottomButton}</div> : null}
          <Button
            type="button"
            variant="neutral"
            size="touch"
            className="w-full"
            loading={busy === 'status'}
            onClick={() => void toggleStatus(opened)}
          >
            {opened.status_activ ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
            {opened.status_activ ? 'Marchează inactiv(ă)' : 'Marchează activ(ă)'}
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="touch"
            className="w-full text-danger-text"
            onClick={() => {
              setActionError(null)
              setDeleteOpen(true)
            }}
          >
            <Trash2 aria-hidden />
            Șterge culegătorul
          </Button>
        </div>
      </>
    )
  } else if (isError) {
    body = (
      <Notice
        tone="danger"
        title="Culegătorii nu s-au încărcat"
        action={
          <Button type="button" variant="neutral" size="touch" loading={isRefetching} onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        }
      >
        {(error as Error | null)?.message || 'Verifică internetul și încearcă din nou.'}
      </Notice>
    )
  } else if (culegatori.length === 0) {
    body = (
      <EmptyState
        icon={<Users />}
        title="Niciun culegător încă"
        description="Adaugă primul culegător ca să poți nota kilogramele culese."
        action={<div className="w-64 max-w-full">{addButton}</div>}
      />
    )
  } else {
    bottomButton = addButton
    body = (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            tone="inverse"
            value={formatNumber(summary.kgAzi)}
            unit="kg"
            label={`Azi · ${summary.culesAziCount} ${summary.culesAziCount === 1 ? 'a cules' : 'au cules'}`}
          />
          <StatTile value={formatNumber(summary.kgSezon)} unit="kg" label={`Sezon · plătit ${formatLei(summary.platitSezon)}`} />
        </div>

        <Segments<StatusTab>
          aria-label="Ce culegători arăt"
          panelId="culegatori-lista"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'activi', label: 'Activi', count: activi.length },
            { value: 'inactivi', label: 'Inactivi', count: inactivi.length },
          ]}
        />

        <div className="hidden md:block">{addButton}</div>

        <section id="culegatori-lista" role="tabpanel" aria-label={tab === 'activi' ? 'Activi' : 'Inactivi'}>
          {visible.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title={tab === 'activi' ? 'Niciun culegător activ' : 'Niciun culegător inactiv'}
              description={tab === 'activi' ? 'Adaugă unul sau reactivează unul din „Inactivi”.' : 'Aici ajung cei marcați inactivi.'}
            />
          ) : (
            <ul className="space-y-2">
              {visible.map((culegator) => {
                const own = statsOf(stats, culegator.id)
                const tarif = Number(culegator.tarif_lei_kg)
                return (
                  <li key={culegator.id}>
                    <ListRow
                      avatar={initialsOf(culegator.nume_prenume)}
                      title={culegator.nume_prenume}
                      detail={`${normalizeTipAngajare(culegator.tip_angajare)} · ${Number.isFinite(tarif) ? formatLeiKg(tarif) : 'fără tarif'}`}
                      onClick={() => {
                        setActionError(null)
                        setOpenId(culegator.id)
                      }}
                      chevron={false}
                      aria-label={`Deschide fișa: ${culegator.nume_prenume}, azi ${own.kgAzi > 0 ? formatKg(own.kgAzi) : 'nimic'}, sezon ${formatKg(own.kgSezon)}`}
                      trailing={
                        <span className="flex flex-col items-end">
                          <span className={cn('font-extrabold text-fg', kitText.base)}>{own.kgAzi > 0 ? formatKg(own.kgAzi) : '—'}</span>
                          <span className={cn('text-fg-muted', kitText.secondary)}>{formatKg(own.kgSezon)}</span>
                        </span>
                      }
                    />
                  </li>
                )
              })}
            </ul>
          )}
          {visible.length > 0 ? (
            <p className={cn('mt-2 px-1 text-fg-muted', kitText.helper)}>În dreapta: kilogramele de azi, iar dedesubt cele din sezon.</p>
          ) : null}
        </section>
      </>
    )
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Culegători"
          subtitle={todayIso ? capitalizeRo(longDayRo(todayIso)) : undefined}
          contentVariant="workspace"
        />
      }
      bottomBarFixed
      bottomBar={
        // Butonul mare ține locul butonului plutitor (+). Loc liber în stânga pentru bula „beta”.
        bottomButton ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box shadow-2">{bottomButton}</div>
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto w-full max-w-xl space-y-4 pt-3">{body}</div>

      <CulegatorStepForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      <BottomSheet open={deleteOpen} onOpenChange={setDeleteOpen} title="Ștergi culegătorul?" description={opened?.nume_prenume}>
        <div className="space-y-4">
          {actionError ? (
            <Notice tone="danger" title="Culegătorul nu s-a șters">
              {actionError}
            </Notice>
          ) : (
            <p className={cn('text-fg', kitText.base)}>
              Un culegător cu recoltări notate nu poate fi șters. Pentru cei care nu mai lucrează, folosește „Marchează
              inactiv(ă)”.
            </p>
          )}
          <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={busy === 'sterge'} onClick={() => void confirmDelete()}>
            Șterge culegătorul
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setDeleteOpen(false)}>
            Renunță
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  )
}
