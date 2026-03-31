"use client";

import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

type StatusBadgeProps = {
  text: string;
  variant: StatusVariant;
};

const variantClass: Record<StatusVariant, string> = {
  success:
    "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning:
    "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  danger:
    "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  neutral:
    "border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  purple:
    "border-[var(--status-purple-border)] bg-[var(--status-purple-bg)] text-[var(--status-purple-text)]",
};

export default function StatusBadge({ text, variant }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold leading-tight",
        variantClass[variant]
      )}
    >
      {text}
    </span>
  );
}
