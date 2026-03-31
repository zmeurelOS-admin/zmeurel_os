import * as React from "react"

import { cn } from "@/lib/utils"

const fieldBase =
  "min-h-[96px] w-full rounded-[var(--agri-radius)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] px-3.5 py-3 text-sm leading-relaxed text-[var(--agri-text)] shadow-[var(--agri-field-idle-shadow)] transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-[var(--agri-text-muted)] placeholder:opacity-70 hover:border-[color:color-mix(in_srgb,var(--agri-primary)_26%,var(--agri-border))] focus-visible:border-[color:color-mix(in_srgb,var(--agri-primary)_48%,var(--agri-border))] focus-visible:shadow-[var(--agri-field-focus-ring)] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-[color:color-mix(in_srgb,var(--destructive)_45%,var(--agri-border))] aria-invalid:shadow-[var(--agri-field-error-ring)]"

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        data-slot="textarea"
        className={cn(fieldBase, className)}
        ref={ref}
        {...props}
      />
    )
  }
)

Textarea.displayName = "Textarea"

export { Textarea }
