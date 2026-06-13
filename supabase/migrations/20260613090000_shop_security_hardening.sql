-- Security hardening for B2C shop RPC functions.
--
-- 2A: place_preorder_atomic — input validation before any insert/update:
--     - each item.vid must exist in shop_products with available = true
--     - qty per item: 1–200 (a realistic single preorder; farm can ship ~200 boxes/day locally)
--     - total qty per order: max 200 (same cap; single-item shop so identical in practice,
--       but enforced separately so multi-item future orders are also guarded)
--     - p_total_lei must equal v_qty_this_order * 20 exactly
--       (keep in sync with src/lib/shop/pricing.ts ZMEURA_CASEROLA_PRICE_LEI)
--
-- 2B: revoke direct client access to upsert_shop_customer and
--     set_shop_customer_acquisition_source_once — both are called server-side
--     via service_role only; no legitimate client call exists.

-- ============================================================
-- 2B — REVOKE
-- ============================================================

revoke execute on function public.upsert_shop_customer(
  uuid, text, text, text, text, text, numeric
) from public, anon, authenticated;

revoke execute on function public.set_shop_customer_acquisition_source_once(
  uuid, text, text
) from anon, authenticated;

-- ============================================================
-- 2A — place_preorder_atomic with input validation
-- ============================================================

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
  -- keep in sync with src/lib/shop/pricing.ts ZMEURA_CASEROLA_PRICE_LEI
  v_price_per_unit_lei constant integer := 20;
  v_max_qty_per_item   constant integer := 200;
  v_max_qty_total      constant integer := 200;

  v_item               jsonb;
  v_item_vid           text;
  v_item_qty           integer;
  v_qty_this_order     integer := 0;
  v_campaign           public.shop_campaigns%rowtype;
  v_order_id           uuid;
  v_new_count          integer;
  v_milestone          public.shop_campaign_milestones%rowtype;
  v_reward_id          uuid;
  v_reward_label       text;
  v_hit_milestone      boolean := false;
begin
  -- --------------------------------------------------------
  -- Validation — runs BEFORE advisory lock and any DML
  -- --------------------------------------------------------

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Comanda nu conține produse.';
  end if;

  -- Validate each item individually
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_vid := v_item->>'vid';
    v_item_qty := (v_item->>'qty')::integer;

    -- vid must exist in shop_products and be available
    if not exists (
      select 1 from public.shop_products
      where id = v_item_vid and available = true
    ) then
      raise exception 'Produsul "%" nu este disponibil.', v_item_vid;
    end if;

    -- qty must be a positive integer within per-item cap
    if v_item_qty is null or v_item_qty < 1 then
      raise exception 'Cantitatea pentru produsul "%" trebuie să fie cel puțin 1.', v_item_vid;
    end if;

    if v_item_qty > v_max_qty_per_item then
      raise exception
        'Cantitatea pentru produsul "%" depășește limita per produs (max % caserole per comandă).',
        v_item_vid, v_max_qty_per_item;
    end if;

    v_qty_this_order := v_qty_this_order + v_item_qty;
  end loop;

  -- Total qty cap across all items
  if v_qty_this_order > v_max_qty_total then
    raise exception
      'Cantitatea totală a comenzii depășește limita de % caserole.', v_max_qty_total;
  end if;

  -- Total price must match exactly
  if p_total_lei <> v_qty_this_order * v_price_per_unit_lei then
    raise exception
      'Totalul comenzii (% lei) nu corespunde cantității (% caserole × % lei = % lei).',
      p_total_lei,
      v_qty_this_order,
      v_price_per_unit_lei,
      v_qty_this_order * v_price_per_unit_lei;
  end if;

  -- --------------------------------------------------------
  -- From here: original logic, unchanged
  -- --------------------------------------------------------

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

notify pgrst, 'reload schema';
