'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ellipsis, Pencil, Plus, Scale, Shovel, SprayCan, Sprout, Thermometer, Trash2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { CulesSiAnalizaParcela } from '@/components/analize/CulesSiAnalizaParcela'
import {
  BigInput,
  BigTextarea,
  BottomSheet,
  Button,
  EmptyState,
  ListRow,
  Notice,
  Segments,
  StatTile,
  kitText,
} from '@/components/kit'
import { LucrareStepForm } from '@/components/lucrari/LucrareStepForm'
import { CulturaStepForm } from '@/components/parcele/CulturaStepForm'
import { MicroclimatStepForm } from '@/components/parcele/MicroclimatStepForm'
import { ParcelaStepForm } from '@/components/parcele/ParcelaStepForm'
import { CulturiSolar, MicroclimatSolar } from '@/components/parcele/SolarSectiuni'
import { StadiuStepForm } from '@/components/parcele/StadiuStepForm'
import { useParceleStare } from '@/components/parcele/useParceleStare'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { useAziRo } from '@/hooks/useAziRo'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { formatNumber } from '@/lib/format-ro'
import { textCine } from '@/lib/lucrari/formular'
import { antetParcela, esteParcelaPersonala } from '@/lib/parcele/card'
import { jurnalParcela, type TipIntrare } from '@/lib/parcele/jurnal-parcela'
import { sezonParcela } from '@/lib/parcele/sezon-parcela'
import { formatStadiuFenologicLabel, grupBiologicParcela } from '@/lib/parcele/stadiu-curent'
import { IntrebareStadiuParcela } from '@/components/plan/IntrebareStadiuParcela'
import { normalizeUnitateTip } from '@/lib/parcele/unitate'
import { queryKeys } from '@/lib/query-keys'
import { desfiinteazaCultura, getCulturiForSolar, type Cultura } from '@/lib/supabase/queries/culturi'
import { normalizeCohort } from '@/lib/supabase/queries/parcela-stadii'
import { deleteParcela } from '@/lib/supabase/queries/parcele'
import { getVolumeParcele } from '@/lib/supabase/queries/tratamente'
import { detaliuPauza } from '@/lib/tratamente/texte'
import { ziCuDataRo, zileIntre, ziRelativaRo } from '@/lib/tratamente/zile'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const ICON_INTRARE: Record<TipIntrare, React.ReactNode> = {
  recoltare: <Scale aria-hidden />,
  tratament: <SprayCan aria-hidden />,
  lucrare: <Shovel aria-hidden />,
  stadiu: <Sprout aria-hidden />,
}

function IconCerc({ tip }: { tip: TipIntrare }) {
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        tip === 'tratament' || tip === 'stadiu' ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-fg',
      )}
      aria-hidden
    >
      {ICON_INTRARE[tip]}
    </span>
  )
}

/** „Azi”, „Ieri”, altfel „18.11” (încape pe placă). */
function ziScurtaFisa(zi: string, azi: string): string {
  const zile = zileIntre(zi, azi)
  if (zile === 0) return 'Azi'
  if (zile === 1) return 'Ieri'
  return `${Number(zi.slice(8, 10))}.${zi.slice(5, 7)}`
}

function actualizat(ziua: string | null, azi: string): string {
  if (!ziua) return 'Notează stadiul de acum'
  const zile = zileIntre(ziua, azi)
  if (zile <= 0) return 'actualizat azi'
  if (zile === 1) return 'actualizat ieri'
  return `actualizat acum ${zile} zile`
}

function MenuIcon({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5', danger ? 'bg-danger-bg text-danger-text' : 'bg-surface-muted text-fg')}>
      {children}
    </span>
  )
}

/**
 * Fișa parcelei: antet, stadiul cu „Actualizează”, banda de pauză, file Jurnal (tot ce s-a întâmplat, pe zile)
 * și Sezon; jos „+ Lucrare” și „+ Tratament”. La solarii: culturile și microclimatul, pliate.
 * Meniul ⋯: Editează, Microclimat (solarii), Desființează cultura, Șterge parcela.
 */
export function ParcelaFisaClient({ parcelaId }: { parcelaId: string }) {
  useTrackModuleView('parcele')
  const router = useRouter()
  const queryClient = useQueryClient()
  const azi = useAziRo()
  const { memberRole, accessLevel } = useDashboardAuth()
  const esteOperator = memberRole === 'operator'
  const poateScrie = !esteOperator || accessLevel === 'write'
  const poateSterge = !esteOperator
  const vedeProprietarul = !esteOperator

  const stare = useParceleStare(azi)
  const parcela = stare.parcele.find((item) => item.id === parcelaId) ?? null
  const solar = normalizeUnitateTip(parcela?.tip_unitate) === 'solar'
  const volumeQuery = useQuery({ queryKey: queryKeys.volumeParcele, queryFn: getVolumeParcele, staleTime: 60_000, refetchOnWindowFocus: false })
  const culturiQuery = useQuery({
    queryKey: queryKeys.culturi(parcelaId),
    queryFn: () => getCulturiForSolar(parcelaId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: Boolean(parcela),
  })
  const culturiActive = (culturiQuery.data ?? []).filter((cultura) => cultura.activa !== false)

  const [fila, setFila] = useState<'jurnal' | 'sezon'>('jurnal')
  const [meniu, setMeniu] = useState(false)
  const [foaie, setFoaie] = useState<null | 'sterge' | 'desfiinteaza'>(null)
  const [form, setForm] = useState<null | 'editeaza' | 'stadiu' | 'lucrare' | 'cultura' | 'microclimat'>(null)
  const [cultura, setCultura] = useState<Cultura | null>(null)
  const [desfiintare, setDesfiintare] = useState({ zi: '', motiv: '' })
  const [busy, setBusy] = useState(false)
  const [eroareFoaie, setEroareFoaie] = useState<string | null>(null)

  const grup = parcela ? grupBiologicParcela(parcela) : null
  const stadiu = stare.stadiuPeParcela.get(parcelaId) ?? { text: null, ziua: null, mixt: false }
  const pauza = stare.pauze.get(parcelaId) ?? null
  const personala = parcela ? esteParcelaPersonala(parcela) : false

  const zile = useMemo(() => {
    if (!parcela) return []
    return jurnalParcela({
      parcelaId,
      recoltari: stare.recoltari,
      aplicari: stare.aplicari,
      activitati: stare.lucrari,
      stadii: stare.stadii,
      numeStadiu: (row) => {
        const cohort = normalizeCohort(row.cohort)
        const label = formatStadiuFenologicLabel(row, grup, cohort)
        if (!cohort || label.toLocaleLowerCase('ro-RO').includes(cohort)) return label
        return `${cohort === 'floricane' ? 'Floricane' : 'Primocane'}: ${label.toLocaleLowerCase('ro-RO')}`
      },
      textCine: (cine) => textCine(cine, vedeProprietarul),
      azi,
    })
  }, [azi, grup, parcela, parcelaId, stare.aplicari, stare.lucrari, stare.recoltari, stare.stadii, vedeProprietarul])

  const sezon = useMemo(
    () =>
      parcela && azi && stare.start
        ? sezonParcela({ parcela, recoltari: stare.recoltari, aplicari: stare.aplicari, activitati: stare.activitati, start: stare.start, azi })
        : null,
    [azi, parcela, stare.activitati, stare.aplicari, stare.recoltari, stare.start],
  )

  const coords = useMemo(() => {
    const lat = Number(parcela?.latitudine ?? parcela?.gps_lat)
    const lon = Number(parcela?.longitudine ?? parcela?.gps_lng)
    return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : null
  }, [parcela?.gps_lat, parcela?.gps_lng, parcela?.latitudine, parcela?.longitudine])

  // Un singur lucru deschis o dată: foaia se închide înainte să se deschidă un formular.
  const deschideForm = (next: NonNullable<typeof form>) => {
    setMeniu(false)
    window.setTimeout(() => setForm(next), 180)
  }
  const deschideFoaie = (next: NonNullable<typeof foaie>) => {
    setMeniu(false)
    setEroareFoaie(null)
    window.setTimeout(() => setFoaie(next), 180)
  }

  const alegeDesfiintare = (item: Cultura) => {
    setCultura(item)
    setDesfiintare({ zi: azi ?? '', motiv: '' })
    deschideFoaie('desfiinteaza')
  }

  const confirmaDesfiintare = async () => {
    if (!cultura || !desfiintare.zi || busy) return
    setBusy(true)
    setEroareFoaie(null)
    try {
      await desfiinteazaCultura(cultura.id, { data_desfiintare: desfiintare.zi, motiv_desfiintare: desfiintare.motiv.trim() || undefined })
      void queryClient.invalidateQueries({ queryKey: queryKeys.culturi(parcelaId) })
      void queryClient.invalidateQueries({ queryKey: ['culturi-counts'] })
      setFoaie(null)
      toast.success('Cultura a fost desființată. Istoricul ei rămâne.')
    } catch (error) {
      setEroareFoaie(error instanceof Error && error.message ? error.message : 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  const confirmaStergere = async () => {
    if (!parcela || busy) return
    setBusy(true)
    setEroareFoaie(null)
    try {
      await deleteParcela(parcela.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.parcele, exact: true })
      toast.success('Parcela a fost ștearsă.')
      router.replace('/parcele')
    } catch (error) {
      setEroareFoaie(error instanceof Error && error.message ? error.message : 'Parcela nu s-a șters. Încearcă din nou.')
    } finally {
      setBusy(false)
    }
  }

  const titlu = parcela?.nume_parcela?.trim() || 'Parcelă'

  const header = (
    <ScreenHeader
      title={stare.loading ? 'Parcelă' : titlu}
      backHref="/parcele"
      right={
        parcela && (poateScrie || poateSterge) ? (
          <Button type="button" variant="neutral" size="icon-touch" aria-label="Mai multe acțiuni: editează, desființează, șterge" onClick={() => setMeniu(true)}>
            <Ellipsis aria-hidden />
          </Button>
        ) : undefined
      }
    />
  )

  if (!stare.loading && !parcela) {
    return (
      <AppShell header={header}>
        <ScreenBody>
          <EmptyState
            icon={<Sprout />}
            title={stare.error ? 'Parcela nu s-a încărcat' : 'Parcela nu există'}
            description={stare.error ? 'Verifică internetul și deschide din nou pagina.' : 'Poate a fost ștearsă.'}
            action={
              <Button type="button" variant="neutral" size="touch" onClick={() => router.push('/parcele')}>
                Înapoi la parcele
              </Button>
            }
          />
        </ScreenBody>
      </AppShell>
    )
  }

  const bara =
    parcela && poateScrie ? (
      <div className="flex gap-2.5">
        <Button type="button" variant="neutral" size="touch-lg" className="flex-1" onClick={() => setForm('lucrare')}>
          <Plus aria-hidden />
          Lucrare
        </Button>
        <Button type="button" variant="primary" size="touch-lg" className="flex-1" onClick={() => router.push(`/tratamente?parcela=${encodeURIComponent(parcelaId)}`)}>
          <Plus aria-hidden />
          Tratament
        </Button>
      </div>
    ) : null

  return (
    <AppShell
      header={header}
      bottomBarFixed
      bottomBar={
        bara ? (
          <div className="mx-auto w-full max-w-md pl-18 pr-4">
            <div className="rounded-box bg-page shadow-2">{bara}</div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {!parcela || !azi ? (
          <div className="space-y-2" aria-busy="true" aria-label="Se încarcă parcela">
            <div className="h-6 w-2/3 animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[76px] animate-pulse rounded-box bg-surface-muted" />
            <div className="h-[220px] animate-pulse rounded-box bg-surface-muted" />
          </div>
        ) : (
          <>
            <p className={cn('-mt-2 text-fg-muted', kitText.secondary)}>
              {antetParcela(parcela)}
              {personala ? ' · Personal' : ''}
            </p>

            {bara ? <div className="hidden md:block">{bara}</div> : null}

            <div className="flex min-h-[68px] flex-wrap items-center gap-3 rounded-box border-2 border-border bg-surface px-4 py-2.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-text [&_svg]:size-5" aria-hidden>
                <Sprout />
              </span>
              <span className="flex min-w-[180px] flex-1 flex-col">
                <span className={cn('font-bold text-fg', kitText.base)}>{stadiu.text ?? 'Fără stadiu notat'}</span>
                <span className={cn('text-fg-muted', kitText.secondary)}>{actualizat(stadiu.ziua, azi)}</span>
              </span>
              {poateScrie ? (
                <Button type="button" variant="neutral" size="touch" className="w-full min-[420px]:w-auto" onClick={() => setForm('stadiu')}>
                  Actualizează
                </Button>
              ) : null}
            </div>

            {!personala ? <IntrebareStadiuParcela parcelaId={parcelaId} azi={azi} poateScrie={poateScrie} /> : null}

            {!personala ? <CulesSiAnalizaParcela parcelaId={parcelaId} azi={azi} poateScrie={poateScrie} proprietar={vedeProprietarul} /> : null}

            {pauza ? (
              <Notice tone="warning" title={`Pauză până ${ziCuDataRo(pauza.panaLa)}`}>
                {`${detaliuPauza(pauza, azi)} Recoltările de azi doar cu motiv.`}
              </Notice>
            ) : null}

            {solar ? (
              <>
                <CulturiSolar parcelaId={parcelaId} poateScrie={poateScrie} onAdauga={() => setForm('cultura')} onDesfiinteaza={alegeDesfiintare} />
                <MicroclimatSolar parcelaId={parcelaId} tipUnitate={parcela.tip_unitate} coords={coords} poateScrie={poateScrie} onAdauga={() => setForm('microclimat')} />
              </>
            ) : null}

            <Segments
              aria-label="Ce arăt"
              options={[
                { value: 'jurnal', label: 'Jurnal' },
                { value: 'sezon', label: 'Sezon' },
              ]}
              value={fila}
              onValueChange={setFila}
            />

            {fila === 'jurnal' ? (
              stare.detaliiLoading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Se încarcă jurnalul">
                  <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
                  <div className="h-[68px] animate-pulse rounded-box bg-surface-muted" />
                </div>
              ) : zile.length > 0 ? (
                <ul className="space-y-2">
                  {zile.map((zi) => (
                    <li key={zi.zi} className="space-y-2">
                      <h3 className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>{ziRelativaRo(zi.zi, azi)}</h3>
                      <ul className="space-y-2">
                        {zi.intrari.map((intrare) => (
                          <li key={intrare.key}>
                            <ListRow avatar={false} leading={<IconCerc tip={intrare.tip} />} title={intrare.titlu} detail={intrare.detaliu ?? undefined} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<Shovel />} title="Nimic notat încă" description="Recoltările, tratamentele, lucrările și stadiile parcelei apar aici, pe zile." />
              )
            ) : sezon ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <StatTile label={personala ? 'Recoltat (personal)' : 'Recoltat'} value={formatNumber(sezon.kg, 0)} unit="kg" />
                  <StatTile label="Pe plantă" value={sezon.kgPePlanta !== null ? formatNumber(sezon.kgPePlanta, 1) : '—'} unit={sezon.kgPePlanta !== null ? 'kg' : undefined} />
                  <StatTile label={`Tratamente în ${azi.slice(0, 4)}`} value={String(sezon.tratamente)} />
                  <StatTile label="Ultima fertirigare" value={sezon.ultimaFertirigare ? ziScurtaFisa(sezon.ultimaFertirigare, azi) : '—'} />
                </div>
                <p className={cn('px-1 text-fg-muted', kitText.helper)}>
                  {stare.start ? `Sezonul de la ${ziCuDataRo(stare.start)} (prima recoltare din an).` : null}
                </p>
              </div>
            ) : null}
          </>
        )}
      </ScreenBody>

      {/* Meniul ⋯ */}
      <BottomSheet open={meniu} onOpenChange={setMeniu} title={titlu}>
        <ul className="space-y-2">
          {poateScrie ? (
            <li>
              <ListRow avatar={false} leading={<MenuIcon><Pencil aria-hidden /></MenuIcon>} title="Editează" detail="Nume, cultură, plante, suprafață, volum" onClick={() => deschideForm('editeaza')} />
            </li>
          ) : null}
          {solar && poateScrie ? (
            <li>
              <ListRow avatar={false} leading={<MenuIcon><Thermometer aria-hidden /></MenuIcon>} title="Microclimat" detail="Temperatura și umiditatea de acum" onClick={() => deschideForm('microclimat')} />
            </li>
          ) : null}
          {poateScrie && culturiActive.length > 0 ? (
            culturiActive.map((item) => (
              <li key={item.id}>
                <ListRow
                  avatar={false}
                  leading={<MenuIcon danger><XCircle aria-hidden /></MenuIcon>}
                  title="Desființează cultura"
                  detail={[item.tip_planta, item.soi].filter(Boolean).join(' · ')}
                  onClick={() => alegeDesfiintare(item)}
                />
              </li>
            ))
          ) : null}
          {poateSterge ? (
            <li>
              <ListRow avatar={false} leading={<MenuIcon danger><Trash2 aria-hidden /></MenuIcon>} title="Șterge parcela" onClick={() => deschideFoaie('sterge')} />
            </li>
          ) : null}
        </ul>
      </BottomSheet>

      {/* Ștergerea parcelei */}
      <BottomSheet open={foaie === 'sterge'} onOpenChange={(open) => setFoaie(open ? 'sterge' : null)} title="Ștergi parcela?" description={titlu}>
        <div className="space-y-4">
          {eroareFoaie ? (
            <Notice tone="danger" title="Parcela nu s-a șters">
              {eroareFoaie}
            </Notice>
          ) : (
            <p className={cn('text-fg', kitText.base)}>O parcelă cu recoltări sau lucrări nu se poate șterge: istoricul ei rămâne. Poți s-o treci pe „Inactiv” din Editează.</p>
          )}
          <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={busy} onClick={() => void confirmaStergere()}>
            Șterge parcela
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setFoaie(null)}>
            Renunță
          </Button>
        </div>
      </BottomSheet>

      {/* Desființarea unei culturi */}
      <BottomSheet
        open={foaie === 'desfiinteaza'}
        onOpenChange={(open) => setFoaie(open ? 'desfiinteaza' : null)}
        title="Desființezi cultura?"
        description={cultura ? [cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ') : undefined}
      >
        <div className="space-y-4">
          {eroareFoaie ? (
            <Notice tone="danger" title="Nu s-a salvat">
              {eroareFoaie}
            </Notice>
          ) : (
            <p className={cn('text-fg', kitText.base)}>Cultura trece pe inactivă, nu se șterge. Recoltările, lucrările și stadiile ei rămân.</p>
          )}
          <BigInput label="Data desființării" type="date" value={desfiintare.zi} max={azi ?? undefined} onChange={(event) => setDesfiintare((previous) => ({ ...previous, zi: event.target.value }))} />
          <BigTextarea label="Motiv (opțional)" value={desfiintare.motiv} onChange={(event) => setDesfiintare((previous) => ({ ...previous, motiv: event.target.value }))} rows={2} placeholder="ex. boală, îngheț, rotație" maxLength={300} />
          <Button type="button" variant="danger" size="touch-lg" className="w-full" loading={busy} disabled={!desfiintare.zi} onClick={() => void confirmaDesfiintare()}>
            Desființează
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setFoaie(null)}>
            Renunță
          </Button>
        </div>
      </BottomSheet>

      {parcela ? (
        <ParcelaStepForm
          open={form === 'editeaza'}
          onOpenChange={(open) => setForm(open ? 'editeaza' : null)}
          editing={{ ...parcela, volum_solutie_l: volumeQuery.data?.[parcela.id] ?? null }}
        />
      ) : null}
      {parcela && azi ? (
        <>
          <StadiuStepForm
            open={form === 'stadiu'}
            onOpenChange={(open) => setForm(open ? 'stadiu' : null)}
            parcelaId={parcela.id}
            parcelaNume={titlu}
            grup={grup}
            mixt={stadiu.mixt}
            an={stare.an}
            todayIso={azi}
          />
          <LucrareStepForm
            open={form === 'lucrare'}
            onOpenChange={(open) => setForm(open ? 'lucrare' : null)}
            parcele={stare.parcele}
            todayIso={azi}
            precompletare={{ parcelaIds: [parcela.id] }}
          />
        </>
      ) : null}
      {parcela && solar ? (
        <>
          <CulturaStepForm open={form === 'cultura'} onOpenChange={(open) => setForm(open ? 'cultura' : null)} parcelaId={parcela.id} parcelaNume={titlu} tipUnitate={parcela.tip_unitate} />
          <MicroclimatStepForm open={form === 'microclimat'} onOpenChange={(open) => setForm(open ? 'microclimat' : null)} parcelaId={parcela.id} parcelaNume={titlu} tipUnitate={parcela.tip_unitate} />
        </>
      ) : null}
    </AppShell>
  )
}
