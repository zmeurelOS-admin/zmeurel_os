-- 1. TABELA shop_campaigns
CREATE TABLE public.shop_campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug           text NOT NULL,
  title          text NOT NULL,
  target_qty     integer NOT NULL CHECK (target_qty > 0),
  current_count  integer NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','ended')),
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
-- current_count e menținut atomic în RPC (Migrarea 2), nu prin trigger.
-- Un singur tenant poate avea un singur slug activ — UNIQUE garantează asta.

-- 2. TABELA shop_campaign_milestones
CREATE TABLE public.shop_campaign_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid NOT NULL REFERENCES public.shop_campaigns(id) ON DELETE CASCADE,
  threshold      integer NOT NULL CHECK (threshold > 0),
  reward_label   text NOT NULL,
  reached        boolean NOT NULL DEFAULT false,
  reached_at     timestamptz,
  reached_by_order_id uuid REFERENCES public.shop_orders(id) ON DELETE SET NULL,
  UNIQUE (campaign_id, threshold)
);
-- reached=true e permanent (o singură dată per prag, nu se resetează la anulare).
-- reached_by_order_id e informativ — nu se folosește pentru logica de business.

-- 3. TABELA shop_campaign_adjustments
-- Ajustări manuale ale current_count (corecții admin, returnări, erori).
CREATE TABLE public.shop_campaign_adjustments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid NOT NULL REFERENCES public.shop_campaigns(id) ON DELETE CASCADE,
  delta          integer NOT NULL,  -- pozitiv sau negativ
  reason         text NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 4. TABELA shop_campaign_milestone_rewards
-- Premiile acordate per comandă care a trecut un prag.
CREATE TABLE public.shop_campaign_milestone_rewards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid NOT NULL REFERENCES public.shop_campaigns(id) ON DELETE CASCADE,
  milestone_id   uuid NOT NULL REFERENCES public.shop_campaign_milestones(id) ON DELETE CASCADE,
  order_id       uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  reward_label   text NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','validated','cancelled','voided')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, milestone_id)
  -- UNIQUE garantează că un milestone e acordat o singură dată, atomicitate
  -- suplimentară față de reached=true (double safety).
);

-- 5. COLOANE NOI PE shop_orders
ALTER TABLE public.shop_orders
  ADD COLUMN order_kind  text NOT NULL DEFAULT 'standard'
               CHECK (order_kind IN ('standard','preorder')),
  ADD COLUMN campaign_id uuid REFERENCES public.shop_campaigns(id) ON DELETE SET NULL;
-- DEFAULT 'standard' → toate comenzile existente devin standard automat, fără UPDATE.
-- campaign_id nullable → comenzile standard nu sunt legate de campanie.

-- 6. INDEX-URI
CREATE INDEX ON public.shop_campaign_milestones (campaign_id, threshold);
CREATE INDEX ON public.shop_campaign_milestone_rewards (order_id);
CREATE INDEX ON public.shop_campaign_milestone_rewards (milestone_id);
CREATE INDEX ON public.shop_orders (campaign_id) WHERE campaign_id IS NOT NULL;

-- 7. RLS
ALTER TABLE public.shop_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_campaign_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_campaign_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_campaign_milestone_rewards ENABLE ROW LEVEL SECURITY;

-- shop_campaigns: authenticated citește propria campanie
CREATE POLICY "authenticated can select own campaigns"
  ON public.shop_campaigns FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "authenticated can update own campaigns"
  ON public.shop_campaigns FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- milestones, rewards, adjustments: acces prin campanie (tenant implicit)
CREATE POLICY "authenticated can select milestones"
  ON public.shop_campaign_milestones FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT id FROM public.shop_campaigns
    WHERE tenant_id = public.current_tenant_id()
  ));

CREATE POLICY "authenticated can select rewards"
  ON public.shop_campaign_milestone_rewards FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT id FROM public.shop_campaigns
    WHERE tenant_id = public.current_tenant_id()
  ));

CREATE POLICY "authenticated can select adjustments"
  ON public.shop_campaign_adjustments FOR SELECT TO authenticated
  USING (campaign_id IN (
    SELECT id FROM public.shop_campaigns
    WHERE tenant_id = public.current_tenant_id()
  ));

-- anon poate citi campaniile active (pentru meter public)
CREATE POLICY "anon can select active campaigns"
  ON public.shop_campaigns FOR SELECT TO anon
  USING (status = 'active');

CREATE POLICY "anon can select milestones of active campaigns"
  ON public.shop_campaign_milestones FOR SELECT TO anon
  USING (campaign_id IN (
    SELECT id FROM public.shop_campaigns WHERE status = 'active'
  ));

-- 8. GRANTURI
GRANT SELECT ON public.shop_campaigns TO anon, authenticated;
GRANT SELECT ON public.shop_campaign_milestones TO anon, authenticated;
GRANT SELECT ON public.shop_campaign_milestone_rewards TO authenticated;
GRANT SELECT ON public.shop_campaign_adjustments TO authenticated;
-- INSERT/UPDATE pe aceste tabele se face DOAR prin RPC cu SECURITY DEFINER (Migrarea 2).
-- Nu acordăm INSERT/UPDATE direct rolurilor.

-- 9. RELOAD
NOTIFY pgrst, 'reload schema';
