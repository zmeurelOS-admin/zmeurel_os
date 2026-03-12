"use client";

import { colors, radius, shadows, spacing } from "@/lib/design-tokens";
import TrendBadge from "@/components/ui/TrendBadge";

type MiniCardProps = {
  icon: string;
  value: string;
  sub: string;
  label: string;
  onClick?: () => void;
  trend?: {
    value: number;
    positive: boolean;
  };
};

export default function MiniCard({ icon, value, sub, label, onClick, trend }: MiniCardProps) {
  return (
    <button
      className="flex flex-col justify-between"
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: colors.white,
        border: "none",
        borderRadius: radius.xl,
        boxShadow: shadows.card,
        padding: `${spacing.lg}px`,
        cursor: onClick ? "pointer" : "default",
        gap: spacing.sm,
        minHeight: 110,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.xs, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              fontSize: 16,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
          {label ? <span style={{ fontSize: 10, fontWeight: 700, color: colors.gray, lineHeight: 1.2 }}>{label}</span> : null}
        </div>
        {trend ? <TrendBadge value={trend.value} positive={trend.positive} /> : null}
      </div>

      <div style={{ fontSize: 20, fontWeight: 700, color: colors.dark, lineHeight: 1.15 }}>{value}</div>

      <div style={{ fontSize: 10, color: colors.gray, lineHeight: 1.2 }}>{sub}</div>
    </button>
  );
}
