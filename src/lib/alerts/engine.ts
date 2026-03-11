import { calculateProfit } from '@/lib/calculations/profit'

export type AlertSeverity = 'info' | 'warning' | 'danger'

export interface SmartAlert {
  id: string
  alertKey: string
  severity: AlertSeverity
  title: string
  message: string
}

export interface SmartAlertInput {
  today?: Date
  recoltari: Array<{
    data: string
    parcela_id: string | null
  }>
  vanzari: Array<{
    data: string
    cantitate_kg: number
    pret_lei_kg: number
  }>
  cheltuieli: Array<{
    data: string
    suma_lei: number
  }>
  activitati: Array<{
    id: string
    data_aplicare: string
    tip_activitate: string | null
    timp_pauza_zile: number
    operator: string | null
  }>
  parcele: Array<{
    id: string
    nume_parcela: string | null
  }>
}

const NO_HARVEST_DAYS_THRESHOLD = 14

function stripTime(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

export function generateSmartAlerts(input: SmartAlertInput): SmartAlert[] {
  const today = stripTime(input.today ?? new Date())
  const alerts: SmartAlert[] = []

  const start30 = new Date(today)
  start30.setDate(start30.getDate() - 30)

  const venit30 = input.vanzari
    .filter((row) => {
      const date = new Date(row.data)
      return date >= start30 && date <= today
    })
    .reduce((sum, row) => sum + Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0), 0)

  const cost30 = input.cheltuieli
    .filter((row) => {
      const date = new Date(row.data)
      return date >= start30 && date <= today
    })
    .reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)

  const metrics30 = calculateProfit(venit30, cost30)

  if (cost30 > venit30 && (cost30 > 0 || venit30 > 0)) {
    alerts.push({
      id: 'cost-over-income',
      alertKey: 'cost_over_income:30d',
      severity: 'danger',
      title: 'Costuri peste venit',
      message: `Ultimele 30 zile: costuri ${cost30.toFixed(0)} lei, venit ${venit30.toFixed(0)} lei.`,
    })
  }

  if (metrics30.margin < 0 && metrics30.revenue > 0) {
    alerts.push({
      id: 'negative-margin',
      alertKey: 'negative_margin:30d',
      severity: 'danger',
      title: 'Marja negativa',
      message: `Marja curenta este ${metrics30.margin.toFixed(1)}%.`,
    })
  }

  const latestByParcela = new Map<string, Date>()
  input.recoltari.forEach((row) => {
    if (!row.parcela_id) return
    const date = stripTime(new Date(row.data))
    const current = latestByParcela.get(row.parcela_id)
    if (!current || date > current) latestByParcela.set(row.parcela_id, date)
  })

  input.parcele.forEach((parcela) => {
    const latest = latestByParcela.get(parcela.id)
    if (!latest) {
      alerts.push({
        id: `no-harvest-${parcela.id}`,
        alertKey: `no_harvest:${parcela.id}`,
        severity: 'warning',
        title: 'Parcelă fără recoltare',
        message: `${parcela.nume_parcela ?? 'Parcelă'} nu are recoltări înregistrate.`,
      })
      return
    }

    const diffDays = Math.floor((today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays >= NO_HARVEST_DAYS_THRESHOLD) {
      alerts.push({
        id: `stale-harvest-${parcela.id}`,
        alertKey: `stale_harvest:${parcela.id}`,
        severity: 'warning',
        title: 'Parcelă fără recoltare recentă',
        message: `${parcela.nume_parcela ?? 'Parcelă'} nu a avut recoltare de ${diffDays} zile.`,
      })
    }
  })

  input.activitati.forEach((activity) => {
    const applyDate = stripTime(new Date(activity.data_aplicare))
    const diffDays = Math.floor((today.getTime() - applyDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays > 2 && !activity.operator) {
      alerts.push({
        id: `late-activity-${activity.id}`,
        alertKey: `late_activity:${activity.id}`,
        severity: 'warning',
        title: 'Activitate posibil întârziată',
        message: `${activity.tip_activitate ?? 'Activitate'} are data ${applyDate.toLocaleDateString('ro-RO')} și nu are operator.`,
      })
    }

    if ((activity.timp_pauza_zile ?? 0) > 0) {
      const pauseEnd = new Date(applyDate)
      pauseEnd.setDate(pauseEnd.getDate() + activity.timp_pauza_zile)
      if (today < pauseEnd) {
        const remaining = Math.ceil((pauseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        alerts.push({
          id: `pause-active-${activity.id}`,
          alertKey: `pauza_activa:${activity.id}`,
          severity: 'info',
          title: 'Timp pauză tratament activ',
          message: `${activity.tip_activitate ?? 'Tratament'} are încă ${remaining} zile până la expirare.`,
        })
      }
    }
  })

  return alerts.slice(0, 8)
}
