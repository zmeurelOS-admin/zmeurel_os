import { z } from 'zod'

export const PASTE_TO_X_MODEL = 'claude-haiku-4-5-20251001'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type PasteToXModule =
  | 'comenzi'
  | 'cheltuieli'
  | 'investitii'
  | 'recoltari'
  | 'tratamente'

export type PasteToXConfidence = 'high' | 'medium' | 'low'
export type PasteToXAutosaveMode = 'auto' | 'auto_with_threshold' | 'draft_only'

export interface PasteToXNowContext {
  nowLocalDate: string
  nowLocalDateTime: string
  timezone?: string
}

const nullableTrimmedString = (max: number) =>
  z.union([z.string().trim().min(1).max(max), z.null()]).transform((value) => value ?? null)

const nullablePositiveNumber = (max: number) =>
  z.union([z.number().positive().max(max), z.null()])

const confidenceSchema = z.enum(['high', 'medium', 'low'])
const uncertaintiesSchema = z.array(z.string().trim().min(1).max(300)).max(20)

export const PasteToXOrderSchema = z
  .object({
    client_nume_manual: nullableTrimmedString(120),
    telefon: nullableTrimmedString(30),
    locatie_livrare: nullableTrimmedString(220),
    data_livrare: z.union([z.string().regex(ISO_DATE_RE), z.null()]),
    cantitate_kg: nullablePositiveNumber(100_000),
    pret_per_kg: nullablePositiveNumber(10_000),
    observatii: nullableTrimmedString(300),
    tip_client_detectat: z.union([z.enum(['standard', 'patiserie', 'magazin']), z.null()]),
    incertitudini: uncertaintiesSchema,
    confidence: confidenceSchema,
  })
  .strict()

export const PasteToXCheltuialaSchema = z
  .object({
    data: z.union([z.string().regex(ISO_DATE_RE), z.null()]),
    categorie: nullableTrimmedString(120),
    descriere: nullableTrimmedString(300),
    suma_lei: nullablePositiveNumber(1_000_000),
    furnizor: nullableTrimmedString(160),
    metoda_plata: z.union([z.enum(['cash', 'card', 'transfer', 'transfer bancar', 'alta']), z.null()]),
    incertitudini: uncertaintiesSchema,
    confidence: confidenceSchema,
  })
  .strict()

export const PasteToXInvestitieSchema = z
  .object({
    data: z.union([z.string().regex(ISO_DATE_RE), z.null()]),
    categorie: nullableTrimmedString(120),
    descriere: nullableTrimmedString(300),
    suma_lei: nullablePositiveNumber(10_000_000),
    furnizor: nullableTrimmedString(160),
    parcela_referita: nullableTrimmedString(160),
    incertitudini: uncertaintiesSchema,
    confidence: confidenceSchema,
  })
  .strict()

export const PasteToXRecoltareSchema = z
  .object({
    data: z.union([z.string().regex(ISO_DATE_RE), z.null()]),
    culegator_nume: nullableTrimmedString(120),
    parcela_referita: nullableTrimmedString(160),
    cantitate_kg: nullablePositiveNumber(100_000),
    cantitate_kg_separata: z
      .object({
        cal1: nullablePositiveNumber(100_000),
        cal2: nullablePositiveNumber(100_000),
      })
      .strict(),
    observatii: nullableTrimmedString(300),
    incertitudini: uncertaintiesSchema,
    confidence: confidenceSchema,
  })
  .strict()

export const PasteToXTratamentSchema = z
  .object({
    data_aplicata: z.union([z.string().regex(ISO_DATE_RE), z.null()]),
    parcela_referita: nullableTrimmedString(160),
    produs_nume_manual: nullableTrimmedString(160),
    doza_text_brut: nullableTrimmedString(200),
    metoda_aplicare_detectata: z.union([
      z.enum(['foliar', 'fertirigare', 'fertilizare_baza', 'granulat_sol', 'altul']),
      z.null(),
    ]),
    tip_interventie_detectat: z.union([
      z.enum(['protectie', 'nutritie', 'biostimulare', 'erbicidare', 'igiena', 'altul']),
      z.null(),
    ]),
    observatii: nullableTrimmedString(300),
    incertitudini: uncertaintiesSchema,
    confidence: confidenceSchema,
  })
  .strict()

export type PasteToXOrder = z.infer<typeof PasteToXOrderSchema>
export type PasteToXCheltuiala = z.infer<typeof PasteToXCheltuialaSchema>
export type PasteToXInvestitie = z.infer<typeof PasteToXInvestitieSchema>
export type PasteToXRecoltare = z.infer<typeof PasteToXRecoltareSchema>
export type PasteToXTratament = z.infer<typeof PasteToXTratamentSchema>

type PasteToXModuleConfig = {
  title: string
  target: string
  autosave: PasteToXAutosaveMode
  confirmationThresholdLei: number | null
  prompt: string
}

export const PASTE_TO_X_MODULES: Record<PasteToXModule, PasteToXModuleConfig> = {
  comenzi: {
    title: 'Comenzi',
    target: 'comenzi',
    autosave: 'auto',
    confirmationThresholdLei: null,
    prompt: [
      'Extragi o comandă dintr-un mesaj. Auto-save: DA (cu validare client + stoc înainte de commit).',
      'Returnezi:',
      '{',
      '  "client_nume_manual": "string | null",',
      '  "telefon": "string | null",',
      '  "locatie_livrare": "string | null",',
      '  "data_livrare": "YYYY-MM-DD | null",',
      '  "cantitate_kg": "number | null",',
      '  "pret_per_kg": "number | null",',
      '  "observatii": "string | null",',
      '  "tip_client_detectat": "standard | patiserie | magazin | null",',
      '  "incertitudini": ["string"],',
      '  "confidence": "high | medium | low"',
      '}',
    ].join('\n'),
  },
  cheltuieli: {
    title: 'Cheltuieli',
    target: 'cheltuieli_diverse',
    autosave: 'auto',
    confirmationThresholdLei: null,
    prompt: [
      'Extragi o cheltuială operațională dintr-un mesaj. Exemple de categorii tipice din fermă: combustibil, electricitate, reparații, mână de lucru, ambalaje, transport, consumabile.',
      'Returnezi:',
      '{',
      '  "data": "YYYY-MM-DD | null",',
      '  "categorie": "string | null",',
      '  "descriere": "string | null",',
      '  "suma_lei": "number | null",',
      '  "furnizor": "string | null",',
      '  "metoda_plata": "cash | card | transfer | transfer bancar | alta | null",',
      '  "incertitudini": ["string"],',
      '  "confidence": "high | medium | low"',
      '}',
      'Dacă suma nu e clar exprimată în lei, pui suma_lei: null și notezi în incertitudini.',
    ].join('\n'),
  },
  investitii: {
    title: 'Investiții',
    target: 'investitii',
    autosave: 'auto_with_threshold',
    confirmationThresholdLei: 2000,
    prompt: [
      'Extragi o investiție capitală (nu cheltuială operațională curentă) — ex. spalieri, sistem irigare, butași, echipament, construcții.',
      'Returnezi:',
      '{',
      '  "data": "YYYY-MM-DD | null",',
      '  "categorie": "string | null",',
      '  "descriere": "string | null",',
      '  "suma_lei": "number | null",',
      '  "furnizor": "string | null",',
      '  "parcela_referita": "string | null",',
      '  "incertitudini": ["string"],',
      '  "confidence": "high | medium | low"',
      '}',
      '"parcela_referita" rămâne exact cum apare în text. Nu încerca matching la id intern.',
    ].join('\n'),
  },
  recoltari: {
    title: 'Recoltări',
    target: 'recoltari',
    autosave: 'draft_only',
    confirmationThresholdLei: null,
    prompt: [
      'Extragi date brute de recoltare dintr-un mesaj. Nu calcula valori, nu presupune calitatea — extragi doar ce este scris explicit.',
      'Returnezi:',
      '{',
      '  "data": "YYYY-MM-DD | null",',
      '  "culegator_nume": "string | null",',
      '  "parcela_referita": "string | null",',
      '  "cantitate_kg": "number | null",',
      '  "cantitate_kg_separata": {',
      '    "cal1": "number | null",',
      '    "cal2": "number | null"',
      '  },',
      '  "observatii": "string | null",',
      '  "incertitudini": ["string"],',
      '  "confidence": "high | medium | low"',
      '}',
      'Dacă există doar total, pui cal1/cal2 null și păstrezi totalul în cantitate_kg.',
    ].join('\n'),
  },
  tratamente: {
    title: 'Tratamente',
    target: 'aplicari_tratament + aplicari_tratament_produse',
    autosave: 'draft_only',
    confirmationThresholdLei: null,
    prompt: [
      'Extragi o aplicare de tratament fitosanitar/fertilizare dintr-un mesaj informal. Aceasta este o extracție brută — nu calcula PHI, nu determina FRAC/IRAC și nu valida împotriva unui plan activ.',
      'Returnezi:',
      '{',
      '  "data_aplicata": "YYYY-MM-DD | null",',
      '  "parcela_referita": "string | null",',
      '  "produs_nume_manual": "string | null",',
      '  "doza_text_brut": "string | null",',
      '  "metoda_aplicare_detectata": "foliar | fertirigare | fertilizare_baza | granulat_sol | altul | null",',
      '  "tip_interventie_detectat": "protectie | nutritie | biostimulare | erbicidare | igiena | altul | null",',
      '  "observatii": "string | null",',
      '  "incertitudini": ["string"],',
      '  "confidence": "high | medium | low"',
      '}',
      'IMPORTANT: "doza_text_brut" păstrează exact formularea din mesaj. Dacă produsul nu pare recunoscut, marchezi asta explicit în incertitudini.',
    ].join('\n'),
  },
}

export const PASTE_TO_X_ROLLOUT_ORDER: PasteToXModule[] = [
  'cheltuieli',
  'investitii',
  'recoltari',
  'tratamente',
]

export function buildPasteToXCommonSystemPrompt(now: PasteToXNowContext): string {
  return [
    'Ești un asistent care extrage date structurate din mesaje text scrise informal de un fermier român (WhatsApp, notițe vocale transcrise, însemnări rapide).',
    `DATA_CURENTA: ${now.nowLocalDate}`,
    `DATA_SI_ORA_CURENTA: ${now.nowLocalDateTime}`,
    `FUS_ORAR: ${now.timezone ?? 'Europe/Bucharest'}`,
    'REGULI STRICTE:',
    '1. Răspunzi DOAR cu JSON valid, fără text explicativ, fără markdown fences.',
    '2. Dacă un câmp nu apare clar în text, pui null. Nu inventezi și nu presupui.',
    '3. Datele relative ("azi", "ieri", "mâine") se convertesc folosind DATA_CURENTA.',
    '4. La sume și cantități extragi doar numărul. Dacă unitatea nu e clară, pui null la valoare și notezi ambiguitatea în "incertitudini".',
    '5. Numele proprii se păstrează exact cum apar în text. Nu le corectezi ortografic și nu le traduci.',
    '6. Adaugi mereu câmpul "incertitudini": array de string-uri pentru orice lipsă, ambiguitate sau presupunere. Array gol [] dacă totul e clar.',
    '7. Adaugi câmpul "confidence": "high" | "medium" | "low" ca evaluare onestă a extracției per total.',
    'Nu validezi logic datele contra bazei de date. Extragi doar ce este scris în mesaj.',
  ].join('\n')
}

export function buildPasteToXSystemPrompt(
  module: PasteToXModule,
  now: PasteToXNowContext,
): string {
  return [buildPasteToXCommonSystemPrompt(now), PASTE_TO_X_MODULES[module].prompt].join('\n\n')
}

export function buildPasteToXUserMessage(text: string): string {
  return ['Mesaj brut pentru extragere:', '<mesaj>', text, '</mesaj>'].join('\n')
}
