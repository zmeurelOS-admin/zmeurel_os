'use client'

import { useEffect, useRef } from 'react'
import { Camera } from 'lucide-react'

import { Button } from '@/components/kit'

export type PozaAleasa = { blob: Blob; previewUrl: string } | null

/** Poza opțională: „📷 Poză” → camera; apoi miniatura cu „Schimbă” / „Scoate”. */
export function PozaRand({
  poza,
  onChange,
  disabled,
  eticheta = 'Poză',
}: {
  poza: PozaAleasa
  onChange: (poza: PozaAleasa) => void
  disabled?: boolean
  eticheta?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrl = poza?.previewUrl ?? null
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        onChange({ blob: file, previewUrl: URL.createObjectURL(file) })
      }}
    />
  )

  if (!poza) {
    return (
      <>
        <Button type="button" variant="neutral" size="touch" className="w-full" disabled={disabled} aria-label={`${eticheta} (opțional)`} onClick={() => inputRef.current?.click()}>
          <Camera aria-hidden />
          {eticheta}
        </Button>
        {input}
      </>
    )
  }
  return (
    <div className="flex items-center gap-2" role="group" aria-label={eticheta}>
      <span className="flex size-touch shrink-0 items-center justify-center overflow-hidden rounded-box border border-border bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatură din `blob:` */}
        <img src={poza.previewUrl} alt={eticheta} className="size-full object-cover" />
      </span>
      <Button type="button" variant="neutral" size="touch" className="min-w-0 flex-1 px-3" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Schimbă
      </Button>
      <Button type="button" variant="quiet" size="touch" className="min-w-0 flex-1 px-3" disabled={disabled} onClick={() => onChange(null)}>
        Scoate
      </Button>
      {input}
    </div>
  )
}
