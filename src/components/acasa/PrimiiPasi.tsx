'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button, ListRow, kitText } from '@/components/kit'
import { APP_SHORT_NAME } from '@/lib/brand'
import {
  aratamPrimiiPasi,
  cheieAscundePrimiiPasi,
  pasiGata,
  pasiPrimii,
  type DatePrimiiPasi,
  type PasPrimii,
} from '@/lib/dashboard/primii-pasi'
import { useFarmSettings } from '@/lib/farm-settings'
import { queryKeys } from '@/lib/query-keys'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const DEMO_EMAIL_SUFFIX = '@demo.zmeurel.local'

function citesteAscuns(cheie: string): boolean {
  try {
    return window.localStorage.getItem(cheie) === '1'
  } catch {
    return false
  }
}

/** Cardul, doar cu datele primite (îl folosesc Acasă și pagina kitului / testele). */
export function PrimiiPasiCard({
  pasi,
  onPas,
  onAscunde,
}: {
  pasi: readonly PasPrimii[]
  onPas: (pas: PasPrimii) => void
  onAscunde: () => void
}) {
  const gata = pasiGata(pasi)
  return (
    <section aria-labelledby="primii-pasi-titlu" className="space-y-2 rounded-card border border-border bg-surface p-3.5 shadow-1">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="primii-pasi-titlu" className={cn(kitText.card, 'font-extrabold text-fg')}>
          Primii pași · {gata} din {pasi.length}
        </h2>
      </div>
      <p className={cn(kitText.secondary, 'px-1 text-fg-muted')}>{`Așa pornești ${APP_SHORT_NAME} pe ferma ta. Pașii se bifează singuri.`}</p>
      <ul className="space-y-2">
        {pasi.map((pas) => (
          <li key={pas.cheie}>
            <ListRow
              avatar={false}
              leading={
                <span
                  aria-hidden
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-4',
                    pas.gata ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong text-transparent',
                  )}
                >
                  <Check />
                </span>
              }
              title={<span className={cn(pas.gata && 'text-fg-muted line-through')}>{pas.titlu}</span>}
              detail={pas.detaliu}
              chevron={!pas.gata}
              disabled={pas.gata}
              className={cn(pas.inactiv && 'opacity-60')}
              onClick={() => onPas(pas)}
            />
            <span className="sr-only">{pas.gata ? 'Gata.' : pas.inactiv ? pas.motivInactiv : 'De făcut.'}</span>
          </li>
        ))}
      </ul>
      <Button type="button" variant="quiet" size="touch" onClick={onAscunde}>
        Ascunde
      </Button>
    </section>
  )
}

/**
 * „Primii pași” în Acasă (promptul 31): doar pentru proprietarul unei ferme reale (nu demo, nu operator).
 * Pașii se bifează singuri din date; cardul dispare când sunt toți gata sau la „Ascunde” (pe utilizator, în
 * `localStorage`).
 */
export function PrimiiPasi() {
  const router = useRouter()
  const { userId, email, memberRole, farmName } = useDashboardAuth()
  const esteDemo = Boolean(email?.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX))
  const activ = memberRole !== 'operator' && !esteDemo
  const cheie = cheieAscundePrimiiPasi(userId)
  const [ascuns, setAscuns] = useState(true)

  useEffect(() => {
    setAscuns(citesteAscuns(cheie))
  }, [cheie])

  const parceleQuery = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele, enabled: activ })
  const culegatoriQuery = useQuery({ queryKey: queryKeys.culegatori, queryFn: getCulegatori, enabled: activ })
  const { settings, isLoading: setariLoading } = useFarmSettings()

  const date: DatePrimiiPasi | null = useMemo(() => {
    if (!parceleQuery.data || !culegatoriQuery.data || setariLoading) return null
    return {
      numeFerma: farmName,
      parcele: parceleQuery.data,
      culegatori: culegatoriQuery.data.length,
      pretPus: [settings.pretInceput, settings.pretVarf, settings.pretMediu].some((pret) => pret !== null && pret > 0),
    }
  }, [culegatoriQuery.data, farmName, parceleQuery.data, setariLoading, settings.pretInceput, settings.pretMediu, settings.pretVarf])

  if (!activ || !date) return null
  const pasi = pasiPrimii(date)
  if (!aratamPrimiiPasi(pasi, ascuns)) return null

  return (
    <PrimiiPasiCard
      pasi={pasi}
      onPas={(pas) => {
        if (pas.gata) return
        if (pas.inactiv) {
          toast.info(pas.motivInactiv ?? 'Încă nu.')
          return
        }
        router.push(pas.href)
      }}
      onAscunde={() => {
        try {
          window.localStorage.setItem(cheie, '1')
        } catch {
          // Fără localStorage: cardul se ascunde doar acum.
        }
        setAscuns(true)
      }}
    />
  )
}
