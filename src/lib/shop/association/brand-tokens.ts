/**
 * Tokenuri de brand „Gustă din Bucovina” (manual identitate vizuală).
 * Folosit în magazinul asociației; nu în ERP sau magazin fermier.
 */

/** Culori de bază; `solid*` rămân aceleași în dark (fundal/CTA). */
export const gustaBrandColors = {
  primary: '#0D6342',
  accent: '#FF9E1B',
  secondary: '#FFF9E3',
  text: '#3D4543',
  solidPrimary: '#0D6342',
  solidAccent: '#FF9E1B',
} as const

/** Pași de 20% față de alb (primary) */
export const gustaPrimaryTints = {
  100: '#0D6342',
  80: '#3D8261',
  60: '#6DA181',
  40: '#9EC1A0',
  20: '#CEE0D0',
} as const

/** Pași de 20% față de alb (accent) */
export const gustaAccentTints = {
  100: '#FF9E1B',
  80: '#FFB149',
  60: '#FFC576',
  40: '#FFD8A4',
  20: '#FFECD1',
} as const

/** Umbre calde, aliniate tonului verde–crem din brand */
export const gustaBrandShadows = {
  sm: '0 1px 2px rgba(13, 99, 66, 0.06), 0 2px 8px rgba(61, 69, 67, 0.04)',
  md: '0 2px 6px rgba(13, 99, 66, 0.08), 0 8px 24px rgba(61, 69, 67, 0.08)',
  lg: '0 4px 12px rgba(13, 99, 66, 0.1), 0 16px 40px rgba(61, 69, 67, 0.1)',
  accentGlow: '0 4px 20px rgba(255, 158, 27, 0.35), 0 2px 8px rgba(13, 99, 66, 0.12)',
} as const

export const gustaBrandRadii = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.375rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const

/** Spațiere în rem, mobile-first */
export const gustaBrandSpacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const

/**
 * Mod întunecat — logică inversată: verde ca fundal dominant, text deschis;
 * accentul rămâne pentru CTA și evidențiere.
 */
export const gustaBrandDark = {
  background: '#0D6342',
  backgroundDeep: '#082F1F',
  surface: '#3D8261',
  surfaceMuted: '#6DA181',
  surfaceElevated: '#9EC1A0',
  text: '#FFF9E3',
  textMuted: '#CEE0D0',
  textSubtle: '#FFECD1',
  accent: '#FF9E1B',
  accentMuted: '#FFB149',
  border: '#6DA181',
  borderSubtle: '#9EC1A0',
  /** Primary ca „cerneală” pe suprafețe deschise în dark (carduri deschise) */
  onLightSurface: '#3D4543',
} as const

export const gustaBrandTokens = {
  color: gustaBrandColors,
  primaryTint: gustaPrimaryTints,
  accentTint: gustaAccentTints,
  shadow: gustaBrandShadows,
  radius: gustaBrandRadii,
  spacing: gustaBrandSpacing,
  dark: gustaBrandDark,
} as const

export type GustaBrandColors = typeof gustaBrandColors
export type GustaPrimaryTints = typeof gustaPrimaryTints
export type GustaAccentTints = typeof gustaAccentTints
export type GustaBrandTokens = typeof gustaBrandTokens
