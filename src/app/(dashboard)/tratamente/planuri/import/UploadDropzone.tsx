'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UploadDropzoneProps = {
  disabled?: boolean
  onFileSelected: (file: File) => void
}

export function UploadDropzone({
  disabled = false,
  onFileSelected,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]
    if (file) {
      onFileSelected(file)
    }
  }

  return (
    <div
      className={cn(
        'rounded-[24px] border border-dashed p-5 transition',
        'min-h-[160px] bg-[var(--surface-card-muted)]',
        isDragActive
          ? 'border-[var(--brand-blue)] bg-[color:color-mix(in_srgb,var(--surface-card-muted)_70%,var(--brand-blue))]'
          : 'border-[var(--border-default)]',
        disabled && 'opacity-60'
      )}
      onDragOver={(event) => {
        event.preventDefault()
        if (disabled) return
        setIsDragActive(true)
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragActive(false)
        if (disabled) return
        handleFiles(event.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />

      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
          {isDragActive ? (
            <UploadCloud className="h-6 w-6 text-[var(--brand-blue)]" aria-hidden />
          ) : (
            <FileSpreadsheet className="h-6 w-6 text-[var(--text-secondary)]" aria-hidden />
          )}
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold text-[var(--text-primary)]">
            Trage aici fișierul Excel sau selectează-l manual
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Acceptăm doar fișiere <strong>.xlsx</strong> de maximum 2 MB.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="h-4 w-4" aria-hidden />
          Selectează fișier
        </Button>
      </div>
    </div>
  )
}
