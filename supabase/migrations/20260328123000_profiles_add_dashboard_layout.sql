alter table public.profiles
add column if not exists dashboard_layout jsonb default null;
