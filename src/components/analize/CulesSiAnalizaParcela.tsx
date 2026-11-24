'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CircleAlert, FlaskConical } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { BottomSheet, Button, CalendarPanel, ListRow, Notice, kitText, longDayRo } from '@/components/kit'
import { useCulesConteaza } from '@/components/parcele/useStadiiParcele'
import { MESAJ_FARA_DATA_CULES, lipsaDataCulesConteaza } from '@/lib/analize/cules'
import { dataScurtaAnaliza, neconformeInSezon, stareAnalizaParcela } from '@/lib/analize/lista'
import { dataLungaRo } from '@/lib/analize/memento'
import { useMementoAnalize } from '@/lib/analize/useMementoAnalize'
import { queryKeys } from '@/lib/query-keys'
import { salveazaDataCules } from '@/lib/supabase/queries/analize'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

function Insigna({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-control [&_svg]:size-5',
        tone === 'success' && 'bg-success-bg text-success-text',
        tone === 'warning' && 'bg-warning-bg text-warning-text',
        tone === 'danger' && 'bg-danger-bg text-danger-text',
        tone === 'info' && 'bg-info-bg text-info-text',
        tone === 'neutral' && 'bg-surface-muted text-fg',
      )}
    >
      {children}
    </span>
  )
}

/**
 * Pe fișa unei parcele de vânzare: „Culesul începe pe ~… · Schimbă” (data pe sezon; altfel din prima recoltare
 * de anul trecut; altfel „Pune data culesului”) și rândul analizei („Ultima analiză: conform · vezi raportul” /
 * „Analiza sezonului: netrimisă”), plus avertizarea roșie pentru o analiză neconformă.
 * Dacă nicio parcelă de vânzare nu are dată (proprietarul): „Pune data culesului pe parcele ca să primești mementoul.”
 * `?cules=1` (eticheta „fără dată de cules” din lista de parcele) deschide direct foaia „Schimbă”.
 */
export function CulesSiAnalizaParcela({ parcelaId, azi, poateScrie, proprietar }: { parcelaId: string; azi: string; poateScrie: boolean; proprietar: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const memento = useMementoAnalize(azi, { proprietar })
  const conteaza = useCulesConteaza(azi, { enabled: proprietar })
  const [foaie, setFoaie] = useState(false)
  const [zi, setZi] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const an = azi.slice(0, 4)
  const estimare = memento.estimari.get(parcelaId) ?? null
  const stare = stareAnalizaParcela(memento.analize, parcelaId, an)
  const neconforma = neconformeInSezon(memento.analize, an).find((analiza) => analiza.parcele.includes(parcelaId))

  const salveaza = async (data: string | null) => {
    if (busy) return
    setBusy(true)
    try {
      await salveazaDataCules(parcelaId, Number(an), data)
      await queryClient.invalidateQueries({ queryKey: queryKeys.culesSezon(Number(an)) })
      setFoaie(false)
      toast.success(data ? `Culesul: ${dataLungaRo(data)}.` : 'Data culesului se estimează din nou.')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nu s-a salvat.')
    } finally {
      setBusy(false)
    }
  }

  // Din lista de parcele („fără dată de cules”): foaia se deschide o dată, apoi parametrul pleacă din adresă.
  const dinLista = searchParams.get('cules') === '1'
  useEffect(() => {
    if (!dinLista || !memento.gata) return
    queueMicrotask(() => {
      if (poateScrie) {
        setZi(memento.estimari.get(parcelaId)?.data ?? null)
        setFoaie(true)
      }
      router.replace(pathname, { scroll: false })
    })
  }, [dinLista, memento.gata, memento.estimari, parcelaId, pathname, poateScrie, router])

  if (!memento.gata) return null

  const faraNicioData = proprietar && conteaza.gata && lipsaDataCulesConteaza(memento.estimari, (id) => conteaza.culesConteazaPe.has(id))

  const detaliuCules =
    estimare?.sursa === 'manual'
      ? 'pusă de tine'
      : estimare?.sursa === 'anul_trecut' && estimare.primaRecoltareAnTrecut
        ? `din prima recoltare din ${estimare.primaRecoltareAnTrecut.slice(0, 4)} (${dataScurtaAnaliza(estimare.primaRecoltareAnTrecut)})`
        : 'după ea se calculează mementoul și avertizările'

  return (
    <div className="space-y-2">
      {neconforma ? (
        <Notice tone="danger" icon={<CircleAlert aria-hidden />} title="Analiza din sezon e neconformă">
          Nu culege și nu vinde din parcelă până nu vorbești cu laboratorul. Fără raport public pentru această analiză.
        </Notice>
      ) : null}

      {faraNicioData ? (
        <Notice tone="info" icon={<CalendarDays aria-hidden />} title={MESAJ_FARA_DATA_CULES} />
      ) : null}

      <ListRow
        avatar={false}
        leading={
          <Insigna tone={estimare?.data ? 'success' : 'neutral'}>
            <CalendarDays />
          </Insigna>
        }
        title={estimare?.data ? `Culesul începe pe ~${dataLungaRo(estimare.data)}` : 'Pune data culesului'}
        detail={detaliuCules}
        trailing={poateScrie ? <span className={cn('font-semibold text-primary', kitText.secondary)}>Schimbă</span> : undefined}
        onClick={
          poateScrie
            ? () => {
                setZi(estimare?.data ?? null)
                setFoaie(true)
              }
            : undefined
        }
        aria-label={poateScrie ? 'Schimbă data culesului' : undefined}
      />

      {!memento.analizeDisponibile ? null : stare.tip === 'rezultat' ? (
        <ListRow
          avatar={false}
          leading={
            <Insigna tone={stare.status === 'conform' ? 'success' : 'danger'}>
              <FlaskConical />
            </Insigna>
          }
          title={`Ultima analiză: ${stare.status === 'conform' ? 'conform' : 'neconform'}`}
          detail={[
            stare.analiza.buletin_data ? `buletin din ${dataScurtaAnaliza(stare.analiza.buletin_data)}` : null,
            stare.status === 'conform' ? 'vezi raportul' : 'vezi analiza',
          ]
            .filter(Boolean)
            .join(' · ')}
          onClick={() =>
            router.push(stare.status === 'conform' ? `/tratamente?tab=analize&raport=${encodeURIComponent(stare.analiza.id)}` : '/tratamente?tab=analize')
          }
        />
      ) : (
        <ListRow
          avatar={false}
          leading={
            <Insigna tone={stare.tip === 'la_laborator' ? 'info' : 'warning'}>
              <FlaskConical />
            </Insigna>
          }
          title={stare.tip === 'la_laborator' ? 'Analiza sezonului: la laborator' : 'Analiza sezonului: netrimisă'}
          detail={
            stare.tip === 'la_laborator'
              ? `prelevată ${dataScurtaAnaliza(stare.analiza.data_prelevare)}`
              : proprietar && estimare?.data
                ? 'memento pornit, înainte de cules'
                : 'trimite o probă înainte de cules'
          }
          onClick={() => router.push('/tratamente?tab=analize')}
        />
      )}

      <BottomSheet
        open={foaie}
        onOpenChange={setFoaie}
        title="Când începe culesul?"
        description={`Sezonul ${an}. După această dată se calculează mementoul analizei și avertizările la tratament.`}
        footer={
          <div className="flex flex-col gap-2.5">
            <Button type="button" variant="primary" size="touch-lg" className="w-full" loading={busy} disabled={!zi || !memento.culesDisponibil} onClick={() => void salveaza(zi)}>
              {zi ? `Salvează: ${longDayRo(zi)}` : 'Alege ziua'}
            </Button>
            {estimare?.sursa === 'manual' ? (
              <Button type="button" variant="quiet" size="touch" className="w-full" disabled={busy} onClick={() => void salveaza(null)}>
                Estimează din recoltările de anul trecut
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-3">
          {!memento.culesDisponibil ? (
            <Notice tone="info" title="Se poate salva după actualizarea bazei de date">
              Până atunci data se estimează din prima recoltare de anul trecut.
            </Notice>
          ) : null}
          <CalendarPanel value={zi} onChange={setZi} min={`${an}-01-01`} max={`${an}-12-31`} shortcuts={false} />
        </div>
      </BottomSheet>
    </div>
  )
}
