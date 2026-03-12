import { cn } from '@/lib/utils'

interface SparklineProps {
  values: number[]
  className?: string
  height?: number
  strokeClassName?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildPoints(values: number[], width: number, height: number) {
  if (!values.length) return ''
  if (values.length === 1) return `0,${height / 2} ${width},${height / 2}`

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return values
    .map((raw, index) => {
      const x = (index / (values.length - 1)) * width
      const normalized = (raw - min) / range
      const y = clamp(height - normalized * height, 0, height)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

export function Sparkline({
  values,
  className,
  height = 22,
  strokeClassName = 'stroke-emerald-600',
}: SparklineProps) {
  const width = 100
  const points = buildPoints(values, width, height)
  const fallbackPoints = `0,${height / 2} ${width},${height / 2}`

  return (
    <div className={cn('h-5 w-20', className)} aria-hidden>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        <polyline
          fill="none"
          strokeWidth="2"
          points={points || fallbackPoints}
          className={cn('fill-none', strokeClassName)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

