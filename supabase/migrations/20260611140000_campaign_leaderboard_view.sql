-- Public-safe campaign leaderboard, exposed only through a service-role API.
create or replace view public.campaign_leaderboard as
select
  row_number() over (
    partition by o.campaign_id
    order by sum((item->>'qty')::integer) desc, min(o.created_at) asc
  ) as rank,
  o.campaign_id,
  '#' || upper(substring(encode(sha256(o.customer_phone::bytea), 'hex'), 1, 8))
    as anon_id,
  max(o.delivery_city) as city,
  sum((item->>'qty')::integer) as total_qty
from public.shop_orders o,
     jsonb_array_elements(o.items) as item
where o.order_kind = 'preorder'
  and o.status != 'anulata'
  and o.campaign_id is not null
group by o.campaign_id, o.customer_phone;

revoke all on public.campaign_leaderboard from anon, authenticated;
revoke all on public.campaign_leaderboard from service_role;
grant select on public.campaign_leaderboard to service_role;

notify pgrst, 'reload schema';
