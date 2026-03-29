// ─── AI Financial Chat Router ─────────────────────────────────────────────────
// Deterministic routing: Cheltuiala (OPEX) vs Investiție (CAPEX) vs Ambiguous
// Edge cases handled explicitly before falling back to LLM.

import type { CategorieCheltuiala, CategorieInvestitie } from './categories'

// ─── Result types ─────────────────────────────────────────────────────────────

export interface CheltuialaRoute {
  type: 'cheltuiala'
  categorie: CategorieCheltuiala
}

export interface InvestitieRoute {
  type: 'investitie'
  categorie: CategorieInvestitie
}

export interface AmbiguousRoute {
  type: 'ambiguous'
  /** Întrebare scurtă în română pentru a clarifica intenția utilizatorului. */
  clarification: string
}

/** null = mesajul nu pare o cerere de adăugare financiară; lasă LLM să răspundă. */
export type FinancialRoute = CheltuialaRoute | InvestitieRoute | AmbiguousRoute | null

// ─── Normalizare ──────────────────────────────────────────────────────────────

function norm(msg: string): string {
  return msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Rutează un mesaj de utilizator la formularul financiar potrivit.
 * Apelat DOAR când există deja intenție de creare (`hasCreationIntent`).
 * Returnează null dacă mesajul nu se referă la o cheltuială sau investiție.
 */
export function routeFinancialMessage(raw: string): FinancialRoute {
  const msg = norm(raw)
  const explicitCapex = /\b(capex|investitie)\b/.test(msg)
  const explicitOpex = /\b(opex|cheltuiala)\b/.test(msg)

  if (explicitOpex && /(pompa|atomizor|utilaj|echipament)/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Reparații și întreținere' }
  }

  if (explicitCapex && /(pompa|atomizor|tractor|utilaj|echipament|combina|masina agricola)/.test(msg)) {
    return { type: 'investitie', categorie: 'Utilaje și echipamente' }
  }

  // ── 1. CHELTUIELI (OPEX) — semnale definitive ─────────────────────────────

  // Reparații câștigă față de orice „pompă/utilaj" din context
  if (/reparat|reparatie|reparatii|service|revizie|defect/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Reparații și întreținere' }
  }

  // Motorină / combustibil / factura curent
  if (/motorin|benzin|carburant|combustibil|gpl|gaz natural/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Combustibil și energie' }
  }
  if (/(factura|platit|cost|consum).*(curent|energie|electr)/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Combustibil și energie' }
  }

  // Forță de muncă
  if (/manoper|lucrator|muncitor|salari|zilier|culegatoar|forta.*munc/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Forță de muncă' }
  }

  // Fertilizanți
  if (/fertiliz|ingrasamant|gunoi de grajd|compost\b|humus/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Fertilizanți' }
  }

  // Tratamente fitosanitare
  if (/pesticid|erbicid|fungicid|insecticid|produs.*fito/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Tratamente fitosanitare' }
  }

  // Ambalaje — folie ambalare detectata ÎNAINTE de "folie" generic
  if (/folie.*(ambalaj|pungi?|stretch)|ambalaj|caserol|tava|cutii|cutie|ladita|lazi\b/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Ambalaje' }
  }

  // Transport
  if (/\btransport\b|livrare|curier/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Transport și livrare' }
  }

  // Consumabile mici
  if (/\bscule\b|scul[ae]\b|unelt|foarfec|manusi|echipament.*protectie/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Consumabile' }
  }

  // Sârmă fără context spalier → consumabil
  if (/\bsarma\b/.test(msg) && !/spalier|sustinere|sistem/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Consumabile' }
  }

  // Servicii și taxe
  if (/\btaxa\b|\btaxe\b|impozit|asigurare|contabil|consultant|audit/.test(msg)) {
    return { type: 'cheltuiala', categorie: 'Servicii și taxe' }
  }

  // ── 2. INVESTIȚII (CAPEX) — semnale definitive ────────────────────────────

  // Material săditor
  if (/butas|saditor|rasad|puiet|plantat\b/.test(msg)) {
    return { type: 'investitie', categorie: 'Material săditor' }
  }

  // Irigații noi
  if (/sistem.*irig|instalat.*picurare|montat.*picurare|picurare.*(nou|instalat)|instalatie.*irig/.test(msg)) {
    return { type: 'investitie', categorie: 'Irigații și fertigare' }
  }

  // Sisteme de susținere și protecție
  // folie solar/tunel, tunel/seră nouă, spalier nou, sârmă spalier, plasă anti
  if (/folie.*(solar|tunel|sera|sere)|solar.*nou|tunel.*nou|sera.*nou|spalier.*(nou|instalat|sistem)|sarma.*(spalier|sustinere)|plasa.*anti/.test(msg)) {
    return { type: 'investitie', categorie: 'Sisteme de susținere și protecție' }
  }

  // Depozitare și răcire
  if (/depozit.*nou|camera.*frigor|frigider.*nou|lada.*frigor|spatiu.*frigorific/.test(msg)) {
    return { type: 'investitie', categorie: 'Depozitare și răcire' }
  }

  // Infrastructură și utilități
  if (/bransament|racord electric|foraj|put.*nou|fosa septica|retea.*apa/.test(msg)) {
    return { type: 'investitie', categorie: 'Infrastructură și utilități' }
  }

  // IT și automatizări
  if (/software|aplicatie.*nou|senzor|sensor|automatizare/.test(msg)) {
    return { type: 'investitie', categorie: 'IT și automatizări' }
  }

  // Utilaje/echipamente noi — explicit „nou/cumpărat/achiziționat"
  const isNewItem = /(nou|noua|cumparat|achizit|achizitionat)/.test(msg)
  if (isNewItem && /tractor|utilaj|echipament|combina|masina agricola/.test(msg)) {
    return { type: 'investitie', categorie: 'Utilaje și echipamente' }
  }
  // Pompă nouă → investiție; pompă fără context → ambiguu (verificat mai jos)
  if (isNewItem && /pompa/.test(msg)) {
    return { type: 'investitie', categorie: 'Utilaje și echipamente' }
  }

  // Construcții și amenajări
  if (/constructi|construire|amenaj.*teren|drum.*acces|gard.*nou|imprejmuire/.test(msg)) {
    return { type: 'investitie', categorie: 'Construcții și amenajări' }
  }

  // ── 3. CAZURI AMBIGUE — cere clarificare ─────────────────────────────────

  // Pompă fără context clar (nu reparatie, nu nou)
  if (/pompa/.test(msg)) {
    return {
      type: 'ambiguous',
      clarification: 'Pompă nouă (investiție CAPEX) sau reparație pompă (cheltuiala OPEX)? Precizează și deschid formularul potrivit!',
    }
  }

  // Folie fără context clar
  if (/\bfolie\b/.test(msg)) {
    return {
      type: 'ambiguous',
      clarification: 'Folie pentru acoperit solar/tunel (investiție) sau folie ambalare fructe (cheltuiala)? Precizează mai clar!',
    }
  }

  // Sârmă fără context
  if (/\bsarma\b/.test(msg)) {
    return {
      type: 'ambiguous',
      clarification: 'Sârmă pentru spalier nou (investiție) sau consumabil mic (cheltuiala)? Precizează mai clar!',
    }
  }

  // Nu pare o cerere financiară — lasă LLM să răspundă
  return null
}
