-- Suport pentru dedublarea clienților cu telefoane echivalente în formate diferite.
-- Vezi scripts/dedupe-clienti-report.ts (Faza 1, dry-run) și
-- scripts/dedupe-clienti-merge.ts (Faza 2, merge real, doar după confirmare manuală).

create table if not exists public.clienti_merge_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  principal_client_id uuid not null,
  orphan_client_id uuid not null,
  principal_telefon text,
  orphan_telefon text,
  orphan_nume_client text,
  comenzi_migrated integer not null default 0,
  vanzari_migrated integer not null default 0,
  vanzari_butasi_migrated integer not null default 0,
  merged_at timestamptz not null default now(),
  merged_by text
);

create index if not exists clienti_merge_audit_tenant_idx
  on public.clienti_merge_audit (tenant_id);

create index if not exists clienti_merge_audit_principal_idx
  on public.clienti_merge_audit (principal_client_id);

alter table public.clienti_merge_audit enable row level security;
-- Fără policy-uri permisive intenționat: doar service role (bypass RLS) poate
-- scrie/citi acest tabel de audit al operațiunilor de mentenanță.

-- Repointează toate FK-urile (comenzi, vanzari, vanzari_butasi) de la
-- p_orphan_ids către p_principal_id, apoi șterge recordurile orfane, totul
-- într-o singură tranzacție per apel (rollback automat dacă apare o eroare
-- la mijloc — funcțiile plpgsql rulează atomic în tranzacția apelantă).
create or replace function public.merge_clienti_duplicates(
  p_tenant_id uuid,
  p_principal_id uuid,
  p_orphan_ids uuid[],
  p_merged_by text default null
)
returns table (
  orphan_id uuid,
  comenzi_migrated integer,
  vanzari_migrated integer,
  vanzari_butasi_migrated integer
)
language plpgsql
as $$
declare
  v_orphan_id uuid;
  v_comenzi_count integer;
  v_vanzari_count integer;
  v_vb_count integer;
  v_principal_telefon text;
  v_orphan_telefon text;
  v_orphan_nume text;
begin
  if not exists (
    select 1 from public.clienti
    where id = p_principal_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Principal % nu aparține tenantului % (sau nu există)', p_principal_id, p_tenant_id;
  end if;

  select telefon into v_principal_telefon
  from public.clienti
  where id = p_principal_id;

  foreach v_orphan_id in array p_orphan_ids loop
    if v_orphan_id = p_principal_id then
      continue;
    end if;

    select telefon, nume_client into v_orphan_telefon, v_orphan_nume
    from public.clienti
    where id = v_orphan_id and tenant_id = p_tenant_id;

    if not found then
      raise exception 'Orfanul % nu aparține tenantului % (sau nu mai există)', v_orphan_id, p_tenant_id;
    end if;

    update public.comenzi
      set client_id = p_principal_id
      where client_id = v_orphan_id and tenant_id = p_tenant_id;
    get diagnostics v_comenzi_count = row_count;

    update public.vanzari
      set client_id = p_principal_id
      where client_id = v_orphan_id and tenant_id = p_tenant_id;
    get diagnostics v_vanzari_count = row_count;

    update public.vanzari_butasi
      set client_id = p_principal_id
      where client_id = v_orphan_id and tenant_id = p_tenant_id;
    get diagnostics v_vb_count = row_count;

    delete from public.clienti
      where id = v_orphan_id and tenant_id = p_tenant_id;

    insert into public.clienti_merge_audit (
      tenant_id, principal_client_id, orphan_client_id,
      principal_telefon, orphan_telefon, orphan_nume_client,
      comenzi_migrated, vanzari_migrated, vanzari_butasi_migrated,
      merged_by
    ) values (
      p_tenant_id, p_principal_id, v_orphan_id,
      v_principal_telefon, v_orphan_telefon, v_orphan_nume,
      v_comenzi_count, v_vanzari_count, v_vb_count,
      p_merged_by
    );

    orphan_id := v_orphan_id;
    comenzi_migrated := v_comenzi_count;
    vanzari_migrated := v_vanzari_count;
    vanzari_butasi_migrated := v_vb_count;
    return next;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
