import {
  ActivitatePrefillDataSchema,
  buildCompactConversationMemory,
  ComandaPrefillDataSchema,
  detectCreationIntentRo,
  detectKeywordContextFlagsRo,
  parseAndValidateOpenFormPayload,
  parsePrefillDataForForm,
  RecoltarePrefillDataSchema,
  resolveConversationMemorySnippet,
  resolveOpenFormActionFromText,
  StructuredTargetedFlowExtractionSchema,
  type ConversationMemoryRow,
} from '@/app/api/chat/contract-helpers'

declare const describe: (name: string, fn: () => void) => void
declare const it: (name: string, fn: () => void) => void
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void
  toContain: (expected: unknown) => void
  toEqual: (expected: unknown) => void
  toBeLessThanOrEqual: (expected: number) => void
}

describe('AI chat contract - memory restore', () => {
  it('transforma compact 3 schimburi relevante fara payload exagerat', () => {
    const rows: ConversationMemoryRow[] = [
      {
        pathname: '/cheltuieli',
        mesaj_user: 'bagă cheltuiala de 120 lei motorină azi',
        raspuns_ai: 'Am pregătit formularul de cheltuială.',
      },
      {
        pathname: '/cheltuieli',
        mesaj_user: 'cât am dat luna asta',
        raspuns_ai: 'Cheltuieli luna: 450 lei',
      },
      {
        pathname: '/cheltuieli',
        mesaj_user: 'arată-mi top categorii',
        raspuns_ai: 'Categoria principală este combustibil.',
      },
    ]

    const snippet = buildCompactConversationMemory(rows, 'path')
    expect(snippet).toContain('1) U:')
    expect(snippet).toContain('A:')
    expect(snippet.length).toBeLessThanOrEqual(420)
  })

  it('cand nu exista memorie fallback-ul e safe', () => {
    expect(resolveConversationMemorySnippet([], [])).toBe('')
  })

  it('cand pathname nu are match, fallback pe ultimele conversatii functioneaza', () => {
    const fallbackRows: ConversationMemoryRow[] = [
      { pathname: '/comenzi', mesaj_user: 'arată-mi comenzile de azi', raspuns_ai: 'Ai 2 comenzi noi.' },
      { pathname: '/dashboard', mesaj_user: 'ce trebuie azi', raspuns_ai: 'Ai 1 alertă activă.' },
    ]
    const snippet = resolveConversationMemorySnippet([], fallbackRows)
    expect(snippet).toContain('[/')
    expect(snippet).toContain('/comenzi')
  })
})

describe('AI chat contract - open_form valid', () => {
  it('accepta payload valid pentru cheltuiala', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'cheltuiala',
      prefill: { suma: 120, categorie: 'Combustibil și energie', data: '2026-03-23', descriere: 'Motorină' },
    })
    expect(parsed?.form).toBe('cheltuiala')
  })

  it('accepta payload valid pentru investitie', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'investitie',
      prefill: { suma: 1500, categorie: 'Material săditor', data: '2026-03-23', descriere: 'Butași Delniwa' },
    })
    expect(parsed?.form).toBe('investitie')
  })

  it('accepta payload valid pentru recoltare', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'recoltare',
      prefill: { cantitate_kg: 30, parcela_id: 'parcela-1', parcela_label: 'Delniwa', data: '2026-03-23', calitate: 'Cal I' },
    })
    expect(parsed?.form).toBe('recoltare')
  })

  it('accepta payload valid pentru activitate', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'activitate',
      prefill: { tip: 'tratament', parcela_id: 'parcela-1', parcela_label: 'Solar 1', produs: 'Switch', doza: '0.5L', data: '2026-03-23' },
    })
    expect(parsed?.form).toBe('activitate')
  })
})

describe('AI chat contract - structured targeted extraction', () => {
  it('accepta output structurat valid pentru recoltare', () => {
    const parsed = StructuredTargetedFlowExtractionSchema.safeParse({
      flow_key: 'recoltare',
      intent: 'new_flow',
      missing_fields: [],
      needs_clarification: false,
      confidence: 0.94,
      parcela_id: 'parcela-1',
      cantitate_kg: 45,
      data: '2026-03-26',
      observatii: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepta output structurat valid pentru activitate', () => {
    const parsed = StructuredTargetedFlowExtractionSchema.safeParse({
      flow_key: 'activitate',
      intent: 'continue_flow',
      missing_fields: ['data'],
      needs_clarification: true,
      confidence: 0.61,
      parcela_id: 'parcela-1',
      tip: 'tratament',
      produs: 'Switch',
      doza: '0.5L',
      data: null,
      observatii: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('accepta output structurat valid pentru comanda', () => {
    const parsed = StructuredTargetedFlowExtractionSchema.safeParse({
      flow_key: 'comanda',
      intent: 'new_flow',
      missing_fields: [],
      needs_clarification: false,
      confidence: 0.91,
      client_id: 'client-1',
      cantitate_kg: 4,
      produs: 'zmeura',
      data_livrare: '2026-03-27',
      pret_per_kg: null,
      telefon: null,
      locatie_livrare: null,
      observatii: 'După 18:00',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('AI chat contract - prefill_data valid', () => {
  it('accepta prefill_data pentru recoltare', () => {
    const parsed = RecoltarePrefillDataSchema.safeParse({
      parcela_id: 'parcela-1',
      parcela_label: 'Delniwa',
      cantitate_kg: 20,
      data: '2026-03-26',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepta prefill_data pentru activitate', () => {
    const parsed = ActivitatePrefillDataSchema.safeParse({
      parcela_id: 'parcela-1',
      parcela_label: 'Delniwa',
      tip: 'tratament',
      produs: 'Switch',
      doza: '0.5L',
      data: '2026-03-26',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepta prefill_data pentru comanda', () => {
    const parsed = ComandaPrefillDataSchema.safeParse({
      client_id: 'client-1',
      client_label: 'Maria',
      cantitate_kg: 4,
      data_livrare: '2026-03-27',
      observatii: 'După 18:00',
    })
    expect(parsed.success).toBe(true)
  })

  it('parsePrefillDataForForm valideaza strict si respinge campuri extra', () => {
    const parsed = parsePrefillDataForForm('comanda', {
      client_id: 'client-1',
      client_label: 'Maria',
      cantitate_kg: 4,
      data_livrare: '2026-03-27',
      extra: 'nu',
    })
    expect(parsed).toBe(null)
  })
})

describe('AI chat contract - open_form invalid', () => {
  it('respinge form necunoscut', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'vanzare',
      prefill: {},
    })
    expect(parsed).toBe(null)
  })

  it('respinge campuri prefill nepermise', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'cheltuiala',
      prefill: { suma: 120, categorie: 'Combustibil și energie', tenant_id: 'x' },
    })
    expect(parsed).toBe(null)
  })

  it('respinge tipuri gresite', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'recoltare',
      prefill: { cantitate_kg: 'douăzeci', parcela: 'Delniwa', data: '2026-03-23' },
    })
    expect(parsed).toBe(null)
  })

  it('respinge categorii invalide', () => {
    const parsed = parseAndValidateOpenFormPayload({
      action: 'open_form',
      form: 'investitie',
      prefill: { suma: 500, categorie: 'Categorie inventată' },
    })
    expect(parsed).toBe(null)
  })

  it('pe invalid nu este tratat ca actiune executabila', () => {
    const result = resolveOpenFormActionFromText(
      'Iată: {"action":"open_form","form":"investitie","prefill":{"suma":200,"categorie":"Categoria X"}}'
    )
    expect(result.validAction).toBe(null)
    expect(result.hasInvalidOpenFormPayload).toBe(true)
  })
})

describe('AI chat contract - formulari uzuale romana', () => {
  it('bagă o cheltuiala de 120 lei motorina azi', () => {
    const msg = 'bagă o cheltuială de 120 lei motorină azi'
    expect(detectCreationIntentRo(msg)).toBe(true)
    const flags = detectKeywordContextFlagsRo(msg)
    expect(flags.cheltuieli).toBe(true)
  })

  it('trece o activitate de stropit la solar', () => {
    const msg = 'trece o activitate de stropit la solar'
    expect(detectCreationIntentRo(msg)).toBe(true)
    const flags = detectKeywordContextFlagsRo(msg)
    expect(flags.tratament).toBe(true)
  })

  it('cat am dat pe tratamente luna asta', () => {
    const msg = 'cât am dat pe tratamente luna asta'
    const flags = detectKeywordContextFlagsRo(msg)
    expect(flags.cheltuieli).toBe(true)
    expect(flags.tratament).toBe(true)
  })

  it('arata-mi comenzile de azi', () => {
    const msg = 'arată-mi comenzile de azi'
    const flags = detectKeywordContextFlagsRo(msg)
    expect(flags.comenzi).toBe(true)
  })

  it('pune o recoltare la Delniwa', () => {
    const msg = 'pune o recoltare la Delniwa'
    expect(detectCreationIntentRo(msg)).toBe(true)
    const flags = detectKeywordContextFlagsRo(msg)
    expect(flags.recoltare).toBe(true)
  })
})

describe('AI chat contract - fallback safe', () => {
  it('JSON aproape corect dar invalid cade pe fallback text (nu actiune)', () => {
    const result = resolveOpenFormActionFromText(
      '{"action":"open_form","form":"cheltuiala","prefill":{"suma":"120","categorie":"Altceva","data":"2026-03-23"}}'
    )
    expect(result.validAction).toBe(null)
    expect(result.hasInvalidOpenFormPayload).toBe(true)
  })

  it('cand nu exista action open_form nu marcheaza invalid executabil', () => {
    const result = resolveOpenFormActionFromText('Răspuns simplu fără JSON executabil.')
    expect(result.validAction).toBe(null)
    expect(result.hasInvalidOpenFormPayload).toBe(false)
  })
})
