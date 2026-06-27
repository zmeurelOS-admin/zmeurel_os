# Security And RLS Notes

## Operator Module Enforcement

- Farm operator access is enforced in two layers: TypeScript route/UI helpers in `src/lib/farm-members/access.ts` and SQL helpers/policies in Supabase migrations.
- Keep `access.ts` and SQL helper behavior manually aligned. The SQL source of truth for DB writes is `operator_can_write(p_module)`, with the same module list, `read`/`write` levels, and legacy fallback of `comenzi` + `livrari` write when normalized access is empty.
- Owners bypass module guards through `is_tenant_owner(...)`. Operators may write only modules with `level = write` and may never delete.
- The guarded RPC surface for operator modules includes `create_recoltare_with_stock` 7-arg, `update_recoltare_with_stock`, `delete_recoltare_with_stock`, `set_comanda_in_delivery`, `set_comanda_delivered`, `promote_shop_order_to_comanda`, `set_shop_order_in_delivery`, `set_shop_order_delivered`, `reorder_shop_deliveries_today`, `delete_comanda_atomic`, `reopen_comanda_atomic`, `upsert_plan_tratament_cu_linii`, and `upsert_with_idempotency`.
- `upsert_with_idempotency` is a generic `SECURITY DEFINER` write path and must remain guarded per target table: `recoltari` uses the `recoltari` module, `activitati_agricole` uses the `activitati` module, and `vanzari`/`cheltuieli_diverse` are owner-only.
- Do not modify association policies or public shop anonymous insert policies while changing farm operator enforcement unless the task explicitly covers those flows.
