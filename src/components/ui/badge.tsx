import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold leading-tight tracking-wide w-fit whitespace-nowrap shrink-0 outline-none [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--agri-primary)_28%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agri-surface)] aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden shadow-[0_1px_2px_rgba(16,32,21,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-none [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-none [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white shadow-none [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/35 dark:bg-destructive/60",
        outline:
          "border-[var(--agri-border-card)] bg-[var(--agri-surface-muted)]/55 text-[var(--agri-text)] shadow-[0_1px_2px_rgba(16,32,21,0.04)] [a&]:hover:bg-[var(--agri-surface-muted)] dark:bg-[var(--agri-surface-muted)]/35 dark:shadow-[0_1px_2px_rgba(0,0,0,0.15)] [a&]:hover:text-[var(--agri-text)]",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
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
