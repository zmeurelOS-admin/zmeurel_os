/** Shared backdrop for centered dialogs and sheets (blur + tint). Keep in sync visually. */
export const MODAL_OVERLAY_CLASSES =
  'fixed inset-0 z-[1000] bg-black/35 backdrop-blur-[6px] dark:bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'

/** Footer bar for read-only / detail dialogs (aligned with form dialog footers). */
export const DIALOG_DETAIL_FOOTER_CLASS =
  'flex w-full flex-row items-center justify-between gap-3 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-surface-muted)_40%,var(--agri-surface))] px-5 py-4 sm:px-6 sticky bottom-0 z-10 backdrop-blur-sm'
