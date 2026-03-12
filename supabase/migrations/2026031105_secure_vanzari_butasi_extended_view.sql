drop view if exists public.vanzari_butasi_extended;

create view public.vanzari_butasi_extended
with (security_invoker = true) as
select *
from public.vanzari_butasi;

notify pgrst, 'reload schema';
