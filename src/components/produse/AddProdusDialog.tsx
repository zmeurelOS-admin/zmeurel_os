'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { ImagePlus, X } from 'lucide-react'
import * as z from 'zod'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import { FormDialogSection } from '@/components/ui/form-dialog-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StatusBadge from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/ui/toast'
import { hapticError } from '@/lib/utils/haptic'
import {
  CATEGORII_PRODUSE,
  UNITATI_VANZARE,
  createProdus,
  uploadProdusPhoto,
  updateProdus,
  type CreateProdusInput,
} from '@/lib/supabase/queries/produse'

const produsSchema = z.object({
  nume: z.string().trim().min(1, 'Numele este obligatoriu'),
  descriere: z.string().optional(),
  categorie: z.enum(CATEGORII_PRODUSE),
  unitate_vanzare: z.string().trim().min(1, 'Unitatea este obligatorie'),
  unitate_vanzare_custom: z.string().optional(),
  gramaj_per_unitate: z.string().optional(),
  approximate_weight: z.string().optional(),
  pret_unitar: z.string().optional(),
})

type ProdusFormData = z.infer<typeof produsSchema>

interface AddProdusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const defaults = (): ProdusFormData => ({
  nume: '',
  descriere: '',
  categorie: 'fruct',
  unitate_vanzare: 'kg',
  unitate_vanzare_custom: '',
  gramaj_per_unitate: '',
  approximate_weight: '',
  pret_unitar: '',
})

const CATEGORIE_LABEL: Record<string, string> = {
  fruct: 'Fruct',
  leguma: 'Legumă',
  procesat: 'Procesat',
  altele: 'Altele',
}

function clipNote(text: string | undefined, max = 120): string {
  const t = (text ?? '').trim()
  if (!t) return '—'
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export function AddProdusDialog({ open, onOpenChange, onSuccess }: AddProdusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photo1, setPhoto1] = useState<File | null>(null)
  const [photo2, setPhoto2] = useState<File | null>(null)
  const [preview1, setPreview1] = useState<string | null>(null)
  const [preview2, setPreview2] = useState<string | null>(null)
  const input1Ref = useRef<HTMLInputElement>(null)
  const input2Ref = useRef<HTMLInputElement>(null)

  const form = useForm<ProdusFormData>({
    resolver: zodResolver(produsSchema),
    defaultValues: defaults(),
  })

  const wNume = useWatch({ control: form.control, name: 'nume' })
  const wCat = useWatch({ control: form.control, name: 'categorie' })
  const wUnit = useWatch({ control: form.control, name: 'unitate_vanzare' })
  const wPret = useWatch({ control: form.control, name: 'pret_unitar' })
  const wGramaj = useWatch({ control: form.control, name: 'gramaj_per_unitate' })
  const wApprox = useWatch({ control: form.control, name: 'approximate_weight' })
  const wDesc = useWatch({ control: form.control, name: 'descriere' })

  useEffect(() => {
    if (!open) {
      form.reset(defaults())
      setPhoto1(null)
      setPhoto2(null)
      setPreview1(null)
      setPreview2(null)
    }
  }, [open, form])

  const pretDisplay = useMemo(() => {
    const n = Number(String(wPret ?? '').replace(',', '.'))
    if (!wPret?.trim() || !Number.isFinite(n) || n < 0) return '—'
    return `${n.toFixed(2)} RON`
  }, [wPret])

  const handleFileChange = (slot: 1 | 2, file: File | null) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (slot === 1) {
      setPhoto1(file)
      setPreview1(url)
    } else {
      setPhoto2(file)
      setPreview2(url)
    }
  }

  const clearPhoto = (slot: 1 | 2) => {
    if (slot === 1) {
      setPhoto1(null)
      setPreview1(null)
      if (input1Ref.current) input1Ref.current.value = ''
    } else {
      setPhoto2(null)
      setPreview2(null)
      if (input2Ref.current) input2Ref.current.value = ''
    }
  }

  const handleSubmit = async (data: ProdusFormData) => {
    setIsSubmitting(true)
    try {
      const input: CreateProdusInput = {
        nume: data.nume,
        descriere: data.descriere || null,
        categorie: data.categorie,
        unitate_vanzare:
          data.unitate_vanzare === 'altul'
            ? (data.unitate_vanzare_custom?.trim() || data.unitate_vanzare)
            : data.unitate_vanzare,
        gramaj_per_unitate: data.gramaj_per_unitate ? Number(data.gramaj_per_unitate) : null,
        approximate_weight: data.approximate_weight?.trim() || null,
        pret_unitar: data.pret_unitar ? Number(data.pret_unitar) : null,
      }

      const produs = await createProdus(input)

      const uploads: Array<Promise<string>> = []
      if (photo1) uploads.push(uploadProdusPhoto(produs.id, 1, photo1))
      if (photo2) uploads.push(uploadProdusPhoto(produs.id, 2, photo2))

      if (uploads.length > 0) {
        const urls = await Promise.all(uploads)
        await updateProdus(produs.id, {
          ...(photo1 ? { poza_1_url: urls[0] } : {}),
          ...(photo2 ? { poza_2_url: urls[photo1 ? 1 : 0] } : {}),
        })
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error('Error creating produs:', err)
      hapticError()
      toast.error(err instanceof Error ? err.message : 'Eroare la salvare.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onOpenChange(false)
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adaugă produs"
      desktopFormWide
      contentClassName="lg:max-w-[min(94vw,56rem)] xl:max-w-[min(92vw,60rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={handleClose}
          onSave={form.handleSubmit(handleSubmit)}
          saving={isSubmitting}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <form className="space-y-0" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1fr)_min(280px,30%)] md:items-start md:gap-6 lg:gap-8">
          <div className="min-w-0 space-y-4 md:space-y-6">
            <FormDialogSection label="General">
              <div className="space-y-2">
                <Label htmlFor="add_produs_nume">Nume produs</Label>
                <Input id="add_produs_nume" className="agri-control h-12 md:h-11" placeholder="Ex: Zmeură cal. 1" {...form.register('nume')} />
                {form.formState.errors.nume ? <p className="text-xs text-red-600">{form.formState.errors.nume.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="add_produs_cat">Categorie</Label>
                <select id="add_produs_cat" className="agri-control h-12 w-full px-3 text-base md:h-11" {...form.register('categorie')}>
                  {CATEGORII_PRODUSE.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIE_LABEL[c] ?? c}
                    </option>
                  ))}
                </select>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Comercial">
              <div className="grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add_produs_unit">unit_label</Label>
                  <select id="add_produs_unit" className="agri-control h-12 w-full px-3 text-base md:h-11" {...form.register('unitate_vanzare')}>
                    {UNITATI_VANZARE.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="altul">Altul</option>
                  </select>
                  {wUnit === 'altul' ? (
                    <Input
                      className="agri-control h-12 md:h-11"
                      placeholder="ex: borcan, casetă, sticlă"
                      {...form.register('unitate_vanzare_custom')}
                    />
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add_produs_pret">Preț unitar (lei)</Label>
                  <Input
                    id="add_produs_pret"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="agri-control h-12 md:h-11"
                    placeholder="Ex: 15.00"
                    {...form.register('pret_unitar')}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="add_produs_approx">approximate_weight</Label>
                  <Input
                    id="add_produs_approx"
                    className="agri-control h-12 md:h-11 md:max-w-md"
                    placeholder="ex: ~300g"
                    {...form.register('approximate_weight')}
                  />
                </div>
              </div>
            </FormDialogSection>

            <FormDialogSection label="Status">
              <p className="text-sm text-[var(--text-secondary)]">
                La creare, produsul este <strong className="text-[var(--text-primary)]">Activ</strong> (implicit în catalog).
              </p>
              <StatusBadge variant="success" text="Activ (implicit)" />
            </FormDialogSection>

            <FormDialogSection label="Observații">
              <Textarea
                id="add_produs_desc"
                rows={3}
                className="agri-control min-h-[5rem] w-full px-3 py-2 text-base md:min-h-[6rem]"
                placeholder="Detalii suplimentare..."
                {...form.register('descriere')}
              />
            </FormDialogSection>

            <FormDialogSection label="Imagini">
              <div className="flex gap-3">
                <PhotoSlot slot={1} preview={preview1} inputRef={input1Ref} onFile={(f) => handleFileChange(1, f)} onClear={() => clearPhoto(1)} />
                <PhotoSlot slot={2} preview={preview2} inputRef={input2Ref} onFile={(f) => handleFileChange(2, f)} onClear={() => clearPhoto(2)} />
              </div>
              <p className="text-xs text-[var(--agri-text-muted)]">Max 2 fotografii (JPEG/PNG/WebP)</p>
            </FormDialogSection>
          </div>

          <aside className="hidden md:block md:sticky md:top-2 md:self-start">
            <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4 shadow-[var(--shadow-soft)]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Previzualizare</p>
                <p className="mt-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">{wNume?.trim() || 'Produs nou'}</p>
              </div>
              <dl className="space-y-2.5 text-sm text-[var(--text-secondary)]">
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Categorie</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{CATEGORIE_LABEL[wCat || 'fruct']}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Unitate</dt>
                  <dd className="mt-0.5 text-[var(--text-primary)]">{wUnit || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Preț</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-[var(--text-primary)]">{pretDisplay}</dd>
                </div>
                {wGramaj?.trim() ? (
                  <div>
                    <dt className="text-xs font-medium text-[var(--text-tertiary)]">Gramaj</dt>
                    <dd className="mt-0.5 text-[var(--text-primary)]">{wGramaj} g</dd>
                  </div>
                ) : null}
                {wApprox?.trim() ? (
                  <div>
                    <dt className="text-xs font-medium text-[var(--text-tertiary)]">Greutate aproximativă</dt>
                    <dd className="mt-0.5 text-[var(--text-primary)]">{wApprox}</dd>
                  </div>
                ) : null}
                <div className="border-t border-[var(--divider)] pt-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] mb-1.5">Status</dt>
                  <dd>
                    <StatusBadge variant="success" text="Activ" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)]">Descriere</dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-[var(--text-primary)]">{clipNote(wDesc)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </form>
    </AppDrawer>
  )
}

interface PhotoSlotProps {
  slot: 1 | 2
  preview: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onFile: (file: File) => void
  onClear: () => void
}

function PhotoSlot({ slot, preview, inputRef, onFile, onClear }: PhotoSlotProps) {
  return (
    <div className="relative">
      {preview ? (
        <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-[var(--agri-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`Foto ${slot}`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--agri-border)] text-[var(--agri-text-muted)] transition hover:border-[var(--agri-primary)] hover:text-[var(--agri-primary)]"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-xs">Foto {slot}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
    </div>
  )
}
