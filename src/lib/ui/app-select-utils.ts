import type { AppSelectOption } from '@/components/ui/app-select'
import type { EmojiOption } from '@/lib/parcele/parcel-form-options'

export function emojiOptionsToAppSelect(options: readonly EmojiOption[]): AppSelectOption[] {
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    emoji: option.emoji,
  }))
}

export function withPlaceholderOption(
  options: AppSelectOption[],
  placeholder: { value: string; label: string }
): AppSelectOption[] {
  if (options.some((option) => option.value === placeholder.value)) return options
  return [placeholder, ...options]
}

export function labelsToAppSelectOptions(
  labels: readonly string[],
  emojiByLabel?: Record<string, string>
): AppSelectOption[] {
  return labels.map((label) => ({
    value: label,
    label,
    emoji: emojiByLabel?.[label],
  }))
}
