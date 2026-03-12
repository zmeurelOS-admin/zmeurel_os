drop view if exists public.vanzari_butasi_extended;

alter table public.culegatori
alter column id_culegator type varchar(50);

alter table public.investitii
alter column id_investitie type varchar(50);

alter table public.vanzari_butasi
alter column id_vanzare_butasi type varchar(50);

create view public.vanzari_butasi_extended as
select *
from public.vanzari_butasi;
