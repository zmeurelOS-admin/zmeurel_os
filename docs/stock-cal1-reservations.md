# Flux stoc comercial: cal1-only + rezervare la `in_livrare`

Data: `2026-06-22`

## Reguli

- Recoltările noi scriu în `miscari_stoc` doar intrarea `cal1` prin `public.sync_recoltare_stock_movements`.
- `kg_cal2` rămâne în `public.recoltari` pentru evidență operațională, dar nu intră în stocul comercial disponibil.
- Punctul unic de adevăr pentru disponibilitate este `public.get_sellable_cal1_stock_summary(p_tenant_id uuid default null)`.
- Disponibilul comercial urmărit pentru blocarea supra-vânzării este:
  `stoc cal1 ledger - rezervări active - comenzi legacy aflate deja în livrare fără rezervare`.

## Rezervare și consum

- `set_comanda_in_delivery_with_reservation(uuid)`:
  validează disponibilul `cal1`, alocă bucket-uri din `list_sellable_cal1_buckets_for_reservation()` și scrie rânduri `active` în `public.stock_reservations`.
- `set_shop_order_in_delivery_with_reservation(uuid, date)`:
  face același lucru pentru `shop_orders`, pe baza greutății calculate din `items`.
- `release_comanda_delivery_reservation(...)` și `release_shop_order_delivery_reservation(...)`:
  marchează rezervările `released` la ieșirea din `in_livrare`.
- `deliver_order_atomic(...)`:
  dacă găsește rezervări `active` pentru comandă, consumă exact split-ul rezervat și marchează rândurile `consumed`; dacă nu găsește rezervări, păstrează allocatorul legacy neschimbat.

## Shop bridge

- La `deliver_shop_order_atomic` și `deliver_shop_order_atomic_partial`, rezervările active ale `shop_order` sunt atașate comenzii ERP-bridge înainte de apelul `deliver_order_atomic`.
- Asta evită dubla-deducere și păstrează compatibilitatea cu comenzile istorice care ajung în livrare fără rezervare.
