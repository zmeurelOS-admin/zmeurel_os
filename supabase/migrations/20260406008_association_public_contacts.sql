-- Public contact metadata for the association shop.
-- Keeps public contact + social links in DB with anon-readable RLS.

CREATE TABLE IF NOT EXISTS public.association_public_contacts (
  slug text PRIMARY KEY DEFAULT 'gusta-din-bucovina',
  email text,
  phone text,
  order_phone text,
  facebook_url text,
  instagram_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT association_public_contacts_singleton_check
    CHECK (slug = 'gusta-din-bucovina')
);

COMMENT ON TABLE public.association_public_contacts IS
  'Public contact metadata for the Gusta din Bucovina association shop.';

COMMENT ON COLUMN public.association_public_contacts.order_phone IS
  'Phone number displayed for phone orders in the public association shop.';

ALTER TABLE public.association_public_contacts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.association_public_contacts TO anon;
GRANT SELECT ON public.association_public_contacts TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'association_public_contacts'
      AND policyname = 'association_public_contacts_public_read'
  ) THEN
    CREATE POLICY association_public_contacts_public_read
      ON public.association_public_contacts
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'association_public_contacts'
      AND policyname = 'association_public_contacts_staff_insert'
  ) THEN
    CREATE POLICY association_public_contacts_staff_insert
      ON public.association_public_contacts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.association_members am
          WHERE am.user_id = auth.uid()
            AND am.role IN ('admin', 'moderator')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'association_public_contacts'
      AND policyname = 'association_public_contacts_staff_update'
  ) THEN
    CREATE POLICY association_public_contacts_staff_update
      ON public.association_public_contacts
      FOR UPDATE
      TO authenticated
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
  END IF;
END $$;

INSERT INTO public.association_public_contacts (slug)
VALUES ('gusta-din-bucovina')
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
