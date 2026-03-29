import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { resolveAiDailyLimit } from '../ai-usage-limit'

export const runtime = 'nodejs'

function getTodayInBucharest(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 })
  }

  const baseLimit = Math.max(1, parseInt(process.env.AI_CHAT_DAILY_LIMIT ?? '20', 10) || 20)
  const today = getTodayInBucharest()

  try {
    const { data } = await supabase
      .from('profiles')
      .select('ai_messages_count, last_ai_usage_date, is_superadmin')
      .eq('id', user.id)
      .maybeSingle()

    const messagesUsed =
      data?.last_ai_usage_date === today ? (data.ai_messages_count ?? 0) : 0
    const messagesLimit = resolveAiDailyLimit({
      baseLimit,
      isSuperadmin: data?.is_superadmin,
      email: user.email,
    })

    return NextResponse.json({ messagesUsed, messagesLimit })
  } catch {
    return NextResponse.json({ messagesUsed: 0, messagesLimit: baseLimit })
  }
}
