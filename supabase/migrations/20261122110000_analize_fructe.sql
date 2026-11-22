-- Analizele la fructe (promptul 26, partea B). Doar aditiv: 3 tabele noi, o funcție nouă, un bucket privat,
-- o coloană nouă în `tenant_settings`. Nu atinge date existente.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de 20261122111000 (mementoul), dar se rulează înaintea ei
-- (mementoul citește `analize_fructe` ca să știe când să se oprească).
-- Schema de pornire citită din producție pe 22.11.2026 (`information_schema.columns`, `pg_policies`, `pg_proc`).
--
-- Ce adaugă:
--   * `analize_fructe`: o analiză (prelevarea, rezultatul, linkul public). Fără tip de analiză: ce s-a analizat
--     se scrie din buletin în `ce_s_a_analizat`.
--   * `analize_fructe_parcele`: parcelele unei analize (mai multe pe o analiză; aplicația oferă doar parcelele
--     comerciale, nu pe cele „Personal”).
--   * `analize_fructe_substante`: substanțele găsite (opționale), cu valoarea și limita.
--   * `operator_can_read(p_module)`: proprietarul sau operatorul cu „Citește” / „Scrie” pe modul. Pentru
--     `tratamente` respectă compatibilitatea din `resolveFarmMemberAccess`: un rând vechi cu `activitati` și fără
--     `tratamente` primește citire; un `{ module: 'tratamente', level: 'none' }` explicit o refuză.
--   * RLS: citire pentru proprietar și operatorul cu „Tratamente” (citește sau scrie); scriere pentru proprietar
--     și `operator_can_write('tratamente')`; ștergere doar proprietarul. Toate pe `tenant_id = current_tenant_id()`.
--   * Bucket privat `analize` (poza PV-ului, buletinul): politici pe prefixul tenantului (`<tenant_id>/...`),
--     ca `bonuri`, cu aceleași drepturi ca tabelul.
--   * `tenant_settings.analize_public_implicit jsonb`: ce apare implicit în raportul public, pe fermă.
--
-- Pagina publică `/a/<token>` citește cu service role (fără politică pentru `anon`), doar pentru
-- `status = 'conform'` și `public_activ = true`, și doar câmpurile permise.
--
-- Până la aplicare: tab-ul „Analize” din Tratamente arată „Analizele vor merge după actualizarea bazei de date”
-- (eroarea „tabelul lipsește” e prinsă), `/a/<token>` dă 404, mementoul nu pornește, fișa parcelei nu arată rândul
-- analizei, iar exportul „Analizele sezonului” iese gol. Restul aplicației merge ca azi.
--
-- Anulare (doar dacă e nevoie; pierde analizele salvate):
--   drop table if exists public.analize_fructe_substante;
--   drop table if exists public.analize_fructe_parcele;
--   drop table if exists public.analize_fructe;
--   drop function if exists public.operator_can_read(text);
--   alter table public.tenant_settings drop column if exists analize_public_implicit;
--   -- bucketul `analize` și politicile lui din storage.objects se șterg din panoul Supabase.

begin;

-- ─── Dreptul de citire pe un modul ────────────────────────────────────────────────────────────────

create or replace function public.operator_can_read(p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_access jsonb;
begin
  if auth.uid() is null then
    return false;
  end if;

  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then
    return false;
  end if;

  if public.is_tenant_owner(v_tenant_id) then
    return true;
  end if;

  select fm.modules_access
  into v_access
  from public.farm_members fm
  where fm.user_id = auth.uid()
    and fm.tenant_id = v_tenant_id
    and fm.is_active = true
    and fm.role = 'operator'
  order by fm.created_at asc
  limit 1;

  if not found or v_access is null or jsonb_typeof(v_access) <> 'array' then
    return false;
  end if;

  -- Dreptul explicit pe modul.
  if exists (
    select 1 from jsonb_array_elements(v_access) as item(value)
    where item.value ->> 'module' = p_module
      and item.value ->> 'level' in ('read', 'write')
  ) then
    return true;
  end if;

  -- Compatibilitatea Tratamente: rândurile vechi aveau doar `activitati`. Un refuz explicit (`none`) câștigă.
  if p_module = 'tratamente'
    and not exists (
      select 1 from jsonb_array_elements(v_access) as item(value)
      where item.value ->> 'module' = 'tratamente'
    )
    and exists (
      select 1 from jsonb_array_elements(v_access) as item(value)
      where item.value ->> 'module' = 'activitati'
        and item.value ->> 'level' in ('read', 'write')
    ) then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.operator_can_read(text) from public, anon;
grant execute on function public.operator_can_read(text) to authenticated, service_role;

comment on function public.operator_can_read(text) is
  'Proprietarul sau operatorul cu citire/scriere pe modul (tratamente: și rândurile vechi cu doar activitati).';

-- ─── analize_fructe ───────────────────────────────────────────────────────────────────────────────

create table if not exists public.analize_fructe (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_sync_id uuid null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prelevarea
  data_prelevare date not null,
  pv_numar text null,
  pv_poza_path text null,
  prelevat_de text null check (prelevat_de is null or prelevat_de in ('dsvsa', 'laborator', 'eu')),
  laborator text null,
  data_predare date null,
  nota text null,

  -- Rezultatul
  status text not null default 'la_laborator' check (status in ('la_laborator', 'conform', 'neconform')),
  buletin_numar text null,
  buletin_data date null,
  buletin_path text null,
  ce_s_a_analizat text null,
  rest_nedetectate boolean null,

  -- Publicul
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  public_activ boolean not null default true,
  public_optiuni jsonb null,

  constraint analize_fructe_public_token_len check (char_length(public_token) >= 10)
);

comment on table public.analize_fructe is 'Analizele la fructe (reziduuri): prelevarea, rezultatul din buletin, linkul public.';
comment on column public.analize_fructe.public_token is
  'Tokenul linkului public /a/<token>: aleator (32 de caractere hex), negăsibil. Pagina există doar pentru conform + public_activ.';
comment on column public.analize_fructe.public_optiuni is
  'Suprascrierea pe analiză a implicitelor fermei (tenant_settings.analize_public_implicit): substante, tratamente, numere, poza_buletin, telefon.';

create unique index if not exists analize_fructe_tenant_client_sync_key
  on public.analize_fructe (tenant_id, client_sync_id)
  where client_sync_id is not null;

create index if not exists idx_analize_fructe_tenant_prelevare
  on public.analize_fructe (tenant_id, data_prelevare desc);

alter table public.analize_fructe enable row level security;

drop policy if exists analize_fructe_select on public.analize_fructe;
create policy analize_fructe_select on public.analize_fructe for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists analize_fructe_insert on public.analize_fructe;
create policy analize_fructe_insert on public.analize_fructe for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_update on public.analize_fructe;
create policy analize_fructe_update on public.analize_fructe for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_delete on public.analize_fructe;
create policy analize_fructe_delete on public.analize_fructe for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── analize_fructe_parcele ───────────────────────────────────────────────────────────────────────

create table if not exists public.analize_fructe_parcele (
  analiza_id uuid not null references public.analize_fructe(id) on delete cascade,
  parcela_id uuid not null references public.parcele(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (analiza_id, parcela_id)
);

comment on table public.analize_fructe_parcele is 'Parcelele unei analize (o probă comună sau toate parcelele din același PV).';

create index if not exists idx_analize_fructe_parcele_tenant_parcela
  on public.analize_fructe_parcele (tenant_id, parcela_id);

alter table public.analize_fructe_parcele enable row level security;

drop policy if exists analize_fructe_parcele_select on public.analize_fructe_parcele;
create policy analize_fructe_parcele_select on public.analize_fructe_parcele for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists analize_fructe_parcele_insert on public.analize_fructe_parcele;
create policy analize_fructe_parcele_insert on public.analize_fructe_parcele for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_parcele_delete on public.analize_fructe_parcele;
create policy analize_fructe_parcele_delete on public.analize_fructe_parcele for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

-- ─── analize_fructe_substante ─────────────────────────────────────────────────────────────────────

create table if not exists public.analize_fructe_substante (
  id uuid primary key default gen_random_uuid(),
  analiza_id uuid not null references public.analize_fructe(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  substanta text not null,
  valoare_mg_kg numeric null check (valoare_mg_kg is null or valoare_mg_kg >= 0),
  lmr_mg_kg numeric null check (lmr_mg_kg is null or lmr_mg_kg >= 0),
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.analize_fructe_substante is 'Substanțele găsite într-o analiză (opțional): valoarea și limita maximă (LMR), în mg/kg.';

create index if not exists idx_analize_fructe_substante_analiza
  on public.analize_fructe_substante (analiza_id, ordine);
create index if not exists idx_analize_fructe_substante_tenant
  on public.analize_fructe_substante (tenant_id);

alter table public.analize_fructe_substante enable row level security;

drop policy if exists analize_fructe_substante_select on public.analize_fructe_substante;
create policy analize_fructe_substante_select on public.analize_fructe_substante for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists analize_fructe_substante_insert on public.analize_fructe_substante;
create policy analize_fructe_substante_insert on public.analize_fructe_substante for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_substante_update on public.analize_fructe_substante;
create policy analize_fructe_substante_update on public.analize_fructe_substante for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

drop policy if exists analize_fructe_substante_delete on public.analize_fructe_substante;
create policy analize_fructe_substante_delete on public.analize_fructe_substante for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  );

-- ─── Implicitele raportului public, pe fermă ──────────────────────────────────────────────────────

alter table public.tenant_settings
  add column if not exists analize_public_implicit jsonb null;

comment on column public.tenant_settings.analize_public_implicit is
  'Ce apare implicit în raportul public al analizelor: {substante, tratamente, numere, poza_buletin, telefon}. Null = implicitele aplicației.';

-- ─── Storage: bucket privat `analize` ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('analize', 'analize', false)
on conflict (id) do nothing;

drop policy if exists "Analize: citire pe tenant" on storage.objects;
create policy "Analize: citire pe tenant" on storage.objects for select to authenticated
  using (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_read('tratamente')
  );

drop policy if exists "Analize: urcare pe tenant" on storage.objects;
create policy "Analize: urcare pe tenant" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  );

drop policy if exists "Analize: înlocuire pe tenant" on storage.objects;
create policy "Analize: înlocuire pe tenant" on storage.objects for update to authenticated
  using (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  )
  with check (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  );

drop policy if exists "Analize: ștergere pe tenant" on storage.objects;
create policy "Analize: ștergere pe tenant" on storage.objects for delete to authenticated
  using (
    bucket_id = 'analize'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = (public.current_tenant_id())::text
    and public.operator_can_write('tratamente')
  );

commit;
