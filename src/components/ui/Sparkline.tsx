"use client";

import { colors } from "@/lib/design-tokens";

type SparklineProps = {
  data: number[];
  color: string;
  width?: number;
  height?: number;
};

export default function Sparkline({
  data,
  color,
  width = 55,
  height = 20,
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polyline
          fill="none"
          stroke={colors.gray}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={`0,${height / 2} ${width},${height / 2}`}
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
