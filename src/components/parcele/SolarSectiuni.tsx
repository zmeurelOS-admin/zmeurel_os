'use client'

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Plus, Sprout, Thermometer } from 'lucide-react'

import { Button, ListRow, StatTile, kitFocus, kitText } from '@/components/kit'
import { useMeteo } from '@/hooks/useMeteo'
import { shortDateRo } from '@/lib/format-ro'
import { getConditiiMediuLabel } from '@/lib/parcele/culturi'
import { queryKeys } from '@/lib/query-keys'
import { getCulturiForSolar, type Cultura } from '@/lib/supabase/queries/culturi'
import { getSolarClimateLogs } from '@/lib/supabase/queries/solar-tracking'
import { cn } from '@/lib/utils'

/** O secțiune pliată în fișa parcelei (titlu apăsabil, conținutul sub el). */
export function SectiunePliata({ titlu, sub, icon, children, deschisaImplicit = false }: { titlu: string; sub?: string; icon: ReactNode; children: ReactNode; deschisaImplicit?: boolean }) {
  const [deschisa, setDeschisa] = useState(deschisaImplicit)
  return (
    <section className="rounded-box border-2 border-border bg-surface">
      <button
        type="button"
        aria-expanded={deschisa}
        onClick={() => setDeschisa((value) => !value)}
        className={cn('flex min-h-touch w-full items-center gap-3 rounded-box px-4 py-3 text-left', kitFocus)}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg [&_svg]:size-5" aria-hidden>
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('font-bold text-fg', kitText.base)}>{titlu}</span>
          {sub ? <span className={cn('text-fg-muted', kitText.secondary)}>{sub}</span> : null}
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-fg-muted transition-transform', deschisa && 'rotate-180')} aria-hidden />
      </button>
      {deschisa ? <div className="space-y-3 px-4 pb-4">{children}</div> : null}
    </section>
  )
}

function numeCultura(cultura: Cultura) {
  return [cultura.tip_planta, cultura.soi].filter(Boolean).join(' · ') || 'Cultură'
}

/** Culturile din solar (tabelul `culturi`): active, desființate, „+ Cultură”, „Desființează”. */
export function CulturiSolar({
  parcelaId,
  poateScrie,
  onAdauga,
  onDesfiinteaza,
}: {
  parcelaId: string
  poateScrie: boolean
  onAdauga: () => void
  onDesfiinteaza: (cultura: Cultura) => void
}) {
  const query = useQuery({ queryKey: queryKeys.culturi(parcelaId), queryFn: () => getCulturiForSolar(parcelaId), staleTime: 30_000, refetchOnWindowFocus: false })
  const culturi = query.data ?? []
  const active = culturi.filter((cultura) => cultura.activa !== false)
  const desfiintate = culturi.filter((cultura) => cultura.activa === false)

  return (
    <SectiunePliata
      titlu="Culturi"
      sub={query.isLoading ? 'Se încarcă…' : active.length > 0 ? `${active.length} ${active.length === 1 ? 'activă' : 'active'}` : 'Nicio cultură activă'}
      icon={<Sprout />}
      deschisaImplicit
    >
      {active.length > 0 ? (
        <ul className="space-y-2">
          {active.map((cultura) => (
            <li key={cultura.id}>
              <ListRow
                avatar={false}
                title={numeCultura(cultura)}
                detail={[cultura.nr_plante ? `${cultura.nr_plante} plante` : null, cultura.suprafata_ocupata ? `${cultura.suprafata_ocupata} m²` : null, cultura.data_plantarii ? `plantată ${shortDateRo(cultura.data_plantarii)}` : null].filter(Boolean).join(' · ') || undefined}
                trailing={
                  poateScrie ? (
                    <Button type="button" variant="quiet" size="touch" onClick={() => onDesfiinteaza(cultura)}>
                      Desființează
                    </Button>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
      {desfiintate.length > 0 ? (
        <div className="space-y-1">
          <p className={cn('font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>Desființate</p>
          <ul className="space-y-1">
            {desfiintate.map((cultura) => (
              <li key={cultura.id} className={cn('text-fg-muted', kitText.secondary)}>
                {numeCultura(cultura)}
                {cultura.data_desfiintare ? ` · desființată ${shortDateRo(cultura.data_desfiintare)}` : ''}
                {cultura.motiv_desfiintare ? ` · ${cultura.motiv_desfiintare}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {poateScrie ? (
        <Button type="button" variant="neutral" size="touch" className="w-full" onClick={onAdauga}>
          <Plus aria-hidden />
          Cultură
        </Button>
      ) : null}
    </SectiunePliata>
  )
}

/** Microclimatul solarului: vremea automată (după coordonatele parcelei) și înregistrările manuale. */
export function MicroclimatSolar({
  parcelaId,
  tipUnitate,
  coords,
  poateScrie,
  onAdauga,
}: {
  parcelaId: string
  tipUnitate: string | null | undefined
  coords: { lat: number; lon: number } | null
  poateScrie: boolean
  onAdauga: () => void
}) {
  const [toate, setToate] = useState(false)
  const eticheta = getConditiiMediuLabel(tipUnitate)
  const logs = useQuery({ queryKey: ['solar_climate_logs', parcelaId], queryFn: () => getSolarClimateLogs(parcelaId, 12), staleTime: 60_000, refetchOnWindowFocus: false })
  const meteo = useMeteo({ coords: coords ?? undefined, enabled: Boolean(coords) })
  const lista = logs.data ?? []
  const ultima = lista[0]

  return (
    <SectiunePliata
      titlu={eticheta}
      sub={ultima ? `Ultima: ${ultima.temperatura} °C · ${ultima.umiditate}%` : 'Nicio înregistrare'}
      icon={<Thermometer />}
    >
      {meteo.data?.available ? (
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Afară acum" value={typeof meteo.data.current?.temp === 'number' ? `${meteo.data.current.temp.toFixed(1)}°` : '—'} />
          <StatTile label="Umiditate" value={typeof meteo.data.current?.humidity === 'number' ? `${Math.round(meteo.data.current.humidity)}%` : '—'} />
          <StatTile label="Ploaie mâine" value={typeof meteo.data.forecastTomorrow?.pop === 'number' ? `${Math.round(meteo.data.forecastTomorrow.pop * 100)}%` : '—'} />
          <StatTile label="Vânt" value={typeof meteo.data.current?.windSpeed === 'number' ? meteo.data.current.windSpeed.toFixed(1) : '—'} unit="km/h" />
        </div>
      ) : (
        <p className={cn('text-fg-muted', kitText.secondary)}>{coords ? 'Vremea automată nu e disponibilă acum.' : 'Pentru vremea automată, pune coordonatele parcelei (Editează › Mai multe detalii).'}</p>
      )}

      {lista.length > 0 ? (
        <ul className="space-y-1.5">
          {(toate ? lista : lista.slice(0, 3)).map((log) => (
            <li key={log.id} className={cn('text-fg', kitText.secondary)}>
              <span className="font-semibold">{new Date(log.created_at).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {` · ${log.temperatura} °C · ${log.umiditate}%`}
              {log.observatii ? <span className="text-fg-muted">{` · ${log.observatii}`}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {lista.length > 3 ? (
        <Button type="button" variant="quiet" size="touch" onClick={() => setToate((value) => !value)}>
          {toate ? 'Arată mai puține' : `Toate înregistrările (${lista.length})`}
        </Button>
      ) : null}
      {poateScrie ? (
        <Button type="button" variant="neutral" size="touch" className="w-full" onClick={onAdauga}>
          <Plus aria-hidden />
          Înregistrare
        </Button>
      ) : null}
    </SectiunePliata>
  )
}
