-- Grilă de preț pe cantitate pentru shop-ul public (2026-07-12).
--
-- Regula de business: prețul per caserolă depinde de cantitatea TOTALĂ din coș,
-- cu prag RETROACTIV: sub 10 kg -> 17,50 lei/caserolă (35 lei/kg); de la 10 kg
-- inclusiv -> 15,00 lei/caserolă (30 lei/kg) pe TOT coșul. Discontinuitatea la
-- prag e intenționată (asumată de owner).
--
-- SECȚIUNEA (a): schimbări de schemă
--   1. shop_products.price_lei: integer -> numeric(10,2) (prețul de BAZĂ per caserolă).
--   2. shop_orders.total_lei:   integer -> numeric(10,2) (totaluri cu zecimale, ex. 87,50).
--      ALTER TYPE păstrează valorile existente (conversie lossless int->numeric);
--      verificat explicit printr-un assert de integritate mai jos.
--   3. Coloane noi de config pe shop_products: bulk_threshold_kg, bulk_price_lei
--      (grila e configurabilă din DB, fără deploy; NULL = fără grilă).
--   4. place_preorder_atomic: p_total_lei integer -> numeric (semnătură nouă =>
--      DROP + CREATE) și validarea de preț hardcodată (20 lei) înlocuită cu
--      grila citită din shop_products. Restul logicii (idempotență, minim pe
--      zonă, campanie, milestones, checkout_response) rămâne IDENTIC cu
--      definiția live extrasă de pe producție la 2026-07-12.
--
-- SECȚIUNEA (b): actualizare de date (doar rândul global 'zmeura')
--   price_lei: 20 -> 17.50; bulk_threshold_kg = 10; bulk_price_lei = 15.00.
--   Idempotent: rulează doar dacă price_lei este încă 20.
--
-- NU se atinge: pipeline-ul de stoc (resolve_shop_order_total_kg_loose derivă
-- greutatea doar din qty × unit_weight_kg — prețul nu intră în calcul),
-- unit_weight_kg (rămâne 0.5), comenzile istorice (păstrează prețurile vechi).

-- ---------------------------------------------------------------------------
-- (a) 1+2: tipuri numerice pe coloanele de preț
-- ---------------------------------------------------------------------------
alter table public.shop_products
  alter column price_lei type numeric(10,2);

alter table public.shop_orders
  alter column total_lei type numeric(10,2);

-- ---------------------------------------------------------------------------
-- (a) 3: config grilă pe shop_products
-- ---------------------------------------------------------------------------
alter table public.shop_products
  add column if not exists bulk_threshold_kg numeric,
  add column if not exists bulk_price_lei numeric(10,2);

comment on column public.shop_products.price_lei is
  'Preț de BAZĂ per unitate (caserolă 500 g), aplicat sub pragul de volum. Sursa de adevăr pentru grilă — ține sincron cu fallback-ul din src/lib/shop/pricing.ts (DEFAULT_ZMEURA_PRICING).';
comment on column public.shop_products.bulk_threshold_kg is
  'Pragul (kg totale în coș) de la care se aplică RETROACTIV bulk_price_lei pe tot coșul (>= prag). NULL = fără grilă de volum.';
comment on column public.shop_products.bulk_price_lei is
  'Preț per unitate (caserolă) la/peste bulk_threshold_kg. NULL = fără grilă de volum.';

-- Integritate după conversie: toate totalurile istorice erau întregi și trebuie
-- să fi rămas identice (fără parte fracționară introdusă de conversie).
do $$
declare
  v_fractional integer;
begin
  select count(*) into v_fractional
  from public.shop_orders
  where total_lei <> trunc(total_lei);

  if v_fractional > 0 then
    raise exception 'Conversia integer->numeric a produs % totaluri fracționare neașteptate — rollback.', v_fractional;
  end if;

  raise notice 'Conversie tip OK: 0 totaluri fracționare în shop_orders (valorile istorice intacte).';
end
$$;

-- ---------------------------------------------------------------------------
-- (a) 4: place_preorder_atomic cu p_total_lei numeric + validare pe grilă
-- ---------------------------------------------------------------------------
-- Semnătura se schimbă (integer -> numeric) => drop explicit pe cea veche,
-- altfel ar coexista două overload-uri și PostgREST ar da ambiguitate.
drop function if exists public.place_preorder_atomic(
  uuid, uuid, text, text, text, text, text, jsonb, integer, text, text, boolean, date
);

create or replace function public.place_preorder_atomic(
  p_campaign_id uuid,
  p_tenant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_mode text,
  p_delivery_address text,
  p_delivery_city text,
  p_items jsonb,
  p_total_lei numeric,
  p_notes text default null,
  p_idempotency_key text default null,
  p_in_suceava boolean default null,
  p_preferred_delivery_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_qty_per_item   constant integer := 200;
  v_max_qty_total      constant integer := 200;
  v_min_qty_suceava    constant integer := 2;
  v_min_qty_exterior   constant integer := 4;

  v_item               jsonb;
  v_item_vid           text;
  v_item_qty           integer;
  v_qty_this_order     integer := 0;
  v_min_qty            integer;
  v_pricing            record;
  v_unit_price_lei     numeric;
  v_expected_total_lei numeric;
  v_campaign           public.shop_campaigns%rowtype;
  v_order_id           uuid;
  v_new_count          integer;
  v_milestone          public.shop_campaign_milestones%rowtype;
  v_reward_id          uuid;
  v_reward_label       text;
  v_hit_milestone      boolean := false;
  v_existing_response  jsonb;
  v_response           jsonb;
begin
  -- Idempotency
  if p_idempotency_key is not null then
    select checkout_response into v_existing_response
    from public.shop_orders
    where tenant_id = p_tenant_id
      and idempotency_key = p_idempotency_key
    limit 1;
    if v_existing_response is not null then
      return v_existing_response;
    end if;
  end if;

  -- Validation
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Comanda nu conține produse.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_vid := v_item->>'vid';
    v_item_qty := (v_item->>'qty')::integer;

    if not exists (
      select 1 from public.shop_products
      where id = v_item_vid and available = true
    ) then
      raise exception 'Produsul "%" nu este disponibil.', v_item_vid;
    end if;

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

  if v_qty_this_order > v_max_qty_total then
    raise exception 'Cantitatea totală a comenzii depășește limita de % caserole.', v_max_qty_total;
  end if;

  -- Grila de preț din shop_products (sursă unică, sincronă cu frontend/checkout):
  -- sub prag -> price_lei; la/peste prag (kg totale >= bulk_threshold_kg, RETROACTIV
  -- pe tot coșul) -> bulk_price_lei. Shop-ul e mono-produs, deci configul se ia
  -- de pe produsul primului item (validat mai sus).
  select
    product.price_lei,
    product.bulk_threshold_kg,
    product.bulk_price_lei,
    coalesce(nullif(product.unit_weight_kg, 0), 0.5) as unit_weight_kg
  into v_pricing
  from public.shop_products product
  where product.id = (p_items->0->>'vid');

  if v_pricing.price_lei is null or v_pricing.price_lei <= 0 then
    raise exception 'Prețul produsului nu este configurat.';
  end if;

  v_unit_price_lei := case
    when v_pricing.bulk_threshold_kg is not null
     and v_pricing.bulk_threshold_kg > 0
     and v_pricing.bulk_price_lei is not null
     and v_pricing.bulk_price_lei > 0
     and (v_qty_this_order * v_pricing.unit_weight_kg) >= v_pricing.bulk_threshold_kg
      then v_pricing.bulk_price_lei
    else v_pricing.price_lei
  end;

  v_expected_total_lei := round((v_qty_this_order * v_unit_price_lei)::numeric, 2);

  if round(coalesce(p_total_lei, 0)::numeric, 2) <> v_expected_total_lei then
    raise exception
      'Totalul comenzii (% lei) nu corespunde cantității (% caserole × % lei = % lei).',
      p_total_lei, v_qty_this_order, v_unit_price_lei, v_expected_total_lei;
  end if;

  -- Minim per zonă (doar dacă frontend trimite explicit zona)
  if p_delivery_mode = 'livrare' and p_in_suceava is not null then
    if p_in_suceava then
      v_min_qty := v_min_qty_suceava;
      if v_qty_this_order < v_min_qty then
        raise exception
          'Comanda minimă pentru livrare în Suceava este de % caserole (1 kg). Ai selectat % caserole.',
          v_min_qty, v_qty_this_order;
      end if;
    else
      v_min_qty := v_min_qty_exterior;
      if v_qty_this_order < v_min_qty then
        raise exception
          'Comanda minimă pentru livrare în afara Sucevei este de % caserole (2 kg). Ai selectat % caserole.',
          v_min_qty, v_qty_this_order;
      end if;
    end if;
  end if;

  -- Advisory lock
  perform pg_advisory_xact_lock(
    hashtext('shop-campaign-preorder'),
    hashtext(p_campaign_id::text)
  );

  -- Re-check idempotency sub lock
  if p_idempotency_key is not null then
    select checkout_response into v_existing_response
    from public.shop_orders
    where tenant_id = p_tenant_id
      and idempotency_key = p_idempotency_key
    limit 1;
    if v_existing_response is not null then
      return v_existing_response;
    end if;
  end if;

  select * into v_campaign
  from public.shop_campaigns
  where id = p_campaign_id
    and tenant_id = p_tenant_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'Campania nu este activă sau nu aparține tenantului.';
  end if;

  insert into public.shop_orders (
    tenant_id, customer_name, customer_phone,
    delivery_mode, delivery_address, delivery_city,
    items, total_lei, notes, order_kind, campaign_id,
    status, idempotency_key, in_suceava, delivery_date
  )
  values (
    p_tenant_id, p_customer_name, p_customer_phone,
    p_delivery_mode, p_delivery_address, p_delivery_city,
    p_items, p_total_lei, p_notes, 'preorder', p_campaign_id,
    'noua', p_idempotency_key, p_in_suceava, p_preferred_delivery_date
  )
  returning id into v_order_id;

  update public.shop_campaigns
  set current_count = current_count + v_qty_this_order
  where id = p_campaign_id
  returning current_count into v_new_count;

  select m.* into v_milestone
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
    set reached = true, reached_at = now(), reached_by_order_id = v_order_id
    where id = v_milestone.id;

    insert into public.shop_campaign_milestone_rewards (
      campaign_id, milestone_id, order_id, reward_label, status
    )
    values (
      p_campaign_id, v_milestone.id, v_order_id, v_reward_label, 'pending'
    )
    on conflict (campaign_id, milestone_id) do nothing
    returning id into v_reward_id;

    v_hit_milestone := (v_reward_id is not null);
  end if;

  v_response := jsonb_build_object(
    'order_id', v_order_id,
    'order_kind', 'preorder',
    'campaign_id', p_campaign_id,
    'current_count', v_new_count,
    'hit_milestone', v_hit_milestone,
    'milestone_threshold', case when v_hit_milestone then v_milestone.threshold else null end,
    'milestone_reward', case when v_hit_milestone then v_reward_label else null end,
    'reward_id', v_reward_id
  );

  update public.shop_orders
  set checkout_response = v_response
  where id = v_order_id;

  return v_response;
end;
$$;

revoke all on function public.place_preorder_atomic(uuid, uuid, text, text, text, text, text, jsonb, numeric, text, text, boolean, date) from public;
revoke all on function public.place_preorder_atomic(uuid, uuid, text, text, text, text, text, jsonb, numeric, text, text, boolean, date) from anon;
grant execute on function public.place_preorder_atomic(uuid, uuid, text, text, text, text, text, jsonb, numeric, text, text, boolean, date) to service_role;

-- ---------------------------------------------------------------------------
-- (b) actualizarea prețului pe rândul global 'zmeura'
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
  v_price numeric;
begin
  select price_lei into v_price
  from public.shop_products
  where id = 'zmeura';

  if v_price is null then
    raise exception 'Rândul shop_products ''zmeura'' nu există — rollback.';
  end if;

  if v_price = 17.50 then
    raise notice 'Prețul e deja 17.50 — UPDATE sărit (migrare rerulată).';
    return;
  end if;

  if v_price <> 20 then
    raise exception 'Preț neașteptat pe ''zmeura'': % (așteptat 20) — rollback pentru inspecție manuală.', v_price;
  end if;

  update public.shop_products
  set price_lei = 17.50,
      bulk_threshold_kg = 10,
      bulk_price_lei = 15.00
  where id = 'zmeura'
    and price_lei = 20;

  get diagnostics v_count = row_count;
  raise notice 'Grilă activată pe ''zmeura'': price_lei 20 -> 17.50, prag 10 kg -> 15.00/caserolă (% rând).', v_count;

  if v_count <> 1 then
    raise exception 'UPDATE-ul de preț a atins % rânduri în loc de 1 — rollback.', v_count;
  end if;
end
$$;

notify pgrst, 'reload schema';
