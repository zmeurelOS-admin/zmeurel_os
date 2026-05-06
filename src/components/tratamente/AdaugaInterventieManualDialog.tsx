'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { addLinieAction, type LinieInput } from '@/app/(dashboard)/tratamente/planuri/[planId]/actions'
import { createProdusFitosanitarAction } from '@/app/(dashboard)/tratamente/produse-fitosanitare/actions'
import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { ProdusFitosanitarPicker } from '@/components/tratamente/ProdusFitosanitarPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { getCohortaLabel, type Cohorta } from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'

import { getStadiuOptions } from '@/components/tratamente/plan-wizard/helpers'
import {
  createEmptyLineProduct,
  type PlanWizardLinieProdusDraft,
} from '@/components/tratamente/plan-wizard/types'

type ManualProductDraft = PlanWizardLinieProdusDraft & {
  save_in_library: boolean
}

interface ManualInterventieValue {
  stadiu_trigger: string
  cohort_trigger: Cohorta | null
  tip_interventie: 'protectie' | 'nutritie' | 'biostimulare' | 'erbicidare' | 'igiena' | 'altul'
  motiv_adaugare: string
  scop: string
  regula_repetare: 'fara_repetare' | 'interval'
  interval_repetare_zile: number | null
  observatii: string
  produse: ManualProductDraft[]
}

interface AdaugaInterventieManualDialogProps {
  planId: string
  cultura: string
  grupBiologic: GrupBiologic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  produse: ProdusFitosanitar[]
}

const TIP_INTERVENTIE_OPTIONS = [
  { value: 'protectie', label: 'Protecție' },
  { value: 'nutritie', label: 'Nutriție' },
  { value: 'biostimulare', label: 'Biostimulare' },
  { value: 'igiena', label: 'Igienă' },
  { value: 'erbicidare', label: 'Erbicidare' },
  { value: 'altul', label: 'Altul' },
] as const

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function createManualProduct(nextOrdine: number): ManualProductDraft {
  return {
    ...createEmptyLineProduct(nextOrdine),
    save_in_library: true,
  }
}

function createInitialValue(): ManualInterventieValue {
  return {
    stadiu_trigger: '',
    cohort_trigger: null,
    tip_interventie: 'protectie',
    motiv_adaugare: '',
    scop: '',
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
    observatii: '',
    produse: [createManualProduct(1)],
  }
}

function withProductOrder(produse: ManualProductDraft[]) {
  return produse.map((produs, index) => ({ ...produs, ordine: index + 1 }))
}

function getValidationError(value: ManualInterventieValue): string | null {
  if (!value.stadiu_trigger.trim()) return 'Alege fenofaza.'
  if (!value.motiv_adaugare.trim()) return 'Motivul adăugării este obligatoriu.'
  if (value.produse.length === 0) return 'Adaugă cel puțin un produs.'

  const invalidProduct = value.produse.find((produs) => {
    const hasProdusId = typeof produs.produs_id === 'string' && produs.produs_id.trim().length > 0
    const hasManualName =
      typeof produs.produs_nume_manual === 'string' && produs.produs_nume_manual.trim().length > 0
    return !hasProdusId && !hasManualName
  })

  if (invalidProduct) {
    return 'Fiecare produs trebuie selectat din bibliotecă sau completat manual.'
  }

  if (
    value.regula_repetare === 'interval' &&
    typeof value.interval_repetare_zile !== 'number'
  ) {
    return 'Completează intervalul de repetare.'
  }

  return null
}

function getManualProductName(produs: ManualProductDraft, biblioteca: ProdusFitosanitar[]) {
  if (produs.produs_id) {
    return biblioteca.find((item) => item.id === produs.produs_id)?.nume_comercial ?? 'Produs selectat'
  }

  return produs.produs_nume_manual?.trim() || 'Produs nou'
}

export function AdaugaInterventieManualDialog({
  planId,
  cultura,
  grupBiologic,
  open,
  onOpenChange,
  onSuccess,
  produse,
}: AdaugaInterventieManualDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [value, setValue] = useState<ManualInterventieValue>(createInitialValue)
  const [pending, setPending] = useState(false)
  const stadiuOptions = useMemo(() => getStadiuOptions(grupBiologic), [grupBiologic])
  const validationError = getValidationError(value)
  const showCohorta = cultura.trim().toLowerCase() === 'zmeur'

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setValue(createInitialValue())
      setPending(false)
    })
  }, [open])

  const updateProduct = (
    productId: string,
    updater: (produs: ManualProductDraft) => ManualProductDraft
  ) => {
    setValue((current) => ({
      ...current,
      produse: withProductOrder(
        current.produse.map((produs) => (produs.id === productId ? updater(produs) : produs))
      ),
    }))
  }

  async function handleSubmit() {
    if (validationError) {
      toast.error(validationError)
      return
    }

    setPending(true)
    try {
      const produseFinale = []

      for (const produs of value.produse) {
        let produsId = produs.produs_id ?? null
        let produsNumeManual = produs.produs_nume_manual?.trim() || null
        let produsNumeSnapshot = produs.produs_nume_snapshot?.trim() || produsNumeManual

        if (!produsId && produsNumeManual && produs.save_in_library) {
          const created = await createProdusFitosanitarAction({
            nume_comercial: produsNumeManual,
            substanta_activa: '',
            tip: 'foliar',
            omologat_culturi: [cultura],
            activ: true,
          })

          produsId = created.id
          produsNumeManual = null
          produsNumeSnapshot = created.nume_comercial
        }

        produseFinale.push({
          ordine: produs.ordine,
          produs_id: produsId,
          produs_nume_manual: produsId ? null : produsNumeManual,
          produs_nume_snapshot: produsNumeSnapshot,
          substanta_activa_snapshot: produs.substanta_activa_snapshot?.trim() || null,
          tip_snapshot: produs.tip_snapshot?.trim() ? produs.tip_snapshot : null,
          frac_irac_snapshot: produs.frac_irac_snapshot?.trim() || null,
          phi_zile_snapshot: produs.phi_zile_snapshot ?? null,
          doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
          doza_l_per_ha: produs.doza_l_per_ha ?? null,
          observatii: produs.observatii?.trim() || null,
        })
      }

      const payload: LinieInput = {
        stadiu_trigger: value.stadiu_trigger,
        cohort_trigger: showCohorta ? value.cohort_trigger : null,
        sursa_linie: 'adaugata_manual',
        motiv_adaugare: value.motiv_adaugare.trim(),
        tip_interventie: value.tip_interventie,
        scop: value.scop.trim() || null,
        regula_repetare: value.regula_repetare,
        interval_repetare_zile:
          value.regula_repetare === 'interval' ? value.interval_repetare_zile : null,
        numar_repetari_max: null,
        observatii: value.observatii.trim() || null,
        produse: produseFinale,
        produs_id: produseFinale[0]?.produs_id ?? null,
        produs_nume_manual: produseFinale[0]?.produs_nume_manual ?? null,
        doza_ml_per_hl: produseFinale[0]?.doza_ml_per_hl ?? null,
        doza_l_per_ha: produseFinale[0]?.doza_l_per_ha ?? null,
      }

      const result = await addLinieAction(planId, payload)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Intervenția manuală a fost adăugată.')
      onOpenChange(false)
      onSuccess()
    } finally {
      setPending(false)
    }
  }

  const content = (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-4 pr-1">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manual-linie-stadiu">Fenofază</Label>
          <select
            id="manual-linie-stadiu"
            value={value.stadiu_trigger}
            onChange={(event) =>
              setValue((current) => ({ ...current, stadiu_trigger: event.target.value }))
            }
            className="agri-control h-11 w-full rounded-xl px-3 text-sm"
          >
            <option value="">Alege fenofaza</option>
            {stadiuOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
        </div>

        {showCohorta ? (
          <div className="space-y-2">
            <Label htmlFor="manual-linie-cohorta">Cohortă</Label>
            <select
              id="manual-linie-cohorta"
              value={value.cohort_trigger ?? ''}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  cohort_trigger: event.target.value
                    ? (event.target.value as Cohorta)
                    : null,
                }))
              }
              className="agri-control h-11 w-full rounded-xl px-3 text-sm"
            >
              <option value="">Ambele cohorte</option>
              <option value="floricane">{getCohortaLabel('floricane')}</option>
              <option value="primocane">{getCohortaLabel('primocane')}</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-linie-tip">Tip intervenție</Label>
        <select
          id="manual-linie-tip"
          value={value.tip_interventie}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              tip_interventie: event.target.value as ManualInterventieValue['tip_interventie'],
            }))
          }
          className="agri-control h-11 w-full rounded-xl px-3 text-sm"
        >
          {TIP_INTERVENTIE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-linie-motiv">Motiv adăugare</Label>
        <Textarea
          id="manual-linie-motiv"
          rows={3}
          value={value.motiv_adaugare}
          onChange={(event) =>
            setValue((current) => ({ ...current, motiv_adaugare: event.target.value }))
          }
          placeholder="Ex: carenţă calciu, atac Drosophila suzukii, risc Botrytis..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-linie-scop">Scop / titlu intervenție</Label>
        <Input
          id="manual-linie-scop"
          value={value.scop}
          onChange={(event) =>
            setValue((current) => ({ ...current, scop: event.target.value }))
          }
          placeholder="Ex: corecţie foliară calciu"
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3">
        <div className="space-y-1">
          <Label>Produse</Label>
          <p className="text-xs text-[var(--text-secondary)]">
            Selectează din bibliotecă sau completează manual și salvează ulterior în biblioteca fermei.
          </p>
        </div>

        {value.produse.map((produs, index) => {
          const selectedProduct = produse.find((item) => item.id === produs.produs_id) ?? null
          const showManualFields = !selectedProduct

          return (
            <div
              key={produs.id}
              className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                    Produs #{index + 1}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {getManualProductName(produs, produse)}
                  </p>
                </div>

                {value.produse.length >= 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Șterge produsul ${index + 1}`}
                    onClick={() =>
                      setValue((current) => ({
                        ...current,
                        produse: withProductOrder(
                          current.produse.filter((item) => item.id !== produs.id)
                        ),
                      }))
                    }
                  >
                    <X className="h-4 w-4 text-[var(--soft-danger-text)]" />
                  </Button>
                ) : null}
              </div>

              <ProdusFitosanitarPicker
                allowQuickCreate={false}
                label="Produs din bibliotecă"
                className="relative z-20 overflow-x-visible"
                popoverContentClassName="max-h-[40vh]"
                onChange={(selected) =>
                  updateProduct(produs.id, (current) => ({
                    ...current,
                    produs_id: selected?.id ?? null,
                    produs_nume_manual: selected ? '' : current.produs_nume_manual,
                    produs_nume_snapshot: selected?.nume_comercial ?? current.produs_nume_snapshot,
                    substanta_activa_snapshot: selected?.substanta_activa ?? current.substanta_activa_snapshot,
                    tip_snapshot: selected?.tip ?? current.tip_snapshot,
                    frac_irac_snapshot: selected?.frac_irac ?? current.frac_irac_snapshot,
                    phi_zile_snapshot: selected?.phi_zile ?? current.phi_zile_snapshot,
                  }))
                }
                produse={produse}
                value={produs.produs_id ?? null}
              />

              {showManualFields ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor={`manual-product-name-${produs.id}`}>Nume produs</Label>
                    <Input
                      id={`manual-product-name-${produs.id}`}
                      value={produs.produs_nume_manual ?? ''}
                      onChange={(event) =>
                        updateProduct(produs.id, (current) => ({
                          ...current,
                          produs_id: null,
                          produs_nume_manual: event.target.value,
                          produs_nume_snapshot: event.target.value,
                        }))
                      }
                      placeholder="Ex: Calciu foliar X"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={produs.save_in_library}
                      onChange={(event) =>
                        updateProduct(produs.id, (current) => ({
                          ...current,
                          save_in_library: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
                    />
                    Salvează în biblioteca mea
                  </label>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`manual-dose-ml-${produs.id}`}>Doză ml/hl</Label>
                  <Input
                    id={`manual-dose-ml-${produs.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={produs.doza_ml_per_hl ?? ''}
                    onChange={(event) =>
                      updateProduct(produs.id, (current) => ({
                        ...current,
                        doza_ml_per_hl: parseOptionalNumber(event.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`manual-dose-l-${produs.id}`}>Doză l/ha</Label>
                  <Input
                    id={`manual-dose-l-${produs.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={produs.doza_l_per_ha ?? ''}
                    onChange={(event) =>
                      updateProduct(produs.id, (current) => ({
                        ...current,
                        doza_l_per_ha: parseOptionalNumber(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`manual-product-notes-${produs.id}`}>Observații produs</Label>
                <Input
                  id={`manual-product-notes-${produs.id}`}
                  value={produs.observatii ?? ''}
                  onChange={(event) =>
                    updateProduct(produs.id, (current) => ({
                      ...current,
                      observatii: event.target.value,
                    }))
                  }
                  placeholder="Opțional"
                />
              </div>
            </div>
          )
        })}

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setValue((current) => ({
              ...current,
              produse: [...current.produse, createManualProduct(current.produse.length + 1)],
            }))
          }
        >
          <Plus className="h-4 w-4" />
          Adaugă alt produs
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manual-linie-regula">Regula repetare</Label>
          <select
            id="manual-linie-regula"
            value={value.regula_repetare}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                regula_repetare: event.target.value as ManualInterventieValue['regula_repetare'],
                interval_repetare_zile:
                  event.target.value === 'interval' ? current.interval_repetare_zile : null,
              }))
            }
            className="agri-control h-11 w-full rounded-xl px-3 text-sm"
          >
            <option value="fara_repetare">Fără repetare</option>
            <option value="interval">La interval</option>
          </select>
        </div>

        {value.regula_repetare === 'interval' ? (
          <div className="space-y-2">
            <Label htmlFor="manual-linie-interval">Interval zile</Label>
            <Input
              id="manual-linie-interval"
              type="number"
              min="1"
              step="1"
              value={value.interval_repetare_zile ?? ''}
              onChange={(event) =>
                setValue((current) => ({
                  ...current,
                  interval_repetare_zile: parseOptionalNumber(event.target.value),
                }))
              }
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-linie-observatii">Observații generale</Label>
        <Textarea
          id="manual-linie-observatii"
          rows={3}
          value={value.observatii}
          onChange={(event) =>
            setValue((current) => ({ ...current, observatii: event.target.value }))
          }
          placeholder="Opțional"
        />
      </div>

      {validationError ? (
        <p className="text-sm text-[var(--soft-danger-text)]">{validationError}</p>
      ) : null}
      </div>
    </div>
  )

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Anulează
      </Button>
      <Button type="button" onClick={handleSubmit} disabled={pending || Boolean(validationError)}>
        {pending ? 'Se salvează...' : 'Salvează intervenția'}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <AppDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Adaugă intervenție manuală"
        description="Intervenția se salvează în plan cu sursa «adăugată manual»."
        footer={footer}
      >
        {content}
      </AppDrawer>
    )
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă intervenție manuală"
      description="Intervenția se salvează în plan cu sursa «adăugată manual»."
      footer={footer}
      desktopFormWide
      showCloseButton
      contentClassName="md:w-[min(96vw,72rem)] md:max-w-none"
    >
      {content}
    </AppDialog>
  )
}
