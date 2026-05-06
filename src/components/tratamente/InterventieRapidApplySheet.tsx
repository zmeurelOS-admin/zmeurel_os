'use client'

import { useState, useTransition } from 'react'

import { markAplicataAction } from '@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions'
import { planificaInterventieRelevantaAction } from '@/app/(dashboard)/parcele/[id]/tratamente/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { colors } from '@/lib/design-tokens'
import type { InterventieProdusV2, InterventieRelevantaV2 } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

function buildProduseMarkPayload(produse: InterventieProdusV2[]) {
  return produse.map((p, index) => ({
    plan_linie_produs_id: p.id ?? null,
    ordine: p.ordine ?? index + 1,
    produs_id: p.produs_id ?? null,
    produs_nume_manual: p.produs_nume_manual?.trim() ? p.produs_nume_manual.trim() : null,
    produs_nume_snapshot: p.produs_nume_snapshot ?? p.produs?.nume_comercial ?? null,
    substanta_activa_snapshot: p.substanta_activa_snapshot ?? p.produs?.substanta_activa ?? null,
    tip_snapshot: p.tip_snapshot ?? p.produs?.tip ?? null,
    frac_irac_snapshot: p.frac_irac_snapshot ?? p.produs?.frac_irac ?? null,
    phi_zile_snapshot: p.phi_zile_snapshot ?? p.produs?.phi_zile ?? null,
    doza_ml_per_hl: p.doza_ml_per_hl ?? null,
    doza_l_per_ha: p.doza_l_per_ha ?? null,
    observatii: p.observatii?.trim() ? p.observatii.trim() : null,
  }))
}

function getInterventieTitlu(interventie: InterventieRelevantaV2): string {
  const first = interventie.produse_planificate[0]
  const prod =
    first?.produs?.nume_comercial ?? first?.produs_nume_snapshot ?? first?.produs_nume_manual ?? ''
  if (interventie.interventie.scop?.trim()) return interventie.interventie.scop.trim()
  if (prod) return interventie.produse_planificate.length > 1 ? `${prod} +${interventie.produse_planificate.length - 1}` : prod
  return 'Intervenție'
}

export interface InterventieRapidApplySheetProps {
  interventie: InterventieRelevantaV2 | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  open: boolean
  parcelaId: string
}

export function InterventieRapidApplySheet({
  interventie,
  onOpenChange,
  onSuccess,
  open,
  parcelaId,
}: InterventieRapidApplySheetProps) {
  const [doza, setDoza] = useState('')
  const [observatii, setObservatii] = useState('')
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setDoza('')
    setObservatii('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleConfirm = () => {
    if (!interventie) return
    const produsePayload = buildProduseMarkPayload(interventie.produse_planificate)
    if (produsePayload.length === 0) {
      toast.error('Intervenția nu are produse planificate.')
      return
    }

    startTransition(async () => {
      let aplicareId = interventie.aplicare_planificata?.id ?? null
      if (!aplicareId) {
        const fdPlan = new FormData()
        fdPlan.set('parcelaId', parcelaId)
        fdPlan.set('planLinieId', interventie.interventie.id)
        fdPlan.set(
          'dataPlanificata',
          interventie.urmatoarea_data_estimata ?? new Date().toISOString().slice(0, 10),
        )
        if (interventie.fenofaza_curenta?.cohort) {
          fdPlan.set('cohortLaAplicare', interventie.fenofaza_curenta.cohort)
        }
        const planRes = await planificaInterventieRelevantaAction(fdPlan)
        if (!planRes.ok) {
          toast.error(planRes.error)
          return
        }
        aplicareId = planRes.aplicareId
      }

      const stadiuLaAplicare =
        interventie.fenofaza_curenta?.stadiu ?? interventie.interventie.stadiu_trigger ?? ''
      const cohort =
        interventie.fenofaza_curenta?.cohort ?? interventie.interventie.cohort_trigger ?? undefined

      const noteParts = [doza.trim() ? `Doză aplicată: ${doza.trim()}` : null, observatii.trim() || null].filter(
        Boolean,
      ) as string[]
      const observatiiFinal = noteParts.join('\n').trim()

      const fdMark = new FormData()
      fdMark.set('aplicareId', aplicareId)
      fdMark.set('parcelaId', parcelaId)
      fdMark.set('data_aplicata', new Date().toISOString())
      fdMark.set('stadiu_la_aplicare', stadiuLaAplicare)
      if (cohort) fdMark.set('cohort_la_aplicare', cohort)
      fdMark.set('observatii', observatiiFinal)
      fdMark.set('produse', JSON.stringify(produsePayload))

      const markRes = await markAplicataAction(fdMark)
      if (!markRes.ok) {
        toast.error(markRes.error)
        return
      }

      toast.success('Aplicarea a fost înregistrată.')
      reset()
      onOpenChange(false)
      onSuccess()
    })
  }

  const titlu = interventie ? getInterventieTitlu(interventie) : ''

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle className="text-base">Aplică acum</SheetTitle>
        </SheetHeader>

        {interventie ? (
          <div className="space-y-4 px-4 pb-2">
            <div
              className="rounded-xl border border-[color:color-mix(in_srgb,var(--agri-primary)_22%,transparent)] p-3 text-sm"
              style={{ background: colors.greenLight }}
            >
              <p className="font-bold text-[var(--text-primary)]">{titlu}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{interventie.plan.nume}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rapid-doza">Doză aplicată</Label>
              <Input
                id="rapid-doza"
                placeholder="ex. 2.5 kg/ha"
                value={doza}
                onChange={(e) => setDoza(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rapid-obs">Observații (opțional)</Label>
              <Textarea
                id="rapid-obs"
                placeholder="Note scurte despre aplicare…"
                value={observatii}
                onChange={(e) => setObservatii(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : null}

        <SheetFooter className="mt-2 border-t-0 bg-transparent">
          <Button
            type="button"
            className="w-full bg-[var(--agri-primary)] text-white hover:bg-[var(--agri-primary)]/90"
            disabled={pending || !interventie}
            onClick={handleConfirm}
          >
            ✓ Confirmă aplicarea
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
