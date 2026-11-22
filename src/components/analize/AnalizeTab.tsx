'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleAlert, FlaskConical, Hourglass } from 'lucide-react'

import { BottomSheet, Button, EmptyState, ListRow, Notice, kitText } from '@/components/kit'
import { RaportSheet } from '@/components/analize/RaportSheet'
import type { ParcelaAnaliza } from '@/components/analize/AnalizaNouaStepForm'
import { dataScurtaAnaliza, ordoneazaAnalize, textParceleAnaliza, titluAnaliza, ultimaCuRezultat, zileLaLaborator } from '@/lib/analize/lista'
import { ETICHETA_PRELEVAT, depasesteLimita, type AnalizaRow } from '@/lib/analize/model'
import { textPauzaInainte, tratamenteInaintePrelevare, type ActivitatePentruAnaliza, type AplicarePentruAnaliza } from '@/lib/analize/tratamente-inainte'
import { queryKeys } from '@/lib/query-keys'
import { AnalizeIndisponibileError, getAnalize, linkFisierAnaliza } from '@/lib/supabase/queries/analize'
import { cn } from '@/lib/utils'

function Insigna({ status }: { status: AnalizaRow['status'] }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-control [&_svg]:size-5',
        status === 'la_laborator' && 'bg-info-bg text-info-text',
        status === 'conform' && 'bg-success-bg text-success-text',
        status === 'neconform' && 'bg-danger-bg text-danger-text',
      )}
    >
      {status === 'la_laborator' ? <Hourglass /> : status === 'conform' ? <Check strokeWidth={2.6} /> : <CircleAlert />}
    </span>
  )
}

function detaliuRand(analiza: AnalizaRow, azi: string): string {
  if (analiza.status === 'la_laborator') {
    return [`La laborator din ${dataScurtaAnaliza(analiza.data_predare ?? analiza.data_prelevare, azi)}`, analiza.laborator].filter(Boolean).join(' · ')
  }
  const verdict = analiza.status === 'conform' ? 'Conform' : 'Neconform'
  const analizat = analiza.ce_s_a_analizat?.trim()
  const scurt = analizat ? (analizat.length > 40 ? `${analizat.slice(0, 40).trim()}…` : analizat).toLocaleLowerCase('ro-RO') : null
  return [verdict, scurt, analiza.buletin_data ? `rezultat ${dataScurtaAnaliza(analiza.buletin_data, azi)}` : null].filter(Boolean).join(' · ')
}

export interface AnalizeTabProps {
  azi: string
  parcele: ParcelaAnaliza[]
  /** Toate parcelele (și cele personale), pentru numele din analizele vechi. */
  numeParcele: ReadonlyMap<string, string>
  aplicari: readonly AplicarePentruAnaliza[]
  activitati: readonly ActivitatePentruAnaliza[]
  poateScrie: boolean
  esteProprietar: boolean
  onAnalizaNoua: () => void
  onEditeazaPrelevarea: (analiza: AnalizaRow) => void
  onAdaugaRezultat: (analiza: AnalizaRow) => void
  /** Deschide raportul unei analize (ex. după „Salvează și fă raportul”). */
  raportDeschis: string | null
  onRaportDeschisChange: (id: string | null) => void
}

/**
 * Tratamente → „Analize”: „Ultima analiză” sus, apoi lista (cele la laborator sus, cu albastru; titlul = parcelele +
 * data prelevării). O analiză se deschide în fișa ei (etapele, tratamentele din cele 30 de zile dinainte); una
 * conformă are și raportul (link public, PDF, afiș cu QR).
 */
export function AnalizeTab(props: AnalizeTabProps) {
  const { azi, numeParcele, aplicari, activitati, poateScrie } = props
  const queryClient = useQueryClient()
  const analizeQuery = useQuery({ queryKey: queryKeys.analize, queryFn: getAnalize, staleTime: 30_000, retry: (n, error) => !(error instanceof AnalizeIndisponibileError) && n < 1 })
  const analize = useMemo(() => ordoneazaAnalize(analizeQuery.data ?? []), [analizeQuery.data])
  const ultima = useMemo(() => ultimaCuRezultat(analize), [analize])
  const indisponibil = analizeQuery.error instanceof AnalizeIndisponibileError

  const [fisaId, setFisaId] = useState<string | null>(null)
  const [fisaOpen, setFisaOpen] = useState(false)
  const fisa = analize.find((analiza) => analiza.id === fisaId) ?? null

  const pvQuery = useQuery({
    queryKey: ['analize', 'fisier', fisa?.pv_poza_path ?? ''],
    queryFn: () => linkFisierAnaliza(fisa?.pv_poza_path),
    enabled: fisaOpen && Boolean(fisa?.pv_poza_path),
    staleTime: 30 * 60_000,
  })

  const tratamente = useMemo(
    () => (fisa ? tratamenteInaintePrelevare({ aplicari, activitati, parcelaIds: fisa.parcele, dataPrelevare: fisa.data_prelevare }) : []),
    [activitati, aplicari, fisa],
  )

  // Nimic peste altceva: foaia se închide înainte să se deschidă formularul sau raportul.
  const dinFisa = (actiune: () => void) => {
    setFisaOpen(false)
    window.setTimeout(actiune, 180)
  }

  const nume = (analiza: AnalizaRow) => textParceleAnaliza(analiza.parcele, numeParcele)

  if (indisponibil) {
    return (
      <Notice tone="info" title="Analizele vor merge după actualizarea bazei de date">
        Până atunci poți nota tratamentele ca de obicei.
      </Notice>
    )
  }

  return (
    <div className="space-y-3">
      {analizeQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Se încarcă analizele">
          <div className="h-[96px] animate-pulse rounded-box bg-surface-muted" />
          <div className="h-[76px] animate-pulse rounded-box bg-surface-muted" />
        </div>
      ) : analizeQuery.isError ? (
        <Notice tone="danger" title="Analizele nu s-au încărcat">
          Verifică internetul și deschide din nou pagina.
        </Notice>
      ) : (
        <>
          {ultima ? (
            <button
              type="button"
              onClick={() => {
                setFisaId(ultima.id)
                setFisaOpen(true)
              }}
              className={cn(
                'block w-full rounded-card p-4 text-left',
                ultima.status === 'conform' ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text',
              )}
            >
              <span className={cn('block font-bold', kitText.secondary)}>Ultima analiză</span>
              <span className={cn('block font-extrabold', kitText.screen)}>{ultima.status === 'conform' ? 'Conform' : 'Neconform'}</span>
              <span className={cn('block', kitText.secondary)}>
                {[
                  nume(ultima),
                  ultima.buletin_data ? `buletin din ${dataScurtaAnaliza(ultima.buletin_data, azi)}` : null,
                  ultima.status === 'conform'
                    ? 'nicio limită depășită'
                    : ultima.substante.some(depasesteLimita)
                      ? `limită depășită: ${ultima.substante.filter(depasesteLimita).map((s) => s.substanta).join(', ')}`
                      : 'fără raport public',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          ) : null}

          {analize.length > 0 ? (
            <ul className="space-y-2">
              {analize.map((analiza) => (
                <li key={analiza.id}>
                  <ListRow
                    avatar={false}
                    leading={<Insigna status={analiza.status} />}
                    title={titluAnaliza(analiza, numeParcele, azi)}
                    detail={detaliuRand(analiza, azi)}
                    onClick={() => {
                      setFisaId(analiza.id)
                      setFisaOpen(true)
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<FlaskConical />}
              title="Nicio analiză încă"
              description="Treci fiecare analiză de la prelevare până la rezultat. Din rezultat faci raportul pentru clienți: link, PDF și afiș cu QR."
            />
          )}
        </>
      )}

      <BottomSheet
        open={fisaOpen}
        onOpenChange={setFisaOpen}
        title={fisa ? `${nume(fisa)} · ${dataScurtaAnaliza(fisa.data_prelevare, azi)}` : 'Analiza'}
        footer={
          fisa ? (
            <div className="flex flex-col gap-2.5">
              {fisa.status === 'conform' ? (
                <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => dinFisa(() => props.onRaportDeschisChange(fisa.id))}>
                  Vezi raportul
                </Button>
              ) : null}
              {poateScrie && fisa.status === 'la_laborator' ? (
                <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => dinFisa(() => props.onAdaugaRezultat(fisa))}>
                  Adaugă rezultatul
                </Button>
              ) : null}
              {poateScrie && fisa.status !== 'la_laborator' ? (
                <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => dinFisa(() => props.onAdaugaRezultat(fisa))}>
                  Editează rezultatul
                </Button>
              ) : null}
              {poateScrie ? (
                <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => dinFisa(() => props.onEditeazaPrelevarea(fisa))}>
                  Editează prelevarea
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {fisa ? (
          <div className="space-y-3">
            {fisa.status === 'la_laborator' ? (
              <Notice tone="info" title={`La laborator de ${zileLaLaborator(fisa, azi) === 1 ? 'o zi' : `${zileLaLaborator(fisa, azi)} zile`}`}>
                Când vine buletinul, treci rezultatul.
              </Notice>
            ) : fisa.status === 'neconform' ? (
              <Notice tone="danger" title="Neconform">
                Fără raport public pentru această analiză. Verifică tratamentele de mai jos și vorbește cu laboratorul.
              </Notice>
            ) : null}

            <ol className="overflow-hidden rounded-box border border-border">
              {[
                {
                  gata: true,
                  titlu: `Prelevată · ${dataScurtaAnaliza(fisa.data_prelevare, azi)}`,
                  detaliu: (
                    <>
                      {[fisa.pv_numar ? `PV nr. ${fisa.pv_numar}` : null, fisa.prelevat_de ? `de ${ETICHETA_PRELEVAT[fisa.prelevat_de] === 'Eu' ? 'tine' : ETICHETA_PRELEVAT[fisa.prelevat_de]}` : null]
                        .filter(Boolean)
                        .join(' · ') || 'fără PV notat'}
                      {fisa.pv_poza_path && pvQuery.data ? (
                        <>
                          {' · '}
                          <a href={pvQuery.data} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
                            poza PV
                          </a>
                        </>
                      ) : null}
                    </>
                  ),
                },
                {
                  gata: Boolean(fisa.data_predare || fisa.laborator),
                  titlu: `Predată${fisa.data_predare ? ` · ${dataScurtaAnaliza(fisa.data_predare, azi)}` : ''}`,
                  detaliu: fisa.laborator ?? 'laboratorul nenotat',
                },
                {
                  gata: fisa.status !== 'la_laborator',
                  titlu: fisa.status === 'la_laborator' ? 'Rezultat' : `Rezultat: ${fisa.status === 'conform' ? 'conform' : 'neconform'}`,
                  detaliu:
                    fisa.status === 'la_laborator'
                      ? 'în așteptare'
                      : [fisa.buletin_numar ? `buletin nr. ${fisa.buletin_numar}` : 'buletin', fisa.buletin_data ? `din ${dataScurtaAnaliza(fisa.buletin_data, azi)}` : null].filter(Boolean).join(' '),
                },
              ].map((etapa, index) => (
                <li key={index} className="flex items-start gap-3 border-b border-border px-3.5 py-3 last:border-b-0">
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full font-extrabold',
                      kitText.helper,
                      etapa.gata ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-fg-muted',
                    )}
                  >
                    {etapa.gata ? <Check className="size-4" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block font-bold text-fg', kitText.base)}>{etapa.titlu}</span>
                    <span className={cn('block text-fg-muted', kitText.secondary)}>{etapa.detaliu}</span>
                  </span>
                </li>
              ))}
            </ol>

            {fisa.status !== 'la_laborator' && fisa.ce_s_a_analizat ? (
              <p className={cn('text-fg-muted', kitText.secondary)}>Analiza: {fisa.ce_s_a_analizat}</p>
            ) : null}

            <h3 className={cn('px-1 pt-1 font-bold uppercase tracking-wide text-fg-subtle', kitText.helper)}>Tratamente în cele 30 de zile dinainte</h3>
            {tratamente.length > 0 ? (
              <ul className="space-y-2">
                {tratamente.map((t) => (
                  <li key={t.key}>
                    <ListRow
                      avatar={false}
                      leading={
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-control [&_svg]:size-5',
                            t.respectata ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text',
                          )}
                        >
                          {t.respectata ? <Check strokeWidth={2.6} /> : <CircleAlert />}
                        </span>
                      }
                      title={t.nume}
                      detail={`${dataScurtaAnaliza(t.zi, azi)} · ${textPauzaInainte(t)}`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn('px-1 text-fg-muted', kitText.secondary)}>Niciun tratament notat pe aceste parcele în cele 30 de zile dinainte de prelevare.</p>
            )}
            <p className={cn('px-1 text-fg-muted', kitText.helper)}>Tratamentele vin singure din registru, ca să vezi dacă a fost ceva aproape de prelevare.</p>
          </div>
        ) : null}
      </BottomSheet>

      <RaportSheet
        analiza={analize.find((analiza) => analiza.id === props.raportDeschis) ?? null}
        onClose={() => props.onRaportDeschisChange(null)}
        poateScrie={poateScrie}
        esteProprietar={props.esteProprietar}
        onSchimbat={() => void queryClient.invalidateQueries({ queryKey: queryKeys.analize })}
      />
    </div>
  )
}
