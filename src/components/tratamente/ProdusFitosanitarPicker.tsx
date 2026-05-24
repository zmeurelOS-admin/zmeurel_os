'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'
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
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AppSelect } from '@/components/ui/app-select'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import type { InsertTenantProdus, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import {
  findProdusFitosanitarLibraryMatch,
  sortProduseFitosanitareForLibrary,
} from '@/lib/tratamente/produse-fitosanitare-ui'
import { PRODUS_FITOSANITAR_TIP_APP_SELECT_OPTIONS } from '@/lib/ui/app-select-maps'

const TIP_OPTIONS = PRODUS_FITOSANITAR_TIP_APP_SELECT_OPTIONS

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

interface QuickCreateState {
  nume_comercial: string
  substanta_activa: string
  tip: InsertTenantProdus['tip']
  frac_irac: string
  phi_zile: string
  activ: boolean
}

const QUICK_CREATE_DEFAULTS: QuickCreateState = {
  nume_comercial: '',
  substanta_activa: '',
  tip: 'fungicid',
  frac_irac: '',
  phi_zile: '',
  activ: true,
}

interface ProdusFitosanitarPickerProps {
  activeLabel?: string
  allowQuickCreate?: boolean
  className?: string
  helpText?: string
  includeInactiveByDefault?: boolean
  inlineMode?: boolean
  label?: string
  onChange: (produs: ProdusFitosanitar | null) => void
  onCreateProduct?: (data: InsertTenantProdus) => Promise<ProdusFitosanitar>
  placeholder?: string
  /** Padding față de marginile viewportului la poziționare (dialog îngust / footer vizibil). */
  popoverCollisionPadding?: number
  /** De ex. max-height mai mic în dialoguri ca lista să nu acopere butoanele finale. */
  popoverContentClassName?: string
  selectedLabel?: string | null
  produse: ProdusFitosanitar[]
  value: string | null
}

export function ProdusFitosanitarPicker({
  activeLabel = 'Activ',
  allowQuickCreate = true,
  className,
  helpText = 'Caută după nume, substanță activă, FRAC/IRAC sau tip. Produsele active apar primele.',
  includeInactiveByDefault = false,
  inlineMode = false,
  label,
  onChange,
  onCreateProduct,
  placeholder = 'Alege din bibliotecă',
  popoverCollisionPadding = 16,
  popoverContentClassName,
  selectedLabel,
  produse,
  value,
}: ProdusFitosanitarPickerProps) {
  const [open, setOpen] = useState(false)
  const [showInactive, setShowInactive] = useState(includeInactiveByDefault)
  const [searchValue, setSearchValue] = useState('')
  const [entryMode, setEntryMode] = useState<'library' | 'manual'>('library')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<QuickCreateState>(QUICK_CREATE_DEFAULTS)
  const [draftError, setDraftError] = useState<string | null>(null)

  const selectedProduct = useMemo(
    () => sortProduseFitosanitareForLibrary(produse).find((produs) => produs.id === value) ?? null,
    [produse, value]
  )

  const orderedProducts = useMemo(() => sortProduseFitosanitareForLibrary(produse), [produse])
  const visibleProducts = useMemo(
    () => orderedProducts.filter((produs) => showInactive || produs.activ),
    [orderedProducts, showInactive]
  )
  const activeProducts = visibleProducts.filter((produs) => produs.activ)
  const inactiveProducts = visibleProducts.filter((produs) => !produs.activ)
  const filteredProducts = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) return visibleProducts
    return visibleProducts.filter((produs) =>
      `${produs.nume_comercial} ${produs.substanta_activa ?? ''} ${produs.frac_irac ?? ''} ${produs.tip ?? ''}`
        .toLowerCase()
        .includes(query)
    )
  }, [searchValue, visibleProducts])
  const filteredActiveProducts = filteredProducts.filter((produs) => produs.activ)
  const filteredInactiveProducts = filteredProducts.filter((produs) => !produs.activ)

  useEffect(() => {
    if (open) {
      setShowInactive(includeInactiveByDefault)
    }
  }, [includeInactiveByDefault, open])

  useEffect(() => {
    if (selectedProduct) {
      setEntryMode('library')
    }
  }, [selectedProduct])

  useEffect(() => {
    if (!createOpen) {
      setDraft(QUICK_CREATE_DEFAULTS)
      setDraftError(null)
    }
  }, [createOpen])

  const handleSelect = (produs: ProdusFitosanitar | null) => {
    onChange(produs)
    if (produs) setEntryMode('library')
    setOpen(false)
  }

  const getTypeBadgeClassName = (tip: ProdusFitosanitar['tip']) => {
    if (tip === 'fungicid') return 'bg-[#FFF3E0] text-[#E65100]'
    if (tip === 'insecticid') return 'bg-[#FCE4EC] text-[#C62828]'
    if (tip === 'ingrasamant' || tip === 'foliar') return 'bg-[#E3F2FD] text-[#1565C0]'
    if (tip === 'bioregulator') return 'bg-[#E8F5EE] text-[#2A6B47]'
    return 'bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
  }

  const renderInlineList = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-10 rounded-full text-sm',
            entryMode === 'library'
              ? 'border-[#3D7A5F] bg-[#3D7A5F] text-white hover:bg-[#3D7A5F] hover:text-white'
              : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
          )}
          onClick={() => setEntryMode('library')}
        >
          Din bibliotecă
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-10 rounded-full text-sm',
            entryMode === 'manual'
              ? 'border-[#3D7A5F] bg-[#3D7A5F] text-white hover:bg-[#3D7A5F] hover:text-white'
              : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
          )}
          onClick={() => {
            setEntryMode('manual')
            onChange(null)
          }}
        >
          Adaugă manual
        </Button>
      </div>

      {entryMode === 'library' ? (
        <>
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Caută după nume, substanță, FRAC/IRAC..."
            className="h-11 text-[16px]"
          />

          <div className="max-h-[clamp(12rem,35vh,20rem)] space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] p-2">
            {filteredProducts.length === 0 ? (
              <p className="px-2 py-1 text-sm text-[var(--text-secondary)]">
                Nu am găsit produse care să se potrivească.
              </p>
            ) : null}

            {filteredActiveProducts.length > 0 ? (
              <div className="space-y-2">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  Bibliotecă activă
                </p>
                {filteredActiveProducts.map((produs) => {
                  const isSelected = selectedProduct?.id === produs.id
                  return (
                    <button
                      key={produs.id}
                      type="button"
                      onClick={() => handleSelect(produs)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-left',
                        isSelected
                          ? 'border-[#3D7A5F] bg-[#F0F7F4]'
                          : 'border-[var(--border-default)] bg-[var(--surface-card)]'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {produs.nume_comercial}
                            </p>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]',
                                getTypeBadgeClassName(produs.tip)
                              )}
                            >
                              {produs.tip}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                            {produs.substanta_activa || 'Substanță activă nespecificată'}
                            {produs.frac_irac ? ` · ${produs.frac_irac}` : ''}
                          </p>
                        </div>
                        {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3D7A5F]" /> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {filteredInactiveProducts.length > 0 ? (
              <div className="space-y-2">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  Bibliotecă inactivă
                </p>
                {filteredInactiveProducts.map((produs) => {
                  const isSelected = selectedProduct?.id === produs.id
                  return (
                    <button
                      key={produs.id}
                      type="button"
                      onClick={() => handleSelect(produs)}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-left',
                        isSelected
                          ? 'border-[#3D7A5F] bg-[#F0F7F4]'
                          : 'border-[var(--border-default)] bg-[var(--surface-card)]'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {produs.nume_comercial}
                            </p>
                            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-card-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]">
                              Inactiv
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                            {produs.substanta_activa || 'Substanță activă nespecificată'}
                            {produs.frac_irac ? ` · ${produs.frac_irac}` : ''}
                          </p>
                        </div>
                        {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3D7A5F]" /> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-2 px-1 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
            />
            Arată și inactive
          </label>
        </>
      ) : (
        <p className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
          Completează manual numele produsului în câmpul de mai jos.
        </p>
      )}
    </div>
  )

  const handleQuickCreate = async () => {
    if (!onCreateProduct) return

    const nume = draft.nume_comercial.trim()
    const substanta = draft.substanta_activa.trim()
    if (!nume) {
      setDraftError('Numele comercial este obligatoriu.')
      return
    }
    if (!substanta) {
      setDraftError('Substanța activă este obligatorie.')
      return
    }

    const duplicate = findProdusFitosanitarLibraryMatch(produse, nume, substanta)
    if (duplicate) {
      onChange(duplicate)
      setCreateOpen(false)
      setOpen(false)
      toast.info('Produsul exista deja în bibliotecă și a fost selectat.')
      return
    }

    setCreating(true)
    setDraftError(null)
    try {
      const created = await onCreateProduct({
        nume_comercial: nume,
        substanta_activa: substanta,
        tip: draft.tip,
        frac_irac: draft.frac_irac.trim() || null,
        phi_zile: parseOptionalNumber(draft.phi_zile),
        activ: draft.activ,
      })
      onChange(created)
      setCreateOpen(false)
      setOpen(false)
      toast.success('Produs adăugat în biblioteca fermei.')
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Eroare la salvarea produsului.')
    } finally {
      setCreating(false)
    }
  }

  const triggerLabel = selectedProduct
    ? selectedProduct.nume_comercial
    : selectedLabel?.trim() || placeholder

  const triggerSecondary = selectedProduct
    ? `${selectedProduct.substanta_activa || 'Substanță nedefinită'} · ${selectedProduct.tip || 'Tip nedefinit'}`
    : selectedLabel?.trim()
      ? 'Selectat din istoricul intervenției'
      : 'Selectează sau treci pe nume manual'

  return (
    <>
      <div className={cn('relative space-y-2 overflow-x-visible', className)}>
        {label ? <Label>{label}</Label> : null}

        {inlineMode ? (
          renderInlineList()
        ) : (
          <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-auto min-h-11 flex-1 justify-between gap-3 py-2 text-left',
                    selectedProduct ? 'border-[var(--border-default)]' : ''
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm [font-weight:650] text-[var(--text-primary)]">
                      {triggerLabel}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-secondary)]">
                      {triggerSecondary}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                align="start"
                collisionPadding={popoverCollisionPadding}
                className={cn(
                  'z-[1400] flex max-h-[50vh] w-full max-w-full min-w-0 flex-col overflow-hidden p-0 md:max-h-[40vh] md:w-[min(94vw,460px)]',
                  popoverContentClassName,
                )}
              >
                <PopoverHeader className="shrink-0 border-b px-4 py-3">
                  <PopoverTitle>Alege produsul din bibliotecă</PopoverTitle>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {helpText}
                  </p>
                </PopoverHeader>

              <Command className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden !h-auto [&_[data-slot=command-input-wrapper]]:w-full [&_[data-slot=command-input-wrapper]]:min-w-0 [&_[data-slot=command-input-wrapper]]:shrink-0">
                <CommandInput placeholder="Caută produs..." />
                <CommandList
                  className="min-h-0 max-h-[50vh] flex-1 overflow-y-auto overscroll-contain pr-1 md:max-h-[40vh]"
                  onWheel={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <CommandEmpty>Nu am găsit produse care să se potrivească.</CommandEmpty>

                  <CommandGroup heading="Bibliotecă activă">
                    {activeProducts.map((produs) => (
                      <CommandItem
                        key={produs.id}
                        value={`${produs.nume_comercial} ${produs.substanta_activa ?? ''} ${produs.frac_irac ?? ''} ${produs.tip ?? ''}`}
                        onSelect={() => handleSelect(produs)}
                        className="items-start py-3"
                      >
                        <Check className={cn('mt-0.5 h-4 w-4 shrink-0', selectedProduct?.id === produs.id ? 'opacity-100' : 'opacity-0')} />
                        <div className="min-w-0 flex-1">
                          <div className="flex w-full min-w-0 items-start gap-2">
                            <p className="block min-w-0 flex-1 break-words text-sm font-medium text-[var(--text-primary)]">
                              {produs.nume_comercial}
                            </p>
                            <span className="ml-auto inline-flex shrink-0 items-center rounded-full bg-[var(--status-success-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--status-success-text)]">
                              {activeLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 block break-words text-xs text-muted-foreground">
                            {produs.substanta_activa || 'Substanță activă nespecificată'}
                            {produs.frac_irac ? ` · ${produs.frac_irac}` : ''}
                            {produs.tip ? ` · ${produs.tip}` : ''}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  {inactiveProducts.length > 0 ? (
                    <CommandGroup heading="Bibliotecă inactivă">
                      {inactiveProducts.map((produs) => (
                        <CommandItem
                          key={produs.id}
                          value={`${produs.nume_comercial} ${produs.substanta_activa ?? ''} ${produs.frac_irac ?? ''} ${produs.tip ?? ''}`}
                          onSelect={() => handleSelect(produs)}
                          className="items-start py-3"
                        >
                          <Check className={cn('mt-0.5 h-4 w-4 shrink-0', selectedProduct?.id === produs.id ? 'opacity-100' : 'opacity-0')} />
                          <div className="min-w-0 flex-1">
                            <div className="flex w-full min-w-0 items-start gap-2">
                              <p className="block min-w-0 flex-1 break-words text-sm font-medium text-[var(--text-primary)]">
                                {produs.nume_comercial}
                              </p>
                              <span className="ml-auto inline-flex shrink-0 items-center rounded-full bg-[var(--surface-card-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                                Inactiv
                              </span>
                            </div>
                            <p className="mt-0.5 block break-words text-xs text-muted-foreground">
                              {produs.substanta_activa || 'Substanță activă nespecificată'}
                              {produs.frac_irac ? ` · ${produs.frac_irac}` : ''}
                              {produs.tip ? ` · ${produs.tip}` : ''}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  <CommandGroup heading="Acțiuni rapide">
                    <CommandItem
                      value="text manual produs"
                      onSelect={() => handleSelect(null)}
                      className="py-3"
                    >
                      <Search className="h-4 w-4" />
                      <span>Folosește nume manual</span>
                    </CommandItem>

                    {selectedProduct ? (
                      <CommandItem
                        value="clear selection"
                        onSelect={() => handleSelect(null)}
                        className="py-3"
                      >
                        <X className="h-4 w-4" />
                        <span>Curăță selecția actuală</span>
                      </CommandItem>
                    ) : null}

                    {allowQuickCreate && onCreateProduct ? (
                      <CommandItem
                        value="create new product"
                        onSelect={() => {
                          setCreateOpen(true)
                          setOpen(false)
                        }}
                        className="py-3"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Adaugă produs în bibliotecă</span>
                      </CommandItem>
                    ) : null}
                  </CommandGroup>
                </CommandList>
              </Command>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 text-xs text-[var(--text-secondary)]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(event) => setShowInactive(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
                  />
                  Arată și inactive
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelect(null)}
                >
                  Manual
                </Button>
              </div>
              </PopoverContent>
            </Popover>

            {selectedProduct ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Curăță produsul selectat"
                onClick={() => handleSelect(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Adaugă produs în biblioteca fermei"
        description="Creează rapid un produs reutilizabil în biblioteca tenantului. Nu este o recomandare comercială a platformei."
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Anulează
            </Button>
            <Button type="button" onClick={handleQuickCreate} disabled={creating || !onCreateProduct}>
              {creating ? 'Se salvează...' : 'Salvează în bibliotecă'}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--surface-card-muted)] p-3 text-xs text-[var(--text-secondary)]">
            Biblioteca este a fermei și ajută la organizare internă. Produsele salvate aici nu reprezintă recomandări oficiale ale platformei.
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-prod-nume">Nume comercial *</Label>
            <Input
              id="quick-prod-nume"
              value={draft.nume_comercial}
              onChange={(event) => setDraft((current) => ({ ...current, nume_comercial: event.target.value }))}
              placeholder="Ex: Thiovit Jet"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-prod-substanta">Substanță activă *</Label>
            <Input
              id="quick-prod-substanta"
              value={draft.substanta_activa}
              onChange={(event) => setDraft((current) => ({ ...current, substanta_activa: event.target.value }))}
              placeholder="Ex: sulf micronizat"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-prod-tip">Tip produs</Label>
              <AppSelect
                id="quick-prod-tip"
                placeholder="Alege tipul"
                value={draft.tip}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, tip: value as InsertTenantProdus['tip'] }))
                }
                options={TIP_OPTIONS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-prod-frac">FRAC/IRAC</Label>
              <Input
                id="quick-prod-frac"
                value={draft.frac_irac}
                onChange={(event) => setDraft((current) => ({ ...current, frac_irac: event.target.value }))}
                placeholder="Ex: M02"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-prod-phi">PHI zile</Label>
              <Input
                id="quick-prod-phi"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.phi_zile}
                onChange={(event) => setDraft((current) => ({ ...current, phi_zile: event.target.value }))}
                placeholder="Ex: 14"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm">
                <input
                  type="checkbox"
                  checked={draft.activ}
                  onChange={(event) => setDraft((current) => ({ ...current, activ: event.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--border-default)] accent-[var(--agri-primary)]"
                />
                Produs activ
              </label>
            </div>
          </div>

          {draftError ? (
            <p className="text-sm text-[var(--status-danger-text)]">{draftError}</p>
          ) : null}
        </div>
      </AppDialog>
    </>
  )
}
