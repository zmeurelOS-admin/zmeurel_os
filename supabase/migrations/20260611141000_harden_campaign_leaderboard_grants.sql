-- Existing default privileges grant broad view access in production.
revoke all on public.campaign_leaderboard from anon, authenticated;
revoke all on public.campaign_leaderboard from service_role;
grant select on public.campaign_leaderboard to service_role;

notify pgrst, 'reload schema';
