drop policy if exists ai_conv_delete_own on public.ai_conversations;
create policy ai_conv_delete_own
  on public.ai_conversations
  for delete
  using (user_id = auth.uid());

drop policy if exists ai_conv_update_own on public.ai_conversations;
create policy ai_conv_update_own
  on public.ai_conversations
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
