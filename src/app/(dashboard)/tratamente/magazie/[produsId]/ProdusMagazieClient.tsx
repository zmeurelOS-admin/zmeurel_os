'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Minus, Plus, Equal, TriangleAlert } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { BigInput, BottomSheet, Button, EmptyState, ListRow, Notice, StatHero, kitText } from '@/components/kit'
import { AmCumparatStepForm } from '@/components/magazie/AmCumparatStepForm'
import { AmNumaratStepForm } from '@/components/magazie/AmNumaratStepForm'
import { MagazieIndisponibila } from '@/components/magazie/RandMagazie'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'
import { accessLevelForModule } from '@/lib/farm-members/access'
import { formatLei } from '@/lib/format-ro'
import { pretPeUnitate, textPretPeUnitate } from '@/lib/magazie/bani'
import { textAplicariRamase } from '@/lib/magazie/stoc'
import { formatCantitateStoc } from '@/lib/magazie/unitati'
import { queryKeys } from '@/lib/query-keys'
import { getMagazieStoc, getMiscariProdus, MagazieIndisponibilaError, schimbaPrag, type MiscareProdus } from '@/lib/supabase/queries/magazie'
import { getProduseFitosanitare } from '@/lib/supabase/queries/tratamente'
import { ETICHETA_TIP, tipDinAplicare } from '@/lib/tratamente/model'
import { aziRo, ziCuDataRo } from '@/lib/tratamente/zile'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const ICON_SEMN = {
  intrare: <Plus aria-hidden />,
  iesire_tratament: <Minus aria-hidden />,
  corectie: <Equal aria-hidden />,
  nescazut: <TriangleAlert aria-hidden />,
} as const

function Semn({ tip }: { tip: MiscareProdus['tip'] }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        tip === 'intrare' && 'bg-primary-soft text-primary',
        tip === 'iesire_tratament' && 'bg-info-bg text-info-text',
        tip === 'corectie' && 'bg-surface-muted text-fg',
        tip === 'nescazut' && 'bg-warning-bg text-warning-text',
      )}
    >
      {ICON_SEMN[tip]}
    </span>
  )
}

const metoda = (value: string | null) => ETICHETA_TIP[tipDinAplicare({ metoda_aplicare: value, produs: null, produse: [] })].toLocaleLowerCase('ro-RO')

/** Fișa produsului: cantitatea mare, pragul „pe terminate” (cu „Schimbă”) și mișcările. Prețurile doar pentru proprietar. */
export function ProdusMagazieClient({ produsId }: { produsId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { memberRole, memberAccess } = useDashboardAuth()
  const esteProprietar = memberRole !== 'operator'
  const poateScrie = esteProprietar || accessLevelForModule(memberAccess, 'tratamente') === 'write'
  const [azi] = useState(() => aziRo())
  const [cumparatOpen, setCumparatOpen] = useState(false)
  const [numaratOpen, setNumaratOpen] = useState(false)
  const [pragOpen, setPragOpen] = useState(false)
  const [pragText, setPragText] = useState('')
  const [pragSaving, setPragSaving] = useState(false)

  const stocQuery = useQuery({ queryKey: queryKeys.magazieStoc, queryFn: getMagazieStoc, staleTime: 30_000, retry: (n, error) => !(error instanceof MagazieIndisponibilaError) && n < 1 })
  const miscariQuery = useQuery({
    queryKey: queryKeys.magazieProdus(produsId),
    queryFn: () => getMiscariProdus(produsId),
    enabled: Boolean(produsId),
    staleTime: 30_000,
    retry: (n, error) => !(error instanceof MagazieIndisponibilaError) && n < 1,
  })
  const catalogQuery = useQuery({ queryKey: queryKeys.produseFitosanitare, queryFn: getProduseFitosanitare, staleTime: 5 * 60_000 })
  const stoc = useMemo(() => stocQuery.data ?? [], [stocQuery.data])
  const rand = stoc.find((item) => item.produs_id === produsId) ?? null
  const indisponibila = stocQuery.error instanceof MagazieIndisponibilaError
  const nume = rand?.nume ?? catalogQuery.data?.find((produs) => produs.id === produsId)?.nume_comercial ?? 'Produs'

  const deschidePrag = () => {
    setPragText(rand?.prag !== null && rand?.prag !== undefined ? String(rand.prag).replace('.', ',') : '')
    setPragOpen(true)
  }

  const salveazaPrag = async (valoare: number | null) => {
    setPragSaving(true)
    try {
      await schimbaPrag(produsId, valoare)
      await queryClient.invalidateQueries({ queryKey: queryKeys.magazie })
      setPragOpen(false)
      toast.success(valoare === null ? 'Pragul e din nou cel implicit.' : 'Pragul s-a salvat.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Pragul nu s-a salvat.')
    } finally {
      setPragSaving(false)
    }
  }

  const pragNumar = Number(pragText.replace(',', '.'))
  const pragValid = pragText.trim() === '' || (Number.isFinite(pragNumar) && pragNumar >= 0)

  const randMiscare = (miscare: MiscareProdus) => {
    const unitate = rand?.unitate ?? null
    const zi = miscare.data ? ziCuDataRo(miscare.data) : ''
    let titlu: string
    let detaliu: string
    if (miscare.tip === 'intrare') {
      titlu = formatCantitateStoc(miscare.cantitate ?? 0, unitate, true)
      const pret = esteProprietar ? pretPeUnitate(miscare.pret_total_lei, miscare.cantitate) : null
      detaliu = [`cumpărat ${zi}`, miscare.furnizor, pret !== null && unitate ? textPretPeUnitate(pret, unitate as 'kg') : null, esteProprietar && miscare.cheltuiala_id ? 'la cheltuieli' : null]
        .filter(Boolean)
        .join(' · ')
    } else if (miscare.tip === 'iesire_tratament') {
      titlu = formatCantitateStoc(miscare.cantitate ?? 0, unitate, true)
      detaliu = [`${metoda(miscare.metoda_aplicare)} ${zi}`, miscare.parcela_nume].filter(Boolean).join(' · ')
    } else if (miscare.tip === 'corectie') {
      titlu = `corecție ${formatCantitateStoc(miscare.cantitate ?? 0, unitate, true)}`
      detaliu = [`„${miscare.nota || 'Am numărat'}”`, zi].join(' · ')
    } else {
      titlu = 'nu s-a putut scădea'
      detaliu = [`${metoda(miscare.metoda_aplicare)} ${zi}`, miscare.parcela_nume, miscare.cantitate_aplicare ? `aplicat ${miscare.cantitate_aplicare.replace('_', ' ')}` : 'fără cantitate'].filter(Boolean).join(' · ')
    }
    const laTratament = (miscare.tip === 'iesire_tratament' || miscare.tip === 'nescazut') && miscare.aplicare_id
    return (
      <li key={`${miscare.tip}-${miscare.id}`}>
        <ListRow
          avatar={false}
          leading={<Semn tip={miscare.tip} />}
          title={titlu}
          detail={detaliu}
          chevron={Boolean(laTratament)}
          onClick={laTratament ? () => router.push(`/tratamente?aplicare=${miscare.aplicare_id}`) : undefined}
        />
      </li>
    )
  }

  const miscari = miscariQuery.data ?? []
  const ajunge = rand ? textAplicariRamase(rand.aplicari_ramase) : null

  return (
    <AppShell
      header={<ScreenHeader title={nume} backHref="/tratamente/magazie" />}
      bottomBarFixed
      bottomBar={
        poateScrie && !indisponibila && !stocQuery.isLoading ? (
          <div className="mx-auto w-full max-w-md px-4">
            <div className="grid grid-cols-2 gap-2.5 rounded-box bg-surface shadow-2">
              <Button type="button" variant="primary" size="touch-lg" onClick={() => setCumparatOpen(true)}>
                <Plus aria-hidden />
                Am cumpărat
              </Button>
              <Button type="button" variant="neutral" size="touch-lg" onClick={() => setNumaratOpen(true)}>
                <ClipboardCheck aria-hidden />
                Am numărat
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <ScreenBody className="space-y-3.5 pb-28">
        {indisponibila ? <MagazieIndisponibila /> : null}

        {!indisponibila && stocQuery.isLoading ? <div className="h-36 animate-pulse rounded-card bg-surface-muted" aria-busy="true" aria-label="Se încarcă produsul" /> : null}

        {!indisponibila && !stocQuery.isLoading && !rand ? (
          <EmptyState title="Produsul nu e în magazie" description="Notează o cumpărătură sau o numărătoare ca să pornească stocul lui." />
        ) : null}

        {rand ? (
          <>
            <StatHero
              label="În magazie"
              value={formatCantitateStoc(rand.stoc, null)}
              unit={rand.unitate}
              footer={
                <div className="flex flex-col gap-1">
                  {ajunge ? <p className={cn('font-semibold opacity-85', kitText.secondary)}>{ajunge}</p> : null}
                  {esteProprietar && rand.valoare !== null && rand.pret_mediu !== null ? (
                    <p className={cn('font-semibold opacity-85', kitText.secondary)}>
                      {formatLei(rand.valoare)} · preț mediu {textPretPeUnitate(rand.pret_mediu, rand.unitate)}
                    </p>
                  ) : null}
                </div>
              }
            />
            {rand.stoc < 0 ? (
              <Notice tone="danger" title="Stocul e negativ">
                Tratamentele au cerut mai mult decât era notat. Trece cumpărătura sau numără ce ai.
              </Notice>
            ) : rand.pe_terminate ? (
              <Notice tone="warning" title="Pe terminate" />
            ) : null}

            <div className="flex min-h-touch items-center justify-between gap-3 rounded-box border border-border bg-surface px-3.5 py-2">
              <p className={cn('text-fg', kitText.base)}>
                Prag „pe terminate”:{' '}
                <span className="font-bold">
                  {rand.prag !== null ? formatCantitateStoc(rand.prag, rand.unitate) : rand.doza_ultima ? `implicit, ${formatCantitateStoc(rand.doza_ultima, rand.unitate)}` : 'implicit'}
                </span>
              </p>
              {poateScrie ? (
                <Button type="button" variant="quiet" size="touch" onClick={deschidePrag}>
                  Schimbă
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {!indisponibila ? (
          <section className="space-y-2" aria-labelledby="miscari-titlu">
            <h2 id="miscari-titlu" className={cn('px-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>
              Mișcări
            </h2>
            {miscariQuery.isLoading ? (
              <div className="h-[72px] animate-pulse rounded-box bg-surface-muted" />
            ) : miscari.length > 0 ? (
              <ul className="space-y-2">{miscari.map(randMiscare)}</ul>
            ) : (
              <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Nicio mișcare încă.</p>
            )}
            <p className={cn('px-1 text-fg-muted', kitText.helper)}>
              Fiecare ieșire duce la tratamentul ei.{esteProprietar ? ' Prețurile le vezi doar tu.' : ''}
            </p>
          </section>
        ) : null}
      </ScreenBody>

      <BottomSheet
        open={pragOpen}
        onOpenChange={setPragOpen}
        title="Prag „pe terminate”"
        description="Sub cantitatea asta, produsul apare „pe terminate” în Magazie și luni dimineața, în notificări."
        footer={
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              variant="primary"
              size="touch-lg"
              className="w-full"
              loading={pragSaving}
              disabled={!pragValid}
              onClick={() => void salveazaPrag(pragText.trim() === '' ? null : pragNumar)}
            >
              Salvează pragul
            </Button>
            <Button type="button" variant="quiet" size="touch" className="w-full" disabled={pragSaving} onClick={() => void salveazaPrag(null)}>
              Implicit: cât pentru încă o aplicare
            </Button>
          </div>
        }
      >
        <BigInput
          label={`Pragul, în ${rand?.unitate ?? 'unitatea produsului'}`}
          inputMode="decimal"
          value={pragText}
          onChange={(event) => setPragText(event.target.value.replace(/[^0-9.,]/g, ''))}
          placeholder="ex. 2"
          autoComplete="off"
        />
      </BottomSheet>

      <AmCumparatStepForm
        open={cumparatOpen}
        onOpenChange={setCumparatOpen}
        todayIso={azi}
        catalog={catalogQuery.data ?? []}
        stoc={stoc}
        esteProprietar={esteProprietar}
        produsInitial={produsId}
      />
      <AmNumaratStepForm open={numaratOpen} onOpenChange={setNumaratOpen} todayIso={azi} catalog={catalogQuery.data ?? []} stoc={stoc} produsInitial={produsId} />
    </AppShell>
  )
}
