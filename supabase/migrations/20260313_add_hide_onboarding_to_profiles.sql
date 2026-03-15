alter table public.profiles
  add column if not exists hide_onboarding boolean not null default false;

notify pgrst, 'reload schema';
