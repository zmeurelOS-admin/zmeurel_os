'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Copy, Eye } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller, type UseFormReturn } from 'react-hook-form'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton, ListSkeletonCard } from '@/components/app/ListSkeleton'
import { ModuleEmptyCard } from '@/components/app/module-list-chrome'
import { PageHeader } from '@/components/app/PageHeader'
import { TagInput } from '@/components/tratamente/TagInput'
import { Button } from '@/components/ui/button'
import {
  DesktopInspectorPanel,
  DesktopInspectorSection,
  DesktopSplitPane,
  DesktopToolbar,
} from '@/components/ui/desktop'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAddAction } from '@/contexts/AddActionContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { queryKeys } from '@/lib/query-keys'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { sortProduseFitosanitareForLibrary } from '@/lib/tratamente/produse-fitosanitare-ui'
import { toast } from '@/lib/ui/toast'
import { hapticError } from '@/lib/utils/haptic'
import {
  listProduseFitosanitareAction,
  createProdusFitosanitarAction,
  updateProdusFitosanitarAction,
  deleteProdusFitosanitarAction,
  isProdusFolositInPlanActivAction,
  duplicaProdusFitosanitarAction,
} from '@/app/(dashboard)/tratamente/produse-fitosanitare/actions'

// ─── Constants ──────────────────────────────────────────────────────────────

export const TIP_OPTIONS = [
  { value: 'fungicid', label: 'Fungicid' },
  { value: 'insecticid', label: 'Insecticid' },
  { value: 'erbicid', label: 'Erbicid' },
  { value: 'acaricid', label: 'Acaricid' },
  { value: 'foliar', label: 'Foliar' },
  { value: 'ingrasamant', label: 'Îngrășământ' },
  { value: 'bioregulator', label: 'Bioregulator' },
  { value: 'altul', label: 'Altul' },
] as const

export const TIP_LABELS: Record<string, string> = Object.fromEntries(
  TIP_OPTIONS.map((o) => [o.value, o.label])
)

const SURSA_FILTER = [
  { value: 'toate' as const, label: 'Toate' },
  { value: 'standard' as const, label: 'Standard' },
  { value: 'proprii' as const, label: 'Proprii' },
]

// ─── Form schema ─────────────────────────────────────────────────────────────

const produsSchema = z.object({
  nume_comercial: z.string().trim().min(1, 'Numele comercial este obligatoriu'),
  substanta_activa: z.string().trim().min(1, 'Substanța activă este obligatorie'),
  tip: z.enum(['fungicid', 'insecticid', 'erbicid', 'acaricid', 'foliar', 'ingrasamant', 'bioregulator', 'altul']),
  frac_irac: z.string().optional(),
  doza_min_ml_per_hl: z.string().optional(),
  doza_max_ml_per_hl: z.string().optional(),
  doza_min_l_per_ha: z.string().optional(),
  doza_max_l_per_ha: z.string().optional(),
  phi_zile: z.string().optional(),
  nr_max_aplicari_per_sezon: z.string().optional(),
  interval_min_aplicari_zile: z.string().optional(),
  omologat_culturi: z.array(z.string()).optional(),
  activ: z.boolean().optional(),
})

type ProdusFormData = z.infer<typeof produsSchema>

function parseNum(val: string | undefined): number | null {
  if (!val?.trim()) return null
  const n = Number(val.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseIntNum(val: string | undefined): number | null {
  if (!val?.trim()) return null
  const n = parseInt(val, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function formToPayload(data: ProdusFormData) {
  const culturi = data.omologat_culturi ?? []
  return {
    nume_comercial: data.nume_comercial,
    substanta_activa: data.substanta_activa,
    tip: data.tip as ProdusFitosanitar['tip'],
    frac_irac: data.frac_irac?.trim() || null,
    doza_min_ml_per_hl: parseNum(data.doza_min_ml_per_hl),
    doza_max_ml_per_hl: parseNum(data.doza_max_ml_per_hl),
    doza_min_l_per_ha: parseNum(data.doza_min_l_per_ha),
    doza_max_l_per_ha: parseNum(data.doza_max_l_per_ha),
    phi_zile: parseIntNum(data.phi_zile),
    nr_max_aplicari_per_sezon: parseIntNum(data.nr_max_aplicari_per_sezon),
    interval_min_aplicari_zile: parseIntNum(data.interval_min_aplicari_zile),
    omologat_culturi: culturi.length > 0 ? culturi : null,
    activ: data.activ ?? true,
  }
}

function produsToDefaults(p: ProdusFitosanitar): ProdusFormData {
  return {
    nume_comercial: p.nume_comercial,
    substanta_activa: p.substanta_activa,
    tip: p.tip as ProdusFormData['tip'],
    frac_irac: p.frac_irac ?? '',
    doza_min_ml_per_hl: p.doza_min_ml_per_hl != null ? String(p.doza_min_ml_per_hl) : '',
    doza_max_ml_per_hl: p.doza_max_ml_per_hl != null ? String(p.doza_max_ml_per_hl) : '',
    doza_min_l_per_ha: p.doza_min_l_per_ha != null ? String(p.doza_min_l_per_ha) : '',
    doza_max_l_per_ha: p.doza_max_l_per_ha != null ? String(p.doza_max_l_per_ha) : '',
    phi_zile: p.phi_zile != null ? String(p.phi_zile) : '',
    nr_max_aplicari_per_sezon: p.nr_max_aplicari_per_sezon != null ? String(p.nr_max_aplicari_per_sezon) : '',
    interval_min_aplicari_zile: p.interval_min_aplicari_zile != null ? String(p.interval_min_aplicari_zile) : '',
    omologat_culturi: p.omologat_culturi ?? [],
    activ: p.activ,
  }
}

function emptyDefaults(): ProdusFormData {
  return {
    nume_comercial: '',
    substanta_activa: '',
    tip: 'fungicid',
    frac_irac: '',
    doza_min_ml_per_hl: '',
    doza_max_ml_per_hl: '',
    doza_min_l_per_ha: '',
    doza_max_l_per_ha: '',
    phi_zile: '',
    nr_max_aplicari_per_sezon: '',
    interval_min_aplicari_zile: '',
    omologat_culturi: [],
    activ: true,
  }
}

function normalizeSearch(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function isShared(p: ProdusFitosanitar) {
  return p.tenant_id === null
}

// ─── Form fields (shared between Add and Edit) ────────────────────────────────

interface ProdusFitosanitarFormFieldsProps {
  form: UseFormReturn<ProdusFormData>
  showActiv?: boolean
}

function ProdusFitosanitarFormFields({ form, showActiv = false }: ProdusFitosanitarFormFieldsProps) {
  const { register, control, formState: { errors } } = form

  return (
    <div className="space-y-5">
      <FormDialogSection label="Identificare">
        <div className="space-y-2">
          <Label htmlFor="pf_nume">Nume comercial *</Label>
          <Input id="pf_nume" className="agri-control h-11" placeholder="Ex: Thiovit Jet" {...register('nume_comercial')} />
          {errors.nume_comercial ? <p className="text-xs text-red-600">{errors.nume_comercial.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf_substanta">Substanță activă *</Label>
          <Input id="pf_substanta" className="agri-control h-11" placeholder="Ex: sulf micronizat" {...register('substanta_activa')} />
          {errors.substanta_activa ? <p className="text-xs text-red-600">{errors.substanta_activa.message}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pf_tip">Tip *</Label>
            <select id="pf_tip" className="agri-control h-11 w-full px-3 text-sm" {...register('tip')}>
              {TIP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf_frac">FRAC/IRAC (opțional)</Label>
            <Input id="pf_frac" className="agri-control h-11" placeholder="Ex: M02" {...register('frac_irac')} />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection label="Doze ml/hl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pf_doza_min_hl">Doză min (ml/hl)</Label>
            <Input id="pf_doza_min_hl" type="number" inputMode="decimal" step="0.1" min="0" className="agri-control h-11" placeholder="Ex: 150" {...register('doza_min_ml_per_hl')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf_doza_max_hl">Doză max (ml/hl)</Label>
            <Input id="pf_doza_max_hl" type="number" inputMode="decimal" step="0.1" min="0" className="agri-control h-11" placeholder="Ex: 250" {...register('doza_max_ml_per_hl')} />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection label="Doze l/ha">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pf_doza_min_ha">Doză min (l/ha)</Label>
            <Input id="pf_doza_min_ha" type="number" inputMode="decimal" step="0.01" min="0" className="agri-control h-11" placeholder="Ex: 1.5" {...register('doza_min_l_per_ha')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf_doza_max_ha">Doză max (l/ha)</Label>
            <Input id="pf_doza_max_ha" type="number" inputMode="decimal" step="0.01" min="0" className="agri-control h-11" placeholder="Ex: 2.5" {...register('doza_max_l_per_ha')} />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection label="Restricții">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pf_phi">PHI (zile)</Label>
            <Input id="pf_phi" type="number" inputMode="numeric" step="1" min="0" className="agri-control h-11" placeholder="Ex: 14" {...register('phi_zile')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf_max_ap">Max aplicări/sezon</Label>
            <Input id="pf_max_ap" type="number" inputMode="numeric" step="1" min="0" className="agri-control h-11" placeholder="Ex: 3" {...register('nr_max_aplicari_per_sezon')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf_interval">Interval min (zile)</Label>
            <Input id="pf_interval" type="number" inputMode="numeric" step="1" min="0" className="agri-control h-11" placeholder="Ex: 10" {...register('interval_min_aplicari_zile')} />
          </div>
        </div>
      </FormDialogSection>

      <FormDialogSection label="Culturi omologate">
        <Controller
          control={control}
          name="omologat_culturi"
          render={({ field }) => (
            <TagInput
              id="pf_culturi"
              value={field.value ?? []}
              onChange={field.onChange}
              placeholder="Ex: zmeur, mur, căpșun..."
            />
          )}
        />
        <p className="text-xs text-[var(--agri-text-muted)]">Apasă Enter sau „+ Adaugă&quot; după fiecare cultură.</p>
      </FormDialogSection>

      {showActiv ? (
        <FormDialogSection label="Status">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--agri-border)] accent-[var(--agri-primary)]"
              {...register('activ')}
            />
            <span className="text-sm text-[var(--agri-text)]">Produs activ</span>
          </label>
        </FormDialogSection>
      ) : null}
    </div>
  )
}

// ─── Add Drawer ───────────────────────────────────────────────────────────────

interface AddProdusFitosanitarDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function AddProdusFitosanitarDrawer({ open, onOpenChange, onSuccess }: AddProdusFitosanitarDrawerProps) {
  const [saving, setSaving] = useState(false)

  const form = useForm<ProdusFormData>({
    resolver: zodResolver(produsSchema),
    defaultValues: emptyDefaults(),
  })

  useEffect(() => {
    if (!open) form.reset(emptyDefaults())
  }, [open, form])

  const handleSubmit = async (data: ProdusFormData) => {
    setSaving(true)
    try {
      await createProdusFitosanitarAction(formToPayload(data))
      onSuccess()
      onOpenChange(false)
      toast.success('Produsul a fost adăugat în biblioteca ta.')
    } catch (err) {
      hapticError()
      toast.error(err instanceof Error ? err.message : 'Eroare la salvare.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă produs fitosanitar"
      desktopFormWide
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit(handleSubmit)}
          saving={saving}
        />
      }
    >
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <ProdusFitosanitarFormFields form={form} showActiv={false} />
      </form>
    </AppDrawer>
  )
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditProdusFitosanitarDialogProps {
  produs: ProdusFitosanitar | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function EditProdusFitosanitarDialog({ produs, open, onOpenChange, onSuccess }: EditProdusFitosanitarDialogProps) {
  const [saving, setSaving] = useState(false)

  const form = useForm<ProdusFormData>({
    resolver: zodResolver(produsSchema),
    defaultValues: emptyDefaults(),
  })

  useEffect(() => {
    if (open && produs) {
      form.reset(produsToDefaults(produs))
    } else if (!open) {
      form.reset(emptyDefaults())
    }
  }, [open, produs, form])

  const handleSubmit = async (data: ProdusFormData) => {
    if (!produs) return
    setSaving(true)
    try {
      await updateProdusFitosanitarAction(produs.id, formToPayload(data))
      onSuccess()
      onOpenChange(false)
      toast.success('Produsul a fost actualizat.')
    } catch (err) {
      hapticError()
      toast.error(err instanceof Error ? err.message : 'Eroare la salvare.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editează produs fitosanitar"
      desktopFormWide
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => onOpenChange(false)}
          onSave={form.handleSubmit(handleSubmit)}
          saving={saving}
        />
      }
    >
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <ProdusFitosanitarFormFields form={form} showActiv={true} />
      </form>
    </AppDialog>
  )
}

// ─── View Dialog (read-only, for Standard products) ──────────────────────────

interface ViewProdusFitosanitarDialogProps {
  produs: ProdusFitosanitar | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDuplica: (produs: ProdusFitosanitar) => void
  duplicating: boolean
}

function ViewProdusFitosanitarDialog({ produs, open, onOpenChange, onDuplica, duplicating }: ViewProdusFitosanitarDialogProps) {
  if (!produs) return null

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={produs.nume_comercial}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="outline" className="agri-cta min-h-11" onClick={() => onOpenChange(false)}>
            Închide
          </Button>
          <Button
            type="button"
            className="agri-cta min-h-11 bg-[var(--agri-primary)] text-white"
            onClick={() => onDuplica(produs)}
            disabled={duplicating}
          >
            {duplicating ? 'Se copiază...' : 'Duplică în biblioteca mea'}
          </Button>
        </div>
      }
    >
      <ProdusDetails produs={produs} />
    </AppDialog>
  )
}

// ─── Produs detail view (used in inspector panel + view dialog) ───────────────

function ProdusDetails({ produs }: { produs: ProdusFitosanitar }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-medium text-[var(--text-tertiary)]">Substanță activă</p>
        <p className="mt-0.5 text-[var(--text-primary)]">{produs.substanta_activa}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-tertiary)]">Tip</p>
        <p className="mt-0.5 font-medium text-[var(--text-primary)]">{TIP_LABELS[produs.tip] ?? produs.tip}</p>
      </div>
      {produs.frac_irac ? (
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">FRAC/IRAC</p>
          <p className="mt-0.5 text-[var(--text-primary)]">{produs.frac_irac}</p>
        </div>
      ) : null}
      {(produs.doza_min_ml_per_hl != null || produs.doza_max_ml_per_hl != null) ? (
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Doze ml/hl</p>
          <p className="mt-0.5 text-[var(--text-primary)]">
            {[produs.doza_min_ml_per_hl, produs.doza_max_ml_per_hl].filter((v) => v != null).join(' – ')} ml/hl
          </p>
        </div>
      ) : null}
      {(produs.doza_min_l_per_ha != null || produs.doza_max_l_per_ha != null) ? (
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Doze l/ha</p>
          <p className="mt-0.5 text-[var(--text-primary)]">
            {[produs.doza_min_l_per_ha, produs.doza_max_l_per_ha].filter((v) => v != null).join(' – ')} l/ha
          </p>
        </div>
      ) : null}
      {produs.phi_zile != null ? (
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">PHI</p>
          <p className="mt-0.5 text-[var(--text-primary)]">{produs.phi_zile} zile</p>
        </div>
      ) : null}
      {produs.nr_max_aplicari_per_sezon != null ? (
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Max aplicări/sezon</p>
          <p className="mt-0.5 text-[var(--text-primary)]">{produs.nr_max_aplicari_per_sezon}</p>
        </div>
      ) : null}
      {produs.interval_min_aplicari_zile != null ? (
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Interval minim între aplicări</p>
          <p className="mt-0.5 text-[var(--text-primary)]">{produs.interval_min_aplicari_zile} zile</p>
        </div>
      ) : null}
      {produs.omologat_culturi && produs.omologat_culturi.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Culturi omologate</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {produs.omologat_culturi.map((c) => (
              <span key={c} className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2 py-0.5 text-xs">
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-[var(--text-tertiary)]">Status</p>
        <div className="mt-1">
          <StatusBadge
            text={produs.activ ? 'Activ' : 'Inactiv'}
            variant={produs.activ ? 'success' : 'neutral'}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Block folosit în plan dialog ─────────────────────────────────────────────

interface ProdusUzatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produsNume: string
  planuri: Array<{ id: string; denumire: string }>
}

function ProdusUzatDialog({ open, onOpenChange, produsNume, planuri }: ProdusUzatDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Produsul nu poate fi șters"
      footer={
        <Button type="button" className="agri-cta min-h-11 w-full bg-[var(--agri-primary)] text-white" onClick={() => onOpenChange(false)}>
          Am înțeles
        </Button>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--agri-text-muted)]">
        Produsul <strong className="text-[var(--agri-text)]">&ldquo;{produsNume}&rdquo;</strong> este referențiat în{' '}
        {planuri.length === 1 ? 'planul de tratament' : 'planurile de tratament'}:{' '}
        <strong className="text-[var(--agri-text)]">{planuri.map((p) => p.denumire).join(', ')}</strong>.
      </p>
      <p className="mt-2 text-sm text-[var(--agri-text-muted)]">
        Șterge intervenția din plan înainte sau dezactivează planul, apoi încearcă din nou.
      </p>
    </AppDialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProduseFitosanitarePageClient() {
  useTrackModuleView('produse_fitosanitare')
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()

  const [addOpen, setAddOpen] = useState(false)
  const [editProdus, setEditProdus] = useState<ProdusFitosanitar | null>(null)
  const [viewProdus, setViewProdus] = useState<ProdusFitosanitar | null>(null)
  const [deleteProdus, setDeleteProdus] = useState<ProdusFitosanitar | null>(null)
  const [uzatInfo, setUzatInfo] = useState<{ produs: ProdusFitosanitar; planuri: Array<{ id: string; denumire: string }> } | null>(null)
  const [desktopSelectedId, setDesktopSelectedId] = useState<string | null>(null)
  const [filterTip, setFilterTip] = useState<string>('toate')
  const [filterSursa, setFilterSursa] = useState<'toate' | 'standard' | 'proprii'>('toate')
  const [search, setSearch] = useState('')
  const [duplicating, setDuplicating] = useState(false)

  // keep ref to avoid double guard check on sequential clicks
  const guardingRef = useRef(false)

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), '+ Produs nou')
    return unregister
  }, [registerAddAction])

  const { data: produse = [], isLoading, isError } = useQuery({
    queryKey: queryKeys.produseFitosanitare,
    queryFn: listProduseFitosanitareAction,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.produseFitosanitare })
  }, [queryClient])

  // Filters
  const filtered = useMemo(() => {
    return sortProduseFitosanitareForLibrary(
      produse.filter((p) => {
        if (filterTip !== 'toate' && p.tip !== filterTip) return false
        if (filterSursa === 'standard' && !isShared(p)) return false
        if (filterSursa === 'proprii' && isShared(p)) return false
        if (search.trim()) {
          const q = normalizeSearch(search.trim())
          return (
            normalizeSearch(p.nume_comercial).includes(q) ||
            normalizeSearch(p.substanta_activa).includes(q) ||
            normalizeSearch(p.frac_irac ?? '').includes(q) ||
            normalizeSearch(p.tip).includes(q)
          )
        }
        return true
      })
    )
  }, [produse, filterTip, filterSursa, search])

  // Delete mutation
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteProdusFitosanitarAction(id),
    onSuccess: () => {
      invalidate()
      setDeleteProdus(null)
      toast.success('Produsul a fost șters.')
    },
    onError: () => {
      toast.error('Eroare la ștergere.')
    },
  })

  const handleDeleteClick = useCallback(async (p: ProdusFitosanitar) => {
    if (guardingRef.current) return
    guardingRef.current = true
    try {
      const result = await isProdusFolositInPlanActivAction(p.id)
      if (result.folosit) {
        setUzatInfo({ produs: p, planuri: result.planuri })
      } else {
        setDeleteProdus(p)
      }
    } catch {
      toast.error('Nu s-a putut verifica folosirea produsului.')
    } finally {
      guardingRef.current = false
    }
  }, [])

  const handleDuplica = useCallback(async (p: ProdusFitosanitar) => {
    setDuplicating(true)
    try {
      await duplicaProdusFitosanitarAction({
        nume_comercial: `${p.nume_comercial} (copie)`,
        substanta_activa: p.substanta_activa,
        tip: p.tip as ProdusFitosanitar['tip'],
        frac_irac: p.frac_irac,
        doza_min_ml_per_hl: p.doza_min_ml_per_hl,
        doza_max_ml_per_hl: p.doza_max_ml_per_hl,
        doza_min_l_per_ha: p.doza_min_l_per_ha,
        doza_max_l_per_ha: p.doza_max_l_per_ha,
        phi_zile: p.phi_zile,
        nr_max_aplicari_per_sezon: p.nr_max_aplicari_per_sezon,
        interval_min_aplicari_zile: p.interval_min_aplicari_zile,
        omologat_culturi: p.omologat_culturi,
        activ: true,
      })
      invalidate()
      setViewProdus(null)
      toast.success(`Produsul „${p.nume_comercial}" a fost copiat în biblioteca ta.`)
    } catch (err) {
      hapticError()
      toast.error(err instanceof Error ? err.message : 'Eroare la duplicare.')
    } finally {
      setDuplicating(false)
    }
  }, [invalidate])

  // Desktop resolved selection
  const resolvedDesktopSelectedId = useMemo(() => {
    if (!isDesktop || filtered.length === 0) return null
    if (desktopSelectedId && filtered.some((p) => p.id === desktopSelectedId)) return desktopSelectedId
    return filtered[0].id
  }, [isDesktop, filtered, desktopSelectedId])

  const desktopSelected = useMemo(
    () => (resolvedDesktopSelectedId ? filtered.find((p) => p.id === resolvedDesktopSelectedId) ?? null : null),
    [filtered, resolvedDesktopSelectedId]
  )

  // Desktop columns
  const desktopColumns = useMemo<ColumnDef<ProdusFitosanitar>[]>(() => [
    {
      accessorKey: 'nume_comercial',
      header: 'Produs',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--text-primary)]">{row.original.nume_comercial}</span>
          {isShared(row.original) ? (
            <span className="rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
              Standard
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'substanta_activa',
      header: 'Substanță activă',
      cell: ({ row }) => (
        <span className="text-[var(--text-secondary)]">{row.original.substanta_activa}</span>
      ),
    },
    {
      accessorKey: 'tip',
      header: 'Tip',
      cell: ({ row }) => TIP_LABELS[row.original.tip] ?? row.original.tip,
    },
    {
      id: 'phi',
      header: 'PHI (z)',
      cell: ({ row }) => row.original.phi_zile != null ? `${row.original.phi_zile}z` : '—',
      meta: { numeric: true },
    },
    {
      id: 'actions',
      header: 'Acțiuni',
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        const shared = isShared(p)
        return (
          <div className="flex items-center justify-end gap-1">
            {shared ? (
              <>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Vizualizează" onClick={(e) => { e.stopPropagation(); setViewProdus(p) }}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Duplică" onClick={(e) => { e.stopPropagation(); void handleDuplica(p) }} disabled={duplicating}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Editează" onClick={(e) => { e.stopPropagation(); setEditProdus(p) }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Șterge" onClick={(e) => { e.stopPropagation(); void handleDeleteClick(p) }}>
                  <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
                </Button>
              </>
            )}
          </div>
        )
      },
      meta: {
        searchable: false,
        sticky: 'right',
        headerClassName: 'w-[96px] text-right',
        cellClassName: 'w-[96px] text-right',
      },
    },
  ], [duplicating, handleDeleteClick, handleDuplica])

  const onDesktopRowClick = useCallback((row: ProdusFitosanitar) => {
    setDesktopSelectedId(row.id)
  }, [])

  const isDesktopRowSelected = useCallback(
    (row: ProdusFitosanitar) => resolvedDesktopSelectedId === row.id,
    [resolvedDesktopSelectedId]
  )

  return (
    <AppShell header={<PageHeader title="Produse fitosanitare" subtitle="Bibliotecă produse" />}>
      <div className="mx-auto mt-2 w-full max-w-4xl space-y-3 py-3 sm:mt-0 md:max-w-7xl">

        {/* Mobile: search */}
        {produse.length > 3 ? (
          <div className="md:hidden">
            <SearchField
              placeholder="Caută produs sau substanță..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Caută produse fitosanitare"
            />
          </div>
        ) : null}

        {/* Mobile: tip filter chips */}
        <div className="flex flex-wrap gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setFilterTip('toate')}
            className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
              filterTip === 'toate'
                ? 'bg-[var(--agri-primary)] text-white'
                : 'border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
            }`}
          >
            Toate tipurile
          </button>
          {TIP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilterTip(opt.value)}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                filterTip === opt.value
                  ? 'bg-[var(--agri-primary)] text-white'
                  : 'border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Mobile: sursa filter chips */}
        <div className="flex flex-wrap gap-2 md:hidden">
          {SURSA_FILTER.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilterSursa(opt.value)}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                filterSursa === opt.value
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Desktop toolbar */}
        {!isLoading && !isError && produse.length > 0 ? (
          <DesktopToolbar
            className="hidden md:flex"
            trailing={
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">
                  <span className="font-semibold text-[var(--text-primary)]">{filtered.length}</span>
                  {' '}în filtru
                </span>
                <Button type="button" className="agri-cta shrink-0" onClick={() => setAddOpen(true)}>
                  + Produs nou
                </Button>
              </div>
            }
          >
            <SearchField
              containerClassName="w-full max-w-md min-w-[180px]"
              placeholder="Caută după nume sau substanță..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Caută produse fitosanitare"
            />
            <div className="flex items-center gap-2">
              <select
                value={filterTip}
                onChange={(e) => setFilterTip(e.target.value)}
                className="agri-control h-9 min-w-[9rem] rounded-xl px-2 text-sm"
                aria-label="Filtrează după tip"
              >
                <option value="toate">Toate tipurile</option>
                {TIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                value={filterSursa}
                onChange={(e) => setFilterSursa(e.target.value as typeof filterSursa)}
                className="agri-control h-9 min-w-[8rem] rounded-xl px-2 text-sm"
                aria-label="Filtrează după sursă"
              >
                {SURSA_FILTER.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </DesktopToolbar>
        ) : null}

        {isLoading ? (
          <>
            <div className="hidden md:block"><EntityListSkeleton /></div>
            <div className="grid gap-4 sm:grid-cols-2 md:hidden lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <ListSkeletonCard key={i} />)}
            </div>
          </>
        ) : null}

        {isError ? <ErrorState title="Eroare" message="Nu am putut încărca produsele fitosanitare." /> : null}

        {!isLoading && !isError && filtered.length === 0 ? (
          <ModuleEmptyCard
            emoji="🧪"
            title={produse.length > 0 ? 'Niciun produs pentru filtrele curente' : 'Nicio bibliotecă proprie'}
            hint={
              produse.length > 0
                ? 'Modifică filtrele sau căutarea.'
                : 'Adaugă primul tău produs cu butonul + de mai sus.'
            }
          />
        ) : null}

        {!isLoading && !isError && filtered.length > 0 ? (
          <DesktopSplitPane
            master={
              <ResponsiveDataView
                columns={desktopColumns}
                data={filtered}
                getRowId={(row) => row.id}
                mobileContainerClassName="grid-cols-1"
                emptyMessage="Nu am găsit produse."
                desktopContainerClassName="md:min-w-0"
                skipDesktopDataFilter
                hideDesktopSearchRow
                onDesktopRowClick={onDesktopRowClick}
                isDesktopRowSelected={isDesktopRowSelected}
                renderCard={(p) => (
                  <ProdusFitosanitarCard
                    produs={p}
                    onView={() => setViewProdus(p)}
                    onEdit={() => setEditProdus(p)}
                    onDelete={() => void handleDeleteClick(p)}
                    onDuplica={() => void handleDuplica(p)}
                    duplicating={duplicating}
                  />
                )}
              />
            }
            detail={
              <DesktopInspectorPanel
                title={desktopSelected?.nume_comercial ?? 'Detalii produs'}
                description={desktopSelected ? (isShared(desktopSelected) ? 'Standard' : 'Propriu') : undefined}
                footer={
                  desktopSelected ? (
                    <div className="flex flex-wrap gap-2">
                      {isShared(desktopSelected) ? (
                        <>
                          <Button type="button" variant="outline" className="agri-cta" onClick={() => setViewProdus(desktopSelected)}>
                            Vizualizează
                          </Button>
                          <Button
                            type="button"
                            className="agri-cta bg-[var(--agri-primary)] text-white"
                            onClick={() => void handleDuplica(desktopSelected)}
                            disabled={duplicating}
                          >
                            Duplică în biblioteca mea
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" variant="outline" className="agri-cta" onClick={() => setEditProdus(desktopSelected)}>
                            Editează
                          </Button>
                          <Button type="button" variant="destructive" className="agri-cta" onClick={() => void handleDeleteClick(desktopSelected)}>
                            Șterge
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null
                }
              >
                {desktopSelected ? (
                  <>
                    <DesktopInspectorSection label="Detalii">
                      <ProdusDetails produs={desktopSelected} />
                    </DesktopInspectorSection>
                  </>
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)]">Selectează un produs din listă.</p>
                )}
              </DesktopInspectorPanel>
            }
          />
        ) : null}
      </div>

      {/* Dialogs / Drawers */}
      <AddProdusFitosanitarDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={invalidate}
      />

      <EditProdusFitosanitarDialog
        produs={editProdus}
        open={editProdus !== null}
        onOpenChange={(open) => { if (!open) setEditProdus(null) }}
        onSuccess={invalidate}
      />

      <ViewProdusFitosanitarDialog
        produs={viewProdus}
        open={viewProdus !== null}
        onOpenChange={(open) => { if (!open) setViewProdus(null) }}
        onDuplica={handleDuplica}
        duplicating={duplicating}
      />

      <ConfirmDeleteDialog
        open={deleteProdus !== null}
        onOpenChange={(open) => { if (!open) setDeleteProdus(null) }}
        title="Șterge produs fitosanitar"
        description={`Ești sigur că vrei să ștergi produsul „${deleteProdus?.nume_comercial}"? Acțiunea nu poate fi anulată.`}
        onConfirm={() => { if (deleteProdus) deleteM.mutate(deleteProdus.id) }}
        loading={deleteM.isPending}
      />

      <ProdusUzatDialog
        open={uzatInfo !== null}
        onOpenChange={(open) => { if (!open) setUzatInfo(null) }}
        produsNume={uzatInfo?.produs.nume_comercial ?? ''}
        planuri={uzatInfo?.planuri ?? []}
      />
    </AppShell>
  )
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

interface ProdusFitosanitarCardProps {
  produs: ProdusFitosanitar
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplica: () => void
  duplicating: boolean
}

function ProdusFitosanitarCard({
  produs,
  onView,
  onEdit,
  onDelete,
  onDuplica,
  duplicating,
}: ProdusFitosanitarCardProps) {
  const shared = isShared(produs)
  const subtitle = `${TIP_LABELS[produs.tip] ?? produs.tip}${produs.frac_irac ? ` · ${produs.frac_irac}` : ''}`
  const meta = produs.substanta_activa
  const phiText = produs.phi_zile != null ? `PHI ${produs.phi_zile}z` : undefined

  return (
    <MobileEntityCard
      title={produs.nume_comercial}
      subtitle={subtitle}
      meta={meta}
      mainValue={phiText}
      statusLabel={shared ? 'Standard' : (produs.activ ? 'Activ' : 'Inactiv')}
      statusTone={shared ? 'info' : (produs.activ ? 'success' : 'neutral')}
      showChevron={false}
      onClick={shared ? onView : onEdit}
      bottomSlot={
        <div className="flex gap-2 pt-1">
          {shared ? (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8 flex-1 gap-1 text-xs" onClick={onView}>
                <Eye className="h-3 w-3" />
                Vizualizează
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 flex-1 gap-1 text-xs"
                onClick={onDuplica}
                disabled={duplicating}
              >
                <Copy className="h-3 w-3" />
                Duplică
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8 flex-1 gap-1 text-xs" onClick={onEdit}>
                <Pencil className="h-3 w-3" />
                Editează
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs text-[var(--soft-danger-text)]" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
                Șterge
              </Button>
            </>
          )}
        </div>
      }
      bottomSlotAlign="full"
    />
  )
}
