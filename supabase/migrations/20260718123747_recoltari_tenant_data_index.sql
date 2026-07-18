-- Index compus pentru getRecoltari(): filtrează WHERE tenant_id = X și
-- sortează ORDER BY data DESC (src/lib/supabase/queries/recoltari.ts).
-- Fără el existau doar indexuri pe (tenant_id) și (tenant_id, created_at desc),
-- deci planner-ul filtra pe tenant apoi sorta `data` în memorie.
-- `recoltari` are scriere redusă (câteva rânduri/zi) și `data` e rareori
-- actualizat după insert, deci overhead-ul de întreținere a indexului la
-- INSERT/UPDATE e neglijabil față de câștigul pe citire.
create index if not exists recoltari_tenant_data_idx
on public.recoltari (tenant_id, data desc);

notify pgrst, 'reload schema';
