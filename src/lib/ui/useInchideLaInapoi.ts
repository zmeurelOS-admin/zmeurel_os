'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * „Înapoi” închide foaia de deasupra (promptul 34, §5), fără nicio intrare în istoric.
 *
 * Unde browserul are `CloseWatcher` (Chrome / Edge, pe Android și pe desktop, inclusiv aplicația instalată), fiecare
 * fereastră deschisă își face un „close watcher”: gestul „înapoi” de pe Android și Esc pe desktop închid doar fereastra
 * de deasupra. Unde nu există (Safari, Firefox), nu se face nimic: Esc și X închid prin Radix, iar „înapoi” se
 * comportă ca pe o pagină obișnuită.
 *
 * De ce nu istoricul: înainte, fiecare foaie făcea `history.pushState` la deschidere și lăsa intrarea acolo la
 * închiderea din buton, X, salvare sau Esc. După trei foi, „înapoi” trebuia apăsat de patru ori ca să iasă din pagină.
 *
 * `onClose` se citește dintr-un `ref`: o funcție nouă la fiecare desenare (scrisă direct în JSX) nu mai scoate
 * ascultătorul. Dacă închiderea e oprită (garda unui formular cu ceva nesalvat) și fereastra rămâne deschisă,
 * watcher-ul se face din nou, ca următorul „înapoi” să ajungă tot la gardă.
 */

interface CloseWatcherLike {
  addEventListener(type: 'close', listener: () => void): void
  destroy(): void
}

type CloseWatcherCtor = new () => CloseWatcherLike

export function closeWatcherDisponibil(): CloseWatcherCtor | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as unknown as { CloseWatcher?: CloseWatcherCtor }).CloseWatcher
  return typeof ctor === 'function' ? ctor : null
}

export function useInchideLaInapoi(open: boolean, onClose: () => void): void {
  const latest = useRef(onClose)
  const openRef = useRef(open)
  // Se schimbă doar ca să refacă watcher-ul după o închidere oprită.
  const [rearmare, setRearmare] = useState(0)

  useEffect(() => {
    latest.current = onClose
    openRef.current = open
  })

  useEffect(() => {
    if (!open) return
    const Ctor = closeWatcherDisponibil()
    if (!Ctor) return

    let watcher: CloseWatcherLike | null = null
    try {
      watcher = new Ctor()
    } catch {
      return
    }
    let timer: number | null = null
    watcher.addEventListener('close', () => {
      // Watcher-ul s-a consumat. Cerem închiderea; dacă fereastra rămâne deschisă, îl facem din nou.
      watcher = null
      latest.current()
      timer = window.setTimeout(() => {
        if (openRef.current) setRearmare((value) => value + 1)
      }, 0)
    })

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      watcher?.destroy()
    }
  }, [open, rearmare])
}
