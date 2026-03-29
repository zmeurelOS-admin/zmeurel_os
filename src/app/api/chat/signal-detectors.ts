export function hasQuestionIntentRo(message: string): boolean {
  return /(\?|\b(c[aâ]t|ce|care|cum|unde|c[aâ]nd|arat[aă]|vezi|raport|sumar|total)\b)/i.test(message)
}

export function hasFinancialCostSignalRo(message: string): boolean {
  return /(cheltuial|sum[aă]|\blei\b|\bron\b|am pl[ăa]tit|am cump[ăa]rat|bon|factur[aă])/i.test(message)
}

export function hasHarvestSignalRo(message: string): boolean {
  return /(recoltare|recoltat|am recoltat|cules|am cules|culegere)/i.test(message)
}

export function hasActivitySignalRo(message: string): boolean {
  return /(activitat|stropit|stropire|erbicidat|fertirigat|fertilizat|irigat|irigare|copilit|palisat|t[ăa]iat|cosit|pr[aă][șs]it|legat|plantat|tratat|tratament|aplicat)/i.test(message)
}

export function hasOrderSignalRo(message: string): boolean {
  return /(comand[aă]|comenzi|livr|livrare)/i.test(message)
}

export function hasClientSignalRo(message: string): boolean {
  return /(client nou|client[aă] nou|client|client[aă])/i.test(message)
}

export function hasInvestmentSignalRo(message: string): boolean {
  return /(investi[țt]ie|investitie|capex)/i.test(message)
}

export function hasExplicitCorrectionSignalRo(message: string): boolean {
  return /^\s*(?:nu\b|de fapt\b|mai bine\b|corect este\b|rectific\b)/i.test(message.trim())
}
