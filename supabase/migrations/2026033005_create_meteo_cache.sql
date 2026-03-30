create table if not exists public.meteo_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  data_fetch timestamptz not null default now(),
  date_expiry timestamptz not null,
  current_temp real,
  current_icon text,
  current_description text,
  current_wind_speed real,
  current_humidity integer,
  forecast_tomorrow_temp_min real,
  forecast_tomorrow_temp_max real,
  forecast_tomorrow_icon text,
  forecast_tomorrow_pop real,
  raw_json jsonb
);

alter table public.meteo_cache enable row level security;

drop policy if exists "Users can view own meteo cache" on public.meteo_cache;
create policy "Users can view own meteo cache"
  on public.meteo_cache
  for select
  using (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

drop policy if exists "Users can insert own meteo cache" on public.meteo_cache;
create policy "Users can insert own meteo cache"
  on public.meteo_cache
  for insert
  with check (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

drop policy if exists "Users can update own meteo cache" on public.meteo_cache;
create policy "Users can update own meteo cache"
  on public.meteo_cache
  for update
  using (tenant_id = (auth.jwt()->>'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

create index if not exists idx_meteo_cache_tenant_expiry
  on public.meteo_cache (tenant_id, date_expiry);
