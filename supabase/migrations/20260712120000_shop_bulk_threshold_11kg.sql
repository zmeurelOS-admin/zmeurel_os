-- Mutare prag de volum shop de la 10 kg la 11 kg (2026-07-12).
--
-- Prețurile rămân neschimbate (17,50 / 15,00 lei per caserolă). Singura
-- schimbare: bulk_threshold_kg de pe rândul global 'zmeura' trece de la 10 la
-- 11. Logica de comparație (>= prag, retroactiv pe tot coșul) rămâne neatinsă
-- în cod — doar valoarea pragului configurat în DB se schimbă.
--
-- Efect: 10 kg și 10,5 kg (20/21 caserole) rămân la preț de bază (35 lei/kg);
-- 11 kg (22 caserole) și peste trec la preț de volum (30 lei/kg) pe tot coșul.
--
-- Idempotentă (rerulare = notice + skip dacă e deja 11), cu assert pe
-- valoarea veche (10) și exact 1 rând afectat, rollback la nepotrivire.
-- DOAR UPDATE — fără alte modificări de schemă sau alte date.

do $$
declare
  v_count integer;
  v_threshold numeric;
begin
  select bulk_threshold_kg into v_threshold
  from public.shop_products
  where id = 'zmeura';

  if v_threshold is null then
    raise exception 'Rândul shop_products ''zmeura'' nu are bulk_threshold_kg setat — rollback.';
  end if;

  if v_threshold = 11 then
    raise notice 'Pragul e deja 11 kg — UPDATE sărit (migrare rerulată).';
    return;
  end if;

  if v_threshold <> 10 then
    raise exception 'Prag neașteptat pe ''zmeura'': % (așteptat 10) — rollback pentru inspecție manuală.', v_threshold;
  end if;

  update public.shop_products
  set bulk_threshold_kg = 11
  where id = 'zmeura'
    and bulk_threshold_kg = 10;

  get diagnostics v_count = row_count;
  raise notice 'Prag de volum mutat pe ''zmeura'': 10 kg -> 11 kg (% rând).', v_count;

  if v_count <> 1 then
    raise exception 'UPDATE-ul de prag a atins % rânduri în loc de 1 — rollback.', v_count;
  end if;
end
$$;

notify pgrst, 'reload schema';
