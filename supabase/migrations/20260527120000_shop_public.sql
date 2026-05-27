-- B2C public shop (/comanda): separate from B2B `comenzi` (kg, tenant_id, stock RPC).
-- Inserts from the public storefront go through Next.js API (service role); anon policies are defense-in-depth.

-- ---------------------------------------------------------------------------
-- shop_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('livrare', 'ridicare')),
  delivery_address text,
  items jsonb NOT NULL,
  total_lei integer NOT NULL CHECK (total_lei > 0),
  notes text,
  status text NOT NULL DEFAULT 'noua' CHECK (
    status IN ('noua', 'confirmata', 'in_livrare', 'livrata', 'anulata')
  ),
  notified_wa boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.shop_orders IS 'Comenzi B2C magazin public /comanda (caserolă, livrare/ridicare). Nu folosește `comenzi` B2B.';
COMMENT ON COLUMN public.shop_orders.items IS 'Linii coș JSON: [{vid,label,qty,price_lei}, ...].';
COMMENT ON COLUMN public.shop_orders.notified_wa IS 'Marcat după ce fermierul a văzut/confirmat comanda (UI Shop public).';

CREATE INDEX IF NOT EXISTS shop_orders_created_at_idx ON public.shop_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON public.shop_orders (status);

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can insert shop_orders"
  ON public.shop_orders
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated can select shop_orders"
  ON public.shop_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated can update shop_orders"
  ON public.shop_orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- shop_notify_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_notify_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  notified_at timestamptz
);

COMMENT ON TABLE public.shop_notify_requests IS 'Cereri „Anunță-mă” pentru produse indisponibile pe /comanda.';

CREATE INDEX IF NOT EXISTS shop_notify_requests_notified_at_idx
  ON public.shop_notify_requests (notified_at)
  WHERE notified_at IS NULL;

ALTER TABLE public.shop_notify_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can insert shop_notify_requests"
  ON public.shop_notify_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated can select shop_notify_requests"
  ON public.shop_notify_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated can update shop_notify_requests"
  ON public.shop_notify_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- shop_products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  unit_label text NOT NULL,
  price_lei integer,
  available boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shop_products IS 'Catalog editabil B2C pentru /comanda (viitor admin).';

CREATE INDEX IF NOT EXISTS shop_products_sort_order_idx ON public.shop_products (sort_order);

ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select shop_products"
  ON public.shop_products
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "authenticated can all shop_products"
  ON public.shop_products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants (RLS still applies)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.shop_products TO anon;
GRANT SELECT ON public.shop_products TO authenticated;
GRANT ALL ON public.shop_products TO authenticated;

GRANT INSERT ON public.shop_orders TO anon;
GRANT SELECT, UPDATE ON public.shop_orders TO authenticated;

GRANT INSERT ON public.shop_notify_requests TO anon;
GRANT SELECT, UPDATE ON public.shop_notify_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed catalog
-- ---------------------------------------------------------------------------
INSERT INTO public.shop_products (id, name, description, unit_label, price_lei, available, sort_order)
VALUES
  (
    'afine-300',
    'Afine siberiene',
    'Dulci-acrișoare, culese azi.',
    'Caserolă 300 g',
    10,
    true,
    1
  ),
  (
    'afine-500',
    'Afine siberiene',
    'Dulci-acrișoare, culese azi.',
    'Caserolă 500 g',
    15,
    true,
    2
  ),
  (
    'zmeura',
    'Zmeură proaspătă',
    'Se coace în ritmul ei, n-o grăbim.',
    'Caserolă',
    NULL,
    false,
    3
  ),
  (
    'mure',
    'Mure de câmp',
    'Le lăsăm să se coacă complet.',
    'Caserolă',
    NULL,
    false,
    4
  )
ON CONFLICT (id) DO NOTHING;
