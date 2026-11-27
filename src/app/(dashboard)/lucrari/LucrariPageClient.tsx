'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Ellipsis, Pencil, Plus, Shovel, Trash2 } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import {
  BottomSheet,
  Button,
  EmptyState,
  ListRow,
  Notice,
  Segments,
  StatusPill,
  SummaryList,
  SummaryRow,
  kitFocus,
  kitText,
} from '@/components/kit'
import { LucrareStepForm, type PrecompletareLucrare } from '@/components/lucrari/LucrareStepForm'
import { TipLucrareIcon } from '@/components/lucrari/TipLucrareIcon'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { textCine } from '@/lib/lucrari/formular'
import { construiesteJurnalLucrari, type RandLucrare } from '@/lib/lucrari/jurnal'
import { ETICHETA_LUCRARE, tipLucrareDin, titluLucrare } from '@/lib/lucrari/tipuri'
import { queryKeys } from '@/lib/query-keys'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { getLucrari, marcheazaLucrariFacute, stergeLucrare } from '@/lib/supabase/queries/lucrari'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { textParcele } from '@/lib/tratamente/jurnal'
import { ZiCuDataRo, ziRelativaRo } from '@/lib/tratamente/zile'
import { useAziRo } from '@/hooks/useAziRo'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

/** Parametrii trimiși de chatul AI (și păstrați de redirecționarea din `/activitati-agricole`). */
const PARAMETRI_AI = ['openForm', 'tip', 'parcela', 'parcela_id', 'parcela_label', 'produs', 'doza', 'data', 'observatii', 'edit'] as const

function eroareScriere(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : ''
  const code = (error as { code?: string } | null)?.code
  if (code === '42501' || /row-level security|42501/i.test(message)) return message.startsWith('Doar') ? message : 'Nu ai drept de scriere pe lucrări.'
  return message || fallback
}

export function LucrariPageClient() {
  useTrackModuleView('activitati')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { memberRole } = useDashboardAuth()
  const vedeProprietarul = memberRole !== 'operator'

  const azi = useAziRo()
  const [fila, setFila] = useState<'facute' | 'planificate'>(() => (searchParams.get('fila') === 'planificate' ? 'planificate' : 'facute'))
  const [deschis, setDeschis] = useState<RandLucrare | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetVedere, setSheetVedere] = useState<'detalii' | 'meniu' | 'sterge'>('detalii')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RandLucrare | null>(null)
  const [precompletare, setPrecompletare] = useState<PrecompletareLucrare | null>(null)
  const [busy, setBusy] = useState<'facut' | 'sterge' | null>(null)

  const lucrariQuery = useQuery({ queryKey: queryKeys.lucrari, queryFn: getLucrari, staleTime: 30_000, refetchOnWindowFocus: false })
  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, staleTime: 30_000, refetchOnWindowFocus: false })

  const parcele = useMemo(() => parceleQuery.data ?? [], [parceleQuery.data])
  const numeParcele = useMemo(() => new Map(parcele.map((parcela) => [parcela.id, parcela.nume_parcela?.trim() || 'Parcelă'])), [parcele])
  const jurnal = useMemo(() => construiesteJurnalLucrari(lucrariQuery.data ?? [], azi), [azi, lucrariQuery.data])
  const lista = fila === 'facute' ? jurnal.facute : jurnal.planificate

  // ─── Precompletarea din chatul AI (`?openForm=1&tip=…&parcela_id=…`) sau editarea (`?edit=<id>`) ───
  const [aiTratat, setAiTratat] = useState<string | null>(null)
  const semnaturaAi = PARAMETRI_AI.map((key) => `${key}=${searchParams.get(key) ?? ''}`).join('&')
  const areAi = searchParams.get('openForm') === '1' || Boolean(searchParams.get('edit'))
  useEffect(() => {
    if (!areAi || !azi || aiTratat === semnaturaAi) return
    if (parceleQuery.isLoading || lucrariQuery.isLoading) return
    const editId = searchParams.get('edit')
    const curataUrl = () => {
      const next = new URLSearchParams(searchParams.toString())
      for (const key of PARAMETRI_AI) next.delete(key)
      const query = next.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }
    queueMicrotask(() => {
      setAiTratat(semnaturaAi)
      if (editId) {
        const rand = [...jurnal.facute, ...jurnal.planificate].find((item) => item.randuri.some((row) => row.id === editId))
        if (rand) {
          setPrecompletare(null)
          setEditing(rand)
          setFormOpen(true)
        }
        curataUrl()
        return
      }
      const tipText = searchParams.get('tip')?.trim() ?? ''
      const tip = tipText ? tipLucrareDin(tipText) : null
      if (tipText && tip === null) {
        toast.info('Stropirile și fertirigarea se notează acum în Tratamente.')
        curataUrl()
        router.push('/tratamente')
        return
      }
      const parcelaId = searchParams.get('parcela_id')?.trim() ?? ''
      const eticheta = (searchParams.get('parcela_label') ?? searchParams.get('parcela') ?? '').trim().toLocaleLowerCase('ro-RO')
      const parcela =
        parcele.find((item) => item.id === parcelaId) ??
        (eticheta ? parcele.find((item) => (item.nume_parcela ?? '').trim().toLocaleLowerCase('ro-RO') === eticheta) : undefined)
      const data = (searchParams.get('data') ?? '').trim().slice(0, 10)
      const nota = [searchParams.get('observatii'), searchParams.get('produs'), searchParams.get('doza')]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(' · ')
      setEditing(null)
      setPrecompletare({
        tip,
        parcelaIds: parcela ? [parcela.id] : [],
        nota,
        zi: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null,
      })
      setFormOpen(true)
      curataUrl()
    })
  }, [aiTratat, areAi, azi, jurnal, lucrariQuery.isLoading, parcele, parceleQuery.isLoading, pathname, router, searchParams, semnaturaAi])

  const deschideFormular = (rand: RandLucrare | null) => {
    setEditing(rand)
    setPrecompletare(null)
    setFormOpen(true)
  }

  const deschideDetalii = (rand: RandLucrare) => {
    setDeschis(rand)
    setSheetVedere('detalii')
    setSheetOpen(true)
  }

  const marcheaza = async (rand: RandLucrare) => {
    if (busy) return
    setBusy('facut')
    try {
      await marcheazaLucrariFacute(rand.randuri.map((row) => row.id))
      await queryClient.invalidateQueries({ queryKey: queryKeys.lucrari })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      setSheetOpen(false)
      toast.success('Notată ca făcută azi.')
    } catch (error) {
      toast.error(eroareScriere(error, 'Nu s-a salvat. Încearcă din nou.'))
    } finally {
      setBusy(null)
    }
  }

  const sterge = async (rand: RandLucrare) => {
    if (busy) return
    setBusy('sterge')
    try {
      await stergeLucrare(rand.randuri.map((row) => row.id))
      await queryClient.invalidateQueries({ queryKey: queryKeys.lucrari })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      setSheetOpen(false)
      toast.success('Lucrarea a fost ștearsă.')
    } catch (error) {
      toast.error(eroareScriere(error, 'Lucrarea nu s-a șters. Încearcă din nou.'))
    } finally {
      setBusy(null)
    }
  }

  // Rândurile, cu ziua deasupra când se schimbă.
  let ziAnterioara: string | null | undefined
  const randuri = lista.map((rand) => {
    const antet = rand.zi !== ziAnterioara ? (rand.zi ? ziRelativaRo(rand.zi, azi ?? rand.zi) : 'Fără dată') : null
    ziAnterioara = rand.zi
    const cine = textCine(rand.cine, vedeProprietarul)
    const intarziata = rand.stare === 'planificata' && azi !== null && rand.zi !== null && rand.zi < azi
    return (
      <li key={rand.key} className="space-y-2">
        {antet ? <h3 className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>{antet}</h3> : null}
        <ListRow
          avatar={false}
          leading={<TipLucrareIcon tip={rand.tip} />}
          title={rand.ceAiFacut ? rand.ceAiFacut : rand.tipOriginal ? `${ETICHETA_LUCRARE[rand.tip]} · ${rand.tipOriginal}` : ETICHETA_LUCRARE[rand.tip]}
          detail={
            <span className="flex flex-col gap-1.5">
              <span>{[textParcele(rand.parcelaIds, numeParcele, parcele.length), cine].filter(Boolean).join(' · ')}</span>
              {rand.nota ? <span className="line-clamp-2 text-fg-muted">{rand.nota}</span> : null}
              {intarziata ? (
                <span className="flex flex-wrap gap-1.5">
                  <StatusPill tone="warning">Planificată, întârziată</StatusPill>
                </span>
              ) : null}
            </span>
          }
          onClick={() => deschideDetalii(rand)}
        />
      </li>
    )
  })

  const addButton = (
    <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => deschideFormular(null)}>
      <Plus aria-hidden />
      Lucrare
    </Button>
  )
  const loadingAll = lucrariQuery.isLoading || parceleQuery.isLoading || !azi
  const eroare = lucrariQuery.isError

  const sheetTitle = deschis ? `${titluLucrare(deschis)}${deschis.zi ? ` · ${ZiCuDataRo(deschis.zi)}` : ''}` : 'Lucrare'

  return (
    <AppShell
      header={<ScreenHeader title="Lucrări" backHref="/mai-mult" />}
      bottomBarFixed
      bottomBar={
        !loadingAll ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="rounded-box shadow-2">{addButton}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {/* Pe desktop bara de jos nu există: butonul stă în pagină. */}
        <div className="hidden md:block">{addButton}</div>

        <Segments
          aria-label="Ce lucrări arăt"
          options={[
            { value: 'facute', label: 'Făcute' },
            { value: 'planificate', label: 'Planificate', count: jurnal.planificate.length > 0 ? jurnal.planificate.length : undefined },
          ]}
          value={fila}
          onValueChange={setFila}
        />

        <Link
          href="/tratamente"
          className={cn(
            'flex min-h-touch items-center gap-3 rounded-box border border-info-border bg-info-bg px-4 py-3 font-semibold text-info-text',
            kitText.secondary,
            kitFocus,
          )}
        >
          <span className="min-w-0 flex-1">Stropirile și fertirigarea sunt acum în Tratamente</span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>

        {eroare ? (
          <Notice tone="danger" title="Lucrările nu s-au încărcat">
            Verifică internetul și deschide din nou pagina.
          </Notice>
        ) : null}

        {loadingAll ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă lucrările">
            <div className="h-[76px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[76px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[76px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : lista.length > 0 ? (
          <ul className="space-y-2">{randuri}</ul>
        ) : (
          <EmptyState
            icon={<Shovel />}
            title={fila === 'facute' ? 'Nicio lucrare notată' : 'Nimic planificat'}
            description={
              fila === 'facute'
                ? 'Notează tăierile, palisarea, prășitul sau irigația: apar și în fișa fiecărei parcele.'
                : 'Planifică o lucrare pe o zi: apare în Acasă la „De făcut azi”.'
            }
          />
        )}
      </ScreenBody>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={sheetVedere === 'sterge' ? 'Ștergi lucrarea?' : sheetTitle}
        footer={
          deschis && sheetVedere === 'detalii' && deschis.stare === 'planificata' ? (
            <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={busy === 'facut'} onClick={() => void marcheaza(deschis)}>
              Marchează făcut
            </Button>
          ) : null
        }
      >
        {deschis ? (
          sheetVedere === 'sterge' ? (
            <div className="space-y-4">
              <p className={cn('text-fg', kitText.base)}>
                {titluLucrare(deschis)} · {textParcele(deschis.parcelaIds, numeParcele)}. Se șterge de pe toate parcelele ei.
              </p>
              <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={busy === 'sterge'} onClick={() => void sterge(deschis)}>
                Șterge lucrarea
              </Button>
              <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setSheetVedere('detalii')}>
                Renunță
              </Button>
            </div>
          ) : sheetVedere === 'meniu' ? (
            <ul className="space-y-2">
              <li>
                <ListRow
                  avatar={false}
                  leading={<MenuIcon><Pencil aria-hidden /></MenuIcon>}
                  title="Editează"
                  detail="Lucrarea, parcelele, ziua, cine, nota"
                  onClick={() => {
                    // Foaia se închide înainte să se deschidă formularul (nimic peste un formular pe pași).
                    setSheetOpen(false)
                    window.setTimeout(() => deschideFormular(deschis), 180)
                  }}
                />
              </li>
              {vedeProprietarul ? (
                <li>
                  <ListRow
                    avatar={false}
                    leading={<MenuIcon danger><Trash2 aria-hidden /></MenuIcon>}
                    title="Șterge lucrarea"
                    onClick={() => setSheetVedere('sterge')}
                  />
                </li>
              ) : null}
              <li>
                <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setSheetVedere('detalii')}>
                  Înapoi
                </Button>
              </li>
            </ul>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button type="button" variant="neutral" size="icon-touch" aria-label="Mai multe acțiuni: editează, șterge" onClick={() => setSheetVedere('meniu')}>
                  <Ellipsis aria-hidden />
                </Button>
              </div>
              <SummaryList>
                <SummaryRow label="Unde" value={<span className="block whitespace-normal">{textParcele(deschis.parcelaIds, numeParcele)}</span>} />
                <SummaryRow label={deschis.stare === 'planificata' ? 'Planificată' : 'Când'} value={deschis.zi ? ZiCuDataRo(deschis.zi) : 'Fără dată'} />
                <SummaryRow label="Cine" value={textCine(deschis.cine, vedeProprietarul) ?? '—'} />
                {deschis.tipOriginal ? <SummaryRow label="Notată ca" value={deschis.tipOriginal} /> : null}
                {deschis.nota ? <SummaryRow label="Notă" value={<span className="block whitespace-normal">{deschis.nota}</span>} /> : null}
              </SummaryList>
            </div>
          )
        ) : null}
      </BottomSheet>

      {azi ? (
        <LucrareStepForm
          open={formOpen}
          onOpenChange={setFormOpen}
          parcele={parcele}
          todayIso={azi}
          editing={editing}
          precompletare={precompletare}
        />
      ) : null}
    </AppShell>
  )
}

function MenuIcon({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        danger ? 'bg-danger-bg text-danger-text' : 'bg-surface-muted text-fg',
      )}
    >
      {children}
    </span>
  )
}
