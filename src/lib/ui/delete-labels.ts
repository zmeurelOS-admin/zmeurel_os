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

export function buildRecoltareDeleteLabel(recoltare: {
  data?: MaybeString
  kg_cal1?: MaybeNumber
  kg_cal2?: MaybeNumber
} | null | undefined, parcelaName?: MaybeString): string {
  if (!recoltare) return 'Recoltare selectata'

  const kgCal1 = Number(recoltare.kg_cal1 ?? 0)
  const kgCal2 = Number(recoltare.kg_cal2 ?? 0)
  const totalKg = kgCal1 + kgCal2

  return joinParts([
    formatDateRo(recoltare.data),
    Number.isFinite(totalKg) ? `${totalKg.toFixed(2)} kg` : '',
    parcelaName || '',
  ])
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

export function buildVanzareDeleteLabel(vanzare: {
  data?: MaybeString
  cantitate_kg?: MaybeNumber
  pret_lei_kg?: MaybeNumber
} | null | undefined, clientName?: MaybeString): string {
  if (!vanzare) return 'Vanzare selectata'

  const kg = Number(vanzare.cantitate_kg ?? 0)
  const pret = Number(vanzare.pret_lei_kg ?? 0)
  return joinParts([
    formatDateRo(vanzare.data),
    Number.isFinite(kg) ? `${kg.toFixed(2)} kg` : '',
    Number.isFinite(pret) && pret > 0 ? `${pret.toFixed(2)} lei/kg` : '',
    clientName || '',
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

export function buildInvestitieDeleteLabel(investitie: {
  data?: MaybeString
  categorie?: MaybeString
  suma_lei?: MaybeNumber
} | null | undefined, parcelaName?: MaybeString): string {
  if (!investitie) return 'Investitie selectata'

  const suma = Number(investitie.suma_lei ?? 0)
  return joinParts([
    formatDateRo(investitie.data),
    investitie.categorie || 'Investitie',
    Number.isFinite(suma) ? `${suma.toFixed(2)} lei` : '',
    parcelaName || '',
  ])
}

export function buildCheltuialaDeleteLabel(cheltuiala: {
  data?: MaybeString
  categorie?: MaybeString
  suma_lei?: MaybeNumber
  furnizor?: MaybeString
} | null | undefined): string {
  if (!cheltuiala) return 'Cheltuiala selectata'
  const suma = Number(cheltuiala.suma_lei ?? 0)
  return joinParts([
    formatDateRo(cheltuiala.data),
    cheltuiala.categorie || 'Cheltuiala',
    Number.isFinite(suma) ? `${suma.toFixed(2)} lei` : '',
    cheltuiala.furnizor || '',
  ])
}
