import { NextResponse } from 'next/server'
import { z } from 'zod'

import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'
import {
  aggregateOrderStatuses,
  aggregateOrdersByDay,
  aggregateOrdersByDeliveryMode,
  aggregateOrdersByZone,
  aggregateLeaderboard,
  assignFinalPrizes,
  summarizeLeaderboard,
  type CampaignAdminMilestone,
  type CampaignAdminMilestoneStatus,
  type CampaignAdminPayload,
} from '@/lib/shop/campaign-admin-queries'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

export const dynamic = 'force-dynamic'

const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

type RewardRow = {
  milestone_id: string
  order_id: string
  status: string
}

type WinnerOrderRow = {
  id: string
  customer_name: string
  customer_phone: string
}

function isRewardStatus(value: string): value is Exclude<CampaignAdminMilestoneStatus, 'unreached'> {
  return ['pending', 'validated', 'cancelled', 'voided'].includes(value)
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  )
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug)
  if (!parsedSlug.success) {
    return jsonError('Campanie invalidă.', 400)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonError('Trebuie să fii autentificat.', 401)
  }

  let tenantId: string
  try {
    tenantId = await getTenantIdByUserId(supabase, user.id)
  } catch (error) {
    console.error(
      '[shop/campaign/admin] tenant resolution failed',
      sanitizeForLog(toSafeErrorContext(error)),
    )
    return jsonError('Tenant indisponibil pentru utilizatorul curent.', 403)
  }

  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('shop_campaigns')
      .select('id, slug, title, current_count, target_qty, status')
      .eq('slug', parsedSlug.data)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle()

    if (campaignError) throw campaignError
    if (!campaign) {
      return jsonError('Campania nu a fost găsită.', 404)
    }

    const admin = getSupabaseAdmin()
    const [
      { data: orderRows, error: ordersError },
      { data: statusRows, error: statusesError },
      { data: milestoneRows, error: milestonesError },
      { data: rewardRows, error: rewardsError },
    ] = await Promise.all([
      admin
        .from('shop_orders')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('order_kind', 'preorder')
        .neq('status', 'anulata')
        .eq('tenant_id', tenantId),
      admin
        .from('shop_orders')
        .select('status')
        .eq('campaign_id', campaign.id)
        .eq('order_kind', 'preorder')
        .eq('tenant_id', tenantId),
      admin
        .from('shop_campaign_milestones')
        .select('id, threshold, reward_label, reached, reached_at, reached_by_order_id')
        .eq('campaign_id', campaign.id)
        .order('threshold', { ascending: true }),
      admin
        .from('shop_campaign_milestone_rewards')
        .select('milestone_id, order_id, status')
        .eq('campaign_id', campaign.id),
    ])

    if (ordersError) throw ordersError
    if (statusesError) throw statusesError
    if (milestonesError) throw milestonesError
    if (rewardsError) throw rewardsError

    const rewards = (rewardRows ?? []) as RewardRow[]
    const rewardByMilestoneId = new Map(
      rewards.map((reward) => [reward.milestone_id, reward]),
    )
    const winnerOrderIds = [
      ...new Set(
        (milestoneRows ?? []).flatMap((milestone) => {
          const reward = rewardByMilestoneId.get(milestone.id)
          if (!reward) return []
          return [milestone.reached_by_order_id ?? reward.order_id]
        }),
      ),
    ]
    let winnerOrders: WinnerOrderRow[] = []

    if (winnerOrderIds.length > 0) {
      const { data, error } = await admin
        .from('shop_orders')
        .select('id, customer_name, customer_phone')
        .in('id', winnerOrderIds)
        .eq('campaign_id', campaign.id)
        .eq('tenant_id', tenantId)

      if (error) throw error
      winnerOrders = (data ?? []) as WinnerOrderRow[]
    }

    const winnerByOrderId = new Map(winnerOrders.map((order) => [order.id, order]))
    const milestones: CampaignAdminMilestone[] = (milestoneRows ?? []).map((milestone) => {
      const reward = rewardByMilestoneId.get(milestone.id)
      const winnerOrderId = reward
        ? milestone.reached_by_order_id ?? reward.order_id
        : null
      const winner = winnerOrderId ? winnerByOrderId.get(winnerOrderId) : undefined
      const rewardStatus =
        reward && isRewardStatus(reward.status) ? reward.status : 'unreached'

      return {
        id: milestone.id,
        threshold: milestone.threshold,
        rewardLabel: milestone.reward_label,
        reached: milestone.reached,
        reachedAt: milestone.reached_at,
        rewardStatus,
        winnerName: winner?.customer_name ?? null,
        winnerPhone: winner?.customer_phone ?? null,
      }
    })

    const activeOrders = (orderRows ?? []) as ShopOrderRow[]
    const leaderboard = assignFinalPrizes(aggregateLeaderboard(activeOrders))
    const payload: CampaignAdminPayload = {
      campaign: {
        id: campaign.id,
        slug: campaign.slug,
        title: campaign.title,
        currentCount: campaign.current_count,
        targetQty: campaign.target_qty,
        status: campaign.status,
      },
      leaderboard,
      milestones,
      activeTotals: summarizeLeaderboard(leaderboard),
      dailySummary: aggregateOrdersByDay(activeOrders),
      deliverySummary: aggregateOrdersByDeliveryMode(activeOrders),
      zoneSummary: aggregateOrdersByZone(activeOrders),
      statusSummary: aggregateOrderStatuses(
        (statusRows ?? []) as Array<Pick<ShopOrderRow, 'status'>>,
      ),
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error(
      '[shop/campaign/admin] load failed',
      sanitizeForLog(toSafeErrorContext(error)),
    )
    return jsonError('Nu am putut încărca clasamentul campaniei.', 500)
  }
}
