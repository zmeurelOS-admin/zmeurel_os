import type { CanonicalCandidates } from '../src/app/api/chat/flow-detection'

type Flow = 'recoltare' | 'activitate' | 'cheltuiala' | 'investitie' | 'comanda' | 'client'

type CaseExpectation =
  | { kind: 'none' }
  | { kind: 'clarification'; includes: string[]; excludes?: string[] }
  | {
      kind: 'form'
      form: Flow
      prefill?: Record<string, unknown>
      absentPrefill?: string[]
      messageIncludes?: string[]
      messageExcludes?: string[]
    }

type CaseTurn = {
  message: string
  expect: CaseExpectation
}

export type AiChatHarnessCase = {
  id: string
  category: string
  candidates?: Partial<CanonicalCandidates>
  turns: CaseTurn[]
}

export const AI_CHAT_HARNESS_CORPUS: readonly AiChatHarnessCase[] = [
  {
    category: 'routing clar',
    id: 'routing-harvest-explicit',
    turns: [
      {
        message: 'Recoltare la Delniwa 20 kg ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
          messageIncludes: ['culegator'],
        },
      },
    ],
  },
  {
    category: 'routing clar',
    id: 'routing-activity-explicit',
    turns: [
      {
        message: 'Stropit la Delniwa cu Switch azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', data: '2026-03-25' },
        },
      },
    ],
  },
  {
    category: 'routing clar',
    id: 'routing-expense-motorina',
    turns: [
      {
        message: 'am cumparat motorina 300 lei ieri',
        expect: {
          kind: 'form',
          form: 'cheltuiala',
          prefill: { suma: 300, data: '2026-03-24', categorie: 'Combustibil și energie' },
        },
      },
    ],
  },
  {
    category: 'routing clar',
    id: 'routing-expense-switch-needs-date-and-category',
    turns: [
      {
        message: 'am cumparat switch 300 lei',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data', 'ce categorie'],
        },
      },
    ],
  },
  {
    category: 'routing clar',
    id: 'routing-investment-batasi',
    turns: [
      {
        message: 'investitie butasi 1200 lei ieri',
        expect: {
          kind: 'form',
          form: 'investitie',
          prefill: { suma: 1200, data: '2026-03-24', categorie: 'Material săditor' },
        },
      },
    ],
  },
  {
    category: 'routing clar',
    id: 'routing-order-bare-client',
    turns: [
      {
        message: 'comanda Maria 4 kg maine',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26' },
          messageIncludes: ['pretul/kg'],
        },
      },
    ],
  },
  {
    category: 'ambiguitate controlata',
    id: 'ambiguity-harvest-vs-order',
    turns: [
      {
        message: '20 kile la Delniwa',
        expect: {
          kind: 'clarification',
          includes: ['recoltare', 'comanda'],
        },
      },
    ],
  },
  {
    category: 'ambiguitate controlata',
    id: 'ambiguity-name-kg-date',
    turns: [
      {
        message: 'Maria 4 kg maine',
        expect: {
          kind: 'clarification',
          includes: ['recoltare', 'comanda'],
        },
      },
    ],
  },
  {
    category: 'ambiguitate controlata',
    id: 'ambiguity-product-land',
    turns: [
      {
        message: 'Switch la Delniwa',
        expect: {
          kind: 'clarification',
          includes: ['activitate agricola', 'cheltuiala'],
        },
      },
    ],
  },
  {
    category: 'ambiguitate controlata',
    id: 'ambiguity-dose-land',
    turns: [
      {
        message: '500 ml la Delniwa',
        expect: {
          kind: 'clarification',
          includes: ['activitate agricola', 'cheltuiala'],
        },
      },
    ],
  },
  {
    category: 'ambiguitate controlata',
    id: 'ambiguity-vague-action',
    turns: [
      {
        message: 'am pus ceva ieri',
        expect: {
          kind: 'clarification',
          includes: ['activitate agricola', 'cheltuiala'],
        },
      },
    ],
  },
  {
    category: 'ambiguitate controlata',
    id: 'ambiguity-financial-pump',
    turns: [
      {
        message: 'pompa 1200 lei ieri',
        expect: {
          kind: 'clarification',
          includes: ['pompa noua', 'reparatie'],
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-financial-ambiguity-capex-followup',
    turns: [
      {
        message: 'atomizor și pompă, 1050 lei, azi',
        expect: {
          kind: 'clarification',
          includes: ['capex', 'opex'],
        },
      },
      {
        message: 'capex',
        expect: {
          kind: 'form',
          form: 'investitie',
          prefill: {
            suma: 1050,
            data: '2026-03-25',
            categorie: 'Utilaje și echipamente',
            descriere: 'atomizor și pompă',
          },
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-harvest-date-followup',
    turns: [
      {
        message: 'Recoltare la Delniwa',
        expect: { kind: 'clarification', includes: ['pentru ce data'] },
      },
      {
        message: 'ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', data: '2026-03-24' },
          messageIncludes: ['culegator'],
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-harvest-parcel-followup',
    turns: [
      {
        message: 'Recoltare 20 kg ieri',
        expect: { kind: 'clarification', includes: ['de pe ce parcela'] },
      },
      {
        message: 'la Delniwa',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-activity-date-followup',
    turns: [
      {
        message: 'Stropit la Delniwa cu Switch',
        expect: { kind: 'clarification', includes: ['pentru ce data'], excludes: ['ce tip'] },
      },
      {
        message: 'azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', data: '2026-03-25' },
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-expense-date-followup',
    turns: [
      {
        message: 'Cheltuiala motorina 300 lei',
        expect: { kind: 'clarification', includes: ['pentru ce data'], excludes: ['categorie'] },
      },
      {
        message: 'ieri',
        expect: {
          kind: 'form',
          form: 'cheltuiala',
          prefill: { suma: 300, data: '2026-03-24', categorie: 'Combustibil și energie' },
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-investment-day-before-yesterday-followup',
    turns: [
      {
        message: 'Investitie butasi 1200 lei',
        expect: { kind: 'clarification', includes: ['pentru ce data'], excludes: ['ce suma'] },
      },
      {
        message: 'alaltăieri',
        expect: {
          kind: 'form',
          form: 'investitie',
          prefill: { suma: 1200, data: '2026-03-23', categorie: 'Material săditor' },
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-order-price-followup',
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg maine',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26' },
          messageIncludes: ['pretul/kg'],
        },
      },
      {
        message: 'la 18 lei/kg',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26', pret_per_kg: 18 },
          messageExcludes: ['pretul/kg'],
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-order-prefill-client-negotiated-price',
    candidates: {
      clienti: ['Maria'],
      clientNameToId: { Maria: 'client-1' },
      clientNameToPhone: { Maria: '0711111111' },
      clientById: {
        'client-1': {
          id: 'client-1',
          label: 'Maria',
          phone: '0711111111',
          negotiatedPricePerKg: 18,
        },
      },
    },
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg maine',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26', pret_per_kg: 18 },
          messageExcludes: ['pretul/kg'],
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-client-phone-followup',
    turns: [
      {
        message: 'Client nou Maria',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Maria' },
        },
      },
      {
        message: '0722 123 456',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Maria', telefon: '0722123456' },
        },
      },
    ],
  },
  {
    category: 'continuitate multi-turn scurta',
    id: 'continuity-expense-explicit-new-flow-resets-old-prefill',
    turns: [
      {
        message: 'bagă 220 lei motorină azi',
        expect: {
          kind: 'form',
          form: 'cheltuiala',
          prefill: { suma: 220, data: '2026-03-25', categorie: 'Combustibil și energie' },
        },
      },
      {
        message: 'adaugă cheltuială',
        expect: {
          kind: 'clarification',
          includes: ['ce sumă', 'pentru ce dată'],
          excludes: ['220', 'motorină'],
        },
      },
    ],
  },
  {
    category: 'corectii explicite',
    id: 'correction-harvest-date',
    turns: [
      {
        message: 'Recoltare la Delniwa 20 kg azi',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-25' },
        },
      },
      {
        message: 'de fapt ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
        },
      },
    ],
  },
  {
    category: 'corectii explicite',
    id: 'correction-harvest-quantity',
    turns: [
      {
        message: 'Recoltare la Delniwa 20 kg ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
        },
      },
      {
        message: 'nu, 25 kg',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 25, data: '2026-03-24' },
        },
      },
    ],
  },
  {
    category: 'corectii explicite',
    id: 'correction-activity-dose',
    turns: [
      {
        message: 'Activitate de stropit la Delniwa cu Switch 0,5 l azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', doza: '0.5L', data: '2026-03-25' },
        },
      },
      {
        message: 'mai bine 500 ml',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { doza: '0.5L' },
        },
      },
    ],
  },
  {
    category: 'corectii explicite',
    id: 'correction-activity-parcel',
    turns: [
      {
        message: 'Stropit la Delniwa cu Switch azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', data: '2026-03-25' },
        },
      },
      {
        message: 'nu delniwa, la Maravilla',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { parcela: 'Maravilla' },
        },
      },
    ],
  },
  {
    category: 'corectii explicite',
    id: 'correction-client-name',
    turns: [
      {
        message: 'Client nou Maria 0722 123 456',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Maria', telefon: '0722123456' },
        },
      },
      {
        message: 'nu maria, elena',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'elena', telefon: '0722123456' },
        },
      },
    ],
  },
  {
    category: 'corectii explicite',
    id: 'correction-order-date',
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg maine la 18 lei/kg',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26', pret_per_kg: 18 },
          messageExcludes: ['pretul/kg'],
        },
      },
      {
        message: 'de fapt poimaine',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { data_livrare: '2026-03-27', pret_per_kg: 18 },
        },
      },
    ],
  },
  {
    category: 'anulari explicite de camp',
    id: 'clear-client-phone',
    turns: [
      {
        message: 'Client nou Maria 0722 123 456',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Maria', telefon: '0722123456' },
        },
      },
      {
        message: 'fara telefon',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Maria' },
          absentPrefill: ['telefon'],
        },
      },
    ],
  },
  {
    category: 'anulari explicite de camp',
    id: 'clear-harvest-date',
    turns: [
      {
        message: 'Recoltare la Delniwa 20 kg ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
        },
      },
      {
        message: 'scoate data',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data'],
        },
      },
    ],
  },
  {
    category: 'anulari explicite de camp',
    id: 'clear-harvest-quantity',
    turns: [
      {
        message: 'Recoltare la Delniwa 20 kg ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
        },
      },
      {
        message: 'sterge cantitatea',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', data: '2026-03-24' },
          absentPrefill: ['cantitate_kg'],
        },
      },
    ],
  },
  {
    category: 'anulari explicite de camp',
    id: 'clear-activity-dose',
    turns: [
      {
        message: 'Stropit la Delniwa cu Switch 0,5 l ieri',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', doza: '0.5L', data: '2026-03-24' },
        },
      },
      {
        message: 'scoate doza',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', data: '2026-03-24' },
          absentPrefill: ['doza'],
        },
      },
    ],
  },
  {
    category: 'anulari explicite de camp',
    id: 'clear-activity-date',
    turns: [
      {
        message: 'Stropit la Delniwa cu Switch ieri',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', data: '2026-03-24' },
        },
      },
      {
        message: 'scoate data',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data'],
        },
      },
    ],
  },
  {
    category: 'anulari explicite de camp',
    id: 'clear-order-quantity',
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg maine la 18 lei/kg',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26', pret_per_kg: 18 },
        },
      },
      {
        message: 'scoate cantitatea',
        expect: {
          kind: 'clarification',
          includes: ['ce cantitate'],
        },
      },
    ],
  },
  {
    category: 'canonicalizare / typo / nume apropiate',
    id: 'canonical-harvest-delniwaa',
    turns: [
      {
        message: 'Recoltare la Delniwaa ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', data: '2026-03-24' },
        },
      },
    ],
  },
  {
    category: 'canonicalizare / typo / nume apropiate',
    id: 'canonical-harvest-maravila',
    turns: [
      {
        message: 'Recoltare la Maravila ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Maravilla', data: '2026-03-24' },
        },
      },
    ],
  },
  {
    category: 'canonicalizare / typo / nume apropiate',
    id: 'canonical-activity-product',
    turns: [
      {
        message: 'Stropit la Delniwa cu Swich azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { parcela: 'Delniwa', produs: 'Switch', tip: 'tratament', data: '2026-03-25' },
        },
      },
    ],
  },
  {
    category: 'canonicalizare / typo / nume apropiate',
    id: 'canonical-order-client-ambiguous',
    candidates: {
      clienti: ['Maria Pop', 'Maria Ionescu'],
    },
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg maine',
        expect: {
          kind: 'clarification',
          includes: ['maria pop', 'maria ionescu'],
        },
      },
    ],
  },
  {
    category: 'canonicalizare / typo / nume apropiate',
    id: 'canonical-parcel-ambiguous',
    candidates: {
      parcele: ['Delniwa Nord', 'Delniwa Sud'],
    },
    turns: [
      {
        message: 'Recoltare la Delniwa ieri',
        expect: {
          kind: 'clarification',
          includes: ['delniwa nord', 'delniwa sud'],
        },
      },
    ],
  },
  {
    category: 'canonicalizare / typo / nume apropiate',
    id: 'canonical-parcel-missing',
    turns: [
      {
        message: 'Recoltare la Delta ieri',
        expect: {
          kind: 'clarification',
          includes: ['nu gasesc parcela', 'delta'],
        },
      },
    ],
  },
  {
    category: 'romana reala / colocviala / dictare',
    id: 'colloquial-harvest-natural-order',
    turns: [
      {
        message: 'ieri am recoltat delniwa 20 de kg',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
        },
      },
    ],
  },
  {
    category: 'romana reala / colocviala / dictare',
    id: 'colloquial-activity-no-preposition',
    turns: [
      {
        message: 'stropit maravilla cu switch azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { parcela: 'Maravilla', produs: 'Switch', tip: 'tratament', data: '2026-03-25' },
        },
      },
    ],
  },
  {
    category: 'romana reala / colocviala / dictare',
    id: 'colloquial-activity-needs-tip-only',
    turns: [
      {
        message: 'trece o activitate cu switch 500 ml azi',
        expect: {
          kind: 'clarification',
          includes: ['ce tip activitate'],
          excludes: ['pentru ce data'],
        },
      },
    ],
  },
  {
    category: 'romana reala / colocviala / dictare',
    id: 'colloquial-expense',
    turns: [
      {
        message: 'cheltuiala motorina 300 de lei ieri',
        expect: {
          kind: 'form',
          form: 'cheltuiala',
          prefill: { suma: 300, data: '2026-03-24', categorie: 'Combustibil și energie' },
        },
      },
    ],
  },
  {
    category: 'romana reala / colocviala / dictare',
    id: 'colloquial-investment',
    turns: [
      {
        message: 'investitie butasi 1200 lei maine',
        expect: {
          kind: 'form',
          form: 'investitie',
          prefill: { suma: 1200, data: '2026-03-26', categorie: 'Material săditor' },
        },
      },
    ],
  },
  {
    category: 'romana reala / colocviala / dictare',
    id: 'colloquial-client-phone-format',
    turns: [
      {
        message: 'client nou elena 0722-123-456',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'elena', telefon: '0722123456' },
        },
      },
    ],
  },
  {
    category: 'required_for_open_form',
    id: 'required-open-expense-category-only',
    turns: [
      {
        message: 'Cheltuiala 300 lei ieri',
        expect: {
          kind: 'clarification',
          includes: ['ce categorie'],
          excludes: ['ce suma', 'pentru ce data'],
        },
      },
    ],
  },
  {
    category: 'required_for_open_form',
    id: 'required-open-client-direct',
    turns: [
      {
        message: 'Client nou Maria',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Maria' },
        },
      },
    ],
  },
  {
    category: 'required_for_open_form',
    id: 'required-open-activity-direct',
    turns: [
      {
        message: 'Stropit azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', data: '2026-03-25' },
          absentPrefill: ['parcela', 'produs', 'doza'],
        },
      },
    ],
  },
  {
    category: 'required_for_open_form',
    id: 'required-open-harvest-direct',
    turns: [
      {
        message: 'Recoltare Delniwa ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', data: '2026-03-24' },
          absentPrefill: ['cantitate_kg'],
        },
      },
    ],
  },
  {
    category: 'required_for_open_form',
    id: 'required-open-order-direct',
    turns: [
      {
        message: 'Comanda Maria 4 kg maine',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26' },
          messageIncludes: ['pretul/kg'],
        },
      },
    ],
  },
  {
    category: 'required_for_open_form',
    id: 'required-open-investment-direct',
    turns: [
      {
        message: 'Investitie butasi 1200 lei ieri',
        expect: {
          kind: 'form',
          form: 'investitie',
          prefill: { suma: 1200, data: '2026-03-24', categorie: 'Material săditor' },
        },
      },
    ],
  },
  {
    category: 'required_for_save_hint',
    id: 'save-hint-harvest-without-qty',
    turns: [
      {
        message: 'Recoltare Delniwa ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', data: '2026-03-24' },
          messageIncludes: ['culegator'],
        },
      },
    ],
  },
  {
    category: 'required_for_save_hint',
    id: 'save-hint-harvest-with-qty',
    turns: [
      {
        message: 'Recoltare Delniwa 20 kg ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 20, data: '2026-03-24' },
          messageIncludes: ['culegator'],
        },
      },
    ],
  },
  {
    category: 'required_for_save_hint',
    id: 'save-hint-order-missing-price',
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg maine',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26' },
          messageIncludes: ['pretul/kg'],
        },
      },
    ],
  },
  {
    category: 'required_for_save_hint',
    id: 'save-hint-order-complete-price',
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg maine la 18 lei/kg',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, data_livrare: '2026-03-26', pret_per_kg: 18 },
          messageExcludes: ['pretul/kg'],
        },
      },
    ],
  },
  {
    category: 'required_for_save_hint',
    id: 'save-hint-client-no-extra-hint',
    turns: [
      {
        message: 'Client nou Maria',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Maria' },
          messageExcludes: ['pretul/kg', 'culegator'],
        },
      },
    ],
  },
  {
    category: 'required_for_save_hint',
    id: 'save-hint-activity-no-extra-hint',
    turns: [
      {
        message: 'Stropit azi',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', data: '2026-03-25' },
          messageExcludes: ['pretul/kg', 'culegator'],
        },
      },
    ],
  },
  {
    category: 'clarificari strict pe lipsuri reale',
    id: 'strict-missing-harvest-parcel-and-date',
    turns: [
      {
        message: 'Recoltare 20 kg',
        expect: {
          kind: 'clarification',
          includes: ['de pe ce parcela', 'pentru ce data'],
          excludes: ['ce cantitate'],
        },
      },
    ],
  },
  {
    category: 'clarificari strict pe lipsuri reale',
    id: 'strict-missing-harvest-date-only',
    turns: [
      {
        message: 'Recoltare la Delniwa',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data'],
          excludes: ['ce cantitate', 'de pe ce parcela'],
        },
      },
    ],
  },
  {
    category: 'clarificari strict pe lipsuri reale',
    id: 'strict-missing-activity-tip-and-date',
    turns: [
      {
        message: 'Activitate cu Switch la Delniwa',
        expect: {
          kind: 'clarification',
          includes: ['ce tip activitate', 'pentru ce data'],
          excludes: ['ce doza'],
        },
      },
    ],
  },
  {
    category: 'clarificari strict pe lipsuri reale',
    id: 'strict-missing-activity-date-only',
    turns: [
      {
        message: 'Stropit la Delniwa cu Switch',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data'],
          excludes: ['ce tip activitate', 'ce doza', 'la ce parcela'],
        },
      },
    ],
  },
  {
    category: 'clarificari strict pe lipsuri reale',
    id: 'strict-missing-expense-date-only',
    turns: [
      {
        message: 'Cheltuiala motorina 300 lei',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data'],
          excludes: ['ce categorie', 'ce suma'],
        },
      },
    ],
  },
  {
    category: 'clarificari strict pe lipsuri reale',
    id: 'strict-missing-expense-date-and-category',
    turns: [
      {
        message: 'am cumparat switch 300 lei',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data', 'ce categorie'],
          excludes: ['ce suma'],
        },
      },
    ],
  },
  {
    category: 'cazuri foarte scurte / sub-specificate',
    id: 'short-none-yesterday',
    turns: [
      {
        message: 'ieri',
        expect: { kind: 'none' },
      },
    ],
  },
  {
    category: 'cazuri foarte scurte / sub-specificate',
    id: 'short-none-quantity',
    turns: [
      {
        message: '20 kg',
        expect: { kind: 'none' },
      },
    ],
  },
  {
    category: 'cazuri foarte scurte / sub-specificate',
    id: 'short-none-name',
    turns: [
      {
        message: 'Maria',
        expect: { kind: 'none' },
      },
    ],
  },
  {
    category: 'cazuri foarte scurte / sub-specificate',
    id: 'short-client-needs-name',
    turns: [
      {
        message: 'client nou',
        expect: {
          kind: 'clarification',
          includes: ['cum se numeste clientul'],
        },
      },
    ],
  },
  {
    category: 'cazuri foarte scurte / sub-specificate',
    id: 'short-order-needs-client-and-quantity',
    turns: [
      {
        message: 'comanda',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce client', 'ce cantitate'],
        },
      },
    ],
  },
  {
    category: 'cazuri foarte scurte / sub-specificate',
    id: 'short-activity-needs-date',
    turns: [
      {
        message: 'stropit',
        expect: {
          kind: 'clarification',
          includes: ['pentru ce data'],
          excludes: ['ce tip activitate'],
        },
      },
    ],
  },
  {
    category: 'non-regresie pe flow-urile deja stabile',
    id: 'stable-harvest-complete',
    turns: [
      {
        message: 'Recoltare la Delniwa 12 kg ieri',
        expect: {
          kind: 'form',
          form: 'recoltare',
          prefill: { parcela: 'Delniwa', cantitate_kg: 12, data: '2026-03-24' },
          messageIncludes: ['culegator'],
        },
      },
    ],
  },
  {
    category: 'non-regresie pe flow-urile deja stabile',
    id: 'stable-activity-complete',
    turns: [
      {
        message: 'Stropit la Delniwa cu Switch 0,5 l ieri',
        expect: {
          kind: 'form',
          form: 'activitate',
          prefill: { tip: 'tratament', parcela: 'Delniwa', produs: 'Switch', doza: '0.5L', data: '2026-03-24' },
        },
      },
    ],
  },
  {
    category: 'non-regresie pe flow-urile deja stabile',
    id: 'stable-expense-complete',
    turns: [
      {
        message: 'Cheltuiala motorina 300 lei ieri',
        expect: {
          kind: 'form',
          form: 'cheltuiala',
          prefill: { suma: 300, data: '2026-03-24', categorie: 'Combustibil și energie' },
        },
      },
    ],
  },
  {
    category: 'non-regresie pe flow-urile deja stabile',
    id: 'stable-investment-complete',
    turns: [
      {
        message: 'Investitie butasi 1200 lei ieri',
        expect: {
          kind: 'form',
          form: 'investitie',
          prefill: { suma: 1200, data: '2026-03-24', categorie: 'Material săditor' },
        },
      },
    ],
  },
  {
    category: 'non-regresie pe flow-urile deja stabile',
    id: 'stable-order-complete',
    turns: [
      {
        message: 'Comanda pentru Maria 4 kg zmeura maine la 18 lei/kg',
        expect: {
          kind: 'form',
          form: 'comanda',
          prefill: { nume_client: 'Maria', cantitate_kg: 4, produs: 'zmeura', data_livrare: '2026-03-26', pret_per_kg: 18 },
          messageExcludes: ['pretul/kg'],
        },
      },
    ],
  },
  {
    category: 'non-regresie pe flow-urile deja stabile',
    id: 'stable-client-complete',
    turns: [
      {
        message: 'Client nou Elena 0722 111 222',
        expect: {
          kind: 'form',
          form: 'client',
          prefill: { nume_client: 'Elena', telefon: '0722111222' },
        },
      },
    ],
  },
] as const

export const AI_CHAT_HARNESS_CASE_COUNT = AI_CHAT_HARNESS_CORPUS.length
