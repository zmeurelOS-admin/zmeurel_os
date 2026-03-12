"use client";

import { colors, radius } from "@/lib/design-tokens";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

type StatusBadgeProps = {
  text: string;
  variant: StatusVariant;
};

const variantStyles: Record<StatusVariant, { bg: string; fg: string; border: string }> = {
  success: { bg: colors.greenLight, fg: colors.green, border: colors.green },
  warning: { bg: colors.yellowLight, fg: colors.dark, border: colors.yellow },
  danger: { bg: colors.coralLight, fg: colors.coral, border: colors.coral },
  info: { bg: colors.blueLight, fg: colors.blue, border: colors.blue },
  neutral: { bg: colors.grayLight, fg: colors.dark, border: colors.gray },
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
