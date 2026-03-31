import * as React from "react"

import { cn } from "@/lib/utils"

const fieldBase =
  "h-[var(--agri-field-h)] w-full min-w-0 rounded-[var(--agri-radius)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] px-3.5 py-2 text-base text-[var(--agri-text)] shadow-[var(--agri-field-idle-shadow)] transition-[border-color,box-shadow,background-color] duration-150 outline-none placeholder:text-[var(--agri-text-muted)] placeholder:opacity-70 file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium selection:bg-primary selection:text-primary-foreground hover:border-[color:color-mix(in_srgb,var(--agri-primary)_26%,var(--agri-border))] focus-visible:border-[color:color-mix(in_srgb,var(--agri-primary)_48%,var(--agri-border))] focus-visible:shadow-[var(--agri-field-focus-ring)] focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 md:text-sm aria-invalid:border-[color:color-mix(in_srgb,var(--destructive)_45%,var(--agri-border))] aria-invalid:shadow-[var(--agri-field-error-ring)]"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(fieldBase, "file:text-foreground", className)}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
