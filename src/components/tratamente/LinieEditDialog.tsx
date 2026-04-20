'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { getCohortaLabel, type Cohorta } from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { cn } from '@/lib/utils'

import {
  filterProduseForCulture,
  getStadiuOptions,
  inferDoseUnitFromProduct,
  suggestDoseFromProduct,
} from '@/components/tratamente/plan-wizard/helpers'

export type LinieEditValue = {
  stadiu_trigger: string
  cohort_trigger: Cohorta | null
  produs_id: string | null
  produs_nume_manual: string | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  observatii: string | null
}

interface LinieEditDialogProps {
  allowCohortTrigger?: boolean
  culturaTip: string
  grupBiologic?: GrupBiologic | null
  initialValue: LinieEditValue
  onOpenChange: (open: boolean) => void
  onSubmit: (data: LinieEditValue) => Promise<void> | void
  open: boolean
  pending?: boolean
  produse: ProdusFitosanitar[]
  title: string
}

function getValidationError(value: LinieEditValue): string | null {
  const hasProdusId = typeof value.produs_id === 'string' && value.produs_id.trim().length > 0
  const hasManualName =
    typeof value.produs_nume_manual === 'string' && value.produs_nume_manual.trim().length > 0
  const hasMl = typeof value.doza_ml_per_hl === 'number' && value.doza_ml_per_hl > 0
  const hasL = typeof value.doza_l_per_ha === 'number' && value.doza_l_per_ha > 0

  if (!value.stadiu_trigger.trim()) return 'Alege stadiul fenologic.'
  if (!hasProdusId && !hasManualName) return 'Alege un produs sau completează numele manual.'
  if (hasMl === hasL) return 'Completează o singură doză: ml/hl sau l/ha.'
  return null
}

export function LinieEditDialog({
  allowCohortTrigger = false,
  culturaTip,
  grupBiologic,
  initialValue,
  onOpenChange,
  onSubmit,
  open,
  pending = false,
  produse,
  title,
}: LinieEditDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [value, setValue] = useState<LinieEditValue>(initialValue)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [showAllProducts, setShowAllProducts] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
    setPopoverOpen(false)
    setShowAllProducts(false)
  }, [initialValue, open])

  const selectedProduct = useMemo(
    () => produse.find((produs) => produs.id === value.produs_id) ?? null,
    [produse, value.produs_id]
  )
  const stadiuOptions = useMemo(() => getStadiuOptions(grupBiologic), [grupBiologic])

  const produseFiltrate = useMemo(
    () => filterProduseForCulture(produse, culturaTip, showAllProducts, ''),
    [culturaTip, produse, showAllProducts]
  )

  const unitate = typeof value.doza_l_per_ha === 'number' && value.doza_l_per_ha > 0 ? 'l/ha' : 'ml/hl'
  const validationError = getValidationError(value)

  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="linie-stadiu-select">Stadiu fenologic</Label>
        <select
          id="linie-stadiu-select"
          value={value.stadiu_trigger}
          onChange={(event) => setValue((current) => ({ ...current, stadiu_trigger: event.target.value }))}
          className="agri-control h-11 w-full rounded-xl px-3 text-sm"
        >
          <option value="">Alege stadiul</option>
          {stadiuOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.emoji} {option.label}
            </option>
          ))}
        </select>
      </div>

      {allowCohortTrigger ? (
        <div className="space-y-2">
          <Label htmlFor="linie-cohorta-select">Cohortă vizată</Label>
          <select
            id="linie-cohorta-select"
            value={value.cohort_trigger ?? ''}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                cohort_trigger: event.target.value ? (event.target.value as Cohorta) : null,
              }))
            }
            className="agri-control h-11 w-full rounded-xl px-3 text-sm"
          >
            <option value="">Ambele cohorte</option>
            <option value="floricane">Doar {getCohortaLabel('floricane')}</option>
            <option value="primocane">Doar {getCohortaLabel('primocane')}</option>
          </select>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Produs din bibliotecă</Label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={popoverOpen}
                aria-label="Selectează produsul"
                className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-left text-sm text-[var(--text-primary)]"
              >
                <span className="truncate">
                  {selectedProduct?.nume_comercial ?? 'Alege produsul'}
                </span>
                <ChevronsUpDown className="h-4 w-4 text-[var(--text-secondary)]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(92vw,360px)] p-0">
              <div className="border-b px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={showAllProducts}
                    onChange={(event) => setShowAllProducts(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
                  />
                  Arată toate produsele
                </label>
              </div>
              <Command>
                <CommandInput placeholder="Caută după nume sau substanță activă…" />
                <CommandList>
                  <CommandEmpty>Nu am găsit produse potrivite.</CommandEmpty>
                  <CommandGroup heading="Bibliotecă produse">
                    {produseFiltrate.map((produs) => (
                      <CommandItem
                        key={produs.id}
                        value={`${produs.nume_comercial} ${produs.substanta_activa ?? ''} ${produs.frac_irac ?? ''}`}
                        onSelect={() => {
                          const nextUnit = inferDoseUnitFromProduct(produs)
                          const suggestedDose = suggestDoseFromProduct(produs, nextUnit)
                          setValue((current) => ({
                            ...current,
                            produs_id: produs.id,
                            produs_nume_manual: null,
                            doza_ml_per_hl: nextUnit === 'ml/hl' ? suggestedDose ?? current.doza_ml_per_hl : null,
                            doza_l_per_ha: nextUnit === 'l/ha' ? suggestedDose ?? current.doza_l_per_ha : null,
                          }))
                          setPopoverOpen(false)
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[var(--text-primary)] [font-weight:650]">
                            {produs.nume_comercial}
                          </p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {produs.substanta_activa ?? 'Substanță activă nespecificată'}
                          </p>
                        </div>
                        {value.produs_id === produs.id ? <Check className="h-4 w-4" /> : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-primary)] [font-weight:650]">
                {selectedProduct?.nume_comercial ?? 'Fără produs selectat'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {selectedProduct?.substanta_activa ?? 'Poți completa și numele manual în câmpul de mai jos.'}
              </p>
            </div>
            {selectedProduct ? (
              <button
                type="button"
                className="text-xs [font-weight:650] text-[var(--agri-primary)]"
                onClick={() =>
                  setValue((current) => ({
                    ...current,
                    produs_id: null,
                  }))
                }
              >
                Elimină
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {!selectedProduct ? (
        <div className="space-y-2">
          <Label htmlFor="linie-produs-manual">Nume produs manual</Label>
          <Input
            id="linie-produs-manual"
            value={value.produs_nume_manual ?? ''}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                produs_id: null,
                produs_nume_manual: event.target.value,
              }))
            }
            placeholder="Ex: Produs local / lot test"
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <Label>Unitate doză</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['ml/hl', 'l/ha'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              aria-label={`Setează doza în ${unit}`}
              className={cn(
                'rounded-2xl border px-3 py-3 text-sm [font-weight:650] transition',
                unitate === unit
                  ? 'border-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_10%,white)] text-[var(--agri-primary)]'
                  : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
              )}
              onClick={() => {
                const suggested = suggestDoseFromProduct(selectedProduct, unit)
                setValue((current) => ({
                  ...current,
                  doza_ml_per_hl: unit === 'ml/hl' ? suggested ?? current.doza_ml_per_hl ?? null : null,
                  doza_l_per_ha: unit === 'l/ha' ? suggested ?? current.doza_l_per_ha ?? null : null,
                }))
              }}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="linie-doza-input">Doză</Label>
        <Input
          id="linie-doza-input"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={
            unitate === 'ml/hl'
              ? (value.doza_ml_per_hl ?? '')
              : (value.doza_l_per_ha ?? '')
          }
          onChange={(event) => {
            const parsed = Number(event.target.value.replace(',', '.'))
            setValue((current) => ({
              ...current,
              doza_ml_per_hl: unitate === 'ml/hl' && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
              doza_l_per_ha: unitate === 'l/ha' && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
            }))
          }}
          placeholder={unitate === 'ml/hl' ? 'Ex: 500' : 'Ex: 2'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="linie-observatii-input">Observații</Label>
        <Textarea
          id="linie-observatii-input"
          rows={4}
          value={value.observatii ?? ''}
          onChange={(event) => setValue((current) => ({ ...current, observatii: event.target.value }))}
          placeholder="Note despre aplicare, produse sau ordinea tratamentului."
        />
      </div>

      {validationError ? (
        <p className="text-sm text-[var(--soft-danger-text)]">{validationError}</p>
      ) : null}
    </div>
  )

  const footer = (
    <DialogFormActions
      onCancel={() => onOpenChange(false)}
      onSave={async () => {
        await onSubmit(value)
      }}
      saving={pending}
      disabled={pending || Boolean(validationError)}
      saveLabel="Salvează linia"
    />
  )

  if (isMobile) {
    return (
      <AppDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description="Alege stadiul, produsul și doza pentru această linie."
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
      title={title}
      description="Alege stadiul, produsul și doza pentru această linie."
      footer={footer}
    >
      {content}
    </AppDialog>
  )
}
