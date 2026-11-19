/**
 * Kitul de componente (Faza 1b). Modulele refăcute importă de aici.
 * Reguli: docs/redesign/tokens.md și `npm run check:kit`.
 */

// Butonul rămâne unul singur, în ui/button. Pentru kit: variantele `primary` / `neutral` / `danger` / `quiet`
// și mărimile `touch` (48) / `touch-lg` (56) / `icon-touch`.
export { Button, buttonVariants } from '@/components/ui/button'

export { kitFocus, kitText, type KitTextStep } from './text'

export {
  Tile,
  TileGroup,
  nextMultipleTileValue,
  nextSingleTileValue,
  type TileGroupProps,
  type TileProps,
} from './Tile'
export { Segments, type SegmentOption, type SegmentsProps } from './Segments'
export { FilterPills, type FilterPillOption, type FilterPillsProps } from './FilterPills'
export {
  StatHero,
  StatTile,
  type StatHeroItem,
  type StatHeroProps,
  type StatTileProps,
  type StatTileTone,
} from './StatTile'
export { StatusPill, type StatusPillProps, type StatusTone } from './StatusPill'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export { BigInput, BigTextarea, type BigInputProps, type BigTextareaProps } from './BigInput'
export { ListRow, type ListRowProps } from './ListRow'
export { ToggleRow, type ToggleRowProps, type ToggleRowTone } from './ToggleRow'
export { CheckRow, canToggleCheckRow, type CheckRowProps } from './CheckRow'
export { Notice, type NoticeProps, type NoticeTone } from './Notice'
export { ProgressBar, progressPercent, type ProgressBarProps, type ProgressTone } from './ProgressBar'
export {
  ActionCard,
  ActionCardChip,
  type ActionCardAction,
  type ActionCardProps,
  type ActionCardSecondaryAction,
} from './ActionCard'
