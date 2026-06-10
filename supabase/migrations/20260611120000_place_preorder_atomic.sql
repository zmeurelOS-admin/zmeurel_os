create or replace function public.place_preorder_atomic(
  p_campaign_id uuid,
  p_tenant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_mode text,
  p_delivery_address text,
  p_delivery_city text,
  p_items jsonb,
  p_total_lei integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.shop_campaigns%rowtype;
  v_order_id uuid;
  v_qty_this_order integer;
  v_new_count integer;
  v_milestone public.shop_campaign_milestones%rowtype;
  v_reward_id uuid;
  v_reward_label text;
  v_hit_milestone boolean := false;
begin
  perform pg_advisory_xact_lock(
    hashtext('shop-campaign-preorder'),
    hashtext(p_campaign_id::text)
  );

  select *
  into v_campaign
  from public.shop_campaigns
  where id = p_campaign_id
    and tenant_id = p_tenant_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Campania nu este activă sau nu aparține tenantului.';
  end if;

  insert into public.shop_orders (
    tenant_id,
    customer_name,
    customer_phone,
    delivery_mode,
    delivery_address,
    delivery_city,
    items,
    total_lei,
    notes,
    order_kind,
    campaign_id,
    status
  )
  values (
    p_tenant_id,
    p_customer_name,
    p_customer_phone,
    p_delivery_mode,
    p_delivery_address,
    p_delivery_city,
    p_items,
    p_total_lei,
    p_notes,
    'preorder',
    p_campaign_id,
    'noua'
  )
  returning id into v_order_id;

  select coalesce(sum((item->>'qty')::integer), 0)
  into v_qty_this_order
  from jsonb_array_elements(p_items) as item;

  update public.shop_campaigns
  set current_count = current_count + v_qty_this_order
  where id = p_campaign_id
  returning current_count into v_new_count;

  select m.*
  into v_milestone
  from public.shop_campaign_milestones m
  where m.campaign_id = p_campaign_id
    and m.reached = false
    and m.threshold <= v_new_count
    and m.threshold > (v_new_count - v_qty_this_order)
  order by m.threshold asc
  limit 1;

  if found then
    v_reward_label := v_milestone.reward_label;

    update public.shop_campaign_milestones
    set reached = true,
        reached_at = now(),
        reached_by_order_id = v_order_id
    where id = v_milestone.id;

    insert into public.shop_campaign_milestone_rewards (
      campaign_id,
      milestone_id,
      order_id,
      reward_label,
      status
    )
    values (
      p_campaign_id,
      v_milestone.id,
      v_order_id,
      v_reward_label,
      'pending'
    )
    on conflict (campaign_id, milestone_id) do nothing
    returning id into v_reward_id;

    v_hit_milestone := (v_reward_id is not null);
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_kind', 'preorder',
    'campaign_id', p_campaign_id,
    'current_count', v_new_count,
    'hit_milestone', v_hit_milestone,
    'milestone_threshold',
      case when v_hit_milestone then v_milestone.threshold else null end,
    'milestone_reward',
      case when v_hit_milestone then v_reward_label else null end,
    'reward_id', v_reward_id
  );
end;
$$;

revoke all on function public.place_preorder_atomic(
  uuid, uuid, text, text, text, text, text, jsonb, integer, text
) from public;

grant execute on function public.place_preorder_atomic(
  uuid, uuid, text, text, text, text, text, jsonb, integer, text
) to service_role;

notify pgrst, 'reload schema';
