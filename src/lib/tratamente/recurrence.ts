export type RecurrenceRegula = 'fara_repetare' | 'interval'

export interface ResolveRecurrenceInput {
  todayIso: string
  plannedDate: string | null
  lastAppliedDate: string | null
  appliedCount: number
  regulaRepetare: RecurrenceRegula | null | undefined
  intervalRepetareZile: number | null | undefined
  numarRepetariMax: number | null | undefined
  productIntervalMinDays?: Array<number | null | undefined>
}

export type RecurrenceResolutionSource =
  | 'existing_planned'
  | 'first_due_now'
  | 'repeat_interval'
  | 'completed_without_repeat'
  | 'max_reached'

export interface RecurrenceResolution {
  dueDate: string | null
  zileRamase: number | null
  source: RecurrenceResolutionSource
  maxReached: boolean
  effectiveRepeatIntervalDays: number | null
  restrictiveProductIntervalDays: number | null
  usedRestrictiveProductInterval: boolean
  reason: string
}

function normalizePositiveNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function addDaysIsoDate(value: string, days: number): string | null {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function diffDaysIsoDate(from: string, to: string): number | null {
  const left = new Date(`${from.slice(0, 10)}T12:00:00.000Z`)
  const right = new Date(`${to.slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null
  return Math.round((right.getTime() - left.getTime()) / (24 * 60 * 60 * 1000))
}

function buildRestrictiveIntervalNote(
  effectiveIntervalDays: number | null,
  restrictiveProductIntervalDays: number | null,
  requestedIntervalDays: number | null,
  usedRestrictiveProductInterval: boolean,
): string {
  if (!usedRestrictiveProductInterval || !effectiveIntervalDays || !restrictiveProductIntervalDays) {
    return ''
  }

  if (requestedIntervalDays && requestedIntervalDays < restrictiveProductIntervalDays) {
    return ` Se aplică intervalul mai restrictiv al produsului: ${effectiveIntervalDays} zile, nu ${requestedIntervalDays}.`
  }

  return ` Se aplică intervalul minim al produsului: ${effectiveIntervalDays} zile.`
}

export function resolveRecurrence(input: ResolveRecurrenceInput): RecurrenceResolution {
  const plannedDate = input.plannedDate?.slice(0, 10) ?? null
  const lastAppliedDate = input.lastAppliedDate?.slice(0, 10) ?? null
  const requestedIntervalDays =
    input.regulaRepetare === 'interval' ? normalizePositiveNumber(input.intervalRepetareZile) : null
  const maxRepetari = normalizePositiveNumber(input.numarRepetariMax)
  const restrictiveProductIntervalDays = (input.productIntervalMinDays ?? [])
    .map((value) => normalizePositiveNumber(value))
    .reduce<number | null>((maxValue, value) => {
      if (!value) return maxValue
      if (!maxValue || value > maxValue) return value
      return maxValue
    }, null)

  const effectiveRepeatIntervalDays =
    requestedIntervalDays && restrictiveProductIntervalDays
      ? Math.max(requestedIntervalDays, restrictiveProductIntervalDays)
      : requestedIntervalDays ?? restrictiveProductIntervalDays

  const usedRestrictiveProductInterval =
    Boolean(
      requestedIntervalDays &&
        restrictiveProductIntervalDays &&
        restrictiveProductIntervalDays > requestedIntervalDays,
    )

  if (maxRepetari !== null && input.appliedCount >= maxRepetari) {
    return {
      dueDate: null,
      zileRamase: null,
      source: 'max_reached',
      maxReached: true,
      effectiveRepeatIntervalDays,
      restrictiveProductIntervalDays,
      usedRestrictiveProductInterval,
      reason: `A fost atins numărul maxim de ${maxRepetari} repetări pentru această intervenție.`,
    }
  }

  if (plannedDate) {
    return {
      dueDate: plannedDate,
      zileRamase: diffDaysIsoDate(input.todayIso, plannedDate),
      source: 'existing_planned',
      maxReached: false,
      effectiveRepeatIntervalDays,
      restrictiveProductIntervalDays,
      usedRestrictiveProductInterval,
      reason: 'Există o aplicare planificată pentru intervenția din plan.',
    }
  }

  if (!lastAppliedDate) {
    return {
      dueDate: input.todayIso,
      zileRamase: 0,
      source: 'first_due_now',
      maxReached: false,
      effectiveRepeatIntervalDays,
      restrictiveProductIntervalDays,
      usedRestrictiveProductInterval,
      reason: 'Fenofaza curentă se potrivește cu intervenția din plan.',
    }
  }

  if (!effectiveRepeatIntervalDays) {
    return {
      dueDate: null,
      zileRamase: null,
      source: 'completed_without_repeat',
      maxReached: false,
      effectiveRepeatIntervalDays,
      restrictiveProductIntervalDays,
      usedRestrictiveProductInterval,
      reason: 'Intervenția fără repetare are deja o aplicare efectuată pentru fenofaza curentă.',
    }
  }

  const dueDate = addDaysIsoDate(lastAppliedDate, effectiveRepeatIntervalDays)
  if (!dueDate) {
    return {
      dueDate: null,
      zileRamase: null,
      source: 'completed_without_repeat',
      maxReached: false,
      effectiveRepeatIntervalDays,
      restrictiveProductIntervalDays,
      usedRestrictiveProductInterval,
      reason: 'Nu am putut calcula următoarea repetare recomandată.',
    }
  }

  const zileRamase = diffDaysIsoDate(input.todayIso, dueDate)
  const restrictiveNote = buildRestrictiveIntervalNote(
    effectiveRepeatIntervalDays,
    restrictiveProductIntervalDays,
    requestedIntervalDays,
    usedRestrictiveProductInterval,
  )

  const reason =
    typeof zileRamase === 'number' && zileRamase < 0
      ? `Următoarea repetare recomandată a fost pe ${dueDate}.${restrictiveNote}`
      : typeof zileRamase === 'number' && zileRamase > 0
        ? `Următoarea repetare recomandată este peste ${zileRamase} zile.${restrictiveNote}`
        : `Următoarea repetare recomandată este azi.${restrictiveNote}`

  return {
    dueDate,
    zileRamase,
    source: 'repeat_interval',
    maxReached: false,
    effectiveRepeatIntervalDays,
    restrictiveProductIntervalDays,
    usedRestrictiveProductInterval,
    reason,
  }
}
