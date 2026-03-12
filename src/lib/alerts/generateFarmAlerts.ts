export type FarmAlertType = 'danger' | 'warning' | 'info'

export interface FarmAlert {
  id: string
  type: FarmAlertType
  title: string
  message: string
  actionHref: string
}

export interface GenerateFarmAlertsInput {
  kgHarvestToday: number
  kgOrdersToday: number
  ordersTodayCount: number
  ordersFutureKg: number
  activitiesDueTodayCount: number
  harvestEntriesTodayCount: number
}

function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`
}

export function generateFarmAlerts(input: GenerateFarmAlertsInput): FarmAlert[] {
  const alerts: FarmAlert[] = []

  if (input.ordersTodayCount > 0 && input.kgHarvestToday < input.kgOrdersToday) {
    const missingKg = input.kgOrdersToday - input.kgHarvestToday
    alerts.push({
      id: 'harvest-deficit-today',
      type: 'danger',
      title: 'Deficit producție',
      message: `Lipsesc ${formatKg(missingKg)} pentru livrarile de azi`,
      actionHref: '/comenzi?filter=azi',
    })
  }

  if (
    input.ordersTodayCount > 0 &&
    input.kgOrdersToday > 0 &&
    input.kgHarvestToday > input.kgOrdersToday * 1.3
  ) {
    const excessKg = input.kgHarvestToday - input.kgOrdersToday
    alerts.push({
      id: 'harvest-excess-today',
      type: 'warning',
      title: 'Exces producție',
      message: `Exces producție: +${formatKg(excessKg)}`,
      actionHref: '/recoltari',
    })
  }

  if (input.harvestEntriesTodayCount <= 0) {
    alerts.push({
      id: 'no-harvest-today',
      type: 'warning',
      title: 'Fără recoltări azi',
      message: 'Nu ai introdus recoltări azi',
      actionHref: '/recoltari',
    })
  }

  if (input.activitiesDueTodayCount > 0) {
    alerts.push({
      id: 'activities-due-today',
      type: 'warning',
      title: 'Activități programate',
      message: 'Ai activități programate azi',
      actionHref: '/activitati-agricole',
    })
  }

  return alerts
}
