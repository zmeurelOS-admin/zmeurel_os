"use client";

import { colors, radius } from "@/lib/design-tokens";

type TrendBadgeProps = {
  value: number;
  positive: boolean;
};

export default function TrendBadge({ value, positive }: TrendBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        background: positive ? colors.greenLight : colors.coralLight,
        color: positive ? colors.green : colors.coral,
        fontSize: 9,
        fontWeight: 700,
        padding: "2px 5px",
        borderRadius: radius.sm - 2,
        lineHeight: 1,
      }}
    >
      {positive ? "↑" : "↓"}
      {Math.abs(value)}%
    </span>
  );
}
