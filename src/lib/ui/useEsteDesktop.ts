'use client'

import { useSyncExternalStore } from 'react'

/** Pragul desktopului din promptul 35: 1024 px (`lg` în Tailwind). Sub el, totul e ca pe telefon. */
export const PRAG_DESKTOP = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const media = window.matchMedia(PRAG_DESKTOP)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const citeste = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PRAG_DESKTOP).matches : false)
const peServer = () => false

/**
 * `true` de la 1024 px. Doar pentru *comportament* (un clic deschide foaia pe telefon, fișa din dreapta pe desktop);
 * aspectul se face din clase `lg:`, ca să nu sară pagina la încărcare. Pe server și pe telefon: `false`.
 */
export function useEsteDesktop(): boolean {
  return useSyncExternalStore(subscribe, citeste, peServer)
}
