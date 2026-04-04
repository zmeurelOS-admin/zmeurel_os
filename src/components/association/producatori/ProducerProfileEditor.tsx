'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { AssociationProducer } from '@/lib/association/queries'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const MAX_PHOTOS = 3

const SPECIALITATI_PRESET = [
  'Fructe de pădure',
  'Lactate',
  'Preparate din carne',
  'Legume',
  'Panificație',
  'Produse apicole',
  'Conserve & Dulcețuri',
  'Produse inovative',
  'Altele',
] as const

type Props = {
  producer: AssociationProducer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (producerId: string, patch: Partial<AssociationProducer>) => void
}

function padPhotoSlots(photos: readonly string[]): Array<string | null> {
  const compact = photos.filter((photo) => photo.trim().length > 0).slice(0, MAX_PHOTOS)
  return Array.from({ length: MAX_PHOTOS }, (_, idx) => compact[idx] ?? null)
}

function compactPhotoSlots(slots: Array<string | null>): string[] {
  return slots.filter((photo): photo is string => typeof photo === 'string' && photo.trim().length > 0)
}

export function ProducerProfileEditor({ producer, open, onOpenChange, onSaved }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const previewUrlRefs = useRef<Array<string | null>>([null, null, null])

  const [specialitatePreset, setSpecialitatePreset] = useState<string>('')
  const [specialitateCustom, setSpecialitateCustom] = useState('')
  const [specialitateMode, setSpecialitateMode] = useState<'preset' | 'custom'>('preset')
  const [localitate, setLocalitate] = useState('Suceava')
  const [descriere, setDescriere] = useState('')
  const [photoSlots, setPhotoSlots] = useState<Array<string | null>>([null, null, null])
  const [previewSlots, setPreviewSlots] = useState<Array<string | null>>([null, null, null])
  const [uploadingSlots, setUploadingSlots] = useState<Record<number, boolean>>({})
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const replacePreview = useCallback((slot: number, nextUrl: string | null) => {
    const prev = previewUrlRefs.current[slot]
    if (prev && prev !== nextUrl) {
      URL.revokeObjectURL(prev)
    }
    previewUrlRefs.current[slot] = nextUrl
    setPreviewSlots((current) => {
      const next = [...current]
      next[slot] = nextUrl
      return next
    })
  }, [])

  useEffect(() => {
    const previewUrls = previewUrlRefs.current
    return () => {
      for (const url of previewUrls) {
        if (url) URL.revokeObjectURL(url)
      }
    }
  }, [])

  useEffect(() => {
    if (!producer || !open) return

    const currentSpecialty = producer.specialitate?.trim() || ''
    const isPreset = SPECIALITATI_PRESET.includes(currentSpecialty as (typeof SPECIALITATI_PRESET)[number])
    setSpecialitateMode(currentSpecialty && !isPreset ? 'custom' : 'preset')
    setSpecialitatePreset(isPreset ? currentSpecialty : '')
    setSpecialitateCustom(isPreset ? '' : currentSpecialty)
    setLocalitate(producer.localitate?.trim() || 'Suceava')
    setDescriere(producer.descriere_publica ?? '')
    setPhotoSlots(padPhotoSlots(producer.poze_ferma))
    setUploadingSlots({})
    setDeletingSlot(null)
    setSaving(false)

    for (let slot = 0; slot < MAX_PHOTOS; slot += 1) {
      replacePreview(slot, null)
    }
  }, [open, producer, replacePreview])

  const hasPendingUploads = useMemo(
    () => Object.values(uploadingSlots).some(Boolean),
    [uploadingSlots]
  )

  const effectiveSpecialitate =
    specialitateMode === 'custom' ? specialitateCustom.trim() : specialitatePreset.trim()

  const submitSave = useCallback(async () => {
    if (!producer) return
    if (hasPendingUploads) {
      toast.message('Așteaptă finalizarea upload-urilor înainte să salvezi.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/association/producer-profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          tenantId: producer.id,
          descriere_publica: descriere.trim(),
          specialitate: effectiveSpecialitate,
          localitate: localitate.trim(),
          poze_ferma: compactPhotoSlots(photoSlots),
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { tenant?: Partial<AssociationProducer> } ; error?: { message?: string } }
        | null

      if (!res.ok || !json?.ok) {
        const message = json && typeof json === 'object' && json.error?.message
        toast.error(typeof message === 'string' ? message : 'Nu am putut salva profilul.')
        return
      }

      onSaved(producer.id, {
        descriere_publica: descriere.trim() || null,
        specialitate: effectiveSpecialitate || null,
        localitate: localitate.trim() || 'Suceava',
        poze_ferma: compactPhotoSlots(photoSlots),
      })
      toast.success(`Profilul ${producer.nume_ferma} a fost actualizat.`)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }, [descriere, effectiveSpecialitate, hasPendingUploads, localitate, onOpenChange, onSaved, photoSlots, producer])

  const handleUpload = useCallback(
    async (slot: number, file: File | null) => {
      if (!producer || !file) return

      const tempUrl = URL.createObjectURL(file)
      replacePreview(slot, tempUrl)
      setUploadingSlots((current) => ({ ...current, [slot]: true }))

      try {
        const formData = new FormData()
        formData.set('file', file)

        const res = await fetch(`/api/association/producer-photos?tenantId=${encodeURIComponent(producer.id)}`, {
          method: 'POST',
          credentials: 'same-origin',
          body: formData,
        })

        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: { url?: string }; error?: { message?: string } }
          | null

        if (!res.ok || !json?.ok || !json.data?.url) {
          const message = json && typeof json === 'object' && json.error?.message
          toast.error(typeof message === 'string' ? message : 'Nu am putut urca imaginea.')
          replacePreview(slot, null)
          return
        }

        setPhotoSlots((current) => {
          const next = [...current]
          next[slot] = json.data?.url ?? null
          return next
        })
        replacePreview(slot, null)
      } finally {
        setUploadingSlots((current) => {
          const next = { ...current }
          delete next[slot]
          return next
        })
      }
    },
    [producer, replacePreview]
  )

  const handleDeletePhoto = useCallback(
    async (slot: number) => {
      if (!producer) return
      const photoUrl = photoSlots[slot]
      if (!photoUrl) return

      setDeletingSlot(slot)
      try {
        const res = await fetch('/api/association/producer-photos', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Origin: window.location.origin,
          },
          body: JSON.stringify({
            tenantId: producer.id,
            photoUrl,
          }),
        })

        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: { message?: string } }
          | null

        if (!res.ok || !json?.ok) {
          const message = json && typeof json === 'object' && json.error?.message
          toast.error(typeof message === 'string' ? message : 'Nu am putut șterge poza.')
          return
        }

        setPhotoSlots((current) => {
          const remaining = compactPhotoSlots(current.filter((_, index) => index !== slot))
          return padPhotoSlots(remaining)
        })
      } finally {
        setDeletingSlot(null)
      }
    },
    [photoSlots, producer]
  )

  const content = producer ? (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Specialitate</Label>
        <Select
          value={specialitateMode === 'custom' ? '__custom' : specialitatePreset || '__empty'}
          onValueChange={(value) => {
            if (value === '__custom') {
              setSpecialitateMode('custom')
              return
            }
            if (value === '__empty') {
              setSpecialitateMode('preset')
              setSpecialitatePreset('')
              return
            }
            setSpecialitateMode('preset')
            setSpecialitatePreset(value)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Alege specialitatea principală" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty">Fără specialitate</SelectItem>
            {SPECIALITATI_PRESET.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value="__custom">Altă valoare…</SelectItem>
          </SelectContent>
        </Select>
        {specialitateMode === 'custom' ? (
          <Input
            value={specialitateCustom}
            onChange={(event) => setSpecialitateCustom(event.target.value)}
            placeholder="Scrie o specialitate personalizată"
            maxLength={120}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="producer-localitate">Localitate</Label>
        <Input
          id="producer-localitate"
          value={localitate}
          onChange={(event) => setLocalitate(event.target.value)}
          placeholder="ex: Suceava, Gura Humorului, Câmpulung..."
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="producer-descriere">Descriere publică</Label>
          <span className="text-xs text-[var(--text-secondary)]">{descriere.length}/500</span>
        </div>
        <Textarea
          id="producer-descriere"
          value={descriere}
          onChange={(event) => setDescriere(event.target.value.slice(0, 500))}
          placeholder="Povestea fermei, ce cultivă, de când..."
          rows={5}
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Fotografii fermă</Label>
          <span className="text-xs text-[var(--text-secondary)]">
            {compactPhotoSlots(photoSlots).length}/{MAX_PHOTOS}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: MAX_PHOTOS }, (_, slot) => {
            const previewUrl = previewSlots[slot]
            const photoUrl = photoSlots[slot]
            const hasImage = Boolean(previewUrl || photoUrl)
            const busy = uploadingSlots[slot] || deletingSlot === slot

            return (
              <div
                key={slot}
                className={cn(
                  'relative overflow-hidden rounded-[12px] border bg-[var(--surface-card-muted)]',
                  'h-[100px] w-full'
                )}
              >
                <input
                  ref={(node) => {
                    fileInputRefs.current[slot] = node
                  }}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    void handleUpload(slot, file)
                    event.currentTarget.value = ''
                  }}
                />

                {hasImage ? (
                  <>
                    {/* Blob previews from the local file picker are easiest to render with a plain img. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl ?? photoUrl ?? ''}
                      alt={`Poză fermă ${slot + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      disabled={busy || !photoUrl}
                      onClick={() => void handleDeletePhoto(slot)}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-sm font-bold text-white disabled:opacity-50"
                      aria-label={`Șterge poza ${slot + 1}`}
                    >
                      ×
                    </button>
                    {uploadingSlots[slot] ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-xs font-semibold text-white">
                        Upload…
                      </div>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-[var(--text-secondary)]"
                    onClick={() => fileInputRefs.current[slot]?.click()}
                  >
                    <span className="text-lg" aria-hidden>
                      📷
                    </span>
                    Adaugă
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Anulează
        </Button>
        <Button type="button" disabled={saving || hasPendingUploads} onClick={() => void submitSave()}>
          {saving ? 'Se salvează…' : 'Salvează'}
        </Button>
      </DialogFooter>
    </div>
  ) : null

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editează profilul producătorului</SheetTitle>
            <SheetDescription>{producer?.nume_ferma ?? 'Producător'}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 pb-6">{content}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editează profilul producătorului</DialogTitle>
          <DialogDescription>{producer?.nume_ferma ?? 'Producător'}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
