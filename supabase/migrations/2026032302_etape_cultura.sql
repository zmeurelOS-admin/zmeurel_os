-- Tabel pentru istoricul etapelor per cultură
create table if not exists public.etape_cultura (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cultura_id  uuid        NOT NULL REFERENCES public.culturi(id) ON DELETE CASCADE,
  etapa       text        NOT NULL,
  observatii  text,
  data_etapa  date        NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

alter table public.etape_cultura enable row level security;

drop policy if exists etape_cultura_select on public.etape_cultura;
create policy etape_cultura_select on public.etape_cultura
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists etape_cultura_insert on public.etape_cultura;
create policy etape_cultura_insert on public.etape_cultura
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists etape_cultura_update on public.etape_cultura;
create policy etape_cultura_update on public.etape_cultura
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists etape_cultura_delete on public.etape_cultura;
create policy etape_cultura_delete on public.etape_cultura
  for delete to authenticated
  using (tenant_id = public.current_tenant_id());

create index if not exists etape_cultura_cultura_data_idx
  on public.etape_cultura (cultura_id, data_etapa desc, created_at desc);

notify pgrst, 'reload schema';
