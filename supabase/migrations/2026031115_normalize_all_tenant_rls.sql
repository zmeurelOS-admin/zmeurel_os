do $$
declare
    r record;
begin
    for r in (
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in (
            'parcele',
            'clienti',
            'recoltari',
            'vanzari',
            'activitati_agricole',
            'cheltuieli_diverse',
            'culegatori',
            'investitii',
            'comenzi',
            'miscari_stoc',
            'vanzari_butasi',
            'vanzari_butasi_items'
          )
    )
    loop
        execute format(
            'drop policy if exists %I on public.%I',
            r.policyname,
            r.tablename
        );
    end loop;
end $$;

create policy parcele_tenant_select
on public.parcele
for select
using (tenant_id = public.current_tenant_id());

create policy parcele_tenant_insert
on public.parcele
for insert
with check (tenant_id = public.current_tenant_id());

create policy parcele_tenant_update
on public.parcele
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy parcele_tenant_delete
on public.parcele
for delete
using (tenant_id = public.current_tenant_id());

create policy parcele_superadmin_all
on public.parcele
for all
using (is_superadmin())
with check (is_superadmin());

create policy clienti_tenant_select
on public.clienti
for select
using (tenant_id = public.current_tenant_id());

create policy clienti_tenant_insert
on public.clienti
for insert
with check (tenant_id = public.current_tenant_id());

create policy clienti_tenant_update
on public.clienti
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy clienti_tenant_delete
on public.clienti
for delete
using (tenant_id = public.current_tenant_id());

create policy clienti_superadmin_all
on public.clienti
for all
using (is_superadmin())
with check (is_superadmin());

create policy recoltari_tenant_select
on public.recoltari
for select
using (tenant_id = public.current_tenant_id());

create policy recoltari_tenant_insert
on public.recoltari
for insert
with check (tenant_id = public.current_tenant_id());

create policy recoltari_tenant_update
on public.recoltari
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy recoltari_tenant_delete
on public.recoltari
for delete
using (tenant_id = public.current_tenant_id());

create policy recoltari_superadmin_all
on public.recoltari
for all
using (is_superadmin())
with check (is_superadmin());

create policy vanzari_tenant_select
on public.vanzari
for select
using (tenant_id = public.current_tenant_id());

create policy vanzari_tenant_insert
on public.vanzari
for insert
with check (tenant_id = public.current_tenant_id());

create policy vanzari_tenant_update
on public.vanzari
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy vanzari_tenant_delete
on public.vanzari
for delete
using (tenant_id = public.current_tenant_id());

create policy vanzari_superadmin_all
on public.vanzari
for all
using (is_superadmin())
with check (is_superadmin());

create policy activitati_agricole_tenant_select
on public.activitati_agricole
for select
using (tenant_id = public.current_tenant_id());

create policy activitati_agricole_tenant_insert
on public.activitati_agricole
for insert
with check (tenant_id = public.current_tenant_id());

create policy activitati_agricole_tenant_update
on public.activitati_agricole
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy activitati_agricole_tenant_delete
on public.activitati_agricole
for delete
using (tenant_id = public.current_tenant_id());

create policy activitati_agricole_superadmin_all
on public.activitati_agricole
for all
using (is_superadmin())
with check (is_superadmin());

create policy cheltuieli_diverse_tenant_select
on public.cheltuieli_diverse
for select
using (tenant_id = public.current_tenant_id());

create policy cheltuieli_diverse_tenant_insert
on public.cheltuieli_diverse
for insert
with check (tenant_id = public.current_tenant_id());

create policy cheltuieli_diverse_tenant_update
on public.cheltuieli_diverse
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy cheltuieli_diverse_tenant_delete
on public.cheltuieli_diverse
for delete
using (tenant_id = public.current_tenant_id());

create policy cheltuieli_diverse_superadmin_all
on public.cheltuieli_diverse
for all
using (is_superadmin())
with check (is_superadmin());

create policy culegatori_tenant_select
on public.culegatori
for select
using (tenant_id = public.current_tenant_id());

create policy culegatori_tenant_insert
on public.culegatori
for insert
with check (tenant_id = public.current_tenant_id());

create policy culegatori_tenant_update
on public.culegatori
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy culegatori_tenant_delete
on public.culegatori
for delete
using (tenant_id = public.current_tenant_id());

create policy culegatori_superadmin_all
on public.culegatori
for all
using (is_superadmin())
with check (is_superadmin());

create policy investitii_tenant_select
on public.investitii
for select
using (tenant_id = public.current_tenant_id());

create policy investitii_tenant_insert
on public.investitii
for insert
with check (tenant_id = public.current_tenant_id());

create policy investitii_tenant_update
on public.investitii
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy investitii_tenant_delete
on public.investitii
for delete
using (tenant_id = public.current_tenant_id());

create policy investitii_superadmin_all
on public.investitii
for all
using (is_superadmin())
with check (is_superadmin());

create policy comenzi_tenant_select
on public.comenzi
for select
using (tenant_id = public.current_tenant_id());

create policy comenzi_tenant_insert
on public.comenzi
for insert
with check (tenant_id = public.current_tenant_id());

create policy comenzi_tenant_update
on public.comenzi
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy comenzi_tenant_delete
on public.comenzi
for delete
using (tenant_id = public.current_tenant_id());

create policy comenzi_superadmin_all
on public.comenzi
for all
using (is_superadmin())
with check (is_superadmin());

create policy miscari_stoc_tenant_select
on public.miscari_stoc
for select
using (tenant_id = public.current_tenant_id());

create policy miscari_stoc_tenant_insert
on public.miscari_stoc
for insert
with check (tenant_id = public.current_tenant_id());

create policy miscari_stoc_tenant_update
on public.miscari_stoc
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy miscari_stoc_tenant_delete
on public.miscari_stoc
for delete
using (tenant_id = public.current_tenant_id());

create policy miscari_stoc_superadmin_all
on public.miscari_stoc
for all
using (is_superadmin())
with check (is_superadmin());

create policy vanzari_butasi_tenant_select
on public.vanzari_butasi
for select
using (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_tenant_insert
on public.vanzari_butasi
for insert
with check (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_tenant_update
on public.vanzari_butasi
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_tenant_delete
on public.vanzari_butasi
for delete
using (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_superadmin_all
on public.vanzari_butasi
for all
using (is_superadmin())
with check (is_superadmin());

create policy vanzari_butasi_items_tenant_select
on public.vanzari_butasi_items
for select
using (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_items_tenant_insert
on public.vanzari_butasi_items
for insert
with check (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_items_tenant_update
on public.vanzari_butasi_items
for update
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_items_tenant_delete
on public.vanzari_butasi_items
for delete
using (tenant_id = public.current_tenant_id());

create policy vanzari_butasi_items_superadmin_all
on public.vanzari_butasi_items
for all
using (is_superadmin())
with check (is_superadmin());

notify pgrst, 'reload schema';
