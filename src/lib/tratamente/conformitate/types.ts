export interface ConformitateMetrici {
  parcelaId: string
  an: number
  cupruKgHa: number
  cupruAlertLevel: 'ok' | 'warning' | 'exceeded'
  fracViolatii: number
  fracDetalii: { frac: string; aplicari_consecutive: number }[]
  totalAplicari: number
  urmatoareaAplicare: { data: string; produs: string } | null
  ultimaAplicare: { data: string; produs: string } | null
}

