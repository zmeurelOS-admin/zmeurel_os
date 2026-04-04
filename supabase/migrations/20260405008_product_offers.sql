-- Oferte produs → asociație (Gustă din Bucovina). Un singur rând „trimisă” per produs (index parțial).

CREATE TABLE IF NOT EXISTS public.association_product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.produse (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  offered_by uuid NOT NULL REFERENCES auth.users (id),
  status text NOT NULL DEFAULT 'trimisa' CHECK (status IN ('trimisa', 'aprobata', 'respinsa', 'retrasa')),
  suggested_price numeric(10, 2),
  message text,
  reviewed_by uuid REFERENCES auth.users (id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offers_status ON public.association_product_offers (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_tenant ON public.association_product_offers (tenant_id, status);

-- O singură ofertă în așteptare (trimisă) per produs; permite istoric după respingere/retragere.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_product_offer_trimisa
  ON public.association_product_offers (product_id)
  WHERE status = 'trimisa';

DROP TRIGGER IF EXISTS association_product_offers_updated_at ON public.association_product_offers;
CREATE TRIGGER association_product_offers_updated_at
  BEFORE UPDATE ON public.association_product_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.association_product_offers IS
  'Oferte de la fermieri către asociație pentru listare în magazinul comun.';

ALTER TABLE public.association_product_offers ENABLE ROW LEVEL SECURITY;

-- Fermierul: rânduri ale propriului tenant (inclusiv INSERT/UPDATE retragere).
CREATE POLICY "farmer_own_offers"
  ON public.association_product_offers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = association_product_offers.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = association_product_offers.tenant_id
    )
    AND association_product_offers.offered_by = auth.uid()
  );

-- Membrii asociației: citesc toate ofertele.
CREATE POLICY "association_members_read_offers"
  ON public.association_product_offers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
    )
  );

-- Admin/moderator: aprobare / respingere (UPDATE).
CREATE POLICY "association_staff_review_offers"
  ON public.association_product_offers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.association_product_offers TO authenticated;

NOTIFY pgrst, 'reload schema';
