-- Promptul 27, A4: `get_public_farmer_card` spune „Atestat de producător”, nu „Certificat producător”, și întoarce
-- doar câmpuri publice permise.
--
-- NEAPLICATĂ: o rulează Andrei. Se poate aplica înainte sau după merge (aplicația nu cheamă funcția: niciun
-- `rpc('get_public_farmer_card')` în `src`, nicio altă funcție sau vedere din bază nu o folosește — verificat în
-- `pg_proc.prosrc` și `pg_views` pe 22.11.2026). Nu atinge date.
--
-- Definiția de pornire (producție, `pg_get_functiondef`, 22.11.2026) întorcea:
--   tenant_id, farm_name, full_name, locality, logo_url, legal_badge
-- Nu întorcea numărul atestatului (`certificate_number`) și nici poza (`certificate_photo_url`).
-- Câmpurile publice permise: numele fermei, localitatea, seria, valabilitatea, telefonul.
--   * `full_name` (numele persoanei din actele fermei) și `logo_url` nu sunt pe listă: ies.
--   * `legal_badge` rămâne (e eticheta formei juridice, cea care devine „Atestat de producător”).
--   * `tenant_id` rămâne (e chiar parametrul primit, nu o dată nouă).
--
-- Fiindcă se schimbă coloanele întoarse, funcția se recreează (`drop` + `create`; `create or replace` nu poate
-- scoate coloane). Drepturile rămân ca în producție: `authenticated` și `service_role`, fără `anon` / `PUBLIC`.
--
-- Anulare: definiția veche e în `20260406003_farmer_legal_docs_and_publication_guard.sql`.

begin;

drop function if exists public.get_public_farmer_card(uuid);

create function public.get_public_farmer_card(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  farm_name text,
  locality text,
  legal_badge text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    t.id as tenant_id,
    t.nume_ferma as farm_name,
    coalesce(nullif(btrim(fld.locality), ''), nullif(btrim(t.localitate), '')) as locality,
    case fld.legal_type
      when 'certificat_producator' then 'Atestat de producător'
      when 'pfa' then 'PFA'
      when 'ii' then 'Întreprindere individuală'
      when 'srl' then 'SRL'
      else null
    end as legal_badge
  from public.tenants t
  join public.farmer_legal_docs fld
    on fld.tenant_id = t.id
  where t.id = p_tenant_id
    and fld.legal_docs_complete = true;
$function$;

revoke execute on function public.get_public_farmer_card(uuid) from public, anon;
grant execute on function public.get_public_farmer_card(uuid) to authenticated, service_role;

commit;
