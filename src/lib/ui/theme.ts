export const STATUS_TONES = ['success', 'warning', 'danger', 'info', 'neutral'] as const

export type StatusTone = (typeof STATUS_TONES)[number]
// StatusTone mentine acelasi vocabular de stare in toata aplicatia.
// Maparea centralizata previne drift-ul de culori intre module.

export type StatusToneTokenSet = {
  bg: `--${string}`
  text: `--${string}`
  border: `--${string}`
}

export const STATUS_TONE_TOKENS: Record<StatusTone, StatusToneTokenSet> = {
  success: { bg: '--success-bg', text: '--success-text', border: '--success-border' },
  warning: { bg: '--warning-bg', text: '--warning-text', border: '--warning-border' },
  danger: { bg: '--danger-bg', text: '--danger-text', border: '--danger-border' },
  info: { bg: '--info-bg', text: '--info-text', border: '--info-border' },
  neutral: { bg: '--neutral-bg', text: '--neutral-text', border: '--neutral-border' },
}

export function getStatusToneTokens(tone: StatusTone): StatusToneTokenSet {
  return STATUS_TONE_TOKENS[tone]
}
