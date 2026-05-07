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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'

import { getStadiuOptions } from '@/components/tratamente/plan-wizard/helpers'
import {
  createEmptyLineProduct,
  type PlanWizardLinieProdusDraft,
} from '@/components/tratamente/plan-wizard/types'

type ManualProductDraft = PlanWizardLinieProdusDraft & {
  save_in_library: boolean
  product_category: 'ingrasamant' | 'fitosanitar' | 'biostimulator' | 'amendament' | 'alt_produs'
  cantitate_text: string
}

interface ManualInterventieValue {
  stadiu_trigger: string
  tip_interventie_select: string
  tip_interventie_custom: string
  motiv_adaugare: string
  scop_select: string
  scop_custom: string
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
  { value: 'foliar', label: 'Foliar' },
  { value: 'fertirigare', label: 'Fertirigare' },
  { value: 'aplicare_sol', label: 'Aplicare pe sol' },
  { value: 'tratament_radacini', label: 'Tratament rădăcini (drenching)' },
  { value: 'badijonare', label: 'Badijonare tulpină' },
  { value: 'alt_tip', label: 'Alt tip' },
] as const

const SCOP_OPTIONS = [
  { value: 'fertilizare_baza', label: 'Fertilizare de bază' },
  { value: 'stimulare_inflorire', label: 'Stimulare înflorire' },
  { value: 'stimulare_fructificare', label: 'Stimulare fructificare' },
  { value: 'protectie_fungica', label: 'Protecție fungică' },
  { value: 'protectie_insecticida', label: 'Protecție insecticidă' },
  { value: 'corectare_carente', label: 'Corectare carențe' },
  { value: 'biostimulare', label: 'Biostimulare' },
  { value: 'dezinfectie_sol', label: 'Dezinfecție sol' },
  { value: 'alt_scop', label: 'Alt scop' },
] as const

const PRODUCT_TYPE_OPTIONS = [
  { value: 'ingrasamant', label: 'Îngrășământ / fertilizant' },
  { value: 'fitosanitar', label: 'Produs fitosanitar (fungicid, insecticid, erbicid)' },
  { value: 'biostimulator', label: 'Biostimulator' },
  { value: 'amendament', label: 'Amendament sol' },
  { value: 'alt_produs', label: 'Alt produs' },
] as const

function mapProductTypeToSnapshot(value: ManualProductDraft['product_category']): string {
  if (value === 'fitosanitar') return 'fungicid'
  if (value === 'ingrasamant') return 'ingrasamant'
  if (value === 'biostimulator') return 'bioregulator'
  return 'altul'
}

function mapTipInterventie(selectValue: string, custom: string): string {
  if (selectValue === 'alt_tip') return custom.trim()
  return TIP_INTERVENTIE_OPTIONS.find((option) => option.value === selectValue)?.label ?? ''
}

function mapScop(selectValue: string, custom: string): string {
  if (selectValue === 'alt_scop') return custom.trim()
  return SCOP_OPTIONS.find((option) => option.value === selectValue)?.label ?? ''
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function createManualProduct(nextOrdine: number): ManualProductDraft {
  return {
    ...createEmptyLineProduct(nextOrdine),
    save_in_library: true,
    product_category: 'fitosanitar',
    cantitate_text: '',
  }
}

function createInitialValue(): ManualInterventieValue {
  return {
    stadiu_trigger: '',
    tip_interventie_select: '',
    tip_interventie_custom: '',
    motiv_adaugare: '',
    scop_select: '',
    scop_custom: '',
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
  if (!mapTipInterventie(value.tip_interventie_select, value.tip_interventie_custom)) return 'Tipul intervenției este obligatoriu.'
  if (!mapScop(value.scop_select, value.scop_custom)) return 'Scopul intervenției este obligatoriu.'
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
  const missingCantitate = value.produse.find((produs) => !produs.cantitate_text.trim())
  if (missingCantitate) return 'Completează cantitatea aplicată pentru fiecare produs.'

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
          tip_snapshot: mapProductTypeToSnapshot(produs.product_category),
          frac_irac_snapshot: produs.frac_irac_snapshot?.trim() || null,
          phi_zile_snapshot: produs.phi_zile_snapshot ?? null,
          doza_ml_per_hl: null,
          doza_l_per_ha: null,
          cantitate_text: produs.cantitate_text.trim() || null,
          observatii: produs.observatii?.trim() || null,
        })
      }

      const payload: LinieInput = {
        stadiu_trigger: value.stadiu_trigger,
        cohort_trigger: null,
        sursa_linie: 'adaugata_manual',
        motiv_adaugare: value.motiv_adaugare.trim(),
        tip_interventie: mapTipInterventie(value.tip_interventie_select, value.tip_interventie_custom),
        scop: mapScop(value.scop_select, value.scop_custom) || null,
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
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'necunoscută'
      toast.error('Eroare la salvare: ' + message)
    } finally {
      setPending(false)
    }
  }

  const content = (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-4 pr-1 min-w-0">
      <div className="grid gap-4 md:grid-cols-2 min-w-0">
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

      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-linie-tip">Tip intervenție</Label>
        <Select
          value={value.tip_interventie_select || undefined}
          onValueChange={(next) =>
            setValue((current) => ({
              ...current,
              tip_interventie_select: next,
              tip_interventie_custom: next === 'alt_tip' ? current.tip_interventie_custom : '',
            }))
          }
        >
          <SelectTrigger id="manual-linie-tip" className="agri-control h-11 w-full rounded-xl px-3 text-sm">
            <SelectValue placeholder="Selectează tipul intervenției" />
          </SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)]">
            {TIP_INTERVENTIE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.tip_interventie_select === 'alt_tip' ? (
          <Input
            value={value.tip_interventie_custom}
            onChange={(event) =>
              setValue((current) => ({ ...current, tip_interventie_custom: event.target.value }))
            }
            placeholder="Specifică tipul"
          />
        ) : null}
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
        <Select
          value={value.scop_select || undefined}
          onValueChange={(next) =>
            setValue((current) => ({
              ...current,
              scop_select: next,
              scop_custom: next === 'alt_scop' ? current.scop_custom : '',
            }))
          }
        >
          <SelectTrigger id="manual-linie-scop" className="agri-control h-11 w-full rounded-xl px-3 text-sm">
            <SelectValue placeholder="Selectează scopul" />
          </SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)]">
            {SCOP_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.scop_select === 'alt_scop' ? (
          <Input
            value={value.scop_custom}
            onChange={(event) =>
              setValue((current) => ({ ...current, scop_custom: event.target.value }))
            }
            placeholder="Specifică scopul"
          />
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3 min-w-0">
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
              className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3 min-w-0 overflow-x-hidden"
            >
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                    Produs #{index + 1}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {getManualProductName(produs, produse)}
                  </p>
                </div>

                {value.produse.length >= 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
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

              <div className="space-y-2">
                <Label>Tip produs</Label>
                <Select
                  value={produs.product_category}
                  onValueChange={(next) =>
                    updateProduct(produs.id, (current) => ({
                      ...current,
                      product_category: next as ManualProductDraft['product_category'],
                      substanta_activa_snapshot:
                        next === 'fitosanitar' ? current.substanta_activa_snapshot : '',
                      frac_irac_snapshot: next === 'fitosanitar' ? current.frac_irac_snapshot : '',
                      phi_zile_snapshot: next === 'fitosanitar' ? current.phi_zile_snapshot : null,
                    }))
                  }
                >
                  <SelectTrigger className="agri-control h-11 w-full rounded-xl px-3 text-sm">
                    <SelectValue placeholder="Selectează tip produs" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)]">
                    {PRODUCT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {produs.product_category === 'fitosanitar' ? (
                <div className="grid gap-3 md:grid-cols-2 min-w-0">
                  <div className="space-y-2">
                    <Label htmlFor={`manual-substanta-${produs.id}`}>Substanță activă</Label>
                    <Input
                      id={`manual-substanta-${produs.id}`}
                      value={produs.substanta_activa_snapshot ?? ''}
                      onChange={(event) =>
                        updateProduct(produs.id, (current) => ({
                          ...current,
                          substanta_activa_snapshot: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`manual-frac-${produs.id}`}>FRAC/IRAC</Label>
                    <Input
                      id={`manual-frac-${produs.id}`}
                      value={produs.frac_irac_snapshot ?? ''}
                      onChange={(event) =>
                        updateProduct(produs.id, (current) => ({
                          ...current,
                          frac_irac_snapshot: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`manual-phi-${produs.id}`}>PHI zile</Label>
                    <Input
                      id={`manual-phi-${produs.id}`}
                      type="number"
                      min="0"
                      step="1"
                      value={produs.phi_zile_snapshot ?? ''}
                      onChange={(event) =>
                        updateProduct(produs.id, (current) => ({
                          ...current,
                          phi_zile_snapshot: parseOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 min-w-0">
                <div className="space-y-2">
                  <Label htmlFor={`manual-cantitate-${produs.id}`}>Cantitate aplicată</Label>
                  <Input
                    id={`manual-cantitate-${produs.id}`}
                    value={produs.cantitate_text}
                    placeholder="ex: 60 ml la 15 l apă, sau 200 ml/ha"
                    onChange={(event) =>
                      updateProduct(produs.id, (current) => ({
                        ...current,
                        cantitate_text: event.target.value,
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

      <div className="grid gap-4 md:grid-cols-2 min-w-0">
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
