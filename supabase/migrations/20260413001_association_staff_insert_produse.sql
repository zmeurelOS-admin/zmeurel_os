-- Policy adăugată:
--   Tabel: public.produse
--   Policy: produse_insert_association_staff_approved_tenant
-- Scop:
--   Permite staff-ului asociației (admin/moderator) să insereze produse
--   în numele fermierilor aprobați ai asociației.
-- Constrângeri:
--   - NU modifică policy-urile existente de SELECT / UPDATE / DELETE
--   - NU relaxează insert-ul existent pentru fermieri
--   - tenant_id din INSERT trebuie să aparțină unui tenant aprobat și non-demo

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'produse'
      AND policyname = 'produse_insert_association_staff_approved_tenant'
  ) THEN
    CREATE POLICY produse_insert_association_staff_approved_tenant
      ON public.produse
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.association_members am
          WHERE am.user_id = auth.uid()
            AND am.role IN ('admin', 'moderator')
        )
        AND EXISTS (
          SELECT 1
          FROM public.tenants t
          WHERE t.id = tenant_id
            AND t.is_association_approved = true
            AND COALESCE(t.is_demo, false) = false
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
