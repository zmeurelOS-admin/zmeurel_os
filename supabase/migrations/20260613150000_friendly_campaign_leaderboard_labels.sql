-- Replace the public hex identifier with a friendlier, still-masked label.
-- The API field remains anon_id so existing consumers keep the same contract.
create or replace view public.campaign_leaderboard as
with customer_totals as (
  select
    o.campaign_id,
    o.customer_phone,
    (array_agg(o.customer_name order by o.created_at desc, o.id desc))[1]
      as representative_name,
    max(o.delivery_city) as city,
    sum((item->>'qty')::integer) as total_qty,
    min(o.created_at) as first_order_at
  from public.shop_orders o,
       jsonb_array_elements(o.items) as item
  where o.order_kind = 'preorder'
    and o.status != 'anulata'
    and o.campaign_id is not null
  group by o.campaign_id, o.customer_phone
)
select
  row_number() over (
    partition by campaign_id
    order by total_qty desc, first_order_at asc
  ) as rank,
  campaign_id,
  case
    when char_length(split_part(btrim(coalesce(representative_name, '')), ' ', 1)) <= 3
      then '***'
    else '***' || right(split_part(btrim(representative_name), ' ', 1), 3)
  end as anon_id,
  city,
  total_qty
from customer_totals;

revoke all on public.campaign_leaderboard from anon, authenticated;
revoke all on public.campaign_leaderboard from service_role;
grant select on public.campaign_leaderboard to service_role;

notify pgrst, 'reload schema';
