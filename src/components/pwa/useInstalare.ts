'use client'

import { useSyncExternalStore } from 'react'

import {
  aboneazaInstalarea,
  arePromptInstalare,
  citesteStare,
  esteInstalata,
  instalataInSesiune,
  type StareInstalare,
} from '@/lib/pwa/instalare'

function abonare(callback: () => void) {
  const dezabonare = aboneazaInstalarea(callback)
  const media = typeof window !== 'undefined' ? window.matchMedia?.('(display-mode: standalone)') : null
  media?.addEventListener?.('change', callback)
  window.addEventListener('storage', callback)
  return () => {
    dezabonare()
    media?.removeEventListener?.('change', callback)
    window.removeEventListener('storage', callback)
  }
}

/** Instantaneu ca text (stabil între randări cât nu se schimbă nimic). */
function instantaneu(): string {
  return JSON.stringify({ prompt: arePromptInstalare(), instalata: esteInstalata() || instalataInSesiune(), stare: citesteStare() })
}

const STARE_GOALA: StareInstalare = { primaZi: null, aSalvat: false, inchisaLa: null }

/** Starea instalării pentru React: promptul prins, aplicația instalată, ce s-a notat pe dispozitiv. */
export function useInstalare(): { pregatit: boolean; arePrompt: boolean; instalata: boolean; stare: StareInstalare } {
  const text = useSyncExternalStore(abonare, instantaneu, () => '')
  if (!text) return { pregatit: false, arePrompt: false, instalata: false, stare: STARE_GOALA }
  const parsat = JSON.parse(text) as { prompt: boolean; instalata: boolean; stare: StareInstalare }
  return { pregatit: true, arePrompt: parsat.prompt, instalata: parsat.instalata, stare: parsat.stare }
}
