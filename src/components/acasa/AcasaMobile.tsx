'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  CalendarClock,
  ClipboardList,
  Scale,
  Snowflake,
  SprayCan,
  Sprout,
  TriangleAlert,
  Truck,
} from 'lucide-react'

import { Button, ListRow, Notice, StatusPill, kitFocus, kitText } from '@/components/kit'
import {
  amanaIntrebarea,
  buildAcasaExtrasezon,
  buildAcasaSezon,
  comenziDeschiseCount,
  meteoScurt,
  resolvePerioada,
  sezonPeScurt,
} from '@/lib/dashboard/acasa'
import type { ParcelDashboardState } from '@/lib/dashboard/engine'
import { farmSettingsQueryKey, SAVE_ERROR_MESSAGE, saveFarmSettings, useFarmSettings } from '@/lib/farm-settings'
import { formatKg, formatLei, formatNumber, shortDateRo, weekdayDateRo } from '@/lib/format-ro'
import type { ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import type { VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi'
import { queryKeys } from '@/lib/query-keys'
import { marcheazaFacut } from '@/lib/supabase/queries/tratamente'
import type { PauzaParcela } from '@/lib/tratamente/pauza'
import { detaliuPauza, titluPauza } from '@/lib/tratamente/texte'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

type MeteoLike = {
  current?: { temp: number | null; windSpeed: number | null } | null
  forecastTomorrow?: { tempMin: number | null; pop: number | null } | null
  spray?: { canSpray: boolean; reason?: string } | null
} | null

export interface AcasaMobileProps {
  todayIso: string
  comenzi: readonly Comanda[]
  recoltari: readonly Recoltare[]
  activitati: readonly ActivitateAgricola[]
  vanzari: readonly Vanzare[]
  vanzariButasi: readonly VanzareButasi[]
  /** Stocul cal. 1 disponibil; `null` = încă se încarcă. */
  stocDisponibilKg: number | null
  parcelStates: readonly ParcelDashboardState[]
  meteo: MeteoLike
  /** Pauzele active azi (sursa unică din `lib/tratamente/pauza`), cu numele parcelei. */
  pauze?: ReadonlyArray<PauzaParcela & { nume: string }>
  /** Tratamentele planificate azi (modulul Tratamente). */
  tratamenteAzi?: ReadonlyArray<TratamentAzi>
}

export interface TratamentAzi {
  key: string
  titlu: string
  detaliu: string
  aplicareIds: string[]
  /** Are produse cu pauză: după „Marchează făcut” pornește pauza. */
  areProduseCuPauza: boolean
  parceleText: string
}

/**
 * Acasă pe telefon: „ce am de făcut azi”, nu o grilă de widget-uri. Conținutul se schimbă după perioadă
 * (sezon / extrasezon), iar fiecare rând duce în modulul lui. Grila editabilă de pe desktop e în pagina de dashboard.
 */
export function AcasaMobile({
  todayIso,
  comenzi,
  recoltari,
  activitati,
  vanzari,
  vanzariButasi,
  stocDisponibilKg,
  parcelStates,
  meteo,
  pauze = [],
  tratamenteAzi = [],
}: AcasaMobileProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { settings } = useFarmSettings()
  const [answering, setAnswering] = useState<'da' | 'amana' | null>(null)

  const stare = useMemo(() => resolvePerioada(settings, todayIso, recoltari), [recoltari, settings, todayIso])
  const perioada = stare.perioada
  const vreme = meteoScurt(meteo, perioada)
  const afiseaza = settings.acasaExtrasezonAfiseaza
  const sezon = useMemo(
    () => buildAcasaSezon({ todayIso, comenzi, recoltari, stocDisponibilKg, parcelStates }),
    [comenzi, parcelStates, recoltari, stocDisponibilKg, todayIso],
  )
  const extrasezon = useMemo(
    () => buildAcasaExtrasezon({ todayIso, vanzariButasi, vanzari, activitati }),
    [activitati, todayIso, vanzari, vanzariButasi],
  )
  const peScurt = useMemo(() => sezonPeScurt(todayIso, recoltari, vanzari), [recoltari, todayIso, vanzari])
  const comenziFructe = comenziDeschiseCount(comenzi)

  const answer = async (kind: 'da' | 'amana') => {
    if (answering) return
    setAnswering(kind)
    try {
      if (kind === 'da') {
        await saveFarmSettings({ extrasezonInceputLa: todayIso })
        toast.success('Am trecut pe extrasezon.')
      } else {
        const until = amanaIntrebarea(todayIso)
        await saveFarmSettings({ extrasezonAmanatPana: until })
        toast.success(`Bine. Te întreb din nou pe ${weekdayDateRo(until)}.`)
      }
      await queryClient.invalidateQueries({ queryKey: farmSettingsQueryKey })
    } catch (cause) {
      toast.error(cause instanceof Error && cause.message ? cause.message : SAVE_ERROR_MESSAGE)
    } finally {
      setAnswering(null)
    }
  }

  const go = (href: string) => () => router.push(href)

  const [marcand, setMarcand] = useState<string | null>(null)
  const marcheaza = async (tratament: TratamentAzi) => {
    if (marcand) return
    setMarcand(tratament.key)
    try {
      await marcheazaFacut(tratament.aplicareIds)
      await queryClient.invalidateQueries({ queryKey: queryKeys.tratamente })
      toast.success(
        tratament.areProduseCuPauza
          ? `Notat ca făcut azi. Pauza pentru ${tratament.parceleText} a pornit.`
          : 'Notat ca făcut azi.',
      )
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      toast.error(/row-level security|42501/i.test(message) ? 'Nu ai drept de scriere pe tratamente.' : message || 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setMarcand(null)
    }
  }

  const randuriTratamenteAzi = tratamenteAzi.map((tratament) => (
    <li key={`tratament-azi-${tratament.key}`} className="space-y-2">
      <ListRow
        avatar={false}
        leading={<RowIcon tone="success"><SprayCan aria-hidden /></RowIcon>}
        title={tratament.titlu}
        detail={tratament.detaliu}
        onClick={go('/tratamente?fila=planificate')}
      />
      <Button
        type="button"
        variant="neutral"
        size="touch"
        className="w-full"
        loading={marcand === tratament.key}
        onClick={() => void marcheaza(tratament)}
      >
        Marchează făcut
      </Button>
    </li>
  ))
  const sprayNote = meteo?.spray
    ? meteo.spray.canSpray
      ? 'Azi vremea permite stropitul.'
      : meteo.spray.reason?.trim() || 'Azi vremea nu permite stropitul.'
    : null

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pt-3">
      {/* Perioada și vremea, pe un rând. */}
      <div className="flex items-center justify-between gap-3">
        <StatusPill tone={perioada === 'sezon' ? 'success' : 'info'} icon={perioada === 'sezon' ? <Sprout aria-hidden /> : <Snowflake aria-hidden />}>
          {perioada === 'sezon' ? 'Sezon · zmeură' : 'Extrasezon · butași și lucrări'}
        </StatusPill>
        {vreme.temp !== null || vreme.nota ? (
          <p className="flex min-w-0 flex-col items-end text-right" aria-label="Vremea">
            {vreme.temp !== null ? (
              <span className={cn('font-extrabold text-fg', kitText.card)}>{Math.round(vreme.temp)}°</span>
            ) : null}
            {vreme.nota ? (
              <span className={cn('font-semibold', kitText.helper, vreme.tone === 'warning' ? 'text-warning-text' : 'text-fg-muted')}>
                {vreme.nota}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {stare.intreaba ? (
        <Notice
          tone="info"
          title="Începem extrasezonul?"
          action={
            <div className="flex flex-col gap-2.5">
              <Button type="button" variant="primary" size="touch-lg" loading={answering === 'da'} onClick={() => void answer('da')}>
                Da, începem
              </Button>
              <Button type="button" variant="neutral" size="touch" loading={answering === 'amana'} onClick={() => void answer('amana')}>
                Mai am de cules
              </Button>
            </div>
          }
        >
          {stare.ultimaRecoltare
            ? `Ultima recoltare: ${weekdayDateRo(stare.ultimaRecoltare)}. Acasă va arăta butașii și lucrările.`
            : 'Acasă va arăta butașii și lucrările.'}
        </Notice>
      ) : null}

      {perioada === 'sezon' ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatLink
              href="/comenzi"
              tone="inverse"
              value={formatNumber(sezon.deLivratKg)}
              unit="kg"
              label={`De livrat azi · ${sezon.deLivratCount} ${sezon.deLivratCount === 1 ? 'comandă' : 'comenzi'}${sezon.prioritareCount > 0 ? ` · ${sezon.prioritareCount} ${sezon.prioritareCount === 1 ? 'prioritară' : 'prioritare'}` : ''}`}
            />
            <StatLink
              href="/recoltari"
              tone={sezon.lipsaKg > 0 ? 'warning' : 'neutral'}
              value={sezon.stocKg === null ? '…' : formatNumber(sezon.stocKg)}
              unit="kg"
              label="În stoc, calitatea 1"
            />
          </div>

          {sezon.lipsaKg > 0 ? (
            <Notice tone="warning" title={`Lipsesc ${formatKg(sezon.lipsaKg)}`}>
              Notează recoltarea de azi sau mută comenzi pe altă zi.
            </Notice>
          ) : null}

          {pauze.map((pauza) => (
            <Link
              key={`pauza-${pauza.parcelaId}`}
              href="/tratamente"
              className={cn('block rounded-box', kitFocus)}
              aria-label={`${titluPauza(pauza.nume, pauza)}. Deschide Tratamente`}
            >
              <Notice tone="warning" icon={<TriangleAlert aria-hidden />} title={titluPauza(pauza.nume, pauza)}>
                {detaliuPauza(pauza, todayIso)}
              </Notice>
            </Link>
          ))}

          <section aria-labelledby="acasa-de-facut" className="space-y-2">
            <h2 id="acasa-de-facut" className={cn('px-1 font-extrabold text-fg', kitText.card)}>
              De făcut azi
            </h2>
            <ul className="space-y-2">
              {randuriTratamenteAzi}
              {sezon.inLivrareCount > 0 ? (
                <li>
                  <ListRow
                    avatar={false}
                    leading={<RowIcon><Truck aria-hidden /></RowIcon>}
                    title={`${sezon.inLivrareCount} ${sezon.inLivrareCount === 1 ? 'livrare în drum' : 'livrări în drum'}`}
                    detail="Deschide traseul de azi"
                    onClick={go('/livrari')}
                  />
                </li>
              ) : null}
              {sezon.dePusInLivrareCount > 0 ? (
                <li>
                  <ListRow
                    avatar={false}
                    leading={<RowIcon><ClipboardList aria-hidden /></RowIcon>}
                    title={`${sezon.dePusInLivrareCount} ${sezon.dePusInLivrareCount === 1 ? 'comandă de pus în livrare' : 'comenzi de pus în livrare'}`}
                    detail="Din Comenzi, cu „Pune în livrare azi”"
                    onClick={go('/comenzi')}
                  />
                </li>
              ) : null}
              <li>
                <ListRow
                  avatar={false}
                  leading={<RowIcon tone={sezon.recoltatAziKg > 0 ? 'success' : 'neutral'}><Scale aria-hidden /></RowIcon>}
                  title={sezon.recoltatAziKg > 0 ? `Recoltarea de azi: ${formatKg(sezon.recoltatAziKg)}` : 'Recoltarea de azi: nenotată'}
                  detail={sezon.recoltatAziKg > 0 ? 'Notată. Adaugă dacă mai sunt cântăriri.' : 'Notează kilogramele culese'}
                  onClick={go('/recoltari')}
                />
              </li>
              {sezon.parceleTratament.map((parcel) => (
                <li key={`tratament-${parcel.id}`}>
                  <ListRow
                    avatar={false}
                    leading={<RowIcon tone={parcel.intarziat ? 'warning' : 'neutral'}><SprayCan aria-hidden /></RowIcon>}
                    title={`Tratament: ${parcel.name}`}
                    detail={[parcel.intarziat ? 'Întârziat' : 'Urmează în curând', sprayNote].filter(Boolean).join(' · ')}
                    onClick={go('/tratamente')}
                  />
                </li>
              ))}
            </ul>
          </section>

          <SezonSumar titlu={`Sezonul ${peScurt.an}, până azi`} recoltatKg={peScurt.recoltatKg} incasatLei={peScurt.incasatLei} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            {afiseaza.comenzi_butasi ? (
              <StatLink
                href="/vanzari-butasi"
                tone="inverse"
                value={formatNumber(extrasezon.butasiSaptamanaBuc)}
                unit="buc"
                label={
                  extrasezon.butasiSaptamanaCount > 0
                    ? `Butași de livrat săpt. asta · ${extrasezon.butasiSaptamanaCount} ${extrasezon.butasiSaptamanaCount === 1 ? 'comandă' : 'comenzi'}${extrasezon.butasiPrimaData ? ` · prima: ${shortDateRo(extrasezon.butasiPrimaData)}` : ''}`
                    : 'Butași de livrat săpt. asta'
                }
              />
            ) : null}
            {afiseaza.rest_incasat ? (
              <StatLink
                href="/vanzari?fila=neincasate"
                tone={extrasezon.restLei > 0 ? 'warning' : 'neutral'}
                value={formatLei(extrasezon.restLei)}
                label={`Rest de încasat · ${extrasezon.restCount} ${extrasezon.restCount === 1 ? 'vânzare' : 'vânzări'}`}
                className={afiseaza.comenzi_butasi ? undefined : 'col-span-2'}
              />
            ) : null}
          </div>

          {afiseaza.comenzi_butasi && extrasezon.butasiPeSoiuri.length > 0 ? (
            <p className={cn('rounded-box bg-surface-muted px-4 py-3 text-fg', kitText.secondary)}>
              <span className="font-bold">De pregătit: </span>
              {extrasezon.butasiPeSoiuri.map((item) => `${item.soi} ${formatNumber(item.buc)}`).join(' · ')}
            </p>
          ) : null}

          {afiseaza.inghet && vreme.nota ? (
            <Notice tone="warning" icon={<Snowflake aria-hidden />} title={capitalize(vreme.nota)}>
              Protejează butașii și instalația de apă.
            </Notice>
          ) : null}

          <section aria-labelledby="acasa-de-facut" className="space-y-2">
            <h2 id="acasa-de-facut" className={cn('px-1 font-extrabold text-fg', kitText.card)}>
              De făcut
            </h2>
            <ul className="space-y-2">
              {randuriTratamenteAzi}
              {afiseaza.comenzi_butasi && extrasezon.butasiDeschiseCount > 0 ? (
                <li>
                  <ListRow
                    avatar={false}
                    leading={<RowIcon><Sprout aria-hidden /></RowIcon>}
                    title={`${extrasezon.butasiDeschiseCount} ${extrasezon.butasiDeschiseCount === 1 ? 'comandă de butași de pregătit' : 'comenzi de butași de pregătit'}`}
                    detail="Deschide Material săditor"
                    onClick={go('/vanzari-butasi')}
                  />
                </li>
              ) : null}
              {afiseaza.rest_incasat && extrasezon.restCount > 0 ? (
                <li>
                  <ListRow
                    avatar={false}
                    leading={<RowIcon tone="warning"><Banknote aria-hidden /></RowIcon>}
                    title={`${extrasezon.restCount} ${extrasezon.restCount === 1 ? 'încasare restantă' : 'încasări restante'}`}
                    detail={`${formatLei(extrasezon.restLei)} de primit`}
                    onClick={go('/vanzari?fila=neincasate')}
                  />
                </li>
              ) : null}
              {comenziFructe > 0 ? (
                <li>
                  <ListRow
                    avatar={false}
                    leading={<RowIcon><ClipboardList aria-hidden /></RowIcon>}
                    title={`${comenziFructe} ${comenziFructe === 1 ? 'comandă de fructe deschisă' : 'comenzi de fructe deschise'}`}
                    detail="Deschide Comenzi"
                    onClick={go('/comenzi')}
                  />
                </li>
              ) : null}
              {afiseaza.lucrari
                ? extrasezon.lucrari.map((lucrare) => (
                    <li key={lucrare.id}>
                      <ListRow
                        avatar={false}
                        leading={<RowIcon><CalendarClock aria-hidden /></RowIcon>}
                        title={lucrare.titlu}
                        detail={`Planificată: ${weekdayDateRo(lucrare.data)}`}
                        onClick={go('/activitati-agricole')}
                      />
                    </li>
                  ))
                : null}
              {sezon.parceleTratament.map((parcel) => (
                <li key={`tratament-${parcel.id}`}>
                  <ListRow
                    avatar={false}
                    leading={<RowIcon tone={parcel.intarziat ? 'warning' : 'neutral'}><SprayCan aria-hidden /></RowIcon>}
                    title={`Tratament: ${parcel.name}`}
                    detail={[parcel.intarziat ? 'Întârziat' : 'Urmează în curând', sprayNote].filter(Boolean).join(' · ')}
                    onClick={go('/tratamente')}
                  />
                </li>
              ))}
            </ul>
            {(!afiseaza.comenzi_butasi || extrasezon.butasiDeschiseCount === 0) &&
            (!afiseaza.rest_incasat || extrasezon.restCount === 0) &&
            comenziFructe === 0 &&
            (!afiseaza.lucrari || extrasezon.lucrari.length === 0) &&
            sezon.parceleTratament.length === 0 &&
            tratamenteAzi.length === 0 ? (
              <Notice tone="success" title="Nimic urgent">
                Lucrările planificate apar aici când le treci în Activități, cu o dată în viitor.
              </Notice>
            ) : null}
          </section>

          <SezonSumar
            titlu={`Sezonul ${peScurt.an} încheiat`}
            recoltatKg={peScurt.recoltatKg}
            incasatLei={peScurt.incasatLei}
            rapoarte
          />
        </>
      )}
    </div>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}

/** O cifră cu eticheta ei, ca legătură spre modulul din care vine. Arată ca `StatTile`. */
function StatLink({
  href,
  value,
  unit,
  label,
  tone = 'neutral',
  className,
}: {
  href: string
  value: string
  unit?: string
  label: string
  tone?: 'neutral' | 'warning' | 'inverse'
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}${unit ? ` ${unit}` : ''}. Deschide`}
      className={cn(
        'flex min-h-[88px] min-w-0 flex-col justify-center gap-1 rounded-box p-3 transition-transform active:scale-[0.98]',
        kitFocus,
        tone === 'inverse' ? 'bg-primary text-primary-contrast' : 'border border-border bg-surface',
        className,
      )}
    >
      <span
        className={cn(
          'truncate font-extrabold leading-none',
          kitText.section,
          tone === 'neutral' && 'text-fg',
          tone === 'warning' && 'text-warning-text',
        )}
      >
        {value}
        {unit ? <span className={cn('ml-1 font-bold', kitText.secondary)}>{unit}</span> : null}
      </span>
      <span className={cn('font-medium leading-tight', kitText.helper, tone === 'inverse' ? 'opacity-85' : 'text-fg-muted')}>
        {label}
      </span>
    </Link>
  )
}

function RowIcon({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'success' }) {
  return (
    <span
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        tone === 'warning' && 'bg-warning-bg text-warning-text',
        tone === 'success' && 'bg-success-bg text-success-text',
        tone === 'neutral' && 'bg-surface-muted text-fg',
      )}
      aria-hidden
    >
      {children}
    </span>
  )
}

function SezonSumar({
  titlu,
  recoltatKg,
  incasatLei,
  rapoarte = false,
}: {
  titlu: string
  recoltatKg: number
  incasatLei: number
  rapoarte?: boolean
}) {
  return (
    <section aria-label={titlu} className="space-y-2">
      <h2 className={cn('px-1 font-extrabold text-fg', kitText.card)}>{titlu}</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <StatLink href="/recoltari" value={formatNumber(recoltatKg)} unit="kg" label="Recoltat" />
        <StatLink href="/vanzari" value={formatLei(incasatLei)} label="Încasat din fructe" />
      </div>
      {rapoarte ? (
        <Link
          href="/rapoarte"
          className={cn('inline-flex min-h-touch items-center px-1 font-semibold text-primary', kitText.secondary, kitFocus)}
        >
          Detalii în Rapoarte
        </Link>
      ) : null}
    </section>
  )
}
