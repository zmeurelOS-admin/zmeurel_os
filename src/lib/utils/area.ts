export function formatM2ToHa(value: number | string | null | undefined): string {
  const numeric =
    typeof value === 'string'
      ? parseFloat(value.replace(/\s+/g, '').replace(',', '.'))
      : Number(value)
  const safe = Number.isFinite(numeric) ? numeric : 0
  return `${(safe / 10000).toFixed(2)} ha`
}
