'use client'

export const DEMO_TUTORIAL_SEEN_KEY = 'zmeurel_demo_tutorial_seen_v1'
export const DEMO_TUTORIAL_PENDING_KEY = 'zmeurel_demo_tutorial_pending_v1'

function hasWindow() {
  return typeof window !== 'undefined'
}

export function hasSeenDemoTutorial(): boolean {
  if (!hasWindow()) return false
  return window.localStorage.getItem(DEMO_TUTORIAL_SEEN_KEY) === '1'
}

export function markDemoTutorialSeen() {
  if (!hasWindow()) return
  window.localStorage.setItem(DEMO_TUTORIAL_SEEN_KEY, '1')
}

export function resetDemoTutorialSeen() {
  if (!hasWindow()) return
  window.localStorage.removeItem(DEMO_TUTORIAL_SEEN_KEY)
}

export function isDemoTutorialPending(): boolean {
  if (!hasWindow()) return false
  return window.localStorage.getItem(DEMO_TUTORIAL_PENDING_KEY) === '1'
}

export function markDemoTutorialPending() {
  if (!hasWindow()) return
  window.localStorage.setItem(DEMO_TUTORIAL_PENDING_KEY, '1')
}

export function clearDemoTutorialPending() {
  if (!hasWindow()) return
  window.localStorage.removeItem(DEMO_TUTORIAL_PENDING_KEY)
}
