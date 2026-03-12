'use client'

const START_ONBOARDING_KEY_PREFIX = 'zmeurel_start_onboarding_seen_v1'
const DEMO_MODE_KEY = 'demo_mode'
const FARM_SETUP_KEY = 'farm_setup'
const DEMO_SEED_ATTEMPTED_KEY = 'zmeurel_demo_seed_attempted'

function hasWindow() {
  return typeof window !== 'undefined'
}

function keyForUser(userId?: string | null) {
  const normalized = String(userId ?? '').trim()
  if (!normalized) return START_ONBOARDING_KEY_PREFIX
  return `${START_ONBOARDING_KEY_PREFIX}:${normalized}`
}

export function hasCompletedStartOnboarding(userId?: string | null): boolean {
  if (!hasWindow()) return false
  return window.localStorage.getItem(keyForUser(userId)) === '1'
}

export function markCompletedStartOnboarding(userId?: string | null) {
  if (!hasWindow()) return
  window.localStorage.setItem(keyForUser(userId), '1')
}

export function isDemoModeEnabled(): boolean {
  if (!hasWindow()) return false
  return window.sessionStorage.getItem(DEMO_MODE_KEY) === 'true'
}

export function enableDemoMode() {
  if (!hasWindow()) return
  window.sessionStorage.setItem(DEMO_MODE_KEY, 'true')
  window.sessionStorage.removeItem(FARM_SETUP_KEY)
}

export function disableDemoMode() {
  if (!hasWindow()) return
  window.sessionStorage.removeItem(DEMO_MODE_KEY)
}

export function isFarmSetupEnabled(): boolean {
  if (!hasWindow()) return false
  return window.sessionStorage.getItem(FARM_SETUP_KEY) === 'true'
}

export function enableFarmSetupMode() {
  if (!hasWindow()) return
  window.sessionStorage.setItem(FARM_SETUP_KEY, 'true')
  window.sessionStorage.removeItem(DEMO_MODE_KEY)
}

export function disableFarmSetupMode() {
  if (!hasWindow()) return
  window.sessionStorage.removeItem(FARM_SETUP_KEY)
}

export function hasDemoSeedAttempted(): boolean {
  if (!hasWindow()) return false
  return window.sessionStorage.getItem(DEMO_SEED_ATTEMPTED_KEY) === '1'
}

export function markDemoSeedAttempted() {
  if (!hasWindow()) return
  window.sessionStorage.setItem(DEMO_SEED_ATTEMPTED_KEY, '1')
}

export function clearDemoSeedAttempted() {
  if (!hasWindow()) return
  window.sessionStorage.removeItem(DEMO_SEED_ATTEMPTED_KEY)
}
