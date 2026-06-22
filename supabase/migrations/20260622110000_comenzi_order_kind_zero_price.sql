alter table public.comenzi
  add column if not exists order_kind text;

update public.comenzi
set order_kind = 'manual'
where order_kind is null or btrim(order_kind) = '';

alter table public.comenzi
  alter column order_kind set default 'manual',
  alter column order_kind set not null;

alter table public.comenzi
  drop constraint if exists comenzi_order_kind_check;

alter table public.comenzi
  add constraint comenzi_order_kind_check
  check (order_kind in ('manual', 'cadou', 'consum_propriu'));

alter table public.comenzi
  drop constraint if exists comenzi_pret_positive_check,
  drop constraint if exists comenzi_pret_per_kg_check;

alter table public.comenzi
  add constraint comenzi_pret_positive_check check (pret_per_kg >= 0);

alter table public.comenzi
  drop constraint if exists comenzi_total_non_negative_check,
  drop constraint if exists comenzi_total_check;

alter table public.comenzi
  add constraint comenzi_total_non_negative_check check (total >= 0);
