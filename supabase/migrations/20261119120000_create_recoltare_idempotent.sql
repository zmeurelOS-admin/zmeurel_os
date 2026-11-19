-- Recoltări: creare idempotentă (cheie `client_sync_id` trimisă de formular).
--
-- NEAPLICATĂ. Se rulează manual, după aprobare. Aditivă: nu modifică nimic existent.
--
-- De ce: `create_recoltare_with_stock` nu primește nicio cheie, deci o cerere repetată
-- (rețea slabă, reîncercare) poate crea a doua recoltare. Coloana `recoltari.client_sync_id`
-- și indexul unic `recoltari_client_sync_id_uq (client_sync_id)` există deja
-- (2026022502, 2026022504); lipsea doar drumul prin care cheia ajunge în rând.
--
-- Cum: o funcție NOUĂ, înveliș peste `create_recoltare_with_stock` (varianta cu 7 argumente).
-- Corpul funcției existente nu e copiat: verificările de drepturi, blocajul `stock-mutation`,
-- tariful și inserarea rămân într-un singur loc.
--
-- De ce nu un parametru în plus la funcția existentă: cu valoare implicită, apelul cu
-- 7 argumente făcut de aplicația din producție ar potrivi două supraîncărcări, iar PostgREST
-- ar răspunde PGRST203 din clipa aplicării.
--
-- `security invoker`: funcția rulează cu drepturile utilizatorului, deci RLS rămâne activ
-- pe căutare și pe UPDATE (politicile `recoltari_tenant_select` / `recoltari_tenant_update`,
-- 2026031115: `tenant_id = current_tenant_id()`). Verificările de scriere (proprietar sau
-- operator cu drept de scriere) le face `create_recoltare_with_stock`, care e `security definer`.
-- Filtrul explicit pe `current_tenant_id()` e pus oricum, ca funcția să nu depindă doar de RLS.
-- Dacă pe baza reală RLS ar bloca UPDATE-ul, funcția se oprește cu `client_sync_id_not_set`
-- și anulează tot (nu rămâne nicio recoltare fără cheie); atunci se trece pe `security definer`,
-- cu aceleași filtre pe `current_tenant_id()`.
--
-- Rulări simultane cu aceeași cheie: amândouă trec de căutare și inserează, dar a doua
-- pică la UPDATE pe indexul unic (23505) și tranzacția ei se anulează cu tot cu inserare.
-- Clientul tratează 23505 ca reușită și recitește rândul după cheie.
--
-- Anulare: drop function if exists public.create_recoltare_idempotent(uuid, date, uuid, uuid, numeric, numeric, text, uuid);

create or replace function public.create_recoltare_idempotent(
  p_client_sync_id uuid,
  p_data date,
  p_parcela_id uuid,
  p_culegator_id uuid,
  p_kg_cal1 numeric default 0,
  p_kg_cal2 numeric default 0,
  p_observatii text default null,
  p_tenant_id uuid default null
)
returns public.recoltari
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_recoltare public.recoltari;
begin
  if p_client_sync_id is null then
    raise exception 'client_sync_id_required';
  end if;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  -- Cheia a mai fost folosită în acest tenant: recoltarea există, o întoarcem (reîncercare = reușită).
  select r.*
  into v_recoltare
  from public.recoltari r
  where r.client_sync_id = p_client_sync_id
    and r.tenant_id = v_tenant_id;

  if found then
    return v_recoltare;
  end if;

  select created.*
  into v_recoltare
  from public.create_recoltare_with_stock(
    p_data,
    p_parcela_id,
    p_culegator_id,
    p_kg_cal1,
    p_kg_cal2,
    p_observatii,
    p_tenant_id
  ) as created;

  -- Aceeași tranzacție: cheia ajunge pe rândul abia creat, și doar pe el.
  update public.recoltari r
  set client_sync_id = p_client_sync_id
  where r.id = v_recoltare.id
    and r.tenant_id = v_tenant_id
  returning r.*
  into v_recoltare;

  if not found then
    raise exception 'client_sync_id_not_set';
  end if;

  return v_recoltare;
end;
$$;

revoke all on function public.create_recoltare_idempotent(uuid, date, uuid, uuid, numeric, numeric, text, uuid) from public, anon;
grant execute on function public.create_recoltare_idempotent(uuid, date, uuid, uuid, numeric, numeric, text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
