"use client";

import { radius } from "@/lib/design-tokens";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

type StatusBadgeProps = {
  text: string;
  variant: StatusVariant;
};

const variantStyles: Record<StatusVariant, { bg: string; fg: string; border: string }> = {
  success: { bg: "var(--status-success-bg)", fg: "var(--status-success-text)", border: "var(--status-success-border)" },
  warning: { bg: "var(--status-warning-bg)", fg: "var(--status-warning-text)", border: "var(--status-warning-border)" },
  danger: { bg: "var(--status-danger-bg)", fg: "var(--status-danger-text)", border: "var(--status-danger-border)" },
  info: { bg: "var(--status-info-bg)", fg: "var(--status-info-text)", border: "var(--status-info-border)" },
  neutral: { bg: "var(--status-neutral-bg)", fg: "var(--status-neutral-text)", border: "var(--status-neutral-border)" },
  purple: { bg: "var(--status-purple-bg)", fg: "var(--status-purple-text)", border: "var(--status-purple-border)" },
};

export default function StatusBadge({ text, variant }: StatusBadgeProps) {
  const palette = variantStyles[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: radius.sm,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        lineHeight: 1.1,
      }}
    >
      {text}
    </span>
  );
}
