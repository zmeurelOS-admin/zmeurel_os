'use client'

import { useId, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

const fieldBase = cn(
  'w-full rounded-box border-2 border-border-strong bg-surface px-4 font-semibold text-fg outline-none transition-[border-color,box-shadow]',
  kitText.base,
  'placeholder:font-normal placeholder:text-fg-subtle focus:border-primary focus:ring-[3px] focus:ring-primary/20',
  'disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger aria-invalid:focus:ring-danger/20',
)

interface FieldChromeProps {
  /** Eticheta vizibilă de deasupra câmpului. */
  label?: ReactNode
  /** Text ajutător sub câmp. */
  hint?: ReactNode
  /** Mesaj de eroare; marchează câmpul ca invalid și înlocuiește `hint`. */
  error?: ReactNode
  /** Clasele învelișului (etichetă + câmp + mesaj). `className` merge pe câmp. */
  wrapperClassName?: string
}

function useFieldIds(id: string | undefined, hint: ReactNode, error: ReactNode, describedBy: string | undefined) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const messageId = `${fieldId}-mesaj`
  const hasMessage = Boolean(error || hint)
  return {
    fieldId,
    messageId,
    describedBy: [describedBy, hasMessage ? messageId : null].filter(Boolean).join(' ') || undefined,
  }
}

function FieldMessage({ id, hint, error }: { id: string; hint: ReactNode; error: ReactNode }) {
  if (error) {
    return (
      <p id={id} className={cn('font-medium text-danger-text', kitText.secondary)}>
        {error}
      </p>
    )
  }
  if (hint) {
    return (
      <p id={id} className={cn('text-fg-muted', kitText.helper)}>
        {hint}
      </p>
    )
  }
  return null
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={cn('font-semibold text-fg', kitText.secondary)}>
      {children}
    </label>
  )
}

export interface BigInputProps extends ComponentProps<'input'>, FieldChromeProps {
  /** Iconiță în stânga, în interiorul câmpului (ex. lupa de la căutare). */
  leading?: ReactNode
  /** Element în dreapta, în interiorul câmpului (ex. buton de ștergere, unitate). */
  trailing?: ReactNode
}

/** Câmp text mare: 56 px, text de 17 px. */
export function BigInput({
  label,
  hint,
  error,
  leading,
  trailing,
  wrapperClassName,
  className,
  id,
  'aria-describedby': ariaDescribedBy,
  ...props
}: BigInputProps) {
  const ids = useFieldIds(id, hint, error, ariaDescribedBy)

  return (
    <div className={cn('flex flex-col gap-2', wrapperClassName)}>
      {label ? <FieldLabel htmlFor={ids.fieldId}>{label}</FieldLabel> : null}
      <div className="relative">
        {leading ? (
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted [&_svg]:size-5"
            aria-hidden
          >
            {leading}
          </span>
        ) : null}
        <input
          id={ids.fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          className={cn(fieldBase, 'h-touch-lg', leading && 'pl-12', trailing && 'pr-14', className)}
          {...props}
        />
        {trailing ? <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">{trailing}</span> : null}
      </div>
      <FieldMessage id={ids.messageId} hint={hint} error={error} />
    </div>
  )
}

export interface BigTextareaProps extends ComponentProps<'textarea'>, FieldChromeProps {}

/** Varianta pe mai multe rânduri a câmpului mare (ex. „Notă pentru livrare”). */
export function BigTextarea({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  id,
  rows = 3,
  'aria-describedby': ariaDescribedBy,
  ...props
}: BigTextareaProps) {
  const ids = useFieldIds(id, hint, error, ariaDescribedBy)

  return (
    <div className={cn('flex flex-col gap-2', wrapperClassName)}>
      {label ? <FieldLabel htmlFor={ids.fieldId}>{label}</FieldLabel> : null}
      <textarea
        id={ids.fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(fieldBase, 'resize-none py-3 font-medium', className)}
        {...props}
      />
      <FieldMessage id={ids.messageId} hint={hint} error={error} />
    </div>
  )
}
