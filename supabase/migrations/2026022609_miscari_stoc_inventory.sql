-- Inventory per location + recoltari schema guard for kg quality columns

alter table public.recoltari
  add column if not exists kg_cal1 numeric not null default 0,
  add column if not exists kg_cal2 numeric not null default 0;

create table if not exists public.miscari_stoc (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  locatie_id uuid not null references public.parcele(id) on delete cascade,
  produs text not null,
  calitate text not null,
  depozit text not null,
  tip_miscare text not null,
  cantitate_kg numeric not null,
  referinta_id uuid,
  data date not null default current_date,
  observatii text,
  created_at timestamptz not null default now(),
  constraint miscari_stoc_cantitate_non_negative check (cantitate_kg >= 0),
  constraint miscari_stoc_calitate_check check (calitate in ('cal1', 'cal2')),
  constraint miscari_stoc_depozit_check check (depozit in ('fresh', 'congelat', 'procesat')),
  constraint miscari_stoc_tip_miscare_check check (
    tip_miscare in (
      'recoltare',
      'vanzare',
      'consum',
      'oferit_gratuit',
      'procesare',
      'congelare',
      'pierdere',
      'ajustare'
    )
  )
);

create index if not exists miscari_stoc_loc_prod_cal_data_idx
  on public.miscari_stoc (locatie_id, produs, calitate, data);

create index if not exists miscari_stoc_tenant_locatie_idx
  on public.miscari_stoc (tenant_id, locatie_id);

alter table public.miscari_stoc enable row level security;

drop policy if exists miscari_stoc_select_policy on public.miscari_stoc;
create policy miscari_stoc_select_policy
on public.miscari_stoc
for select
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists miscari_stoc_insert_policy on public.miscari_stoc;
create policy miscari_stoc_insert_policy
on public.miscari_stoc
for insert
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists miscari_stoc_update_policy on public.miscari_stoc;
create policy miscari_stoc_update_policy
on public.miscari_stoc
for update
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
)
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists miscari_stoc_delete_policy on public.miscari_stoc;
create policy miscari_stoc_delete_policy
on public.miscari_stoc
for delete
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

notify pgrst, 'reload schema';
