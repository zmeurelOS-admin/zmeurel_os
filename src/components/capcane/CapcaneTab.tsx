'use client'

import { Bug } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { EmptyState, ListRow, Notice, StatusPill, kitText } from '@/components/kit'
import {
  capcaneDeVerificat,
  capturiText,
  inceputSaptamana,
  textAtractant,
  titluGrup,
  titluVerificare,
  verificareScadenta,
  type GrupCapcane,
  type StareGrup,
} from '@/lib/capcane'
import { adaugaZile, zileIntre } from '@/lib/notifications/zilnice/common'
import { ziCuDataRo } from '@/lib/tratamente/zile'
import { cn } from '@/lib/utils'

import { IconitaTip } from './IconitaTip'

/** „săptămâna aceasta”, „săptămâna trecută”, „săpt. din 1.06”. */
function eticheta(ziua: string, azi: string): string {
  const start = inceputSaptamana(ziua)
  const curenta = inceputSaptamana(azi)
  if (start === curenta) return 'săptămâna aceasta'
  if (start === adaugaZile(curenta, -7)) return 'săptămâna trecută'
  return `săpt. din ${Number(start.slice(8, 10))}.${start.slice(5, 7)}`
}

export function detaliuGrup(grup: GrupCapcane, stare: StareGrup | undefined, azi: string): string {
  const deVerificat = verificareScadenta(grup, azi) ? ' · de verificat azi' : ''
  if (!stare?.ultimaVerificare) return `Montate ${ziCuDataRo(grup.data_montare)} · nicio verificare încă${deVerificat}`
  const capturi = capturiText(stare.capturiSaptamana ?? 0)
  return `${eticheta(stare.ultimaVerificare, azi)}: ${capturi}${stare.pestePrag ? ', peste prag' : ''}${deVerificat}`
}

/** „Ultima: acum 7 zile.” */
function textUltima(grupuri: GrupCapcane[], starePeGrup: ReadonlyMap<string, StareGrup>, azi: string): string | null {
  const zile = grupuri
    .map((grup) => starePeGrup.get(grup.id)?.ultimaVerificare)
    .filter((zi): zi is string => Boolean(zi))
    .sort()
  const ultima = zile.at(-1)
  if (!ultima) return null
  const n = zileIntre(ultima, azi) ?? 0
  if (n <= 0) return 'Ultima: azi.'
  if (n === 1) return 'Ultima: ieri.'
  return `Ultima: acum ${n} zile.`
}

export interface CapcaneTabProps {
  azi: string
  grupuri: readonly GrupCapcane[]
  starePeGrup: ReadonlyMap<string, StareGrup>
  numeParcele: ReadonlyMap<string, string>
  loading: boolean
  error: boolean
  indisponibil: boolean
  poateScrie: boolean
}

/**
 * Tratamente → Capcane: cardul „Verificare azi · N capcane” când e scadentă, lista grupurilor pe parcelă (tip,
 * bucăți, capturile din săptămâna ultimei verificări, „peste prag”) și grupurile scoase. Butoanele „Verifică acum”
 * și „+ Montează” stau în bara de jos a paginii.
 */
export function CapcaneTab({ azi, grupuri, starePeGrup, numeParcele, loading, error, indisponibil, poateScrie }: CapcaneTabProps) {
  const router = useRouter()

  if (indisponibil) {
    return (
      <Notice tone="info" title="Capcanele vor merge după actualizarea bazei de date">
        Restul aplicației merge ca până acum.
      </Notice>
    )
  }
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Se încarcă capcanele">
        <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
        <div className="h-[88px] animate-pulse rounded-box bg-surface-muted" />
      </div>
    )
  }
  if (error) {
    return (
      <Notice tone="danger" title="Capcanele nu s-au încărcat">
        Verifică internetul și deschide din nou pagina.
      </Notice>
    )
  }

  const active = grupuri.filter((grup) => grup.status === 'activa')
  const scoase = grupuri.filter((grup) => grup.status === 'scoasa')
  const deVerificat = capcaneDeVerificat(active, azi)
  const nume = (grup: GrupCapcane) => numeParcele.get(grup.parcela_id) ?? 'Parcelă'

  const rand = (grup: GrupCapcane) => {
    const stare = starePeGrup.get(grup.id)
    return (
      <li key={grup.id}>
        <ListRow
          avatar={false}
          leading={<IconitaTip tip={grup.tip} ton={stare?.pestePrag ? 'warning' : grup.status === 'scoasa' ? 'neutral' : 'primary'} />}
          title={titluGrup(nume(grup), grup.tip, grup.nr_bucati)}
          detail={grup.status === 'scoasa' ? `Scoase · montate ${ziCuDataRo(grup.data_montare)}` : detaliuGrup(grup, stare, azi)}
          trailing={stare?.pestePrag && grup.status === 'activa' ? <StatusPill tone="warning">peste prag</StatusPill> : undefined}
          onClick={() => router.push(`/tratamente/capcane/${grup.id}`)}
        />
      </li>
    )
  }

  return (
    <div className="space-y-3.5">
      {deVerificat.capcane > 0 ? (
        <Notice tone="warning" title={titluVerificare(deVerificat.capcane)}>
          {[textUltima(deVerificat.grupuri, starePeGrup, azi), textAtractant(deVerificat.atractant)].filter(Boolean).join(' ') ||
            'Pune câte insecte ai prins în fiecare capcană.'}
        </Notice>
      ) : null}

      {active.length > 0 ? (
        <ul className="space-y-2" aria-label="Capcanele montate">
          {active.map(rand)}
        </ul>
      ) : (
        <EmptyState
          icon={<Bug />}
          title="Nicio capcană montată"
          description={
            poateScrie
              ? 'Montează capcane pe parcele: aplicația îți amintește când le verifici și te anunță când trec de prag.'
              : 'Când se montează capcane, apar aici cu capturile pe săptămână.'
          }
        />
      )}

      {scoase.length > 0 ? (
        <section className="space-y-2" aria-labelledby="capcane-scoase">
          <h3 id="capcane-scoase" className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>
            Scoase
          </h3>
          <ul className="space-y-2">{scoase.map(rand)}</ul>
        </section>
      ) : null}
    </div>
  )
}
