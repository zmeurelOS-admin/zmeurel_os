import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import type { Database } from '@/types/supabase'

export const revalidate = 30

const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase public environment variables are missing')
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug)
  if (!parsedSlug.success) {
    return NextResponse.json({ error: 'Campanie invalidă.' }, { status: 400 })
  }

  try {
    const supabase = createAnonClient()
    const { data: campaign, error: campaignError } = await supabase
      .from('shop_campaigns')
      .select('id, current_count, target_qty, status')
      .eq('slug', parsedSlug.data)
      .eq('status', 'active')
      .maybeSingle()

    if (campaignError) throw campaignError
    if (!campaign) {
      return NextResponse.json({ error: 'Campania nu este disponibilă.' }, { status: 404 })
    }

    const { data: milestones, error: milestonesError } = await supabase
      .from('shop_campaign_milestones')
      .select('threshold, reward_label, reached')
      .eq('campaign_id', campaign.id)
      .order('threshold', { ascending: true })

    if (milestonesError) throw milestonesError

    return NextResponse.json(
      {
        currentCount: campaign.current_count,
        targetQty: campaign.target_qty,
        status: campaign.status,
        milestones: (milestones ?? []).map((milestone) => ({
          threshold: milestone.threshold,
          rewardLabel: milestone.reward_label,
          reached: milestone.reached,
        })),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    )
  } catch (error) {
    console.error(
      '[shop/campaign] load failed',
      sanitizeForLog(toSafeErrorContext(error)),
    )
    return NextResponse.json({ error: 'Nu am putut încărca progresul campaniei.' }, { status: 500 })
  }
}
