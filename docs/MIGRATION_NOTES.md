# Migration Notes

## Duplicate Migration Files

Repo-ul conține duplicate istorice între formatul scurt `YYYYMMDD_name.sql` și formatul extins `YYYYMMDDNN_name.sql`.

Aceste fișiere nu trebuie șterse din istoric, deoarece unele medii pot avea deja aplicată una dintre variante. Duplicatele sunt păstrate doar pentru compatibilitate și trebuie tratate ca artefacte idempotente.

### Duplicate documentate

- `20260313_atomic_order_operations.sql`
  Duplicat idempotent pentru grupul:
  `2026031301_delete_comanda_atomic.sql`,
  `2026031302_reopen_comanda_atomic.sql`,
  `2026031303_atomic_order_permissions.sql`
- `20260313_cleanup_orphan_demo_tenants.sql`
  Duplicat idempotent pentru:
  `2026031304_cleanup_orphan_demo_tenants.sql`
- `20260313_normalize_payment_status.sql`
  Duplicat idempotent pentru:
  `2026031305_normalize_payment_status.sql`
- `20260313_update_vanzare_with_stock.sql`
  Duplicat idempotent pentru:
  `2026031306_update_vanzare_with_stock.sql`
- `20260314_add_demo_fields_to_tenants.sql`
  Duplicat idempotent pentru:
  `2026031401_add_demo_fields_to_tenants.sql`
- `20260314_add_stadiu_to_parcele.sql`
  Duplicat idempotent pentru:
  `2026031402_add_stadiu_to_parcele.sql`
- `20260315_beta_launch_analytics_cleanup.sql`
  Duplicat idempotent pentru:
  `2026031501_beta_launch_analytics_cleanup.sql`
- `20260315_vanzari_butasi_add_client_name_manual.sql`
  Duplicat idempotent pentru:
  `2026031502_vanzari_butasi_add_client_name_manual.sql`

## Guidance

- Nu șterge duplicatele deja versionate din `supabase/migrations/`.
- Pentru migrări noi, folosește doar formatul lung și unic al proiectului.
- Dacă o migrare veche trebuie înlocuită, creează una nouă în loc să modifici sau să elimini fișierul istoric.
