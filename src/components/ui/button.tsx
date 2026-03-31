import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold outline-none transition-[transform,box-shadow,opacity,background-color,border-color,color] duration-150 ease-out active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--agri-primary)_28%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agri-surface)] aria-invalid:ring-destructive/25 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--brand-blue)] text-white shadow-sm hover:shadow-[var(--agri-button-hover-shadow)] hover:opacity-100 lg:hover:opacity-100",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:shadow-[var(--agri-button-hover-shadow)] focus-visible:ring-destructive/30 dark:bg-destructive/60 dark:focus-visible:ring-destructive/35",
        outline:
          "border-[color:var(--button-muted-border)] bg-[var(--button-muted-bg)] text-[var(--button-muted-text)] shadow-xs hover:bg-[var(--button-muted-hover-bg)] hover:text-[var(--button-muted-text)] hover:shadow-[var(--agri-button-hover-shadow)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 hover:shadow-[var(--agri-button-hover-shadow)]",
        ghost:
          "shadow-none hover:bg-accent hover:text-accent-foreground active:scale-100 dark:hover:bg-accent/50",
        link: "shadow-none active:scale-100 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs font-medium has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-xl px-3.5 has-[>svg]:px-3",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-10 rounded-xl",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-xl",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
