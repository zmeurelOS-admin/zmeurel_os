import { expect, test } from '@playwright/test'

import { createChatPostHandler } from '@/app/api/chat/chat-post-handler'
import { getShiftedDayInBucharest, getTodayInBucharest } from '@/app/api/chat/date-helpers'

const TODAY = getTodayInBucharest()
const YESTERDAY = getShiftedDayInBucharest(-1)
const DAY_BEFORE_YESTERDAY = getShiftedDayInBucharest(-2)
const TOMORROW = getShiftedDayInBucharest(1)

type MockQueryResult = {
  data?: unknown
  error?: unknown
}

function buildQuery(result: MockQueryResult = {}) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    select() {
      return this
    },
    eq() {
      return this
    },
    limit() {
      return this
    },
    order() {
      return this
    },
    gte() {
      return this
    },
    ilike() {
      return this
    },
    insert() {
      return Promise.resolve({ data: null, error: null })
    },
  }

  return query
}

function createSupabaseMock(options?: {
  clienti?: Array<{ id: string; nume_client: string; telefon?: string | null; pret_negociat_lei_kg?: number | null }>
  aiConversations?: Array<{ mesaj_user: string; raspuns_ai: string }>
}) {
  const clienti = options?.clienti ?? []
  const aiConversations = options?.aiConversations ?? []

  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
            },
          },
        }
      },
    },
    from(table: string) {
      if (table === 'profiles') return buildQuery({ data: [{ is_superadmin: false }] })
      if (table === 'ai_conversations') return buildQuery({ data: aiConversations })
      if (table === 'parcele') {
        return buildQuery({
          data: [
            {
              id: 'parcela-delniwa',
              nume_parcela: 'Delniwa',
              nume: 'Delniwa',
              soi_plantat: 'Delniwa',
              soi: 'Delniwa',
              cultura: 'Zmeura',
              tip_fruct: 'Zmeura',
            },
          ],
        })
      }
      if (table === 'clienti') return buildQuery({ data: clienti })
      if (table === 'comenzi') return buildQuery({ data: [] })
      if (table === 'activitati_agricole') return buildQuery({ data: [] })
      if (table === 'miscari_stoc') return buildQuery({ data: [] })
      if (table === 'analytics_events') return buildQuery({ data: [] })

      return buildQuery({ data: [] })
    },
    async rpc(name: string) {
      if (name === 'check_and_increment_ai_usage') {
        return {
          data: {
            allowed: true,
            count: 1,
            limit: 20,
          },
          error: null,
        }
      }

      return { data: null, error: null }
    },
  }
}

test.describe('ai chat route integration', () => {
  test('fallback-ul deterministic de recoltare ramane activ cand structured extraction esueaza', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock() as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          throw new Error('AI_NoObjectGeneratedError')
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'Am recoltat 20 kg azi din Delniwa',
            pathname: '/recoltari',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('form')
      expect(payload.form).toBe('recoltare')
      expect(payload.prefill_data).toMatchObject({
        cantitate_kg: 20,
        parcela: 'Delniwa',
        data: TODAY,
      })
      expect(payload.response).toBeUndefined()
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })

  test('comanda cu client raw in formatul `pt Nume` deschide formularul chiar fara match canonic', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock({
            clienti: [
              { id: 'client-1', nume_client: 'Maria', telefon: '0711111111' },
              { id: 'client-2', nume_client: 'Elena', telefon: '0722222222' },
            ],
          }) as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          throw new Error('AI_NoObjectGeneratedError')
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'Fă o comandă pt Matia 5 kg azi',
            pathname: '/comenzi',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('form')
      expect(payload.form).toBe('comanda')
      expect(payload.prefill_data).toMatchObject({
        nume_client: 'Matia',
        cantitate_kg: 5,
        data_livrare: TODAY,
      })
      expect(payload.prefill_data.client_id).toBeUndefined()
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })

  test('comanda pentru client existent mosteneste pretul negociat in prefill_data', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock({
            clienti: [
              { id: 'client-1', nume_client: 'Maria', telefon: '0711111111', pret_negociat_lei_kg: 18 },
            ],
          }) as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          return {
            object: {
              flow_key: 'comanda',
              intent: 'new_flow',
              missing_fields: [],
              needs_clarification: false,
              confidence: 0.94,
              client_id: 'client-1',
              cantitate_kg: 4,
              data_livrare: TOMORROW,
            },
          } as any
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'Comandă pentru Maria 4 kg mâine',
            pathname: '/comenzi',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('form')
      expect(payload.form).toBe('comanda')
      expect(payload.prefill_data).toMatchObject({
        client_id: 'client-1',
        client_label: 'Maria',
        telefon: '0711111111',
        cantitate_kg: 4,
        data_livrare: TOMORROW,
        pret_per_kg: 18,
      })
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })

  test('un nou mesaj explicit de creare dupa formular pregatit reseteaza contextul vechi de cheltuiala', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock({
            aiConversations: [
              {
                mesaj_user: 'bagă 220 lei motorină azi',
                raspuns_ai: 'Am pregătit formularul de cheltuială. Verifică și salvează!',
              },
            ],
          }) as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          throw new Error('AI_NoObjectGeneratedError')
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'adaugă cheltuială',
            pathname: '/cheltuieli',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('answer')
      expect(String(payload.response ?? '').toLowerCase()).toContain('ce sum')
      expect(String(payload.response ?? '').toLowerCase()).toContain('pentru ce dat')
      expect(String(payload.response ?? '').toLowerCase()).not.toContain('motorin')
      expect(String(payload.response ?? '')).not.toContain('220')
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })

  test('follow-up financiar scurt de tip capex pastreaza suma si descrierea din clarificarea anterioara', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock({
            aiConversations: [
              {
                mesaj_user: 'atomizor și pompă, 1050 lei, azi',
                raspuns_ai: 'Pompă nouă (investiție CAPEX) sau reparație pompă (cheltuiala OPEX)? Precizează și deschid formularul potrivit!',
              },
            ],
          }) as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          throw new Error('AI_NoObjectGeneratedError')
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'capex',
            pathname: '/cheltuieli',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('form')
      expect(payload.form).toBe('investitie')
      expect(payload.prefill_data).toMatchObject({
        suma: 1050,
        data: TODAY,
        categorie: 'Utilaje și echipamente',
        descriere: 'atomizor și pompă',
      })
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })

  test('follow-up financiar de data (ieri) suprascrie corect data in continuare pentru investitie', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock({
            aiConversations: [
              {
                mesaj_user: 'trece butași 1500 lei la delniwa',
                raspuns_ai: 'Pentru investiția "butași delniwa", pentru ce dată?',
              },
            ],
          }) as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          throw new Error('AI_NoObjectGeneratedError')
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'ieri',
            pathname: '/investitii',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('form')
      expect(payload.form).toBe('investitie')
      expect(payload.prefill_data).toMatchObject({
        suma: 1500,
        data: YESTERDAY,
        categorie: 'Material săditor',
      })
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })

  test('follow-up financiar de data (alaltăieri) suprascrie corect data in continuare pentru investitie', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock({
            aiConversations: [
              {
                mesaj_user: 'trece butași 1500 lei la delniwa',
                raspuns_ai: 'Pentru investiția "butași delniwa", pentru ce dată?',
              },
            ],
          }) as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          throw new Error('AI_NoObjectGeneratedError')
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'alaltăieri',
            pathname: '/investitii',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('form')
      expect(payload.form).toBe('investitie')
      expect(payload.prefill_data).toMatchObject({
        suma: 1500,
        data: DAY_BEFORE_YESTERDAY,
        categorie: 'Material săditor',
      })
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })

  test('mesaj nou explicit de creare cu suma proprie nu mosteneste suma din contextul anterior', async () => {
    const previousApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'

    try {
      const handler = createChatPostHandler({
        async createClient() {
          return createSupabaseMock({
            aiConversations: [
              {
                mesaj_user: 'trece butași 1500 lei la delniwa',
                raspuns_ai: 'Am pregătit formularul de investiție. Verifică și salvează!',
              },
            ],
          }) as never
        },
        async getTenantIdOrNull() {
          return 'tenant-1'
        },
        async generateObject() {
          throw new Error('AI_NoObjectGeneratedError')
        },
        async generateText() {
          throw new Error('generateText should not be called in this scenario')
        },
      })

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: 'trece butași 12345 lei azi',
            pathname: '/investitii',
          }),
          headers: {
            'content-type': 'application/json',
          },
        })
      )

      expect(response.status).toBe(200)

      const payload = await response.json()
      expect(payload.type).toBe('form')
      expect(payload.form).toBe('investitie')
      expect(payload.prefill_data).toMatchObject({
        suma: 12345,
        data: TODAY,
        categorie: 'Material săditor',
      })
    } finally {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = previousApiKey
    }
  })
})
