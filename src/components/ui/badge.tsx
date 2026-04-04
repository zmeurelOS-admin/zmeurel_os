import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { getStatusToneTokens } from "@/lib/ui/theme"
import { cn } from "@/lib/utils"

// Badge map-eaza status semantic -> token-uri centralizate.
// Evitam culorile hardcodate pentru a pastra consistenta light/dark.
function getToneBadgeClasses(tone: "success" | "warning" | "danger" | "info" | "neutral") {
  const tokens = getStatusToneTokens(tone)
  return `border-[var(${tokens.border})] bg-[var(${tokens.bg})] text-[var(${tokens.text})]`
}

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap overflow-hidden rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight tracking-wide outline-none [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--focus-ring)_24%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] aria-invalid:border-destructive aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/40 transition-colors",
  {
    variants: {
      variant: {
        default: `${getToneBadgeClasses("success")} [a&]:hover:brightness-[0.98]`,
        secondary: `${getToneBadgeClasses("neutral")} [a&]:hover:bg-[color:color-mix(in_srgb,var(--neutral-bg)_90%,var(--surface-card))]`,
        destructive: `${getToneBadgeClasses("danger")} focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/35 [a&]:hover:brightness-[0.98]`,
        warning: `${getToneBadgeClasses("warning")} [a&]:hover:brightness-[0.98]`,
        info: `${getToneBadgeClasses("info")} [a&]:hover:brightness-[0.98]`,
        outline:
          "border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)] [a&]:hover:bg-[color:color-mix(in_srgb,var(--surface-card-muted)_88%,var(--surface-card))] [a&]:hover:text-[var(--text-primary)]",
        ghost: "border-transparent bg-transparent text-[var(--text-secondary)] [a&]:hover:bg-[var(--surface-card-muted)] [a&]:hover:text-[var(--text-primary)]",
        link: "border-transparent bg-transparent text-[var(--text-primary)] underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
