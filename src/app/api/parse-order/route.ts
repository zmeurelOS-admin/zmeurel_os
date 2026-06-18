import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `Ești un asistent care extrage informații din mesaje de comandă pentru o fermă de
zmeură din România. Vindem exclusiv zmeură proaspătă.

Data curentă este ${new Date().toISOString().slice(0, 10)}.

Din mesajul primit, extrage EXACT în format JSON:
{
  "nume": string | null,
  "telefon": string | null,
  "cantitate_kg": number | null,
  "localitate": string | null,
  "data_livrare": "YYYY-MM-DD" | null,
  "tip_client": "standard" | "patiserie" | "magazin",
  "observatii": string | null,
  "incredere": "mare" | "medie" | "mica"
}

Reguli stricte:
- Răspunde DOAR cu JSON valid, fără text suplimentar, fără markdown, fără backticks
- Nu inventa informații absente din mesaj
- cantitate_kg: 1 caserolă = 0.5 kg (ex: 10 caserole → 5, 2 caserole → 1)
- telefon: elimină +40, spații, cratime — doar cifre
- data_livrare: interpretează expresii românești față de data curentă
  (mâine, joi, săptămâna viitoare, peste 3 zile etc.)
- tip_client:
    „patiserie" → dacă mesajul conține: patiserie, cofetărie, brutărie, cozonac
    „magazin"   → dacă mesajul conține: magazin, supermarket, alimentară, shop, market
    „standard"  → în orice alt caz (default)`

type AnthropicTextBlock = {
  type?: string
  text?: string
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function normalizeParsedOrder(raw: Record<string, unknown>) {
  const tip = raw.tip_client
  const incredere = raw.incredere

  return {
    nume: typeof raw.nume === 'string' && raw.nume.trim() ? raw.nume.trim() : null,
    telefon: typeof raw.telefon === 'string' && raw.telefon.trim()
      ? raw.telefon.replace(/\D/g, '') || null
      : null,
    cantitate_kg: typeof raw.cantitate_kg === 'number' && Number.isFinite(raw.cantitate_kg)
      ? raw.cantitate_kg
      : null,
    localitate: typeof raw.localitate === 'string' && raw.localitate.trim() ? raw.localitate.trim() : null,
    data_livrare: typeof raw.data_livrare === 'string' && raw.data_livrare.trim() ? raw.data_livrare.trim() : null,
    tip_client: tip === 'patiserie' || tip === 'magazin' ? tip : 'standard',
    observatii: typeof raw.observatii === 'string' && raw.observatii.trim() ? raw.observatii.trim() : null,
    incredere: incredere === 'mare' || incredere === 'medie' || incredere === 'mica' ? incredere : 'medie',
  }
}

export async function POST(request: Request) {
  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }

    const body = await request.json().catch(() => null) as { text?: unknown } | null
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return apiError(400, 'INVALID_TEXT', 'Mesajul este obligatoriu.')
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return apiError(500, 'MISSING_ANTHROPIC_API_KEY', 'Cheia Anthropic nu este configurată.')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[parse-order] Anthropic API error', response.status, errorText)
      return apiError(500, 'ANTHROPIC_ERROR', 'Nu am putut extrage datele din mesaj.')
    }

    const anthropicJson = await response.json() as { content?: AnthropicTextBlock[] }
    const rawText = anthropicJson.content?.find((block) => block.type === 'text' || typeof block.text === 'string')?.text
    if (!rawText) {
      return apiError(500, 'EMPTY_MODEL_RESPONSE', 'Răspunsul AI nu conține date utile.')
    }

    const parsed = JSON.parse(stripJsonFence(rawText)) as Record<string, unknown>
    return NextResponse.json(normalizeParsedOrder(parsed))
  } catch (error) {
    console.error('[parse-order] Nu am putut procesa mesajul.', error)
    return apiError(500, 'PARSE_ORDER_FAILED', 'Nu am putut extrage datele din mesaj.')
  }
}
