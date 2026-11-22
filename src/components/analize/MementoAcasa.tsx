'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { BottomSheet, Button, FilterPills, ListRow, Notice, kitText } from '@/components/kit'
import { textParceleAnaliza } from '@/lib/analize/lista'
import { neconformeInSezon } from '@/lib/analize/lista'
import {
  AMANARE_IMPLICITA,
  AMANARI_POSIBILE,
  linkAnalizaNoua,
  textEstimat,
  textParceleMemento,
  textProdusDeEvitat,
  titluCardMemento,
  titluFoaieMemento,
} from '@/lib/analize/memento'
import { useMementoAnalize } from '@/lib/analize/useMementoAnalize'
import { queryKeys } from '@/lib/query-keys'
import { amanaMemento, setNuFacAnalizeAnulAcesta } from '@/lib/supabase/queries/analize'
import { zileText } from '@/lib/tratamente/zile'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

/**
 * Acasă: cardul „Analiza la fructe · culesul în N zile” (primul, doar pentru proprietar, până la trimitere, amânare
 * sau dezactivare), foaia „Analiza dinainte de cules” (din card sau din notificare: `/dashboard?memento=analize`)
 * și avertizarea roșie pentru o analiză neconformă.
 */
export function MementoAcasa({ azi, proprietar }: { azi: string | null; proprietar: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const memento = useMementoAnalize(azi, { proprietar })
  const [foaie, setFoaie] = useState(false)
  const [zile, setZile] = useState<number>(AMANARE_IMPLICITA)
  const [busy, setBusy] = useState<'amana' | 'nu' | null>(null)

  // Atinsă, notificarea deschide foaia (`?memento=analize`).
  const dinNotificare = searchParams.get('memento') === 'analize'
  useEffect(() => {
    if (!dinNotificare || !memento.calcul) return
    queueMicrotask(() => {
      if (memento.calcul?.activ) setFoaie(true)
      router.replace('/dashboard', { scroll: false })
    })
  }, [dinNotificare, memento.calcul, router])

  const calcul = memento.calcul
  const an = azi?.slice(0, 4) ?? ''
  const neconforme = azi ? neconformeInSezon(memento.analize, an) : []

  const amintire = async (actiune: 'amana' | 'nu') => {
    if (busy) return
    setBusy(actiune)
    try {
      if (actiune === 'amana') await amanaMemento(zile)
      else await setNuFacAnalizeAnulAcesta(true)
      await queryClient.invalidateQueries({ queryKey: queryKeys.mementoAnalize(Number(an)) })
      setFoaie(false)
      toast.success(actiune === 'amana' ? `Îți amintesc peste ${zileText(zile)}.` : 'Nu-ți mai amintesc de analize anul acesta.')
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'Nu s-a salvat. Încearcă din nou.')
    } finally {
      setBusy(null)
    }
  }

  const amTrimis = () => {
    const link = linkAnalizaNoua(calcul?.parcele.map((p) => p.parcelaId) ?? [])
    setFoaie(false)
    window.setTimeout(() => router.push(link), foaie ? 180 : 0)
  }

  const parcele = calcul ? textParceleMemento(calcul.parcele.map((p) => p.nume)) : ''

  return (
    <>
      {neconforme.map((analiza) => (
        <Notice
          key={analiza.id}
          tone="danger"
          icon={<CircleAlert aria-hidden />}
          title={`Analiză neconformă · ${textParceleAnaliza(analiza.parcele, memento.numeParcele)}`}
          action={
            <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => router.push('/tratamente?tab=analize')}>
              Vezi analiza
            </Button>
          }
        >
          Nu culege și nu vinde din aceste parcele până nu vorbești cu laboratorul. Fără raport public pentru această analiză.
        </Notice>
      ))}

      {calcul?.activ && calcul.zileRamase !== null ? (
        <Notice
          tone="warning"
          title={titluCardMemento(calcul.zileRamase)}
          action={
            <div className="grid grid-cols-2 gap-2.5">
              <Button type="button" variant="neutral" size="touch" onClick={amTrimis}>
                Am trimis
              </Button>
              <Button type="button" variant="neutral" size="touch" onClick={() => setFoaie(true)}>
                Amână
              </Button>
            </div>
          }
        >
          {`${parcele}. Nu e trimisă încă.`}
        </Notice>
      ) : null}

      <BottomSheet
        open={foaie && Boolean(calcul?.activ)}
        onOpenChange={setFoaie}
        title="Analiza dinainte de cules"
        footer={
          <div className="flex flex-col gap-2.5">
            <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={amTrimis}>
              Am trimis la analize
            </Button>
            <Button type="button" variant="neutral" size="touch" className="w-full" loading={busy === 'amana'} onClick={() => void amintire('amana')}>
              Amână {zileText(zile)}
            </Button>
            <Button type="button" variant="quiet" size="touch" className="w-full" loading={busy === 'nu'} onClick={() => void amintire('nu')}>
              Nu fac analize anul acesta
            </Button>
          </div>
        }
      >
        {calcul && calcul.zileRamase !== null && calcul.dataCules ? (
          <div className="space-y-3">
            <Notice tone="warning" title={titluFoaieMemento(calcul.zileRamase)}>
              {`${parcele} · ${textEstimat(calcul.dataCules)}`}
            </Notice>
            <h3 className={cn('font-bold text-fg', kitText.secondary)}>Produse de evitat acum</h3>
            {memento.produse.length > 0 ? (
              <ul className="space-y-2">
                {memento.produse.map((produs) => (
                  <li key={produs.nume}>
                    <ListRow
                      avatar={false}
                      leading={
                        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-control bg-warning-bg font-extrabold text-warning-text">
                          !
                        </span>
                      }
                      title={produs.nume}
                      detail={textProdusDeEvitat(produs)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn('text-fg-muted', kitText.secondary)}>Niciun produs din fermă nu are pauza mai lungă decât zilele rămase.</p>
            )}
            <h3 id="amana-titlu" className={cn('font-bold text-fg', kitText.secondary)}>
              Amână
            </h3>
            <FilterPills
              aria-label="Cu câte zile amân"
              options={AMANARI_POSIBILE.map((n) => ({ value: String(n), label: zileText(n) }))}
              value={String(zile)}
              onValueChange={(value) => setZile(Number(value))}
            />
          </div>
        ) : null}
      </BottomSheet>
    </>
  )
}
