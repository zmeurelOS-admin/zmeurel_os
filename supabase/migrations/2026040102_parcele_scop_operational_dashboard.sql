-- Extinde clasificarea parcelelor pentru dashboard comercial si operational.
-- - rol (scop): comercial | personal | experimental | inactiv (migraza uz_propriu -> personal)
-- - apare_in_dashboard, contribuie_la_productie: control fin pentru fermieri
-- - status_operational: activ | in_pauza | neproductiv | infiintare | arhivat
-- Pastreaza coloana status (ciclului culturii) separat de status_operational.

alter table public.parcele drop constraint if exists parcele_rol_check;

update public.parcele
set rol = 'personal'
where rol = 'uz_propriu';

alter table public.parcele
  add column if not exists apare_in_dashboard boolean not null default true,
  add column if not exists contribuie_la_productie boolean not null default true,
  add column if not exists status_operational text not null default 'activ';

update public.parcele
set
  apare_in_dashboard = false,
  contribuie_la_productie = false
where rol in ('personal', 'experimental', 'inactiv');

alter table public.parcele
  add constraint parcele_rol_check
  check (rol in ('comercial', 'personal', 'experimental', 'inactiv'));

alter table public.parcele
  add constraint parcele_status_operational_check
  check (status_operational in ('activ', 'in_pauza', 'neproductiv', 'infiintare', 'arhivat'));

comment on column public.parcele.rol is 'Scop teren: comercial, personal, experimental, inactiv';
comment on column public.parcele.apare_in_dashboard is 'Daca terenul intra in contextul implicit al dashboard-ului principal (in combinatie cu scopul comercial)';
comment on column public.parcele.contribuie_la_productie is 'Daca terenul conteaza pentru productie / vanzari in rapoarte si dashboard';
comment on column public.parcele.status_operational is 'Stare operationala aferenta fermei (activ, in pauza etc.), separata de statusul ciclului culturii';

notify pgrst, 'reload schema';
