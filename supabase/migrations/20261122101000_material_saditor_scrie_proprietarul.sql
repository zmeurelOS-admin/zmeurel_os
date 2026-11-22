-- Material săditor: scrie doar proprietarul (promptul 25, partea 3; decizia lui Andrei).
--
-- NEAPLICATĂ: o rulează Andrei. Independentă de 20261122100000; ordinea doar urmează promptul.
--
-- Azi, pe `vanzari_butasi` și `vanzari_butasi_items`, INSERT / UPDATE / DELETE cereau doar
-- `tenant_id = current_tenant_id()`: orice operator (și unul doar-citire, și unul fără niciun drept) putea crea,
-- schimba sau șterge comenzi de material săditor prin API. Modulul nu e al operatorului (nu are drept pe el în
-- Echipa, ruta `/vanzari-butasi` nu e pe lista lui), deci interfața oricum nu-l lasă.
--
-- Ce se schimbă: scrierile devin `tenant_id = current_tenant_id() and is_tenant_owner(tenant_id)`.
-- Ce NU se schimbă: citirea (`vanzari_butasi_select`, `vanzari_butasi_items_select`), triggerele
-- (`set_vanzari_butasi_tenant_and_public_id`, `enforce_vanzari_butasi_items_tenant`, SECURITY DEFINER),
-- cronul de mementouri (service role), curățarea demo-urilor și resetul fermei (service role / definer).
-- Tabelele modulului: doar acestea două (verificat în `pg_class` și în `src/lib/supabase/queries/vanzari-butasi.ts`).
-- `merge_clienti_duplicates` (invoker) schimbă și `vanzari_butasi.client_id`, dar aplicația nu o cheamă.
--
-- Aplicația merge fără migrare (ca azi) și cu ea, pe codul de azi din `main`: proprietarul nu vede nicio
-- diferență; doar scrierile prin API ale unui operator primesc `42501` (sau 0 rânduri la update/delete).
-- Ordinea față de merge nu contează.
--
-- Aditivă pentru date: doar politici. Se poate rula de mai multe ori (drop if exists + create).

do $$
declare
  t text;
begin
  foreach t in array array['vanzari_butasi', 'vanzari_butasi_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_delete', t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verificarea de după aplicare:
--   select tablename, policyname, cmd, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename in ('vanzari_butasi', 'vanzari_butasi_items') order by 1, 3;
--   Așteptat: insert / update / delete cu `is_tenant_owner(tenant_id)`; select neschimbat.
--   În demo: proprietarul adaugă, editează, livrează și șterge o comandă de material săditor (merge);
--   operatorul din link, prin API: `insert` în `vanzari_butasi` → 42501.
