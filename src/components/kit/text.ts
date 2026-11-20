/**
 * Scara de text a kitului: 64 (cifra mare) / 26 / 22 / 19 / 17 / 15 / 13.
 * Referință: docs/redesign/tokens.md, „Scara de text”.
 *
 * - Câmpurile de introducere au minimum 16 px (sub 16, Safari pe iPhone mărește pagina la focus); folosim 17.
 * - 13 px e doar pentru text ajutător, niciodată pe ceva apăsabil. Nimic sub 13.
 * - Mărimile vin din `--kit-fs-*` (globals.css): la „Mărimea: Mare” (Setări › Aspect) urcă toate cu un pas.
 * - Greutatea și culoarea se adaugă la locul folosirii: `cn(kitText.card, 'font-extrabold text-fg')`.
 */
export const kitText = {
  /** 64 px — cifra mare de pe un ecran dedicat (cantitate). */
  figure: 'text-[length:var(--kit-fs-figure)] leading-none tracking-[-0.03em]',
  /** 26 px — titlu de ecran. */
  screen: 'text-[length:var(--kit-fs-screen)] leading-tight tracking-[-0.02em]',
  /** 22 px — titlu de secțiune, sume. */
  section: 'text-[length:var(--kit-fs-section)] leading-tight tracking-[-0.02em]',
  /** 19 px — titlu de card. */
  card: 'text-[length:var(--kit-fs-card)] leading-tight tracking-[-0.01em]',
  /** 17 px — text de bază, câmpuri, butoane. */
  base: 'text-[length:var(--kit-fs-base)] leading-snug',
  /** 15 px — text secundar. */
  secondary: 'text-[length:var(--kit-fs-secondary)] leading-snug',
  /** 13 px — text ajutător; niciodată pe ceva apăsabil. */
  helper: 'text-[length:var(--kit-fs-helper)] leading-snug',
} as const

export type KitTextStep = keyof typeof kitText

/** Conturul de focus al elementelor apăsabile din kit. */
export const kitFocus = 'outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40'
