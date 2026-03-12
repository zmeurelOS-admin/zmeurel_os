"use client";

import { colors, radius, shadows, spacing } from "@/lib/design-tokens";

type AlertVariant = "success" | "warning" | "danger";

type AlertCardProps = {
  icon: string;
  label: string;
  value: string;
  sub: string;
  variant: AlertVariant;
  onClick?: () => void;
};

const variantMap: Record<AlertVariant, { bg: string; border: string }> = {
  success: { bg: colors.greenLight, border: colors.green },
  warning: { bg: colors.yellowLight, border: colors.yellow },
  danger: { bg: colors.coralLight, border: colors.coral },
};

export default function AlertCard({
  icon,
  label,
  value,
  sub,
  variant,
  onClick,
}: AlertCardProps) {
  const theme = variantMap[variant];

  return (
    <button
      className="flex flex-col justify-between"
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: radius.lg,
        boxShadow: shadows.card,
        padding: spacing.md,
        cursor: onClick ? "pointer" : "default",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: colors.dark, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10, color: colors.gray, lineHeight: 1.2 }}>{sub}</div>
    </button>
  );
}
