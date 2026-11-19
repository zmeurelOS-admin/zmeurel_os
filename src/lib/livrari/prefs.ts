/**
 * Ce ține minte Livrări pe telefon (nu în baza de date): aplicația de navigare și ora apelurilor fără răspuns.
 * `localStorage` poate lipsi sau arunca (mod privat, date șterse): totul e în `try/catch`, iar pagina merge și fără.
 */
import type { NavApp } from './route'

const NAV_APP_KEY = 'zmeurel:livrari:nav-app'
const NO_ANSWER_KEY = 'zmeurel:livrari:no-answer'

export function readNavApp(): NavApp {
  try {
    return window.localStorage.getItem(NAV_APP_KEY) === 'waze' ? 'waze' : 'google'
  } catch {
    return 'google'
  }
}

export function writeNavApp(app: NavApp): void {
  try {
    window.localStorage.setItem(NAV_APP_KEY, app)
  } catch {
    // Fără stocare: alegerea ține doar cât e pagina deschisă.
  }
}

type NoAnswerTimes = Record<string, string>

function readNoAnswerTimes(): NoAnswerTimes {
  try {
    const raw = window.localStorage.getItem(NO_ANSWER_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as NoAnswerTimes) : {}
  } catch {
    return {}
  }
}

/** Ora („14:32”) la care s-a notat „nu a răspuns”, dacă a fost notată azi pe acest telefon. */
export function readNoAnswerTime(comandaId: string, todayIso: string): string | null {
  const stamp = readNoAnswerTimes()[comandaId]
  if (!stamp) return null
  const date = new Date(stamp)
  if (Number.isNaN(date.getTime())) return null
  const pad = (value: number) => String(value).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return day === todayIso ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : null
}

/** Notează (sau, cu `null`, șterge) momentul apelului fără răspuns. Păstrează doar ultimele 100. */
export function writeNoAnswerTime(comandaId: string, at: Date | null): void {
  try {
    const times = readNoAnswerTimes()
    if (at) times[comandaId] = at.toISOString()
    else delete times[comandaId]
    const recent = Object.entries(times)
      .sort(([, left], [, right]) => right.localeCompare(left))
      .slice(0, 100)
    window.localStorage.setItem(NO_ANSWER_KEY, JSON.stringify(Object.fromEntries(recent)))
  } catch {
    // Fără stocare: eticheta apare fără oră.
  }
}
