-- Operatorul intră din link (promptul 23): invitația ține numele și telefonul omului invitat.
-- Aditivă: două coloane nullable, fără backfill. Aplicația merge și fără ea (invitația pleacă fără nume,
-- iar contul ascuns se numește „Operator”).

alter table public.farm_invites
  add column if not exists invitee_name text,
  add column if not exists invitee_phone text;

comment on column public.farm_invites.invitee_name is
  'Numele omului invitat (scris de proprietar). Devine full_name pe contul ascuns și name în farm_members.';
comment on column public.farm_invites.invitee_phone is
  'Telefonul omului invitat (opțional), copiat în farm_members.phone.';

comment on column public.farm_invites.used_by_user_id is
  'Cine a folosit linkul. La linkurile de reconectare („Retrimite linkul”) e pus de la creare: utilizatorul ascuns în care se intră; modules_access e gol, drepturile vin din farm_members.';

notify pgrst, 'reload schema';
