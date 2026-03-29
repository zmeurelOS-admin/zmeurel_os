import * as React from "react"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      className={cn(
        orientation === "horizontal"
          ? "h-px w-full"
          : "h-full w-px",
        "shrink-0 bg-[var(--surface-divider)]",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
