import { addDays, format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { AplicareDetaliuClient } from '@/components/tratamente/AplicareDetaliuClient'
import { AplicareDetaliuHeader } from '@/components/tratamente/AplicareDetaliuHeader'
import {
  getAplicareById,
  getAplicariProdusInAn,
} from '@/lib/supabase/queries/tratamente'
import { createClient } from '@/lib/supabase/server'
import { calculeazaCantitateTotala } from '@/lib/tratamente/doza-calculator'
import { getMeteoZi, logMeteoWarning } from '@/lib/tratamente/meteo'
import { checkPhiForRecoltare } from '@/lib/tratamente/phi-guard/check'

type PageProps = {
  params: Promise<{ id: string; aplicareId: string }>
}

function formatDateRo(value: string): string {
  return format(parseISO(value), 'EEEE, d MMM', { locale: ro })
}

function formatSafeDate(value: string | null): string {
  if (!value) return '—'
  return format(parseISO(`${value}T00:00:00.000Z`), 'd MMM', { locale: ro })
}

function buildOperatorDefault(email: string | null | undefined): string {
  if (!email) return ''
  const localPart = email.split('@')[0]?.trim()
  return localPart || email
}

export default async function AplicareDetaliuPage({ params }: PageProps) {
  const { id: parcelaId, aplicareId } = await params
  const aplicare = await getAplicareById(aplicareId)

  if (!aplicare || aplicare.parcela_id !== parcelaId) {
    notFound()
  }

  const supabase = await createClient()
  const [{ data: authData }, meteoZi, phiGuard, aplicariSezon] = await Promise.all([
    supabase.auth.getUser(),
    aplicare.status === 'aplicata'
      ? Promise.resolve(null)
      : getMeteoZi(parcelaId).catch((error) => {
          logMeteoWarning('Nu am putut încărca meteo pentru detaliul aplicării.', error, {
            parcelaId,
            aplicareId,
          })
          return null
        }),
    aplicare.data_planificata
      ? checkPhiForRecoltare({
          parcelaId,
          dataRecoltareEstimata: addDays(parseISO(aplicare.data_planificata), 14).toISOString().slice(0, 10),
        })
      : Promise.resolve({
          safe: true,
          earliestSafeDate: null,
          conflicts: [],
          mesaj: 'PHI OK — aplicare sigură înainte de recoltare',
        }),
    aplicare.produs_id
      ? getAplicariProdusInAn(
          parcelaId,
          aplicare.produs_id,
          Number((aplicare.data_planificata ?? aplicare.created_at).slice(0, 4)),
        )
      : Promise.resolve(0),
  ])

  const suprafataHa =
    typeof aplicare.parcela?.suprafata_m2 === 'number' && aplicare.parcela.suprafata_m2 > 0
      ? aplicare.parcela.suprafata_m2 / 10000
      : 0

  const cantitateCalculata = calculeazaCantitateTotala(
    {
      doza_l_per_ha: aplicare.doza_l_per_ha ?? aplicare.linie?.doza_l_per_ha ?? null,
      doza_ml_per_hl: aplicare.doza_ml_per_hl ?? aplicare.linie?.doza_ml_per_hl ?? null,
    },
    suprafataHa,
  )

  const verificari = {
    phi: phiGuard.safe
      ? {
          tone: 'success' as const,
          message: 'PHI OK — aplicare sigură înainte de recoltare',
        }
      : {
          tone: 'danger' as const,
          message: `Conflict PHI cu recoltare de ${formatSafeDate(phiGuard.earliestSafeDate)}`,
        },
    sezon:
      typeof aplicare.produs?.nr_max_aplicari_per_sezon === 'number'
        ? aplicariSezon >= aplicare.produs.nr_max_aplicari_per_sezon
          ? {
              tone: 'danger' as const,
              message: `Aplicat ${aplicariSezon}/${aplicare.produs.nr_max_aplicari_per_sezon} dată anul acesta`,
            }
          : {
              tone: 'success' as const,
              message: `Aplicat ${aplicariSezon}/${aplicare.produs.nr_max_aplicari_per_sezon} dată anul acesta`,
            }
        : {
            tone: 'neutral' as const,
            message: `Aplicat ${aplicariSezon} ori anul acesta · limită nedefinită`,
          },
    stoc: {
      tone: 'neutral' as const,
      message: '— (verificare manuală)',
    },
  }

  return (
    <AppShell
      header={
        <AplicareDetaliuHeader
          backHref={`/parcele/${parcelaId}/tratamente`}
          parcelaName={aplicare.parcela?.nume_parcela ?? 'Parcelă'}
        />
      }
      bottomInset="calc(var(--app-nav-clearance) + 1rem)"
    >
      <AplicareDetaliuClient
        aplicare={aplicare}
        currentOperator={buildOperatorDefault(authData.user?.email)}
        defaultCantitateMl={cantitateCalculata?.cantitateMl ?? aplicare.cantitate_totala_ml ?? null}
        meteoDateLabel={aplicare.data_planificata ? formatDateRo(aplicare.data_planificata) : 'Următoarele 24h'}
        meteoZi={meteoZi}
        parcelaId={parcelaId}
        stadiuImplicit={aplicare.stadiu_la_aplicare ?? aplicare.linie?.stadiu_trigger ?? null}
        verificari={verificari}
      />
    </AppShell>
  )
}
