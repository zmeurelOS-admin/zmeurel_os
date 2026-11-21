type MaybeString = string | null | undefined
type MaybeNumber = number | null | undefined

function normalizeText(value: MaybeString): string {
  return (value ?? '').trim()
}

function joinParts(parts: Array<MaybeString>, separator = ' - '): string {
  return parts.map(normalizeText).filter(Boolean).join(separator)
}

export function formatDateRo(value: MaybeString): string {
  if (!value) return 'data necunoscuta'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'data necunoscuta'
  return date.toLocaleDateString('ro-RO')
}

export function buildParcelaDeleteLabel(parcela: {
  id_parcela?: MaybeString
  nume_parcela?: MaybeString
  soi_plantat?: MaybeString
  an_plantare?: MaybeNumber
} | null | undefined): string {
  if (!parcela) return 'Teren selectat'

  const name = normalizeText(parcela.nume_parcela)
  const crop = joinParts([
    parcela.soi_plantat,
    parcela.an_plantare ? String(parcela.an_plantare) : '',
  ], ' ')

  return joinParts([name || 'Teren', crop], ' - ')
}

export function buildActivitateDeleteLabel(activitate: {
  data_aplicare?: MaybeString
  tip_activitate?: MaybeString
  produs_utilizat?: MaybeString
} | null | undefined, parcelaName?: MaybeString): string {
  if (!activitate) return 'Activitate selectata'

  return joinParts([
    formatDateRo(activitate.data_aplicare),
    activitate.tip_activitate || 'Activitate',
    activitate.produs_utilizat || '',
    parcelaName || '',
  ])
}

export function buildButasiOrderDeleteLabel(order: {
  data_comanda?: MaybeString
  items?: Array<{ soi?: MaybeString }>
  total_lei?: MaybeNumber
} | null | undefined, clientName?: MaybeString): string {
  if (!order) return 'Comanda selectata'

  const firstSoi = normalizeText(order.items?.[0]?.soi)
  const total = Number(order.total_lei ?? 0)

  return joinParts([
    formatDateRo(order.data_comanda),
    firstSoi ? `Soi: ${firstSoi}` : '',
    Number.isFinite(total) ? `${total.toFixed(2)} lei` : '',
    clientName || '',
  ])
}
