-- ============================================================
-- 20260316b_culturi_suprafata_trigger.sql
-- Adaugă trigger BEFORE INSERT/UPDATE pe culturi care apelează
-- validate_suprafata_culturi și respinge depășirea suprafeței.
-- ============================================================

create or replace function public.check_culturi_suprafata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validare doar dacă suprafata_ocupata e completată
  if new.suprafata_ocupata is not null then
    if not public.validate_suprafata_culturi(new.solar_id, new.suprafata_ocupata, new.id) then
      raise exception 'SUPRAFATA_OVERFLOW: Suprafața ocupată de culturi depășește suprafața totală a solarului.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.culturi') is not null then
    drop trigger if exists culturi_check_suprafata on public.culturi;
    create trigger culturi_check_suprafata
      before insert or update of suprafata_ocupata, solar_id on public.culturi
      for each row execute function public.check_culturi_suprafata();
  end if;
end;
$$;

notify pgrst, 'reload schema';
